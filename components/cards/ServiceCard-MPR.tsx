type ServiceCardProps = {
  title: string;
  description: string;
};

export function ServiceCard({ title, description }: ServiceCardProps) {
  return (
    <article className="premium-card flex h-full flex-col rounded-xl p-6 transition duration-300 hover:-translate-y-1 hover:border-teal/20 hover:bg-white/[0.42] hover:shadow-[0_18px_38px_rgba(15,37,39,0.055)] md:p-7">
      <div className="mb-7 h-px w-10 bg-teal/45" />
      <h3 className="text-xl font-semibold leading-[1.25] text-ink text-balance">{title}</h3>
      <p className="mt-4 text-[15px] leading-7 text-ink/66">{description}</p>
    </article>
  );
}
