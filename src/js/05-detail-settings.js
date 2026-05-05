/* ============================================================
 * BLOCK 5: 清单详情（勾选/复制 markdown）+ 设置页
 * ============================================================ */

/* ---------- 清单详情 ---------- */
function renderDetail() {
  const list = state.lists.find(l => l.id === currentListId);
  if (!list) { goHome(); return; }
  $("#detailTitle").textContent = list.name;
  const dates = eachDate(list.dateRange.start, list.dateRange.end);
  const p = listProgress(list);

  const days = dates.map(d => {
    const slotsHtml = SLOTS.map(s => {
      const key = `${d}_${s}`;
      const ids = list.slots[key] || [];
      const fixed = list.fixedItems.filter(f => f.date === d && f.slot === s);
      const meals = list.meals.filter(m => m.date === d && m.slot === s);
      if (!ids.length && !fixed.length && !meals.length) return "";
      return `
        <div class="section-title" style="margin:8px 0 4px;">
          <span>${SLOT_ICONS[s]} ${SLOT_LABELS[s]}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          ${fixed.map(f => `
            <div class="detail-item${f.done ? ' done' : ''}" onclick="toggleFixedDone('${f.id}')">
              <div class="check">${f.done ? '✓' : ''}</div>
              <span class="text">📌 ${escapeHtml(f.text)}</span>
            </div>
          `).join("")}
          ${meals.map(m => `
            <div class="detail-item${m.done ? ' done' : ''}" onclick="toggleMealDone('${m.id}')">
              <div class="check">${m.done ? '✓' : ''}</div>
              <span class="text">🍜 ${escapeHtml(m.text)}</span>
            </div>
          `).join("")}
          ${ids.map(id => {
            const it = list.items[id];
            if (!it) return "";
            return `
              <div class="detail-item${it.done ? ' done' : ''}" onclick="toggleItemDone('${it.id}')">
                <div class="check">${it.done ? '✓' : ''}</div>
                <span class="text">${it.isMustDo ? '⭐ ' : ''}${escapeHtml(it.text)}</span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }).join("");

    // 列出未指定时段的吃饭（date 对应 d，slot 为空）
    const noSlotMeals = list.meals.filter(m => m.date === d && !m.slot);
    const noSlotHtml = noSlotMeals.length ? `
      <div class="section-title" style="margin:8px 0 4px;">🍜 当天吃饭（未指定时段）</div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        ${noSlotMeals.map(m => `
          <div class="detail-item${m.done ? ' done' : ''}" onclick="toggleMealDone('${m.id}')">
            <div class="check">${m.done ? '✓' : ''}</div>
            <span class="text">🍜 ${escapeHtml(m.text)}</span>
          </div>
        `).join("")}
      </div>
    ` : "";

    return `
      <div class="day-block">
        <div class="day-head">
          <span>${fmtDateShort(d)}</span>
          <span class="date-tag">${d}</span>
        </div>
        ${slotsHtml || `<div style="color:var(--text-mute);font-size:12px;text-align:center;padding:6px;">这天暂时没有安排</div>`}
        ${noSlotHtml}
      </div>
    `;
  }).join("");

  // 不指定日期的吃饭
  const floatMeals = list.meals.filter(m => !m.date);
  const floatHtml = floatMeals.length ? `
    <div class="card">
      <h2>🍜 想吃的（不指定日期）</h2>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:8px;">
        ${floatMeals.map(m => `
          <div class="detail-item${m.done ? ' done' : ''}" onclick="toggleMealDone('${m.id}')">
            <div class="check">${m.done ? '✓' : ''}</div>
            <span class="text">🍜 ${escapeHtml(m.text)}</span>
          </div>
        `).join("")}
      </div>
      ${state.defaultMeal ? `<div class="hint">🏠 默认懒人选项：${escapeHtml(state.defaultMeal)}</div>` : ''}
    </div>
  ` : (state.defaultMeal ? `<div class="card hint">🏠 没想好吃啥？默认懒人选项：<strong>${escapeHtml(state.defaultMeal)}</strong></div>` : '');

  $("#detailBody").innerHTML = `
    <div class="card">
      <div class="row">
        <div style="flex:1;">
          <div style="font-size:12px;color:var(--text-soft);">${fmtDateShort(list.dateRange.start)} ~ ${fmtDateShort(list.dateRange.end)}</div>
          <div class="progress" style="margin-top:8px;height:6px;background:var(--bg-soft);border-radius:3px;overflow:hidden;">
            <div style="width:${p.percent}%;height:100%;background:linear-gradient(90deg,var(--primary),var(--accent-2));"></div>
          </div>
          <div style="font-size:12px;color:var(--text-soft);margin-top:4px;">${p.done} / ${p.total} 完成（${p.percent}%）</div>
        </div>
      </div>
    </div>
    <div class="schedule">${days}</div>
    ${floatHtml}
  `;
}

