'use strict';

// Project Progress Manager — Phase 1A test harness.
// - Runs on plain Node (no Apps Script runtime, no network, no Spreadsheet):
//   the Fake Google Apps Script classes below mirror only the surfaces we call.
// - Focus is accident prevention: ID collisions, cycles, rollback, idempotency,
//   Lock contention, Formula injection, setup idempotence, activity, dashboard,
//   Safe Error, phantom Project isolation, Relation raw-ID validation, direct-edit
//   contract for the allowlist, and boundary handling for multi-cell paste.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

// Load order matters: config → safe-error → schema (needs config+safe-error) → id-service (needs config+schema)
// → engine → registration (needs schema+id+safe-error) → sync (needs schema+engine+id)
// → demo-data (needs registration+sync) → main (needs all).
const sourceFiles = [
  'config.js',
  'safe-error.js',
  'schema.js',
  'id-service.js',
  'engine.js',
  'registration-service.js',
  'sync-controller.js',
  'demo-data.js',
  'main.js',
];

// ---- Fake Google Apps Script classes ----

class FakeProtection {
  constructor() { this._description = ''; this._warningOnly = false; }
  setDescription(d) { this._description = d; return this; }
  setWarningOnly(v) { this._warningOnly = v; return this; }
  getDescription() { return this._description; }
  isWarningOnly() { return this._warningOnly; }
  remove() {}
}

class FakeDataValidationBuilder {
  constructor() { this._values = null; this._allowInvalid = true; }
  requireValueInList(values) { this._values = values; return this; }
  setAllowInvalid(v) { this._allowInvalid = v; return this; }
  build() { return { type: 'LIST', values: this._values, allowInvalid: this._allowInvalid }; }
}

class FakeConditionalFormatRuleBuilder {
  constructor() { this._condition = null; this._bg = null; this._fg = null; this._ranges = []; }
  whenTextEqualTo(v) { this._condition = { type: 'text_eq', value: v }; return this; }
  setBackground(c) { this._bg = c; return this; }
  setFontColor(c) { this._fg = c; return this; }
  setRanges(ranges) { this._ranges = ranges; return this; }
  build() { return { condition: this._condition, background: this._bg, fontColor: this._fg, ranges: this._ranges }; }
}

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet; this.row = row; this.col = col;
    this.numRows = numRows; this.numCols = numCols;
  }
  getRow() { return this.row; }
  getColumn() { return this.col; }
  getNumRows() { return this.numRows; }
  getNumColumns() { return this.numCols; }
  getSheet() { return this.sheet; }
  getValue() { return this.sheet.getCell(this.row, this.col); }
  setValue(v) { this.sheet.setCell(this.row, this.col, v); return this; }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const rowArr = [];
      for (let c = 0; c < this.numCols; c++) {
        rowArr.push(this.sheet.getCell(this.row + r, this.col + c));
      }
      out.push(rowArr);
    }
    return out;
  }
  setValues(vals) {
    if (this.sheet.failOnce) {
      const msg = this.sheet.failMsg || 'forced failure';
      this.sheet.failOnce = false;
      this.sheet.failMsg = null;
      throw new Error(msg);
    }
    for (let r = 0; r < vals.length; r++) {
      for (let c = 0; c < vals[r].length; c++) {
        this.sheet.setCell(this.row + r, this.col + c, vals[r][c]);
      }
    }
    return this;
  }
  clearContent() {
    for (let r = 0; r < this.numRows; r++) {
      for (let c = 0; c < this.numCols; c++) {
        this.sheet.setCell(this.row + r, this.col + c, '');
      }
    }
    return this;
  }
  setBackground() { return this; }
  setFontWeight() { return this; }
  setFontColor() { return this; }
  setFontSize() { return this; }
  setWrap() { return this; }
  setHorizontalAlignment() { return this; }
  setVerticalAlignment() { return this; }
  setNumberFormat() { return this; }
  setDataValidation(rule) {
    if (rule !== null && this.numCols === 1) this.sheet._validatedCols.add(this.col);
    return this;
  }
  protect() {
    const p = new FakeProtection();
    this.sheet._protections.push(p);
    return p;
  }
  setBorder() { return this; }
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.hidden = false;
    this.grid = [];
    this.frozenRows = 0;
    this.failOnce = false;
    this.failMsg = null;
    this.failDeleteOnce = false;
    this._protections = [];
    this._validatedCols = new Set();
    this._conditionalFormatRules = [];
  }
  getName() { return this.name; }
  hideSheet() { this.hidden = true; return this; }
  isSheetHidden() { return this.hidden; }
  setFrozenRows(n) { this.frozenRows = n; return this; }
  setColumnWidth() { return this; }
  clear() { this.grid = []; return this; }
  clearContents() { this.grid = []; return this; }
  getProtections() { return this._protections.slice(); }
  getConditionalFormatRules() { return this._conditionalFormatRules.slice(); }
  setConditionalFormatRules(rules) { this._conditionalFormatRules = rules.slice(); }

  getLastRow() { return this.grid.length; }
  getLastColumn() { return this.grid.reduce((mx, row) => Math.max(mx, row.length), 0); }

  setCell(row, col, val) {
    while (this.grid.length < row) this.grid.push([]);
    const r = this.grid[row - 1];
    while (r.length < col) r.push('');
    r[col - 1] = val;
  }
  getCell(row, col) {
    const r = this.grid[row - 1];
    if (!r) return '';
    return r[col - 1] == null ? '' : r[col - 1];
  }
  deleteRow(rowNum) {
    if (this.failDeleteOnce) {
      this.failDeleteOnce = false;
      throw new Error('forced deleteRow failure');
    }
    if (rowNum >= 1 && rowNum <= this.grid.length) this.grid.splice(rowNum - 1, 1);
  }
  getRange(row, col, numRows, numCols) {
    return new FakeRange(this, row, col, numRows || 1, numCols || 1);
  }
}

class FakeSpreadsheet {
  constructor() { this.sheets = []; }
  getSheetByName(name) { return this.sheets.find((s) => s.getName() === name) || null; }
  insertSheet(name) {
    const s = new FakeSheet(name);
    this.sheets.push(s);
    return s;
  }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
}

class FakeLock {
  constructor() { this.locked = false; this.lastTimeout = null; }
  tryLock(timeoutInMillis) {
    if (!Number.isInteger(timeoutInMillis) || timeoutInMillis <= 0) {
      throw new TypeError('tryLock requires finite positive integer timeoutInMillis');
    }
    this.lastTimeout = timeoutInMillis;
    if (this.locked) return false;
    this.locked = true;
    return true;
  }
  releaseLock() { this.locked = false; }
}
class FakeLockService {
  constructor() { this.lock = new FakeLock(); }
  getScriptLock() { return this.lock; }
}

class FakeUi {
  constructor() { this.menus = []; this.alerts = []; }
  createMenu(name) {
    const menu = { name, items: [], addItem(l, f) { this.items.push({ l, f }); return this; }, addToUi() {} };
    this.menus.push(menu);
    return menu;
  }
  alert(msg) { this.alerts.push(String(msg)); }
}

// ---- Sandbox loader ----

function loadSandbox() {
  const sharedUi = new FakeUi();
  const sandbox = {
    console,
    globalThis: null,
    SpreadsheetApp: {
      getActiveSpreadsheet() { return null; },
      getUi() { return sharedUi; },
      newDataValidation() { return new FakeDataValidationBuilder(); },
      newConditionalFormatRule() { return new FakeConditionalFormatRuleBuilder(); },
      ProtectionType: { RANGE: 'RANGE', SHEET: 'SHEET' },
    },
    HtmlService: {
      createHtmlOutputFromFile() {
        return { setTitle() { return this; }, setWidth() { return this; } };
      },
    },
    PropertiesService: {
      getScriptProperties() { return { getProperty() { return null; } }; },
    },
    ScriptApp: {},
    LockService: new FakeLockService(),
    Session: { getScriptTimeZone() { return 'Etc/UTC'; } },
    Utilities: {
      _validTz: new Set(['Etc/UTC', 'UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Europe/London']),
      formatDate(date, tz) {
        if (!this._validTz.has(tz)) throw new Error('Invalid timezone: ' + tz);
        return String(date);
      },
    },
    Date, Math, JSON, String, Number, Array, Object, RegExp, Error,
    setTimeout, clearTimeout, Set, Map,
  };
  sandbox.globalThis = sandbox;
  sandbox._sharedUi = sharedUi;
  vm.createContext(sandbox);
  for (const file of sourceFiles) {
    const code = fs.readFileSync(path.join(srcDir, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }
  return sandbox;
}

function createHarness() {
  const sandbox = loadSandbox();
  const spreadsheet = new FakeSpreadsheet();
  const lockService = new FakeLockService();
  const app = sandbox.AppV3.createApp({ spreadsheet, lockService });
  return { sandbox, spreadsheet, lockService, app };
}

// Pin the sandbox wall clock. Sources read `Date` off the context global on every
// call, so replacing it after load is enough. `new Date(x)` still parses normally;
// only the zero-argument form and Date.now() are frozen.
const RealDate = Date;
function setClock(sandbox, isoInstant) {
  const fixed = new RealDate(isoInstant).getTime();
  function FrozenDate(a, b, c, d, e, f, g) {
    if (!(this instanceof FrozenDate)) return new RealDate(fixed).toString();
    if (arguments.length === 0) return new RealDate(fixed);
    if (arguments.length === 1) return new RealDate(a);
    return new RealDate(a, b, c, d, e, f, g);
  }
  FrozenDate.now = function () { return fixed; };
  FrozenDate.UTC = RealDate.UTC;
  FrozenDate.parse = RealDate.parse;
  FrozenDate.prototype = RealDate.prototype;
  sandbox.Date = FrozenDate;
  return fixed;
}

// A harness whose clock is frozen to `isoDate` before any source code runs.
function createHarnessAt(isoDate) {
  const sandbox = loadSandbox();
  setClock(sandbox, isoDate + 'T10:00:00Z');
  const spreadsheet = new FakeSpreadsheet();
  const lockService = new FakeLockService();
  const app = sandbox.AppV3.createApp({ spreadsheet, lockService });
  return { sandbox, spreadsheet, lockService, app };
}

// ---- Row helpers (Phase 1A) ----

function getSheet(spreadsheet, name) {
  const s = spreadsheet.getSheetByName(name);
  if (!s) throw new Error('sheet not found: ' + name);
  return s;
}

function readRowsAsObjects(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const out = [];
  const lastRow = sheet.getLastRow();
  for (let r = 2; r <= lastRow; r++) {
    const raw = sheet.getRange(r, 1, 1, lastCol).getValues()[0];
    if (!raw.some((c) => c !== '' && c != null)) continue;
    const obj = { _row: r };
    for (let c = 0; c < headers.length; c++) if (headers[c]) obj[headers[c]] = raw[c];
    out.push(obj);
  }
  return out;
}

function makePayload(overrides) {
  const base = {
    submissionId: 'sub-' + Math.random().toString(16).slice(2),
    project: {
      mode: 'new',
      projectName: 'テスト案件',
      shareTitle: 'テスト案件',
      purpose: '目的',
      status: '進行中',
      priority: '次に',
      owner: 'テスト担当',
      startDate: '2026-08-01',
      dueDate: '2026-09-30',
      nextMilestone: 'MVP',
    },
    items: [
      { draftKey: 'item_0', itemType: 'Epic',    title: '大目標' },
      { draftKey: 'item_1', itemType: 'Feature', title: '登録機能', parentDraftKey: 'item_0' },
      { draftKey: 'item_2', itemType: 'Task',    title: '登録API',  parentDraftKey: 'item_1', status: '作業中' },
      { draftKey: 'item_3', itemType: 'Subtask', title: '設計',     parentDraftKey: 'item_2' },
    ],
    relations: [],
    decisions: [],
  };
  return Object.assign({}, base, overrides || {});
}

// ---- Test runner ----

let passed = 0;
let failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); console.log('PASS: ' + name); passed++; }
  catch (err) { console.log('FAIL: ' + name + ' - ' + err.message); failed++; failures.push({ name, err }); }
}

