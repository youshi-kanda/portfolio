/**
 * #30 Phase 9-2 — FEATURED WORK の階層と証拠導線。
 *
 * この Issue が決めたのは 2 つ。どれを代表作として先に読ませるか（HD-G）と、
 * 読み手が何を自分で確認しに行けるか（証拠導線）である。どちらも「見た目の
 * 好み」ではなく、本人が決めて記録に残した事実なので、ここで固定する。
 *
 * 見ているのはデータと純粋関数だけ。描画された HTML 側の契約
 * （data-featured-tier の件数・順序・withheld URL の不在）は
 * `check:structure` が dist に対して見ている——component の中からは自分の
 * ブロックしか見えず、5 件の順序は誰にも見えないからである。
 *
 * HD-D は未決のままである。`hire` / `minio` / `docai` は public-repo でありながら
 * linkPolicy = withheld で、#30 はその判断を先取りしない。下の「URL が作れない」
 * テストは、その未決が公開面に漏れないことを確かめている。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadWorks } from '../src/lib/content/load.ts';
import {
  developmentBackground,
  featuredHomepageWorks,
  isPrimaryFeatured,
  linkableSourceWorks,
  shippingWorks,
  workFeaturedTier,
  workPublicSourceUrl,
  workShowsCaseStudyCta,
} from '../src/lib/content/derive.ts';
import { workRepoPath, workSourceIsLinkable } from '../src/lib/content/compat.ts';
import { loadCopy } from '../src/lib/content/load.ts';
import { workSchema, type PortfolioProfile } from '../src/lib/content/schema.ts';
import { ui } from '../src/lib/content/ui.ts';
import { clone, sampleWork } from './helpers.ts';

/** Issue #30 comment 5746615341 — HD-G の本人決定そのまま。 */
const PRIMARY = ['ins-ai', 'crm'];
const SUPPORTING = ['hire', 'assist', 'ops'];
const FEATURED_ORDER = ['ins-ai', 'crm', 'hire', 'assist', 'ops'];

const bySlug = (slug: string) => {
  const w = loadWorks().find((x) => x.slug === slug);
  if (!w) throw new Error(`work/${slug}.json が無い`);
  return w;
};

describe('featuredTier — homepage 上の編集上の強弱（#30 HD-G）', () => {
  it('Featured 5 件すべてが featuredTier を持つ', () => {
    const featured = featuredHomepageWorks(loadWorks());
    assert.equal(featured.length, 5);
    for (const w of featured) {
      assert.doesNotThrow(() => workFeaturedTier(w), `work/${w.slug}.json`);
    }
  });

  it('primary は ins-ai / crm の 2 件', () => {
    const primary = featuredHomepageWorks(loadWorks())
      .filter((w) => w.featuredTier === 'primary')
      .map((w) => w.slug);
    assert.deepEqual(primary.slice().sort(), PRIMARY.slice().sort());
    assert.equal(primary.length, 2);
    for (const slug of PRIMARY) assert.equal(isPrimaryFeatured(bySlug(slug)), true);
  });

  it('supporting は hire / assist / ops の 3 件', () => {
    const supporting = featuredHomepageWorks(loadWorks())
      .filter((w) => w.featuredTier === 'supporting')
      .map((w) => w.slug);
    assert.deepEqual(supporting.slice().sort(), SUPPORTING.slice().sort());
    assert.equal(supporting.length, 3);
    for (const slug of SUPPORTING) assert.equal(isPrimaryFeatured(bySlug(slug)), false);
  });

  it('Featured 以外の作品は featuredTier を持たない', () => {
    // 記録として持っていないことまで見る。どこにも描かれない強弱が残っていると、
    // 次に homepage tier を動かす人がそれを既定値として読む。
    for (const w of loadWorks()) {
      if (w.homepage === 'featured') continue;
      assert.equal(w.featuredTier, undefined, `work/${w.slug}.json`);
    }
  });

  it('schema が両方向で拒む — Featured に必須、それ以外には不可', () => {
    const w = clone(sampleWork()) as Record<string, unknown>;
    assert.equal(
      workSchema.safeParse({ ...w, featured: true, homepage: 'featured', featuredTier: undefined })
        .success,
      false,
    );
    assert.equal(
      workSchema.safeParse({ ...w, featured: false, homepage: 'more', featuredTier: 'primary' })
        .success,
      false,
    );
  });

  it('描画されようとした Featured に tier が無ければ黙って落とさず throw する', () => {
    // fallback を置かない理由がこれ。`supporting` を既定にすれば、階層から
    // 抜け落ちた作品が「誰も決めていない方の側」として静かに出てしまう。
    const orphan = { ...clone(sampleWork()), featuredTier: undefined };
    assert.throws(() => workFeaturedTier(orphan), /featuredTier/);
  });

  it('homepage の Featured 表示順が ins-ai → crm → hire → assist → ops', () => {
    assert.deepEqual(
      featuredHomepageWorks(loadWorks()).map((w) => w.slug),
      FEATURED_ORDER,
    );
  });

  it('More / archive の配置は #30 で動かしていない', () => {
    const works = loadWorks();
    assert.deepEqual(
      works.filter((w) => w.homepage === 'more').map((w) => w.slug).sort(),
      ['agri', 'docai', 'minio', 'ppm'],
    );
    assert.equal(bySlug('dfe').homepage, undefined);
  });
});

