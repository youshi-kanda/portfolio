/**
 * The production deploy contract.
 *
 * `deploy-production.yml` is the one file in this repository whose mistakes are
 * only observable in production, on a machine no test can reach. What *can* be
 * checked here is its shape — the handful of properties that, if they silently
 * regress, turn a safe deploy into a destructive one:
 *
 *   - the artifact that gets uploaded is the artifact QA inspected;
 *   - rollback fires only when the pointer actually moved;
 *   - a re-run of the same commit is a true no-op;
 *   - the served symlink is replaced by rename, never removed and recreated;
 *   - nothing runs as root.
 *
 * These are assertions about literal workflow text on purpose. GitHub reads the
 * text, so the text is the contract.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const WORKFLOW_URL = new URL('../../.github/workflows/deploy-production.yml', import.meta.url);
const SMOKE_URL = new URL('../../.github/scripts/production-smoke.sh', import.meta.url);

const WORKFLOW = readFileSync(WORKFLOW_URL, 'utf8');
const SMOKE = readFileSync(SMOKE_URL, 'utf8');

/** Steps are the unit the `if:` guards attach to, so split on the step marker. */
const STEPS = WORKFLOW.split(/\n {6}- name: /)
  .slice(1)
  .map((block) => ({ name: block.split('\n')[0]!.trim(), block }));

const step = (fragment: string) => {
  const found = STEPS.filter((s) => s.name.includes(fragment));
  assert.equal(found.length, 1, `expected exactly one step matching "${fragment}"`);
  return found[0]!;
};

/** Folded YAML scalars wrap; compare on a single line so wrapping is irrelevant. */
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Comments explain the rules; they must not be able to satisfy them. Every
 * assertion about what the workflow *does* runs against this.
 */
const uncommented = (s: string) =>
  s
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

const CODE = uncommented(WORKFLOW);

describe('production deploy: the artifact that ships', () => {
  it('is the one the QA gate inspected, because nothing rebuilds after it', () => {
    // `npm run qa` already ends in ... build -> check:links -> check:structure
    // -> scan:public. A second `npm run build` would replace the tree those
    // stages inspected with one they never saw, and deploy that instead.
    assert.equal(
      CODE.includes('npm run build'),
      false,
      'deploy-production.yml must not rebuild: `npm run qa` already produced and inspected dist/',
    );
    assert.ok(CODE.includes('npm run qa'), 'the QA gate must run');
  });

  it('is uploaded to a release directory, never into the served symlink', () => {
    const upload = step('Upload release');
    assert.ok(upload.block.includes('"portfolio-prod:$RELEASE/"'), 'rsync must target the release dir');
    assert.equal(
      uncommented(upload.block).includes('CURRENT_LINK'),
      false,
      'rsync must never write the symlink nginx serves',
    );
  });
});

describe('production deploy: activation', () => {
  const activate = step('Activate release');

  it('reports whether it actually moved the pointer', () => {
    assert.ok(activate.block.includes('SWITCHED=true'));
    assert.ok(activate.block.includes('SWITCHED=false'));
    assert.ok(
      activate.block.includes('echo "switched=$switched" >> "$GITHUB_OUTPUT"'),
      'the marker must be published as a step output',
    );
  });

  it('refuses to guess when the marker is missing', () => {
    assert.ok(
      /case "\$switched" in\s*\n\s*true\|false\)/.test(activate.block),
      'an unrecognised SWITCHED value must fail the step, not default',
    );
  });

  /**
   * The case this contract exists for. A same-SHA re-run finds `current`
   * already pointing at the release; if that branch rewrote `previous`, a
   * later smoke failure would "roll back" onto a target from some earlier
   * deploy — a change nothing asked for.
   */
  it('does not touch the previous pointer on a same-SHA no-op', () => {
    const noop = activate.block.match(
      /if \[ "\$PREVIOUS_TARGET" = "\$RELEASE" \]; then([\s\S]*?)\n\s*else\b/,
    );
    assert.ok(noop, 'the no-op branch must be identifiable');
    const branch = uncommented(noop![1]!);
    assert.ok(branch.includes('SWITCHED=false'));
    assert.equal(branch.includes('PREVIOUS_FILE'), false, 'the no-op branch must not write `previous`');
    assert.equal(branch.includes('mv -T'), false, 'the no-op branch must not rename anything');
  });

  it('records the previous target before renaming, on the branch that does switch', () => {
    const real = activate.block.match(/\n\s*else\b([\s\S]*?)\n\s*fi\b/);
    assert.ok(real, 'the switching branch must be identifiable');
    const branch = uncommented(real![1]!);
    const recordAt = branch.indexOf('> "$PREVIOUS_FILE"');
    const renameAt = branch.indexOf('mv -T');
    assert.ok(recordAt >= 0, 'the switching branch must record `previous`');
    assert.ok(renameAt >= 0, 'the switching branch must rename');
    assert.ok(recordAt < renameAt, '`previous` must be recorded before the rename, not after');
    assert.ok(branch.includes('SWITCHED=true'));
  });
});

