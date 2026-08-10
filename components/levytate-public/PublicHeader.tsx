"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";

type NavItem = {
  title: string;
  description?: string;
  href: string;
  secondary?: boolean;
};

type DropdownKey = "solutions" | "platform";

const solutionItems: NavItem[] = [
  {
    title: "For Employers",
    description: "Run applications, learners, providers and apprenticeship operations from one workspace.",
    href: "/solutions/employers",
  },
  {
    title: "For Employees",
    description: "Apply, follow progress and understand the next step in your apprenticeship journey.",
    href: "/solutions/employees",
  },
  {
    title: "For Training Providers",
    description: "Support clearer employer-led provider relationships and programme delivery.",
    href: "/solutions/training-providers",
    secondary: true,
  },
];

const platformItems: NavItem[] = [
  {
    title: "Operations Centre",
    description: "See prioritised learner, review and operational actions in one daily view.",
    href: "/#operations-centre",
  },
  {
    title: "Applications & Approvals",
    description: "Connect employee submission, manager review and final approval.",
    href: "/#applications-approvals",
  },
  {
    title: "Learner Management",
    description: "Maintain the operational journey from enrolment through completion.",
    href: "/#learner-management",
  },
  {
    title: "Provider Management",
    description: "Keep delivery partners, programmes and learner relationships visible.",
    href: "/#provider-management",
  },
  {
    title: "People & Programmes",
    description: "Connect organisational context to apprenticeship activity.",
    href: "/#people-programmes",
  },
  {
    title: "LevyTate Copilot",
    description: "Role-aware support for next steps, applications and platform navigation.",
    href: "/#copilot",
  },
];

const builtFor = ["Apprenticeship Leads", "L&D", "HR and People teams", "Line Managers"];

export function PublicHeader() {
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const closeMenus = () => {
    setActiveDropdown(null);
    setMobileOpen(false);
  };

  const toggleDropdown = (dropdown: DropdownKey) => {
    setMobileOpen(false);
    setActiveDropdown((current) => current === dropdown ? null : dropdown);
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) closeMenus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-[#102c3d]/[0.07] bg-[#f6fbf8]/95 backdrop-blur-xl">
      <div className="relative mx-auto flex min-h-[72px] max-w-[90rem] items-center gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="LevyTate home" className="inline-flex min-h-11 shrink-0 items-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20" onClick={closeMenus}>
          <LevyTateLogo className="[--levytate-logo-size:2.15rem] sm:[--levytate-logo-size:2.55rem]" />
        </Link>

        <nav aria-label="Primary navigation" className="ml-auto hidden items-center gap-1 lg:flex">
          <NavDropdown
            dropdown="platform"
            label="Platform"
            items={platformItems}
            width="w-[760px]"
            columns
            active={activeDropdown === "platform"}
            onToggle={toggleDropdown}
            onNavigate={closeMenus}
          />
          <NavDropdown
            dropdown="solutions"
            label="Solutions"
            items={solutionItems}
            width="w-[680px]"
            active={activeDropdown === "solutions"}
            onToggle={toggleDropdown}
            onNavigate={closeMenus}
            footer={(
              <div className="border-t border-[#102c3d]/[0.07] px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/40">Built for employer apprenticeship operations</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[#102c3d]/58">
                  {builtFor.map((role) => <span key={role}>{role}</span>)}
                </div>
              </div>
            )}
          />
          <Link href="/levytate/support" onClick={closeMenus} className="inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold text-[#102c3d]/68 transition hover:bg-white hover:text-[#102c3d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20">Support</Link>
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex lg:ml-4">
          <Link href="/login" onClick={closeMenus} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-white px-4 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.1] transition hover:-translate-y-0.5 hover:ring-[#159b8f]/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20">
            Login
          </Link>
          <Link href="/early-access" onClick={closeMenus} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,44,61,0.14)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/25">
            Request Early Access
          </Link>
        </div>

        <MobileNavigation
          open={mobileOpen}
          onToggle={() => {
            setActiveDropdown(null);
            setMobileOpen((current) => !current);
          }}
          onNavigate={closeMenus}
        />
      </div>
    </header>
  );
}

