/* ============================================================
 * BLOCK 3: Step2（吃饭）+ Step3（拖拽填空 UI 渲染）
 * ============================================================ */

/* ---------- Step2: 吃饭 ---------- */
function renderStep2(draft) {
  const dates = eachDate(draft.dateRange.start, draft.dateRange.end);
  const poolsLine = MEAL_POOLS.map(p => `${p.label}：<strong>${state.pools[p.key].length}</strong>`).join(" · ");
  return `
    <div class="card">
      <h2>③ 吃饭安排</h2>
      <p class="subtitle">有想吃的先记下来；没想好的，到时从备选清单里挑就行。</p>

      <div class="row">
        <select class="input shrink" id="mealDate" style="max-width:140px;">
          <option value="">不指定日期</option>
          ${dates.map(d => `<option value="${d}">${fmtDateShort(d)}</option>`).join("")}
        </select>
        <select class="input shrink" id="mealSlot" style="max-width:90px;">
          <option value="">时段</option>
          ${SLOTS.map(s => `<option value="${s}">${SLOT_LABELS[s]}</option>`).join("")}
        </select>
      </div>
      <div class="row" style="margin-top:6px;">
        <input class="input" id="mealText" placeholder="比如：日料 / 火锅（回车快速添加）" onkeydown="if(event.key==='Enter'){event.preventDefault();addMeal();}" />
        <button class="btn shrink" style="flex:0 0 70px;" onclick="addMeal()">添加</button>
      </div>

      <div class="fixed-list" style="margin-top:12px;">
        ${draft.meals.length === 0
          ? `<div class="u-empty-row">还没有指定的吃饭安排</div>`
          : draft.meals.map(m => `
            <div class="fixed-item">
              <span class="text">🍜 ${escapeHtml(m.text)}</span>
              <span class="meta">${m.date ? fmtDateShort(m.date) : '不指定'}${m.slot ? ' · ' + SLOT_LABELS[m.slot] : ''}</span>
              <button class="icon-mini" onclick="removeMeal('${m.id}')">✕</button>
            </div>
          `).join("")}
      </div>

      <div class="hint" style="margin-top:14px;">
        📂 备选清单：${poolsLine}<br/>
        <span class="u-hint-link" onclick="randomMealPicker()">🍴 帮我随便挑一个</span>
        ·
        <span class="u-hint-link" onclick="goSettings()">→ 去设置里管理</span>
      </div>
    </div>
  `;
}

function addMeal() {
  const date = $("#mealDate").value, slot = $("#mealSlot").value;
  const text = $("#mealText").value.trim();
  if (!text) { toast("请输入想吃的"); return; }
  wizardDraft.meals.push({ id: uid("m"), date: date || null, slot: slot || null, text, done: false });
  renderWizard();
}
function removeMeal(id) {
  wizardDraft.meals = wizardDraft.meals.filter(m => m.id !== id);
  renderWizard();
}

/* ---------- 随便吃啥 ----------
 * 交互改造：
 *  - 默认展示当前 tab 下整个池子的所有选项（chip 排列），用户可以先看看
 *  - 用户可以直接点某个 chip 选定（高亮）
 *  - 看不出来 → 点"🎲 帮我随便选一个"按钮 → 自动从池里随机抽，高亮抽中那个
 *  - 抽中后还可以"再抽一个"或"就它了"
 */
// uiState.mealPickerScope/Result 已聚合到 uiState（见 01-core.js）


function randomMealPicker() {
  uiState.mealPickerScope = "all";
  uiState.mealPickerResult = null;
  renderMealPickerModal();
}

function getMealPickerPool() {
  if (uiState.mealPickerScope === "all") {
    // 跨池去重：相同文本只保留一份，from 合并展示
    const map = new Map(); // text → { t, fromLabels:Set }
    MEAL_POOLS.forEach(p => {
      (state.pools[p.key] || []).forEach(t => {
        if (!map.has(t)) map.set(t, { t, fromLabels: new Set() });
        map.get(t).fromLabels.add(p.label);
      });
    });
    return Array.from(map.values()).map(x => ({
      t: x.t,
      from: x.fromLabels.size > 1
        ? Array.from(x.fromLabels).join(" / ")  // 多池时用斜杠拼接
        : Array.from(x.fromLabels)[0]
    }));
  }
  const meta = MEAL_POOLS.find(p => p.key === uiState.mealPickerScope);
  return (state.pools[uiState.mealPickerScope] || []).map(t => ({ t, from: meta?.label || "" }));
}

function setMealPickerScope(scope) {
  uiState.mealPickerScope = scope;
  uiState.mealPickerResult = null; // 切池子清空选择，避免显示一个不在当前池里的高亮
  refreshMealPickerInner();
  document.querySelectorAll(".meal-scope-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.scope === scope);
  });
}

function pickMealItem(text, from) {
  uiState.mealPickerResult = { t: text, from };
  refreshMealPickerInner();
}
function clearMealRoll() {
  uiState.mealPickerResult = null;
  refreshMealPickerInner();
}

function rollMeal() {
  const pool = getMealPickerPool();
  if (pool.length === 0) { uiState.mealPickerResult = null; return; }
  let pick, tries = 0;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
    tries++;
  } while (pool.length > 1 && uiState.mealPickerResult && pick.t === uiState.mealPickerResult.t && tries < 5);
  uiState.mealPickerResult = pick;
  refreshMealPickerInner();
}

function refreshMealPickerInner() {
  const cont = document.getElementById("__mpCont");
  if (cont) cont.innerHTML = mealPickerInnerHtml();
}

function mealPickerInnerHtml() {
  const pool = getMealPickerPool();
  if (pool.length === 0) {
    return `
      <div style="text-align:center;padding:30px 10px;color:var(--text-mute);">
        该池子里还没有选项<br/>
        <span class="u-hint-link" style="font-size:13px;" onclick="goSettings()">→ 去设置里加几个</span>
      </div>
    `;
  }
  // 选中态展示（如果有）
  const resultBlock = uiState.mealPickerResult ? `
    <div class="meal-picker-result">
      <div class="meal-picker-text">${escapeHtml(uiState.mealPickerResult.t)}</div>
      <div class="meal-picker-from">来自：${escapeHtml(uiState.mealPickerResult.from)} · <span style="color:var(--text-mute);cursor:pointer;" onclick="clearMealRoll()">取消</span></div>
    </div>
  ` : `
    <div class="meal-picker-tip">先扫一眼，看着哪个顺眼就点哪个 👇</div>
  `;
  // 池子全展示（chip）
  const chipsHtml = pool.map(({ t, from }) => `
    <div class="meal-chip${uiState.mealPickerResult && uiState.mealPickerResult.t === t ? ' picked' : ''}"
         onclick="pickMealItem('${escapeAttr(t)}','${escapeAttr(from)}')"
         title="${escapeAttr(from)}">
      ${escapeHtml(t)}
    </div>
  `).join("");

  return `
    ${resultBlock}
    <div class="meal-chip-grid">${chipsHtml}</div>
    <button class="btn btn-block btn-roll" style="margin-top:12px;" onclick="rollMeal()">
      🍴 帮我随便选一个${uiState.mealPickerResult ? '（再来一次）' : ''}
    </button>
  `;
}

