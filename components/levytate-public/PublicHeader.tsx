import Link from "next/link";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";

type NavItem = {
  title: string;
  description?: string;
  href: string;
};

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
  { title: "Beta Access Guide", href: "/resources/beta-access-guide" },
];

const companyItems: NavItem[] = [
  { title: "About LevyTate", href: "/company/about" },
  { title: "Contact", href: "/company/contact" },
  { title: "Partner with LevyTate", href: "/company/partner" },
];

const builtFor = ["HR", "L&D", "Apprenticeship Leads", "Operations", "Senior Leadership"];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#102c3d]/[0.07] bg-[#f6fbf8]/92 backdrop-blur-xl">
      <div className="relative mx-auto flex min-h-[72px] max-w-7xl items-center gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="LevyTate home" className="shrink-0">
          <LevyTateLogo className="[--levytate-logo-size:2.15rem] sm:[--levytate-logo-size:2.55rem]" />
        </Link>

        <nav aria-label="Primary navigation" className="ml-auto hidden items-center gap-1 lg:flex">
          <NavDropdown label="Solutions" items={solutionItems} width="w-[690px]" footer={(
            <div className="border-t border-[#102c3d]/[0.07] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#102c3d]/42">Built for</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[#102c3d]/62">
                {builtFor.map((role) => <span key={role}>{role}</span>)}
              </div>
            </div>
          )} />
          <NavDropdown label="Platform" items={platformItems} width="w-[760px]" columns />
          <NavDropdown label="Resources" items={resourceItems} width="w-[340px]" compact />
          <NavDropdown label="Company" items={companyItems} width="w-[320px]" compact />
        </nav>

        <div className="ml-auto hidden items-center gap-2 sm:flex lg:ml-4">
          <Link href="/login" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-white px-4 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.09] transition hover:-translate-y-0.5 hover:ring-[#159b8f]/25">
            Beta Login
          </Link>
          <Link href="/#beta" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,44,61,0.14)] transition hover:-translate-y-0.5">
            Request Beta Access
          </Link>
        </div>

        <MobileNavigation />
      </div>
    </header>
  );
}

function NavDropdown({
  label,
  items,
  width,
  columns = false,
  compact = false,
  footer,
}: {
  label: string;
  items: NavItem[];
  width: string;
  columns?: boolean;
  compact?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <details className="group relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-[#102c3d]/68 transition hover:bg-white hover:text-[#102c3d] [&::-webkit-details-marker]:hidden">
        {label}
        <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 border-b border-r border-current transition group-open:rotate-[225deg]" />
      </summary>
      <div className={"invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-open:visible group-open:opacity-100 " + width}>
        <div className="overflow-hidden rounded-[1.25rem] border border-[#102c3d]/[0.08] bg-white shadow-[0_28px_80px_rgba(16,44,61,0.15)]">
          <div className={columns ? "grid grid-cols-2 gap-1 p-3" : "grid gap-1 p-3"}>
            {items.map((item) => (
              <Link key={item.title} href={item.href} className={"group/item rounded-xl px-4 py-3 transition hover:bg-[#eef8f4] " + (compact ? "min-h-0" : "min-h-[88px]")}>
                <span className="block text-sm font-semibold text-[#102c3d] transition group-hover/item:text-[#0b6f63]">{item.title}</span>
                {item.description ? <span className="mt-1.5 block text-xs leading-5 text-[#102c3d]/56">{item.description}</span> : null}
              </Link>
            ))}
          </div>
          {footer}
        </div>
      </div>
    </details>
  );
}

function MobileNavigation() {
  const groups = [
    ["Solutions", solutionItems],
    ["Platform", platformItems],
    ["Resources", resourceItems],
    ["Company", companyItems],
  ] as const;

  return (
    <details className="group relative ml-auto lg:hidden">
      <summary aria-label="Open navigation" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full bg-white ring-1 ring-[#102c3d]/[0.09] [&::-webkit-details-marker]:hidden">
        <span className="grid gap-1.5">
          <span className="block h-px w-5 bg-[#102c3d]" />
          <span className="block h-px w-5 bg-[#102c3d]" />
          <span className="block h-px w-5 bg-[#102c3d]" />
        </span>
      </summary>
      <div className="absolute right-0 top-14 z-50 max-h-[calc(100vh-6rem)] w-[min(22rem,calc(100vw-2.5rem))] overflow-y-auto rounded-[1.25rem] border border-[#102c3d]/[0.08] bg-white p-4 shadow-[0_28px_80px_rgba(16,44,61,0.16)]">
        <div className="grid gap-5">
          {groups.map(([label, items]) => (
            <div key={label}>
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{label}</p>
              <div className="mt-2 grid">
                {items.map((item) => (
                  <Link key={item.title} href={item.href} className="rounded-xl px-2 py-2.5 text-sm font-semibold text-[#102c3d]/72 transition hover:bg-[#eef8f4] hover:text-[#102c3d]">
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[#102c3d]/[0.07] pt-4 sm:hidden">
          <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f6fbf8] px-3 text-sm font-semibold text-[#102c3d]">Beta Login</Link>
          <Link href="/#beta" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#102c3d] px-3 text-center text-sm font-semibold text-white">Request Access</Link>
        </div>
      </div>
    </details>
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