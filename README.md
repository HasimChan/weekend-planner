# 📅 周末规划 · Weekend Planner

> 用 4 个原则把周末过得"厚实"，而不是过得"快"。

一个**纯前端、零依赖**的周末计划工具：拖拽安排活动、移动端长按抽屉、PWA 离线可用。
打开浏览器就能用，添加到桌面就像 App。

---

## ✨ 核心特性

- **4 原则模板**：动一动 / 让大脑歇一下 / 主动做点什么 / 守好周日晚
- **三步向导**：选时段 → 选吃什么 → 拖活动
- **跨端体验**：
  - 桌面端 HTML5 拖拽 + 三栏布局
  - 移动端长按 350ms 触发拖拽 + 底部抽屉
- **吃啥呢**：从候选池随机抽，再挑也不挠头
- **暗黑模式**：自动跟随系统 / 手动切换
- **离线可用**：Service Worker 全资源缓存
- **零依赖**：原生 HTML/CSS/JS，没有 npm install

---

## 📁 目录结构

```
weekend-planner/
├── src/                  # 源代码（开发就改这里）
│   ├── index.html
│   ├── css/
│   │   └── main.css
│   └── js/
│       ├── 01-core.js          # 数据 + 状态 + 工具函数 + 持久化
│       ├── 02-home-step1.js    # 首页 + 向导启动 + Step1
│       ├── 03-step2-step3.js   # Step2 吃饭 + Step3 拖拽
│       ├── 04-dnd.js           # 拖拽（PC + 移动端）
│       ├── 05-detail-settings.js  # 清单详情 + 设置页
│       └── 06-bootstrap.js     # 主题切换 + 启动
│
├── pwa/                  # PWA 静态资源（部署到 GitHub Pages 的就是这个）
│   ├── manifest.json
│   ├── sw.js
│   ├── icon.svg
│   └── index.html        # ⚠️ 自动生成，不要手改
│
├── dev/                  # 开发产物（git 忽略）
├── build.mjs             # 构建脚本（无依赖，Node 18+）
├── README.md
├── LICENSE
└── .gitignore
```

---

## 🚀 快速开始

### 本地开发

```bash
# 1. 构建（生成 dev/ 用于本地浏览，pwa/ 用于部署）
node build.mjs

# 2. 浏览器直接打开 dev/index.html 即可
#    （或用任意静态服务器，例如 python -m http.server 8000）
```

只想刷新 dev：`node build.mjs --dev`
只想打 pwa：`node build.mjs --pwa`

每次改完 `src/` 下的源码，重新跑 `node build.mjs` 即可。
版本号是基于源码内容的 SHA1 hash，**源码不变 → 版本号不变**，浏览器不会无意义刷新缓存。

### 部署到 GitHub Pages

> ⚠️ **GitHub Pages 默认会把根目录的 `README.md` 当首页渲染**——必须确保部署目录的根有 `index.html`。下面 2 种方案任选其一。

#### 方案 A（推荐）：源码 + 部署同仓库（用 `docs/` 子目录）

```bash
node build.mjs --pwa --out=docs   # 输出到 docs/index.html
git add -A && git commit -m "Build" && git push
```

GitHub 仓库 → **Settings → Pages → Source = `Deploy from a branch` → Branch = `main` / `/docs`** → Save。
1-3 分钟后访问 `https://<你>.github.io/<仓库名>/`，看到的就是 App，README 仍然是仓库主页。

#### 方案 B：单独建一个仓库只放部署产物

```bash
node build.mjs --pwa
cd pwa
git init && git add . && git commit -m "Deploy"
git branch -M main
git remote add origin https://github.com/<你>/weekend-planner.git
git push -u origin main
```

仓库 → Settings → Pages → Source = `main` / `(root)`。
访问 `https://<你>.github.io/weekend-planner/` 即是 App。

### 添加到手机桌面

**iPhone（Safari）**：底部分享 → "添加到主屏幕"
**安卓（Chrome）**：右上角菜单 → "添加到主屏幕"

> ⚠️ 微信内打不开 PWA，必须复制链接到 Safari/Chrome 才能装。

---

## 🏗️ 架构设计

### 状态管理：双层 state

- `state` (持久化)：清单数据、候选池、必做项 → `localStorage`
- `uiState` (内存)：当前视图、向导步骤、移动端聚焦日期等 16 个 UI 状态

`uiState` 通过 `Object.defineProperty` 自动代理到 `window` 上，
让 6 个 JS 文件像同模块一样共享状态，不用改写大量函数签名。

### CSS 媒体查询命名

每个 `@media` 上方都有分类注释，方便定位：

```css
/* === LIGHT THEME ============================================ */
@media (prefers-color-scheme: light) { ... }

/* === DESKTOP (mouse / pointer:fine) ========================== */
@media (hover: hover) and (pointer: fine) { ... }

/* === MOBILE (touch / no precise pointer) ===================== */
@media not all and (hover: hover) and (pointer: fine) { ... }
```

### 拖拽分两套实现

| 平台 | 触发 | 实现 |
|---|---|---|
| 桌面端 | mousedown 即起 | 原生 HTML5 `draggable` + `dataTransfer` |
| 移动端 | 长按 350ms | `PointerEvents` + 自绘 ghost |

两套 API 都写到 `04-dnd.js`，通过 `isMobileLayout()` 切换。

---

## 🎨 关于 Logo

`pwa/icon.svg` 是「2/7 时间块」设计：深蓝黑底 + 完整圆环（7 天）+ 蓝色高亮扇区（周末 2 天）。
寓意：**7 天里属于你的那 2 天**。纯 SVG 矢量，任意缩放都清晰。

---

## 📜 许可证

MIT — 见 [LICENSE](./LICENSE)。