function renderMealPickerModal() {
  const tabs = [{ key: "all", label: "全部" }].concat(MEAL_POOLS.map(p => ({ key: p.key, label: p.label })));
  modal({
    title: "🍴 吃啥呢",
    body: `
      <div class="meal-scope-tabs">
        ${tabs.map(t => `
          <button class="meal-scope-tab${uiState.mealPickerScope === t.key ? ' active' : ''}"
                  data-scope="${t.key}"
                  onclick="setMealPickerScope('${t.key}')">${t.label}</button>
        `).join("")}
      </div>
      <div id="__mpCont">${mealPickerInnerHtml()}</div>
      <div class="meal-manage-row">
        <a class="meal-go-settings" onclick="goSettings(null, 'mealPicker')" title="到设置里管理菜品池，返回后自动重新打开此弹窗">⚙ 管理菜品 →</a>
      </div>
    `,
    confirmText: "就它了",
    cancelText: "关闭",
    onConfirm: () => {
      if (!uiState.mealPickerResult) { toast("还没选呢"); return; }
      if (wizardDraft && wizardStep >= 2) {
        wizardDraft.meals.push({
          id: uid("m"),
          date: null, slot: null,
          text: uiState.mealPickerResult.t, done: false
        });
        save();
        if (wizardStep === 2) renderWizard();
        toast(`已加入吃饭安排：${uiState.mealPickerResult.t}`);
      } else {
        toast(`选定：${uiState.mealPickerResult.t}`);
      }
    }
  });
}

/* ---------- Step3: 拖拽填空（UI） ----------
 * 候选区改造：
 *  - 顶层按 4 大原则（动一动 / 让大脑歇一下 / 主动做点什么 / 守好周日晚）+ "全部"
 *  - 每个原则 tab 显示进度：已用/总数（原则下任一事项被放过即算）
 *  - 候选区可折叠（默认展开），折叠后清单完全可见
 *  - 进度按"是否安排过该原则"算（要看到原则维度的覆盖情况）
 */
