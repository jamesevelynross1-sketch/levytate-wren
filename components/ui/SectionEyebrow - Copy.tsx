type SectionEyebrowProps = {
  children: React.ReactNode;
};

export function SectionEyebrow({ children }: SectionEyebrowProps) {
  return (
    <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
      {children}
    </p>
  );
}
