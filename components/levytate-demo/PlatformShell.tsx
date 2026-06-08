"use client";

import type { ReactNode } from "react";
import Image from "next/image";

export type PlatformNavSection = {
  title: string;
  items: string[];
};

type PlatformShellProps = {
  tenantName: string;
  tenantLabel: string;
  activeItem?: string;
  navSections: PlatformNavSection[];
  topBar: ReactNode;
  children: ReactNode;
  sideRail?: ReactNode;
};

export function PlatformShell({ tenantName, tenantLabel, activeItem = "Dashboard", navSections, topBar, children, sideRail }: PlatformShellProps) {
  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#102c3d]">
      <div className="grid min-h-screen lg:grid-cols-[296px_minmax(0,1fr)]">
        <PlatformSidebar tenantName={tenantName} tenantLabel={tenantLabel} activeItem={activeItem} navSections={navSections} />
        <div className="min-w-0">
          {topBar}
          <div className="mx-auto grid w-full max-w-[1600px] gap-8 px-5 py-7 sm:px-7 lg:px-9 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 space-y-8">{children}</section>
            {sideRail ? <aside className="grid h-fit gap-4 2xl:sticky 2xl:top-7">{sideRail}</aside> : null}
          </div>
        </div>
      </div>
    </main>
  );
}

export function PlatformTopBar({
  tenantName,
  tenantSubtitle,
  children,
}: {
  tenantName: string;
  tenantSubtitle: string;
  children: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#102c3d]/[0.08] bg-white/92 shadow-[0_1px_0_rgba(16,44,61,0.02)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1600px] gap-4 px-5 py-3.5 sm:px-7 lg:px-9 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-5">
          <LevyTateLogo className="h-[40px] sm:h-[46px]" />
          <div className="h-9 w-px shrink-0 bg-[#102c3d]/10" />
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <PortakabinLogoBadge tenantName={tenantName} />
            <div className="min-w-0 border-l border-[#102c3d]/10 pl-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#0b6f63]">Employer environment</p>
              <p className="truncate text-sm font-semibold text-[#102c3d]">Powered by LevyTate</p>
              <p className="sr-only">{tenantSubtitle}</p>
            </div>
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}

function PortakabinLogoBadge({ tenantName }: { tenantName: string }) {
  return (
    <Image src="/brand/portakabin-logo.svg" alt={tenantName} width={1024} height={512} priority className="h-[40px] w-auto rounded-lg object-contain sm:h-[44px]" />
  );
}

export function PlatformPanel({
  eyebrow,
  title,
  actions,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-[1.35rem] border border-[#102c3d]/[0.065] bg-white p-6 shadow-[0_18px_45px_rgba(16,44,61,0.045)] ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">{eyebrow}</p> : null}
          <h2 className="mt-1.5 text-[1.3rem] font-semibold leading-7 tracking-[-0.01em] text-[#102c3d]">{title}</h2>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function PlatformMetric({ label, value, copy }: { label: string; value: string | number; copy?: string }) {
  return (
    <article className="rounded-[1.1rem] border border-[#102c3d]/[0.055] bg-white p-4 shadow-[0_10px_24px_rgba(16,44,61,0.04)]">
      <p className="text-xs font-medium text-[#102c3d]/48">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-[#102c3d]">{value}</p>
      {copy ? <p className="mt-1.5 text-xs leading-5 text-[#102c3d]/54">{copy}</p> : null}
    </article>
  );
}

export function PlatformButton({
  children,
  onClick,
  variant = "dark",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "dark" | "soft" | "amber" | "coral";
  className?: string;
}) {
  const variants = {
    dark: "bg-[#102c3d] text-white shadow-[0_10px_22px_rgba(16,44,61,0.12)] hover:bg-[#17394d]",
    soft: "bg-[#f5f7f3] text-[#102c3d] ring-1 ring-[#102c3d]/[0.06] hover:bg-white",
    amber: "bg-[#fff3bb] text-[#7b6100] ring-1 ring-[#8a6a00]/[0.08]",
    coral: "bg-[#ffe4e9] text-[#ad344e] ring-1 ring-[#bf4159]/[0.08]",
  };

  return (
    <button onClick={onClick} className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-xs font-semibold transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#159b8f]/15 ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function PlatformSidebar({ tenantName, tenantLabel, activeItem, navSections }: { tenantName: string; tenantLabel: string; activeItem: string; navSections: PlatformNavSection[] }) {
  return (
    <aside className="hidden border-r border-[#102c3d]/10 bg-white px-4 py-5 lg:flex lg:h-screen lg:flex-col">
      <div className="flex items-center px-2">
        <LevyTateLogo className="h-[42px]" />
      </div>

      <div className="mt-5 rounded-2xl border border-[#102c3d]/[0.06] bg-[#ffd200] px-4 py-3 text-[#102c3d] shadow-[0_14px_30px_rgba(16,44,61,0.08)]">
        <p className="text-base font-semibold tracking-tight">{tenantName}</p>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#102c3d]/62">{tenantLabel}</p>
      </div>

      <nav className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#102c3d]/34">{section.title}</p>
            <div className="mt-1.5 grid gap-1">
              {section.items.map((item) => {
                const active = item === activeItem;
                return (
                  <button
                    key={item}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium transition ${
                      active ? "bg-[#f0f5ed] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f]" : "text-[#102c3d]/58 hover:bg-[#f8faf4] hover:text-[#102c3d]"
                    }`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold ${active ? "bg-white text-[#159b8f]" : "bg-[#f8faf4] text-[#102c3d]/46"}`}>
                      {item.split(" ").map((word) => word[0]).join("").slice(0, 2)}
                    </span>
                    <span className="truncate">{item}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-5 rounded-2xl bg-[#f8faf4] px-4 py-3">
        <p className="text-xs font-semibold text-[#102c3d]">Powered by LevyTate</p>
        <p className="mt-1 text-xs leading-5 text-[#102c3d]/52">Reusable apprenticeship operating system.</p>
      </div>
    </aside>
  );
}

export function LevyTateLogo({ className = "" }: { className?: string }) {
  return (
    <Image src="/logos/levytate-transparent.png" alt="LevyTate" width={219} height={53} priority className={`w-auto object-contain ${className}`} />
  );
}