function renderStep3(draft) {
  const dates = eachDate(draft.dateRange.start, draft.dateRange.end);

  // 已被放置的文本集合（旧版用于 chip 灰显，现在保留给 principleStats 用）
  const placedTextSet = new Set();
  // 已加在哪些 slot 的映射：text → [slotKey, ...]
  // PC 方案 A：内联标签罗列；移动方案 B：徽章计数 + 长按抽屉
  const placedSlotsMap = new Map();
  Object.entries(draft.slots).forEach(([slotKey, ids]) => {
    ids.forEach(id => {
      const it = draft.items[id];
      if (!it) return;
      placedTextSet.add(it.text);
      if (!placedSlotsMap.has(it.text)) placedSlotsMap.set(it.text, []);
      placedSlotsMap.get(it.text).push(slotKey);
    });
  });

  // 每个原则下：池里的总数（chip 数） + 已落位的事项中归属本原则的数量
  //  - 池内 chip 是否已用：看文本是否在 placedTextSet
  //  - 池外（必做项+临时项）：用 it.principle 字段（明确归属，没有 → 用兜底，none 不计）
  function principleStats(p) {
    const allPoolTexts = subKeysToTexts(p.subs);
    const total = allPoolTexts.length;
    const poolUsed = allPoolTexts.filter(t => placedTextSet.has(t)).length;
    const poolTextSet = new Set(allPoolTexts);
    const extraUsed = Object.values(draft.items).filter(it => {
      if (poolTextSet.has(it.text)) return false; // 已在 poolUsed 算过
      const pk = it.principle || categoryToPrincipleStatic(it.category);
      return pk === p.key;
    }).length;
    return { total, used: poolUsed + extraUsed };
  }
  function subKeysToTexts(subs) {
    let arr = [];
    subs.forEach(sk => {
      if (sk === "body_high") arr = arr.concat(state.pools.body.high);
      else if (sk === "body_low") arr = arr.concat(state.pools.body.low);
      else arr = arr.concat(state.pools[sk] || []);
    });
    return arr;
  }
  function chipsForPrinciple(pkey) {
    if (pkey === "all") {
      // 全部：4 个原则纵向堆，标题分组
      return PRINCIPLES.map(p => {
        const { used, total } = principleStats(p);
        return `
          <div class="cand-group">
            <div class="cand-group-head">
              <span>${p.label}</span>
              <span class="badge${used >= total && total > 0 ? ' badge-gold' : ''}">${used}/${total}</span>
            </div>
            <div class="pool">${subKeysToChips(p.subs, placedTextSet, placedSlotsMap)}</div>
          </div>
        `;
      }).join("");
    }
    const p = PRINCIPLES.find(x => x.key === pkey);
    if (!p) return "";
    return `<div class="pool">${subKeysToChips(p.subs, placedTextSet, placedSlotsMap)}</div>`;
  }
  function subKeysToChips(subs, placedSet, placedMap) {
    let arr = [];
    subs.forEach(sk => {
      if (sk === "body_high") arr = arr.concat(state.pools.body.high.map(t => ({ t, c: "body_high" })));
      else if (sk === "body_low") arr = arr.concat(state.pools.body.low.map(t => ({ t, c: "body_low" })));
      else arr = arr.concat((state.pools[sk] || []).map(t => ({ t, c: sk })));
    });
    return arr.map(({ t, c }) => {
      // v6 方案 3：根据子分类映射强度等级，用左竖线染色（移动端 CSS 控制）
      //  - body_high → high（红）
      //  - body_low → low（绿）
      //  - 其他 → 不带 intensity，无染色
      const intensity = c === "body_high" ? "high" : c === "body_low" ? "low" : "";
      const intensityCls = intensity ? ` intensity-${intensity}` : "";
      // v7 移动端智能 2 列：> 8 字（中文按 1 计）独占整行，避免 chip 内换行
      // （≤8 字保持双列，9 字及以上才独占整行——常见 6-8 字事项「自己下厨做一顿饭」「整理家里某个角落」也能双列）
      const longCls = (t || "").length > 8 ? " long" : "";
      // v6 方案 3：移动端隐藏 .cat 文字标签，靠左竖线表达强度，避免冗余
      // 桌面端仍显示 .cat（CSS 移动端用 display:none 隐藏）
      const slotKeys = (placedMap && placedMap.get(t)) || [];
      const placedCount = slotKeys.length;
      // PC 方案 A：内联展示已加时段标签（带 ✕，点击可移除该时段）
      const pcTagsHtml = placedCount > 0 ? `
        <span class="chip-placed-tags pc-only">${slotKeys.map(sk => {
          const slotLabel = formatSlotKeyShort(sk);
          return `<span class="chip-placed-tag" onclick="removeFromSlotByText(event, '${escapeAttr(t)}', '${sk}')" title="点击从该时段移除">${escapeHtml(slotLabel)} ✕</span>`;
        }).join("")}</span>
      ` : '';
      // 移动方案 B：右上角数字徽章
      const mobileBadgeHtml = placedCount > 0 ? `<span class="chip-count-badge mobile-only">${placedCount}</span>` : '';
      // 移动方案 B：长按弹底部抽屉（onpointerdown 计时 600ms，未抬起则触发）
      const mobileLongPress = `ontouchstart="onChipTouchStart(event, '${escapeAttr(t)}')" ontouchend="onChipTouchEnd(event)" ontouchcancel="onChipTouchEnd(event)" ontouchmove="onChipTouchMove(event)"`;
      return `
      <div class="chip${placedSet.has(t) ? ' placed' : ''}${intensityCls}${longCls}"
           draggable="true"
           data-src="pool" data-text="${escapeAttr(t)}" data-cat="${c}"
           ${mobileLongPress}>
        <span>${escapeHtml(t)}</span>
        ${subs.length > 1 ? `<span class="cat">${CAT_LABELS[c] || ''}</span>` : ''}
        ${pcTagsHtml}
        <button type="button" class="chip-add-btn"
          onclick="onChipAddClick(event, '${escapeAttr(t)}', '${c}')"
          title="加到当前选中时段">+</button>
        ${mobileBadgeHtml}
      </div>
    `;
    }).join("");
  }

  // 顶部进度：4 大原则覆盖率（按原则下落位的事项数算 used）
  //  - used 算法：draft.items 里 principle === p.key 的数量（含必做项、池内拖入、临时项）
  //  - 显示 used / suggest，达到 suggest 给金色 ok
  function principleUsed(pkey) {
    return Object.values(draft.items).filter(it => {
      const pk = it.principle || categoryToPrincipleStatic(it.category);
      return pk === pkey;
    }).length;
  }
  // 推荐下一个未达标原则（按 PRINCIPLES 顺序找第一个 used < suggest）
  function nextRecommendedPrinciple() {
    return PRINCIPLES.find(p => principleUsed(p.key) < p.suggest);
  }
  const recommended = nextRecommendedPrinciple();
  // A 方案：移动端用 emoji-only 紧凑模式，桌面端保留完整 label
  // 通过 CSS @media 控制显示，这里 HTML 同时输出 emoji 和 label，CSS 隐藏 label
  const principleProgress = PRINCIPLES.map(p => {
    const used = principleUsed(p.key);
    const ok = used >= p.suggest;
    const isRec = recommended && recommended.key === p.key;
    const emoji = (p.label.match(/^\S+/) || [''])[0]; // 第一个字符（emoji）
    return `<span class="principle-pill${ok ? ' ok' : ''}${isRec ? ' rec' : ''}"
      onclick="switchCandTab('${p.key}')"
      title="${p.label}：建议 ${p.suggest}，已安排 ${used}${isRec ? '（建议下一步）' : ''}">
      ${emoji} ${used}/${p.suggest}${ok ? ' ✓' : ''}${isRec ? ' ←' : ''}
    </span>`;
  }).join("");
  const allDone = !recommended;
  // v6 C 方案：guide-hint 主体仍保留（桌面端继续用），但移动端通过 CSS 隐藏，
  // 移动端改在候选区头部（cand-toggle-bar）用更短的 .cand-guide-text 表达同一信息
  const guideHint = allDone
    ? `<div class="guide-hint done">🎉 4 大原则都安排好了，可以点完成；也可以继续加</div>`
    : `<div class="guide-hint">建议下一步：<strong>${recommended.label}</strong>（还差 ${recommended.suggest - principleUsed(recommended.key)} 个）</div>`;
  // v6 C 方案：候选区头部的简短引导文案（移动端取代「候选事项」）
  const candGuideText = allDone
    ? `🎉 4 大原则都安排好了`
    : `💡 建议加 <strong>${recommended.label}</strong>`;
  const candGuideClass = allDone ? "cand-guide-text m-only done" : "cand-guide-text m-only";

  // 日程板（桌面端：显示全部日期 × 全部时段；移动端：A4' 两级 tab，只显示选中那一格）
  // ① 桌面端 board：原逻辑
  const desktopBoard = dates.map(d => `
    <div class="day-block">
      <div class="day-head">
        <span>${fmtDateShort(d)}</span>
        <span class="date-tag">${d}</span>
      </div>
      <div class="slots">
        ${SLOTS.map(s => renderSlot(draft, d, s)).join("")}
      </div>
    </div>
  `).join("");

  // ② 移动端 A4' 两级 tab：懒初始化 currentDate（首次进入或日期范围变化时校准）
  if (!mobileCurrentDate || !dates.includes(mobileCurrentDate)) {
    mobileCurrentDate = dates[0];
  }
  if (!SLOTS.includes(mobileCurrentSlot)) mobileCurrentSlot = "morning";

  // 统计：每天总事项数（含 fixed/meal/items），每时段（当前选中天）的事项数
  function countForDay(d) {
    let n = 0;
    SLOTS.forEach(s => {
      const k = `${d}_${s}`;
      n += (draft.slots[k] || []).length;
      n += draft.fixedItems.filter(f => f.date === d && f.slot === s).length;
      n += draft.meals.filter(m => m.date === d && m.slot === s).length;
    });
    return n;
  }
  function countForSlot(d, s) {
    const k = `${d}_${s}`;
    return (draft.slots[k] || []).length
      + draft.fixedItems.filter(f => f.date === d && f.slot === s).length
      + draft.meals.filter(m => m.date === d && m.slot === s).length;
  }

  const mobileDayTabs = dates.map(d => {
    const cnt = countForDay(d);
    return `<button type="button" class="m-day-tab${d === mobileCurrentDate ? ' active' : ''}"
      onclick="mobileSwitchDate('${d}')">${fmtDateShort(d)}${cnt > 0 ? `<span class="badge">${cnt}</span>` : ''}</button>`;
  }).join("");
  const mobileSlotTabs = SLOTS.map(s => {
    const cnt = countForSlot(mobileCurrentDate, s);
    return `<button type="button" class="m-slot-tab${s === mobileCurrentSlot ? ' active' : ''}"
      onclick="mobileSwitchSlot('${s}')">${SLOT_ICONS[s]} ${SLOT_LABELS[s]}${cnt > 0 ? `<span class="badge">${cnt}</span>` : ''}</button>`;
  }).join("");
  const mobileBoard = `
    <div class="day-block">
      <div class="day-head">
        <span>${fmtDateShort(mobileCurrentDate)}</span>
        <span class="date-tag">${mobileCurrentDate}</span>
      </div>
      <div class="slots" style="grid-template-columns:1fr;">
        ${renderSlot(draft, mobileCurrentDate, mobileCurrentSlot)}
      </div>
    </div>
  `;

  const board = `
    <div class="d-only">${desktopBoard}</div>
    <div class="m-only">
      <div class="m-tabs-wrap">
        <div class="m-day-tabs">${mobileDayTabs}</div>
        <div class="m-slot-tabs">${mobileSlotTabs}</div>
      </div>
      ${mobileBoard}
    </div>
  `;

  // tabs：全部 + 4 大原则（每个 tab 上显示 used/total）
  const tabs = [{ key: "all", label: "全部" }].concat(PRINCIPLES.map(p => ({
    key: p.key, label: p.label, stats: principleStats(p)
  })));

  // A 方案：候选区头部目标提示（移动端显示当前选中的 day + slot）
  // v4 优化：去掉日期，只显示「→ 周日上午」（日期已在底部 day-tab 显示，避免重复）
  const targetHintHtml = `<span class="cand-target-hint" id="candTargetHint">→ ${fmtWeekdayShort(mobileCurrentDate)}${SLOT_LABELS[mobileCurrentSlot]}</span>`;

  // v5 优化（D 方案）：候选区类别 chip 渲染
  //  - 未选中：只显示 emoji（数字隐藏，避免和顶部原则进度条重复，5 个 chip 一行无需横向滚动）
  //  - 选中：emoji + 完整名 + 进度（active 态完整展开）
  //  - 全部：保持文字「全部」
  const renderCatChip = (t) => {
    const isActive = activeCandTab === t.key;
    if (t.key === "all") {
      return `<button class="cand-tab${isActive ? ' active' : ''}" onclick="switchCandTab('${t.key}')">全部</button>`;
    }
    const emoji = t.label.split(' ')[0];
    const name = t.label.split(' ').slice(1).join(' '); // 类别完整名
    const stats = t.stats ? `${t.stats.used}/${t.stats.total}` : '';
    // D 方案：未选中只显示 emoji（紧凑），选中展开 emoji + 名 + 数字
    const inner = isActive
      ? `${emoji} ${name} <span style="opacity:0.7;font-size:10px;margin-left:2px;">${stats}</span>`
      : `${emoji}`;
    return `<button class="cand-tab${isActive ? ' active' : ''}" onclick="switchCandTab('${t.key}')" title="${t.label} ${stats}">${inner}</button>`;
  };

  // v7（移动端最终方案）：候选区头部塞入 4 原则 tab + ▼ + 💡
  //  - 复用 .principle-pill class（refreshPrincipleProgressInPlace 已能命中所有实例）
  //  - 用 .cand-principle-tabs 容器区分头部位置（移动端可见，桌面端 CSS 隐藏）
  //  - 桌面端：仍走顶部 .principle-row，移动端：顶部 #topPrincipleCard 整张隐藏
  //  - v7.1：未选中 tab 加 .icon-only class，CSS 给单 emoji 加宽留白
  const candHeaderPills = PRINCIPLES.map(p => {
    const used = principleUsed(p.key);
    const ok = used >= p.suggest;
    const isRec = recommended && recommended.key === p.key;
    const isActive = activeCandTab === p.key;
    const emoji = (p.label.match(/^\S+/) || [''])[0];
    const name = p.label.split(' ').slice(1).join(' ');
    // 移动端 tab 状态：active 展开「emoji + 中文名 + used/suggest」，未选只显 emoji（加宽）
    const inner = isActive
      ? `${emoji} ${name} ${used}/${p.suggest}${ok ? ' ✓' : ''}`
      : `${emoji}${ok ? ' ✓' : ''}`;
    return `<span class="principle-pill${ok ? ' ok' : ''}${isRec ? ' rec' : ''}${isActive ? ' active' : ' icon-only'}"
      onclick="event.stopPropagation();switchCandTab('${p.key}')"
      title="${p.label}：建议 ${p.suggest}，已安排 ${used}${isRec ? '（建议下一步）' : ''}">
      ${inner}
    </span>`;
  }).join("");

  return `
    <div class="card" id="topPrincipleCard" style="padding:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h2 style="margin:0;font-size:16px;">④ 拖事项进时段</h2>
        <span class="m-only" style="font-size:11px;color:var(--text-mute);">长按拖动（手机）</span>
      </div>
      <details class="principle-mini-help" id="principleMiniHelp">
        <summary>
          <span class="pmh-icon">💡</span>
          <span class="pmh-text">每个原则做 1 件就够，不需要每个都做</span>
          <span class="pmh-more">查看说明</span>
        </summary>
        <div class="pmh-body">
          <div class="pmh-row"><strong>🏃 动一动</strong>—— 防止迟钝疲惫，一天动得多一点、一天轻轻动就够</div>
          <div class="pmh-row"><strong>🧘 让大脑歇一下</strong>—— 真正的休息不是刷手机，是发呆、散步、安静吃饭</div>
          <div class="pmh-row"><strong>✨ 主动做点什么</strong>—— 自己选的事，做完会有踏实感，不会觉得"白过一天"</div>
          <div class="pmh-row"><strong>🌙 守好周日晚</strong>—— 早点睡 + 断开工作消息 + 写下周一最重要的几件事</div>
          <button type="button" class="pmh-link" onclick="goHomeAndOpenAbout()">📖 看完整说明（去首页）→</button>
        </div>
      </details>
      <div class="principle-row">
        ${principleProgress}
        <button type="button" class="a-help-link" onclick="toggleHelpOnMobile(event)" title="查看玩法说明">💡</button>
      </div>
      ${guideHint}
    </div>

    <div class="schedule" data-days="${dates.length}">
      <div class="schedule-grid-header" aria-hidden="true">
        <div class="sgh-corner"></div>
        <div class="sgh-slot sgh-morning">${SLOT_ICONS.morning} ${SLOT_LABELS.morning}</div>
        <div class="sgh-slot sgh-afternoon">${SLOT_ICONS.afternoon} ${SLOT_LABELS.afternoon}</div>
        <div class="sgh-slot sgh-evening">${SLOT_ICONS.evening} ${SLOT_LABELS.evening}</div>
      </div>
      ${board}
    </div>

    <div class="card cand-card${candCollapsed ? ' collapsed' : ''}" id="candCard">
      <div class="cand-toggle-bar" onclick="toggleCandCollapse()">
        <span class="section-title" style="margin:0;">候选事项</span>
        <span class="${candGuideClass}">${candGuideText}</span>
        ${targetHintHtml}
        <div class="cand-principle-tabs">${candHeaderPills}</div>
        <span class="cand-toggle-icon">${candCollapsed ? '▲' : '▼'}</span>
        <button type="button" class="cand-help-btn" onclick="event.stopPropagation();toggleHelpOnMobile(event)" title="查看玩法说明">💡</button>
      </div>
      <div class="cand-body">
        <div class="cand-tabs">
          ${tabs.map(renderCatChip).join("")}
        </div>
        <div id="candPool">
          ${chipsForPrinciple(activeCandTab)}
        </div>
        <div class="adhoc-row">
          <input class="input adhoc-input" id="quickAdd" placeholder="临时加一项（不存备选）" title="临时加个事项（只用一次，不存入备选，回车快速添加）" onkeydown="if(event.key==='Enter'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();quickAddCustom();}" />
          <button class="btn btn-sm shrink adhoc-add" onclick="quickAddCustom()">+</button>
        </div>
        <div class="cand-manage-row">
          <span class="cand-manage-hint">想加常用事项 / 必做项？</span>
          <a class="cand-manage-link" onclick="goSettings()">⚙ 去设置里管理 →</a>
        </div>
      </div>
    </div>
  `;
}

