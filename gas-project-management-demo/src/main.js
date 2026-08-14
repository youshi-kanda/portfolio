'use strict';

// Project Progress Manager — Phase 1A entry points.
// Menu: `進捗管理`
// Menu items:
//   - 初期セットアップ            → v3InitialSetup
//   - プロジェクト・タスクを登録  → v3ShowRegistrationForm (Sidebar)
//   - ダッシュボードを更新        → v3RebuildDashboard
//   - デモデータを投入            → v3SetupDemoData (portfolio demo only)
//
// No scheduled trigger, no external sync, no LLM.
// onEdit is an installable-simple trigger that records manual edits to allowlisted
// daily columns. Structural / auto columns are protected via sheet range protection
// so normal users cannot edit them; onEdit does not try to restore or clear values
// (multi-cell paste against protected cells is prevented before it commits).

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('進捗管理')
    .addItem('初期セットアップ', 'v3InitialSetup')
    .addItem('プロジェクト・タスクを登録', 'v3ShowRegistrationForm')
    .addItem('ダッシュボードを更新', 'v3RebuildDashboard')
    .addItem('デモデータを投入', 'v3SetupDemoData')
    .addToUi();
}

function v3InitialSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = V3SyncController.setup(ss);
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (_) { ui = null; }
  if (ui) {
    if (result.ok) ui.alert('初期セットアップ完了');
    else            ui.alert('セットアップエラー: ' + result.code + '\n' + (result.message || ''));
  }
  return result;
}

function v3ShowRegistrationForm() {
  var html = HtmlService.createHtmlOutputFromFile('src/registration-form')
    .setTitle('プロジェクト・タスクを登録')
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Server-side entry point called by the Sidebar form.
function v3RegisterProjectWithItems(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return V3RegistrationService.register(ss, LockService, payload);
}

// Server-side entry point for the Sidebar to enumerate existing Projects.
// Only official entities (projectId + createdAt populated, active != FALSE) are
// returned. Phantom rows caused by hand-typed IDs are excluded.
function v3ListProjects() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.PROJECTS);
  if (!sheet) return [];
  var rows = V3Schema.readDataRows(sheet);
  var idCol = V3Schema.resolveColumnIndex(sheet, 'projectId') - 1;
  var nameCol = V3Schema.resolveColumnIndex(sheet, 'projectName') - 1;
  var titleCol = V3Schema.resolveColumnIndex(sheet, 'shareTitle') - 1;
  var createdAtCol = V3Schema.resolveColumnIndex(sheet, 'createdAt') - 1;
  var activeCol = V3Schema.resolveColumnIndex(sheet, 'active') - 1;
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var pid = idCol >= 0 ? r[idCol] : '';
    if (pid === '' || pid == null) continue;
    var createdAt = createdAtCol >= 0 ? r[createdAtCol] : '';
    if (createdAt === '' || createdAt == null) continue;
    if (activeCol >= 0 && r[activeCol] === 'FALSE') continue;
    out.push({
      projectId: pid,
      projectName: (nameCol >= 0 ? r[nameCol] : '') || '',
      shareTitle: (titleCol >= 0 ? r[titleCol] : '') || '',
    });
  }
  return out;
}

function v3RebuildDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = V3SyncController.rebuildDashboard(ss, LockService);
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (_) { ui = null; }
  if (ui) {
    if (result.ok) ui.alert('ダッシュボードを更新しました（' + result.updatedProjects + ' Project）');
    else            ui.alert('更新エラー: ' + result.code + '\n' + (result.message || ''));
  }
  return result;
}

// Portfolio demo only: populate the workspace with fully synthetic sample data.
// Goes through the same registration Service as the Sidebar — no alternate write
// path — so what the demo shows is the production code path.
function v3SetupDemoData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = V3DemoData.populate(ss, LockService);
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch (_) { ui = null; }
  if (ui) {
    if (result.ok) {
      ui.alert('デモデータを投入しました（Project ' + result.projectIds.length + ' 件 / Item '
        + result.itemIds.length + ' 件）');
    } else {
      ui.alert('デモデータ投入エラー: ' + result.code + '\n' + (result.message || ''));
    }
  }
  return result;
}

