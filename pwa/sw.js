/* Weekend Planner - Service Worker
 * 网络优先 + 离线兜底：
 *  - install 时缓存核心资源
 *  - fetch 时优先走网络（拿最新版），失败退回 cache
 *  - 既保证更新及时，又能离线
 *
 * v2 修复点：
 *  - 过滤掉非 http(s) 协议（chrome-extension:// 等）和跨源请求，避免 Cache.put 抛错
 *  - 升版本号让旧 SW 失效，强制下发最新 index.html
 */

const CACHE_NAME = "weekend-planner-de8aedb4";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./icon.svg",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 判断请求是否可缓存：必须是 GET + http(s) 协议 + 同源
function isCacheable(req) {
  if (req.method !== "GET") return false;
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.origin !== self.location.origin) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // 不可缓存的请求直接放行（不走 respondWith，让浏览器默认处理）
  if (!isCacheable(req)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          // 再次防御：put 失败也不让整个 SW 崩
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(req, clone))
            .catch((err) => console.warn("[SW] cache.put failed:", req.url, err));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
  );
});
