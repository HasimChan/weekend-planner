/* ============================================================
 * BLOCK 4: 拖拽逻辑（PC HTML5 draggable + 移动端 PointerEvents）
 *  - 候选区 chip 拖到 slot：复制成新 item 加进去
 *  - slot-item 拖到另一个 slot：移动
 *  - 移动端：长按 350ms 触发 + 跟手 ghost
 * ============================================================ */

// dragData 跨文件共享（03 的 chip + 按钮拖拽会写入它）→ 放进 uiState
//   { from:'pool'|'slot', text?, cat?, id?, key? }
// 为方便保持原代码风格，下面用 const dragData 做 getter/setter 代理到 uiState.dragData
Object.defineProperty(window, "dragData", {
  get() { return uiState.dragData; },
  set(v) { uiState.dragData = v; },
  configurable: true
});
if (typeof uiState.dragData === "undefined") uiState.dragData = null;

// touchDrag 仅 04-dnd 内部使用（移动端 PointerEvents 临时状态），不需要进 uiState
let touchDrag = {
  active: false,
  ghost: null,
  longPressTimer: null,
  startX: 0, startY: 0,
  pointerId: null,
  source: null,
  data: null
};
const LONG_PRESS_MS = 350;
const MOVE_THRESHOLD = 8;

function bindDnD(root) {
  if (!root) return;

  // bug 修复：首次从 step2 进 step3 时，body.classList 刚加上 wizard-step-3、CSS 媒体查询尚未 commit，
  // 直接调 isMobileLayout() 可能误判 → 桌面端被当成移动端 → chip/slot-item 的 draggable 属性被 removeAttribute 清掉 →
  // 用户拖不动。
  // 加固方案：① 强制 reflow 触发 layout commit  ② 同步绑一次保证立刻可用  ③ 再用 rAF 兜底纠正 draggable 属性
  // （rAF 阶段只补 draggable 属性，不再重复 bindDnDImpl，避免 drop 事件被绑多次导致同一次拖拽触发多次 applyDropToSlot
  //   → 出现"第一次拖某项进空时段就报已经在该时段了"的幽灵 bug）
  try { void document.body.offsetHeight; } catch (_) {}
  bindDnDImpl(root);
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(() => {
      // 纠正 chip 上被 mobile 分支误移除的 draggable 属性
      root.querySelectorAll(".chip").forEach(el => {
        if (!el.hasAttribute("draggable") && !isMobileLayout()) el.setAttribute("draggable", "true");
      });
      // 兜底：再跑一次 bindDnDImpl，元素级 __dndItemBound/__dndSlotBound 守卫会跳过已绑元素，
      // 只给"刚补了 draggable 属性的新元素 / 同步那次因 mobile 误判跳过的元素"补绑
      bindDnDImpl(root);
    });
  }
}