describe('開発背景 — portfolioProfile enum を読者の語にする', () => {
  const background = (
    developmentContext: string,
    portfolioForm: string,
  ): string =>
    developmentBackground({
      developmentContext,
      portfolioForm,
      implementationStatus: 'implemented',
      releaseStatus: 'unknown',
      responsibilityNotes: [],
      originProject: null,
    } as unknown as PortfolioProfile);

  it('4 つの enum 値の対応表', () => {
    assert.equal(background('personal', 'technical-demo'), '個人開発 / 技術デモ');
    assert.equal(
      background('collaborative', 'public-reconstruction'),
      '共同プロジェクト / 公開用再構成',
    );
    assert.equal(background('personal', 'public-reconstruction'), '個人開発 / 公開用再構成');
    assert.equal(background('collaborative', 'technical-demo'), '共同プロジェクト / 技術デモ');
  });

  it('純粋関数である — 同じ入力に同じ答えを返し、作品レコードを読まない', () => {
    const a = background('personal', 'technical-demo');
    const b = background('personal', 'technical-demo');
    assert.equal(a, b);
  });

  it('日本語は work JSON に二重保存されていない', () => {
    // 表示語が registry にしか無いことを、作品レコード側から確かめる。
    const labels = Object.values(ui.work.profileLabels);
    for (const w of loadWorks()) {
      const json = JSON.stringify(w.portfolioProfile);
      for (const label of labels) {
        assert.equal(json.includes(label), false, `work/${w.slug}.json に ${label} がある`);
      }
    }
  });

  it('未知の enum 値は生のまま出さずに throw する', () => {
    // homepage に `technical-demo` と出るのは内部語の漏れで、
    // `check:structure` の PUBLIC_INTERNAL と同じ規則を関数側から守る。
    assert.throws(() => background('outsourced', 'technical-demo'), /profileLabels/);
    assert.throws(() => background('personal', 'client-work'), /profileLabels/);
  });

  it('Featured 5 件すべてが背景を出せる', () => {
    for (const w of featuredHomepageWorks(loadWorks())) {
      const text = developmentBackground(w.portfolioProfile);
      assert.match(text, / \/ /, `work/${w.slug}.json`);
    }
  });
});

