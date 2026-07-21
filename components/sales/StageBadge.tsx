import type { OpportunityStage } from "@/components/sales/OpportunityModal";

type StageBadgeProps = {
  stage: OpportunityStage | string | null;
};

function getStageClasses(stage: string | null) {
  switch (stage) {
    case "Qualified":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "Discovery":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";

    case "Proposal Sent":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "Negotiation":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "Won":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "Lost":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default function StageBadge({ stage }: StageBadgeProps) {
  const displayStage = stage || "Prospect";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getStageClasses(
        displayStage,
      )}`}
    >
      {displayStage}
    </span>
  );
}