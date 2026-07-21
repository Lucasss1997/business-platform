export default function StatusBadge({ status }: { status: string | null }) {
  const value = status || "Unknown";
  const classes: Record<string, string> = {
    Customer: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Qualified: "bg-blue-50 text-blue-700 ring-blue-200",
    "Proposal Sent": "bg-amber-50 text-amber-800 ring-amber-200",
    Prospect: "bg-violet-50 text-violet-700 ring-violet-200",
    Inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${classes[value] || classes.Inactive}`}>{value}</span>;
}
