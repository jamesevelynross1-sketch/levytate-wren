import Image from "next/image";

type LogoProps = {
  variant?: "primary" | "reversed" | "dark";
  placement?: "header" | "footer";
  priority?: boolean;
};

const placementStyles = {
  header: "w-[170px] sm:w-[190px] lg:w-[220px]",
  footer: "w-[150px] sm:w-[170px]",
};

const darkLockupStyles = {
  header: {
    wrap: "gap-3",
    icon: "w-[58px] sm:w-[64px] lg:w-[74px]",
    mpr: "text-[2.25rem] sm:text-[2.55rem] lg:text-[3rem]",
    consulting: "text-[1.35rem] sm:text-[1.5rem] lg:text-[1.75rem]",
  },
  footer: {
    wrap: "gap-2",
    icon: "w-[44px] sm:w-[50px]",
    mpr: "text-[1.7rem] sm:text-[1.95rem]",
    consulting: "text-[1.02rem] sm:text-[1.16rem]",
  },
};

export function Logo({
  variant = "primary",
  placement = "header",
  priority = false,
}: LogoProps) {
  if (variant === "reversed" || variant === "dark") {
    const styles = darkLockupStyles[placement];

    return (
      <span className={`inline-flex items-center ${styles.wrap}`} aria-label="MPR Consulting">
        <Image
          src="/mpr-consulting-icon-transparent.png"
          alt=""
          width={178}
          height={232}
          priority={priority}
          className={`h-auto shrink-0 ${styles.icon}`}
        />
        <span className="flex flex-col leading-none text-cream">
          <span className={`${styles.mpr} font-extrabold tracking-normal`}>
            MPR
          </span>
          <span className={`${styles.consulting} -mt-0.5 font-bold tracking-normal`}>
            Consulting
          </span>
        </span>
      </span>
    );
  }

  return (
    <Image
      src="/mpr-consulting-logo-transparent.png"
      alt="MPR Consulting"
      width={512}
      height={232}
      priority={priority}
      className={`h-auto ${placementStyles[placement]}`}
    />
  );
}
