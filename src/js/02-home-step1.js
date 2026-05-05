/* ============================================================
 * BLOCK 2: 首页 + 向导启动 + Step1（固定事项 日期+时段）
 * ============================================================ */

/* ---------- 首页 ----------
 * 归档逻辑：默认只显示 active 清单；archived 折叠在底部，需点"显示已归档(N)"展开
 * 用 uiState.showArchived 控制展开状态（仅 UI 状态，不持久化，刷新后默认折叠）
 */
function renderHome() {
  const cont = $("#listsContainer");
  if (!state.lists.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <div class="emoji">📋</div>
        <div>还没有清单</div>
        <div style="font-size:12px;margin-top:6px;">点上方 "+ 新建" 开始</div>
      </div>`;
    $("#homeHint").style.display = "none";
    return;
  }
  $("#homeHint").style.display = "block";

  const activeLists = state.lists.filter(l => l.status !== "archived");
  const archivedLists = state.lists.filter(l => l.status === "archived");

  const renderCard = (list) => {
    const p = listProgress(list);
    const isArchived = list.status === "archived";
    return `
      <div class="list-card${isArchived ? ' is-archived' : ''}" onclick="openList('${list.id}')">
        <div class="head">
          <div>
            <div class="name">${escapeHtml(list.name)}</div>
            <div class="date-range">${fmtDateShort(list.dateRange.start)} ~ ${fmtDateShort(list.dateRange.end)}</div>
          </div>
          <span class="status-tag ${isArchived ? 'status-archived' : 'status-active'}">${isArchived ? '已归档' : '进行中'}</span>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${p.percent}%"></div></div>
        <div class="meta">
          <span>${p.done}/${p.total} 已完成</span>
          <span>
            <a class="btn-ghost" onclick="event.stopPropagation();toggleArchive('${list.id}')" style="cursor:pointer;font-size:12px;">${isArchived ? '取消归档' : '归档'}</a>
            ·
            <a class="btn-ghost" onclick="event.stopPropagation();delList('${list.id}')" style="cursor:pointer;color:var(--danger);font-size:12px;">删除</a>
          </span>
        </div>
      </div>
    `;
  };

  const activeHtml = activeLists.length
    ? activeLists.map(renderCard).join("")
    : `<div class="empty-state" style="padding:30px 20px;font-size:13px;">
         <div class="emoji">✨</div>
         <div>暂无进行中的清单</div>
         ${archivedLists.length ? '<div style="font-size:12px;margin-top:6px;">下方有已归档清单</div>' : ''}
       </div>`;

  const archivedHtml = archivedLists.length ? `
    <div class="archive-divider">
      <button class="archive-toggle" onclick="toggleShowArchived()">
        <svg class="icon icon-sm"><use href="#icon-chevron-${uiState.showArchived ? 'up' : 'down'}"/></svg>
        ${uiState.showArchived ? '收起' : '显示'}已归档（${archivedLists.length}）
      </button>
    </div>
    ${uiState.showArchived ? `<div class="archive-list">${archivedLists.map(renderCard).join("")}</div>` : ''}
  ` : '';

  cont.innerHTML = activeHtml + archivedHtml;
}

function toggleShowArchived() {
  uiState.showArchived = !uiState.showArchived;
  renderHome();
}

function listProgress(list) {
  const items = Object.values(list.items || {});
  const fixed = (list.fixedItems || []).length;
  const meals = (list.meals || []).length;
  const total = items.length + fixed + meals;
  const done = items.filter(i => i.done).length
    + (list.fixedItems || []).filter(f => f.done).length
    + (list.meals || []).filter(m => m.done).length;
  return { total, done, percent: total ? Math.round(done * 100 / total) : 0 };
}

function openList(id) {
  currentListId = id;
  switchView("detail");
  renderDetail();
}
function toggleArchive(id) {
  const l = state.lists.find(x => x.id === id);
  if (!l) return;
  const wasArchived = l.status === "archived";
  l.status = wasArchived ? "active" : "archived";
  save();
  renderHome();
  toast(wasArchived ? "已取消归档" : "已归档（在底部「已归档」可展开查看）");
}
function delList(id) {
  confirmDanger("删除这份清单？此操作不可恢复。", () => {
    state.lists = state.lists.filter(l => l.id !== id);
    save(); renderHome(); toast("已删除");
  });
}

/* ---------- 向导启动 / 取消 / 翻页 ---------- */
function startNewList() {
  wizardEditMode = false;
  wizardStep3Visited = false; // 重置，让 step3 的引导逻辑重新生效
  const range = getThisWeekend();
  wizardDraft = newListDraft(range);
  wizardStep = 1;
  switchView("wizard");
  $("#wizardTitle").textContent = "新建周末清单";
  renderWizard();
}
function editCurrentList() {
  if (!currentListId) return;
  const l = state.lists.find(x => x.id === currentListId);
  if (!l) return;
  wizardEditMode = true;
  wizardStep3Visited = false; // 编辑时也允许 step3 自动推荐 tab
  wizardDraft = deepCopy(l);
  wizardStep = 1;
  switchView("wizard");
  $("#wizardTitle").textContent = "编辑清单";
  renderWizard();
}
function cancelWizard() {
  if (wizardEditMode) {
    confirmDanger("放弃此次编辑？", () => { wizardDraft = null; goHome(); });
  } else {
    confirmDanger("放弃这份新建的清单？", () => { wizardDraft = null; goHome(); });
  }
}
function newListDraft(range) {
  const draft = {
    id: uid("list"),
    name: `${fmtDateShort(range.start)} ~ ${fmtDateShort(range.end)}`,
    dateRange: range,
    status: "active",
    createdAt: Date.now(),
    fixedItems: [],   // {id,text,date,slot,done}
    meals: [],        // {id,date,slot,text,done}  date/slot 可空
    cravings: [],     // 备用
    items: {},        // id -> {id,text,category,isMustDo,mustDoSourceId,done}
    slots: {}         // "yyyy-mm-dd_morning" -> [itemId,...]
  };
  eachDate(range.start, range.end).forEach(d => {
    SLOTS.forEach(s => { draft.slots[`${d}_${s}`] = []; });
  });
  applyMustDoToDraft(draft);
  return draft;
}

function applyMustDoToDraft(draft) {
  const dates = eachDate(draft.dateRange.start, draft.dateRange.end);
  state.mustDoItems.forEach(md => {
    // 兼容旧数据：没有 principle 时由 category 推导
    const principle = md.principle || categoryToPrincipleStatic(md.category);
    const placement = md.placement || { dayOffset: "last", slot: "evening" };
    let targetDates = [];
    switch (placement.dayOffset) {
      case "first": targetDates = [dates[0]]; break;
      case "last": targetDates = [dates[dates.length - 1]]; break;
      case "every": targetDates = dates.slice(); break;
      default: {
        const n = parseInt(placement.dayOffset, 10);
        if (!isNaN(n)) targetDates = [dates[Math.min(Math.max(n, 0), dates.length - 1)]];
        else targetDates = [dates[dates.length - 1]];
      }
    }
    targetDates.forEach(d => {
      const itemId = uid("it");
      draft.items[itemId] = {
        id: itemId, text: md.text,
        category: md.category || "active",
        principle: principle, // 来源原则（用于进度统计）
        isMustDo: true, mustDoSourceId: md.id, done: false
      };
      const key = `${d}_${placement.slot || "evening"}`;
      if (!draft.slots[key]) draft.slots[key] = [];
      draft.slots[key].push(itemId);
    });
  });
}

// 全局：category → principle 的映射（旧数据兼容用，必须和 Step3 算法一致）
function categoryToPrincipleStatic(cat) {
  if (cat === "body_high" || cat === "body_low" || cat === "body") return "body";
  if (cat === "blank") return "blank";
  if (cat === "active") return "active";
  if (cat === "sundayNight") return "sundayNight";
  return "none";
}

function renderWizard() {
  // stepper
  $$(".stepper .seg").forEach((seg, i) => {
    seg.classList.remove("active", "done");
    if (i + 1 < wizardStep) seg.classList.add("done");
    if (i + 1 === wizardStep) seg.classList.add("active");
  });
  // body
  const body = $("#wizardBody");
  if (wizardStep === 1) body.innerHTML = renderStep1(wizardDraft);
  else if (wizardStep === 2) body.innerHTML = renderStep2(wizardDraft);
  else if (wizardStep === 3) {
    // 首次进入 step3：自动选第一个未达标的原则 tab（引导）
    if (!wizardStep3Visited) {
      activeCandTab = pickInitialCandTab(wizardDraft);
      wizardStep3Visited = true;
    }
    body.innerHTML = renderStep3(wizardDraft);
  }
  // 给 body 加 step 标记 class，CSS 用 .wizard-step-3 命中（不依赖 :has() 选择器，兼容老浏览器）
  document.body.classList.remove("wizard-step-1", "wizard-step-2", "wizard-step-3");
  document.body.classList.add(`wizard-step-${wizardStep}`);
  // nav buttons
  $("#wizardPrev").style.visibility = wizardStep === 1 ? "hidden" : "visible";
  $("#wizardNext").textContent = wizardStep === 3 ? (wizardEditMode ? "保存" : "完成") : "下一步";
  // step3 需要绑定拖拽
  if (wizardStep === 3) bindDnD($("#wizardBody"));
}
function wizardPrev() { if (wizardStep > 1) { wizardStep--; renderWizard(); } }
function wizardNext() {
  if (wizardStep < 3) { wizardStep++; renderWizard(); return; }
  // 完成前置检查：4 大原则至少满足 3 个（used > 0 算满足）
  const okCount = countSatisfiedPrinciples(wizardDraft);
  if (okCount < 3) {
    toast(`还需安排 ${3 - okCount} 个原则才能完成（当前 ${okCount}/4）`);
    return;
  }
  saveDraftToList();
  const isEdit = wizardEditMode;
  // 记下保存后要打开的清单 id（saveDraftToList 之后 wizardDraft.id 还在）
  const savedId = wizardDraft.id;
  toast(isEdit ? "已保存" : "🎉 清单已生成");
  wizardDraft = null;
  // 跳到详情视图查看刚生成的清单（更有仪式感）
  if (savedId) {
    currentListId = savedId;
    switchView("detail");
    renderDetail();
  } else {
    goHome();
  }
}

// 计算 draft 中满足的原则数量（与 Step3 进度算法保持一致）
//  - 优先用 it.principle（必做项 / 池内 chip 都会带）
//  - 没有 principle 的（极旧的临时项）用 categoryToPrincipleStatic 兜底
//  - principle === "none" 表示独立项，不计入任何原则
function countSatisfiedPrinciples(draft) {
  const usedPrinciples = new Set();
  Object.values(draft.items).forEach(it => {
    const pk = it.principle || categoryToPrincipleStatic(it.category);
    if (pk && pk !== "none") usedPrinciples.add(pk);
  });
  return PRINCIPLES.filter(p => usedPrinciples.has(p.key)).length;
}
function saveDraftToList() {
  if (!wizardDraft) return;
  if (wizardEditMode) {
    const idx = state.lists.findIndex(l => l.id === wizardDraft.id);
    if (idx >= 0) state.lists[idx] = wizardDraft; else state.lists.unshift(wizardDraft);
  } else {
    state.lists.unshift(wizardDraft);
  }
  save();
}

/* ---------- Step1: 固定事项（一次到位 日期+时段） ---------- */
function renderStep1(draft) {
  const dates = eachDate(draft.dateRange.start, draft.dateRange.end);
  return `
    <div class="card">
      <h2>① 时间范围</h2>
      <p class="subtitle">默认本周末，长假/调休可以改。改完会自动应用。</p>
      <div class="row">
        <input class="input" type="date" id="rangeStart" value="${draft.dateRange.start}" onchange="applyRangeChange()" />
        <input class="input" type="date" id="rangeEnd" value="${draft.dateRange.end}" onchange="applyRangeChange()" />
      </div>
      <div class="row" style="margin-top:8px;">
        <input class="input" id="listName" value="${escapeAttr(draft.name)}" placeholder="清单名称" onblur="applyRangeChange()" onkeydown="if(event.key==='Enter'){event.preventDefault();event.target.blur();}" />
      </div>
    </div>

    <div class="card">
      <h2>② 固定事项</h2>
      <p class="subtitle">已经定好的安排（聚餐/约会/看医生/出差…），选好"哪天 + 哪个时段"。</p>

      <div class="row">
        <select class="input shrink" id="fixDate" style="max-width:140px;">
          ${dates.map(d => `<option value="${d}">${fmtDateShort(d)}</option>`).join("")}
        </select>
        <select class="input shrink" id="fixSlot" style="max-width:90px;">
          ${SLOTS.map(s => `<option value="${s}">${SLOT_LABELS[s]}</option>`).join("")}
        </select>
      </div>
      <div class="row" style="margin-top:6px;">
        <input class="input" id="fixText" placeholder="比如：朋友聚餐（回车快速添加）" onkeydown="if(event.key==='Enter'){event.preventDefault();addFixed();}" />
        <button class="btn shrink" style="flex:0 0 70px;" onclick="addFixed()">添加</button>
      </div>

      <div class="fixed-list" style="margin-top:12px;">
        ${draft.fixedItems.length === 0
          ? `<div class="u-empty-row">还没有固定事项</div>`
          : draft.fixedItems.map(f => `
            <div class="fixed-item">
              <span class="text">📌 ${escapeHtml(f.text)}</span>
              <span class="meta">${fmtDateShort(f.date)} · ${SLOT_LABELS[f.slot]}</span>
              <button class="icon-mini" onclick="removeFixed('${f.id}')">✕</button>
            </div>
          `).join("")}
      </div>
    </div>
  `;
}

function applyRangeChange() {
  const sEl = $("#rangeStart"), eEl = $("#rangeEnd"), nEl = $("#listName");
  if (!sEl || !eEl) return;
  const s = sEl.value, e = eEl.value;
  const newName = (nEl?.value || "").trim();
  if (!s || !e) return;
  if (s > e) { toast("结束日期不能早于开始日期"); return; }
  // 没有任何变化时直接 return，避免 onblur 重复 render 闪烁
  const dateUnchanged = s === wizardDraft.dateRange.start && e === wizardDraft.dateRange.end;
  // 判断旧 name 是否是"按旧日期自动生成的"，是则跟着新日期一起改
  const oldAuto = `${fmtDateShort(wizardDraft.dateRange.start)} ~ ${fmtDateShort(wizardDraft.dateRange.end)}`;
  const newAuto = `${fmtDateShort(s)} ~ ${fmtDateShort(e)}`;
  const nameUnchanged = newName === wizardDraft.name;
  if (dateUnchanged && nameUnchanged) return;

  wizardDraft.dateRange = { start: s, end: e };
  if (newName && newName !== oldAuto) {
    wizardDraft.name = newName;
  } else {
    wizardDraft.name = newAuto;
  }
  // 重建 slots（保留已有事项尽量保留，越界的迁到最后一天的同时段）
  const newDates = eachDate(s, e);
  const newSlots = {};
  newDates.forEach(d => SLOTS.forEach(sl => newSlots[`${d}_${sl}`] = []));
  // 仅迁移"非必做项"的普通事项；必做项稍后会通过 applyMustDoToDraft 按新日期范围重新落位
  Object.entries(wizardDraft.slots).forEach(([key, ids]) => {
    const [d, sl] = key.split("_");
    const target = newDates.includes(d) ? `${d}_${sl}` : `${newDates[newDates.length - 1]}_${sl}`;
    const keptIds = (ids || []).filter(id => {
      const it = wizardDraft.items[id];
      return it && !it.isMustDo;
    });
    newSlots[target] = newSlots[target].concat(keptIds);
  });
  wizardDraft.slots = newSlots;
  // 清理旧的必做项条目（接下来会重新生成，避免重复 + 落到旧"最后一天"位置）
  Object.keys(wizardDraft.items).forEach(id => {
    if (wizardDraft.items[id]?.isMustDo) delete wizardDraft.items[id];
  });
  // 固定事项里超出范围的迁到最后一天
  wizardDraft.fixedItems.forEach(f => {
    if (!newDates.includes(f.date)) f.date = newDates[newDates.length - 1];
  });
  // 按新日期范围重新落位必做项（dayOffset: "last" 等会按新 dates 重算）
  applyMustDoToDraft(wizardDraft);
  if (!dateUnchanged) toast("已应用");
  renderWizard();
}

function addFixed() {
  const date = $("#fixDate").value, slot = $("#fixSlot").value;
  const text = $("#fixText").value.trim();
  if (!text) { toast("请输入事项内容"); return; }
  wizardDraft.fixedItems.push({ id: uid("f"), date, slot, text, done: false });
  renderWizard();
}
function removeFixed(id) {
  wizardDraft.fixedItems = wizardDraft.fixedItems.filter(f => f.id !== id);
  renderWizard();
}

// === BLOCK 2 END ===