function toggleCandCollapse() {
  candCollapsed = !candCollapsed;
  const card = document.getElementById("candCard");
  if (card) {
    card.classList.toggle("collapsed", candCollapsed);
    const icon = card.querySelector(".cand-toggle-icon");
    if (icon) icon.textContent = candCollapsed ? "▲ 展开" : "▼ 收起";
  }
}

function renderSlot(draft, date, slot) {
  const key = `${date}_${slot}`;
  const ids = draft.slots[key] || [];
  const fixed = draft.fixedItems.filter(f => f.date === date && f.slot === slot);
  const meals = draft.meals.filter(m => m.date === date && m.slot === slot);

  const itemsHtml = ids.map(id => {
    const it = draft.items[id];
    if (!it) return "";
    return `
      <div class="slot-item${it.isMustDo ? ' must' : ''}"
           draggable="true" data-src="slot" data-id="${it.id}" data-key="${key}">
        ${it.isMustDo ? '⭐ ' : ''}${escapeHtml(it.text)}
        <button class="x" onclick="removeFromSlot('${key}','${it.id}')">✕</button>
      </div>
    `;
  }).join("");

  const fixedHtml = fixed.map(f => `
    <div class="slot-item pin">
      📌 ${escapeHtml(f.text)}
    </div>
  `).join("");

  const mealHtml = meals.map(m => `
    <div class="slot-item meal">
      🍜 ${escapeHtml(m.text)}
    </div>
  `).join("");

  return `
    <div class="slot" data-slot-key="${key}">
      <div class="slot-head">
        <span><span class="icon">${SLOT_ICONS[slot]}</span> ${SLOT_LABELS[slot]}</span>
      </div>
      <div class="slot-items">
        ${fixedHtml}${mealHtml}${itemsHtml}
      </div>
    </div>
  `;
}