describe('production deploy: rollback', () => {
  for (const name of ['Roll back to previous release', 'Re-smoke after rollback']) {
    it(`"${name}" runs only after an activation that moved the pointer`, () => {
      const guard = squash(step(name).block);
      assert.ok(guard.includes('failure()'), 'must be failure-gated');
      assert.ok(
        guard.includes("steps.activate.outcome == 'success'"),
        'a failure before activation means the pointer never moved',
      );
      assert.ok(
        guard.includes("steps.activate.outputs.switched == 'true'"),
        'a same-SHA no-op must never roll back',
      );
    });
  }
});

describe('production deploy: the operations it is allowed to perform', () => {
  it('runs no sudo at all', () => {
    // The deploy account has no passwordless rule, and a sudo password in a
    // secret is not a design this repository carries. Even a diagnostic
    // `sudo -n true` writes a failure line to auth.log on every deploy.
    assert.equal(CODE.includes('sudo'), false, 'the workflow must contain no sudo');
  });

  it('replaces the symlink by rename, never by removing it first', () => {
    assert.equal(CODE.includes('ln -sfn'), false, 'ln -sfn can resolve through the link into the old release');
    assert.equal(/rm\s+-rf?\b/.test(CODE), false, 'the served root must never cease to exist');
    assert.ok(CODE.includes('mv -T'), 'the switch must be a rename');
  });

  it('pins the host key instead of learning one at deploy time', () => {
    assert.equal(CODE.includes('ssh-keyscan'), false, 'a key learned at deploy time authenticates nothing');
    assert.ok(CODE.includes('StrictHostKeyChecking yes'));
  });
});

describe('production deploy: trigger', () => {
  it('fires only on main', () => {
    const on = WORKFLOW.slice(WORKFLOW.indexOf('\non:'), WORKFLOW.indexOf('\npermissions:'));
    assert.ok(on.includes('- main'));
    assert.equal(on.includes('pull_request'), false);
    assert.equal(on.includes('workflow_dispatch'), false);
  });

  it('covers every input that decides what production serves or accepts', () => {
    const on = WORKFLOW.slice(WORKFLOW.indexOf('\non:'), WORKFLOW.indexOf('\npermissions:'));
    for (const p of [
      'portfolio-site/**',
      '.github/workflows/deploy-production.yml',
      // The smoke script is the accept/reject decision. A change to it that
      // never reaches production is a change to a rule nobody applied.
      '.github/scripts/production-smoke.sh',
    ]) {
      assert.ok(on.includes(p), `paths filter must include ${p}`);
    }
  });

  it('does not cancel a production deploy in flight', () => {
    assert.ok(squash(CODE).includes('group: portfolio-production cancel-in-progress: false'));
  });
});

describe('production smoke script', () => {
  it('is the script the workflow actually runs', () => {
    assert.ok(CODE.includes('.github/scripts/production-smoke.sh'));
  });

  it('reads its route list from the published sitemap rather than a fixed count', () => {
    assert.ok(SMOKE.includes('<loc>'), 'routes must come from the sitemap');
    assert.ok(SMOKE.includes('${#urls[@]}'));
  });

  it('requires the 404 status and the 404 body together', () => {
    // A page that renders the site's 404 but answers 200 is a soft 404 — the
    // exact defect this deploy exists to stop shipping.
    assert.ok(SMOKE.includes('/no-such-page/'));
    assert.ok(SMOKE.includes('NOTFOUND_TITLE'));
    assert.ok(SMOKE.includes('PLACEHOLDER_MARKER'));
  });
});

/**
 * Release naming.
 *
 * The upload target used to be `releases/$GITHUB_SHA`. Once a commit was live,
 * that directory *was* `current`'s target — so re-running the workflow pointed
 * `rsync --delete` at the tree nginx was serving and rewrote it in place,
 * before activation had any say and regardless of what it later reported. The
 * name now carries the run attempt, which cannot collide with a serving
 * release.
 */
const activateStep = step('Activate release');

