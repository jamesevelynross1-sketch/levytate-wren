"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";

type NavItem = {
  title: string;
  description?: string;
  href: string;
};

type DropdownKey = "solutions" | "platform" | "resources" | "company";

const solutionItems: NavItem[] = [
  {
    title: "For Employers",
    description: "Manage apprenticeships, employees, applications and provider matching from one workspace.",
    href: "/solutions/employers",
  },
  {
    title: "For Training Providers",
    description: "Discuss partner packages and receive qualified employer matching opportunities.",
    href: "/solutions/training-providers",
  },
  {
    title: "For Employees",
    description: "Find suitable pathways, get AI-supported guidance and manage applications.",
    href: "/solutions/employees",
  },
];

const platformItems: NavItem[] = [
  {
    title: "Employee Management",
    description: "Manage employee, role, department, site and manager records.",
    href: "/solutions/employers#employee-management",
  },
  {
    title: "Role & Pathway Mapping",
    description: "Map job roles to suitable apprenticeship pathways and progression routes.",
    href: "/#workflow",
  },
  {
    title: "Application Workflow",
    description: "Manage applications from employee submission to manager and lead approval.",
    href: "/solutions/employers#applications",
  },
  {
    title: "Provider Matching",
    description: "Request LevyTate-led provider matching based on employer need.",
    href: "/solutions/employers#provider-matching",
  },
  {
    title: "Ask LevyTate AI",
    description: "AI-supported apprenticeship guidance for employees and apprenticeship teams.",
    href: "/#ai",
  },
  {
    title: "Reporting",
    description: "Board-ready visibility across applications, providers and workforce development.",
    href: "/solutions/employers#reporting",
  },
];

const resourceItems: NavItem[] = [
  { title: "Product Roadmap", href: "/resources/product-roadmap" },
  { title: "FAQs", href: "/resources/faqs" },
  { title: "Apprenticeship Insights", href: "/resources/apprenticeship-insights" },
  { title: "Provider Partner Guide", href: "/resources/provider-partner-guide" },
  { title: "Early Access Guide", href: "/resources/beta-access-guide" },
];

const companyItems: NavItem[] = [
  { title: "About LevyTate", href: "/company/about" },
  { title: "Contact", href: "/company/contact" },
  { title: "Partner with LevyTate", href: "/company/partner" },
];

