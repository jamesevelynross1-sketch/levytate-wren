import Link from "next/link";

type ButtonLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
};

const variants = {
  primary:
    "bg-ink text-cream shadow-[0_12px_26px_rgba(15,37,39,0.11)] hover:bg-forest focus-visible:outline-ink",
  secondary:
    "border border-ink/14 bg-cream text-ink hover:border-teal/45 hover:bg-parchment/45 focus-visible:outline-teal",
  quiet:
    "text-ink underline decoration-ink/20 underline-offset-8 hover:text-teal focus-visible:outline-teal",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-11 items-center justify-center rounded-full px-5 text-center text-[12px] font-semibold uppercase tracking-[0.1em] leading-none transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${variants[variant]} ${className}`}
    >
      <span>{children}</span>
    </Link>
  );
}