// ==================================================================
// T-S: Setup / Sheet Structure — Phase 1A: 表示 8 + 管理 4 = 12
// ==================================================================

test('T-S1. setup で表示 8 + 管理 4 の全 12 シートが作成される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  const res = app.setup();
  assert.strictEqual(res.ok, true, 'setup should succeed');
  const names = spreadsheet.getSheets().map((s) => s.getName());
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const expected = [
    SN.DASHBOARD, SN.PROJECTS, SN.ITEMS, SN.BOARD, SN.ROADMAP,
    SN.DECISIONS, SN.AI_PROPOSAL, SN.ACTIVITY,
    SN.SETTINGS, SN.RELATIONS, SN.REGISTRATION, SN.COUNTERS,
  ];
  for (const n of expected) assert.ok(names.includes(n), 'sheet exists: ' + n);
  assert.strictEqual(names.length, 12, 'exactly 12 sheets');
});

test('T-S2. stub sheets (03/04/06) に Phase 案内が表示され、行 2 以降のデータはない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  for (const [name, msg] of Object.entries(sandbox.AppV3.CONFIG.STUB_SHEETS)) {
    const s = spreadsheet.getSheetByName(name);
    assert.ok(s, 'stub exists: ' + name);
    assert.strictEqual(s.getRange(1, 1).getValue(), msg, 'stub guidance row: ' + name);
    assert.strictEqual(s.getLastRow(), 1, 'stub has no data rows: ' + name);
  }
});

test('T-S3. 管理 4 シートが非表示', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  assert.strictEqual(sandbox.AppV3.CONFIG.ADMIN_SHEETS.length, 4, '管理 4 枚');
  for (const n of sandbox.AppV3.CONFIG.ADMIN_SHEETS) {
    const s = spreadsheet.getSheetByName(n);
    assert.ok(s.isSheetHidden(), 'admin hidden: ' + n);
  }
});

test('T-S4. display sheets have header row 1', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const CFG = sandbox.AppV3.CONFIG;
  const checks = [
    [CFG.SHEET_NAMES.PROJECTS, CFG.PROJECT_HEADERS],
    [CFG.SHEET_NAMES.ITEMS,    CFG.ITEM_HEADERS],
    [CFG.SHEET_NAMES.DECISIONS,CFG.DECISION_HEADERS],
    [CFG.SHEET_NAMES.ACTIVITY, CFG.ACTIVITY_HEADERS],
    [CFG.SHEET_NAMES.RELATIONS,CFG.RELATION_HEADERS],
    [CFG.SHEET_NAMES.REGISTRATION, CFG.REGISTRATION_HEADERS],
  ];
  for (const [name, headers] of checks) {
    const s = spreadsheet.getSheetByName(name);
    const row = s.getRange(1, 1, 1, headers.length).getValues()[0];
    for (let i = 0; i < headers.length; i++) {
      assert.strictEqual(row[i], headers[i], name + ' header col ' + (i + 1));
    }
  }
});

test('T-S5. 94_構造スナップショットは Phase 1A に存在しない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const CFG = sandbox.AppV3.CONFIG;
  const names = spreadsheet.getSheets().map((s) => s.getName());
  assert.ok(!names.includes('94_構造スナップショット'), 'snapshot sheet must not be created');
  assert.strictEqual(CFG.SHEET_NAMES.SNAPSHOTS, undefined, 'SHEET_NAMES.SNAPSHOTS removed');
  assert.strictEqual(CFG.SNAPSHOT_HEADERS, undefined, 'SNAPSHOT_HEADERS removed');
});

// ==================================================================
// T-14 setup 再実行の冪等性
// ==================================================================

test('T-14. setup 再実行で既存データ・カウンタ・履歴が破壊されない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  // Register 1 project + items.
  const payload = makePayload({ submissionId: 'sub-idempotent-1' });
  const res1 = app.register(payload);
  assert.strictEqual(res1.ok, true);
  const beforeItems = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.ITEMS).length;
  const beforeCounter = getSheet(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.COUNTERS).grid.length;

  // Second setup call.
  const res2 = app.setup();
  assert.strictEqual(res2.ok, true, 'second setup succeeds');

  const names = spreadsheet.getSheets().map((s) => s.getName());
  assert.strictEqual(names.length, 12, 'still 12 sheets');
  const uniqueNames = new Set(names);
  assert.strictEqual(uniqueNames.size, 12, 'no duplicate sheet names');

  // Data preserved.
  const afterItems = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.ITEMS).length;
  assert.strictEqual(afterItems, beforeItems, 'item rows preserved');
  const afterCounter = getSheet(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.COUNTERS).grid.length;
  assert.strictEqual(afterCounter, beforeCounter, 'counter rows preserved');
});

test('T-14b. setup 再実行で保護が重複しない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const projSheet = spreadsheet.getSheetByName(SN.PROJECTS);
  const beforeProtCount = projSheet.getProtections().length;
  app.setup();
  const afterProtCount = projSheet.getProtections().length;
  assert.strictEqual(afterProtCount, beforeProtCount, 'setup rerun does not stack duplicate protections');
});

// ==================================================================
// T-01 / T-02: ID 重複防止
// ==================================================================

test('T-01. Project ID は連番で発番され重複しない', function () {
  const { app, sandbox } = createHarness();
  app.setup();
  const ids = new Set();
  for (let i = 0; i < 5; i++) {
    const res = app.register(makePayload({
      submissionId: 'sub-t01-' + i,
      project: { mode: 'new', projectName: 'P' + i, shareTitle: 'P' + i, status: '進行中', priority: '次に' },
      items: [],
    }));
    assert.strictEqual(res.ok, true, 'register ' + i);
    assert.ok(!ids.has(res.projectId), 'no duplicate projectId: ' + res.projectId);
    ids.add(res.projectId);
    assert.ok(/^PPM-P-\d{4}$/.test(res.projectId), 'format ok: ' + res.projectId);
  }
});

test('T-02. Work Item ID は Project scope の TYPE 別カウンタで 10 刻み発番', function () {
  const { app } = createHarness();
  app.setup();
  const res = app.register(makePayload({ submissionId: 'sub-t02',
    items: [
      { draftKey: 'a', itemType: 'Task', title: 'A' },
      { draftKey: 'b', itemType: 'Task', title: 'B' },
      { draftKey: 'c', itemType: 'Task', title: 'C' },
    ] }));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(JSON.stringify(res.itemIds), JSON.stringify([
    res.projectId + '-T-0010',
    res.projectId + '-T-0020',
    res.projectId + '-T-0030',
  ]));
});

// ==================================================================
// T-03 / T-04 / T-05: 参照整合性
// ==================================================================

test('T-03. 存在しない projectId (mode=existing) の登録は validation_error', function () {
  const { app } = createHarness();
  app.setup();
  const res = app.register({
    submissionId: 'sub-t03',
    project: { mode: 'existing', projectId: 'PPM-P-9999' },
    items: [{ draftKey: 'x', itemType: 'Task', title: '不正参照' }],
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('project.projectId が存在しません'));
});

test('T-04. 存在しない parentItemId の登録は validation_error', function () {
  const { app } = createHarness();
  app.setup();
  const first = app.register(makePayload({ submissionId: 'sub-t04-a', items: [] }));
  assert.strictEqual(first.ok, true);
  const res = app.register({
    submissionId: 'sub-t04-b',
    project: { mode: 'existing', projectId: first.projectId },
    items: [{ draftKey: 'x', itemType: 'Task', title: 'Bad parent', parentItemId: 'PPM-P-0001-T-9999' }],
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('parentItemId が存在しません'));
});

test('T-05. 異なる Project の parentItemId は validation_error', function () {
  const { app } = createHarness();
  app.setup();
  const p1 = app.register(makePayload({ submissionId: 'sub-t05-a',
    project: { mode: 'new', projectName: 'P1', shareTitle: 'P1', status: '進行中', priority: '次に' },
    items: [{ draftKey: 'a', itemType: 'Task', title: 'T1' }] }));
  const p2 = app.register(makePayload({ submissionId: 'sub-t05-b',
    project: { mode: 'new', projectName: 'P2', shareTitle: 'P2', status: '進行中', priority: '次に' },
    items: [] }));
  assert.strictEqual(p1.ok, true); assert.strictEqual(p2.ok, true);
  const res = app.register({
    submissionId: 'sub-t05-c',
    project: { mode: 'existing', projectId: p2.projectId },
    items: [{ draftKey: 'x', itemType: 'Subtask', title: 'wrong project parent', parentItemId: p1.itemIds[0] }],
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('別 Project'));
});

// ==================================================================
// T-06 / T-07: 循環関係
// ==================================================================

test('T-06. 循環親子関係は validation_error', function () {
  const { app } = createHarness();
  app.setup();
  const res = app.register(makePayload({ submissionId: 'sub-t06',
    items: [
      { draftKey: 'a', itemType: 'Task', title: 'A', parentDraftKey: 'c' },
      { draftKey: 'b', itemType: 'Task', title: 'B', parentDraftKey: 'a' },
      { draftKey: 'c', itemType: 'Task', title: 'C', parentDraftKey: 'b' },
    ] }));
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('親子関係に循環'));
});

test('T-07. 循環依存関係は validation_error', function () {
  const { app } = createHarness();
  app.setup();
  const res = app.register(makePayload({ submissionId: 'sub-t07',
    items: [
      { draftKey: 'a', itemType: 'Task', title: 'A' },
      { draftKey: 'b', itemType: 'Task', title: 'B' },
      { draftKey: 'c', itemType: 'Task', title: 'C' },
    ],
    relations: [
      { sourceDraftKey: 'a', targetDraftKey: 'b', relationType: 'depends_on' },
      { sourceDraftKey: 'b', targetDraftKey: 'c', relationType: 'depends_on' },
      { sourceDraftKey: 'c', targetDraftKey: 'a', relationType: 'depends_on' },
    ] }));
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('依存関係に循環'));
});

// ==================================================================
// T-08: 部分登録 rollback
// ==================================================================

test('T-08. items 途中の write 失敗で Project も含めて全ロールバック', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const payload = makePayload({ submissionId: 'sub-t08' });
  const origAppend = sandbox.V3Schema.appendRow;
  let calls = 0;
  sandbox.V3Schema.appendRow = function (sheet, row) {
    if (sheet === itemSheet) {
      calls++;
      if (calls === 2) throw new Error('forced item append failure');
    }
    return origAppend(sheet, row);
  };
  const res = app.register(payload);
  sandbox.V3Schema.appendRow = origAppend;
  assert.strictEqual(res.ok, false, 'should fail');
  assert.strictEqual(res.code, 'registration_error');
  const projRows = readRowsAsObjects(spreadsheet, SN.PROJECTS);
  assert.strictEqual(projRows.length, 0, 'project rolled back');
  const itemRows = readRowsAsObjects(spreadsheet, SN.ITEMS);
  assert.strictEqual(itemRows.length, 0, 'items rolled back');
});

