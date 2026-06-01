import Image from "next/image";

type LogoProps = {
  variant?: "light" | "dark";
  className?: string;
};

export function Logo({ variant = "light", className = "" }: LogoProps) {
  if (variant === "dark") {
    return (
      <div
        className={`inline-flex items-center rounded-lg border border-cream/70 bg-cream px-3.5 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.13)] ${className}`}
      >
        <Image
          src="/brand/mpr-consulting-logo-original.png"
          alt="MPR Consulting"
          width={511}
          height={232}
          className="h-auto w-[168px] md:w-[188px]"
        />
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-ink/[0.08] bg-cream px-3.5 py-2 shadow-[0_8px_22px_rgba(15,37,39,0.055)] ${className}`}
    >
      <Image
        src="/brand/mpr-consulting-logo-original.png"
        alt="MPR Consulting"
        width={511}
        height={232}
        priority
        className="h-auto w-[188px] md:w-[220px]"
      />
    </div>
  );
}
