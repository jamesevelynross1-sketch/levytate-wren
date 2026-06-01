type ServiceCardProps = {
  title: string;
  description: string;
  index?: number;
};

export function ServiceCard({ title, description, index }: ServiceCardProps) {
  return (
    <article className="group flex h-full min-h-[260px] flex-col rounded-xl border border-ink/10 bg-white/34 p-6 shadow-[0_10px_28px_rgba(15,37,39,0.035)] transition hover:-translate-y-0.5 hover:border-teal/30 hover:bg-white/50">
      {typeof index === "number" ? (
        <span className="mb-7 text-sm font-semibold text-teal/70">
          {String(index + 1).padStart(2, "0")}
        </span>
      ) : null}
      <h3 className="text-xl font-semibold leading-snug text-ink">
        {title}
      </h3>
      <p className="mt-4 text-sm leading-7 text-ink/66">{description}</p>
    </article>
  );
}
