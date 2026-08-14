'use strict';

// Project Progress Manager registration service.
//
// One submission may create/reference:
//   - 1 Project (new or existing)
//   - 0..N Work Items (Epic/Feature/Task/Subtask/Bug/Improvement)
//   - 0..N Relations (dependency, blocks)
//   - 0..N Decisions
//
// Guarantees:
//   - Idempotent by (submissionId, payloadHash). Replay returns the same result.
//     Different payload for same submissionId → payload_mismatch.
//   - Fully rolled back on any write failure. Deleted rows leave no partial state.
//   - Serialized by LockService (200ms fail-fast → concurrent_sync).
//   - Formula-safe: strings starting with '=' are prefixed with apostrophe.
//   - Validated: unknown Project reference, unknown parent, cross-project parent,
//     cycles (parent chain or dependency graph) all rejected before any write.
//   - Activity write is part of the transaction; if it fails, the whole registration
//     is rolled back — a canonical write is never reported as success when its
//     Activity record failed.

var V3RegistrationService = (function () {

  // ---- Formula safety. ----
  function _sv(v) {
    if (typeof v !== 'string') return (v == null) ? '' : v;
    if (v.length > 0 && v.charAt(0) === '=') return "'" + v;
    return v;
  }

  // ---- Payload hash: FNV-1a 32-bit over normalized JSON. Excludes submissionId. ----
  function _computeHash(payload) {
    var normalized = JSON.stringify({
      project:   payload.project   || null,
      items:     payload.items     || [],
      relations: payload.relations || [],
      decisions: payload.decisions || [],
    });
    var hash = 2166136261;
    for (var i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(16);
  }

  // ---- Validation ----

  function _isDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  function _len(s) { return typeof s === 'string' ? s.trim().length : 0; }

  function _enumOf(v, values, label, errs) {
    if (v == null || v === '') return; // enums are optional unless caller says otherwise
    if (values.indexOf(v) === -1) errs.push(label + ': 不正な値: ' + String(v));
  }

  function _findExistingRelation(ss, sourceItemId, targetItemId, relationType) {
    var sheet = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.RELATIONS);
    if (!sheet) return null;
    var srcCol = V3Schema.resolveColumnIndex(sheet, 'sourceItemId');
    var tgtCol = V3Schema.resolveColumnIndex(sheet, 'targetItemId');
    var typeCol = V3Schema.resolveColumnIndex(sheet, 'relationType');
    var activeCol = V3Schema.resolveColumnIndex(sheet, 'active');
    if (srcCol < 1 || tgtCol < 1) return null;
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      if (sheet.getRange(r, srcCol).getValue() !== sourceItemId) continue;
      if (sheet.getRange(r, tgtCol).getValue() !== targetItemId) continue;
      if (typeCol > 0 && sheet.getRange(r, typeCol).getValue() !== relationType) continue;
      if (activeCol > 0 && sheet.getRange(r, activeCol).getValue() === 'FALSE') continue;
      return r;
    }
    return null;
  }

  function _detectCycleInGraph(nodes, edgesByNode) {
    // Iterative DFS: for each node, walk edges; if we reach a visited-in-current-path node, cycle.
    for (var i = 0; i < nodes.length; i++) {
      var start = nodes[i];
      var visited = {};
      var stack = [start];
      var path = {};
      while (stack.length) {
        var cur = stack.pop();
        if (cur === '__POP__') {
          delete path[stack.pop()];
          continue;
        }
        if (path[cur]) return true;
        if (visited[cur]) continue;
        visited[cur] = true;
        path[cur] = true;
        stack.push(cur, '__POP__');
        var next = edgesByNode[cur] || [];
        for (var j = 0; j < next.length; j++) {
          if (path[next[j]]) return true;
          stack.push(next[j]);
        }
      }
    }
    return false;
  }

  function validate(ss, payload) {
    if (!payload || typeof payload !== 'object') {
      return { ok: false, errors: ['payload が不正です'] };
    }
    var errs = [];
    if (!payload.submissionId || typeof payload.submissionId !== 'string' || !payload.submissionId.trim()) {
      errs.push('submissionId は必須です');
    }

    // Project block: either new project (project.mode='new' + fields) or existing (project.mode='existing' + projectId).
    var pj = payload.project;
    if (pj) {
      if (pj.mode === 'new') {
        if (!pj.projectName || !pj.projectName.trim()) errs.push('project.projectName は必須です');
        else if (_len(pj.projectName) > 200) errs.push('project.projectName は 200 文字以内です');
        if (pj.shareTitle && _len(pj.shareTitle) > 200) errs.push('project.shareTitle は 200 文字以内です');
        if (pj.purpose && _len(pj.purpose) > 2000) errs.push('project.purpose は 2000 文字以内です');
        _enumOf(pj.status, V3_CONFIG.PROJECT_STATUS_VALUES, 'project.status', errs);
        _enumOf(pj.priority, V3_CONFIG.PRIORITY_VALUES, 'project.priority', errs);
        if (pj.startDate && !_isDate(pj.startDate)) errs.push('project.startDate は YYYY-MM-DD 形式です');
        if (pj.dueDate   && !_isDate(pj.dueDate))   errs.push('project.dueDate は YYYY-MM-DD 形式です');
        if (pj.startDate && pj.dueDate && pj.startDate > pj.dueDate) {
          errs.push('project.startDate は project.dueDate 以前である必要があります');
        }
      } else if (pj.mode === 'existing') {
        if (!pj.projectId || typeof pj.projectId !== 'string') {
          errs.push('project.projectId は必須です (mode=existing)');
        } else {
          var projSheet = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.PROJECTS);
          if (!projSheet) errs.push('setup_required: 01_プロジェクトが未セットアップです');
          else {
            var projRow = V3Schema.findOfficialRowById(projSheet, 'projectId', pj.projectId);
            if (projRow < 0) errs.push('project.projectId が存在しません: ' + pj.projectId);
          }
        }
      } else if (pj.mode) {
        errs.push('project.mode は new または existing です');
      }
    }

    // Items.
    var items = payload.items || [];
    if (!Array.isArray(items)) { errs.push('items は配列である必要があります'); items = []; }
    if (items.length > 200) errs.push('items は 200 件以内です');
    var draftKeys = {};
    var seenTitles = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i]; var p = 'items[' + i + ']: ';
      if (!it || typeof it !== 'object') { errs.push(p + '不正な形式です'); continue; }
      if (!it.draftKey || typeof it.draftKey !== 'string' || !it.draftKey.trim()) errs.push(p + 'draftKey は必須です');
      else {
        if (draftKeys[it.draftKey]) errs.push(p + 'draftKey が重複しています: ' + it.draftKey);
        draftKeys[it.draftKey] = true;
      }
      if (!it.title || !it.title.trim()) errs.push(p + 'title は必須です');
      else if (_len(it.title) > 200) errs.push(p + 'title は 200 文字以内です');
      else {
        var key = it.title.trim();
        if (seenTitles[key]) errs.push(p + 'title が重複しています: ' + key);
        seenTitles[key] = true;
      }
      if (!it.itemType) errs.push(p + 'itemType は必須です');
      else _enumOf(it.itemType, V3_CONFIG.ITEM_TYPE_VALUES, p + 'itemType', errs);
      _enumOf(it.status,   V3_CONFIG.ITEM_STATUS_VALUES,   p + 'status',   errs);
      _enumOf(it.priority, V3_CONFIG.PRIORITY_VALUES,      p + 'priority', errs);
      _enumOf(it.phase,    V3_CONFIG.ITEM_PHASE_VALUES,    p + 'phase',    errs);
      if (it.startDate && !_isDate(it.startDate)) errs.push(p + 'startDate は YYYY-MM-DD 形式です');
      if (it.dueDate   && !_isDate(it.dueDate))   errs.push(p + 'dueDate は YYYY-MM-DD 形式です');
      if (it.startDate && it.dueDate && it.startDate > it.dueDate) {
        errs.push(p + 'startDate は dueDate 以前である必要があります');
      }
      if (it.description       && _len(it.description)       > 4000) errs.push(p + 'description は 4000 文字以内です');
      if (it.deliverable       && _len(it.deliverable)       > 2000) errs.push(p + 'deliverable は 2000 文字以内です');
      if (it.acceptanceCriteria && _len(it.acceptanceCriteria) > 2000) errs.push(p + 'acceptanceCriteria は 2000 文字以内です');
    }

    // parentDraftKey / parentItemId: cycle & existence check.
    // parentDraftKey references another item in the same submission.
    // parentItemId references an already-existing item — must exist and be in the same project.
    var parentEdges = {};
    var itemProjectMap = {}; // draftKey → intendedProjectId (may be null if project is new)
    for (var k = 0; k < items.length; k++) {
      var it2 = items[k];
      if (!it2 || !it2.draftKey) continue;
      parentEdges[it2.draftKey] = [];
      if (it2.parentDraftKey) {
        if (!draftKeys[it2.parentDraftKey]) {
          errs.push('items[' + k + ']: parentDraftKey が存在しません: ' + it2.parentDraftKey);
        } else if (it2.parentDraftKey === it2.draftKey) {
          errs.push('items[' + k + ']: 自己親参照は禁止されています');
        } else {
          parentEdges[it2.draftKey].push(it2.parentDraftKey);
        }
      }
      if (it2.parentItemId) {
        // Existing parent: validate existence and (if project=existing) same-project.
        var itemsSheet = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.ITEMS);
        if (!itemsSheet) errs.push('items[' + k + ']: setup_required (02_タスク未セットアップ)');
        else {
          var parentRow = V3Schema.findOfficialRowById(itemsSheet, 'itemId', it2.parentItemId);
          if (parentRow < 0) {
            errs.push('items[' + k + ']: parentItemId が存在しません: ' + it2.parentItemId);
          } else if (pj && pj.mode === 'existing') {
            var parentPid = V3Schema.readCell(itemsSheet, parentRow, 'projectId');
            if (parentPid !== pj.projectId) {
              errs.push('items[' + k + ']: parentItemId が別 Project に属しています');
            }
          } else if (pj && pj.mode === 'new') {
            errs.push('items[' + k + ']: parentItemId は同一送信内では使用できません (parentDraftKey を使用してください)');
          }
        }
      }
    }
    var draftKeyList = Object.keys(parentEdges);
    if (_detectCycleInGraph(draftKeyList, parentEdges)) {
      errs.push('items: 親子関係に循環が検出されました');
    }

    // Relations.
    // Phase 1A supports initial dependencies at registration time (draftKey pairs
    // for items in this submission, or raw itemId pairs for already-official items
    // in the same Project). Cross-project relations, self-loops, unknown IDs, and
    // cycles are rejected before any write. Standalone add/remove of dependencies
    // against existing items is Phase 1B — those calls do not go through this
    // Service at all.
    var relations = payload.relations || [];
    if (!Array.isArray(relations)) { errs.push('relations は配列である必要があります'); relations = []; }
    var depEdges = {};
    var relSeen = {}; // dedup (source|target|relationType) across the submission.
    var itemsSheetForRel = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.ITEMS);
    // Resolve target project scope. For mode=new we cannot yet know the ID that
    // will be assigned, but we can still bound raw-ID checks to the existing-project
    // case (mode=existing) or accept them only if both endpoints are drafts.
    var scopedProjectId = (pj && pj.mode === 'existing' && pj.projectId) ? pj.projectId : null;

    for (var r = 0; r < relations.length; r++) {
      var rel = relations[r]; var rp = 'relations[' + r + ']: ';
      if (!rel || typeof rel !== 'object') { errs.push(rp + '不正な形式です'); continue; }
      _enumOf(rel.relationType, V3_CONFIG.RELATION_TYPE_VALUES, rp + 'relationType', errs);
      var src = rel.sourceDraftKey || rel.sourceItemId;
      var tgt = rel.targetDraftKey || rel.targetItemId;
      if (!src || !tgt) { errs.push(rp + 'source/target が必須です'); continue; }
      if (src === tgt) { errs.push(rp + '自己依存は禁止されています'); continue; }
      if (rel.sourceDraftKey && !draftKeys[rel.sourceDraftKey]) {
        errs.push(rp + 'sourceDraftKey が存在しません');
      }
      if (rel.targetDraftKey && !draftKeys[rel.targetDraftKey]) {
        errs.push(rp + 'targetDraftKey が存在しません');
      }

      // Raw itemId endpoints: must be an official item and reside in the same
      // project as the submission. mode=new cannot host raw-ID endpoints (the
      // new Project has no items yet).
      if (rel.sourceItemId && !rel.sourceDraftKey) {
        if (!itemsSheetForRel) {
          errs.push(rp + 'setup_required (02_タスク未セットアップ)');
        } else {
          var srcRow = V3Schema.findOfficialRowById(itemsSheetForRel, 'itemId', rel.sourceItemId);
          if (srcRow < 0) {
            errs.push(rp + 'sourceItemId が存在しません: ' + rel.sourceItemId);
          } else if (scopedProjectId) {
            var srcPid = V3Schema.readCell(itemsSheetForRel, srcRow, 'projectId');
            if (srcPid !== scopedProjectId) errs.push(rp + 'sourceItemId が別 Project に属しています');
          } else if (pj && pj.mode === 'new') {
            errs.push(rp + 'sourceItemId は新規 Project 登録では使用できません (sourceDraftKey を使用してください)');
          }
        }
      }
      if (rel.targetItemId && !rel.targetDraftKey) {
        if (!itemsSheetForRel) {
          errs.push(rp + 'setup_required (02_タスク未セットアップ)');
        } else {
          var tgtRow = V3Schema.findOfficialRowById(itemsSheetForRel, 'itemId', rel.targetItemId);
          if (tgtRow < 0) {
            errs.push(rp + 'targetItemId が存在しません: ' + rel.targetItemId);
          } else if (scopedProjectId) {
            var tgtPid = V3Schema.readCell(itemsSheetForRel, tgtRow, 'projectId');
            if (tgtPid !== scopedProjectId) errs.push(rp + 'targetItemId が別 Project に属しています');
          } else if (pj && pj.mode === 'new') {
            errs.push(rp + 'targetItemId は新規 Project 登録では使用できません (targetDraftKey を使用してください)');
          }
        }
      }

      // Duplicate detection: within this submission and against existing rows.
      var relType = rel.relationType || 'depends_on';
      var dedupKey = String(src) + '|' + String(tgt) + '|' + relType;
      if (relSeen[dedupKey]) {
        errs.push(rp + '同一 Relation が重複しています');
      } else {
        relSeen[dedupKey] = true;
      }
      if (rel.sourceItemId && rel.targetItemId && !rel.sourceDraftKey && !rel.targetDraftKey) {
        var existingRel = _findExistingRelation(ss, rel.sourceItemId, rel.targetItemId, relType);
        if (existingRel) errs.push(rp + '既存 Relation と重複しています');
      }

      depEdges[src] = depEdges[src] || [];
      depEdges[src].push(tgt);
    }
    if (_detectCycleInGraph(Object.keys(depEdges), depEdges)) {
      errs.push('relations: 依存関係に循環が検出されました');
    }

    // Decisions.
    var decisions = payload.decisions || [];
    if (!Array.isArray(decisions)) { errs.push('decisions は配列である必要があります'); decisions = []; }
    for (var d = 0; d < decisions.length; d++) {
      var dec = decisions[d]; var dp = 'decisions[' + d + ']: ';
      if (!dec || typeof dec !== 'object') { errs.push(dp + '不正な形式です'); continue; }
      if (!dec.title || !dec.title.trim()) errs.push(dp + 'title は必須です');
      _enumOf(dec.status, V3_CONFIG.DECISION_STATUS_VALUES, dp + 'status', errs);
      _enumOf(dec.type,   V3_CONFIG.DECISION_TYPE_VALUES,   dp + 'type',   errs);
      if (dec.dueDate && !_isDate(dec.dueDate)) errs.push(dp + 'dueDate は YYYY-MM-DD 形式です');
      if (dec.itemDraftKey && !draftKeys[dec.itemDraftKey]) errs.push(dp + 'itemDraftKey が存在しません');
    }

    return errs.length ? { ok: false, errors: errs } : { ok: true };
  }

  // ---- Registration ----

  function register(ss, lockService, payload) {
    var v = validate(ss, payload);
    if (!v.ok) return V3SafeError.make('validation_error', v.errors.join('; '));

    var hash = _computeHash(payload);
    var lock = lockService.getScriptLock();
    var got = lock.tryLock(V3_CONFIG.LOCK_TIMEOUT_MS);
    if (!got) return V3SafeError.make('concurrent_sync', '同時登録と競合しました');

    try {
      return _registerLocked(ss, payload, hash);
    } finally {
      lock.releaseLock();
    }
  }

  function _registerLocked(ss, payload, payloadHash) {
    var submissionId = payload.submissionId;

    // Idempotency check.
    var existing = V3Schema.findRegistration(ss, submissionId);
    if (existing) {
      if (existing.state === 'committed' && String(existing.payloadHash) === String(payloadHash)) {
        return {
          ok: true,
          projectId: existing.projectId,
          itemIds: existing.itemIds ? String(existing.itemIds).split(',').filter(Boolean) : [],
          decisionIds: existing.decisionIds ? String(existing.decisionIds).split(',').filter(Boolean) : [],
          relationIds: existing.relationIds ? String(existing.relationIds).split(',').filter(Boolean) : [],
          idempotent: true,
        };
      }
      if (existing.state === 'committed') {
        return V3SafeError.make('payload_mismatch', '同一 submissionId で別ペイロードです');
      }
      return V3SafeError.make('duplicate_submission', 'この submissionId は処理中です');
    }

    // Sheet handles.
    var pjSheet  = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.PROJECTS);
    var itSheet  = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.ITEMS);
    var relSheet = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.RELATIONS);
    var decSheet = ss.getSheetByName(V3_CONFIG.SHEET_NAMES.DECISIONS);
    if (!pjSheet || !itSheet || !relSheet || !decSheet) {
      return V3SafeError.make('setup_required', '必要なシートが未セットアップです');
    }

    var histRow;
    try {
      histRow = V3Schema.createRegistration(ss, { submissionId: submissionId, payloadHash: payloadHash });
    } catch (e) {
      return V3SafeError.make('registration_error', '登録履歴作成に失敗');
    }

    // Track what we wrote so we can roll back on failure.
    var written = { projectRow: null, itemStartRow: null, itemRows: [], relationRows: [], decisionRows: [] };
    var nowIso = new Date().toISOString();
    var correlationId = 'REG-' + submissionId;

    try {
      // 1. Project — assign ID or resolve existing.
      var projectId;
      if (payload.project && payload.project.mode === 'new') {
        projectId = V3IdService.nextProjectId(ss);
        var pjRow = V3Schema.buildRow(pjSheet, {
          projectId:     _sv(projectId),
          projectName:   _sv(payload.project.projectName),
          shareTitle:    _sv(payload.project.shareTitle || ''),
          purpose:       _sv(payload.project.purpose || ''),
          status:        _sv(payload.project.status || '計画中'),
          priority:      _sv(payload.project.priority || '次に'),
          owner:         _sv(payload.project.owner || ''),
          startDate:     payload.project.startDate || '',
          dueDate:       payload.project.dueDate || '',
          health:        'Green',
          nextMilestone: _sv(payload.project.nextMilestone || ''),
          active:        'TRUE',
          createdAt:     nowIso,
          updatedAt:     nowIso,
          revision:      1,
        });
        written.projectRow = V3Schema.appendRow(pjSheet, pjRow);
      } else if (payload.project && payload.project.mode === 'existing') {
        projectId = payload.project.projectId;
      } else if (payload.items && payload.items.length > 0) {
        // items without project: must be existing referenced via parentItemId.
        // Derive project from first parent.
        var firstParent = null;
        for (var pi = 0; pi < payload.items.length; pi++) {
          if (payload.items[pi].parentItemId) { firstParent = payload.items[pi].parentItemId; break; }
        }
        if (!firstParent) {
          throw { ok: false, code: 'validation_error', message: 'validation_error: project 情報がありません' };
        }
        var pRow = V3Schema.findRowById(itSheet, 'itemId', firstParent);
        projectId = V3Schema.readCell(itSheet, pRow, 'projectId');
      } else {
        // No project, no items — only decisions/relations (unusual). Require project.
        throw { ok: false, code: 'validation_error', message: 'validation_error: project 情報がありません' };
      }

      V3Schema.updateRegistration(ss, histRow, {
        state: 'ids_allocated',
        projectId: projectId,
        projectRow: written.projectRow || '',
      });

      // 2. Work Items — resolve IDs first, then write. Parent references via draftKey → new itemId.
      var draftToItemId = {};
      var itemIdList = [];
      for (var i = 0; i < (payload.items || []).length; i++) {
        var it = payload.items[i];
        var newId = V3IdService.nextItemId(ss, projectId, it.itemType);
        draftToItemId[it.draftKey] = newId;
        itemIdList.push(newId);
      }

      // Write item rows.
      for (var j = 0; j < (payload.items || []).length; j++) {
        var it2 = payload.items[j];
        var itemId = itemIdList[j];
        var parentId = '';
        if (it2.parentDraftKey) parentId = draftToItemId[it2.parentDraftKey] || '';
        else if (it2.parentItemId) parentId = it2.parentItemId;

        var itRow = V3Schema.buildRow(itSheet, {
          itemId:            _sv(itemId),
          projectId:         _sv(projectId),
          parentItemId:      _sv(parentId),
          itemType:          _sv(it2.itemType),
          title:             _sv(it2.title || ''),
          shareTitle:        _sv(it2.shareTitle || ''),
          description:       _sv(it2.description || ''),
          deliverable:       _sv(it2.deliverable || ''),
          acceptanceCriteria:_sv(it2.acceptanceCriteria || ''),
          status:            _sv(it2.status || '未着手'),
          phase:             _sv(it2.phase || ''),
          priority:          _sv(it2.priority || ''),
          assignee:          _sv(it2.assignee || ''),
          startDate:         it2.startDate || '',
          dueDate:           it2.dueDate || '',
          estimate:          it2.estimate == null ? '' : it2.estimate,
          blocker:           _sv(it2.blocker || ''),
          nextAction:        _sv(it2.nextAction || ''),
          active:            'TRUE',
          createdAt:         nowIso,
          updatedAt:         nowIso,
          revision:          1,
        });
        var row = V3Schema.appendRow(itSheet, itRow);
        if (written.itemStartRow === null) written.itemStartRow = row;
        written.itemRows.push(row);
      }

      V3Schema.updateRegistration(ss, histRow, {
        state: 'items_written',
        itemIds: itemIdList.join(','),
        itemStartRow: written.itemStartRow || '',
        itemCount: itemIdList.length,
      });

      // 3. Relations.
      var relationIdList = [];
      for (var r = 0; r < (payload.relations || []).length; r++) {
        var rel = payload.relations[r];
        var relId = V3IdService.nextRelationId(ss);
        var src = rel.sourceDraftKey ? draftToItemId[rel.sourceDraftKey] : rel.sourceItemId;
        var tgt = rel.targetDraftKey ? draftToItemId[rel.targetDraftKey] : rel.targetItemId;
        var relRow = V3Schema.buildRow(relSheet, {
          relationId:   _sv(relId),
          projectId:    _sv(projectId),
          sourceItemId: _sv(src),
          targetItemId: _sv(tgt),
          relationType: _sv(rel.relationType || 'depends_on'),
          active:       'TRUE',
          createdAt:    nowIso,
          updatedAt:    nowIso,
        });
        var rrow = V3Schema.appendRow(relSheet, relRow);
        written.relationRows.push(rrow);
        relationIdList.push(relId);
      }

      // 4. Decisions.
      var decisionIdList = [];
      for (var d = 0; d < (payload.decisions || []).length; d++) {
        var dec = payload.decisions[d];
        var decId = V3IdService.nextDecisionId(ss, projectId);
        var decItemId = '';
        if (dec.itemDraftKey) decItemId = draftToItemId[dec.itemDraftKey] || '';
        else if (dec.itemId)  decItemId = dec.itemId;
        var decRow = V3Schema.buildRow(decSheet, {
          decisionId: _sv(decId),
          projectId:  _sv(projectId),
          itemId:     _sv(decItemId),
          type:       _sv(dec.type || '判断待ち'),
          title:      _sv(dec.title || ''),
          detail:     _sv(dec.detail || ''),
          owner:      _sv(dec.owner || ''),
          dueDate:    dec.dueDate || '',
          status:     _sv(dec.status || '未確認'),
          resolution: _sv(dec.resolution || ''),
          createdAt:  nowIso,
          resolvedAt: '',
        });
        var drow = V3Schema.appendRow(decSheet, decRow);
        written.decisionRows.push(drow);
        decisionIdList.push(decId);
      }

      // 5. Activity — synchronous with transaction. Each Activity gets a
      // fresh Workspace-wide counter ID.
      if (written.projectRow !== null) {
        V3Schema.appendActivity(ss, {
          activityId:    V3IdService.nextActivityId(ss),
          projectId:     projectId,
          entityType:    'project',
          entityId:      projectId,
          action:        'create',
          field:         '',
          beforeValue:   '',
          afterValue:    payload.project.projectName || '',
          actor:         'registration',
          reason:        'Sidebar 登録',
          timestamp:     nowIso,
          correlationId: correlationId,
        });
      }
      for (var ai = 0; ai < written.itemRows.length; ai++) {
        var it3 = payload.items[ai];
        V3Schema.appendActivity(ss, {
          activityId:    V3IdService.nextActivityId(ss),
          projectId:     projectId,
          entityType:    'item',
          entityId:      itemIdList[ai],
          action:        'create',
          field:         'itemType',
          beforeValue:   '',
          afterValue:    it3.itemType,
          actor:         'registration',
          reason:        'Sidebar 登録',
          timestamp:     nowIso,
          correlationId: correlationId,
        });
      }
      for (var ad = 0; ad < written.decisionRows.length; ad++) {
        V3Schema.appendActivity(ss, {
          activityId:    V3IdService.nextActivityId(ss),
          projectId:     projectId,
          entityType:    'decision',
          entityId:      decisionIdList[ad],
          action:        'create',
          field:         '',
          beforeValue:   '',
          afterValue:    payload.decisions[ad].title || '',
          actor:         'registration',
          reason:        'Sidebar 登録',
          timestamp:     nowIso,
          correlationId: correlationId,
        });
      }
      for (var ar = 0; ar < written.relationRows.length; ar++) {
        V3Schema.appendActivity(ss, {
          activityId:    V3IdService.nextActivityId(ss),
          projectId:     projectId,
          entityType:    'relation',
          entityId:      relationIdList[ar],
          action:        'create',
          field:         'relationType',
          beforeValue:   '',
          afterValue:    payload.relations[ar].relationType || 'depends_on',
          actor:         'registration',
          reason:        'Sidebar 登録',
          timestamp:     nowIso,
          correlationId: correlationId,
        });
      }

      // 6. Commit.
      V3Schema.updateRegistration(ss, histRow, {
        state: 'committed',
        relationIds: relationIdList.join(','),
        decisionIds: decisionIdList.join(','),
      });

      return {
        ok: true,
        projectId: projectId,
        itemIds: itemIdList,
        decisionIds: decisionIdList,
        relationIds: relationIdList,
      };

    } catch (e) {
      _rollback(pjSheet, itSheet, relSheet, decSheet, written);
      var code = (e && e.code) || 'registration_error';
      var detail = (e && e.message) || String(e);
      V3Schema.updateRegistration(ss, histRow, {
        state: 'rolled_back',
        safeErrorCode: V3SafeError.isSafeCode(code) ? code : 'registration_error',
      });
      return V3SafeError.make(code, detail);
    }
  }

  function _rollback(pjSheet, itSheet, relSheet, decSheet, written) {
    // Reverse order to keep row numbers stable (last-written first).
    var i;
    for (i = written.decisionRows.length - 1; i >= 0; i--) {
      try { decSheet.deleteRow(written.decisionRows[i]); } catch (_) {}
    }
    for (i = written.relationRows.length - 1; i >= 0; i--) {
      try { relSheet.deleteRow(written.relationRows[i]); } catch (_) {}
    }
    for (i = written.itemRows.length - 1; i >= 0; i--) {
      try { itSheet.deleteRow(written.itemRows[i]); } catch (_) {}
    }
    if (written.projectRow !== null) {
      try { pjSheet.deleteRow(written.projectRow); } catch (_) {}
    }
  }

  return { validate: validate, register: register };
}());