describe('公開 source URL — 1 か所でだけ組み立てる', () => {
  it('crm / ppm / dfe の URL を生成できる', () => {
    assert.equal(
      workPublicSourceUrl(bySlug('crm')),
      'https://github.com/youshi-kanda/portfolio/tree/main/ai-crm-demo',
    );
    assert.equal(
      workPublicSourceUrl(bySlug('ppm')),
      'https://github.com/youshi-kanda/portfolio/tree/main/gas-project-management-demo',
    );
    assert.equal(
      workPublicSourceUrl(bySlug('dfe')),
      'https://github.com/youshi-kanda/portfolio/tree/main/document-field-extraction-demo',
    );
  });

  it('crm の source は linkable である', () => {
    assert.equal(workSourceIsLinkable(bySlug('crm')), true);
    assert.equal(workRepoPath(bySlug('crm')), 'ai-crm-demo/');
  });

  it('hire / minio / docai は public-repo でも URL を作らない（HD-D 未決）', () => {
    for (const slug of ['hire', 'minio', 'docai']) {
      const w = bySlug(slug);
      assert.equal(w.showcase?.source.access, 'public-repo', `${slug}: access`);
      assert.equal(w.showcase?.source.linkPolicy, 'withheld', `${slug}: linkPolicy`);
      assert.equal(workPublicSourceUrl(w), null, `${slug}: URL が出ている`);
    }
  });

  it('private source の作品も URL を作らない', () => {
    for (const slug of ['ins-ai', 'assist', 'ops', 'agri']) {
      assert.equal(workPublicSourceUrl(bySlug(slug)), null, slug);
    }
  });

  it('linkable でない作品は 1 件も URL を持たない — access は見ない', () => {
    // access を直接読む実装ならここで落ちる: hire は public-repo である。
    for (const w of shippingWorks(loadWorks())) {
      assert.equal(
        workPublicSourceUrl(w) === null,
        !workSourceIsLinkable(w),
        `work/${w.slug}.json`,
      );
    }
  });

  it('URL は末尾スラッシュを持たない — repoPath は持っている', () => {
    const url = workPublicSourceUrl(bySlug('crm'));
    assert.ok(url && !url.endsWith('/'));
    assert.equal(workRepoPath(bySlug('crm'))?.endsWith('/'), true);
  });
});

describe('Featured の証拠導線', () => {
  it('crm だけが Case Study と公開コードの両方を出す条件を満たす', () => {
    const crm = bySlug('crm');
    assert.equal(workShowsCaseStudyCta(crm), true);
    assert.notEqual(workPublicSourceUrl(crm), null);
  });

  it('ins-ai / hire / assist / ops は source CTA の条件を満たさない', () => {
    for (const slug of ['ins-ai', 'hire', 'assist', 'ops']) {
      assert.equal(workPublicSourceUrl(bySlug(slug)), null, slug);
    }
  });

  it('Case Study CTA の条件は caseStudyPublished だけ — source を混ぜていない', () => {
    // #8 で確立した唯一の条件。source の有無を足せば、公開コードの無い作品の
    // Case Study 導線が理由なく消える。
    for (const w of loadWorks()) {
      assert.equal(workShowsCaseStudyCta(w), w.caseStudyPublished, `work/${w.slug}.json`);
    }
    const published = loadWorks().filter((w) => w.caseStudyPublished).map((w) => w.slug);
    assert.deepEqual(published.slice().sort(), ['crm', 'dfe', 'ppm']);
    // そのうち 1 件は source が withheld でも Case Study を出す、という形が
    // 成り立っていること自体を見る（両条件が独立であることの確認）。
    assert.equal(workShowsCaseStudyCta(bySlug('dfe')), true);
  });

  it('HD-I 文言は承認済み copy registry から取れる', () => {
    const row = loadCopy().find((c) => c.id === 'home.works.sourceWithheld');
    assert.ok(row, 'copy registry に home.works.sourceWithheld が無い');
    assert.equal(
      row.text,
      '公開範囲を限定しているため、コードリンクは掲載していません。担当範囲と実装内容は、公開可能な情報に限定して記載しています。',
    );
    assert.equal(row.publication.reviewStatus, 'approved');
    assert.equal(row.publication.sourceType, 'authored');
    assert.equal(row.publication.claimType, 'fact');
    assert.equal(row.publication.approvedBy, 'user');
    assert.equal(row.publication.approvedAt, '2026-09-20T01:11:07Z');
    assert.ok(
      row.publication.sourceRefs.some((r) => r.includes('5746615341')),
      'sourceRefs に承認コメントが無い',
    );
  });

  it('primary / supporting の tier は可視の評価ラベルを持たない', () => {
    const uiText = JSON.stringify(ui);
    for (const grade of ['代表作', '二軍', '低優先', 'サブ作品', '準代表']) {
      assert.equal(uiText.includes(grade), false, `${grade} が ui にある`);
    }
  });

  it('#30 で追加した表示ラベルがすべて registry にある', () => {
    for (const label of [
      ui.work.background,
      ui.work.evidenceHead,
      ui.work.sourceCta,
      ui.contact.publicCode,
    ]) {
      assert.ok(label.length > 0);
    }
    assert.equal(ui.work.role, '担当範囲');
    assert.equal(ui.work.selectedTech, '使用技術');
    assert.equal(ui.work.caseStudyCta, 'Case Study を読む');
  });
});

