#!/usr/bin/env node
/**
 * Weekend Planner - 构建脚本
 * --------------------------------------------
 * 两件事：
 *   1) 给 src/index.html 里所有 ?v=__BUILD_VERSION__ 注入 hash（基于源文件内容）
 *   2) 把 src/ 下的源代码合并打包成单文件 PWA（默认 pwa/index.html）
 *
 * 用法：
 *   node build.mjs                  # 完整构建（dev + pwa）
 *   node build.mjs --dev            # 只刷新 dev/index.html 里的版本号
 *   node build.mjs --pwa            # 只打 pwa/index.html
 *   node build.mjs --pwa --out=docs # PWA 输出到 docs/（GitHub Pages 推荐：源码+部署同仓库）
 *
 * 没有任何 npm 依赖，Node 18+ 直接跑。
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "src");
const DEV = resolve(__dirname, "dev");

// 解析参数：--pwa / --dev / --out=<dir>
const argv = process.argv.slice(2);
const args = new Set(argv);
const outArg = argv.find(a => a.startsWith("--out="));
const PWA_DIR_NAME = outArg ? outArg.slice("--out=".length) : "pwa";
const PWA = resolve(__dirname, PWA_DIR_NAME);

const wantDev = args.has("--dev") || (!args.has("--pwa") && !args.has("--dev"));
const wantPwa = args.has("--pwa") || (!args.has("--pwa") && !args.has("--dev"));

const JS_FILES = [
  "js/01-core.js",
  "js/02-home-step1.js",
  "js/03-step2-step3.js",
  "js/04-dnd.js",
  "js/05-detail-settings.js",
  "js/06-bootstrap.js"
];
const CSS_FILES = ["css/main.css"];

function readSrc(rel) {
  return readFileSync(resolve(SRC, rel), "utf8");
}

function buildVersion() {
  // 基于所有源文件的内容算 hash，源不动 → version 不变
  const h = createHash("sha1");
  for (const rel of [...JS_FILES, ...CSS_FILES, "index.html"]) {
    h.update(readSrc(rel));
  }
  return h.digest("hex").slice(0, 8); // 8 位 hash 足够区分
}

const VERSION = buildVersion();

/* ---------- 1. dev 模式：拷源码到 dev/ + 注入版本号 ---------- */
function buildDev() {
  if (!existsSync(DEV)) mkdirSync(DEV, { recursive: true });
  if (!existsSync(resolve(DEV, "css"))) mkdirSync(resolve(DEV, "css"));
  if (!existsSync(resolve(DEV, "js"))) mkdirSync(resolve(DEV, "js"));

  // index.html 替换版本号
  const html = readSrc("index.html").replaceAll("__BUILD_VERSION__", VERSION);
  writeFileSync(resolve(DEV, "index.html"), html, "utf8");

  // CSS / JS 直接拷
  for (const rel of [...CSS_FILES, ...JS_FILES]) {
    copyFileSync(resolve(SRC, rel), resolve(DEV, rel));
  }
  console.log(`✅ dev/  版本 ${VERSION}（开发用，浏览器直接打开 dev/index.html）`);
}

/* ---------- 2. pwa 模式：合并成单文件 + 注入 PWA meta ----------
 * 输出目录由 --out=<dir> 控制（默认 pwa/）。常用：
 *   - pwa/  → 独立部署（仅推 pwa/ 内容到一个新仓库）
 *   - docs/ → 同仓库部署（源码 + 部署版共存，Pages 设 main / /docs）
 *
 * 副资源（manifest.json / sw.js / icon.svg）：
 *   - 源在 src/pwa-assets/，build 时拷到输出目录
 *   - 输出目录里已有同名文件则覆盖（保证和源一致）
 *   - sw.js 拷过去后会被下面的 CACHE_NAME 注入逻辑改写
 */
const PWA_ASSETS_SRC = resolve(SRC, "pwa-assets");
function ensurePwaAssets() {
  const assets = ["manifest.json", "sw.js", "icon.svg"];
  for (const f of assets) {
    const src = resolve(PWA_ASSETS_SRC, f);
    if (!existsSync(src)) {
      console.warn(`⚠️  缺少源 PWA 资源：${src}`);
      continue;
    }
    copyFileSync(src, resolve(PWA, f));
  }
}

function buildPwa() {
  if (!existsSync(PWA)) mkdirSync(PWA, { recursive: true });
  ensurePwaAssets();

  let html = readSrc("index.html");
  const css = CSS_FILES.map(readSrc).join("\n");
  const js = JS_FILES.map(readSrc).join("\n\n");

  // 1) 移除版本号占位（PWA 单文件不需要查询参数）
  html = html.replaceAll("?v=__BUILD_VERSION__", "");

  // 2) 替换外链 CSS → 内联（用回调避免 $$ 转义陷阱）
  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="css\/main\.css"\s*\/?>/i,
    () => `<style>\n${css}\n</style>`
  );

  // 3) 替换 6 个外链 JS → 一个内联 <script>
  // 先匹配第一个 js 标签的位置，然后把 6 个 script 整段替换
  const scriptBlockRegex = /<script\s+src="js\/01-core\.js"[^>]*><\/script>[\s\S]*?<script\s+src="js\/06-bootstrap\.js"[^>]*><\/script>/i;
  html = html.replace(scriptBlockRegex, () => `<script>\n${js}\n</script>`);

  // 4) 注入 PWA meta（在 </head> 前）
  const PWA_HEAD = `
<!-- ===== PWA ===== -->
<link rel="manifest" href="./manifest.json" />
<link rel="icon" type="image/svg+xml" href="./icon.svg" />
<link rel="apple-touch-icon" href="./icon.svg" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="周末规划" />
<script>
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
</script>`;
  html = html.replace(/<\/head>/i, `${PWA_HEAD}\n</head>`);

  writeFileSync(resolve(PWA, "index.html"), html, "utf8");

  // 5) 同步 sw.js 里的 CACHE_NAME → 用版本号，强制旧 SW 失效
  const swPath = resolve(PWA, "sw.js");
  if (existsSync(swPath)) {
    const sw = readFileSync(swPath, "utf8").replace(
      /const CACHE_NAME = "weekend-planner-[^"]*";/,
      `const CACHE_NAME = "weekend-planner-${VERSION}";`
    );
    writeFileSync(swPath, sw, "utf8");
  }

  const size = statSync(resolve(PWA, "index.html")).size;
  console.log(`✅ ${PWA_DIR_NAME}/  版本 ${VERSION} → index.html (${(size / 1024).toFixed(1)} KB)`);
}

if (wantDev) buildDev();
if (wantPwa) buildPwa();

if (wantPwa) {
  if (PWA_DIR_NAME === "docs") {
    console.log(`\n💡 部署：commit & push，然后 GitHub Settings → Pages → Source = main / /docs`);
  } else {
    console.log(`\n💡 部署：把 ${PWA_DIR_NAME}/ 里的内容推到一个仓库的根目录，Pages 设 main / (root)`);
  }
}