// ---- onEdit: Phase 1A boundary. ----
//
// A row is treated as an OFFICIAL entity only when both its ID cell and its
// createdAt cell are non-empty — the registration Service fills both atomically;
// a human typing an ID into a blank cell (or pasting an ID range) cannot satisfy
// this criterion. Non-official rows are ignored.
//
// Formal-update contract:
//   * official row
//   * single-cell edit (numRows == 1 AND numCols == 1)
//   * edited column is in the per-sheet DIRECT_EDIT_COLS allowlist
//
// Multi-cell paste is NOT a formal update. onEdit does NOT clear structural cells,
// does NOT stamp updatedAt, does NOT emit an update Activity, and does NOT
// auto-stamp Decision.resolvedAt for a paste that happens to include status.
// Structural / auto columns are protected at the sheet level so normal users
// cannot land such a paste in the first place.
//
// Simple triggers run without full authorization; keep this small and side-effect-safe.

function onEdit(e) {
  if (!e || !e.range) return;
  try {
    _handleEdit(e);
  } catch (err) {
    // onEdit must not throw (the user's edit already committed).
    console.log('v3 onEdit best-effort failed: ' + (err && err.message ? err.message : String(err)));
  }
}

function _sheetEditProfile(sheetName) {
  if (sheetName === V3_CONFIG.SHEET_NAMES.PROJECTS) {
    return {
      idHeader:   'projectId',
      entityType: 'project',
      allowed:    V3_CONFIG.PROJECT_DIRECT_EDIT_COLS,
    };
  }
  if (sheetName === V3_CONFIG.SHEET_NAMES.ITEMS) {
    return {
      idHeader:   'itemId',
      entityType: 'item',
      allowed:    V3_CONFIG.ITEM_DIRECT_EDIT_COLS,
    };
  }
  if (sheetName === V3_CONFIG.SHEET_NAMES.DECISIONS) {
    return {
      idHeader:   'decisionId',
      entityType: 'decision',
      allowed:    V3_CONFIG.DECISION_DIRECT_EDIT_COLS,
    };
  }
  return null;
}

function _headerNameForCol(headerMap, col) {
  for (var name in headerMap) {
    if (headerMap[name] === col) return name;
  }
  return null;
}

// Generate an Activity ID under a lock so onEdit invocations don't collide with
// registration transactions on the shared ACTIVITY_LAST counter. onEdit is
// best-effort: if the lock is unavailable we skip the Activity write rather than
// blocking or duplicating the ID.
function _tryNextActivityId(ss) {
  try {
    return V3IdService.withLock(LockService, function () {
      return V3IdService.nextActivityId(ss);
    });
  } catch (err) {
    console.log('v3 onEdit activity ID lock failed: ' + (err && err.message ? err.message : String(err)));
    return null;
  }
}