function toggleItemDone(id) {
  const list = state.lists.find(l => l.id === currentListId);
  if (!list || !list.items[id]) return;
  list.items[id].done = !list.items[id].done;
  save(); renderDetail();
}
function toggleFixedDone(id) {
  const list = state.lists.find(l => l.id === currentListId);
  if (!list) return;
  const f = list.fixedItems.find(x => x.id === id);
  if (f) { f.done = !f.done; save(); renderDetail(); }
}
function toggleMealDone(id) {
  const list = state.lists.find(l => l.id === currentListId);
  if (!list) return;
  const m = list.meals.find(x => x.id === id);
  if (m) { m.done = !m.done; save(); renderDetail(); }
}

function copyCurrentMarkdown() {
  const list = state.lists.find(l => l.id === currentListId);
  if (!list) return;
  const md = listToMarkdown(list);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(md).then(() => toast("已复制 Markdown")).catch(() => fallbackCopy(md));
  } else {
    fallbackCopy(md);
  }
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); toast("已复制"); }
  catch (_) { toast("复制失败，请手动选择"); }
  finally { document.body.removeChild(ta); }
}

function listToMarkdown(list) {
  const dates = eachDate(list.dateRange.start, list.dateRange.end);
  let md = `# ${list.name}\n\n`;
  md += `> ${fmtDateShort(list.dateRange.start)} ~ ${fmtDateShort(list.dateRange.end)}\n\n`;
  dates.forEach(d => {
    md += `## ${fmtDateShort(d)}\n\n`;
    SLOTS.forEach(s => {
      const key = `${d}_${s}`;
      const ids = list.slots[key] || [];
      const fixed = list.fixedItems.filter(f => f.date === d && f.slot === s);
      const meals = list.meals.filter(m => m.date === d && m.slot === s);
      if (!ids.length && !fixed.length && !meals.length) return;
      md += `### ${SLOT_ICONS[s]} ${SLOT_LABELS[s]}\n`;
      fixed.forEach(f => md += `- [${f.done ? "x" : " "}] 📌 ${f.text}\n`);
      meals.forEach(m => md += `- [${m.done ? "x" : " "}] 🍜 ${m.text}\n`);
      ids.forEach(id => {
        const it = list.items[id]; if (!it) return;
        md += `- [${it.done ? "x" : " "}] ${it.isMustDo ? "⭐ " : ""}${it.text}\n`;
      });
      md += "\n";
    });
  });
  const floatMeals = list.meals.filter(m => !m.date);
  if (floatMeals.length) {
    md += `## 🍜 想吃的（不指定日期）\n`;
    floatMeals.forEach(m => md += `- [${m.done ? "x" : " "}] ${m.text}\n`);
    md += "\n";
  }
  if (state.defaultMeal) md += `> 🏠 默认懒人选项：${state.defaultMeal}\n`;
  return md;
}