function switchCandTab(c) {
  activeCandTab = c;
  // 切到具体原则时自动展开候选区（折叠状态下用户切 tab 看不到内容）
  if (c !== "all" && candCollapsed) candCollapsed = false;
  renderWizard();
}

// 移动端：切换当前选中的「日」
//  - bug 修复：切换到新一天时，自动选择该天「最早还没排满的时段」，而不是延续上一天的时段
//  - 例：周六晚上规划完点周日 → 应跳到周日上午（而不是周日晚上）
//  - 全部排满时保持当前 slot
function mobileSwitchDate(d) {
  mobileCurrentDate = d;
  if (wizardDraft) {
    const draft = wizardDraft;
    const slotItemCount = (date, slot) =>
      (draft.slots[`${date}_${slot}`] || []).length
      + draft.fixedItems.filter(f => f.date === date && f.slot === slot).length
      + draft.meals.filter(m => m.date === date && m.slot === slot).length;
    // 找到该天第一个为空的时段
    const firstEmpty = SLOTS.find(s => slotItemCount(d, s) === 0);
    if (firstEmpty) mobileCurrentSlot = firstEmpty;
    // 全排满：保持当前 slot 不变
  }
  renderWizard();
}
// 移动端：切换当前选中的「时段」
function mobileSwitchSlot(s) {
  mobileCurrentSlot = s;
  renderWizard();
}

// 候选 chip 上 + 按钮的统一入口：
//  - 移动端：直接加到当前选中「日 + 时段」（withRender=true，全量重渲染更新 badge/进度条）
//  - 桌面端：弹出浮层让用户选具体时段
function onChipAddClick(e, text, cat) {
  e.stopPropagation();
  e.preventDefault();
  if (!wizardDraft) return;
  // PC 端 + 移动端：统一为「加到当前选中时段」一次（PC 不再弹浮层；想加多个时段 → PC 拖拽 / 移动端切 tab 再点 +）
  // 移动端：当前 day-tab + slot-tab 选中的时段
  // PC 端：mobileCurrentDate / mobileCurrentSlot 在 PC 也维护着「当前 focus 时段」（默认第一天上午），这里复用
  const slotKey = `${mobileCurrentDate}_${mobileCurrentSlot}`;
  addPoolItemToSlot(text, cat, slotKey, true);
  toast(`✓ 已加到 ${fmtWeekdayShort(mobileCurrentDate)}${SLOT_LABELS[mobileCurrentSlot]}`);
}

// 公用：把候选项加到指定 slot（复用底层数据操作）
//  - withRender=true：移动端 + 按钮场景，需要全量重渲染（mobileBoard 要更新 badge）
//  - withRender=false：桌面浮层场景，浮层路径会自己做局部刷新，避免全量重渲染销毁浮层
function addPoolItemToSlot(text, cat, slotKey, withRender = true) {
  if (!wizardDraft) return;
  const prevDragData = dragData;
  dragData = { from: "pool", text, cat };
  if (withRender) {
    handleDropToSlot(slotKey);
  } else {
    applyDropToSlot(slotKey);
  }
  dragData = prevDragData;
}

// 桌面端候选项浮层：点 chip 上的 + 弹出，让用户选目标时段
//  - 浮层挂在 chip 内部（chip 已 position:relative）
//  - P1-#5: 局部更新，不调用 renderWizard，避免浮层闪烁销毁
//  - P1-#7: 按天分组渲染，每行一天 × 3 时段
function showChipPopover(chipEl, text, cat) {
  // 关掉所有已打开的浮层
  closeAllChipPopovers();
  if (!wizardDraft) return;
  const dates = eachDate(wizardDraft.dateRange.start, wizardDraft.dateRange.end);
  const popover = document.createElement("div");
  popover.className = "chip-popover";
  popover.dataset.text = text;
  popover.dataset.cat = cat;
  popover.onclick = e => e.stopPropagation();
  popover.innerHTML = `
    <div class="chip-popover-title">把「${escapeHtml(text)}」加到：</div>
    <div class="chip-popover-body">${renderChipPopoverBody(text, cat, dates)}</div>
  `;
  chipEl.appendChild(popover);
  openChipPopoverText = text;
}

// 抽离 body 渲染，方便局部刷新
function renderChipPopoverBody(text, cat, dates) {
  const placedSlots = new Set();
  Object.entries(wizardDraft.slots).forEach(([k, ids]) => {
    if (ids.some(id => wizardDraft.items[id] && wizardDraft.items[id].text === text)) {
      placedSlots.add(k);
    }
  });
  // P1-#7: 每行一天，标签 + 3 时段并排
  return dates.map(d => {
    const cells = SLOTS.map(s => {
      const key = `${d}_${s}`;
      const added = placedSlots.has(key);
      return `<button type="button" class="chip-popover-btn${added ? ' added' : ''}"
        data-slot-key="${key}"
        onclick="onChipPopoverAdd(event, '${escapeAttr(text)}', '${cat}', '${key}')">
        ${SLOT_ICONS[s]} ${SLOT_LABELS[s]}${added ? ' ✓' : ''}
      </button>`;
    }).join("");
    return `<div class="chip-popover-row">
      <div class="chip-popover-row-label">${fmtDateShort(d)}</div>
      ${cells}
    </div>`;
  }).join("");
}

function closeAllChipPopovers() {
  document.querySelectorAll(".chip-popover").forEach(el => el.remove());
  openChipPopoverText = null;
}

// P1-#5：浮层场景的局部更新（完全不调用 renderWizard，避免浮层闪烁销毁）
//  - 步骤：① 数据操作 ② 局部刷新涉及的所有 DOM
//  - 删除分支保留原 maybeAutoSwitchAfterRemove 逻辑，但不让它影响候选区 DOM；
//    activeCandTab 变化只记下来，浮层关闭时再生效（重渲染候选区）
function onChipPopoverAdd(e, text, cat, slotKey) {
  e.stopPropagation();
  if (!wizardDraft) return;
  const ids = wizardDraft.slots[slotKey] || [];
  const existsId = ids.find(id => wizardDraft.items[id] && wizardDraft.items[id].text === text);
  const affectedSlots = new Set([slotKey]);
  if (existsId) {
    // 已加 → 移除（纯数据，不调 renderWizard）
    wizardDraft.slots[slotKey] = ids.filter(x => x !== existsId);
    delete wizardDraft.items[existsId];
    // 记录 activeCandTab 变化（浮层关闭时再 apply）
    const prevTab = activeCandTab;
    maybeAutoSwitchAfterRemove();
    if (prevTab !== activeCandTab) candTabChangedDuringPopover = true;
  } else {
    // 加入（纯数据，不调 renderWizard）
    addPoolItemToSlot(text, cat, slotKey, false);
  }
  // 局部刷新所有受影响 DOM：① 浮层 body ② 候选区同 text chip 的 placed ③ slot 卡片 ④ 顶部进度条 + guide-hint ⑤ 候选 tab 计数
  refreshPopoverInPlace(text, cat);
  refreshChipPlacedState(text);
  affectedSlots.forEach(k => refreshSlotCard(k));
  refreshPrincipleProgressInPlace();
  refreshCandTabCounts();
}