function NavDropdown({
  dropdown,
  label,
  items,
  width,
  active,
  onToggle,
  onNavigate,
  columns = false,
  footer,
}: {
  dropdown: DropdownKey;
  label: string;
  items: NavItem[];
  width: string;
  active: boolean;
  onToggle: (dropdown: DropdownKey) => void;
  onNavigate: () => void;
  columns?: boolean;
  footer?: ReactNode;
}) {
  const panelId = `public-nav-${dropdown}`;

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={active}
        aria-controls={panelId}
        onClick={() => onToggle(dropdown)}
        className={`flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20 ${active ? "bg-white text-[#102c3d] shadow-[0_8px_24px_rgba(16,44,61,0.06)]" : "text-[#102c3d]/68 hover:bg-white hover:text-[#102c3d]"}`}
      >
        {label}
        <span aria-hidden="true" className={`h-1.5 w-1.5 rotate-45 border-b border-r border-current transition ${active ? "rotate-[225deg]" : ""}`} />
      </button>

      {active ? (
        <div id={panelId} className={`absolute left-1/2 top-full z-[60] -translate-x-1/2 pt-3 ${width}`}>
          <div className="overflow-hidden rounded-[1.25rem] border border-[#102c3d]/[0.08] bg-white shadow-[0_28px_80px_rgba(16,44,61,0.15)]">
            <div className={columns ? "grid grid-cols-2 gap-1 p-3" : "grid grid-cols-2 gap-1 p-3"}>
              {items.map((item) => (
                <Link key={item.title} href={item.href} onClick={onNavigate} className={`group/item min-h-[88px] rounded-xl px-4 py-3 transition hover:bg-[#eef8f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/15 ${item.secondary ? "col-span-2 border-t border-[#102c3d]/[0.06] bg-[#fbfcfb]" : ""}`}>
                  <span className="block text-sm font-semibold text-[#102c3d] transition group-hover/item:text-[#0b6f63]">{item.title}</span>
                  {item.description ? <span className="mt-1.5 block text-xs leading-5 text-[#102c3d]/56">{item.description}</span> : null}
                </Link>
              ))}
            </div>
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileNavigation({ open, onToggle, onNavigate }: { open: boolean; onToggle: () => void; onNavigate: () => void }) {
  const groups = [
    ["Platform", platformItems],
    ["Solutions", solutionItems],
  ] as const;

  return (
    <div className="relative ml-auto lg:hidden">
      <button
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="public-mobile-navigation"
        onClick={onToggle}
        className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-[#102c3d]/[0.1] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20"
      >
        <span className="grid gap-1.5">
          <span className={`block h-px w-5 bg-[#102c3d] transition ${open ? "translate-y-[7px] rotate-45" : ""}`} />
          <span className={`block h-px w-5 bg-[#102c3d] transition ${open ? "opacity-0" : ""}`} />
          <span className={`block h-px w-5 bg-[#102c3d] transition ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
        </span>
      </button>

      {open ? (
        <div id="public-mobile-navigation" className="absolute right-0 top-14 z-[60] max-h-[calc(100vh-6rem)] w-[min(23rem,calc(100vw-2.5rem))] overflow-y-auto rounded-[1.25rem] border border-[#102c3d]/[0.08] bg-white p-4 shadow-[0_28px_80px_rgba(16,44,61,0.16)]">
          <div className="grid gap-5">
            {groups.map(([groupLabel, items]) => (
              <div key={groupLabel}>
                <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{groupLabel}</p>
                <div className="mt-2 grid">
                  {items.map((item) => (
                    <Link key={item.title} href={item.href} onClick={onNavigate} className={`flex min-h-11 items-center rounded-xl px-2 py-2.5 text-sm font-semibold text-[#102c3d]/72 transition hover:bg-[#eef8f4] hover:text-[#102c3d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/15 ${item.secondary ? "mt-1 border-t border-[#102c3d]/[0.06]" : ""}`}>
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <Link href="/levytate/support" onClick={onNavigate} className="flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-[#102c3d]/72">Support</Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[#102c3d]/[0.07] pt-4 sm:hidden">
            <Link href="/login" onClick={onNavigate} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f6fbf8] px-3 text-sm font-semibold text-[#102c3d]">Login</Link>
            <Link href="/early-access" onClick={onNavigate} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#102c3d] px-3 text-center text-sm font-semibold text-white">Request Early Access</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-[#102c3d]/[0.07] bg-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <LevyTateLogo className="[--levytate-logo-size:2.2rem]" />
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#102c3d]/58">The operating system for employer apprenticeship programmes. Applications, learners, providers and operational work in one secure workspace.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#102c3d]/62 md:max-w-xl md:justify-end">
            <Link href="/solutions/employers" className="inline-flex min-h-11 items-center">Employers</Link>
            <Link href="/solutions/employees" className="inline-flex min-h-11 items-center">Employees</Link>
            <Link href="/solutions/training-providers" className="inline-flex min-h-11 items-center">Training providers</Link>
            <Link href="/early-access" className="inline-flex min-h-11 items-center">Early Access</Link>
            <Link href="/login" className="inline-flex min-h-11 items-center">Login</Link>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-4 border-t border-[#102c3d]/[0.07] pt-6 text-xs text-[#102c3d]/48 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} LevyTate. Employer apprenticeship operations, connected.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
            <Link href="/levytate/privacy" className="inline-flex min-h-11 items-center">Privacy</Link>
            <Link href="/levytate/early-access-terms" className="inline-flex min-h-11 items-center">Terms</Link>
            <Link href="/levytate/support" className="inline-flex min-h-11 items-center">Support</Link>
            <a href="mailto:hello@levytate.co.uk" className="inline-flex min-h-11 items-center">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
