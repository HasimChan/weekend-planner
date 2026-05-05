/* ============================================================
 * Weekend Planner — 核心模块
 *
 * 本文件包含：
 *   1) 默认数据（DEFAULT_POOLS / DEFAULT_MUST_DO / 常量表）
 *   2) 持久化状态 state（schemaVersion=2，存到 localStorage）
 *   3) UI 临时状态 uiState（视图、向导、弹窗等运行时状态聚合）
 *   4) 工具函数（DOM 选择器、转义、日期、视图切换、Toast/Modal）
 *
 * 加载顺序：本文件必须在 02~06 之前加载。
 * ============================================================ */

/* ---------- 默认数据 ----------
 * 注意：菜品数据是占位示例，用户首次使用后可在「设置 → 吃饭」里完全替换为自己常吃的。
 * 这里有意保持通用，避免把作者本地化的店名硬编码进去。
 */
const DEFAULT_POOLS = {
  body: {
    high: ["跑步", "打羽毛球", "游泳", "爬山", "徒步"],
    low: ["出门散步", "去绿化好的地方坐坐"]
  },
  blank: ["睡前放下手机发呆", "坐着喝杯茶什么都不做", "洗澡时不刷手机", "吃饭时不开视频", "去公园放空下"],
  active: [
    "自己下厨做一顿饭", "看书半小时", "整理家里某个角落",
    "去一个提前想好的地方", "骑车去没去过的地方",
    "写写东西，记录想法", "学一样想学的东西",
    "找个安静地方独处一会",
    "看一部一直想看的电影", "研究一样感兴趣的东西",
    "整理手机照片或文件"
  ],
  sundayNight: ["看一些轻松的内容", "提前准备好周一要用的东西"],
  // 吃饭：拆 3 池（占位示例，用户可在设置里改成自己常吃的）
  mealsTakeout: ["快餐 A", "快餐 B", "盖饭 C", "面食 D", "便当 E"],
  mealsDineSolo: ["盖饭 A", "面馆 B", "快餐 C", "小炒 D"],
  mealsDineDuo: ["火锅 A", "烧烤 B", "日料 C", "粤菜 D", "湘菜 E", "川菜 F"]
};

const DEFAULT_MUST_DO = [
  { id: "must_1", text: "睡前写下周一最重要的几件事",
    principle: "sundayNight", category: "sundayNight",
    placement: { dayOffset: "last", slot: "evening" } },
  { id: "must_2", text: "12 点前睡",
    principle: "sundayNight", category: "sundayNight",
    placement: { dayOffset: "last", slot: "evening" } }
];

// 必做项可归属的原则（含"独立项"= none，不计入原则进度）
const MUST_DO_PRINCIPLES = [
  { key: "body", label: "🏃 身体要动" },
  { key: "blank", label: "🧘 让大脑歇一下" },
  { key: "active", label: "✨ 主动做点什么" },
  { key: "sundayNight", label: "🌙 守好周日晚" },
  { key: "none", label: "📌 独立项（不属于任何原则）" }
];

const SLOTS = ["morning", "afternoon", "evening"];
const SLOT_LABELS = { morning: "上午", afternoon: "下午", evening: "晚上" };
const SLOT_ICONS = { morning: "☀️", afternoon: "🌤", evening: "🌙" };
// 4 大原则（顶层粒度，与 README 对齐）
//  - suggest: 建议安排几个事项（仅作引导提示，不强制）
//  - 默认建议：动一动 1（动一次就够）、让大脑歇一下 1、主动做点什么 2（鼓励多）、守好周日晚 1
const PRINCIPLES = [
  { key: "body", label: "🏃 动一动", subs: ["body_high", "body_low"], suggest: 1 },
  { key: "blank", label: "🧘 让大脑歇一下", subs: ["blank"], suggest: 1 },
  { key: "active", label: "✨ 主动做点什么", subs: ["active"], suggest: 2 },
  { key: "sundayNight", label: "🌙 守好周日晚", subs: ["sundayNight"], suggest: 1 }
];
// 子分类标签（用于 chip 上的小角标）
const CAT_LABELS = {
  body_high: "🏃 高强度", body_low: "🚶 轻度",
  blank: "🧘 大脑歇一下", active: "✨ 主动做",
  sundayNight: "🌙 周日晚"
};
// 吃饭池（3 池）
const MEAL_POOLS = [
  { key: "mealsTakeout", label: "🛵 外卖" },
  { key: "mealsDineSolo", label: "🍜 堂食 · 1 人" },
  { key: "mealsDineDuo", label: "🍲 堂食 · 2 人" }
];

