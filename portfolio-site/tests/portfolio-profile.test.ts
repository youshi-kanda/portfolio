/**
 * `portfolioProfile` — #29 Phase 9-1。
 *
 * この記録が答えるのは「その作品がどういう成り立ちで、Portfolio 上どういう形で
 * 出ていて、どこまで到達していて、リリースについて何を主張してよいか」。
 * すべて本人確認済みの事実で、推測で埋めてよい欄は 1 つも無い。
 *
 * ここでテストするのは SHAPE と、本人確認済みの値が入れ替わっていないこと。
 * 「その主張を出荷してよいか」は Truth Gate の担当で、別のファイルで見ている。
 *
 * enum の否定側を 1 つずつ確かめているのは、enum が広がったことに気づかない
 * ための保険。`releaseStatus` に 5 つ目が足された日、その値が何を意味するかを
 * 決めたのが人かどうかを、このテストが聞く。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadWorks } from '../src/lib/content/load.ts';
import { shippingWorks } from '../src/lib/content/derive.ts';
import { workSourceIsLinkable } from '../src/lib/content/compat.ts';
import { portfolioProfileSchema, workSchema } from '../src/lib/content/schema.ts';
import { clone, sampleWork } from './helpers.ts';

/** #29 本人確認記録（2026-09-19）で確定した 10 件。値はコメント本文そのまま。 */
const CONFIRMED = {
  'ins-ai': ['collaborative', 'public-reconstruction', 'public-demo', 'unknown'],
  hire: ['collaborative', 'public-reconstruction', 'implemented', 'unknown'],
  assist: ['collaborative', 'public-reconstruction', 'implemented', 'unknown'],
  ops: ['personal', 'public-reconstruction', 'poc', 'not-released'],
  crm: ['personal', 'technical-demo', 'public-demo', 'not-claimed'],
  ppm: ['personal', 'technical-demo', 'implemented', 'not-claimed'],
  minio: ['collaborative', 'public-reconstruction', 'implemented', 'project-use'],
  docai: ['collaborative', 'public-reconstruction', 'implemented', 'unknown'],
  agri: ['collaborative', 'public-reconstruction', 'poc', 'not-released'],
  dfe: ['personal', 'public-reconstruction', 'public-demo', 'not-claimed'],
} as const;

const bySlug = (slug: string) => {
  const w = loadWorks().find((x) => x.slug === slug);
  if (!w) throw new Error(`work/${slug}.json が無い`);
  return w;
};

/** 1 フィールドだけ壊した profile を持つ work。schema が拒むことの確認に使う。 */
const workWithProfile = (over: Record<string, unknown>) => {
  const w = clone(sampleWork()) as Record<string, unknown>;
  w['portfolioProfile'] = { ...(w['portfolioProfile'] as Record<string, unknown>), ...over };
  return workSchema.safeParse(w);
};

describe('portfolioProfile — 全 Work の同一基準メタデータ', () => {
  it('出荷している全作品が portfolioProfile を持つ', () => {
    const shipping = shippingWorks(loadWorks());
    assert.equal(shipping.length, 10);
    for (const w of shipping) {
      assert.doesNotThrow(
        () => portfolioProfileSchema.parse(w.portfolioProfile),
        `work/${w.slug}.json`,
      );
    }
  });

  it('10 件の本人確認済みの分類がそのまま入っている', () => {
    for (const [slug, [developmentContext, portfolioForm, implementationStatus, releaseStatus]] of
      Object.entries(CONFIRMED)) {
      const p = bySlug(slug).portfolioProfile;
      assert.deepEqual(
        [p.developmentContext, p.portfolioForm, p.implementationStatus, p.releaseStatus],
        [developmentContext, portfolioForm, implementationStatus, releaseStatus],
        `work/${slug}.json の portfolioProfile が本人確認記録と食い違っている`,
      );
    }
  });

  it('portfolioProfile が欠けた work を拒む — 全 Work 必須', () => {
    const w = clone(sampleWork()) as Record<string, unknown>;
    delete w['portfolioProfile'];
    assert.equal(workSchema.safeParse(w).success, false);
  });

  it('responsibilityNotes と originProject を省略した work を拒む', () => {
    // どちらも「無い」と言い切る記録なので、default で静かに埋めない。
    for (const key of ['responsibilityNotes', 'originProject']) {
      const w = clone(sampleWork()) as Record<string, unknown>;
      const p = { ...(w['portfolioProfile'] as Record<string, unknown>) };
      delete p[key];
      w['portfolioProfile'] = p;
      assert.equal(workSchema.safeParse(w).success, false, `${key} の省略が通ってしまう`);
    }
  });

  it('developmentContext の enum 外値を拒む', () => {
    assert.equal(workWithProfile({ developmentContext: 'client-work' }).success, false);
    assert.equal(workWithProfile({ developmentContext: 'personal' }).success, true);
  });

  it('portfolioForm の enum 外値を拒む', () => {
    assert.equal(workWithProfile({ portfolioForm: 'production' }).success, false);
    assert.equal(workWithProfile({ portfolioForm: 'technical-demo' }).success, true);
  });

  it('implementationStatus の enum 外値を拒む', () => {
    assert.equal(workWithProfile({ implementationStatus: 'shipped' }).success, false);
    assert.equal(workWithProfile({ implementationStatus: 'poc' }).success, true);
  });

  it('releaseStatus の enum 外値を拒む', () => {
    assert.equal(workWithProfile({ releaseStatus: 'released' }).success, false);
    for (const v of ['unknown', 'not-released', 'project-use', 'not-claimed']) {
      assert.equal(workWithProfile({ releaseStatus: v }).success, true, v);
    }
  });

  it('releaseStatus = unknown を「リリースなし」と読み替えない', () => {
    // 「確認していない」と「無いと確認した」は別の事実。同じ値に畳んだ日に
    // どちらかが嘘になるので、両方が実データに存在していることを見ておく。
    const statuses = loadWorks().map((w) => w.portfolioProfile.releaseStatus);
    assert.ok(statuses.includes('unknown'));
    assert.ok(statuses.includes('not-released'));
  });
});

