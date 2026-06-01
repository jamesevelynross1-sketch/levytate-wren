type SectionEyebrowProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionEyebrow({ children, className = "" }: SectionEyebrowProps) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] text-teal ${className}`}>
      {children}
    </p>
  );
}
