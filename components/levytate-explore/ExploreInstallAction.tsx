"use client";

import Image from "next/image";
import { CheckCircle2, Download, MonitorSmartphone, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform?: string };
type BeforeInstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};
type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const agent = navigator.userAgent.toLowerCase();
  const isIPadDesktop = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/.test(agent) || isIPadDesktop) return "ios";
  return /android/.test(agent) ? "android" : "desktop";
}

function runningAsApp() {
  if (typeof window === "undefined") return false;
  const appleNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || appleNavigator.standalone === true;
}

/**
 * Browser installation is free; no Apple or Google store account is required.
 * Chromium can expose beforeinstallprompt; iOS needs native Share → Add to Home Screen.
 * Never label an installation as complete until the browser confirms it.
 */
export function ExploreInstallAction() {
  const dialog = useRef<HTMLDialogElement>(null);
  const deferred = useRef<BeforeInstallEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [outcome, setOutcome] = useState<"idle" | "dismissed" | "requested">("idle");

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(runningAsApp());

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferred.current = event as BeforeInstallEvent;
      setCanPrompt(true);
    };
    const onInstalled = () => {
      deferred.current = null;
      setCanPrompt(false);
      setInstalled(true);
      setOutcome("idle");
      dialog.current?.close();
    };
    const modeQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => setInstalled(runningAsApp());

    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    modeQuery.addEventListener("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      modeQuery.removeEventListener("change", onDisplayChange);
    };
  }, []);

  async function requestInstall() {
    const prompt = deferred.current;
    if (!prompt) return;
    deferred.current = null;
    setCanPrompt(false);
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      setOutcome(result.outcome === "dismissed" ? "dismissed" : "requested");
      // An accepted prompt starts installation; only appinstalled confirms it.
    } catch {
      setOutcome("dismissed");
    }
  }

  const explanation = platform === "ios"
    ? [
        "Open LevyTate Explore in Safari on your iPhone.",
        "Tap the Share icon (or Page Menu, then Share).",
        "Choose Add to Home Screen, enable Open as Web App, then tap Add.",
      ]
    : platform === "android"
      ? [
          "Open LevyTate Explore in Chrome on your Android phone.",
          "Tap the three-dot menu at the top of your browser.",
          "Choose Add to Home screen or Install app and confirm.",
        ]
      : [
          "Open LevyTate Explore in Chrome or Edge on your computer.",
          "Look for Install in the address bar, or open the browser menu.",
          "Select Install Explore to create an app shortcut.",
        ];

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#142f3a] px-4 text-[12px] font-extrabold text-white transition hover:bg-[#245360] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#117f70] sm:px-5"
        aria-label={installed ? "LevyTate Explore is installed" : "Install LevyTate Explore for free"}
      >
        {installed ? <CheckCircle2 size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
        <span className="sm:hidden">{installed ? "Installed" : "Get app"}</span>
        <span className="hidden sm:inline">{installed ? "Installed" : "Get the app"}</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="explore-install-title"
        aria-describedby="explore-install-description"
        className="explore-install-dialog w-[calc(100%-2rem)] max-w-[465px] overflow-hidden rounded-[25px] border border-[#142f3a]/10 bg-[#faf9f5] p-0 text-[#142f3a] shadow-[0_28px_90px_rgba(16,44,61,.3)] backdrop:bg-[#142f3a]/75"
        onClick={event => {
          // Native dialog: clicking its backdrop closes it; inner card is inert.
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="px-6 pb-8 pt-6 sm:px-8">
          <div className="flex items-start justify-between gap-5">
            <div className="flex h-[62px] w-[62px] items-center justify-center rounded-[18px] border border-[#102c3d]/10 bg-white shadow-sm">
              <Image src="/brand/pwa/levytate-192.png" width={50} height={50} alt="" className="h-[50px] w-[50px] rounded-[12px]" />
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close installation instructions" className="grid h-10 w-10 place-items-center rounded-full border border-[#102c3d]/10 bg-white text-[#102c3d]/65 hover:text-[#102c3d]">
              <X size={19} aria-hidden="true" />
            </button>
          </div>
          <p className="explore-eyebrow mt-7 text-[#117f70]">Your development, one tap away</p>
          <h2 id="explore-install-title" className="explore-display mt-3 text-[clamp(1.9rem,5vw,2.4rem)]">
            Explore, right on your home screen.
          </h2>
          <p id="explore-install-description" className="mt-4 text-sm leading-7 text-[#102c3d]/65">
            Install LevyTate Explore free, with its own icon and app-style window. No Apple or Google app-store download needed.
          </p>

          {installed ? (
            <div className="mt-6 flex items-start gap-3 rounded-[16px] bg-[#e2f3e9] p-4">
              <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-[#117f70]" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Explore is installed on this device.</p>
                <p className="mt-1 text-xs leading-5 text-[#102c3d]/60">You can open it directly from your home screen or app launcher.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-7 flex flex-wrap gap-2" aria-label="Installation instructions for your device">
                {([
                  ["ios", "iPhone / iPad"],
                  ["android", "Android"],
                  ["desktop", "Computer"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={platform === value} onClick={() => setPlatform(value)}
                    className={"rounded-full border px-3.5 py-2 text-xs font-semibold transition " +
                      (platform === value ? "border-[#102c3d] bg-[#102c3d] text-white" : "border-[#102c3d]/15 bg-white text-[#102c3d]/70 hover:border-[#102c3d]/35")}>
                    {label}
                  </button>
                ))}
              </div>
              {canPrompt && platform !== "ios" ? (
                <button type="button" onClick={() => void requestInstall()}
                  className="mt-5 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#142f3a] px-5 text-sm font-extrabold text-white transition hover:bg-[#275566]">
                  <Download size={18} aria-hidden="true" /> Install Explore now
                </button>
              ) : null}
              <ol className="mt-5 grid gap-3">
                {explanation.map((step, index) => (
                  <li key={step} className="flex items-start gap-3 rounded-[15px] bg-white p-4 text-sm leading-6 text-[#102c3d]/75">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e0eee7] text-xs font-bold text-[#117f70]">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {outcome === "dismissed" ? (
                <p role="status" className="mt-4 text-xs text-[#102c3d]/65">Installation was cancelled. You can retry using your browser menu.</p>
              ) : outcome === "requested" ? (
                <p role="status" className="mt-4 text-xs text-[#102c3d]/65">The browser accepted the request. Complete any remaining on-screen steps to finish installing.</p>
              ) : null}
            </>
          )}
          <div className="mt-6 flex items-center gap-3 border-t border-[#102c3d]/10 pt-5 text-xs leading-5 text-[#102c3d]/55">
            {platform === "ios" ? <Share2 size={18} className="shrink-0 text-[#117f70]" aria-hidden="true" /> : <MonitorSmartphone size={18} className="shrink-0 text-[#117f70]" aria-hidden="true" />}
            <span>Always free to access. A connection is needed to view current apprenticeship information.</span>
          </div>
        </div>
      </dialog>
    </>
  );
}