// 局部刷新浮层 body（用 CSS.escape 处理 text 中可能的特殊字符）
function refreshPopoverInPlace(text, cat) {
  const popover = document.querySelector(`.chip-popover[data-text="${cssEscape(text)}"]`);
  if (!popover) return;
  const body = popover.querySelector(".chip-popover-body");
  if (!body) return;
  const dates = eachDate(wizardDraft.dateRange.start, wizardDraft.dateRange.end);
  body.innerHTML = renderChipPopoverBody(text, cat, dates);
}

// 同步候选区所有同 text chip 的 placed class、PC 已加标签、移动端徽章
function refreshChipPlacedState(text) {
  if (!wizardDraft) return;
  // 收集该 text 落在哪些 slot
  const slotKeys = [];
  Object.entries(wizardDraft.slots).forEach(([sk, ids]) => {
    if (ids.some(id => wizardDraft.items[id] && wizardDraft.items[id].text === text)) {
      slotKeys.push(sk);
    }
  });
  const placed = slotKeys.length > 0;
  document.querySelectorAll(`.chip[data-text="${cssEscape(text)}"]`).forEach(chip => {
    chip.classList.toggle("placed", placed);
    // 更新 PC 内联标签
    let tagsEl = chip.querySelector(".chip-placed-tags");
    if (placed) {
      const tagsHtml = slotKeys.map(sk => {
        const label = formatSlotKeyShort(sk);
        return `<span class="chip-placed-tag" onclick="removeFromSlotByText(event, '${escapeAttr(text)}', '${sk}')" title="点击从该时段移除">${escapeHtml(label)} ✕</span>`;
      }).join("");
      if (!tagsEl) {
        tagsEl = document.createElement("span");
        tagsEl.className = "chip-placed-tags pc-only";
        // 插到 chip-add-btn 之前
        const addBtn = chip.querySelector(".chip-add-btn");
        if (addBtn) chip.insertBefore(tagsEl, addBtn);
        else chip.appendChild(tagsEl);
      }
      tagsEl.innerHTML = tagsHtml;
    } else if (tagsEl) {
      tagsEl.remove();
    }
    // 更新移动端徽章
    let badgeEl = chip.querySelector(".chip-count-badge");
    if (placed) {
      if (!badgeEl) {
        badgeEl = document.createElement("span");
        badgeEl.className = "chip-count-badge mobile-only";
        chip.appendChild(badgeEl);
      }
      badgeEl.textContent = String(slotKeys.length);
    } else if (badgeEl) {
      badgeEl.remove();
    }
  });
}

// 把 slotKey（"2025-05-10_morning"）格式化成短标签（"周六上"）
function formatSlotKeyShort(slotKey) {
  const idx = slotKey.lastIndexOf("_");
  const date = slotKey.slice(0, idx);
  const slot = slotKey.slice(idx + 1);
  const wk = fmtWeekdayShort(date); // "周六"
  const slotShort = slot === "morning" ? "上" : slot === "afternoon" ? "下" : "晚";
  return `${wk}${slotShort}`;
}

// PC 方案 A：点 chip 内的「时段标签 ✕」直接从该 slot 移除该 text 对应的 item
function removeFromSlotByText(e, text, slotKey) {
  e.stopPropagation();
  e.preventDefault();
  if (!wizardDraft) return;
  const ids = wizardDraft.slots[slotKey] || [];
  const targetId = ids.find(id => wizardDraft.items[id] && wizardDraft.items[id].text === text);
  if (!targetId) return;
  const it = wizardDraft.items[targetId];
  const doRemove = () => {
    wizardDraft.slots[slotKey] = ids.filter(x => x !== targetId);
    delete wizardDraft.items[targetId];
    maybeAutoSwitchAfterRemove();
    // 局部刷新：chip 标签 + slot 卡片 + 进度条 + tab 计数
    refreshChipPlacedState(text);
    refreshSlotCard(slotKey);
    refreshPrincipleProgressInPlace();
    refreshCandTabCounts();
    toast(`已从 ${formatSlotKeyShort(slotKey)} 移除`);
  };
  if (it && it.isMustDo) {
    confirmDanger(`"${it.text}" 是必做项。从这份清单移除不会影响其他清单（设置里仍保留）。继续？`, doRemove);
  } else {
    doRemove();
  }
}

// ========== 移动端方案 B：长按 chip 弹底部抽屉 ==========
// 以下 3 个状态仅在 03-step2-step3.js 内部使用（候选区 chip 长按检测）
// 不进 uiState：纯实现细节，外部不应感知
let chipLongPressTimer = null;
let chipLongPressStart = null;
let chipLongPressFired = false;

function onChipTouchStart(e, text) {
  if (!isMobileLayout()) return;
  chipLongPressFired = false;
  const t = e.touches && e.touches[0];
  chipLongPressStart = t ? { x: t.clientX, y: t.clientY } : null;
  if (chipLongPressTimer) clearTimeout(chipLongPressTimer);
  chipLongPressTimer = setTimeout(() => {
    chipLongPressFired = true;
    openChipSlotsSheet(text);
    // 触感反馈
    if (navigator.vibrate) try { navigator.vibrate(20); } catch (_) {}
  }, 500);
}

function onChipTouchMove(e) {
  if (!chipLongPressStart || !chipLongPressTimer) return;
  const t = e.touches && e.touches[0];
  if (!t) return;
  const dx = Math.abs(t.clientX - chipLongPressStart.x);
  const dy = Math.abs(t.clientY - chipLongPressStart.y);
  // 移动超过 10px 视为滑动，取消长按
  if (dx > 10 || dy > 10) {
    clearTimeout(chipLongPressTimer);
    chipLongPressTimer = null;
  }
}

function onChipTouchEnd(e) {
  if (chipLongPressTimer) {
    clearTimeout(chipLongPressTimer);
    chipLongPressTimer = null;
  }
  // 如果触发了长按，阻止后续 click（避免长按完又触发 + 按钮）
  if (chipLongPressFired) {
    e.preventDefault();
    e.stopPropagation();
  }
  chipLongPressStart = null;
}

// 打开移动端「该事项已加在哪些时段」抽屉
function openChipSlotsSheet(text) {
  if (!wizardDraft) return;
  closeChipSlotsSheet();
  const slotKeys = [];
  Object.entries(wizardDraft.slots).forEach(([sk, ids]) => {
    if (ids.some(id => wizardDraft.items[id] && wizardDraft.items[id].text === text)) {
      slotKeys.push(sk);
    }
  });
  const overlay = document.createElement("div");
  overlay.className = "chip-sheet-overlay";
  overlay.id = "chipSheetOverlay";
  overlay.onclick = closeChipSlotsSheet;
  const sheet = document.createElement("div");
  sheet.className = "chip-sheet";
  sheet.onclick = e => e.stopPropagation();
  const itemsHtml = slotKeys.length === 0
    ? `<div class="chip-sheet-empty">还没加到任何时段</div>`
    : slotKeys.map(sk => `
        <div class="chip-sheet-row">
          <span class="chip-sheet-slot">${escapeHtml(formatSlotKeyShort(sk))}</span>
          <button type="button" class="chip-sheet-del" onclick="removeFromSlotByTextMobile(event, '${escapeAttr(text)}', '${sk}')">移除</button>
        </div>
      `).join("");
  sheet.innerHTML = `
    <div class="chip-sheet-handle"></div>
    <div class="chip-sheet-title">「${escapeHtml(text)}」已加在</div>
    <div class="chip-sheet-list">${itemsHtml}</div>
    <button type="button" class="chip-sheet-close" onclick="closeChipSlotsSheet()">关闭</button>
  `;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  // 触发动画
  requestAnimationFrame(() => overlay.classList.add("show"));
}