/** The workflow's own formula, read out of the file rather than restated here. */
const RELEASE_ID_EXPR = (() => {
  const m = WORKFLOW.match(/^\s*RELEASE_ID:\s*(.+)$/m);
  assert.ok(m, 'the workflow must define RELEASE_ID');
  return m![1]!.trim();
})();

const releaseIdFor = (sha: string, runId: string, attempt: string) =>
  RELEASE_ID_EXPR.replace(/\$\{\{\s*github\.sha\s*\}\}/g, sha)
    .replace(/\$\{\{\s*github\.run_id\s*\}\}/g, runId)
    .replace(/\$\{\{\s*github\.run_attempt\s*\}\}/g, attempt);

describe('production deploy: release naming', () => {
  it('keys the release on the commit, the run and the attempt', () => {
    for (const ctx of ['github.sha', 'github.run_id', 'github.run_attempt']) {
      assert.ok(
        RELEASE_ID_EXPR.includes(ctx),
        `RELEASE_ID must include ${ctx} — without the attempt, a re-run uploads into the live release`,
      );
    }
  });

  it('never derives an upload target from the commit alone', () => {
    assert.equal(
      /RELEASES_DIR\/\$GITHUB_SHA/.test(CODE),
      false,
      'a per-commit release directory is the live tree once that commit is deployed',
    );
  });

  it('uses the same release id to upload, verify and activate', () => {
    for (const name of ['Upload release', 'Verify release contents', 'Activate release']) {
      assert.ok(
        step(name).block.includes('$RELEASE_ID'),
        `${name} must address the release by RELEASE_ID`,
      );
    }
  });

  it('gives a different directory to every attempt of the same run', () => {
    const one = releaseIdFor('abc123', '42', '1');
    const two = releaseIdFor('abc123', '42', '2');
    assert.notEqual(one, two, 'attempt 2 must not reuse attempt 1’s directory');
    assert.ok(one.includes('abc123'), 'the commit must stay in the name, for traceability');
  });
});

/**
 * The same property, executed rather than asserted about: run the real
 * activation script from the workflow against throwaway directories and check
 * that a second attempt leaves the first attempt's tree byte-for-byte intact.
 */
describe('production deploy: a re-run does not touch the live release', () => {
  /** Pull the remote script out of the step's YAML block scalar and de-indent it. */
  const remoteScript = (() => {
    const run = activateStep.block.slice(activateStep.block.indexOf('run: |'));
    const body = run
      .split('\n')
      .slice(1)
      .map((l) => (l.startsWith(' '.repeat(10)) ? l.slice(10) : l))
      .join('\n');
    const m = body.match(/<<'REMOTE'[^\n]*\n([\s\S]*?)\nREMOTE\n/);
    assert.ok(m, 'the activate step must contain a REMOTE heredoc');
    return m![1]!;
  })();

  it('leaves attempt 1 unchanged when attempt 2 deploys', () => {
    const root = mkdtempSync(join(tmpdir(), 'deploy-contract-'));
    try {
      const live = join(root, 'portfolio-live');
      const releases = join(live, 'releases');
      const current = join(live, 'current');
      const previous = join(live, 'previous');

      const id1 = releaseIdFor('abc123', '42', '1');
      const id2 = releaseIdFor('abc123', '42', '2');
      assert.notEqual(id1, id2);

      mkdirSync(join(releases, id1), { recursive: true });
      writeFileSync(join(releases, id1, 'index.html'), 'attempt one');
      symlinkSync(join(releases, id1), current);
      writeFileSync(previous, `${join(releases, id1)}\n`);

      const activate = (id: string) =>
        execFileSync('bash', ['-s', '--', live, releases, current, previous, id], {
          input: remoteScript,
          encoding: 'utf8',
        });

      // Attempt 1 is live.
      assert.match(activate(id1), /SWITCHED=false/);
      const frozen = createHash('sha256')
        .update(readFileSync(join(releases, id1, 'index.html')))
        .digest('hex');

      // Attempt 2 uploads into its own directory — the name the workflow
      // computes — and activates.
      mkdirSync(join(releases, id2), { recursive: true });
      writeFileSync(join(releases, id2, 'index.html'), 'attempt two');
      assert.match(activate(id2), /SWITCHED=true/);

      const after = createHash('sha256')
        .update(readFileSync(join(releases, id1, 'index.html')))
        .digest('hex');
      assert.equal(after, frozen, 'attempt 1’s release must be byte-for-byte unchanged');
      assert.equal(readlinkSync(current), join(releases, id2));
      assert.equal(readFileSync(previous, 'utf8').trim(), join(releases, id1));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