// ==================================================================
// T-09: 二重登録 idempotent
// ==================================================================

test('T-09. 同じ submissionId + payload → 冪等 replay', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const payload = makePayload({ submissionId: 'sub-t09' });
  const r1 = app.register(payload);
  const beforeRows = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.ITEMS).length;
  const r2 = app.register(payload);
  const afterRows = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.ITEMS).length;
  assert.strictEqual(r1.ok, true); assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.projectId, r1.projectId, 'same projectId');
  assert.deepStrictEqual(r2.itemIds, r1.itemIds, 'same itemIds');
  assert.strictEqual(r2.idempotent, true, 'flagged idempotent');
  assert.strictEqual(afterRows, beforeRows, 'no new rows');
});

test('T-09b. 同じ submissionId + 異なる payload → payload_mismatch', function () {
  const { app } = createHarness();
  app.setup();
  const payload = makePayload({ submissionId: 'sub-t09b' });
  const r1 = app.register(payload);
  assert.strictEqual(r1.ok, true);
  const modified = Object.assign({}, payload, {
    items: payload.items.map((it, i) => (i === 0 ? Object.assign({}, it, { title: 'CHANGED' }) : it)),
  });
  const r2 = app.register(modified);
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.code, 'payload_mismatch');
});

// ==================================================================
// T-10 / T-11: Project isolation and non-destructive updates
// ==================================================================

test('T-10. 別 Project 登録が既存 Project の counter・行を書き換えない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const r1 = app.register(makePayload({ submissionId: 'sub-t10-a' }));
  const p1Row = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.PROJECTS)
    .find((p) => p.projectId === r1.projectId);
  const r2 = app.register(makePayload({ submissionId: 'sub-t10-b',
    project: { mode: 'new', projectName: 'P2', shareTitle: 'P2', status: '進行中', priority: '次に' },
    items: [{ draftKey: 'x', itemType: 'Task', title: 'T' }] }));
  assert.strictEqual(r2.ok, true);
  assert.notStrictEqual(r1.projectId, r2.projectId, 'different projectId');
  const p1After = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.PROJECTS)
    .find((p) => p.projectId === r1.projectId);
  assert.strictEqual(p1After.projectName, p1Row.projectName, 'p1 unchanged');
});

test('T-11. 既存 Project へ Item 追加しても Project 行が書き換わらない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const r1 = app.register(makePayload({ submissionId: 'sub-t11-a',
    project: { mode: 'new', projectName: 'unique-name', shareTitle: 'x', status: '進行中', priority: '次に' },
    items: [{ draftKey: 'a', itemType: 'Task', title: 'A' }] }));
  const beforeProj = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.PROJECTS)
    .find((p) => p.projectId === r1.projectId);
  const r2 = app.register({
    submissionId: 'sub-t11-b',
    project: { mode: 'existing', projectId: r1.projectId },
    items: [{ draftKey: 'x', itemType: 'Task', title: '追加Task' }],
  });
  assert.strictEqual(r2.ok, true);
  const afterProj = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.PROJECTS)
    .find((p) => p.projectId === r1.projectId);
  assert.strictEqual(afterProj.projectName, beforeProj.projectName, 'projectName unchanged');
  assert.strictEqual(afterProj.status, beforeProj.status, 'status unchanged');
});

// ==================================================================
// T-12: Formula injection
// ==================================================================

test('T-12. = 始まりの文字列は apostrophe prefix で無害化される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const res = app.register({
    submissionId: 'sub-t12',
    project: { mode: 'new', projectName: '=IMPORTDATA("http://evil")', shareTitle: '=1+1',
               status: '進行中', priority: '次に' },
    items: [{ draftKey: 'a', itemType: 'Task', title: '=HYPERLINK("bad","x")' }],
  });
  assert.strictEqual(res.ok, true);
  const projRow = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.PROJECTS)[0];
  assert.strictEqual(projRow.projectName, "'=IMPORTDATA(\"http://evil\")", 'projectName escaped');
  assert.strictEqual(projRow.shareTitle,  "'=1+1", 'shareTitle escaped');
  const itemRow = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.ITEMS)[0];
  assert.strictEqual(itemRow.title, '\'=HYPERLINK("bad","x")', 'title escaped');
});

test('T-12b. + / - / @ 始まりは変換されない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const res = app.register(makePayload({ submissionId: 'sub-t12b',
    project: { mode: 'new', projectName: '+1234', shareTitle: '@name', status: '進行中', priority: '次に' },
    items: [{ draftKey: 'x', itemType: 'Task', title: '-100' }] }));
  assert.strictEqual(res.ok, true);
  const p = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.PROJECTS)[0];
  assert.strictEqual(p.projectName, '+1234');
  assert.strictEqual(p.shareTitle, '@name');
  const it = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.ITEMS)[0];
  assert.strictEqual(it.title, '-100');
});

// ==================================================================
// T-13: Lock 競合
// ==================================================================

test('T-13. 200ms tryLock で並行登録の 2 本目は concurrent_sync', function () {
  const sandbox = loadSandbox();
  const spreadsheet = new FakeSpreadsheet();
  const lockService = new FakeLockService();
  const app = sandbox.AppV3.createApp({ spreadsheet, lockService });
  app.setup();
  const held = lockService.getScriptLock();
  assert.ok(held.tryLock(200));
  const res = app.register(makePayload({ submissionId: 'sub-t13' }));
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'concurrent_sync');
  assert.strictEqual(lockService.lock.lastTimeout, 200, 'lock timeout = 200ms');
  held.releaseLock();
});

// ==================================================================
// T-15: Activity 記録
// ==================================================================

test('T-15. Registration 成功で create Activity が Project / Item / Decision / Relation それぞれに記録される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const res = app.register(makePayload({ submissionId: 'sub-t15',
    items: [
      { draftKey: 'a', itemType: 'Epic', title: 'Big' },
      { draftKey: 'b', itemType: 'Task', title: 'Small', parentDraftKey: 'a' },
    ],
    relations: [{ sourceDraftKey: 'b', targetDraftKey: 'a', relationType: 'depends_on' }],
    decisions: [{ title: '判断1', type: '判断待ち', status: '未確認' }],
  }));
  assert.strictEqual(res.ok, true);
  const activities = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.ACTIVITY);
  const byEntity = {};
  activities.forEach((a) => { byEntity[a.entityType] = (byEntity[a.entityType] || 0) + 1; });
  assert.ok(byEntity.project >= 1, 'project activity recorded');
  assert.strictEqual(byEntity.item, 2, 'item activity x2');
  assert.strictEqual(byEntity.decision, 1, 'decision activity x1');
  assert.strictEqual(byEntity.relation, 1, 'relation activity x1');
});

test('T-15b. setup 実行で system.setup Activity が記録される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const activities = readRowsAsObjects(spreadsheet, sandbox.AppV3.CONFIG.SHEET_NAMES.ACTIVITY);
  const setup = activities.find((a) => a.action === 'setup');
  assert.ok(setup, 'setup activity present');
  assert.strictEqual(setup.actor, 'setup');
  assert.strictEqual(setup.afterValue, sandbox.AppV3.CONFIG.SCHEMA_VERSION);
});

test('T-15c. Activity 追記失敗時は registration が rollback される (atomicity)', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const orig = sandbox.V3Schema.appendActivity;
  sandbox.V3Schema.appendActivity = function () { throw new Error('forced activity failure'); };
  const res = app.register(makePayload({ submissionId: 'sub-t15c' }));
  sandbox.V3Schema.appendActivity = orig;
  assert.strictEqual(res.ok, false);
  const projRows = readRowsAsObjects(spreadsheet, SN.PROJECTS);
  assert.strictEqual(projRows.length, 0, 'project rolled back on activity failure');
});

// ==================================================================
// T-B: onEdit boundary — blank rows must NOT be materialized into entities
// ==================================================================

function makeEditEvent(spreadsheet, sheetName, row, headerName, oldValue, newValue) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const col = headers.indexOf(headerName) + 1;
  if (col < 1) throw new Error('unknown header for edit event: ' + headerName);
  sheet.getRange(row, col).setValue(newValue == null ? '' : newValue);
  return {
    source: spreadsheet,
    range: new FakeRange(sheet, row, col, 1, 1),
    oldValue: oldValue,
    value: newValue,
  };
}