function closeChipSlotsSheet() {
  const ov = document.getElementById("chipSheetOverlay");
  if (ov) ov.remove();
}

// 移动端抽屉里点「移除」：删完后局部刷新抽屉自身
function removeFromSlotByTextMobile(e, text, slotKey) {
  e.stopPropagation();
  e.preventDefault();
  if (!wizardDraft) return;
  const ids = wizardDraft.slots[slotKey] || [];
  const targetId = ids.find(id => wizardDraft.items[id] && wizardDraft.items[id].text === text);
  if (!targetId) return;
  const it = wizardDraft.items[targetId];
  const doRemove = () => {
    wizardDraft.slots[slotKey] = ids.filter(x => x !== targetId);
    delete wizardDraft.items[targetId];
    maybeAutoSwitchAfterRemove();
    refreshChipPlacedState(text);
    refreshSlotCard(slotKey);
    refreshPrincipleProgressInPlace();
    refreshCandTabCounts();
    // 抽屉局部刷新（重开一次）
    const stillSlotKeys = [];
    Object.entries(wizardDraft.slots).forEach(([sk, _ids]) => {
      if (_ids.some(id => wizardDraft.items[id] && wizardDraft.items[id].text === text)) {
        stillSlotKeys.push(sk);
      }
    });
    if (stillSlotKeys.length > 0) {
      openChipSlotsSheet(text);
    } else {
      closeChipSlotsSheet();
      toast(`已全部移除`);
    }
  };
  if (it && it.isMustDo) {
    confirmDanger(`"${it.text}" 是必做项。从这份清单移除不会影响其他清单（设置里仍保留）。继续？`, doRemove);
  } else {
    doRemove();
  }
}

// 局部重渲染单个 slot 卡片
//  - 不调 bindDnD（避免重复绑全局监听）
//  - 桌面端：单独给新 slot 绑 dragover/drop（slot-item 的 dragstart 也需要）
function refreshSlotCard(slotKey) {
  const slot = document.querySelector(`.slot[data-slot-key="${cssEscape(slotKey)}"]`);
  if (!slot) return;
  const idx = slotKey.lastIndexOf("_");
  const date = slotKey.slice(0, idx);
  const slotName = slotKey.slice(idx + 1);
  const html = renderSlot(wizardDraft, date, slotName);
  const tmp = document.createElement("div");
  tmp.innerHTML = html.trim();
  const newSlot = tmp.firstElementChild;
  slot.replaceWith(newSlot);
  // 桌面端：单独给新 slot 绑事件（移动端跳过）
  if (!isMobileLayout()) bindSlotDnDLocal(newSlot);
}

// 给单个 slot 节点绑定拖拽事件（不影响全局监听，避免 bindDnD 重复绑定）
function bindSlotDnDLocal(slot) {
  // slot-item dragstart/dragend
  slot.querySelectorAll(".slot-item[draggable]").forEach(el => {
    el.addEventListener("dragstart", e => {
      dragData = { from: "slot", id: el.dataset.id, key: el.dataset.key };
      el.classList.add("dragging");
      try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "x"); } catch (_) {}
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
      dragData = null;
      document.querySelectorAll(".slot.drop-active").forEach(s => s.classList.remove("drop-active"));
    });
  });
  // slot 自身 dragover/dragleave/drop
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
}

// 局部刷新顶部进度条 .principle-row + .guide-hint
//  - 完全复刻 renderStep3 中的进度条 / guide-hint 生成逻辑
function refreshPrincipleProgressInPlace() {
  if (!wizardDraft) return;
  const draft = wizardDraft;
  const usedOf = (pkey) => Object.values(draft.items).filter(it => {
    const pk = it.principle || categoryToPrincipleStatic(it.category);
    return pk === pkey;
  }).length;
  const recommended = PRINCIPLES.find(p => usedOf(p.key) < p.suggest);

  const row = document.querySelector(".principle-row");
  if (row) {
    row.innerHTML = PRINCIPLES.map(p => {
      const used = usedOf(p.key);
      const ok = used >= p.suggest;
      const isRec = recommended && recommended.key === p.key;
      return `<span class="principle-pill${ok ? ' ok' : ''}${isRec ? ' rec' : ''}"
        onclick="switchCandTab('${p.key}')"
        title="${p.label}：建议 ${p.suggest}，已安排 ${used}${isRec ? '（建议下一步）' : ''}">
        ${p.label.split(' ')[0]} ${used}/${p.suggest}${ok ? ' ✓' : ''}${isRec ? ' ←' : ''}
      </span>`;
    }).join("");
  }
  // v7：同步更新候选区头部那份 4 原则 tab（移动端可见）
  // v7.1：未选中 tab 加 .icon-only class
  const candTabsRow = document.querySelector(".cand-principle-tabs");
  if (candTabsRow) {
    candTabsRow.innerHTML = PRINCIPLES.map(p => {
      const used = usedOf(p.key);
      const ok = used >= p.suggest;
      const isRec = recommended && recommended.key === p.key;
      const isActive = activeCandTab === p.key;
      const emoji = (p.label.match(/^\S+/) || [''])[0];
      const name = p.label.split(' ').slice(1).join(' ');
      const inner = isActive
        ? `${emoji} ${name} ${used}/${p.suggest}${ok ? ' ✓' : ''}`
        : `${emoji}${ok ? ' ✓' : ''}`;
      return `<span class="principle-pill${ok ? ' ok' : ''}${isRec ? ' rec' : ''}${isActive ? ' active' : ' icon-only'}"
        onclick="event.stopPropagation();switchCandTab('${p.key}')"
        title="${p.label}：建议 ${p.suggest}，已安排 ${used}${isRec ? '（建议下一步）' : ''}">
        ${inner}
      </span>`;
    }).join("");
  }

  const hint = document.querySelector(".guide-hint");
  if (hint) {
    if (!recommended) {
      hint.className = "guide-hint done";
      hint.innerHTML = `🎉 4 大原则都安排好了，可以点完成；也可以继续加`;
    } else {
      hint.className = "guide-hint";
      hint.innerHTML = `建议下一步：<strong>${recommended.label}</strong>（还差 ${recommended.suggest - usedOf(recommended.key)} 个）`;
    }
  }
  // v6 C 方案：同步更新候选区头部的简短引导文案（移动端可见）
  const candGuide = document.querySelector(".cand-guide-text");
  if (candGuide) {
    if (!recommended) {
      candGuide.className = "cand-guide-text m-only done";
      candGuide.innerHTML = `🎉 4 大原则都安排好了`;
    } else {
      candGuide.className = "cand-guide-text m-only";
      candGuide.innerHTML = `💡 建议加 <strong>${recommended.label}</strong>`;
    }
  }
}

// 局部刷新候选 tab 上的 used/total 数字 + 候选区头部 badge
function refreshCandTabCounts() {
  if (!wizardDraft) return;
  // 计算每个原则的 stats（复刻 principleStats 调用）
  PRINCIPLES.forEach(p => {
    const stats = principleStats(p);
    // tab 内 small 数字
    document.querySelectorAll(`.cand-tab`).forEach(btn => {
      // 通过 onclick 中的 key 匹配
      const onclick = btn.getAttribute("onclick") || "";
      if (onclick.includes(`'${p.key}'`)) {
        const sp = btn.querySelector("span");
        if (sp) sp.textContent = `${stats.used}/${stats.total}`;
      }
    });
    // 头部 badge：通过 label 前缀匹配
    const labelPrefix = p.label.split(" ")[0];
    document.querySelectorAll("#candCard .cand-toggle-bar .badge").forEach(b => {
      if (b.textContent.trim().startsWith(labelPrefix)) {
        b.textContent = `${labelPrefix} ${stats.used}/${stats.total}`;
        b.classList.toggle("badge-gold", stats.used >= stats.total && stats.total > 0);
      }
    });
  });
}

