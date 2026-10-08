"use client";

import { CheckCircle2, Download, MonitorUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type InstallState = {
  canPrompt: boolean;
  installed: boolean;
  supported: boolean;
};

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let installedInThisSession = false;
const installStateListeners = new Set<() => void>();

function isStandalone() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function currentInstallState(): InstallState {
  if (typeof window === "undefined") return { canPrompt: false, installed: false, supported: false };
  return {
    canPrompt: Boolean(deferredInstallPrompt),
    installed: isStandalone() || installedInThisSession,
    supported: "serviceWorker" in navigator,
  };
}

function publishInstallState() {
  installStateListeners.forEach((listener) => listener());
}

function useInstallState() {
  const [state, setState] = useState<InstallState>(() => currentInstallState());

  useEffect(() => {
    const update = () => setState(currentInstallState());
    installStateListeners.add(update);
    update();
    return () => { installStateListeners.delete(update); };
  }, []);

  const install = useCallback(async () => {
    const prompt = deferredInstallPrompt;
    if (!prompt) return "unavailable" as const;
    deferredInstallPrompt = null;
    publishInstallState();
    await prompt.prompt();
    const choice = await prompt.userChoice;
    installedInThisSession = choice.outcome === "accepted";
    publishInstallState();
    return choice.outcome;
  }, []);

  return { ...state, install };
}

export function LevyTatePwaBootstrap() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredInstallPrompt = event as BeforeInstallPromptEvent;
      publishInstallState();
    };
    const handleInstalled = () => {
      deferredInstallPrompt = null;
      installedInThisSession = true;
      publishInstallState();
    };
    const handleDisplayMode = () => publishInstallState();
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    displayMode.addEventListener("change", handleDisplayMode);

    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/levytate-sw.js", { scope: "/levytate/" }).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      displayMode.removeEventListener("change", handleDisplayMode);
    };
  }, []);

  if (online) return null;

  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[100] bg-[#17325c] px-4 py-2 text-center text-xs font-semibold text-white shadow-lg">
      LevyTate needs an internet connection to load live apprenticeship data.
    </div>
  );
}

export function LevyTateDesktopAppPanel() {
  const { canPrompt, installed, supported, install } = useInstallState();
  const [outcome, setOutcome] = useState<"accepted" | "dismissed" | "unavailable" | null>(null);

  async function beginInstall() {
    setOutcome(await install());
  }

  return (
    <section className="rounded-[1.25rem] border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_16px_44px_rgba(16,44,61,0.045)] sm:p-6" data-testid="levytate-desktop-app">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Desktop app</p>
          <h2 className="mt-2 text-xl font-semibold text-[#102c3d]">Install LevyTate</h2>
          <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">
            Install LevyTate on this computer for faster access and a dedicated app window.
          </p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#17325c] text-[#c7f0e4] shadow-[0_12px_28px_rgba(23,50,92,0.16)]" aria-hidden="true">
          <MonitorUp size={22} />
        </div>
      </div>

      <div className="mt-5 border-t border-[#102c3d]/[0.07] pt-5">
        {installed ? (
          <div className="flex items-start gap-3 rounded-xl bg-[#eef9f5] p-4 text-[#0b6f63]">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div><p className="text-sm font-semibold">LevyTate is installed</p><p className="mt-1 text-xs leading-5 text-[#102c3d]/55">You are using the dedicated application window. Browser access remains available.</p></div>
          </div>
        ) : canPrompt ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-[#102c3d]/52">Installation uses your browser&apos;s secure app installation flow. No separate credentials or local data copy is created.</p>
            <button type="button" onClick={() => void beginInstall()} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(16,44,61,0.14)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20">
              <Download size={16} aria-hidden="true" /> Install LevyTate
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-[#f8fbfa] p-4">
            <p className="text-sm font-semibold text-[#102c3d]">Install from your browser</p>
            <p className="mt-1 text-xs leading-5 text-[#102c3d]/55">
              {supported
                ? "Use your browser menu and choose Install LevyTate, Install app or Add to Dock. The exact wording depends on your browser."
                : "This browser does not offer application installation. LevyTate will continue to work normally in the browser."}
            </p>
          </div>
        )}
        {outcome === "dismissed" ? <p className="mt-3 text-xs text-[#102c3d]/48">Installation was not completed. You can try again whenever the browser makes installation available.</p> : null}
      </div>
    </section>
  );
}