function makeMultiCellPasteEvent(spreadsheet, sheetName, topRow, topCol, values) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  const numRows = values.length;
  const numCols = values[0].length;
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      sheet.getRange(topRow + r, topCol + c).setValue(values[r][c]);
    }
  }
  return {
    source: spreadsheet,
    range: new FakeRange(sheet, topRow, topCol, numRows, numCols),
  };
}

test('T-B1. 空 Project 行への直接入力は Project を作成せず、Activity も追記されない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const activitiesBefore = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;

  const ev = makeEditEvent(spreadsheet, SN.PROJECTS, 2, 'status', '', '進行中');
  sandbox.onEdit(ev);

  const activitiesAfter = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;
  assert.strictEqual(activitiesAfter, activitiesBefore, 'no Activity appended for blank-row edit');
});

test('T-B2. 空 Work Item 行への直接入力は Work Item を作成せず、updatedAt も打刻しない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const ev = makeEditEvent(spreadsheet, SN.ITEMS, 2, 'status', '', '作業中');
  sandbox.onEdit(ev);
  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(itemSheet);
  const updatedAtVal = itemSheet.getRange(2, headerMap.updatedAt).getValue();
  assert.strictEqual(updatedAtVal, '', 'updatedAt not stamped on blank row');
});

test('T-B3. 空 Decision 行で status を 回答済み にしても resolvedAt は打刻されない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const ev = makeEditEvent(spreadsheet, SN.DECISIONS, 2, 'status', '', '回答済み');
  sandbox.onEdit(ev);
  const decSheet = spreadsheet.getSheetByName(SN.DECISIONS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(decSheet);
  const resolvedAtVal = decSheet.getRange(2, headerMap.resolvedAt).getValue();
  assert.strictEqual(resolvedAtVal, '', 'resolvedAt not stamped on blank Decision row');
});

test('T-B4. IDのない Project 行は Dashboard KPI と Project 別行に集計されない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  app.register(makePayload({ submissionId: 'sub-tb4',
    project: { mode: 'new', projectName: 'Real', shareTitle: 'Real', status: '進行中', priority: '次に' },
    items: [] }));

  const projSheet = spreadsheet.getSheetByName(SN.PROJECTS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(projSheet);
  const nextRow = projSheet.getLastRow() + 1;
  projSheet.getRange(nextRow, headerMap.status).setValue('進行中');

  const res = app.rebuildDashboard({ now: new Date('2026-08-10T00:00:00Z').getTime() });
  assert.strictEqual(res.ok, true);

  const dash = spreadsheet.getSheetByName(SN.DASHBOARD);
  const kpi = dash.getRange(5, 1, 1, 8).getValues()[0];
  assert.strictEqual(kpi[0], 1, 'inProgress count only counts rows with projectId');

  const projRows = dash.getRange(8, 1, 5, 9).getValues().filter((r) => r[1] !== '' && r[1] != null);
  assert.strictEqual(projRows.length, 1, 'dashboard shows exactly one Project row');
});

test('T-B5. 既存 Work Item の日常項目（status）は直接編集で更新でき、Activity も記録される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const reg = app.register(makePayload({ submissionId: 'sub-tb5',
    items: [{ draftKey: 'a', itemType: 'Task', title: 'T', status: '未着手' }] }));
  assert.strictEqual(reg.ok, true);

  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(itemSheet);
  let row = -1;
  for (let r = 2; r <= itemSheet.getLastRow(); r++) {
    if (itemSheet.getRange(r, headerMap.itemId).getValue() === reg.itemIds[0]) { row = r; break; }
  }
  assert.ok(row > 1, 'item row located');

  const activitiesBefore = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;
  const ev = makeEditEvent(spreadsheet, SN.ITEMS, row, 'status', '未着手', '作業中');
  sandbox.onEdit(ev);

  assert.strictEqual(itemSheet.getRange(row, headerMap.status).getValue(), '作業中');
  const updatedAt = itemSheet.getRange(row, headerMap.updatedAt).getValue();
  assert.ok(updatedAt && updatedAt !== '', 'updatedAt was bumped');
  const activitiesAfter = readRowsAsObjects(spreadsheet, SN.ACTIVITY);
  assert.strictEqual(activitiesAfter.length, activitiesBefore + 1, 'exactly one Activity appended');
  const last = activitiesAfter[activitiesAfter.length - 1];
  assert.strictEqual(last.entityType, 'item');
  assert.strictEqual(last.entityId, reg.itemIds[0]);
  assert.strictEqual(last.field, 'status');
  assert.strictEqual(last.afterValue, '作業中');
});

test('T-B7. Sidebar 経由の Project / Work Item 登録は従来どおり成功する', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const res = app.register(makePayload({ submissionId: 'sub-tb7' }));
  assert.strictEqual(res.ok, true, 'registration ok');
  assert.ok(/^PPM-P-\d{4}$/.test(res.projectId), 'projectId issued via Service');
  assert.strictEqual(res.itemIds.length, 4, 'items created via Service');

  const projectRows = readRowsAsObjects(spreadsheet, SN.PROJECTS);
  const itemRows = readRowsAsObjects(spreadsheet, SN.ITEMS);
  assert.ok(projectRows.every((p) => p.projectId), 'every project row carries projectId');
  assert.ok(itemRows.every((it) => it.itemId && it.projectId), 'every item row carries itemId + projectId');
});

// ==================================================================
// T-C: Phase 1A onEdit contract
//   - single-cell edit + allowlist column + official row → formal update
//   - anything else → no formal update (no updatedAt, no Activity, no resolvedAt,
//     no auto-clear of structural cells)
//   - Structural / auto columns are protected at the sheet level (verified in T-P).
// ==================================================================

test('T-C1. Allowlist 単一セル編集: status / priority / dueDate は反映される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const reg = app.register(makePayload({ submissionId: 'sub-tc1',
    items: [{ draftKey: 'a', itemType: 'Task', title: 'T', status: '未着手' }] }));
  const id = reg.itemIds[0];
  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(itemSheet);
  let row = -1;
  for (let r = 2; r <= itemSheet.getLastRow(); r++) {
    if (itemSheet.getRange(r, headerMap.itemId).getValue() === id) { row = r; break; }
  }

  const activitiesBefore = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;
  sandbox.onEdit(makeEditEvent(spreadsheet, SN.ITEMS, row, 'status', '未着手', '作業中'));
  sandbox.onEdit(makeEditEvent(spreadsheet, SN.ITEMS, row, 'priority', '', '今すぐ'));
  sandbox.onEdit(makeEditEvent(spreadsheet, SN.ITEMS, row, 'dueDate', '', '2026-09-30'));

  assert.strictEqual(itemSheet.getRange(row, headerMap.status).getValue(), '作業中');
  assert.strictEqual(itemSheet.getRange(row, headerMap.priority).getValue(), '今すぐ');
  assert.strictEqual(itemSheet.getRange(row, headerMap.dueDate).getValue(), '2026-09-30');
  assert.ok(itemSheet.getRange(row, headerMap.updatedAt).getValue(), 'updatedAt bumped');
  const activitiesAfter = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;
  assert.strictEqual(activitiesAfter, activitiesBefore + 3, '3 Activity rows appended');
});

test('T-C2. 非 allowlist 列（構造/自動）の単一セル編集は正式更新扱いにしない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const reg = app.register(makePayload({ submissionId: 'sub-tc2',
    items: [{ draftKey: 'a', itemType: 'Task', title: 'T' }] }));
  const id = reg.itemIds[0];
  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(itemSheet);
  let row = -1;
  for (let r = 2; r <= itemSheet.getLastRow(); r++) {
    if (itemSheet.getRange(r, headerMap.itemId).getValue() === id) { row = r; break; }
  }

  const beforeUpdatedAt = itemSheet.getRange(row, headerMap.updatedAt).getValue();
  const beforeActivities = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;

  // Structural (title, parentItemId, itemType, active) and auto (itemId,
  // projectId, createdAt, revision) columns are not allowlist entries.
  const notAllowed = ['title', 'parentItemId', 'itemType', 'active',
                      'itemId', 'projectId', 'createdAt', 'revision'];
  for (const h of notAllowed) {
    // The edit itself is not something we simulate committing (in real Sheets
    // the protection stops it); we only verify the trigger contract: even if
    // one landed, updatedAt / Activity are not touched.
    sandbox.onEdit({
      source: spreadsheet,
      range: new FakeRange(itemSheet, row, headerMap[h], 1, 1),
      oldValue: 'X',
      value: 'Y',
    });
  }

  const afterUpdatedAt = itemSheet.getRange(row, headerMap.updatedAt).getValue();
  assert.strictEqual(afterUpdatedAt, beforeUpdatedAt, 'updatedAt untouched by non-allowlist edits');
  const afterActivities = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;
  assert.strictEqual(afterActivities, beforeActivities,
    'no Activity emitted for non-allowlist single-cell edits');
});

test('T-C3. 複数セル貼付けはPhase 1A対象外: allowlist列でも updatedAt / Activity を書かない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const reg = app.register(makePayload({ submissionId: 'sub-tc3',
    items: [{ draftKey: 'a', itemType: 'Task', title: 'T', status: '未着手' }] }));
  const id = reg.itemIds[0];
  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(itemSheet);
  let row = -1;
  for (let r = 2; r <= itemSheet.getLastRow(); r++) {
    if (itemSheet.getRange(r, headerMap.itemId).getValue() === id) { row = r; break; }
  }

  const beforeUpdatedAt = itemSheet.getRange(row, headerMap.updatedAt).getValue();
  const beforeActivities = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;

  // Multi-cell paste covering status + priority + dueDate (all allowlist).
  const ev = makeMultiCellPasteEvent(spreadsheet, SN.ITEMS, row, headerMap.status, [[
    '作業中', '今すぐ', '2026-09-30',
  ]]);
  sandbox.onEdit(ev);

  // Cell contents are whatever the user pasted; the harness cannot enforce
  // real sheet protection. What we verify: no formal update side effects.
  const afterUpdatedAt = itemSheet.getRange(row, headerMap.updatedAt).getValue();
  assert.strictEqual(afterUpdatedAt, beforeUpdatedAt,
    'updatedAt not bumped by multi-cell paste (out of scope for Phase 1A)');
  const afterActivities = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;
  assert.strictEqual(afterActivities, beforeActivities,
    'no Activity emitted for multi-cell paste');
});

