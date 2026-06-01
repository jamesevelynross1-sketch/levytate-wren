import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ENQUIRY_EMAIL, ENQUIRY_MAILTO } from "@/lib/contact";

const footerLinks = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/insights", label: "Insights" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="border-t border-cream/10 bg-ink text-cream">
      <div className="container-px mx-auto max-w-7xl py-14">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <Logo variant="reversed" placement="footer" />
            <p className="mt-4 max-w-md text-sm leading-6 text-cream/72">
              Independent apprenticeship and workforce capability advisory.
            </p>
            <Link
              href={ENQUIRY_MAILTO}
              className="mt-4 inline-flex text-sm font-semibold text-cream transition hover:text-white"
            >
              {ENQUIRY_EMAIL}
            </Link>
          </div>
          <nav className="flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-cream/78">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-10 h-px w-full bg-cream/12" />
        <p className="mt-6 text-sm text-cream/58">Part of MPR Group.</p>
      </div>
    </footer>
  );
}