function bindDnDImpl(root) {
  if (!root) return;
  // 移动端：完全跳过拖拽事件绑定（候选→时段、时段间互移都改用 + 按钮 + ✕ 删除）
  //  - 移除 chip / slot-item 上的 draggable 属性，避免 cursor: grab 视觉
  //  - 不绑定任何 dragstart/dragover/drop/pointerdown 事件
  if (isMobileLayout()) {
    root.querySelectorAll(".chip[draggable], .slot-item[draggable]").forEach(el => {
      el.removeAttribute("draggable");
    });
    return;
  }

  // 守卫策略：在每个具体元素上打 __bound 标记，避免重复绑同一元素的同名事件
  //  - 之前用 root 级 __dndBound 守卫是错的：renderWizard 后 #wizard 容器没换、内部 DOM 全换了，
  //    标记还在 → 新生成的 chip/slot 全没绑事件 → 用户体感"放完一次就拖不动了"
  //  - 元素级守卫：rAF 兜底再次跑到时，已绑过的元素直接跳过，新元素正常绑

  // ---------- PC HTML5 拖拽 ----------
  root.querySelectorAll(".chip[draggable], .slot-item[draggable]").forEach(el => {
    if (el.__dndItemBound) return;
    el.__dndItemBound = true;
    el.addEventListener("dragstart", e => {
      const src = el.dataset.src;
      if (src === "pool") {
        dragData = { from: "pool", text: el.dataset.text, cat: el.dataset.cat };
      } else {
        dragData = { from: "slot", id: el.dataset.id, key: el.dataset.key };
      }
      el.classList.add("dragging");
      try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "x"); } catch (_) {}
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
      dragData = null;
      root.querySelectorAll(".slot.drop-active").forEach(s => s.classList.remove("drop-active"));
    });
  });

  root.querySelectorAll(".slot[data-slot-key]").forEach(slot => {
    if (slot.__dndSlotBound) return;
    slot.__dndSlotBound = true;
    slot.addEventListener("dragover", e => {
      if (!dragData) return;
      e.preventDefault();
      slot.classList.add("drop-active");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("drop-active"));
    slot.addEventListener("drop", e => {
      e.preventDefault();
      slot.classList.remove("drop-active");
      handleDropToSlot(slot.dataset.slotKey);
    });
  });

  // ---------- 移动端 PointerEvents ----------
  root.querySelectorAll(".chip[draggable], .slot-item[draggable]").forEach(el => {
    el.addEventListener("pointerdown", e => {
      if (e.pointerType !== "touch") return;          // 只处理触屏
      const src = el.dataset.src;
      const data = src === "pool"
        ? { from: "pool", text: el.dataset.text, cat: el.dataset.cat }
        : { from: "slot", id: el.dataset.id, key: el.dataset.key };
      touchDrag.startX = e.clientX;
      touchDrag.startY = e.clientY;
      touchDrag.pointerId = e.pointerId;
      touchDrag.source = el;
      touchDrag.data = data;
      clearTimeout(touchDrag.longPressTimer);
      touchDrag.longPressTimer = setTimeout(() => startTouchDrag(el, e.clientX, e.clientY), LONG_PRESS_MS);
    });
  });

  // 全局监听（绑一次即可，避免重复）
  if (!root.__dndGlobalBound) {
    root.__dndGlobalBound = true;
    root.addEventListener("pointermove", e => {
      if (touchDrag.longPressTimer && !touchDrag.active) {
        // 还没触发长按时如果手指明显移动，认为是滚动，取消长按
        const dx = Math.abs(e.clientX - touchDrag.startX);
        const dy = Math.abs(e.clientY - touchDrag.startY);
        if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
          clearTimeout(touchDrag.longPressTimer);
          touchDrag.longPressTimer = null;
        }
      }
      if (touchDrag.active) {
        e.preventDefault();
        moveGhost(e.clientX, e.clientY);
        highlightSlotUnder(e.clientX, e.clientY);
      }
    }, { passive: false });

    const endTouch = e => {
      clearTimeout(touchDrag.longPressTimer);
      touchDrag.longPressTimer = null;
      if (!touchDrag.active) { resetTouchDrag(); return; }
      // 找放下的目标
      const slot = findSlotUnder(e.clientX, e.clientY);
      if (slot) {
        dragData = touchDrag.data;
        handleDropToSlot(slot.dataset.slotKey);
        dragData = null;
      }
      resetTouchDrag();
    };
    root.addEventListener("pointerup", endTouch);
    root.addEventListener("pointercancel", endTouch);
  }
}

