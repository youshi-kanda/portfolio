'use strict';

// Project Progress Manager Phase 1A schema layer: sheet initialization, header-name column resolution,
// low-level CRUD, activity logging, dashboard rebuild.
//
// Column indices are NEVER hardcoded elsewhere: all reads/writes go through
// resolveColumnIndex(sheet, headerName). Adding a column in a later phase means
// bumping SCHEMA_VERSION and rerunning setup; existing rows continue to work.
//
// Structural / auto columns are protected via sheet range protection so normal
// users cannot edit them from the UI. Snapshot is not part of Phase 1A; structural
// values are recovered from the canonical row itself and multi-cell paste against
// protected columns is prevented before it commits.

var V3Schema = (function () {
  var SN = V3_CONFIG.SHEET_NAMES;
  var UI = V3_CONFIG.UI_STYLE;

  // ---- Sheet definitions (order = physical order in the workspace tab bar). ----

  var SHEET_DEFS = [
    // Display sheets (visible, left-to-right).
    { name: SN.DASHBOARD,   kind: 'display', headers: null },
    { name: SN.PROJECTS,    kind: 'display', headers: V3_CONFIG.PROJECT_HEADERS },
    { name: SN.ITEMS,       kind: 'display', headers: V3_CONFIG.ITEM_HEADERS },
    { name: SN.BOARD,       kind: 'stub',    headers: null },
    { name: SN.ROADMAP,     kind: 'stub',    headers: null },
    { name: SN.DECISIONS,   kind: 'display', headers: V3_CONFIG.DECISION_HEADERS },
    { name: SN.AI_PROPOSAL, kind: 'stub',    headers: null },
    { name: SN.ACTIVITY,    kind: 'display', headers: V3_CONFIG.ACTIVITY_HEADERS },
    // Admin sheets (hidden).
    { name: SN.SETTINGS,    kind: 'admin',   headers: V3_CONFIG.SETTINGS_HEADERS },
    { name: SN.RELATIONS,   kind: 'admin',   headers: V3_CONFIG.RELATION_HEADERS },
    { name: SN.REGISTRATION,kind: 'admin',   headers: V3_CONFIG.REGISTRATION_HEADERS },
    { name: SN.COUNTERS,    kind: 'admin',   headers: V3_CONFIG.COUNTERS_HEADERS },
  ];

  // ---- Header-name-based column resolution. ----

  function resolveColumnIndex(sheet, headerName) {
    if (!sheet) return -1;
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] === headerName) return i + 1;
    }
    return -1;
  }

  function resolveHeaderMap(sheet) {
    if (!sheet) return {};
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var map = {};
    for (var i = 0; i < headers.length; i++) {
      if (headers[i]) map[headers[i]] = i + 1;
    }
    return map;
  }

  // ---- Setup. Idempotent: safe to re-run without losing data. ----

  function _ensureSheet(ss, name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    return sheet;
  }

  function _writeHeaderIfEmpty(sheet, headers) {
    if (!headers || !headers.length) return;
    var firstCell = sheet.getRange(1, 1).getValue();
    if (firstCell === '' || firstCell == null) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  function _initStubSheet(sheet, sheetName) {
    var msg = V3_CONFIG.STUB_SHEETS[sheetName] || 'Phase X で実装予定です。';
    var firstCell = sheet.getRange(1, 1).getValue();
    if (firstCell === '' || firstCell == null) {
      sheet.getRange(1, 1).setValue(msg);
      sheet.getRange(1, 1, 1, 1)
        .setBackground(UI.STUB_BG)
        .setFontColor(UI.STUB_FG)
        .setFontWeight('bold');
    }
  }

  function _initKeyValueDefaults(sheet, defaults) {
    // Only append missing keys; never overwrite existing values.
    var lastRow = sheet.getLastRow();
    var existing = {};
    for (var r = 2; r <= lastRow; r++) {
      var k = sheet.getRange(r, 1).getValue();
      if (k) existing[k] = true;
    }
    for (var i = 0; i < defaults.length; i++) {
      var row = defaults[i];
      if (existing[row[0]]) continue;
      var nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, 1, 3).setValues([row]);
    }
  }

  function _initDashboard(sheet) {
    if (sheet.getRange(1, 1).getValue()) return;
    sheet.getRange(1, 1).setValue('プロジェクト進捗管理');
    sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14);
    sheet.getRange(2, 1).setValue('最終同期');
    sheet.getRange(2, 2).setValue('(未同期)');
    sheet.getRange(4, 1, 1, 8).setValues([[
      '進行中Project数', 'Green', 'Amber', 'Red',
      '判断待ち', '期限超過', '本日更新', '直近完了',
    ]]).setFontWeight('bold').setBackground(UI.HEADER_BG).setFontColor(UI.HEADER_FG);
    sheet.getRange(5, 1, 1, 8).setValues([[0, 0, 0, 0, 0, 0, 0, 0]]);
    sheet.getRange(7, 1, 1, 9).setValues([[
      '優先順位', 'projectId', '表示名', '状況',
      '期限', '次の完成目標', 'Blocker', '判断待ち', '次にやること',
    ]]).setFontWeight('bold').setBackground(UI.HEADER_BG).setFontColor(UI.HEADER_FG);
  }

  function _applyDisplayUi(sheet, headers) {
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground(UI.HEADER_BG).setFontColor(UI.HEADER_FG).setFontWeight('bold');
  }

  function _applyValidation(sheet, colIndex, values) {
    if (colIndex < 1) return;
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, colIndex, UI.DATA_ROWS, 1).setDataValidation(rule);
  }

  // Strong protection for structural / auto columns. Only the Spreadsheet owner
  // (and Apps Script itself) can write; normal shared users cannot edit these
  // cells from the UI at all. Warning-only protection is insufficient because
  // it merely surfaces a dialog the user can dismiss.
  //
  // We tag descriptions with a stable prefix so re-running setup does not stack
  // duplicate protections. Owner-driven manual protection removal is out of scope
  // (owner-level operations are not protected against).
  var PROTECTION_TAG = 'v3-protect:';

  function _ensureProtection(sheet, cols, description) {
    if (!cols.length) return;
    var existing = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    var seen = {};
    for (var i = 0; i < existing.length; i++) {
      var desc = existing[i].getDescription() || '';
      if (desc.indexOf(PROTECTION_TAG) === 0) seen[desc] = true;
    }
    for (var j = 0; j < cols.length; j++) {
      var tag = PROTECTION_TAG + description + ':' + cols[j];
      if (seen[tag]) continue;
      sheet.getRange(2, cols[j], UI.DATA_ROWS, 1)
        .protect()
        .setDescription(tag)
        .setWarningOnly(false);
    }
  }

  function _applyHealthConditionalFormat(sheet, colIndex) {
    if (colIndex < 1) return;
    var range = sheet.getRange(2, colIndex, UI.DATA_ROWS, 1);
    var rules = [
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('Green').setBackground(UI.GREEN_BG).setFontColor(UI.GREEN_FG)
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('Amber').setBackground(UI.AMBER_BG).setFontColor(UI.AMBER_FG)
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('Red').setBackground(UI.RED_BG).setFontColor(UI.RED_FG)
        .setRanges([range]).build(),
    ];
    sheet.setConditionalFormatRules(rules);
  }

  function _columnsFor(sheet, headerNames) {
    var out = [];
    for (var i = 0; i < headerNames.length; i++) {
      var c = resolveColumnIndex(sheet, headerNames[i]);
      if (c > 0) out.push(c);
    }
    return out;
  }

  // Every column not in the direct-edit allowlist is protected.
  function _protectedHeadersFor(allHeaders, allowedHeaders) {
    var allowSet = {};
    for (var i = 0; i < allowedHeaders.length; i++) allowSet[allowedHeaders[i]] = true;
    var out = [];
    for (var j = 0; j < allHeaders.length; j++) {
      if (!allowSet[allHeaders[j]]) out.push(allHeaders[j]);
    }
    return out;
  }

  function _setupSheetUi(ss) {
    // Hide admin sheets. Stubs remain visible with guidance.
    for (var i = 0; i < V3_CONFIG.ADMIN_SHEETS.length; i++) {
      var s = ss.getSheetByName(V3_CONFIG.ADMIN_SHEETS[i]);
      if (s) s.hideSheet();
    }

    var projects = ss.getSheetByName(SN.PROJECTS);
    if (projects) {
      _applyDisplayUi(projects, V3_CONFIG.PROJECT_HEADERS);
      _applyValidation(projects, resolveColumnIndex(projects, 'status'), V3_CONFIG.PROJECT_STATUS_VALUES);
      _applyValidation(projects, resolveColumnIndex(projects, 'priority'), V3_CONFIG.PRIORITY_VALUES);
      _applyValidation(projects, resolveColumnIndex(projects, 'active'), V3_CONFIG.ACTIVE_VALUES);
      _ensureProtection(projects,
        _columnsFor(projects, _protectedHeadersFor(V3_CONFIG.PROJECT_HEADERS, V3_CONFIG.PROJECT_DIRECT_EDIT_COLS)),
        'Project 構造/自動列');
      _applyHealthConditionalFormat(projects, resolveColumnIndex(projects, 'health'));
    }

    var items = ss.getSheetByName(SN.ITEMS);
    if (items) {
      _applyDisplayUi(items, V3_CONFIG.ITEM_HEADERS);
      _applyValidation(items, resolveColumnIndex(items, 'status'),   V3_CONFIG.ITEM_STATUS_VALUES);
      _applyValidation(items, resolveColumnIndex(items, 'itemType'), V3_CONFIG.ITEM_TYPE_VALUES);
      _applyValidation(items, resolveColumnIndex(items, 'phase'),    V3_CONFIG.ITEM_PHASE_VALUES);
      _applyValidation(items, resolveColumnIndex(items, 'priority'), V3_CONFIG.PRIORITY_VALUES);
      _applyValidation(items, resolveColumnIndex(items, 'active'),   V3_CONFIG.ACTIVE_VALUES);
      _ensureProtection(items,
        _columnsFor(items, _protectedHeadersFor(V3_CONFIG.ITEM_HEADERS, V3_CONFIG.ITEM_DIRECT_EDIT_COLS)),
        'Item 構造/自動列');
    }

    var decisions = ss.getSheetByName(SN.DECISIONS);
    if (decisions) {
      _applyDisplayUi(decisions, V3_CONFIG.DECISION_HEADERS);
      _applyValidation(decisions, resolveColumnIndex(decisions, 'status'), V3_CONFIG.DECISION_STATUS_VALUES);
      _applyValidation(decisions, resolveColumnIndex(decisions, 'type'),   V3_CONFIG.DECISION_TYPE_VALUES);
      _ensureProtection(decisions,
        _columnsFor(decisions, _protectedHeadersFor(V3_CONFIG.DECISION_HEADERS, V3_CONFIG.DECISION_DIRECT_EDIT_COLS)),
        'Decision 構造/自動列');
    }

    var activity = ss.getSheetByName(SN.ACTIVITY);
    if (activity) {
      _applyDisplayUi(activity, V3_CONFIG.ACTIVITY_HEADERS);
      _ensureProtection(activity, _columnsFor(activity, V3_CONFIG.ACTIVITY_HEADERS), 'Activity 全列');
    }

    var relations = ss.getSheetByName(SN.RELATIONS);
    if (relations) {
      _applyDisplayUi(relations, V3_CONFIG.RELATION_HEADERS);
      _applyValidation(relations, resolveColumnIndex(relations, 'relationType'), V3_CONFIG.RELATION_TYPE_VALUES);
      _applyValidation(relations, resolveColumnIndex(relations, 'active'),       V3_CONFIG.ACTIVE_VALUES);
    }
  }

  function setupAllSheets(ss) {
    // Create sheets in DISPLAY order first (so tab order matches), then admin.
    for (var i = 0; i < SHEET_DEFS.length; i++) {
      var def = SHEET_DEFS[i];
      var sheet = _ensureSheet(ss, def.name);
      if (def.kind === 'stub') {
        _initStubSheet(sheet, def.name);
      } else if (def.headers) {
        _writeHeaderIfEmpty(sheet, def.headers);
      }
    }

    // Initialize key-value sheets.
    var settings = ss.getSheetByName(SN.SETTINGS);
    if (settings) _initKeyValueDefaults(settings, V3_CONFIG.SETTINGS_DEFAULTS);
    var counters = ss.getSheetByName(SN.COUNTERS);
    if (counters) _initKeyValueDefaults(counters, V3_CONFIG.COUNTERS_DEFAULTS);

    var dashboard = ss.getSheetByName(SN.DASHBOARD);
    if (dashboard) _initDashboard(dashboard);

    _setupSheetUi(ss);
    setSetting(ss, V3_CONFIG.SETTINGS_KEYS.LAST_SETUP_AT, new Date().toISOString());
  }

  // ---- Row CRUD ----

  function readDataRows(sheet) {
    if (!sheet) return [];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    return values.filter(function (row) {
      return row.some(function (c) { return c !== '' && c != null; });
    });
  }

  function appendRow(sheet, values) {
    var nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, 1, values.length).setValues([values]);
    return nextRow;
  }

  function writeCell(sheet, rowNum, headerName, value) {
    var col = resolveColumnIndex(sheet, headerName);
    if (col < 1) throw new Error('unknown header: ' + headerName);
    sheet.getRange(rowNum, col).setValue(value);
  }

  function readCell(sheet, rowNum, headerName) {
    var col = resolveColumnIndex(sheet, headerName);
    if (col < 1) return null;
    return sheet.getRange(rowNum, col).getValue();
  }

  // Build a row array whose length matches the header row. valuesByHeader maps
  // header names to values; unknown headers are ignored, missing headers get ''.
  function buildRow(sheet, valuesByHeader) {
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var row = new Array(headers.length);
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      row[i] = (h && valuesByHeader.hasOwnProperty(h)) ? valuesByHeader[h] : '';
    }
    return row;
  }

  // Find the row number for a given id column. Returns -1 if not found.
  function findRowById(sheet, headerName, idValue) {
    if (!sheet) return -1;
    var col = resolveColumnIndex(sheet, headerName);
    if (col < 1) return -1;
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r, col).getValue() === idValue) return r;
    }
    return -1;
  }

  // Locate a row only if it is an OFFICIAL entity — meaning its createdAt column
  // is populated. The registration Service fills createdAt atomically with the
  // ID; a human who hand-types an ID into a blank row will NOT satisfy this.
  // Use this to prevent references to synthesized IDs.
  function findOfficialRowById(sheet, headerName, idValue) {
    var row = findRowById(sheet, headerName, idValue);
    if (row < 0) return -1;
    var createdAt = readCell(sheet, row, 'createdAt');
    if (createdAt === '' || createdAt == null) return -1;
    return row;
  }

  // ---- 90_設定 key/value helpers ----

  function getSetting(ss, key) {
    var sheet = ss.getSheetByName(SN.SETTINGS);
    if (!sheet) return null;
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r, 1).getValue() === key) {
        return sheet.getRange(r, 2).getValue();
      }
    }
    return null;
  }

  function setSetting(ss, key, value, description) {
    var sheet = ss.getSheetByName(SN.SETTINGS);
    if (!sheet) return;
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r, 1).getValue() === key) {
        sheet.getRange(r, 2).setValue(value);
        return;
      }
    }
    appendRow(sheet, [key, value, description || '']);
  }

  function getThresholds(ss) {
    var t = {
      STALE_DAYS: V3_CONFIG.HEALTH_DEFAULTS.STALE_DAYS,
      DEADLINE_WARNING_DAYS: V3_CONFIG.HEALTH_DEFAULTS.DEADLINE_WARNING_DAYS,
      DECISION_OVERDUE_DAYS: V3_CONFIG.HEALTH_DEFAULTS.DECISION_OVERDUE_DAYS,
    };
    var s;
    s = getSetting(ss, 'STALE_DAYS');            if (typeof s === 'number') t.STALE_DAYS = s;
    s = getSetting(ss, 'DEADLINE_WARNING_DAYS'); if (typeof s === 'number') t.DEADLINE_WARNING_DAYS = s;
    s = getSetting(ss, 'DECISION_OVERDUE_DAYS'); if (typeof s === 'number') t.DECISION_OVERDUE_DAYS = s;
    return t;
  }

  // ---- 92_登録履歴 ----

  function findRegistration(ss, submissionId) {
    var sheet = ss.getSheetByName(SN.REGISTRATION);
    if (!sheet) return null;
    var row = findRowById(sheet, 'submissionId', submissionId);
    if (row < 0) return null;
    return {
      row: row,
      submissionId: readCell(sheet, row, 'submissionId'),
      payloadHash:  readCell(sheet, row, 'payloadHash'),
      state:        readCell(sheet, row, 'state'),
      projectId:    readCell(sheet, row, 'projectId'),
      projectRow:   readCell(sheet, row, 'projectRow'),
      itemIds:      readCell(sheet, row, 'itemIds'),
      itemStartRow: readCell(sheet, row, 'itemStartRow'),
      itemCount:    readCell(sheet, row, 'itemCount'),
      relationIds:  readCell(sheet, row, 'relationIds'),
      decisionIds:  readCell(sheet, row, 'decisionIds'),
      safeErrorCode:readCell(sheet, row, 'safeErrorCode'),
    };
  }

  function createRegistration(ss, opts) {
    var sheet = ss.getSheetByName(SN.REGISTRATION);
    if (!sheet) throw new Error('setup_required: 92_登録履歴が見つかりません');
    var now = new Date().toISOString();
    var row = buildRow(sheet, {
      submissionId: opts.submissionId,
      payloadHash: opts.payloadHash,
      state: 'received',
      createdAt: now,
      updatedAt: now,
    });
    return appendRow(sheet, row);
  }

  function updateRegistration(ss, rowNum, updates) {
    var sheet = ss.getSheetByName(SN.REGISTRATION);
    if (!sheet) return;
    var map = resolveHeaderMap(sheet);
    for (var key in updates) {
      if (map[key]) sheet.getRange(rowNum, map[key]).setValue(updates[key]);
    }
    if (map.updatedAt) sheet.getRange(rowNum, map.updatedAt).setValue(new Date().toISOString());
  }

  // ---- 07_活動履歴 append ----

  function appendActivity(ss, activity) {
    var sheet = ss.getSheetByName(SN.ACTIVITY);
    if (!sheet) throw new Error('setup_required: 07_活動履歴が見つかりません');
    var row = buildRow(sheet, {
      activityId:    activity.activityId,
      projectId:     activity.projectId || '',
      entityType:    activity.entityType || '',
      entityId:      activity.entityId || '',
      action:        activity.action || '',
      field:         activity.field || '',
      beforeValue:   activity.beforeValue == null ? '' : String(activity.beforeValue),
      afterValue:    activity.afterValue == null ? '' : String(activity.afterValue),
      actor:         activity.actor || '',
      reason:        V3SafeError.maskSensitive(String(activity.reason || '')),
      timestamp:     activity.timestamp || new Date().toISOString(),
      correlationId: activity.correlationId || '',
    });
    appendRow(sheet, row);
  }

  return {
    SHEET_DEFS: SHEET_DEFS,
    setupAllSheets: setupAllSheets,
    resolveColumnIndex: resolveColumnIndex,
    resolveHeaderMap: resolveHeaderMap,
    readDataRows: readDataRows,
    appendRow: appendRow,
    writeCell: writeCell,
    readCell: readCell,
    buildRow: buildRow,
    findRowById: findRowById,
    findOfficialRowById: findOfficialRowById,
    getSetting: getSetting,
    setSetting: setSetting,
    getThresholds: getThresholds,
    findRegistration: findRegistration,
    createRegistration: createRegistration,
    updateRegistration: updateRegistration,
    appendActivity: appendActivity,
  };
}());
