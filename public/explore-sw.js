/* LevyTate Explore: network-first and privacy-preserving public app shell.
   We deliberately cache no contact submissions, employee details or standards:
   approvals and programme statuses must be read from the current source. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/explore")) return;
  event.respondWith(
    fetch(event.request).catch(() =>
      new Response(
        "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Explore · Offline</title><body style=\"margin:0;background:#102c3d;color:white;font-family:system-ui;padding:10vh 8vw\"><p style=\"color:#c6ebdd;font-weight:600\">LEVYTATE / EXPLORE</p><h1 style=\"font-size:clamp(2rem,6vw,4rem)\">You're offline for now.</h1><p style=\"line-height:1.8;max-width:37rem\">Exploring apprenticeship programmes needs an internet connection so you see the latest available information. Reconnect and try again.</p><a style=\"color:#c6ebdd\" href=\"/explore\">Try again →</a></body></html>",
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
      ),
    ),
  );
});
