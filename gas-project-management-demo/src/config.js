'use strict';

// Project Progress Manager — Phase 1A (multi-project task management MVP) configuration.
// See docs/architecture.md for the runtime contract.
//
// Phase 1A scope: Create (Project / Work Item / Decision), initial parent/dependency,
// direct edit of allowlisted daily columns, Dashboard, Activity, idempotent setup.
// Structural editing / lifecycle / dependency management are deferred to Phase 1B.

var V3_CONFIG = (function () {
  var SCHEMA_VERSION = 'v3.0.0';

  var SHEET_NAMES = {
    DASHBOARD:  '00_共有ダッシュボード',
    PROJECTS:   '01_プロジェクト',
    ITEMS:      '02_タスク',
    BOARD:      '03_ボード',
    ROADMAP:    '04_ロードマップ',
    DECISIONS:  '05_判断待ち・ブロッカー',
    AI_PROPOSAL:'06_AI提案',
    ACTIVITY:   '07_活動履歴',
    SETTINGS:   '90_設定',
    RELATIONS:  '91_関係',
    REGISTRATION: '92_登録履歴',
    COUNTERS:   '93_採番カウンタ',
  };

  var DISPLAY_SHEETS = [
    SHEET_NAMES.DASHBOARD, SHEET_NAMES.PROJECTS, SHEET_NAMES.ITEMS,
    SHEET_NAMES.BOARD, SHEET_NAMES.ROADMAP, SHEET_NAMES.DECISIONS,
    SHEET_NAMES.AI_PROPOSAL, SHEET_NAMES.ACTIVITY,
  ];

  // Phase 1A stubs: created empty with a single guidance row so users don't mistake them
  // for usable features. No CRUD, no sidebar, no fake data behind them.
  var STUB_SHEETS = {
    '03_ボード':    'Phase 2 で実装予定です。',
    '04_ロードマップ': 'Phase 2 で実装予定です。',
    '06_AI提案':    'Phase 4 で実装予定です。',
  };

  var ADMIN_SHEETS = [
    SHEET_NAMES.SETTINGS, SHEET_NAMES.RELATIONS,
    SHEET_NAMES.REGISTRATION, SHEET_NAMES.COUNTERS,
  ];

  // Headers are the source of truth for column layout. Code MUST resolve columns by
  // header name (V3Schema.resolveColumnIndex), never by fixed index — later phases add
  // columns and cannot be allowed to shift references.

  var PROJECT_HEADERS = [
    'projectId', 'projectName', 'shareTitle', 'purpose', 'status', 'priority', 'owner',
    'startDate', 'dueDate', 'health', 'nextMilestone', 'active',
    'createdAt', 'updatedAt', 'revision',
  ];

  var ITEM_HEADERS = [
    'itemId', 'projectId', 'parentItemId', 'itemType',
    'title', 'shareTitle', 'description', 'deliverable', 'acceptanceCriteria',
    'status', 'phase', 'priority', 'assignee', 'startDate', 'dueDate', 'estimate',
    'blocker', 'nextAction', 'active',
    'createdAt', 'updatedAt', 'revision',
  ];

  var DECISION_HEADERS = [
    'decisionId', 'projectId', 'itemId', 'type', 'title', 'detail',
    'owner', 'dueDate', 'status', 'resolution', 'createdAt', 'resolvedAt',
  ];

  var RELATION_HEADERS = [
    'relationId', 'projectId', 'sourceItemId', 'targetItemId', 'relationType',
    'active', 'createdAt', 'updatedAt',
  ];

  var ACTIVITY_HEADERS = [
    'activityId', 'projectId', 'entityType', 'entityId', 'action', 'field',
    'beforeValue', 'afterValue', 'actor', 'reason', 'timestamp', 'correlationId',
  ];

  var SETTINGS_HEADERS = ['key', 'value', 'description'];
  var COUNTERS_HEADERS = ['key', 'value', 'description'];

  var REGISTRATION_HEADERS = [
    'submissionId', 'payloadHash', 'state', 'projectId', 'projectRow',
    'itemIds', 'itemStartRow', 'itemCount',
    'relationIds', 'decisionIds',
    'createdAt', 'updatedAt', 'safeErrorCode',
  ];

  // Direct-edit allowlists per sheet. onEdit accepts these columns as a formal
  // update ONLY on rows that are already official (ID + createdAt both populated)
  // AND ONLY for single-cell edits. All other columns are structural or auto and
  // are protected via sheet range protection so normal users cannot edit them.
  var PROJECT_DIRECT_EDIT_COLS = [
    'status', 'priority', 'owner', 'startDate', 'dueDate', 'nextMilestone',
  ];
  var ITEM_DIRECT_EDIT_COLS = [
    'status', 'priority', 'assignee', 'startDate', 'dueDate', 'blocker', 'nextAction',
  ];
  var DECISION_DIRECT_EDIT_COLS = [
    'status', 'resolution', 'owner', 'dueDate',
  ];

  // Enums.
  var PROJECT_STATUS_VALUES = ['計画中', '進行中', '保留', '完了', '中止'];
  var ITEM_STATUS_VALUES    = ['未着手', '作業中', '確認待ち', '完了', '対象外'];
  var ITEM_TYPE_VALUES      = ['Epic', 'Feature', 'Task', 'Subtask', 'Bug', 'Improvement'];
  var ITEM_PHASE_VALUES     = ['調査', '設計', '実装', 'テスト', 'リリース準備'];
  var PRIORITY_VALUES       = ['今すぐ', '次に', '後で'];
  var DECISION_STATUS_VALUES = ['未確認', '確認中', '回答済み', '不要', '期限超過'];
  var DECISION_TYPE_VALUES   = ['判断待ち', 'ブロッカー', '質問'];
  var RELATION_TYPE_VALUES   = ['depends_on', 'blocks'];
  var ACTIVE_VALUES          = ['TRUE', 'FALSE'];

  // Item type ID prefix (single letter, kept short to bound ID length).
  var ITEM_TYPE_ID_PREFIX = {
    Epic:        'E',
    Feature:     'F',
    Task:        'T',
    Subtask:     'S',
    Bug:         'B',
    Improvement: 'I',
  };

  // Counter keys stored in 93_採番カウンタ.
  var COUNTER_KEYS = {
    LAST_PROJECT_ID: 'LAST_PROJECT_ID',
    ITEM_LAST_PREFIX: 'ITEM_LAST_',       // ITEM_LAST_<projectId>_<TYPE>
    DECISION_LAST_PREFIX: 'DECISION_LAST_', // DECISION_LAST_<projectId>
    RELATION_LAST: 'RELATION_LAST',
    ACTIVITY_LAST: 'ACTIVITY_LAST',       // Workspace-wide Activity ID counter
  };

  // Settings keys stored in 90_設定.
  var SETTINGS_KEYS = {
    SCHEMA_VERSION: 'SCHEMA_VERSION',
    STALE_DAYS: 'STALE_DAYS',
    DEADLINE_WARNING_DAYS: 'DEADLINE_WARNING_DAYS',
    DECISION_OVERDUE_DAYS: 'DECISION_OVERDUE_DAYS',
    TIMEZONE: 'TIMEZONE',
    ACTIVITY_RETENTION_DAYS: 'ACTIVITY_RETENTION_DAYS',
    LAST_SETUP_AT: 'LAST_SETUP_AT',
    LAST_DASHBOARD_REBUILD_AT: 'LAST_DASHBOARD_REBUILD_AT',
    DEMO_ANCHOR_DATE: 'DEMO_ANCHOR_DATE',
  };

  var HEALTH_DEFAULTS = {
    STALE_DAYS: 5,
    DEADLINE_WARNING_DAYS: 3,
    DECISION_OVERDUE_DAYS: 3,
  };

  var SETTINGS_DEFAULTS = [
    ['SCHEMA_VERSION',           SCHEMA_VERSION,                  'v3 schema version'],
    ['STALE_DAYS',               HEALTH_DEFAULTS.STALE_DAYS,      '更新停滞判定日数'],
    ['DEADLINE_WARNING_DAYS',    HEALTH_DEFAULTS.DEADLINE_WARNING_DAYS, '期限接近警告日数'],
    ['DECISION_OVERDUE_DAYS',    HEALTH_DEFAULTS.DECISION_OVERDUE_DAYS, '判断待ち超過日数'],
    ['TIMEZONE',                 'Asia/Tokyo',                    '既定タイムゾーン'],
    ['ACTIVITY_RETENTION_DAYS',  90,                              '活動履歴の推奨保持日数'],
    ['LAST_SETUP_AT',            '',                              '最終セットアップ日時'],
    ['LAST_DASHBOARD_REBUILD_AT','',                              '最終Dashboard更新日時'],
    ['DEMO_ANCHOR_DATE',         '',                              'デモデータ基準日（初回投入時に自動確定）'],
  ];

  var COUNTERS_DEFAULTS = [
    ['LAST_PROJECT_ID', 0, 'Project ID 発番カウンタ'],
    ['RELATION_LAST',   0, 'Relation ID 発番カウンタ'],
    ['ACTIVITY_LAST',   0, 'Activity ID 発番カウンタ (Workspace 一意)'],
  ];

  // Script Properties. This demo stores no credentials of any kind: TIMEZONE is the
  // only key, and no external API keys or tokens are declared or read anywhere.
  var PROP_KEYS = {
    TIMEZONE: 'PPM_V3_TIMEZONE',
  };

  var SAFE_ERROR_CODES = [
    'concurrent_sync',       // Lock contention
    'setup_required',        // Sheet missing or setup not run
    'validation_error',      // Payload validation failure
    'registration_error',    // Registration transaction failure
    'id_assign_error',       // ID counter update failure
    'duplicate_submission',  // Same submissionId already processed
    'payload_mismatch',      // Same submissionId, different payload
    'idempotent_skip',       // Idempotent replay (informational)
    'dashboard_error',       // Dashboard rebuild failure
    'activity_error',        // Activity append failure
    'unknown_error',
  ];

  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var LOCK_TIMEOUT_MS = 200;

  var UI_STYLE = {
    HEADER_BG: '#1a1a2e',
    HEADER_FG: '#ffffff',
    INPUT_BG:  '#ffffff',
    AUTO_BG:   '#f0f0f5',
    STUB_BG:   '#fff3cd',
    STUB_FG:   '#856404',
    GREEN_BG: '#b7e1cd', GREEN_FG: '#0d652d',
    AMBER_BG: '#fce8b2', AMBER_FG: '#7a4a00',
    RED_BG:   '#f4c7c3', RED_FG:   '#8b1a0e',
    DATA_ROWS: 1000,
  };

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    SHEET_NAMES: SHEET_NAMES,
    DISPLAY_SHEETS: DISPLAY_SHEETS,
    STUB_SHEETS: STUB_SHEETS,
    ADMIN_SHEETS: ADMIN_SHEETS,
    ALL_SHEETS: DISPLAY_SHEETS.concat(ADMIN_SHEETS),

    PROJECT_HEADERS: PROJECT_HEADERS,
    ITEM_HEADERS: ITEM_HEADERS,
    DECISION_HEADERS: DECISION_HEADERS,
    RELATION_HEADERS: RELATION_HEADERS,
    ACTIVITY_HEADERS: ACTIVITY_HEADERS,
    SETTINGS_HEADERS: SETTINGS_HEADERS,
    COUNTERS_HEADERS: COUNTERS_HEADERS,
    REGISTRATION_HEADERS: REGISTRATION_HEADERS,

    PROJECT_DIRECT_EDIT_COLS: PROJECT_DIRECT_EDIT_COLS,
    ITEM_DIRECT_EDIT_COLS: ITEM_DIRECT_EDIT_COLS,
    DECISION_DIRECT_EDIT_COLS: DECISION_DIRECT_EDIT_COLS,

    PROJECT_STATUS_VALUES: PROJECT_STATUS_VALUES,
    ITEM_STATUS_VALUES: ITEM_STATUS_VALUES,
    ITEM_TYPE_VALUES: ITEM_TYPE_VALUES,
    ITEM_PHASE_VALUES: ITEM_PHASE_VALUES,
    PRIORITY_VALUES: PRIORITY_VALUES,
    DECISION_STATUS_VALUES: DECISION_STATUS_VALUES,
    DECISION_TYPE_VALUES: DECISION_TYPE_VALUES,
    RELATION_TYPE_VALUES: RELATION_TYPE_VALUES,
    ACTIVE_VALUES: ACTIVE_VALUES,

    ITEM_TYPE_ID_PREFIX: ITEM_TYPE_ID_PREFIX,
    COUNTER_KEYS: COUNTER_KEYS,
    SETTINGS_KEYS: SETTINGS_KEYS,
    HEALTH_DEFAULTS: HEALTH_DEFAULTS,
    SETTINGS_DEFAULTS: SETTINGS_DEFAULTS,
    COUNTERS_DEFAULTS: COUNTERS_DEFAULTS,

    PROP_KEYS: PROP_KEYS,

    SAFE_ERROR_CODES: SAFE_ERROR_CODES,
    MS_PER_DAY: MS_PER_DAY,
    LOCK_TIMEOUT_MS: LOCK_TIMEOUT_MS,
    UI_STYLE: UI_STYLE,
  };
}());
