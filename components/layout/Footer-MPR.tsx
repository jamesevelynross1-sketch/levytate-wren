import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ENQUIRY_EMAIL, ENQUIRY_MAILTO } from "@/lib/contact";

const footerGroups = [
  {
    title: "Services",
    links: [
      { href: "/framework", label: "Apprenticeship Framework" },
      { href: "/levy-health-check", label: "Levy Health Check" },
      { href: "/provider-matching", label: "Provider Matching" },
      { href: "/services", label: "Consultancy Services" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/insights", label: "Insights" },
      { href: "/neet-on-our-watch", label: "NEET On Our Watch" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="container-px bg-forest text-cream">
      <div className="mx-auto grid max-w-7xl gap-10 py-14 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <Logo variant="dark" />
          <p className="mt-5 max-w-md text-sm leading-7 text-cream/68">
            Independent apprenticeship consultancy for employers who want levy
            funding, provider choice and workforce development to work harder.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href={ENQUIRY_MAILTO} className="inline-flex rounded-full bg-cream px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink">
              Book a Strategy Call
            </a>
            <a href={`mailto:${ENQUIRY_EMAIL}`} className="text-sm text-cream/78 hover:text-cream">
              {ENQUIRY_EMAIL}
            </a>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
                {group.title}
              </p>
              <div className="mt-4 grid gap-3 text-sm font-semibold text-cream/72">
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className="hover:text-cream">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-cream/12 py-5 text-xs text-cream/54 sm:flex-row sm:items-center sm:justify-between">
        <span>Part of MPR Group.</span>
        <span>Independent guidance. Practical clarity. Better decisions.</span>
      </div>
    </footer>
  );
}