/* ---------- 持久化状态（写入 localStorage） ---------- */
const STORAGE_KEY = "weekend-planner-v2";
let state = {
  schemaVersion: 2,
  pools: deepCopy(DEFAULT_POOLS),
  mustDoItems: deepCopy(DEFAULT_MUST_DO),
  lists: []
};

/* ---------- UI 运行时状态（不持久化，刷新即重置） ----------
 * 把 16 个散落在文件头的全局可变变量收纳到一个对象里，方便：
 *   1) 一眼看出"哪些是临时 UI 状态"
 *   2) 调试时 console.log(uiState) 一次看全
 *   3) 后续如果要做撤销/重置，只需操作这一个对象
 *
 * 字段说明（按用途分组）：
 *   视图 / 路由：
 *     view                  — 当前视图: home | wizard | detail | settings
 *     currentListId         — 当前在 detail 里看的清单 id
 *   向导：
 *     wizardStep            — 1 | 2 | 3
 *     wizardDraft           — 向导期间正在编辑的 list 对象（草稿）
 *     wizardEditMode        — 是否在编辑现有 list（决定"完成"按钮文案）
 *     wizardStep3Visited    — 本轮向导是否已经进过 step3（用于初始化 tab 推荐）
 *     activeCandTab         — Step3 候选区当前选中的 tab（"all" | 原则 key）
 *     candCollapsed         — Step3 候选区是否折叠
 *   移动端两级 tab：
 *     mobileCurrentDate     — 当前选中的「日」，null 时使用日期范围第一天
 *     mobileCurrentSlot     — 当前选中的「时段」，默认 morning
 *   桌面端浮层：
 *     openChipPopoverText   — 当前打开浮层的 chip 文本（null = 无浮层）
 *   首页：
 *     showArchived          — 是否展开"已归档"折叠区
 *   设置页跳转：
 *     settingsReturnTo      — 设置页返回时去哪："wizard" | "home" | null
 *     settingsReopenModal   — 返回后要自动重开的弹窗类型："mealPicker" | null
 *   吃啥呢弹窗：
 *     mealPickerScope       — 当前选中的池子 key（mealsTakeout 等）
 *     mealPickerResult      — 已抽中的结果 { t, from }，null 表示未抽
 */
const uiState = {
  view: "home",
  currentListId: null,

  wizardStep: 1,
  wizardDraft: null,
  wizardEditMode: false,
  wizardStep3Visited: false,
  activeCandTab: "all",
  candCollapsed: false,

  mobileCurrentDate: null,
  mobileCurrentSlot: "morning",

  openChipPopoverText: null,

  showArchived: false,

  settingsReturnTo: null,
  settingsReopenModal: null,

  mealPickerScope: null,
  mealPickerResult: null
};

/* 兼容层：原代码大量使用裸全局变量名（view、wizardStep 等），
 * 为了不改散落在 1300+ 行里的引用点，这里把 uiState 的字段
 * 用 getter/setter 代理一份到 window 上。读写裸变量名相当于读写 uiState。
 *
 * 注意：JS 顶层 `let foo` 不会挂到 window，要让 `view = "x"` 这种裸赋值
 * 也能命中代理，必须用 `var` + Object.defineProperty 在 window 上做属性。
 * 这里采用更稳的做法：直接在 window 上定义 getter/setter，调用方读到的
 * `view` 实际上是 window.view → uiState.view。
 */
(function bridgeUiStateToGlobals() {
  if (typeof window === "undefined") return;
  Object.keys(uiState).forEach(key => {
    Object.defineProperty(window, key, {
      get() { return uiState[key]; },
      set(v) { uiState[key] = v; },
      configurable: true,
      enumerable: false
    });
  });
})();

/* ---------- 工具函数 ---------- */
function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

