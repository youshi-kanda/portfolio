/**
 * `node scripts/public-safe-scan.ts <mode…>` — the generic public-safe scan.
 *
 * What this is FOR: this repository is public. Everything tracked in it, and
 * everything the build emits from it, is published the moment it is pushed.
 * This reads that surface for the things that must never be on it.
 *
 * What this is NOT for, and cannot be: the customer names, private repository
 * names, internal issue numbers and internal paths that belong to a private
 * engagement. Those patterns cannot live in a public repository — not as
 * plaintext and not as hashes, because a hash of a short identifier is a
 * dictionary away from the identifier. They live in `review-private/`
 * (gitignored) and are read only by `--private`, on a machine that has them.
 * A private match is reported as rule / file / line with the match itself
 * redacted, so that the scan's own output is safe to paste into a chat, an
 * issue or a review — see `redact` on `Rule`.
 *
 *   PUBLIC CI     generic, public-safe checks           --tracked --dist
 *   LOCAL         the above, plus the private patterns  --tracked --staged
 *                                                       --dist --private
 *
 * The modes are separate flags rather than one command because they read
 * genuinely different things — the working tree as committed, the change about
 * to be committed, and the built artifact. Folding them together would mean CI
 * either scanning a staged diff that does not exist there, or the local hook
 * rebuilding dist to check a commit.
 *
 * Exit 0 = nothing found. Exit 1 = something was, or a mode could not run.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../', import.meta.url));
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: SITE })
  .toString()
  .trim();

/**
 * Read as text only. A binary is not scanned, and the count of what was
 * skipped is printed — image metadata (tEXt / iTXt / eXIf) is out of this
 * script's reach and stays a manual step of the release pack, as it was for
 * the Phase 0 baseline.
 */
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|otf|zip|gz|mp4|webm)$/i;
/** Nothing here is published, so nothing here is this check's business. */
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.astro|review-private)(\/|$)/;

interface Rule {
  code: string;
  re: RegExp;
  what: string;
  /**
   * Never print what this rule matched.
   *
   * Set on the private patterns and on nothing else. A private pattern fires on
   * a customer name, a private repository name or an internal identifier — the
   * exact strings that cannot be in this repository — and a report that quotes
   * the match puts one on stdout, where it is pasted into a chat, an issue or a
   * review. The finding still has to say WHERE to look, so the rule id, the
   * file and the line are printed and the match is not.
   */
  redact?: true;
}

/**
 * Generic secrets and locators. Every one of these is a thing that is a defect
 * in a public repository REGARDLESS of what project it belongs to, which is
 * what makes them safe to state here in the open.
 */
