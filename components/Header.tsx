type HeaderProps = {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
};

export default function Header({
  title = "Commercial Consultancy Dashboard",
  subtitle = "Central hub for CRM, opportunities, tasks and sales guidance.",
  buttonLabel = "Add Lead",
}: HeaderProps) {
  return (
    <header className="border-b border-[#D9D2C5] bg-[#F7F4EF] px-8 py-6">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#177A37]">
        MLT Portal
      </p>

      <div className="mt-2 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-[#172033]">{title}</h2>
          <p className="mt-2 text-slate-600">{subtitle}</p>
        </div>

        {buttonLabel && (
          <button className="rounded-full bg-[#172033] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0f1728]">
            {buttonLabel}
          </button>
        )}
      </div>
    </header>
  );
}