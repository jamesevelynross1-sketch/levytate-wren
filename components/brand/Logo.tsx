import Image from "next/image";

type LogoProps = {
  variant?: "light" | "dark" | "primary" | "reversed";
  placement?: "header" | "footer";
  priority?: boolean;
  className?: string;
};

export function Logo({ variant = "light", placement = "header", priority = true, className = "" }: LogoProps) {
  const isDark = variant === "dark" || variant === "reversed";

  if (isDark) {
    return (
      <div
        className={`inline-flex items-center rounded-lg border border-cream/70 bg-cream px-3.5 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.13)] ${className}`}
      >
        <Image
          src="/brand/mpr-consulting-logo-original.png"
          alt="MPR Consulting"
          width={511}
          height={232}
          priority={priority}
        className={`h-auto ${placement === "footer" ? "w-[150px] md:w-[168px]" : "w-[128px] md:w-[142px]"}`}
        />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center rounded-md border border-ink/[0.08] bg-cream px-2.5 py-1.5 shadow-[0_8px_18px_rgba(15,37,39,0.045)] ${className}`}
    >
      <Image
        src="/brand/mpr-consulting-logo-original.png"
        alt="MPR Consulting"
        width={511}
        height={232}
        priority={priority}
        className={`h-auto ${placement === "footer" ? "w-[150px] md:w-[170px]" : "w-[132px] md:w-[146px]"}`}
      />
    </div>
  );
}