test('T-C4. Decision 複数セル貼付けで status を含んでも resolvedAt は自動打刻しない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const reg = app.register(makePayload({ submissionId: 'sub-tc4',
    items: [],
    decisions: [{ title: '判断1', type: '判断待ち', status: '未確認' }],
  }));
  assert.strictEqual(reg.ok, true);
  const did = reg.decisionIds[0];
  const decSheet = spreadsheet.getSheetByName(SN.DECISIONS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(decSheet);
  let row = -1;
  for (let r = 2; r <= decSheet.getLastRow(); r++) {
    if (decSheet.getRange(r, headerMap.decisionId).getValue() === did) { row = r; break; }
  }
  assert.ok(row > 1);

  const beforeResolvedAt = decSheet.getRange(row, headerMap.resolvedAt).getValue();
  assert.strictEqual(beforeResolvedAt, '', 'baseline: no resolvedAt');

  // Multi-cell paste covering status + resolution.
  const ev = makeMultiCellPasteEvent(spreadsheet, SN.DECISIONS, row, headerMap.status, [[
    '回答済み', '了解',
  ]]);
  sandbox.onEdit(ev);

  const afterResolvedAt = decSheet.getRange(row, headerMap.resolvedAt).getValue();
  assert.strictEqual(afterResolvedAt, '',
    'resolvedAt must NOT be auto-stamped by multi-cell paste');
});

test('T-C5. Decision 単一セル: status → 回答済み で resolvedAt が打刻される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const reg = app.register(makePayload({ submissionId: 'sub-tc5',
    items: [],
    decisions: [{ title: '判断A', type: '判断待ち', status: '未確認' }],
  }));
  const did = reg.decisionIds[0];
  const decSheet = spreadsheet.getSheetByName(SN.DECISIONS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(decSheet);
  let row = -1;
  for (let r = 2; r <= decSheet.getLastRow(); r++) {
    if (decSheet.getRange(r, headerMap.decisionId).getValue() === did) { row = r; break; }
  }
  assert.ok(row > 1);

  sandbox.onEdit(makeEditEvent(spreadsheet, SN.DECISIONS, row, 'status', '未確認', '回答済み'));
  const resolvedAt = decSheet.getRange(row, headerMap.resolvedAt).getValue();
  assert.ok(resolvedAt && resolvedAt !== '', 'resolvedAt auto-stamped');
});

test('T-C6. Decision 単一セル: status → 不要 で resolvedAt が打刻される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const reg = app.register(makePayload({ submissionId: 'sub-tc6',
    items: [],
    decisions: [{ title: '判断B', type: '判断待ち', status: '未確認' }],
  }));
  const did = reg.decisionIds[0];
  const decSheet = spreadsheet.getSheetByName(SN.DECISIONS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(decSheet);
  let row = -1;
  for (let r = 2; r <= decSheet.getLastRow(); r++) {
    if (decSheet.getRange(r, headerMap.decisionId).getValue() === did) { row = r; break; }
  }

  sandbox.onEdit(makeEditEvent(spreadsheet, SN.DECISIONS, row, 'status', '未確認', '不要'));
  const resolvedAt = decSheet.getRange(row, headerMap.resolvedAt).getValue();
  assert.ok(resolvedAt && resolvedAt !== '', 'resolvedAt auto-stamped on 不要');
});

test('T-C7. 非 official 行の allowlist 編集は無視される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(itemSheet);

  // Simulate a hand-typed itemId on a row (no createdAt).
  const nextRow = itemSheet.getLastRow() + 1;
  itemSheet.getRange(nextRow, headerMap.itemId).setValue('FAKE-ITEM');

  const beforeActivities = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;
  sandbox.onEdit(makeEditEvent(spreadsheet, SN.ITEMS, nextRow, 'status', '', '作業中'));
  const afterActivities = readRowsAsObjects(spreadsheet, SN.ACTIVITY).length;

  assert.strictEqual(afterActivities, beforeActivities,
    'non-official row edits emit no Activity');
  const updatedAt = itemSheet.getRange(nextRow, headerMap.updatedAt).getValue();
  assert.strictEqual(updatedAt, '', 'non-official row updatedAt not stamped');
});

test('T-C8. Registration Service: 手動タイプ ID の parentItemId 参照は validation_error', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const p1 = app.register(makePayload({ submissionId: 'sub-tc8-a',
    project: { mode: 'new', projectName: 'P1', shareTitle: 'P1', status: '進行中', priority: '次に' },
    items: [] }));
  assert.strictEqual(p1.ok, true);

  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(itemSheet);
  const fakeId = p1.projectId + '-T-9990';
  const nextRow = itemSheet.getLastRow() + 1;
  itemSheet.getRange(nextRow, headerMap.itemId).setValue(fakeId);
  itemSheet.getRange(nextRow, headerMap.projectId).setValue(p1.projectId);
  itemSheet.getRange(nextRow, headerMap.itemType).setValue('Task');
  itemSheet.getRange(nextRow, headerMap.title).setValue('Manually typed');

  const res = app.register({
    submissionId: 'sub-tc8-b',
    project: { mode: 'existing', projectId: p1.projectId },
    items: [{ draftKey: 'sub', itemType: 'Subtask', title: 'sub of fake parent', parentItemId: fakeId }],
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('parentItemId が存在しません'),
    'unofficial ID treated as non-existent by findOfficialRowById');
});

test('T-C9. Dashboard は手動タイプ Project 行を集計対象から除外する', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  app.register(makePayload({ submissionId: 'sub-tc9',
    project: { mode: 'new', projectName: 'Real', shareTitle: 'Real', status: '進行中', priority: '次に' },
    items: [] }));

  const projSheet = spreadsheet.getSheetByName(SN.PROJECTS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(projSheet);
  const nextRow = projSheet.getLastRow() + 1;
  projSheet.getRange(nextRow, headerMap.projectId).setValue('PPM-P-8888');
  projSheet.getRange(nextRow, headerMap.projectName).setValue('Fake');
  projSheet.getRange(nextRow, headerMap.status).setValue('進行中');
  projSheet.getRange(nextRow, headerMap.priority).setValue('今すぐ');

  const res = app.rebuildDashboard({ now: new Date('2026-08-10T00:00:00Z').getTime() });
  assert.strictEqual(res.ok, true);

  const dash = spreadsheet.getSheetByName(SN.DASHBOARD);
  const kpi = dash.getRange(5, 1, 1, 8).getValues()[0];
  assert.strictEqual(kpi[0], 1, 'inProgress = 1 — fake row excluded');
});

test('T-C10. 拒否操作でカウンタ・登録履歴・正常 Activity 数が破損しない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const reg = app.register(makePayload({ submissionId: 'sub-tc10' }));
  assert.strictEqual(reg.ok, true);

  const counterSheet = spreadsheet.getSheetByName(SN.COUNTERS);
  const registrationSheet = spreadsheet.getSheetByName(SN.REGISTRATION);

  const beforeCounter = counterSheet.grid.map((r) => r.slice());
  const beforeRegRows = registrationSheet.getLastRow();

  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(itemSheet);
  // Blank-row single-cell edit + multi-cell paste against a blank row.
  sandbox.onEdit(makeEditEvent(spreadsheet, SN.ITEMS, 20, 'itemId', '', 'FAKE-1'));
  sandbox.onEdit(makeMultiCellPasteEvent(spreadsheet, SN.ITEMS, 30, headerMap.itemId, [[
    'FAKE-2', 'PPM-P-0001', 'Task', 'Fake Item',
  ]]));

  assert.deepStrictEqual(counterSheet.grid, beforeCounter,
    'counters unchanged by rejected edits');
  assert.strictEqual(registrationSheet.getLastRow(), beforeRegRows,
    'registration history unchanged');

  const activities = readRowsAsObjects(spreadsheet, SN.ACTIVITY);
  const bogusUpdates = activities.filter((a) =>
    a.action === 'update' && (a.entityId === 'FAKE-1' || a.entityId === 'FAKE-2'));
  assert.strictEqual(bogusUpdates.length, 0,
    'no update Activity attributed to hand-typed IDs');
});

// ==================================================================
// T-P: Direct edit protection — structural / auto columns are protected
// ==================================================================

test('T-P1. Project 保護: allowlist 以外の列が保護されている', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const CFG = sandbox.AppV3.CONFIG;
  const projSheet = spreadsheet.getSheetByName(SN.PROJECTS);
  const protections = projSheet.getProtections();
  const protectedTags = protections.map((p) => p.getDescription());

  const allowSet = new Set(CFG.PROJECT_DIRECT_EDIT_COLS);
  const protectedHeaders = CFG.PROJECT_HEADERS.filter((h) => !allowSet.has(h));
  for (const h of protectedHeaders) {
    const col = sandbox.V3Schema.resolveColumnIndex(projSheet, h);
    const found = protectedTags.some((tag) => tag.endsWith(':' + col));
    assert.ok(found, 'protection exists for header ' + h + ' (col ' + col + ')');
  }
  // Protections are strong (not warning-only) so normal users cannot edit.
  for (const p of protections) {
    assert.strictEqual(p.isWarningOnly(), false,
      'protection is strong (not warning-only): ' + p.getDescription());
  }
});

test('T-P2. Item 保護: allowlist 以外の列が保護されている', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const CFG = sandbox.AppV3.CONFIG;
  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const protections = itemSheet.getProtections();
  const protectedTags = protections.map((p) => p.getDescription());

  const allowSet = new Set(CFG.ITEM_DIRECT_EDIT_COLS);
  const protectedHeaders = CFG.ITEM_HEADERS.filter((h) => !allowSet.has(h));
  for (const h of protectedHeaders) {
    const col = sandbox.V3Schema.resolveColumnIndex(itemSheet, h);
    const found = protectedTags.some((tag) => tag.endsWith(':' + col));
    assert.ok(found, 'protection exists for header ' + h);
  }
});

test('T-P3. Decision 保護: allowlist 以外の列が保護されている', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const CFG = sandbox.AppV3.CONFIG;
  const decSheet = spreadsheet.getSheetByName(SN.DECISIONS);
  const protections = decSheet.getProtections();
  const protectedTags = protections.map((p) => p.getDescription());

  const allowSet = new Set(CFG.DECISION_DIRECT_EDIT_COLS);
  const protectedHeaders = CFG.DECISION_HEADERS.filter((h) => !allowSet.has(h));
  for (const h of protectedHeaders) {
    const col = sandbox.V3Schema.resolveColumnIndex(decSheet, h);
    const found = protectedTags.some((tag) => tag.endsWith(':' + col));
    assert.ok(found, 'protection exists for header ' + h);
  }
});

