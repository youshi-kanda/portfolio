'use strict';

// Project Progress Manager — synthetic demo data (portfolio only).
//
// Everything below is fictional: the projects, the work items, the decisions and
// the owner labels are invented for this demo. No real customer, engagement, or
// person appears here.
//
// The loader deliberately has NO write path of its own. It builds ordinary
// registration payloads and hands them to V3RegistrationService.register, so the
// demo exercises the same validation → lock → idempotency → transaction →
// activity-log pipeline the Sidebar uses.

var V3DemoData = (function () {

  // ---- Anchor date ------------------------------------------------------
  //
  // Dates are expressed as day offsets from an anchor instead of fixed calendar
  // literals. A hard-coded 2026 calendar would read as "every task overdue, every
  // project Red" to anyone opening the demo a year later, which destroys the
  // Green / Amber / Red contrast the sample data is meant to show.
  //
  // The anchor is minted once per Spreadsheet, on the first populate(), and stored
  // in 90_設定 under DEMO_ANCHOR_DATE. Every later run reads that same value back,
  // so the payload — and therefore its FNV-1a hash — is byte-identical on day 2,
  // day 300 and day 1000. Re-running the menu item stays an idempotent replay:
  // never a duplicate insert, never a payload_mismatch caused by the clock moving.
  //
  // Offsets are computed in UTC. The script timezone can shift the anchor by at
  // most one calendar day, and every offset below keeps a margin wider than that.

  function _isIsoDate(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  }

  // Sheets may hand back a Date object for a cell that looks like a date, so accept
  // either representation and normalize to 'YYYY-MM-DD'.
  function _coerceIso(v) {
    if (_isIsoDate(v)) return v;
    if (v instanceof Date && !isNaN(v.getTime())) {
      return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()))
        .toISOString().slice(0, 10);
    }
    return null;
  }

  function _todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  // anchor + days → 'YYYY-MM-DD'
  function _d(anchorIso, days) {
    var ms = Date.UTC(
      Number(anchorIso.slice(0, 4)),
      Number(anchorIso.slice(5, 7)) - 1,
      Number(anchorIso.slice(8, 10))
    ) + days * V3_CONFIG.MS_PER_DAY;
    return new Date(ms).toISOString().slice(0, 10);
  }

  // Read the Spreadsheet's anchor, minting and persisting it on first use.
  function resolveAnchor(ss) {
    var stored = _coerceIso(V3Schema.getSetting(ss, V3_CONFIG.SETTINGS_KEYS.DEMO_ANCHOR_DATE));
    if (stored) return stored;
    var anchor = _todayIso();
    V3Schema.setSetting(
      ss,
      V3_CONFIG.SETTINGS_KEYS.DEMO_ANCHOR_DATE,
      anchor,
      'デモデータ基準日（初回投入時に自動確定。変更すると再投入が payload_mismatch になります）'
    );
    return anchor;
  }

  // ---- Payload builders -------------------------------------------------
  //
  // The three samples are shaped to land on three different health verdicts at
  // load time, so the Dashboard shows one of each:
  //   1. ECサイトリニューアル → Red   (overdue item + blocked item + overdue decision)
  //   2. 社内申請システム     → Amber (open decision, nothing overdue)
  //   3. 在庫管理改善         → Green (no blocker, no open decision, no overdue item)

  function _ecCommerceRenewal(a) {
    return {
      submissionId: 'demo-0001-ec-renewal',
      project: {
        mode: 'new',
        projectName: 'ECサイトリニューアル',
        shareTitle: 'ECサイトリニューアル',
        purpose: '既存ECサイトを刷新し、スマートフォン経由の購入完了率を改善する。',
        status: '進行中',
        priority: '今すぐ',
        owner: 'プロダクト担当',
        startDate: _d(a, -60),
        dueDate: _d(a, 21),
        nextMilestone: 'API仕様の確定',
      },
      items: [
        { draftKey: 'ec_epic', itemType: 'Epic', title: 'ECサイトリニューアル 全体',
          shareTitle: 'リニューアル全体', description: 'リニューアル案件全体を束ねるEpic。',
          status: '作業中', priority: '今すぐ', assignee: 'プロダクト担当',
          startDate: _d(a, -60), dueDate: _d(a, 21) },

        { draftKey: 'ec_req', parentDraftKey: 'ec_epic', itemType: 'Task', title: '要件整理',
          shareTitle: 'やりたいことの整理',
          description: '現行サイトの課題を洗い出し、リニューアル範囲を決める。',
          deliverable: '要件一覧', acceptanceCriteria: '対象範囲と非対象範囲が明記されていること',
          status: '完了', phase: '調査', priority: '今すぐ', assignee: 'プロダクト担当',
          startDate: _d(a, -60), dueDate: _d(a, -49), estimate: 5 },

        { draftKey: 'ec_db', parentDraftKey: 'ec_epic', itemType: 'Task', title: 'DB設計',
          shareTitle: 'データ構造の設計',
          description: '商品・在庫・注文のテーブル設計とマイグレーション方針を決める。',
          deliverable: 'ER図とマイグレーション計画', acceptanceCriteria: '既存データの移行手順が確定していること',
          status: '完了', phase: '設計', priority: '今すぐ', assignee: '開発チーム',
          startDate: _d(a, -47), dueDate: _d(a, -32), estimate: 8 },

        // Past its dueDate and still 作業中 → DEADLINE_EXCEEDED (Red).
        { draftKey: 'ec_api', parentDraftKey: 'ec_epic', itemType: 'Feature', title: 'API実装',
          shareTitle: 'サーバー側の実装',
          description: '商品検索・カート・注文確定のエンドポイントを実装する。',
          deliverable: 'APIエンドポイント一式', acceptanceCriteria: '結合テストが全て通ること',
          status: '作業中', phase: '実装', priority: '今すぐ', assignee: '開発チーム',
          startDate: _d(a, -30), dueDate: _d(a, -2), estimate: 15,
          nextAction: '注文確定APIのエラー処理を実装する' },

        // Non-empty blocker on an unfinished item → BLOCKED (Red).
        { draftKey: 'ec_ui', parentDraftKey: 'ec_epic', itemType: 'Feature', title: 'UI実装',
          shareTitle: '画面の実装',
          description: '商品一覧・カート・購入完了画面をレスポンシブで実装する。',
          deliverable: '主要3画面', acceptanceCriteria: '主要スマートフォン幅で崩れないこと',
          status: '未着手', phase: '実装', priority: '次に', assignee: 'フロントエンド担当',
          startDate: _d(a, -14), dueDate: _d(a, 14), estimate: 12,
          blocker: 'デザイン確認待ち' },

        { draftKey: 'ec_test', parentDraftKey: 'ec_epic', itemType: 'Task', title: 'テスト',
          shareTitle: '動作確認',
          description: '購入フロー全体の結合テストと負荷テストを実施する。',
          deliverable: 'テスト結果報告', acceptanceCriteria: '重大度Highの不具合が0件であること',
          status: '未着手', phase: 'テスト', priority: '次に', assignee: '品質担当',
          startDate: _d(a, 7), dueDate: _d(a, 17), estimate: 6 },

        { draftKey: 'ec_release', parentDraftKey: 'ec_epic', itemType: 'Task', title: 'リリース準備',
          shareTitle: '公開の準備',
          description: '切り替え手順、ロールバック手順、告知文を用意する。',
          deliverable: 'リリース手順書', acceptanceCriteria: 'ロールバック手順が検証済みであること',
          status: '未着手', phase: 'リリース準備', priority: '後で', assignee: '開発チーム',
          startDate: _d(a, 18), dueDate: _d(a, 21), estimate: 4 },
      ],
      relations: [
        { sourceDraftKey: 'ec_db',      targetDraftKey: 'ec_req',  relationType: 'depends_on' },
        { sourceDraftKey: 'ec_api',     targetDraftKey: 'ec_db',   relationType: 'depends_on' },
        { sourceDraftKey: 'ec_ui',      targetDraftKey: 'ec_api',  relationType: 'depends_on' },
        { sourceDraftKey: 'ec_test',    targetDraftKey: 'ec_ui',   relationType: 'depends_on' },
        { sourceDraftKey: 'ec_release', targetDraftKey: 'ec_test', relationType: 'depends_on' },
      ],
      decisions: [
        // Unanswered past DECISION_OVERDUE_DAYS → DECISION_OVERDUE (Red).
        { title: 'API仕様確定', type: '判断待ち', status: '確認中',
          detail: '注文確定APIのレスポンス項目を確定したい。UI実装の着手条件。',
          itemDraftKey: 'ec_api', owner: 'プロダクト担当', dueDate: _d(a, -7) },
        { title: 'デザイン確認', type: 'ブロッカー', status: '未確認',
          detail: '商品一覧のカードデザイン2案のどちらを採用するか。',
          itemDraftKey: 'ec_ui', owner: 'デザイン担当', dueDate: _d(a, 2) },
        { title: 'リリース日判断', type: '判断待ち', status: '未確認',
          detail: '今月末リリースか翌月頭リリースかを決める。',
          itemDraftKey: 'ec_release', owner: 'プロダクト担当', dueDate: _d(a, 10) },
      ],
    };
  }

  function _internalRequestSystem(a) {
    return {
      submissionId: 'demo-0002-internal-request',
      project: {
        mode: 'new',
        projectName: '社内申請システム',
        shareTitle: '社内申請のオンライン化',
        purpose: '紙とメールで回している申請を1つの画面に集約し、承認待ち状況を可視化する。',
        status: '計画中',
        priority: '次に',
        owner: '業務改善担当',
        startDate: _d(a, -14),
        dueDate: _d(a, 95),
        nextMilestone: '申請フォームの項目確定',
      },
      items: [
        { draftKey: 'req_survey', itemType: 'Task', title: '要件整理',
          shareTitle: '現状の申請フローの整理',
          description: '現行の申請種別と承認経路を棚卸しする。',
          deliverable: '申請種別一覧', status: '作業中', phase: '調査', priority: '次に',
          assignee: '業務改善担当', startDate: _d(a, -14), dueDate: _d(a, 10), estimate: 4 },

        { draftKey: 'req_design', itemType: 'Task', title: 'DB設計',
          shareTitle: 'データ構造の設計',
          description: '申請・承認履歴・添付のデータ構造を設計する。',
          deliverable: 'ER図', status: '未着手', phase: '設計', priority: '次に',
          assignee: '開発チーム', startDate: _d(a, 11), dueDate: _d(a, 30), estimate: 5 },

        { draftKey: 'req_ui', itemType: 'Feature', title: 'UI実装',
          shareTitle: '申請画面の実装',
          description: '申請フォームと承認一覧を実装する。',
          deliverable: '申請/承認画面', status: '未着手', phase: '実装', priority: '後で',
          assignee: 'フロントエンド担当', startDate: _d(a, 31), dueDate: _d(a, 70), estimate: 10 },

        { draftKey: 'req_release', itemType: 'Task', title: 'リリース準備',
          shareTitle: '社内展開の準備',
          description: '利用ガイドを作成し、部門ごとの切り替え日を決める。',
          deliverable: '利用ガイド', status: '未着手', phase: 'リリース準備', priority: '後で',
          assignee: '業務改善担当', startDate: _d(a, 71), dueDate: _d(a, 95), estimate: 3 },
      ],
      relations: [
        { sourceDraftKey: 'req_design',  targetDraftKey: 'req_survey', relationType: 'depends_on' },
        { sourceDraftKey: 'req_ui',      targetDraftKey: 'req_design', relationType: 'depends_on' },
        { sourceDraftKey: 'req_release', targetDraftKey: 'req_ui',     relationType: 'depends_on' },
      ],
      decisions: [
        // Open but not yet overdue → PENDING_DECISION (Amber), no Red condition.
        { title: 'デザイン確認', type: '判断待ち', status: '未確認',
          detail: '申請フォームを1画面にするか、ステップ分割にするか。',
          itemDraftKey: 'req_ui', owner: 'デザイン担当', dueDate: _d(a, 21) },
      ],
    };
  }

  function _inventoryImprovement(a) {
    return {
      submissionId: 'demo-0003-inventory',
      project: {
        mode: 'new',
        projectName: '在庫管理改善',
        shareTitle: '在庫の見える化',
        purpose: '欠品と過剰在庫を減らすため、在庫の実数と発注点を日次で把握できるようにする。',
        status: '進行中',
        priority: '次に',
        owner: '物流担当',
        startDate: _d(a, -21),
        dueDate: _d(a, 60),
        nextMilestone: '発注点ロジックの合意',
      },
      items: [
        { draftKey: 'inv_req', itemType: 'Task', title: '要件整理',
          shareTitle: '困りごとの整理',
          description: '欠品が起きている品目と、その原因を洗い出す。',
          deliverable: '課題一覧', status: '完了', phase: '調査', priority: '今すぐ',
          assignee: '物流担当', startDate: _d(a, -21), dueDate: _d(a, -10), estimate: 3 },

        { draftKey: 'inv_api', itemType: 'Feature', title: 'API実装',
          shareTitle: '在庫データの取り込み',
          description: '倉庫システムの在庫データを日次で取り込む処理を実装する。',
          deliverable: '取り込みバッチ', acceptanceCriteria: '取り込み失敗時に再実行できること',
          status: '作業中', phase: '実装', priority: '今すぐ', assignee: '開発チーム',
          startDate: _d(a, -9), dueDate: _d(a, 35), estimate: 9,
          nextAction: '取り込み失敗時のリトライ設計をまとめる' },

        { draftKey: 'inv_test', itemType: 'Task', title: 'テスト',
          shareTitle: '数値の突き合わせ',
          description: '取り込んだ在庫数と実棚卸の数値を突き合わせる。',
          deliverable: '突き合わせ結果', status: '未着手', phase: 'テスト', priority: '次に',
          assignee: '品質担当', startDate: _d(a, 36), dueDate: _d(a, 60), estimate: 5 },
      ],
      relations: [
        { sourceDraftKey: 'inv_api',  targetDraftKey: 'inv_req', relationType: 'depends_on' },
        { sourceDraftKey: 'inv_test', targetDraftKey: 'inv_api', relationType: 'depends_on' },
      ],
      decisions: [
        // Already answered → excluded from the pending set, so this project stays Green.
        { title: 'API仕様確定', type: '判断待ち', status: '回答済み',
          detail: '倉庫システムから受け取る項目に発注点を含めるかどうか。',
          resolution: '発注点は含めず、取り込み後にこちら側で算出する。',
          itemDraftKey: 'inv_api', owner: '物流担当', dueDate: _d(a, -5) },
      ],
    };
  }

  function payloads(anchorIso) {
    var a = _coerceIso(anchorIso) || _todayIso();
    return [_ecCommerceRenewal(a), _internalRequestSystem(a), _inventoryImprovement(a)];
  }

  // ---- Loader -----------------------------------------------------------

  function populate(ss, lockService) {
    // Demo data is layered on top of a completed setup; it never creates sheets.
    if (!ss.getSheetByName(V3_CONFIG.SHEET_NAMES.PROJECTS)) {
      return V3SafeError.make('setup_required', '先に初期セットアップを実行してください');
    }

    var anchor = resolveAnchor(ss);
    var list = payloads(anchor);
    var out = {
      ok: true, code: null,
      anchorDate: anchor,
      projectIds: [], itemIds: [], decisionIds: [], relationIds: [],
      idempotentCount: 0,
    };

    for (var i = 0; i < list.length; i++) {
      var res = V3RegistrationService.register(ss, lockService, list[i]);
      if (!res || !res.ok) {
        // Each submission is its own transaction; a failure leaves no partial rows
        // behind for that submission. Report the first failure and stop.
        return V3SafeError.make(
          (res && res.code) || 'registration_error',
          'デモデータ投入に失敗しました (' + list[i].submissionId + ')'
        );
      }
      out.projectIds.push(res.projectId);
      out.itemIds = out.itemIds.concat(res.itemIds || []);
      out.decisionIds = out.decisionIds.concat(res.decisionIds || []);
      out.relationIds = out.relationIds.concat(res.relationIds || []);
      if (res.idempotent) out.idempotentCount++;
    }

    var rebuilt = V3SyncController.rebuildDashboard(ss, lockService);
    out.dashboardOk = !!(rebuilt && rebuilt.ok);
    return out;
  }

  return {
    resolveAnchor: resolveAnchor,
    payloads: payloads,
    populate: populate,
  };
}());
