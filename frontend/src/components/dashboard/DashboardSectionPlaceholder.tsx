type DashboardSectionPlaceholderProps = {
  title: string;
  description?: string;
};

export function DashboardSectionPlaceholder({
  title,
  description = "This workspace section is under development.",
}: DashboardSectionPlaceholderProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-luxury">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
        Coming Soon
      </p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
    </div>
  );
}