test('T-P4. Activity 全列が保護されている', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const CFG = sandbox.AppV3.CONFIG;
  const actSheet = spreadsheet.getSheetByName(SN.ACTIVITY);
  const protections = actSheet.getProtections();
  assert.ok(protections.length >= CFG.ACTIVITY_HEADERS.length,
    'Activity sheet has protection for every column');
});

// ==================================================================
// T-R: Relation raw-itemId + cross-project + dedup validation
// ==================================================================

test('T-R1. Raw sourceItemId / targetItemId が存在しない場合は validation_error', function () {
  const { app } = createHarness();
  app.setup();
  const p1 = app.register(makePayload({ submissionId: 'sub-tr1-a',
    items: [{ draftKey: 'a', itemType: 'Task', title: 'A' }] }));
  assert.strictEqual(p1.ok, true);

  const res = app.register({
    submissionId: 'sub-tr1-b',
    project: { mode: 'existing', projectId: p1.projectId },
    items: [{ draftKey: 'x', itemType: 'Task', title: 'X' }],
    relations: [{ sourceItemId: p1.itemIds[0], targetItemId: 'PPM-P-9999-T-9999', relationType: 'depends_on' }],
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('targetItemId が存在しません'));
});

test('T-R2. Raw itemId が別 Project の場合は validation_error', function () {
  const { app } = createHarness();
  app.setup();
  const p1 = app.register(makePayload({ submissionId: 'sub-tr2-a',
    project: { mode: 'new', projectName: 'P1', shareTitle: 'P1', status: '進行中', priority: '次に' },
    items: [{ draftKey: 'a', itemType: 'Task', title: 'A' }] }));
  const p2 = app.register(makePayload({ submissionId: 'sub-tr2-b',
    project: { mode: 'new', projectName: 'P2', shareTitle: 'P2', status: '進行中', priority: '次に' },
    items: [{ draftKey: 'b', itemType: 'Task', title: 'B' }] }));
  assert.strictEqual(p1.ok, true); assert.strictEqual(p2.ok, true);

  const res = app.register({
    submissionId: 'sub-tr2-c',
    project: { mode: 'existing', projectId: p2.projectId },
    items: [{ draftKey: 'x', itemType: 'Task', title: 'X' }],
    relations: [{ sourceItemId: p1.itemIds[0], targetItemId: p2.itemIds[0], relationType: 'depends_on' }],
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('別 Project'));
});

test('T-R3. Raw itemId の source == target は validation_error', function () {
  const { app } = createHarness();
  app.setup();
  const p1 = app.register(makePayload({ submissionId: 'sub-tr3-a',
    items: [{ draftKey: 'a', itemType: 'Task', title: 'A' }] }));

  const res = app.register({
    submissionId: 'sub-tr3-b',
    project: { mode: 'existing', projectId: p1.projectId },
    items: [],
    relations: [{ sourceItemId: p1.itemIds[0], targetItemId: p1.itemIds[0], relationType: 'depends_on' }],
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('自己依存'));
});

test('T-R4. 同一送信内で Raw itemId Relation が重複すると validation_error', function () {
  const { app } = createHarness();
  app.setup();
  const p1 = app.register(makePayload({ submissionId: 'sub-tr4-a',
    items: [
      { draftKey: 'a', itemType: 'Task', title: 'A' },
      { draftKey: 'b', itemType: 'Task', title: 'B' },
    ] }));

  const res = app.register({
    submissionId: 'sub-tr4-b',
    project: { mode: 'existing', projectId: p1.projectId },
    items: [],
    relations: [
      { sourceItemId: p1.itemIds[0], targetItemId: p1.itemIds[1], relationType: 'depends_on' },
      { sourceItemId: p1.itemIds[0], targetItemId: p1.itemIds[1], relationType: 'depends_on' },
    ],
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('重複'));
});

test('T-R5. 既存 Relation と同じ組み合わせを再登録すると validation_error', function () {
  const { app } = createHarness();
  app.setup();
  const p1 = app.register(makePayload({ submissionId: 'sub-tr5-a',
    items: [
      { draftKey: 'a', itemType: 'Task', title: 'A' },
      { draftKey: 'b', itemType: 'Task', title: 'B' },
    ],
    relations: [{ sourceDraftKey: 'a', targetDraftKey: 'b', relationType: 'depends_on' }],
  }));
  assert.strictEqual(p1.ok, true);

  const res = app.register({
    submissionId: 'sub-tr5-b',
    project: { mode: 'existing', projectId: p1.projectId },
    items: [],
    relations: [{ sourceItemId: p1.itemIds[0], targetItemId: p1.itemIds[1], relationType: 'depends_on' }],
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, 'validation_error');
  assert.ok(res.message.includes('既存 Relation'));
});

test('T-R6. Raw itemId の正当な Relation は成功する', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const p1 = app.register(makePayload({ submissionId: 'sub-tr6-a',
    items: [
      { draftKey: 'a', itemType: 'Task', title: 'A' },
      { draftKey: 'b', itemType: 'Task', title: 'B' },
    ] }));

  const res = app.register({
    submissionId: 'sub-tr6-b',
    project: { mode: 'existing', projectId: p1.projectId },
    items: [],
    relations: [{ sourceItemId: p1.itemIds[0], targetItemId: p1.itemIds[1], relationType: 'depends_on' }],
  });
  assert.strictEqual(res.ok, true, 'valid raw-ID relation accepted');
  const rels = readRowsAsObjects(spreadsheet, SN.RELATIONS);
  assert.strictEqual(rels.length, 1);
  assert.strictEqual(rels[0].sourceItemId, p1.itemIds[0]);
  assert.strictEqual(rels[0].targetItemId, p1.itemIds[1]);
});

// ==================================================================
// T-L: v3ListProjects — phantom Project isolation
// ==================================================================

test('T-L1. v3ListProjects: 手動タイプ ID の phantom Project を含めない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const p1 = app.register(makePayload({ submissionId: 'sub-tl1-a',
    project: { mode: 'new', projectName: 'Real', shareTitle: 'Real-share', status: '進行中', priority: '次に' },
    items: [] }));

  // Add a phantom row: ID + name but no createdAt.
  const projSheet = spreadsheet.getSheetByName(SN.PROJECTS);
  const hm = sandbox.V3Schema.resolveHeaderMap(projSheet);
  const nextRow = projSheet.getLastRow() + 1;
  projSheet.getRange(nextRow, hm.projectId).setValue('PPM-P-8888');
  projSheet.getRange(nextRow, hm.projectName).setValue('Phantom');

  const list = app.listProjects();
  assert.strictEqual(list.length, 1, 'phantom project excluded');
  assert.strictEqual(list[0].projectId, p1.projectId, 'only real project returned');
});

test('T-L2. v3ListProjects: active=FALSE は除外される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const active = app.register(makePayload({ submissionId: 'sub-tl2-a',
    project: { mode: 'new', projectName: 'ActiveP', shareTitle: 'A', status: '進行中', priority: '次に' },
    items: [] }));
  const other = app.register(makePayload({ submissionId: 'sub-tl2-b',
    project: { mode: 'new', projectName: 'ToDeactivate', shareTitle: 'D', status: '進行中', priority: '次に' },
    items: [] }));
  assert.strictEqual(active.ok, true);
  assert.strictEqual(other.ok, true);

  // Manually flip active=FALSE (registration does not offer this; simulating a
  // Phase 1B lifecycle op).
  const projSheet = spreadsheet.getSheetByName(SN.PROJECTS);
  const hm = sandbox.V3Schema.resolveHeaderMap(projSheet);
  const otherRow = sandbox.V3Schema.findRowById(projSheet, 'projectId', other.projectId);
  projSheet.getRange(otherRow, hm.active).setValue('FALSE');

  const list = app.listProjects();
  const listIds = list.map((p) => p.projectId);
  assert.ok(listIds.includes(active.projectId), 'active project listed');
  assert.ok(!listIds.includes(other.projectId), 'active=FALSE project not listed');
});

// ==================================================================
// T-16: Dashboard aggregation
// ==================================================================

test('T-16. rebuildDashboard: KPI 集計と Project 別行が反映される', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  const nowMs = new Date('2026-08-10T10:00:00Z').getTime();
  const regA = app.register(makePayload({ submissionId: 'sub-t16-a',
    project: { mode: 'new', projectName: 'A', shareTitle: 'A-share', status: '進行中', priority: '今すぐ',
               dueDate: '2026-07-15' },
    items: [{ draftKey: 'a', itemType: 'Task', title: 'T', status: '作業中', dueDate: '2026-07-15' }] }));
  assert.strictEqual(regA.ok, true, 'reg A: ' + JSON.stringify(regA));
  app.register(makePayload({ submissionId: 'sub-t16-b',
    project: { mode: 'new', projectName: 'B', shareTitle: 'B-share', status: '完了', priority: '次に' },
    items: [] }));

  const res = app.rebuildDashboard({ now: nowMs });
  assert.strictEqual(res.ok, true);
  const dash = spreadsheet.getSheetByName(SN.DASHBOARD);
  const kpi = dash.getRange(5, 1, 1, 8).getValues()[0];
  assert.strictEqual(kpi[0], 1, 'inProgress = 1 (Project A)');
  assert.strictEqual(kpi[3], 1, 'red = 1');
  assert.strictEqual(kpi[5], 1, 'overdue = 1');
});

// ==================================================================
// T-17: SafeError catalog / Secret masking
// ==================================================================

test('T-17. SafeError catalog にない code は unknown_error に fallback', function () {
  const sandbox = loadSandbox();
  const err = sandbox.V3SafeError.make('made_up_code', 'detail');
  assert.strictEqual(err.code, 'unknown_error');
  assert.strictEqual(err.ok, false);
});

test('T-17b. Secret 形式文字列は masked', function () {
  const sandbox = loadSandbox();
  const masked = sandbox.V3SafeError.maskSensitive('token=ghp_' + 'A'.repeat(40) + ' after');
  assert.ok(!masked.includes('ghp_'), 'PAT masked: ' + masked);
  assert.ok(masked.includes('[MASKED]'), 'MASKED marker present');
});

test('T-17c. Registration validation エラーが Secret 形式を漏らさない', function () {
  const { app } = createHarness();
  app.setup();
  const res = app.register({
    submissionId: 'sub-t17',
    project: { mode: 'existing', projectId: 'PPM-P-9999' },
    items: [{ draftKey: 'x', itemType: 'Task', title: 'ghp_' + 'A'.repeat(40) }],
  });
  assert.strictEqual(res.ok, false);
  assert.ok(!res.message.includes('ghp_' + 'A'.repeat(40)), 'PAT literal not in message');
});

