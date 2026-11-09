
const CACHE_NAME = "va-electro-mobile-v3";

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg"
];

const SUPABASE_LIBRARY =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await cache.addAll(APP_FILES);

      // A Supabase könyvtárat is megpróbáljuk eltárolni.
      // Ha ez nem sikerül, az alkalmazás telepítése akkor is folytatódik.
      try {
        const response = await fetch(SUPABASE_LIBRARY);

        if (response.ok) {
          await cache.put(SUPABASE_LIBRARY, response);
        }
      } catch (error) {
        console.log("A Supabase könyvtár most nem gyorsítótárazható.");
      }
    })()
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // A Supabase JavaScript-könyvtár offline is betölthető.
  if (url.href === SUPABASE_LIBRARY) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(SUPABASE_LIBRARY);

        if (cached) {
          return cached;
        }

        try {
          const response = await fetch(request);

          if (response.ok) {
            await cache.put(SUPABASE_LIBRARY, response.clone());
          }

          return response;
        } catch (error) {
          return new Response(
            "A Supabase könyvtár nem érhető el offline.",
            { status: 503 }
          );
        }
      })
    );

    return;
  }

  // Más külső címeket és a Supabase API-t nem gyorsítótárazunk.
  if (
    url.origin !== self.location.origin ||
    request.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache =>
            cache.put(request, copy)
          );
        }

        return response;
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match("./index.html")
        )
      )
  );
});