const builtFor = ["HR", "L&D", "Apprenticeship Leads", "Operations", "Senior Leadership"];

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
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        closeMenus();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-[#102c3d]/[0.07] bg-[#f6fbf8]/92 backdrop-blur-xl">
      <div className="relative mx-auto flex min-h-[72px] max-w-7xl items-center gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="LevyTate home" className="shrink-0" onClick={closeMenus}>
          <LevyTateLogo className="[--levytate-logo-size:2.15rem] sm:[--levytate-logo-size:2.55rem]" />
        </Link>

        <nav aria-label="Primary navigation" className="ml-auto hidden items-center gap-1 lg:flex">
          <NavDropdown
            dropdown="solutions"
            label="Solutions"
            items={solutionItems}
            width="w-[690px]"
            active={activeDropdown === "solutions"}
            onToggle={toggleDropdown}
            onNavigate={closeMenus}
            footer={(
              <div className="border-t border-[#102c3d]/[0.07] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42">Built for</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[#102c3d]/62">
                  {builtFor.map((role) => <span key={role}>{role}</span>)}
                </div>
              </div>
            )}
          />
          <NavDropdown dropdown="platform" label="Platform" items={platformItems} width="w-[760px]" columns active={activeDropdown === "platform"} onToggle={toggleDropdown} onNavigate={closeMenus} />
          <NavDropdown dropdown="resources" label="Resources" items={resourceItems} width="w-[340px]" compact active={activeDropdown === "resources"} onToggle={toggleDropdown} onNavigate={closeMenus} />
          <NavDropdown dropdown="company" label="Company" items={companyItems} width="w-[320px]" compact active={activeDropdown === "company"} onToggle={toggleDropdown} onNavigate={closeMenus} />
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex lg:ml-4">
          <Link href="/login" onClick={closeMenus} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-white px-4 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.09] transition hover:-translate-y-0.5 hover:ring-[#159b8f]/25">
            Login to Beta
          </Link>
          <Link href="/early-access" onClick={closeMenus} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,44,61,0.14)] transition hover:-translate-y-0.5">
            Request Early Access
          </Link>
        </div>

        <MobileNavigation open={mobileOpen} onToggle={() => {
          setActiveDropdown(null);
          setMobileOpen((current) => !current);
        }} onNavigate={closeMenus} />
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
  compact = false,
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
  compact?: boolean;
  footer?: ReactNode;
}) {
  const panelId = "public-nav-" + dropdown;

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={active}
        aria-controls={panelId}
        onClick={() => onToggle(dropdown)}
        className={"flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition " + (active ? "bg-white text-[#102c3d] shadow-[0_8px_24px_rgba(16,44,61,0.06)]" : "text-[#102c3d]/68 hover:bg-white hover:text-[#102c3d]")}
      >
        {label}
        <span aria-hidden="true" className={"h-1.5 w-1.5 rotate-45 border-b border-r border-current transition " + (active ? "rotate-[225deg]" : "")} />
      </button>

      {active ? (
        <div id={panelId} className={"absolute left-1/2 top-full z-[60] -translate-x-1/2 pt-3 " + width}>
          <div className="overflow-hidden rounded-[1.25rem] border border-[#102c3d]/[0.08] bg-white shadow-[0_28px_80px_rgba(16,44,61,0.15)]">
            <div className={columns ? "grid grid-cols-2 gap-1 p-3" : "grid gap-1 p-3"}>
              {items.map((item) => (
                <Link key={item.title} href={item.href} onClick={onNavigate} className={"group/item rounded-xl px-4 py-3 transition hover:bg-[#eef8f4] " + (compact ? "min-h-0" : "min-h-[88px]")}>
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
    ["Solutions", solutionItems],
    ["Platform", platformItems],
    ["Resources", resourceItems],
    ["Company", companyItems],
  ] as const;

  return (
    <div className="relative ml-auto lg:hidden">
      <button
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="public-mobile-navigation"
        onClick={onToggle}
        className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-[#102c3d]/[0.09]"
      >
        <span className="grid gap-1.5">
          <span className={"block h-px w-5 bg-[#102c3d] transition " + (open ? "translate-y-[7px] rotate-45" : "")} />
          <span className={"block h-px w-5 bg-[#102c3d] transition " + (open ? "opacity-0" : "")} />
          <span className={"block h-px w-5 bg-[#102c3d] transition " + (open ? "-translate-y-[7px] -rotate-45" : "")} />
        </span>
      </button>

      {open ? (
        <div id="public-mobile-navigation" className="absolute right-0 top-14 z-[60] max-h-[calc(100vh-6rem)] w-[min(22rem,calc(100vw-2.5rem))] overflow-y-auto rounded-[1.25rem] border border-[#102c3d]/[0.08] bg-white p-4 shadow-[0_28px_80px_rgba(16,44,61,0.16)]">
          <div className="grid gap-5">
            {groups.map(([label, items]) => (
              <div key={label}>
                <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{label}</p>
                <div className="mt-2 grid">
                  {items.map((item) => (
                    <Link key={item.title} href={item.href} onClick={onNavigate} className="rounded-xl px-2 py-2.5 text-sm font-semibold text-[#102c3d]/72 transition hover:bg-[#eef8f4] hover:text-[#102c3d]">
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[#102c3d]/[0.07] pt-4 sm:hidden">
            <Link href="/login" onClick={onNavigate} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f6fbf8] px-3 text-sm font-semibold text-[#102c3d]">Login to Beta</Link>
            <Link href="/early-access" onClick={onNavigate} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#102c3d] px-3 text-center text-sm font-semibold text-white">Request Early Access</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-[#102c3d]/[0.07] bg-white/72">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <LevyTateLogo className="[--levytate-logo-size:2.2rem]" />
          <p className="mt-4 max-w-md text-sm leading-6 text-[#102c3d]/58">A clearer operating system for apprenticeship decisions, workforce development and provider matching.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#102c3d]/62 md:justify-end">
          <Link href="/solutions/employers">Employers</Link>
          <Link href="/solutions/training-providers">Training providers</Link>
          <Link href="/solutions/employees">Employees</Link>
          <Link href="/company/contact">Contact</Link>
        </div>
      </div>
    </footer>
  );
}