/* ---------- 设置页 ---------- */
function renderSettings() {
  // 编辑中提示条：根据 settingsReturnTo 决定显示/隐藏
  const hintEl = document.getElementById("settingsEditingHint");
  if (hintEl) {
    hintEl.style.display = (settingsReturnTo === "wizard" && wizardDraft) ? "flex" : "none";
  }
  const must = state.mustDoItems.map(md => {
    const placeLabel = placementLabel(md.placement);
    const principle = md.principle || categoryToPrincipleStatic(md.category);
    const principleLabel = (MUST_DO_PRINCIPLES.find(x => x.key === principle) || { label: "📌 独立项" }).label;
    return `
      <div class="fixed-item">
        <span class="text inline-edit"
              contenteditable="true" spellcheck="false"
              data-must-id="${md.id}"
              onblur="commitMustDoText(this)"
              onkeydown="handleEditKey(event)"
              title="点击编辑文案">⭐ ${escapeHtml(md.text)}</span>
        <span class="meta editable" onclick="editMustDoPrinciple('${md.id}')" title="点击改原则归属">${escapeHtml(principleLabel)}</span>
        <span class="meta editable" onclick="editMustDoPlacement('${md.id}')" title="点击改落位">${placeLabel}</span>
        <button class="icon-mini" onclick="removeMustDo('${md.id}')">✕</button>
      </div>
    `;
  }).join("");

  const poolHtml = (key, list, label) => `
    <div class="card">
      <h2>${label}</h2>
      <div class="pool" style="margin-top:8px;">
        ${list.map((t, i) => `
          <div class="chip">
            <span class="inline-edit"
                  contenteditable="true" spellcheck="false"
                  data-pool-key="${key}" data-pool-idx="${i}"
                  onblur="commitPoolItem(this)"
                  onkeydown="handleEditKey(event)"
                  title="点击编辑">${escapeHtml(t)}</span>
            <button class="del" onclick="removePoolItem('${key}',${i})">✕</button>
          </div>
        `).join("") || `<div style="color:var(--text-mute);font-size:12px;">空</div>`}
      </div>
      <div class="row" style="margin-top:8px;">
        <input class="input" id="poolAdd_${poolKeyToDomId(key)}" placeholder="加一个新的，回车快速添加" onkeydown="if(event.key==='Enter'){event.preventDefault();addPoolItem('${key}');}" />
        <button class="btn shrink" style="flex:0 0 60px;" onclick="addPoolItem('${key}')">+</button>
      </div>
    </div>
  `;

  $("#settingsBody").innerHTML = `
    <div class="card">
      <h2>⭐ 必做项（自动落位）</h2>
      <p class="subtitle">每次新建清单时，会按你设置的"日期+时段"自动加进去。</p>
      <div class="fixed-list">${must || `<div class="u-empty-row">还没有必做项</div>`}</div>
      <div style="margin-top:10px;">
        <input class="input" id="newMustText" placeholder="比如：周日晚 12 点前睡（回车快速添加）" onkeydown="if(event.key==='Enter'){event.preventDefault();addMustDo();}" />
      </div>
      <div class="row" style="margin-top:6px;">
        <select class="input" id="newMustPrinciple" title="归属哪个原则">
          ${MUST_DO_PRINCIPLES.map(p => `<option value="${p.key}"${p.key === 'sundayNight' ? ' selected' : ''}>${p.label}</option>`).join("")}
        </select>
      </div>
      <div class="row" style="margin-top:6px;">
        <select class="input" id="newMustDay">
          <option value="last">最后一天</option>
          <option value="first">第一天</option>
          <option value="1">第二天</option>
          <option value="2">第三天</option>
          <option value="every">每一天</option>
        </select>
        <select class="input" id="newMustSlot">
          <option value="morning">上午</option>
          <option value="afternoon">下午</option>
          <option value="evening" selected>晚上</option>
        </select>
      </div>
      <button class="btn btn-block" style="margin-top:8px;" onclick="addMustDo()">添加必做项</button>
    </div>

    ${poolHtml("body.high", state.pools.body.high, "🏃 动一动 · 高强度")}
    ${poolHtml("body.low", state.pools.body.low, "🚶 动一动 · 轻度")}
    ${poolHtml("blank", state.pools.blank, "🧘 让大脑歇一下")}
    ${poolHtml("active", state.pools.active, "✨ 主动做点什么")}
    ${poolHtml("sundayNight", state.pools.sundayNight, "🌙 守好周日晚")}
    ${MEAL_POOLS.map(p => poolHtml(p.key, state.pools[p.key], p.label)).join("")}

    <div class="card">
      <h2>🗑 重置数据</h2>
      <p class="subtitle">把所有备选事项、必做项、清单全部清空（不可恢复）。</p>
      <button class="btn btn-danger" onclick="resetAll()">清空所有数据</button>
    </div>
  `;
}

function placementLabel(p) {
  if (!p) return "最后一天 · 晚上";
  let day = "最后一天";
  if (p.dayOffset === "first") day = "第一天";
  else if (p.dayOffset === "last") day = "最后一天";
  else if (p.dayOffset === "every") day = "每一天";
  else if (!isNaN(parseInt(p.dayOffset, 10))) day = `第${parseInt(p.dayOffset, 10) + 1}天`;
  return `${day} · ${SLOT_LABELS[p.slot] || "晚上"}`;
}

function getPoolByKey(key) {
  if (key.indexOf(".") >= 0) {
    const [a, b] = key.split(".");
    return state.pools[a][b];
  }
  return state.pools[key];
}
function setPoolByKey(key, arr) {
  if (key.indexOf(".") >= 0) {
    const [a, b] = key.split(".");
    state.pools[a][b] = arr;
  } else {
    state.pools[key] = arr;
  }
}
function poolKeyToDomId(key) { return key.replace(/\./g, "_"); }
function addPoolItem(key) {
  const inp = document.getElementById("poolAdd_" + poolKeyToDomId(key));
  if (!inp) return;
  const v = inp.value.trim(); if (!v) return;
  const arr = getPoolByKey(key); arr.push(v); setPoolByKey(key, arr);
  save(); renderSettings();
}
function removePoolItem(key, idx) {
  const arr = getPoolByKey(key); arr.splice(idx, 1); setPoolByKey(key, arr);
  save(); renderSettings();
}
/* ---------- inline 编辑：提交逻辑 ---------- */
function commitPoolItem(el) {
  const key = el.dataset.poolKey;
  const idx = parseInt(el.dataset.poolIdx, 10);
  const arr = getPoolByKey(key);
  const newText = (el.textContent || "").trim();
  if (!newText) {
    el.textContent = arr[idx]; // 恢复
    toast("内容不能为空");
    return;
  }
  if (newText === arr[idx]) return; // 没变
  arr[idx] = newText; setPoolByKey(key, arr);
  save(); toast("已更新");
}
function commitMustDoText(el) {
  const id = el.dataset.mustId;
  const m = state.mustDoItems.find(x => x.id === id);
  if (!m) return;
  // contenteditable 里我们渲染的是 "⭐ 文本"，但用户可能编辑掉了 ⭐
  let raw = (el.textContent || "").trim();
  // 去掉前缀 ⭐（如果有）
  raw = raw.replace(/^[⭐\s]+/, "").trim();
  if (!raw) {
    el.textContent = "⭐ " + m.text;
    toast("内容不能为空");
    return;
  }
  if (raw === m.text) {
    // 用户可能动了 ⭐，重渲一次保证一致
    el.textContent = "⭐ " + m.text;
    return;
  }
  m.text = raw;
  save();
  el.textContent = "⭐ " + m.text;
  toast("已更新");
}
function handleEditKey(e) {
  if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
  if (e.key === "Escape") { e.preventDefault(); e.target.blur(); renderSettings(); }
}

