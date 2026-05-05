/* ============================================================
 * BLOCK 6: 初始化、暴露全局、键盘快捷键
 * ============================================================ */

// 把所有需要被 inline onclick 调用的函数挂到 window 上（防止压缩/作用域问题）
const __exposed = [
  "goHome", "goSettings", "startNewList", "openList", "toggleArchive", "toggleShowArchived", "delList",
  "editCurrentList", "cancelWizard", "wizardPrev", "wizardNext",
  "applyRangeChange", "addFixed", "removeFixed",
  "addMeal", "removeMeal",
  "switchCandTab", "toggleCandCollapse", "quickAddCustom", "removeFromSlot",
  "removeFromSlotByText", "removeFromSlotByTextMobile",
  "onChipTouchStart", "onChipTouchEnd", "onChipTouchMove",
  "openChipSlotsSheet", "closeChipSlotsSheet",
  "toggleItemDone", "toggleFixedDone", "toggleMealDone", "copyCurrentMarkdown",
  "addMustDo", "removeMustDo", "editMustDoPlacement", "editMustDoPrinciple",
  "addPoolItem", "removePoolItem",
  "commitPoolItem", "commitMustDoText", "handleEditKey",
  "resetAll",
  "randomMealPicker", "setMealPickerScope", "rollMeal", "mealPickerInnerHtml",
  "pickMealItem", "clearMealRoll"
];
__exposed.forEach(name => {
  if (typeof window !== "undefined" && typeof window[name] === "undefined") {
    try { window[name] = eval(name); } catch (_) { /* 已是全局 function 声明，无需操作 */ }
  }
});

// ESC 关闭 modal
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    const mask = document.querySelector(".modal-mask");
    if (mask) document.getElementById("modalRoot").innerHTML = "";
  }
});

// 防止移动端整页双指缩放干扰拖拽（保留正常滚动）
document.addEventListener("gesturestart", e => e.preventDefault());

/* ---------- 主题切换：auto → light → dark → auto ----------
 * - auto = localStorage 没值，跟随系统 prefers-color-scheme
 * - light/dark = 显式 data-theme 属性，优先级最高
 * 顶部按钮图标：monitor=auto / sun=light / moon=dark
 */
const THEME_CYCLE = ["auto", "light", "dark"];
const THEME_ICON = { auto: "icon-monitor", light: "icon-sun", dark: "icon-moon" };
const THEME_LABEL = { auto: "跟随系统", light: "浅色", dark: "深色" };
const THEME_COLOR_META = { dark: "#0b1220", light: "#f6f8fc" };

function getCurrentTheme() {
  try { return localStorage.getItem("wp-theme") || "auto"; } catch (_) { return "auto"; }
}
function applyTheme(t) {
  if (t === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", t);
  }
  // 同步 theme-color meta，让移动端状态栏跟随
  const meta = document.getElementById("themeColorMeta");
  if (meta) {
    let resolved = t;
    if (t === "auto") {
      resolved = (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    }
    meta.setAttribute("content", THEME_COLOR_META[resolved] || THEME_COLOR_META.dark);
  }
  // 更新顶部按钮图标
  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.innerHTML = `<svg class="icon"><use href="#${THEME_ICON[t] || THEME_ICON.auto}"/></svg>`;
    btn.title = `主题：${THEME_LABEL[t] || THEME_LABEL.auto}（点击切换）`;
  }
}
function cycleTheme() {
  const cur = getCurrentTheme();
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(cur) + 1) % THEME_CYCLE.length];
  try {
    if (next === "auto") localStorage.removeItem("wp-theme");
    else localStorage.setItem("wp-theme", next);
  } catch (_) {}
  applyTheme(next);
  if (typeof toast === "function") toast(`主题：${THEME_LABEL[next]}`);
}

// 系统主题变化时，若当前为 auto 则同步 meta 颜色
if (window.matchMedia) {
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const onChange = () => { if (getCurrentTheme() === "auto") applyTheme("auto"); };
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

/* ---------- 启动 ---------- */
load();
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(getCurrentTheme());
  goHome();
});