// ==================================================================
// T-18: GitHub / LLM が Phase 1A 基本動作に干渉しない
// ==================================================================

test('T-18a. 全ソースが外部HTTP呼び出しを一切持たない', function () {
  for (const f of sourceFiles) {
    const src = fs.readFileSync(path.join(srcDir, f), 'utf8');
    assert.ok(!src.includes('UrlFetchApp'), f + ' has no UrlFetchApp call');
    assert.ok(!src.includes('api.github.com'), f + ' does not hardcode an external API host');
    assert.ok(!src.includes('GITHUB_TOKEN'), f + ' does not reference GITHUB_TOKEN');
  }
});

test('T-18b. 全ソースが LLM API を参照しない', function () {
  for (const f of sourceFiles) {
    const src = fs.readFileSync(path.join(srcDir, f), 'utf8');
    const banned = ['OpenAI', 'Anthropic', 'callLLM', 'callLlm', 'invokeLLM', 'LLM_API_KEY'];
    for (const b of banned) assert.ok(!src.includes(b), f + ' does not reference ' + b);
  }
});

test('T-18c. main.js does not create triggers, does not set Script Properties', function () {
  const src = fs.readFileSync(path.join(srcDir, 'main.js'), 'utf8');
  assert.ok(!src.includes('newTrigger'), 'no trigger creation');
  assert.ok(!src.includes('deleteTrigger'), 'no trigger deletion');
  assert.ok(!src.includes('setProperty'), 'no property write');
});

test('T-18d. sync-controller.js only exports setup + rebuildDashboard', function () {
  const src = fs.readFileSync(path.join(srcDir, 'sync-controller.js'), 'utf8');
  assert.ok(src.includes('return {'), 'has return');
  assert.ok(src.includes('setup:'), 'exports setup');
  assert.ok(src.includes('rebuildDashboard:'), 'exports rebuildDashboard');
  assert.ok(!src.includes('setupTriggers'), 'no setupTriggers export');
});

// ==================================================================
// T-A: Activity ID uniqueness under same-second concurrency
// ==================================================================

test('T-A1. 同一秒内に生成された複数 Activity の ID がすべて異なる', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const reg = app.register(makePayload({ submissionId: 'sub-ta1',
    items: [
      { draftKey: 'a', itemType: 'Task', title: 'A' },
      { draftKey: 'b', itemType: 'Task', title: 'B' },
      { draftKey: 'c', itemType: 'Task', title: 'C' },
      { draftKey: 'd', itemType: 'Task', title: 'D' },
    ],
    relations: [{ sourceDraftKey: 'a', targetDraftKey: 'b', relationType: 'depends_on' }],
    decisions: [{ title: '判断1', type: '判断待ち', status: '未確認' }],
  }));
  assert.strictEqual(reg.ok, true);

  const activities = readRowsAsObjects(spreadsheet, SN.ACTIVITY);
  const ids = activities.map((a) => a.activityId).filter(Boolean);
  const uniq = new Set(ids);
  assert.strictEqual(uniq.size, ids.length, 'all Activity IDs unique');
  for (const id of ids) {
    assert.ok(/^A-\d{8}$/.test(id), 'Activity ID format A-########: ' + id);
  }
});

test('T-A2. onEdit Activity と registration Activity が同一秒内で衝突しない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const reg = app.register(makePayload({ submissionId: 'sub-ta2',
    items: [{ draftKey: 'a', itemType: 'Task', title: 'T', status: '未着手' }] }));
  const itemId = reg.itemIds[0];
  const itemSheet = spreadsheet.getSheetByName(SN.ITEMS);
  const headerMap = sandbox.V3Schema.resolveHeaderMap(itemSheet);
  let row = -1;
  for (let r = 2; r <= itemSheet.getLastRow(); r++) {
    if (itemSheet.getRange(r, headerMap.itemId).getValue() === itemId) { row = r; break; }
  }

  sandbox.onEdit(makeEditEvent(spreadsheet, SN.ITEMS, row, 'status', '未着手', '作業中'));
  sandbox.onEdit(makeEditEvent(spreadsheet, SN.ITEMS, row, 'priority', '', '今すぐ'));
  sandbox.onEdit(makeEditEvent(spreadsheet, SN.ITEMS, row, 'dueDate', '', '2026-09-30'));

  const activities = readRowsAsObjects(spreadsheet, SN.ACTIVITY);
  const ids = activities.map((a) => a.activityId);
  assert.strictEqual(new Set(ids).size, ids.length,
    'onEdit and registration Activity IDs all unique');
});

test('T-A3. Activity ID 採番失敗時に正本変更は成功扱いにならない (registration path)', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const origNext = sandbox.V3IdService.nextActivityId;
  sandbox.V3IdService.nextActivityId = function () { throw new Error('forced counter failure'); };
  const res = app.register(makePayload({ submissionId: 'sub-ta3' }));
  sandbox.V3IdService.nextActivityId = origNext;

  assert.strictEqual(res.ok, false, 'registration reported failure');
  const projRows = readRowsAsObjects(spreadsheet, SN.PROJECTS);
  assert.strictEqual(projRows.length, 0, 'project rolled back when Activity ID assignment failed');
});

test('T-A4. Activity ID counter は Workspace 単位で単調増加する', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const activitiesA = readRowsAsObjects(spreadsheet, SN.ACTIVITY);
  const setupId = activitiesA[0].activityId;
  assert.ok(/^A-\d{8}$/.test(setupId), 'setup Activity uses counter format');

  app.register(makePayload({ submissionId: 'sub-ta4-a' }));
  const activitiesB = readRowsAsObjects(spreadsheet, SN.ACTIVITY);
  const lastB = parseInt(activitiesB[activitiesB.length - 1].activityId.slice(2), 10);

  app.register(makePayload({ submissionId: 'sub-ta4-b' }));
  const activitiesC = readRowsAsObjects(spreadsheet, SN.ACTIVITY);
  const lastC = parseInt(activitiesC[activitiesC.length - 1].activityId.slice(2), 10);
  assert.ok(lastC > lastB, 'counter monotonically increases across registration bundles');
});

// ==================================================================
// Additional static isolation
// ==================================================================

test('T-STATIC-1. v3 sources are syntactically valid', function () {
  for (const f of sourceFiles) {
    const src = fs.readFileSync(path.join(srcDir, f), 'utf8');
    assert.doesNotThrow(() => { new Function(src); }, f + ' syntax ok');
  }
});

test('T-STATIC-2. 外部連携コードがリポジトリに存在しない', function () {
  // This demo ships no issue-tracker / provider integration at all: the files are
  // absent, not merely unloaded, so there is nothing to accidentally enable.
  const forbidden = ['github-client.js', 'github-provider.js', 'github-mapper.js',
                     'mock-provider.js'];
  const present = fs.readdirSync(srcDir);
  for (const f of forbidden) {
    assert.ok(!present.includes(f), f + ' must not exist in src/');
    assert.ok(!sourceFiles.includes(f), f + ' must not be in sourceFiles');
  }
  // src/ contains exactly the loadable sources plus the Sidebar HTML.
  const expected = sourceFiles.concat(['registration-form.html']).sort();
  assert.deepStrictEqual(present.slice().sort(), expected, 'src/ holds no extra files');
});

