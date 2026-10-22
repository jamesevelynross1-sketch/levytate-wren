"use client";

import { useEffect, useState } from "react";

export function ExplorePwaBootstrap() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const updateOnline = () => setOffline(!navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/explore-sw.js", { scope: "/explore" }).catch(() => {
        // Browsing works without a service worker; do not block the app.
      });
    }
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  return offline ? (
    <p role="status" className="fixed inset-x-0 top-0 z-[100] bg-[#102c3d] px-3 py-2 text-center text-xs font-semibold text-white shadow-lg">
      You&apos;re offline. Reconnect for current apprenticeship information.
    </p>
  ) : null;
}
