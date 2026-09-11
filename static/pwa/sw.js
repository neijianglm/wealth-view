/* ============================================================
   wealth PWA · Service Worker (仅快照版使用; 在线版已退役, 见 base.html)
   ------------------------------------------------------------
   · 页面导航: 网络优先(数据尽量新) → 失败回退缓存(离线/GFW 仍可看最后一版)
   · 静态资源: 缓存优先 + 后台静默更新; 严格匹配含 ?v= 的完整 URL —
     版本号变化即视为新资源走网络(曾因 ignoreSearch 忽略版本号,
     导致旧 CSS/JS 永远命中旧条目、页面必须强刷, 2026-09-06 修复)
   · 版本号改动即触发全量缓存更换
   ============================================================ */
const VERSION = 'v20260906';
const CACHE = `wealth-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(['./', 'manifest.webmanifest']).catch(() => {});
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // ---- 页面导航: 网络优先, 缓存兜底 ----
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh.ok) {                    // 401/500 等错误页不进缓存
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        const root = await caches.match('./', { ignoreSearch: true });
        return root || Response.error();
      }
    })());
    return;
  }

  // ---- 静态资源: 缓存优先 + 后台更新 (完整 URL 匹配, 尊重 ?v= 版本号) ----
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchAndCache = (async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200 && fresh.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) { return null; }
    })();
    if (cached) { fetchAndCache(); return cached; }
    const fresh = await fetchAndCache();
    return fresh || Response.error();
  })());
});
