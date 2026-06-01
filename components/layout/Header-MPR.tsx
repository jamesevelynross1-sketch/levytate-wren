"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ENQUIRY_MAILTO } from "@/lib/contact";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/framework", label: "Framework" },
  { href: "/levy-health-check", label: "Levy Health Check" },
  { href: "/provider-matching", label: "Provider Matching" },
  { href: "/neet-on-our-watch", label: "NEET On Our Watch" },
  { href: "/insights", label: "Insights" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="container-px sticky top-0 z-40 border-b border-ink/[0.08] bg-cream/94 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 py-3.5">
        <Link href="/" aria-label="MPR Consulting home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.09em] text-ink/64 xl:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap transition duration-300 hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={ENQUIRY_MAILTO}
            className="hidden min-h-10 items-center rounded-full bg-ink px-4 text-[11px] font-semibold uppercase leading-none tracking-[0.09em] text-cream transition duration-300 hover:bg-forest lg:inline-flex"
          >
            Book a Strategy Call
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex min-h-10 items-center rounded-full border border-ink/12 px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            Menu
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-navigation" className="mx-auto max-w-7xl border-t border-ink/10 py-4 xl:hidden">
          <nav className="grid gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-ink/72">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 transition hover:bg-white/45 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            <a
              href={ENQUIRY_MAILTO}
              className="mt-2 rounded-full bg-ink px-4 py-3 text-center text-[12px] text-cream"
            >
              Book a Strategy Call
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