describe('CONTACT の公開コード一覧', () => {
  it('shipping Work の linkable source から導出され、crm / ppm / dfe になる', () => {
    assert.deepEqual(
      linkableSourceWorks(loadWorks()).map((w) => w.slug),
      ['crm', 'ppm', 'dfe'],
    );
  });

  it('作品名は work レコードの title で、固定配列ではない', () => {
    assert.deepEqual(
      linkableSourceWorks(loadWorks()).map((w) => w.title),
      ['AI CRM Demo', 'Project Progress Manager', 'Document Field Extraction Demo'],
    );
  });

  it('hire / minio / docai を一覧へ出さない', () => {
    const listed = new Set(linkableSourceWorks(loadWorks()).map((w) => w.slug));
    for (const slug of ['hire', 'minio', 'docai', 'ins-ai', 'assist', 'ops', 'agri']) {
      assert.equal(listed.has(slug), false, slug);
    }
  });

  it('一覧の全件が URL を持つ — 名前だけの行を作らない', () => {
    for (const w of linkableSourceWorks(loadWorks())) {
      assert.notEqual(workPublicSourceUrl(w), null, w.slug);
    }
  });

  it('linkPolicy を withheld にすれば一覧から消える', () => {
    // 固定配列でないことの実証。`crm` を withheld にした世界で一覧が 2 件に
    // なるなら、判断は source model 側に 1 つだけある。
    const works = loadWorks().map((w) =>
      w.slug === 'crm'
        ? ({
            ...clone(w),
            repoPath: undefined,
            showcase: {
              ...clone(w.showcase!),
              source: { access: 'public-repo', linkPolicy: 'withheld', path: null },
            },
          } as typeof w)
        : w,
    );
    assert.deepEqual(linkableSourceWorks(works).map((x) => x.slug), ['ppm', 'dfe']);
  });
});

describe('source model は #30 で緩めていない', () => {
  it('hire / minio / docai の public-repo + withheld + path null が残っている', () => {
    for (const slug of ['hire', 'minio', 'docai']) {
      const source = bySlug(slug).showcase?.source;
      assert.equal(source?.access, 'public-repo', `${slug}: access`);
      assert.equal(source?.linkPolicy, 'withheld', `${slug}: linkPolicy`);
      assert.equal(source?.path, null, `${slug}: path`);
    }
  });

  it('withheld / private の作品はレコードに公開 path を持たない', () => {
    // path が無いということは、URL の材料がそもそも記録に無いということ。
    // 公開リポジトリに「リンクしない場所」を保存しないのが #7 C-8 の要点。
    for (const w of loadWorks()) {
      if (workSourceIsLinkable(w)) continue;
      assert.equal(w.showcase?.source.path ?? null, null, `work/${w.slug}.json`);
      assert.equal(w.repoPath, undefined, `work/${w.slug}.json`);
    }
  });
});

describe('provenance — #30 の本人決定が根拠として残っている', () => {
  it('Featured 5 件の sourceRefs が HD-G の承認コメントを挙げている', () => {
    for (const w of featuredHomepageWorks(loadWorks())) {
      assert.ok(
        w.publication.sourceRefs.some((r) => r.includes('#30') && r.includes('5746615341')),
        `work/${w.slug}.json の sourceRefs に #30 本人決定が無い`,
      );
    }
  });

  it('#29 の本人確認記録を消していない', () => {
    for (const w of loadWorks()) {
      assert.ok(
        w.publication.sourceRefs.some((r) => r.includes('5742687087')),
        `work/${w.slug}.json の #29 sourceRef が消えている`,
      );
    }
  });

  it('承認されていない approvedBy / approvedAt を Work に書いていない', () => {
    // #30 が承認を取ったのは HD-I の 1 文だけで、作品レコードではない。
    for (const w of featuredHomepageWorks(loadWorks())) {
      assert.equal(w.publication.approvedBy, null, `work/${w.slug}.json`);
      assert.equal(w.publication.approvedAt, null, `work/${w.slug}.json`);
    }
  });
});