const RULES: readonly Rule[] = [
  { code: 'PRIVATE-KEY', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, what: '秘密鍵' },
  { code: 'AWS-KEY', re: /\bAKIA[0-9A-Z]{16}\b/g, what: 'AWS access key id' },
  { code: 'GH-TOKEN', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, what: 'GitHub token' },
  { code: 'SLACK-TOKEN', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, what: 'Slack token' },
  { code: 'GAS-DEPLOY', re: /\bAKfycb[\w-]{30,}\b/g, what: 'Apps Script deployment id' },
  {
    code: 'CREDENTIAL',
    re: /\b(api[_-]?key|secret|password|passwd|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/gi,
    what: '資格情報の代入',
  },
  {
    code: 'BEARER',
    re: /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._-]{20,}/gi,
    what: 'Bearer token',
  },
  {
    code: 'DB-URL',
    re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s'"`/]+:[^\s'"`/]+@/gi,
    what: '資格情報つき接続 URL',
  },
  {
    code: 'ID-ASSIGN',
    re: /\b(spreadsheet[_-]?id|script[_-]?id|sheet[_-]?id|project[_-]?id|calendar[_-]?id)\b\s*[:=]\s*['"`][\w-]{20,}['"`]/gi,
    what: '外部サービスの ID',
  },
  { code: 'ABS-HOME', re: /\/home\/[a-z0-9_.-]+\//gi, what: '作業機のホームディレクトリ' },
  { code: 'ABS-WIN', re: /[A-Z]:\\Users\\[^\\\s'"`]+/gi, what: '作業機のホームディレクトリ' },
  { code: 'ABS-TMP', re: /\/(?:tmp|var\/folders)\/[\w./-]{8,}/g, what: '一時ディレクトリの実パス' },
];

/**
 * Matches that are the site's own published content, each with the reason it
 * is not a leak. An allowance is a decision; it is listed, not inferred, and it
 * is scoped four ways — the RULE it answers, the FILE it applies in, the VALUE
 * that makes it safe, and WHY.
 *
 * All four are load-bearing. "every password under tests/" would be a standing
 * permission for whatever lands next to a fixture, and the day a real
 * credential is pasted into one of those files it would ship unremarked. Naming
 * the file and the value means the allowance covers the thing that was actually
 * examined and nothing else: another literal in the same file still fails, and
 * the same literal in another file still fails.
 *
 * Naming the VALUE rather than the surrounding syntax is not a style choice.
 * This file is itself tracked, so it is itself scanned — and the first version
 * of this list wrote the allowance as the whole assignment, which the
 * credential rule then matched inside this file. An allowlist that trips the
 * scanner it belongs to is a scanner that cannot be run.
 */
interface Allowance {
  /** The rule this allowance applies to. It does not widen any other. */
  code: string;
  /**
   * Where it applies: a repository-relative path, or a glob over one.
   * `*` stops at a path separator, `**` does not.
   */
  file: string;
  /** The value that makes this match not a leak. */
  contains: string;
  why: string;
}

const ALLOW: readonly Allowance[] = [
  {
    code: 'CREDENTIAL',
    file: 'ai-crm-demo/backend/apps/*/tests/*.py',
    contains: 'StrongPass123!',
    why:
      'AI CRM demo の test fixture。合成データのデモ用ユーザを作る固定値で、' +
      'どの環境の資格情報でもない。file と値の両方を名指しするので、' +
      '同じ file の別の literal も、別の file の同じ literal も今も落ちる。',
  },
  {
    code: 'CREDENTIAL',
    file: 'ai-crm-demo/backend/apps/*/tests/*.py',
    contains: 'Pass123!',
    why: '同上（マスキング系 test が使うもう 1 つの fixture 値）。',
  },
  {
    code: 'DB-URL',
    file: 'ai-crm-demo/docs/design/*.md',
    contains: 'ai_crm_user:ai_crm_password@',
    why:
      '構築手順書の placeholder。ユーザ名も値も "ai_crm_user" / "ai_crm_password" という' +
      '説明用の literal で、稼働中の接続情報ではない。',
  },
];

/**
 * `*` matches within a path segment, `**` across segments. Deliberately small:
 * an allowance's file scope should be readable at a glance, and a full glob
 * dialect invites patterns nobody can evaluate by eye.
 */
function fileMatches(pattern: string, path: string): boolean {
  const re = pattern
    .split(/(\*\*|\*)/)
    .map((part) =>
      part === '**' ? '.*' : part === '*' ? '[^/]*' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('');
  return new RegExp(`^${re}$`).test(path);
}

/** Which allowances were actually needed. An unused one is a permission for nothing. */
const used = new Set<number>();

interface Finding {
  where: string;
  line: number;
  code: string;
  what: string;
  text: string;
  /** From the rule: this finding may not print what it matched. */
  redact: boolean;
}

const scanText = (where: string, text: string): Finding[] => {
  const out: Finding[] = [];
  const lines = text.split('\n');
  // `where` carries a mode label for the reader; the allowance is about the file.
  const path = where.replace(/ \(staged\)$/, '');
  for (const rule of RULES) {
    for (const [i, line] of lines.entries()) {
      for (const m of line.matchAll(rule.re)) {
        const hit = m[0];
        const allowed = ALLOW.findIndex(
          (a) => a.code === rule.code && fileMatches(a.file, path) && hit.includes(a.contains),
        );
        if (allowed >= 0) {
          used.add(allowed);
          continue;
        }
        out.push({
          where,
          line: i + 1,
          code: rule.code,
          what: rule.what,
          text: hit,
          redact: rule.redact === true,
        });
      }
    }
  }
  return out;
};

const readIfText = (abs: string): string | null => {
  if (BINARY.test(abs)) return null;
  try {
    if (statSync(abs).size > 2_000_000) return null;
    return readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
};

function scanTracked(): { findings: Finding[]; scanned: number; binary: number } {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: REPO, maxBuffer: 1 << 28 })
    .toString()
    .split('\0')
    .filter(Boolean);
  const findings: Finding[] = [];
  let scanned = 0;
  let binary = 0;
  for (const rel of files) {
    const text = readIfText(join(REPO, rel));
    if (text === null) {
      binary += 1;
      continue;
    }
    scanned += 1;
    findings.push(...scanText(rel, text));
  }
  return { findings, scanned, binary };
}

function scanStaged(): { findings: Finding[]; scanned: number } {
  const names = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], { cwd: REPO })
    .toString()
    .split('\0')
    .filter(Boolean);
  const findings: Finding[] = [];
  for (const rel of names) {
    if (BINARY.test(rel)) continue;
    let staged = '';
    try {
      staged = execFileSync('git', ['show', `:${rel}`], { cwd: REPO, maxBuffer: 1 << 28 }).toString();
    } catch {
      continue; // deleted in the index
    }
    findings.push(...scanText(`${rel} (staged)`, staged));
  }
  return { findings, scanned: names.length };
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (SKIP_DIR.test(full)) return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function scanDist(): { findings: Finding[]; scanned: number; binary: number } | null {
  const dist = join(SITE, 'dist');
  if (!existsSync(dist)) return null;
  const findings: Finding[] = [];
  let scanned = 0;
  let binary = 0;
  for (const abs of walk(dist)) {
    const text = readIfText(abs);
    if (text === null) {
      binary += 1;
      continue;
    }
    scanned += 1;
    findings.push(...scanText(`dist/${relative(dist, abs)}`, text));
  }
  return { findings, scanned, binary };
}

/**
 * The private patterns, read from the gitignored sidecar. One per line, `#`
 * for comments.
 *
 * Neither the pattern nor what it matched appears in output. Withholding only
 * the pattern was not enough: the pattern and the string it fires on are the
 * same identifier, so printing the match printed the secret the pattern exists
 * to keep out of this repository — and this scan's own output is pasted into
 * chats, issues and reviews. `redact` is what makes the report safe to paste.
 */
function privateRules(): Rule[] | null {
  const file = join(REPO, 'review-private/private-patterns.local.txt');
  if (!existsSync(file)) return null;
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'))
    .map((pattern, i) => ({
      code: `PRIVATE-${i + 1}`,
      re: new RegExp(pattern, 'gi'),
      what: `private pattern #${i + 1}（内容は出力しない）`,
      redact: true as const,
    }));
}

/** The private patterns, kept for redacting the paths a private finding names. */
let privatePatterns: readonly Rule[] = [];

/**
 * A path safe to print beside a redacted match.
 *
 * A finding has to say where to look or it cannot be acted on, and a
 * repository-relative path is normally the most useful thing to print. But a
 * private pattern can fire on a path as easily as on a line — a file named
 * after a customer, or one under a directory named after an engagement — and
 * then the location leaks exactly what the match was withheld to protect. So
 * the path is run through the private patterns too, and any part of it that
 * fires is replaced. What survives still names the directory and the extension,
 * which is enough to find the file on the machine that has it.
 */
function safePath(where: string): string {
  let out = where;
  for (const rule of privatePatterns) {
    out = out.replace(new RegExp(rule.re.source, 'gi'), `[${rule.code}]`);
  }
  return out;
}

const argv = process.argv.slice(2);
const modes = {
  tracked: argv.includes('--tracked'),
  staged: argv.includes('--staged'),
  dist: argv.includes('--dist'),
  private: argv.includes('--private'),
};
if (!modes.tracked && !modes.staged && !modes.dist) {
  console.error('mode を 1 つ以上指定すること: --tracked / --staged / --dist [--private]');
  process.exit(1);
}

if (modes.private) {
  const extra = privateRules();
  if (!extra) {
    console.error(
      '--private が指定されたが review-private/private-patterns.local.txt が無い。\n' +
        'private pattern はこのリポジトリには置かない（hash でも置かない）。\n' +
        'ローカルの sidecar を用意するか、--private を外して public-safe 検査だけ実行する。',
    );
    process.exit(1);
  }
  (RULES as Rule[]).push(...extra);
  privatePatterns = extra;
  console.log(
    `private patterns: ${extra.length} 件を追加（pattern も一致した文字列も表示しない）`,
  );
}

const all: Finding[] = [];

if (modes.tracked) {
  const { findings, scanned, binary } = scanTracked();
  all.push(...findings);
  console.log(`tracked: ${scanned} files scanned / ${binary} binary skipped`);
}
if (modes.staged) {
  const { findings, scanned } = scanStaged();
  all.push(...findings);
  console.log(`staged:  ${scanned} file(s) in the index`);
}
if (modes.dist) {
  const result = scanDist();
  if (!result) {
    console.error('dist/ が無い。--dist の前に npm run build を実行すること。');
    process.exit(1);
  }
  all.push(...result.findings);
  console.log(`dist:    ${result.scanned} files scanned / ${result.binary} binary skipped`);
}

console.log(`rules: ${RULES.length} / allowances: ${ALLOW.length} (used ${used.size})`);

// An allowance nobody needed is a standing permission for something that is no
// longer there. Reported, not failed: a mode that did not run this time is a
// legitimate reason for one to be idle.
const idle = ALLOW.map((a, i) => ({ a, i })).filter(({ i }) => !used.has(i));
if (idle.length > 0) {
  console.log(`unused allowance(s): ${idle.map(({ a }) => `${a.code} @ ${a.file}`).join(', ')}`);
}

if (all.length > 0) {
  console.error(`\nPUBLIC_SAFE_SCAN = FAIL（${all.length}）`);
  for (const f of all) {
    if (f.redact) {
      // Rule, file, line — and no match. Enough to open the file and fix it;
      // not enough to be a leak of its own if this output is pasted somewhere.
      console.error(
        `  PRIVATE_MATCH rule=${f.code} file=${safePath(f.where)} line=${f.line} match=[REDACTED]`,
      );
      continue;
    }
    console.error(`  [${f.code}] ${f.where}:${f.line} — ${f.what}\n      ${f.text}`);
  }
  process.exit(1);
}

console.log('PUBLIC_SAFE_SCAN = PASS');