// 设备类型检测：有鼠标 + 精确指针 = 桌面端；其他都视为移动端
//  - matchMedia 兼容性：现代浏览器全支持，老 IE 用 fallback (isn't a target)
function isMobileLayout() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function uid(prefix) { return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

/* ---------- 持久化 ---------- */
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn("save failed", e); }
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.schemaVersion === 2) {
      state = Object.assign(state, parsed);
      // 字段补全（防止旧版数据缺字段）
      if (!state.pools) state.pools = deepCopy(DEFAULT_POOLS);
      if (!state.pools.body) state.pools.body = deepCopy(DEFAULT_POOLS.body);
      if (!state.pools.body.high) state.pools.body.high = DEFAULT_POOLS.body.high.slice();
      if (!state.pools.body.low) state.pools.body.low = DEFAULT_POOLS.body.low.slice();
      ["blank", "active", "sundayNight"].forEach(k => {
        if (!state.pools[k]) state.pools[k] = DEFAULT_POOLS[k].slice();
      });
      // 迁移旧 meals → mealsTakeout（首次升级时）
      if (state.pools.meals && !state.pools.mealsTakeout) {
        state.pools.mealsTakeout = state.pools.meals.slice();
      }
      ["mealsTakeout", "mealsDineSolo", "mealsDineDuo"].forEach(k => {
        if (!state.pools[k]) state.pools[k] = DEFAULT_POOLS[k].slice();
      });
      delete state.pools.meals; // 旧字段不再使用
      delete state.defaultMeal; // 旧字段不再使用
      if (!state.mustDoItems) state.mustDoItems = deepCopy(DEFAULT_MUST_DO);
      if (!state.lists) state.lists = [];
    }
  } catch (e) { console.warn("load failed", e); }
}

