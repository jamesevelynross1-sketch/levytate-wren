type SectionEyebrowProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionEyebrow({ children, className = "" }: SectionEyebrowProps) {
  return (
    <p className={`mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal ${className}`}>
      {children}
    </p>
  );
}