function _handleEdit(e) {
  var sheet = e.range.getSheet();
  var profile = _sheetEditProfile(sheet.getName());
  if (!profile) return;

  var row = e.range.getRow();
  if (row < 2) return; // header row
  var col = e.range.getColumn();
  var numRows = (typeof e.range.getNumRows === 'function') ? e.range.getNumRows() : 1;
  var numCols = (typeof e.range.getNumColumns === 'function') ? e.range.getNumColumns() : 1;

  // Phase 1A: multi-cell edits are out of scope. Do nothing — no restore, no
  // clear, no updatedAt, no Activity. Protection prevents this from touching
  // structural / auto columns; if it lands on allowlist columns only, we still
  // do not treat it as a formal update.
  if (numRows > 1 || numCols > 1) return;

  var headerMap = V3Schema.resolveHeaderMap(sheet);
  var headerName = _headerNameForCol(headerMap, col);
  if (!headerName) return;

  var ss = e.source || SpreadsheetApp.getActiveSpreadsheet();

  // Determine officiality from the ID + createdAt pair. The ID cell is a
  // structural / auto column so its value in the sheet is the pre-edit value
  // (protection stopped any UI-side attempt to change it, and this is a
  // single-cell edit against an allowlist column so ID cannot have changed).
  var idBefore = V3Schema.readCell(sheet, row, profile.idHeader);
  if (idBefore === '' || idBefore == null) return;
  var createdAt = V3Schema.readCell(sheet, row, 'createdAt');
  if (createdAt === '' || createdAt == null) return;

  // Only allowlisted columns are treated as formal updates.
  if (profile.allowed.indexOf(headerName) === -1) return;

  var entityId = idBefore;
  var projectId = '';
  if (profile.entityType === 'project') {
    projectId = entityId;
  } else {
    var p = V3Schema.readCell(sheet, row, 'projectId');
    projectId = (p == null) ? '' : p;
  }

  // Bump updatedAt.
  if (headerMap.updatedAt) {
    sheet.getRange(row, headerMap.updatedAt).setValue(new Date().toISOString());
  }
  // Decision auto-resolve on status → 回答済み / 不要 (single-cell only).
  if (profile.entityType === 'decision' && headerName === 'status') {
    var newVal = (e.value == null) ? sheet.getRange(row, col).getValue() : e.value;
    if (newVal === '回答済み' || newVal === '不要') {
      if (headerMap.resolvedAt) {
        sheet.getRange(row, headerMap.resolvedAt).setValue(new Date().toISOString());
      }
    }
  }

  var updateActivityId = _tryNextActivityId(ss);
  if (updateActivityId) {
    try {
      V3Schema.appendActivity(ss, {
        activityId:    updateActivityId,
        projectId:     projectId,
        entityType:    profile.entityType,
        entityId:      entityId,
        action:        'update',
        field:         headerName,
        beforeValue:   (e.oldValue == null) ? '' : String(e.oldValue),
        afterValue:    (e.value == null) ? '' : String(e.value),
        actor:         'human',
        reason:        '',
        timestamp:     new Date().toISOString(),
        correlationId: '',
      });
    } catch (err) {
      console.log('v3 onEdit activity append failed: ' + (err && err.message ? err.message : String(err)));
    }
  }
}

// ---- Test-only injection API. ----
// Lets the test harness drive the same code paths against a fake Spreadsheet /
// LockService. Not called at runtime by triggers or menus.
var AppV3 = {
  createApp: function (deps) {
    var spreadsheet = deps.spreadsheet;
    var lockService = deps.lockService;
    return {
      setup: function ()               { return V3SyncController.setup(spreadsheet); },
      register: function (payload)     { return V3RegistrationService.register(spreadsheet, lockService, payload); },
      rebuildDashboard: function (opts){ return V3SyncController.rebuildDashboard(spreadsheet, lockService, opts); },
      listProjects: function ()        { return _v3ListProjectsFrom(spreadsheet); },
      populateDemoData: function ()    { return V3DemoData.populate(spreadsheet, lockService); },
      get spreadsheet()  { return spreadsheet; },
      get lockService()  { return lockService; },
      idService: {
        nextProjectId: function () { return V3IdService.nextProjectId(spreadsheet); },
        nextItemId: function (pid, type) { return V3IdService.nextItemId(spreadsheet, pid, type); },
      },
    };
  },
  CONFIG: V3_CONFIG,
};

// Internal helper mirroring v3ListProjects but taking an explicit spreadsheet.
// Kept out of the global v3ListProjects entry point so the runtime API stays
// tied to the active spreadsheet, while tests inject a Fake spreadsheet.
function _v3ListProjectsFrom(ss) {
  var sheet = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.PROJECTS);
  if (!sheet) return [];
  var rows = V3Schema.readDataRows(sheet);
  var idCol = V3Schema.resolveColumnIndex(sheet, 'projectId') - 1;
  var nameCol = V3Schema.resolveColumnIndex(sheet, 'projectName') - 1;
  var titleCol = V3Schema.resolveColumnIndex(sheet, 'shareTitle') - 1;
  var createdAtCol = V3Schema.resolveColumnIndex(sheet, 'createdAt') - 1;
  var activeCol = V3Schema.resolveColumnIndex(sheet, 'active') - 1;
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var pid = idCol >= 0 ? r[idCol] : '';
    if (pid === '' || pid == null) continue;
    var createdAt = createdAtCol >= 0 ? r[createdAtCol] : '';
    if (createdAt === '' || createdAt == null) continue;
    if (activeCol >= 0 && r[activeCol] === 'FALSE') continue;
    out.push({
      projectId: pid,
      projectName: (nameCol >= 0 ? r[nameCol] : '') || '',
      shareTitle: (titleCol >= 0 ? r[titleCol] : '') || '',
    });
  }
  return out;
}
