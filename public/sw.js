// Service worker de Unbex Rutinas.
// Cachea SOLO assets estáticos (/_next/static, íconos, manifest) y la página /offline.
// No toca páginas con datos del usuario, respuestas de Supabase ni nada de otros orígenes:
// esas peticiones ni se interceptan, van directo a la red.
const CACHE = "unbex-estaticos-v1";
const OFFLINE_URL = "/offline";

const esEstatico = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname === "/manifest.webmanifest";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch(OFFLINE_URL, { cache: "reload" });
      if (!res.ok) return;
      await cache.put(OFFLINE_URL, res.clone());
      // La página offline necesita su CSS y JS para verse sin red.
      const html = await res.text();
      const assets = [...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all([...new Set(assets)].map((a) => cache.add(a).catch(() => {})));
      await cache.add("/icons/icon-192.png").catch(() => {});
    })().then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, YouTube, etc.: directo a la red

  // Navegación: siempre a la red. Solo si no hay señal se muestra /offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
    return;
  }

  // Assets estáticos (nombres con hash, no cambian): primero el caché.
  if (esEstatico(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return res;
          }),
      ),
    );
  }
  // Todo lo demás (datos, RSC, server actions): sin intervenir.
});
