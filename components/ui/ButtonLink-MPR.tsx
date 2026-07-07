import Link from "next/link";

type ButtonLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
};

const variants = {
  primary: "button-pill--primary",
  secondary: "",
  quiet: "button-pill--quiet",
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
      className={`button-pill group ${variants[variant]} ${className}`}
    >
      <span>{children}</span>
    </Link>
  );
}
