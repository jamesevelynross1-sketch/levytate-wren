const OFFLINE_DOCUMENT = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#17325C">
    <title>LevyTate needs a connection</title>
    <style>
      :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; background: #f6fbf8; color: #102c3d; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
      main { width: min(100%, 480px); padding: 32px; border: 1px solid rgba(16,44,61,.09); border-radius: 24px; background: white; box-shadow: 0 30px 90px rgba(16,44,61,.1); }
      p:first-child { margin: 0; color: #0b6f63; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 12px 0 0; font-size: 28px; letter-spacing: -.03em; }
      p:last-child { margin: 14px 0 0; color: rgba(16,44,61,.65); font-size: 14px; line-height: 1.7; }
    </style>
  </head>
  <body><main><p>Connection required</p><h1>LevyTate is temporarily offline</h1><p>LevyTate needs an internet connection to load live apprenticeship data. Reconnect, then reload this window.</p></main></body>
</html>`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/levytate/")) return;

  event.respondWith(
    fetch(request).catch(() => new Response(OFFLINE_DOCUMENT, {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    })),
  );
});
