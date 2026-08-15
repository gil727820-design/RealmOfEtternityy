/* Service Worker — Realm of Eternity (PWA).
 *
 * Estratégia:
 *  - API (/api/*): network-first (o jogo precisa de dados frescos; fallback
 *    apenas para requisições GET com erro de rede → cache antigo).
 *  - Estáticos (imagens, fontes, manifest): cache-first com revalidação.
 *  - Páginas (navegação): network-first com fallback para cache.
 *
 * Assim o jogo continua abrindo offline, mas nunca serve estado velho do jogo.
 */

const CACHE = "realm-v1";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Nunca intercepta API (dados do jogo) e chamadas de autenticação/sessão.
  if (url.pathname.startsWith("/api/")) return;

  // Navegação: network-first, fallback p/ cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Estáticos (imagens etc.): cache-first com revalidação em background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