describe('dfe — 元となる開発との関係', () => {
  const origin = () => {
    const o = bySlug('dfe').portfolioProfile.originProject;
    assert.notEqual(o, null, 'dfe に originProject が無い');
    return o!;
  };

  it('label が 歯科医院向け業務効率化プラットフォーム である', () => {
    assert.equal(origin().label, '歯科医院向け業務効率化プラットフォーム');
  });

  it('context = internal-project / status = in-development', () => {
    assert.equal(origin().context, 'internal-project');
    assert.equal(origin().status, 'in-development');
  });

  it('responsibilityScope に 要件定義から実装まで がある', () => {
    assert.ok(origin().responsibilityScope.includes('要件定義から実装まで'));
  });

  it('公開タイトルは #29 では変えない', () => {
    // 本体を主作品として見せる表示変更は #30 / #33 の担当。#29 は関係を
    // データとして定義するところまで。
    assert.equal(bySlug('dfe').title, 'Document Field Extraction Demo');
  });

  it('originProject を持つのは dfe だけ', () => {
    const withOrigin = loadWorks()
      .filter((w) => w.portfolioProfile.originProject !== null)
      .map((w) => w.slug);
    assert.deepEqual(withOrigin, ['dfe']);
  });

  it('originProject の enum 外値と空の responsibilityScope を拒む', () => {
    const base = origin();
    assert.equal(workWithProfile({ originProject: { ...base, context: 'client' } }).success, false);
    assert.equal(workWithProfile({ originProject: { ...base, status: 'released' } }).success, false);
    assert.equal(
      workWithProfile({ originProject: { ...base, responsibilityScope: [] } }).success,
      false,
    );
    assert.equal(workWithProfile({ originProject: base }).success, true);
  });
});

describe('role — 技術担当領域は別軸として維持される', () => {
  it('hire.role に External API Integration がある', () => {
    assert.ok(bySlug('hire').role.includes('External API Integration'));
  });

  it('hire の既存 role と selectedTech を落としていない', () => {
    const hire = bySlug('hire');
    for (const r of ['Frontend', 'Backend', 'Database', 'Auth', 'Infrastructure']) {
      assert.ok(hire.role.includes(r), `role から ${r} が消えている`);
    }
    for (const t of ['Twilio', 'Google Calendar API']) {
      assert.ok(hire.selectedTech.includes(t), `selectedTech から ${t} が消えている`);
    }
  });

  it('role を持つ作品は portfolioProfile があっても role を失っていない', () => {
    // 2 つの軸を 1 つに畳む変更が入ったら、ここが先に落ちる。
    for (const w of shippingWorks(loadWorks())) {
      assert.ok(w.role.length > 0, `work/${w.slug}.json の role が空`);
    }
  });
});

describe('source model — HD-D 未決のあいだ withheld を維持する', () => {
  it('hire / minio / docai の linkPolicy = withheld が維持されている', () => {
    for (const slug of ['hire', 'minio', 'docai']) {
      const source = bySlug(slug).showcase?.source;
      assert.equal(source?.access, 'public-repo', `${slug}: access`);
      assert.equal(source?.linkPolicy, 'withheld', `${slug}: linkPolicy`);
      assert.equal(source?.path, null, `${slug}: path`);
      assert.equal(workSourceIsLinkable(bySlug(slug)), false, `${slug}: リンクが出ている`);
    }
  });

  it('public-repo + withheld は schema 上ひきつづき合法', () => {
    // #29 はこの組み合わせを緩和も変更もしていない。access は repository の
    // 状態、linkPolicy は Portfolio がリンクを出すかどうかで、別の質問。
    const w = clone(bySlug('hire')) as Record<string, unknown>;
    assert.equal(workSchema.safeParse(w).success, true);
  });
});

describe('provenance — 本人確認記録が根拠として残っている', () => {
  it('全 Work の sourceRefs が #29 の本人確認記録を挙げている', () => {
    for (const w of loadWorks()) {
      const refs = w.publication.sourceRefs;
      assert.ok(
        refs.some((r) => r.includes('#29') && r.includes('5742687087')),
        `work/${w.slug}.json の sourceRefs に #29 本人確認記録が無い`,
      );
    }
  });

  it('既存の sourceRefs と sourceType を落としていない', () => {
    for (const w of loadWorks()) {
      assert.equal(w.publication.sourceType, 'source-derived', `work/${w.slug}.json の sourceType`);
      // #29 で足したのは 1 本。それ以外の根拠が残っていること。
      const others = w.publication.sourceRefs.filter((r) => !r.includes('5742687087'));
      assert.ok(others.length > 0, `work/${w.slug}.json の既存 sourceRefs が消えている`);
    }
  });

  it('承認日時を作っていない', () => {
    // approvedBy / approvedAt は人が承認した記録。#29 で埋める根拠は無い。
    for (const w of loadWorks()) {
      assert.equal(w.publication.approvedBy, null, `work/${w.slug}.json の approvedBy`);
      assert.equal(w.publication.approvedAt, null, `work/${w.slug}.json の approvedAt`);
    }
  });
});
