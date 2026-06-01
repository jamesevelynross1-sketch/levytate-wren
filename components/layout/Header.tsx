import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ENQUIRY_MAILTO } from "@/lib/contact";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/insights", label: "Insights" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-cream shadow-[0_10px_30px_rgba(15,37,39,0.045)]">
      <div className="container-px mx-auto flex max-w-7xl items-center justify-between gap-5 py-3.5">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-xl border border-ink/10 bg-cream px-3 py-2 shadow-[0_10px_24px_rgba(15,37,39,0.06)]"
        >
          <Logo priority />
        </Link>

        <nav className="hidden items-center gap-7 text-[13px] font-semibold text-ink/70 lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <ButtonLink href={ENQUIRY_MAILTO}>Book a conversation</ButtonLink>
        </div>
        <Link
          href="/contact"
          className="inline-flex min-h-10 items-center rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink lg:hidden"
        >
          Contact
        </Link>
      </div>
    </header>
  );
}
