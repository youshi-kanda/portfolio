'use strict';

// Project Progress Manager — Phase 1 sync controller.
//
// Scope: manual "rebuild dashboard" only.
//   - Reads Projects / Items / Decisions from the canonical sheets
//   - Recomputes per-item health/stage/delayDays
//   - Rewrites the auto columns (health only for Project; item stage/health/delayDays if present)
//   - Rebuilds 00_共有ダッシュボード KPI + Project rows
//   - Records a single Activity row for the rebuild event
//
// Out of scope in this demo: external issue-tracker sync, LLM features, scheduled
// triggers, daily reports. No code for any of those ships in this repository.

var V3SyncController = (function () {
  var SN = V3_CONFIG.SHEET_NAMES;
  var UI = V3_CONFIG.UI_STYLE;

  function setup(ss) {
    try {
      V3Schema.setupAllSheets(ss);
      // Record the setup event as Activity. nextActivityId reads+increments the
      // shared ACTIVITY_LAST counter and MUST run under a script lock to prevent
      // ID collisions with concurrent registration / onEdit paths.
      try {
        V3IdService.withLock(LockService, function () {
          V3Schema.appendActivity(ss, {
            activityId:    V3IdService.nextActivityId(ss),
            projectId:     '',
            entityType:    'system',
            entityId:      '',
            action:        'setup',
            field:         'SCHEMA_VERSION',
            beforeValue:   '',
            afterValue:    V3_CONFIG.SCHEMA_VERSION,
            actor:         'setup',
            reason:        '初期セットアップ実行',
            timestamp:     new Date().toISOString(),
            correlationId: '',
          });
        });
      } catch (e) {
        // Activity failure during first-time setup means the Activity sheet itself is
        // missing/broken. Surface as setup failure so the operator investigates.
        return V3SafeError.make('activity_error', 'Activity 記録に失敗: ' + e.message);
      }
      return { ok: true, code: null, message: 'setup complete' };
    } catch (ex) {
      return V3SafeError.fromException(ex, 'unknown_error');
    }
  }

  function rebuildDashboard(ss, lockService, options) {
    var opts = options || {};
    var nowMs = opts.now || Date.now();

    var lock = lockService.getScriptLock();
    var got = lock.tryLock(V3_CONFIG.LOCK_TIMEOUT_MS);
    if (!got) return V3SafeError.make('concurrent_sync', 'Dashboard rebuild と競合しました');

    try {
      var projSheet = ss.getSheetByName(SN.PROJECTS);
      var itemSheet = ss.getSheetByName(SN.ITEMS);
      var decSheet  = ss.getSheetByName(SN.DECISIONS);
      var dashSheet = ss.getSheetByName(SN.DASHBOARD);
      if (!projSheet || !itemSheet || !decSheet || !dashSheet) {
        return V3SafeError.make('setup_required', '初期セットアップが未完了です');
      }

      var thresholds = V3Schema.getThresholds(ss);
      var projects = _readProjects(projSheet);
      var items    = _readItems(itemSheet);
      var decisions = _readDecisions(decSheet);

      // Update per-project derived fields.
      var itemsByProject = _groupBy(items, 'projectId');
      var decisionsByProject = _groupBy(decisions, 'projectId');
      var updatedProjects = 0;

      for (var i = 0; i < projects.length; i++) {
        var pj = projects[i];
        if (!pj.projectId || pj.active === 'FALSE') continue;
        var itsInProj = itemsByProject[pj.projectId] || [];
        var pendingDecs = (decisionsByProject[pj.projectId] || []).filter(function (d) {
          return d.status !== '回答済み' && d.status !== '不要';
        });

        // Recompute item health first so we can aggregate.
        var itemHealthList = [];
        for (var k = 0; k < itsInProj.length; k++) {
          var it = itsInProj[k];
          if (it.active === 'FALSE') continue;
          var itemDecs = pendingDecs.filter(function (d) { return d.itemId === it.itemId; });
          var h = V3Engine.computeItemHealth(it, itemDecs, thresholds, nowMs);
          itemHealthList.push(h.health);
        }
        var projStage  = V3Engine.computeProjectStage(pj.status, itsInProj);
        var projHealth = V3Engine.computeProjectHealth(pj.status, itemHealthList);

        // Only Project.health is a stored auto column in Phase 1. Write it.
        V3Schema.writeCell(projSheet, pj._row, 'health', projHealth);
        V3Schema.writeCell(projSheet, pj._row, 'updatedAt', new Date().toISOString());
        pj.health = projHealth;
        pj._stage = projStage;
        pj._pendingCount = pendingDecs.length;
        updatedProjects++;
      }

      _renderDashboard(dashSheet, projects, decisions, items, nowMs);

      V3Schema.setSetting(ss, V3_CONFIG.SETTINGS_KEYS.LAST_DASHBOARD_REBUILD_AT, new Date(nowMs).toISOString());

      // Activity record for the rebuild event.
      try {
        V3Schema.appendActivity(ss, {
          activityId:    V3IdService.nextActivityId(ss),
          projectId:     '',
          entityType:    'system',
          entityId:      '',
          action:        'dashboard_rebuild',
          field:         '',
          beforeValue:   '',
          afterValue:    String(updatedProjects) + ' projects',
          actor:         'dashboard',
          reason:        '手動 Dashboard 更新',
          timestamp:     new Date(nowMs).toISOString(),
          correlationId: '',
        });
      } catch (e) {
        // Rebuild already updated Project.health; Activity failure means the log is
        // inconsistent but the operator sees this in the returned safe error.
        return V3SafeError.make('activity_error', 'Activity 記録に失敗: ' + e.message);
      }

      return { ok: true, code: null, updatedProjects: updatedProjects };
    } catch (ex) {
      return V3SafeError.fromException(ex, 'dashboard_error');
    } finally {
      lock.releaseLock();
    }
  }

  // ---- Readers: return array of {header: value, _row} objects. ----

  function _readSheetAsObjects(sheet, headers, idHeader) {
    if (!sheet) return [];
    var rows = V3Schema.readDataRows(sheet);
    var lastCol = Math.max(sheet.getLastColumn(), headers.length);
    var actualHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var out = [];
    // Recompute row numbers by iterating through the full data area.
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      var raw = sheet.getRange(r, 1, 1, lastCol).getValues()[0];
      var hasValue = raw.some(function (c) { return c !== '' && c != null; });
      if (!hasValue) continue;
      var obj = { _row: r };
      for (var c = 0; c < actualHeaders.length; c++) {
        if (actualHeaders[c]) obj[actualHeaders[c]] = raw[c];
      }
      // Dashboard/aggregation MUST see only official entities.
      // An official row has both its ID and createdAt populated (registration Service
      // writes them atomically; hand-typed IDs cannot satisfy this).
      if (idHeader) {
        var idVal = obj[idHeader];
        if (idVal === '' || idVal == null) continue;
        if (obj.createdAt === '' || obj.createdAt == null) continue;
      }
      out.push(obj);
    }
    return out;
  }

  function _readProjects(sheet)  { return _readSheetAsObjects(sheet, V3_CONFIG.PROJECT_HEADERS, 'projectId'); }
  function _readItems(sheet)     { return _readSheetAsObjects(sheet, V3_CONFIG.ITEM_HEADERS, 'itemId'); }
  function _readDecisions(sheet) { return _readSheetAsObjects(sheet, V3_CONFIG.DECISION_HEADERS, 'decisionId'); }

  function _groupBy(list, key) {
    var out = {};
    for (var i = 0; i < list.length; i++) {
      var k = list[i][key];
      if (!k) continue;
      if (!out[k]) out[k] = [];
      out[k].push(list[i]);
    }
    return out;
  }

  function _renderDashboard(sheet, projects, decisions, items, nowMs) {
    var today = new Date(nowMs); today.setHours(0, 0, 0, 0);
    var todayMs = today.getTime();
    var sevenDaysAgoMs = todayMs - 7 * V3_CONFIG.MS_PER_DAY;

    var inProgress = 0, green = 0, amber = 0, red = 0;
    var pendingTotal = 0, overdue = 0, todayUpdated = 0, recentDone = 0;

    var itemsByProject = _groupBy(items, 'projectId');

    // Project row array.
    var rows = [];
    for (var i = 0; i < projects.length; i++) {
      var pj = projects[i];
      if (!pj.projectId) continue;

      var active = pj.active !== 'FALSE';
      var inProgressStatus = (pj.status === '進行中' || pj.status === '計画中');
      if (active && inProgressStatus) inProgress++;
      if (pj.health === 'Green') green++;
      if (pj.health === 'Amber') amber++;
      if (pj.health === 'Red')   red++;

      var pjDecisions = decisions.filter(function (d) {
        return d.projectId === pj.projectId && d.status !== '回答済み' && d.status !== '不要';
      });
      pendingTotal += pjDecisions.length;

      if (pj.dueDate) {
        var dueMs = new Date(pj.dueDate).getTime();
        if (!isNaN(dueMs) && dueMs < nowMs && pj.status !== '完了' && pj.status !== '中止') overdue++;
      }
      if (pj.updatedAt) {
        var u = new Date(pj.updatedAt).getTime();
        if (!isNaN(u) && u >= todayMs) todayUpdated++;
      }
      // Count items completed in the last 7 days within this project.
      var itemsHere = itemsByProject[pj.projectId] || [];
      for (var ii = 0; ii < itemsHere.length; ii++) {
        if (itemsHere[ii].status !== '完了') continue;
        if (!itemsHere[ii].updatedAt) continue;
        var iu = new Date(itemsHere[ii].updatedAt).getTime();
        if (!isNaN(iu) && iu >= sevenDaysAgoMs) recentDone++;
      }

      // First pending decision title as "blocker snippet" for the row.
      var blockerText = '';
      if (pjDecisions.length > 0) blockerText = String(pjDecisions[0].title || '');

      // Non-engineer-friendly stage label.
      var stageLabel = _stageDisplayLabel(pj._stage || V3Engine.computeProjectStage(pj.status, itemsHere));

      rows.push([
        pj.priority || '',
        pj.projectId,
        pj.shareTitle || pj.projectName || '',
        stageLabel,
        pj.dueDate || '',
        pj.nextMilestone || '',
        blockerText,
        pjDecisions.length,
        '',   // "次にやること" placeholder (Phase 4 で LLM が埋める)
      ]);
    }

    // Header + KPI area (rows 1-7) is preserved by setup; we only refresh values.
    sheet.getRange(2, 2).setValue(_formatTs(nowMs));
    sheet.getRange(5, 1, 1, 8).setValues([[inProgress, green, amber, red, pendingTotal, overdue, todayUpdated, recentDone]]);

    // Clear the previous project rows region and rewrite.
    var startRow = 8;
    var lastRow = sheet.getLastRow();
    if (lastRow >= startRow) {
      sheet.getRange(startRow, 1, lastRow - startRow + 1, 9).clearContent();
    }
    if (rows.length > 0) {
      sheet.getRange(startRow, 1, rows.length, 9).setValues(rows);
    }
  }

  function _stageDisplayLabel(stage) {
    // Non-engineer vocabulary: internal stage names are relabelled for shared views.
    var map = {
      '準備中':       '準備中',
      '作成予定':     '作成予定',
      '作成中':       '作成中',
      'レビュー中':   '内容確認中',
      '提供準備':     'テスト中',
      '提供済み':     '提供可能',
      '保留':         '保留',
      '中止':         '廃止',
    };
    return map[stage] || stage || '';
  }

  function _formatTs(ms) {
    var d = new Date(ms);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate())
      + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  return {
    setup: setup,
    rebuildDashboard: rebuildDashboard,
  };
}());