// CSS 选择器值转义：处理 text 中可能含有的引号、反斜杠等特殊字符
//  - 现代浏览器都有 CSS.escape；老浏览器降级用手动转义
function cssEscape(s) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(String(s));
  return String(s).replace(/["\\]/g, "\\$&");
}

// 标记位：浮层期间 activeCandTab 是否被 maybeAutoSwitchAfterRemove 切过
//  - true 时浮层关闭后需要全量 renderWizard，让候选区切到新 tab
// 仅 03 内部使用（PC 浮层关闭时的"是否需要全量重渲染"判断），不进 uiState
let candTabChangedDuringPopover = false;

// 全局点击关闭浮层（点空白处）
if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    if (openChipPopoverText && !e.target.closest(".chip-popover") && !e.target.closest(".chip-add-btn")) {
      closeAllChipPopovers();
      // 浮层关闭时，若 candTab 在期间被切走，则全量 renderWizard 一次（这时无浮层不会闪）
      if (candTabChangedDuringPopover) {
        candTabChangedDuringPopover = false;
        renderWizard();
      }
    }
  });
}

// 在 Step3 拖完后自动跳到下一个未达标原则的 tab
//  - 仅当当前 activeCandTab 是具体原则、且该原则已达建议数时触发
//  - 仅在向导 step3 时生效
function maybeAutoAdvanceCandTab() {
  if (view !== "wizard" || wizardStep !== 3 || !wizardDraft) return;
  if (activeCandTab === "all") return;
  const cur = PRINCIPLES.find(p => p.key === activeCandTab);
  if (!cur) return;
  const used = Object.values(wizardDraft.items).filter(it => {
    const pk = it.principle || categoryToPrincipleStatic(it.category);
    return pk === cur.key;
  }).length;
  if (used < cur.suggest) return; // 还没达标
  // 找下一个未达标
  const next = PRINCIPLES.find(p => {
    const u = Object.values(wizardDraft.items).filter(it => {
      const pk = it.principle || categoryToPrincipleStatic(it.category);
      return pk === p.key;
    }).length;
    return u < p.suggest;
  });
  if (next) {
    activeCandTab = next.key;
    toast(`✅ ${cur.label} 已安排 → 下一个：${next.label.split(' ')[1] || next.label}`);
  } else {
    activeCandTab = "all";
    toast(`🎉 4 大原则都安排好了`);
  }
}

// 默认 tab：如果是首次进入 step3，选第一个未达标的原则；否则保留用户上次选择
function pickInitialCandTab(draft) {
  if (!draft) return "all";
  const next = PRINCIPLES.find(p => {
    const u = Object.values(draft.items).filter(it => {
      const pk = it.principle || categoryToPrincipleStatic(it.category);
      return pk === p.key;
    }).length;
    return u < p.suggest;
  });
  return next ? next.key : "all";
}

// 删除事项后自动重新评估 candTab：
//  - 如果当前是 "all"：当有原则因为删除变得未达标时，自动跳到第一个未达标原则，引导用户继续安排
//  - 如果当前停在某个具体原则 tab：
//      a) 该原则被删空/未达标 → 保持原 tab（用户正好可以继续从这个池子里选）
//      b) 该原则仍达标 → 跳到下一个未达标原则；都达标则切回 "all"
//  - 仅在向导 step3 时生效
function maybeAutoSwitchAfterRemove() {
  if (view !== "wizard" || wizardStep !== 3 || !wizardDraft) return;
  const usedOf = (pkey) => Object.values(wizardDraft.items).filter(it => {
    const pk = it.principle || categoryToPrincipleStatic(it.category);
    return pk === pkey;
  }).length;
  const firstUnmet = PRINCIPLES.find(p => usedOf(p.key) < p.suggest);

  if (activeCandTab === "all") {
    // 全局视图：发现有未达标的就主动跳过去
    if (firstUnmet) {
      activeCandTab = firstUnmet.key;
      toast(`↩️ ${firstUnmet.label} 还差一个，已切到对应候选`);
    }
    return;
  }
  // 当前停在某个具体原则
  const cur = PRINCIPLES.find(p => p.key === activeCandTab);
  if (!cur) return;
  if (usedOf(cur.key) < cur.suggest) {
    // 当前原则正好需要补，留在原 tab，不打扰
    return;
  }
  // 当前原则已达标 → 跳下一个未达标
  if (firstUnmet) {
    activeCandTab = firstUnmet.key;
    toast(`↩️ 已切到 ${firstUnmet.label}（还差一个）`);
  } else {
    activeCandTab = "all";
  }
}

// 默认 tab 改为 "all"，兼容旧 activeCandTab 值（如 body_high）
if (!["all", "body", "blank", "active", "sundayNight"].includes(activeCandTab)) {
  activeCandTab = "all";
}

function quickAddCustom() {
  const t = $("#quickAdd").value.trim();
  if (!t) return;
  // 加到「用户当前所在时段」：
  //  - 移动端：mobileCurrentDate + mobileCurrentSlot（用户用 day-tab/slot-tab 切到哪就加哪）
  //  - 桌面端：mobile* 状态依然有维护（renderStep3 里懒初始化），所以直接复用即可，
  //    至少不会再粗暴扔到「第一天上午」
  //  - 兜底：万一 mobile* 还没初始化（极端情况），退回到日期范围第一天上午
  const dates = eachDate(wizardDraft.dateRange.start, wizardDraft.dateRange.end);
  const targetDate = (mobileCurrentDate && dates.includes(mobileCurrentDate))
    ? mobileCurrentDate
    : dates[0];
  const targetSlot = SLOTS.includes(mobileCurrentSlot) ? mobileCurrentSlot : "morning";

  const id = uid("it");
  wizardDraft.items[id] = { id, text: t, category: "active", isMustDo: false, done: false };
  const key = `${targetDate}_${targetSlot}`;
  if (!wizardDraft.slots[key]) wizardDraft.slots[key] = [];
  wizardDraft.slots[key].push(id);
  renderWizard();
  // toast 用「日期 + 时段」给用户明确反馈
  toast(`已加到 ${fmtDateShort(targetDate)} ${SLOT_LABELS[targetSlot]}`);
}

function removeFromSlot(slotKey, itemId) {
  const it = wizardDraft.items[itemId];
  if (!it) return;
  const doRemove = () => {
    const arr = wizardDraft.slots[slotKey];
    if (arr) wizardDraft.slots[slotKey] = arr.filter(x => x !== itemId);
    delete wizardDraft.items[itemId];
    // 删除后重新评估候选 tab：如果当前 tab 已不需要补、或者其他原则因为这次删除变得未达标，自动切到需要补的那个
    maybeAutoSwitchAfterRemove();
    renderWizard();
  };
  if (it.isMustDo) {
    confirmDanger(
      `"${it.text}" 是必做项。从这份清单移除不会影响其他清单（设置里仍保留）。继续？`,
      doRemove
    );
  } else {
    doRemove();
  }
}

// === BLOCK 3 END ===