/* ---------- 日期工具 ---------- */
function pad2(n) { return String(n).padStart(2, "0"); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function fmtDateShort(s) {
  const d = parseDate(s);
  const w = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} 周${w}`;
}
// 仅返回「周X」，不带月日数字（用于 v4 候选区目标提示，避免和底部 day-tab 重复）
function fmtWeekdayShort(s) {
  const d = parseDate(s);
  const w = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `周${w}`;
}
function eachDate(start, end) {
  const arr = []; let cur = parseDate(start); const last = parseDate(end);
  while (cur <= last) { arr.push(fmtDate(cur)); cur.setDate(cur.getDate() + 1); }
  return arr;
}
function getThisWeekend() {
  const now = new Date(), day = now.getDay();
  const sat = new Date(now);
  if (day === 0) sat.setDate(now.getDate() - 1);
  else if (day !== 6) sat.setDate(now.getDate() + (6 - day));
  const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
  return { start: fmtDate(sat), end: fmtDate(sun) };
}

/* ---------- 视图切换 ---------- */
function switchView(v) {
  uiState.view = v;
  $$(".view").forEach(el => el.classList.remove("active"));
  const target = $("#view-" + v);
  if (target) target.classList.add("active");
  window.scrollTo(0, 0);
}
function goHome() { switchView("home"); renderHome(); }

function goSettings(from, reopen) {
  // 显式传 from 优先；否则根据当前是否处于向导态（wizardDraft 存在 && 当前 view 是 wizard）自动判断
  if (from) {
    uiState.settingsReturnTo = from;
  } else if (uiState.wizardDraft && document.getElementById("view-wizard")?.classList.contains("active")) {
    uiState.settingsReturnTo = "wizard";
  } else {
    uiState.settingsReturnTo = "home";
  }
  // 记录要重开的弹窗类型（如果有的话）
  uiState.settingsReopenModal = reopen || null;
  // 关掉当前弹窗（如果有），避免它残留在 modalRoot 影响 settings 页交互
  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) modalRoot.innerHTML = "";
  switchView("settings");
  renderSettings();
}
// 设置页"返回"按钮入口：根据 settingsReturnTo 决定回到哪里，并按需重开来源弹窗
function backFromSettings() {
  const reopen = uiState.settingsReopenModal;
  uiState.settingsReopenModal = null;
  if (uiState.settingsReturnTo === "wizard" && uiState.wizardDraft) {
    uiState.settingsReturnTo = null;
    switchView("wizard");
    renderWizard();
    // 回到向导后给个轻提示，让用户知道编辑没丢
    toast("已返回继续编辑");
  } else {
    uiState.settingsReturnTo = null;
    goHome();
  }
  // 重开来源弹窗（在视图切换+渲染之后）
  if (reopen === "mealPicker") {
    setTimeout(() => { renderMealPickerModal(); }, 50);
  }
}
// Step3 内联提示里的"看完整说明"链接：跳到首页并自动展开"关于这四个原则"折叠卡
function goHomeAndOpenAbout() {
  goHome();
  // 等首页 DOM 就绪后展开折叠卡并滚动到位
  setTimeout(() => {
    const about = document.getElementById("aboutPrinciplesCard");
    if (about) {
      about.open = true;
      about.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 50);
}

// 💡 帮助按钮（顶部 a-help-link + 候选区头部 cand-help-btn 共用）：
// 移动端用 modal 弹窗显示「四原则」说明。
// 早期实现是切换 #principleMiniHelp 这个 <details> 的 open，
// 但移动端整张顶部卡片 (#topPrincipleCard) 已被 display:none 隐藏，
// 所以 open 设了也看不见，表现为「点了没反应」。
// 改用 modal()——弹窗挂在 #modalRoot 上，不受顶部卡片显隐影响。
function toggleHelpOnMobile(event) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }
  modal({
    title: "💡 4 个原则做 1 件就够",
    body: `
      <div class="help-modal-body">
        <p class="help-modal-intro">不需要每个原则都做满，每个原则做 1 件事就行。</p>
        <div class="help-modal-row"><strong>🏃 动一动</strong> —— 防止迟钝疲惫，一天动得多一点、一天轻轻动就够</div>
        <div class="help-modal-row"><strong>🧘 让大脑歇一下</strong> —— 真正的休息不是刷手机，是发呆、散步、安静吃饭</div>
        <div class="help-modal-row"><strong>✨ 主动做点什么</strong> —— 自己选的事，做完会有踏实感，不会觉得"白过一天"</div>
        <div class="help-modal-row"><strong>🌙 守好周日晚</strong> —— 早点睡 + 断开工作消息 + 写下周一最重要的几件事</div>
      </div>
    `,
    confirmText: "看完整说明",
    cancelText: "知道了",
    onConfirm: () => {
      if (typeof goHomeAndOpenAbout === "function") goHomeAndOpenAbout();
    }
  });
}

/* ---------- Toast / Modal ---------- */
let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1600);
}
function modal(opts) {
  // opts: { title, body(html), confirmText, cancelText, onConfirm }
  const root = $("#modalRoot");
  root.innerHTML = `
    <div class="modal-mask">
      <div class="modal-box">
        <h3>${escapeHtml(opts.title || "")}</h3>
        <div>${opts.body || ""}</div>
        <div class="actions">
          <button class="btn btn-secondary" id="__mc">${escapeHtml(opts.cancelText || "取消")}</button>
          <button class="btn" id="__mo">${escapeHtml(opts.confirmText || "确定")}</button>
        </div>
      </div>
    </div>
  `;
  const close = () => { root.innerHTML = ""; };
  $("#__mc").onclick = close;
  $("#__mo").onclick = () => {
    if (opts.onConfirm) opts.onConfirm();
    close();
  };
}
function confirmDanger(msg, onYes) {
  modal({ title: "确认操作", body: `<p>${escapeHtml(msg)}</p>`, confirmText: "确认", onConfirm: onYes });
}

/* 简易 prompt 弹窗：返回用户输入的字符串（取消则返回 null）。
 * 调用：promptInput({ title, label, value }, onOk)
 * 不依赖原生 prompt，避免移动端体验差。
 */
function promptInput(opts, onOk) {
  const id = "__pin_" + Date.now();
  modal({
    title: opts.title || "编辑",
    body: `
      <p class="prompt-input-label">${escapeHtml(opts.label || "")}</p>
      <input class="input prompt-input-field" id="${id}" value="${escapeAttr(opts.value || "")}" onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('__mo')?.click();}" />
    `,
    confirmText: opts.confirmText || "保存",
    onConfirm: () => {
      const v = (document.getElementById(id)?.value || "").trim();
      if (!v) { toast("内容不能为空"); return; }
      onOk(v);
    }
  });
  // 自动聚焦
  setTimeout(() => { document.getElementById(id)?.focus(); }, 50);
}