function startTouchDrag(el, x, y) {
  touchDrag.active = true;
  if (navigator.vibrate) try { navigator.vibrate(20); } catch (_) {}
  el.classList.add("dragging");
  // 创建 ghost
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.textContent = (touchDrag.data.from === "pool")
    ? touchDrag.data.text
    : (wizardDraft.items[touchDrag.data.id] && wizardDraft.items[touchDrag.data.id].text) || "";
  document.body.appendChild(ghost);
  touchDrag.ghost = ghost;
  moveGhost(x, y);
}
function moveGhost(x, y) {
  if (!touchDrag.ghost) return;
  touchDrag.ghost.style.left = x + "px";
  touchDrag.ghost.style.top = y + "px";
}
function findSlotUnder(x, y) {
  // 临时隐藏 ghost 才能 elementFromPoint 拿到下层
  if (touchDrag.ghost) touchDrag.ghost.style.display = "none";
  const el = document.elementFromPoint(x, y);
  if (touchDrag.ghost) touchDrag.ghost.style.display = "";
  if (!el) return null;
  return el.closest(".slot[data-slot-key]");
}
function highlightSlotUnder(x, y) {
  document.querySelectorAll(".slot.drop-active").forEach(s => s.classList.remove("drop-active"));
  const slot = findSlotUnder(x, y);
  if (slot) slot.classList.add("drop-active");
}
function resetTouchDrag() {
  if (touchDrag.ghost) { touchDrag.ghost.remove(); touchDrag.ghost = null; }
  if (touchDrag.source) touchDrag.source.classList.remove("dragging");
  document.querySelectorAll(".slot.drop-active").forEach(s => s.classList.remove("drop-active"));
  touchDrag = { active: false, ghost: null, longPressTimer: null, startX: 0, startY: 0, pointerId: null, source: null, data: null };
}

// 纯数据操作：把 dragData 应用到目标 slot，不触发任何渲染
//  - 拆分目的：让浮层场景（onChipPopoverAdd）能跳过全量 renderWizard，只做局部刷新
//  - 返回值：受影响的 slotKey 集合（pool→slot 时只有目标；slot→slot 时含源和目标）
function applyDropToSlot(slotKey) {
  const affected = new Set();
  if (!dragData || !wizardDraft) return affected;
  if (dragData.from === "pool") {
    // 同时段同事项去重：若目标 slot 已有同 text 的 item，给清晰提示并 return（不重复添加）
    // 区分必做项（⭐ 自动落位）vs 普通项，让用户一眼明白为什么"看起来该时段是空的"却被拦截
    const existingIds = wizardDraft.slots[slotKey] || [];
    const dupItem = existingIds.map(eid => wizardDraft.items[eid]).find(it => it && it.text === dragData.text);
    if (dupItem) {
      if (dupItem.isMustDo) {
        toast(`「${dragData.text}」已作为 ⭐ 必做项落在该时段（设置里管理）`);
      } else {
        toast(`「${dragData.text}」已经在该时段了`);
      }
      return affected;
    }
    const id = uid("it");
    const cat = dragData.cat || "active";
    wizardDraft.items[id] = {
      id, text: dragData.text,
      category: cat,
      principle: categoryToPrincipleStatic(cat),
      isMustDo: false, done: false
    };
    if (!wizardDraft.slots[slotKey]) wizardDraft.slots[slotKey] = [];
    wizardDraft.slots[slotKey].push(id);
    affected.add(slotKey);
  } else if (dragData.from === "slot") {
    const fromKey = dragData.key, id = dragData.id;
    if (fromKey === slotKey) return affected;
    // slot→slot 去重：若目标 slot 已有同 text 的 item，给提示并 return（避免移动后重复）
    const draggedItem = wizardDraft.items[id];
    if (draggedItem) {
      const existingIds = wizardDraft.slots[slotKey] || [];
      const dupItem = existingIds.map(eid => eid !== id ? wizardDraft.items[eid] : null).find(it => it && it.text === draggedItem.text);
      if (dupItem) {
        if (dupItem.isMustDo) {
          toast(`「${draggedItem.text}」已作为 ⭐ 必做项落在该时段`);
        } else {
          toast(`「${draggedItem.text}」已经在目标时段了`);
        }
        return affected;
      }
    }
    if (wizardDraft.slots[fromKey]) {
      wizardDraft.slots[fromKey] = wizardDraft.slots[fromKey].filter(x => x !== id);
    }
    if (!wizardDraft.slots[slotKey]) wizardDraft.slots[slotKey] = [];
    wizardDraft.slots[slotKey].push(id);
    affected.add(fromKey);
    affected.add(slotKey);
  }
  return affected;
}

function handleDropToSlot(slotKey) {
  applyDropToSlot(slotKey);
  // 引导：放完事项后看是否要自动跳到下一个未达标的原则 tab
  maybeAutoAdvanceCandTab();
  renderWizard();
}

// === BLOCK 4 END ===