function addMustDo() {
  const text = $("#newMustText").value.trim();
  const principle = $("#newMustPrinciple").value;
  const dayOffset = $("#newMustDay").value;
  const slot = $("#newMustSlot").value;
  if (!text) { toast("请输入必做项内容"); return; }
  state.mustDoItems.push({
    id: uid("must"),
    text,
    principle,                      // 显式归属
    category: principle === "none" ? "active" : principle, // 兼容字段
    placement: { dayOffset, slot }
  });
  save(); renderSettings(); toast("已添加");
}
function removeMustDo(id) {
  state.mustDoItems = state.mustDoItems.filter(m => m.id !== id);
  save(); renderSettings();
}
function editMustDoPrinciple(id) {
  const m = state.mustDoItems.find(x => x.id === id);
  if (!m) return;
  const cur = m.principle || categoryToPrincipleStatic(m.category);
  const selectId = "__pmp_" + Date.now();
  modal({
    title: "选择原则归属",
    body: `
      <p style="font-size:13px;color:var(--text-soft);margin:0 0 8px;">${escapeHtml(m.text)}</p>
      <select class="input" id="${selectId}" style="width:100%;">
        ${MUST_DO_PRINCIPLES.map(p => `<option value="${p.key}"${cur === p.key ? ' selected' : ''}>${p.label}</option>`).join("")}
      </select>
    `,
    confirmText: "保存",
    onConfirm: () => {
      const v = document.getElementById(selectId)?.value || "none";
      m.principle = v;
      m.category = v === "none" ? "active" : v;
      save(); renderSettings(); toast("已更新");
    }
  });
}
function editMustDoPlacement(id) {
  const m = state.mustDoItems.find(x => x.id === id);
  if (!m) return;
  const cur = m.placement || { dayOffset: "last", slot: "evening" };
  // 用 modal 装两个 select
  const dayId = "__pmd_" + Date.now();
  const slotId = "__pms_" + Date.now();
  const dayOpts = [
    ["last", "最后一天"], ["first", "第一天"],
    ["1", "第二天"], ["2", "第三天"], ["every", "每一天"]
  ];
  const slotOpts = [["morning", "上午"], ["afternoon", "下午"], ["evening", "晚上"]];
  modal({
    title: "编辑落位",
    body: `
      <p style="font-size:13px;color:var(--text-soft);margin:0 0 8px;">${escapeHtml(m.text)}</p>
      <div class="row">
        <select class="input" id="${dayId}">
          ${dayOpts.map(([v, l]) => `<option value="${v}"${String(cur.dayOffset) === v ? ' selected' : ''}>${l}</option>`).join("")}
        </select>
        <select class="input" id="${slotId}">
          ${slotOpts.map(([v, l]) => `<option value="${v}"${cur.slot === v ? ' selected' : ''}>${l}</option>`).join("")}
        </select>
      </div>
    `,
    confirmText: "保存",
    onConfirm: () => {
      const day = document.getElementById(dayId)?.value || "last";
      const slot = document.getElementById(slotId)?.value || "evening";
      m.placement = { dayOffset: day, slot };
      save(); renderSettings(); toast("已更新");
    }
  });
}

function resetAll() {
  confirmDanger("确定要清空所有数据吗？此操作不可恢复。", () => {
    localStorage.removeItem(STORAGE_KEY);
    state = {
      schemaVersion: 2,
      pools: deepCopy(DEFAULT_POOLS),
      mustDoItems: deepCopy(DEFAULT_MUST_DO),
      lists: []
    };
    save(); goHome(); toast("已重置");
  });
}

// === BLOCK 5 END ===
