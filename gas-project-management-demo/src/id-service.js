'use strict';

// Project Progress Manager ID service. Project-scoped IDs.
// ID contract:
//   Project ID:  PPM-P-####
//   Work Item:   <projectId>-<TYPE>-####   (10-step increments, TYPE ∈ {E,F,T,S,B,I})
//   Decision:    <projectId>-D-####
//   Relation:    REL-######
// IDs are never reused after delete. Counter storage: 93_採番カウンタ.
// All counter mutations happen under LockService.getScriptLock().tryLock(200).

var V3IdService = (function () {
  function _pad(n, width) {
    var s = String(n);
    while (s.length < width) s = '0' + s;
    return s;
  }

  function formatProjectId(n)      { return 'PPM-P-' + _pad(n, 4); }
  function formatItemId(projectId, typeCode, n) {
    return projectId + '-' + typeCode + '-' + _pad(n, 4);
  }
  function formatDecisionId(projectId, n) { return projectId + '-D-' + _pad(n, 4); }
  function formatRelationId(n)     { return 'REL-' + _pad(n, 6); }
  // Activity ID is a Workspace-wide monotonically
  // increasing counter, never reused. Second-precision timestamp + per-caller seq
  // (the pre-Amendment 2 scheme) collided when multiple Activities were emitted
  // in the same second across different call sites (registration + onEdit + rebuild).
  function formatActivityId(n) { return 'A-' + _pad(n, 8); }

  function itemTypePrefix(itemType) {
    var p = V3_CONFIG.ITEM_TYPE_ID_PREFIX[itemType];
    if (!p) throw new Error('unknown itemType: ' + itemType);
    return p;
  }

  // ---- Counter operations (assume the caller already holds a script lock). ----

  function nextProjectId(ss) {
    var current = _readCounter(ss, V3_CONFIG.COUNTER_KEYS.LAST_PROJECT_ID);
    var next = current + 1;
    _writeCounter(ss, V3_CONFIG.COUNTER_KEYS.LAST_PROJECT_ID, next, 'Project ID 発番カウンタ');
    return formatProjectId(next);
  }

  function nextItemId(ss, projectId, itemType) {
    var typeCode = itemTypePrefix(itemType);
    var key = V3_CONFIG.COUNTER_KEYS.ITEM_LAST_PREFIX + projectId + '_' + typeCode;
    var current = _readCounter(ss, key);
    var next = current + 10;
    _writeCounter(ss, key, next, projectId + ' ' + itemType + ' 連番');
    return formatItemId(projectId, typeCode, next);
  }

  function nextDecisionId(ss, projectId) {
    var key = V3_CONFIG.COUNTER_KEYS.DECISION_LAST_PREFIX + projectId;
    var current = _readCounter(ss, key);
    var next = current + 1;
    _writeCounter(ss, key, next, projectId + ' Decision 連番');
    return formatDecisionId(projectId, next);
  }

  function nextRelationId(ss) {
    var current = _readCounter(ss, V3_CONFIG.COUNTER_KEYS.RELATION_LAST);
    var next = current + 1;
    _writeCounter(ss, V3_CONFIG.COUNTER_KEYS.RELATION_LAST, next, 'Relation ID 連番');
    return formatRelationId(next);
  }

  function nextActivityId(ss) {
    var current = _readCounter(ss, V3_CONFIG.COUNTER_KEYS.ACTIVITY_LAST);
    var next = current + 1;
    _writeCounter(ss, V3_CONFIG.COUNTER_KEYS.ACTIVITY_LAST, next, 'Activity ID 連番');
    return formatActivityId(next);
  }

  // ---- Wrappers that acquire the lock. Use these from top-level entry points. ----

  function withLock(lockService, fn) {
    var lock = lockService.getScriptLock();
    var got = lock.tryLock(V3_CONFIG.LOCK_TIMEOUT_MS);
    if (!got) {
      throw { code: 'concurrent_sync', message: 'Could not acquire lock for ID assignment' };
    }
    try { return fn(); } finally { lock.releaseLock(); }
  }

  // ---- Counter storage: 93_採番カウンタ (key/value). ----

  function _readCounter(ss, key) {
    var sheet = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.COUNTERS);
    if (!sheet) throw new Error('setup_required: 93_採番カウンタが見つかりません');
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      var k = sheet.getRange(r, 1).getValue();
      if (k === key) {
        var v = sheet.getRange(r, 2).getValue();
        if (typeof v === 'number') return v;
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
      }
    }
    return 0;
  }

  function _writeCounter(ss, key, value, description) {
    var sheet = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.COUNTERS);
    if (!sheet) throw new Error('setup_required: 93_採番カウンタが見つかりません');
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      var k = sheet.getRange(r, 1).getValue();
      if (k === key) {
        sheet.getRange(r, 2).setValue(value);
        return;
      }
    }
    // Not found — append.
    var nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, 1, 3).setValues([[key, value, description || '']]);
  }

  return {
    formatProjectId: formatProjectId,
    formatItemId: formatItemId,
    formatDecisionId: formatDecisionId,
    formatRelationId: formatRelationId,
    formatActivityId: formatActivityId,
    itemTypePrefix: itemTypePrefix,
    nextProjectId: nextProjectId,
    nextItemId: nextItemId,
    nextDecisionId: nextDecisionId,
    nextRelationId: nextRelationId,
    nextActivityId: nextActivityId,
    withLock: withLock,
  };
}());