test('T-STATIC-3. registration-form.html exists and references v3 entry points', function () {
  const p = path.join(srcDir, 'registration-form.html');
  assert.ok(fs.existsSync(p), 'html exists');
  const src = fs.readFileSync(p, 'utf8');
  assert.ok(src.includes('v3RegisterProjectWithItems'), 'calls v3RegisterProjectWithItems');
  assert.ok(src.includes('v3ListProjects'), 'calls v3ListProjects');
  // Every server call the Sidebar makes must resolve to a function main.js defines.
  const mainSrc = fs.readFileSync(path.join(srcDir, 'main.js'), 'utf8');
  const called = new Set((src.match(/\.\s*(v3[A-Za-z0-9_]*)\s*\(/g) || [])
    .map((m) => m.replace(/[.\s(]/g, '')));
  assert.ok(called.size >= 2, 'sidebar calls at least the two v3 entry points');
  for (const fn of called) {
    assert.ok(new RegExp('function\\s+' + fn + '\\s*\\(').test(mainSrc),
      'main.js defines the entry point the Sidebar calls: ' + fn);
  }
});

test('T-DEMO-1. setupDemoData は本番登録経路のみを使い、再実行しても増殖しない', function () {
  const { app, spreadsheet, sandbox } = createHarness();
  app.setup();
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;

  const res = app.populateDemoData();
  assert.strictEqual(res.ok, true, 'demo data loaded: ' + (res.message || ''));
  assert.strictEqual(res.projectIds.length, 3, '3 synthetic projects');
  assert.strictEqual(res.idempotentCount, 0, 'first run writes for real');
  assert.strictEqual(res.dashboardOk, true, 'dashboard rebuilt after load');

  const projects = readRowsAsObjects(spreadsheet, SN.PROJECTS);
  const items = readRowsAsObjects(spreadsheet, SN.ITEMS);
  const decisions = readRowsAsObjects(spreadsheet, SN.DECISIONS);
  const relations = readRowsAsObjects(spreadsheet, SN.RELATIONS);
  assert.strictEqual(projects.length, 3);
  assert.strictEqual(items.length, res.itemIds.length);
  assert.ok(decisions.length > 0 && relations.length > 0, 'decisions and relations written');
  // Every row is official (ID + createdAt), i.e. it came through the Service.
  for (const p of projects) {
    assert.ok(/^PPM-P-\d{4}$/.test(p.projectId) && p.createdAt, 'project row is official');
  }
  for (const it of items) assert.ok(it.itemId && it.createdAt, 'item row is official');

  // Replay: same submissionIds + same payloads → idempotent, no new rows.
  const again = app.populateDemoData();
  assert.strictEqual(again.ok, true);
  assert.strictEqual(again.idempotentCount, 3, 'all three submissions replayed');
  assert.strictEqual(readRowsAsObjects(spreadsheet, SN.PROJECTS).length, 3, 'no duplicate projects');
  assert.strictEqual(readRowsAsObjects(spreadsheet, SN.ITEMS).length, items.length, 'no duplicate items');
});

test('T-DEMO-2. デモ基準日は初回投入で確定し、時計が進んでも replay のまま', function () {
  const { app, spreadsheet, sandbox } = createHarnessAt('2027-04-05');
  const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
  app.setup();

  // setup seeds the key empty; populate mints and persists the anchor.
  assert.strictEqual(sandbox.V3Schema.getSetting(spreadsheet, 'DEMO_ANCHOR_DATE'), '',
    'anchor starts empty after setup');
  const first = app.populateDemoData();
  assert.strictEqual(first.ok, true, 'first load: ' + (first.message || ''));
  assert.strictEqual(first.anchorDate, '2027-04-05', 'anchor is the load date');
  assert.strictEqual(sandbox.V3Schema.getSetting(spreadsheet, 'DEMO_ANCHOR_DATE'), '2027-04-05',
    'anchor persisted to 90_設定');

  const items = readRowsAsObjects(spreadsheet, SN.ITEMS);
  const apiItem = items.find((i) => i.title === 'API実装' && i.projectId === first.projectIds[0]);
  assert.strictEqual(apiItem.dueDate, '2027-04-03', 'dates are offsets from the anchor');

  // Move the clock forward and re-run the menu item. The anchor does NOT move, so
  // the payload hash is unchanged: replay, not payload_mismatch, not a duplicate.
  for (const later of ['2027-04-06', '2028-01-01', '2031-09-30']) {
    setClock(sandbox, later + 'T10:00:00Z');
    const again = app.populateDemoData();
    assert.strictEqual(again.ok, true, later + ' re-run ok: ' + (again.code || ''));
    assert.strictEqual(again.code, null, later + ' produced no safe error');
    assert.strictEqual(again.anchorDate, '2027-04-05', later + ' reuses the stored anchor');
    assert.strictEqual(again.idempotentCount, 3, later + ' replayed all three submissions');
  }
  assert.strictEqual(readRowsAsObjects(spreadsheet, SN.PROJECTS).length, 3, 'still 3 projects');
  assert.strictEqual(readRowsAsObjects(spreadsheet, SN.ITEMS).length, items.length, 'still no duplicate items');
  const ledger = readRowsAsObjects(spreadsheet, SN.REGISTRATION);
  assert.strictEqual(ledger.length, 3, 'ledger holds exactly one row per demo submission');
  for (const row of ledger) assert.strictEqual(row.state, 'committed', row.submissionId + ' committed');
});

test('T-DEMO-3. デモ投入時点がいつでも Red / Amber / Green が揃う', function () {
  // A fixed synthetic calendar would read as "everything overdue" once that year
  // passes. Load the demo on a fresh Spreadsheet at widely separated wall-clock
  // dates and assert the health mix the sample data is meant to show.
  for (const day of ['2026-08-14', '2027-06-30', '2029-11-20', '2035-01-01', '2040-06-30']) {
    const { app, spreadsheet, sandbox } = createHarnessAt(day);
    const SN = sandbox.AppV3.CONFIG.SHEET_NAMES;
    app.setup();
    const res = app.populateDemoData();
    assert.strictEqual(res.ok, true, day + ' load: ' + (res.message || ''));
    assert.strictEqual(res.dashboardOk, true, day + ' dashboard rebuilt');

    const health = {};
    for (const p of readRowsAsObjects(spreadsheet, SN.PROJECTS)) health[p.projectName] = p.health;
    assert.strictEqual(health['ECサイトリニューアル'], 'Red',   day + ': 遅延+ブロッカー案件は Red');
    assert.strictEqual(health['社内申請システム'],     'Amber', day + ': 判断待ちのみの案件は Amber');
    assert.strictEqual(health['在庫管理改善'],         'Green', day + ': 問題なしの案件は Green');

    // The Dashboard KPI row must show the same one-of-each split.
    const kpi = spreadsheet.getSheetByName(SN.DASHBOARD).getRange(5, 1, 1, 8).getValues()[0];
    assert.deepStrictEqual(kpi.slice(1, 4), [1, 1, 1], day + ': KPI Green/Amber/Red は 1/1/1');
    assert.strictEqual(kpi[5], 0, day + ': 期限超過 Project は 0（案件期限自体は未来）');
  }
});

test('T-STATIC-5. config exposes the required Phase 1A sheet, header, and enum surfaces', function () {
  const sandbox = loadSandbox();
  const CFG = sandbox.AppV3.CONFIG;
  assert.strictEqual(CFG.DISPLAY_SHEETS.length, 8, '表示 8');
  assert.strictEqual(CFG.ADMIN_SHEETS.length, 4, '管理 4');
  assert.strictEqual(CFG.ALL_SHEETS.length, 12, '合計 12');
  assert.strictEqual(CFG.PROJECT_HEADERS.length, 15);
  assert.strictEqual(CFG.ITEM_HEADERS.length, 22);
  assert.strictEqual(CFG.DECISION_HEADERS.length, 12);
  assert.strictEqual(CFG.RELATION_HEADERS.length, 8);
  assert.strictEqual(CFG.ACTIVITY_HEADERS.length, 12);
  assert.strictEqual(JSON.stringify(CFG.ITEM_STATUS_VALUES), JSON.stringify(['未着手', '作業中', '確認待ち', '完了', '対象外']));
  assert.strictEqual(JSON.stringify(CFG.PROJECT_STATUS_VALUES), JSON.stringify(['計画中', '進行中', '保留', '完了', '中止']));
  assert.strictEqual(JSON.stringify(CFG.ITEM_TYPE_VALUES), JSON.stringify(['Epic', 'Feature', 'Task', 'Subtask', 'Bug', 'Improvement']));
  assert.ok(CFG.ITEM_STATUS_VALUES.indexOf('ブロック中') === -1, 'ブロック中 must NOT be in item status');
});

test('T-STATIC-6. Script Property は PPM_V3_ 接頭辞のみ / 旧世代の接頭辞が残っていない', function () {
  function stripComments(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, function (_, p1) { return p1; });
  }
  for (const f of sourceFiles) {
    const src = stripComments(fs.readFileSync(path.join(srcDir, f), 'utf8'));
    const legacy = src.match(/\b[A-Z]{2,}_V[12]_/g);
    assert.ok(!legacy, f + ' code (non-comment) has no earlier-generation prefixes: ' + legacy);
    const props = src.match(/'[A-Z][A-Z0-9_]*_[A-Z0-9_]*'/g) || [];
    for (const p of props) {
      if (!p.includes('_V3_')) continue;
      assert.ok(p.startsWith("'PPM_V3_"), f + ' Script Property key uses the PPM_V3_ prefix: ' + p);
    }
  }
});

test('T-STATIC-7. Item TYPE prefix mapping is single-letter and complete', function () {
  const sandbox = loadSandbox();
  const map = sandbox.AppV3.CONFIG.ITEM_TYPE_ID_PREFIX;
  assert.deepStrictEqual(Object.keys(map).sort(), ['Bug', 'Epic', 'Feature', 'Improvement', 'Subtask', 'Task']);
  for (const k in map) {
    assert.strictEqual(map[k].length, 1, k + ' prefix is 1 char');
  }
});

test('T-STATIC-8. No secret literals in source files (light scan)', function () {
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js') || f.endsWith('.html'));
  const patterns = [
    /ghp_[A-Za-z0-9]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /AIza[A-Za-z0-9_-]{20,}/,
    /sk-[A-Za-z0-9]{40,}/,
    /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  ];
  for (const f of files) {
    const src = fs.readFileSync(path.join(srcDir, f), 'utf8');
    for (const p of patterns) {
      assert.ok(!p.test(src), f + ' contains secret-looking literal (' + p + ')');
    }
  }
});

test('T-STATIC-9. Snapshot artifacts fully removed', function () {
  const sandbox = loadSandbox();
  const CFG = sandbox.AppV3.CONFIG;
  assert.strictEqual(CFG.SHEET_NAMES.SNAPSHOTS, undefined, 'SHEET_NAMES.SNAPSHOTS gone');
  assert.strictEqual(CFG.SNAPSHOT_HEADERS, undefined, 'SNAPSHOT_HEADERS gone');
  assert.strictEqual(sandbox.V3Schema.writeSnapshot, undefined, 'writeSnapshot removed');
  assert.strictEqual(sandbox.V3Schema.readSnapshot, undefined, 'readSnapshot removed');
  assert.strictEqual(sandbox.V3Schema.findSnapshotByRowHint, undefined, 'findSnapshotByRowHint removed');
  assert.strictEqual(sandbox.V3Schema.snapshotFromRow, undefined, 'snapshotFromRow removed');
  for (const f of ['config.js', 'schema.js', 'registration-service.js', 'main.js', 'sync-controller.js']) {
    const src = fs.readFileSync(path.join(srcDir, f), 'utf8');
    assert.ok(!/94_構造スナップショット/.test(src),
      f + ' must not mention 94_構造スナップショット');
    assert.ok(!/writeSnapshot|readSnapshot|findSnapshotByRowHint|snapshotFromRow/.test(src),
      f + ' must not reference snapshot functions');
    assert.ok(!/SNAPSHOT_HEADERS|SHEET_NAMES\.SNAPSHOTS/.test(src),
      f + ' must not reference snapshot config');
  }
});

test('T-STATIC-10. 公開ドキュメントがコードと同じシート構成を説明している', function () {
  const doc = fs.readFileSync(path.join(rootDir, 'docs', 'architecture.md'), 'utf8');
  const sandbox = loadSandbox();
  const CFG = sandbox.AppV3.CONFIG;
  // The doc's sheet counts must not drift from the config that actually runs.
  assert.ok(doc.includes('表示 ' + CFG.DISPLAY_SHEETS.length), 'doc states the display sheet count');
  assert.ok(doc.includes('管理 ' + CFG.ADMIN_SHEETS.length), 'doc states the admin sheet count');
  assert.ok(doc.includes('合計 ' + CFG.ALL_SHEETS.length), 'doc states the total sheet count');
  // Every sheet the runtime creates is named in the doc.
  for (const name of CFG.ALL_SHEETS) {
    assert.ok(doc.includes(name), 'architecture.md documents sheet ' + name);
  }
  // Stub sheets must be labelled as stubs, never as shipped features.
  for (const name in CFG.STUB_SHEETS) {
    const line = doc.split('\n').find((l) => l.includes(name));
    assert.ok(line && /スタブ|未実装/.test(line), name + ' is marked as a stub in the doc');
  }
});

// ==================================================================
// Report
// ==================================================================
console.log('\n--- v3 Phase 1A Test Summary ---');
console.log('PASS: ' + passed);
console.log('FAIL: ' + failed);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  - ' + f.name + ': ' + f.err.message);
  process.exit(1);
}
