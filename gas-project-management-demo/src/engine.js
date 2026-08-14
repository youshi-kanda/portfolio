'use strict';

// Project Progress Manager deterministic algorithms for stage / health / delayDays.
// Phase 1: no Git evidence input; algorithms operate only on Sheets-owned fields.
// Aggregation rule: Red > Amber > Green, computed from Sheets-owned signals only.

var V3Engine = (function () {
  var MS = V3_CONFIG.MS_PER_DAY;

  // ---- Item-level stage: coarse SDLC bucket derived from status + phase. ----
  // Phase 1 keeps this short — richer stage machine is deferred to Phase 4.
  function computeItemStage(itemStatus, itemPhase) {
    if (itemStatus === '完了')     return '完了';
    if (itemStatus === '対象外')   return '対象外';
    if (itemStatus === '確認待ち') return 'レビュー中';
    if (itemStatus === '作業中') {
      if (itemPhase === 'テスト')          return 'テスト中';
      if (itemPhase === 'リリース準備')    return 'リリース準備中';
      if (itemPhase === '設計')            return '設計中';
      if (itemPhase === '調査')            return '調査中';
      return '実装中';
    }
    // Default (未着手 or unknown).
    if (itemPhase === '調査') return '調査待ち';
    if (itemPhase === '設計') return '設計待ち';
    return '未着手';
  }

  // ---- Project-level stage: aggregate over its items. ----
  function computeProjectStage(projectStatus, itemsInProject) {
    if (projectStatus === '保留') return '保留';
    if (projectStatus === '中止') return '中止';
    if (projectStatus === '完了') return '提供済み';
    if (projectStatus === '計画中') return '準備中';
    // 進行中: derive from items.
    if (!itemsInProject || !itemsInProject.length) return '準備中';

    var total = 0, done = 0, active = 0, review = 0;
    for (var i = 0; i < itemsInProject.length; i++) {
      var it = itemsInProject[i];
      if (it.status === '対象外') continue;
      total++;
      if (it.status === '完了')     done++;
      if (it.status === '作業中')   active++;
      if (it.status === '確認待ち') review++;
    }
    if (total === 0) return '準備中';
    if (done === total) return '提供準備';
    if (review > 0)     return 'レビュー中';
    if (active > 0)     return '作成中';
    return '作成予定';
  }

  // ---- Delay days: positive integer count past dueDate; 0 if not past or unset. ----
  function computeDelayDays(dueDate, nowMs) {
    if (!dueDate) return 0;
    var endMs = new Date(dueDate).getTime();
    if (isNaN(endMs)) return 0;
    var diff = nowMs - endMs;
    if (diff <= 0) return 0;
    return Math.ceil(diff / MS);
  }

  // ---- Health for an Item. Returns { health, reasonCodes }. ----
  function computeItemHealth(item, pendingDecisions, thresholds, nowMs) {
    var reasons = [];
    var dueMs = item.dueDate ? new Date(item.dueDate).getTime() : null;

    // Red conditions.
    if (dueMs && !isNaN(dueMs) && nowMs > dueMs && item.status !== '完了' && item.status !== '対象外') {
      reasons.push({ level: 'Red', code: 'DEADLINE_EXCEEDED' });
    }
    if (item.blocker && String(item.blocker).trim() !== '' && item.status !== '完了' && item.status !== '対象外') {
      reasons.push({ level: 'Red', code: 'BLOCKED' });
    }
    var overdueDays = thresholds.DECISION_OVERDUE_DAYS;
    for (var i = 0; i < pendingDecisions.length; i++) {
      var d = pendingDecisions[i];
      if (!d.dueDate) continue;
      var ddMs = new Date(d.dueDate).getTime();
      if (isNaN(ddMs)) continue;
      if (nowMs > ddMs + overdueDays * MS) {
        reasons.push({ level: 'Red', code: 'DECISION_OVERDUE' });
        break;
      }
    }

    // Amber conditions.
    if (pendingDecisions.length > 0 && !reasons.some(function (r) { return r.level === 'Red'; })) {
      reasons.push({ level: 'Amber', code: 'PENDING_DECISION' });
    }
    if (dueMs && !isNaN(dueMs) && nowMs < dueMs && (dueMs - nowMs) < thresholds.DEADLINE_WARNING_DAYS * MS
        && item.status !== '完了' && item.status !== '対象外') {
      reasons.push({ level: 'Amber', code: 'DEADLINE_APPROACHING' });
    }
    // Stale update.
    if (item.updatedAt) {
      var u = new Date(item.updatedAt).getTime();
      if (!isNaN(u) && nowMs - u > thresholds.STALE_DAYS * MS
          && item.status !== '完了' && item.status !== '対象外') {
        reasons.push({ level: 'Amber', code: 'STALE' });
      }
    }

    if (reasons.some(function (r) { return r.level === 'Red';   })) return { health: 'Red',   reasonCodes: reasons };
    if (reasons.some(function (r) { return r.level === 'Amber'; })) return { health: 'Amber', reasonCodes: reasons };
    return { health: 'Green', reasonCodes: [] };
  }

  // ---- Health for a Project: worst-item aggregation. ----
  function computeProjectHealth(projectStatus, itemHealthList) {
    if (projectStatus === '中止') return 'Amber';
    if (projectStatus === '保留') return 'Amber';
    if (projectStatus === '完了') return 'Green';
    if (!itemHealthList || !itemHealthList.length) return 'Green';
    var hasRed = false, hasAmber = false;
    for (var i = 0; i < itemHealthList.length; i++) {
      if (itemHealthList[i] === 'Red')   hasRed = true;
      if (itemHealthList[i] === 'Amber') hasAmber = true;
    }
    if (hasRed)   return 'Red';
    if (hasAmber) return 'Amber';
    return 'Green';
  }

  return {
    computeItemStage: computeItemStage,
    computeProjectStage: computeProjectStage,
    computeDelayDays: computeDelayDays,
    computeItemHealth: computeItemHealth,
    computeProjectHealth: computeProjectHealth,
  };
}());
