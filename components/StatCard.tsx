type StatCardProps = {
  title: string;
  value: string;
  note: string;
};

export default function StatCard({ title, value, note }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-[#D9D2C5] bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-bold text-[#172033]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-500">{note}</p>
    </div>
  );
}