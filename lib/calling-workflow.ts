export const callOutcomes = [
  ["no_answer", "No answer"],
  ["voicemail", "Voicemail"],
  ["callback", "Interested / call back later"],
  ["send_information", "Send information and follow up"],
  ["qualified", "Qualified — hand over to sales manager"],
  ["not_suitable", "Not interested / not a fit — close"],
  ["do_not_contact", "Do not contact — suppress"],
  ["wrong_number", "Wrong number — needs correction"],
  [
    "opportunity_started",
    "Sales opportunity now being managed — close calling task",
  ],
] as const;
export type CallOutcome = (typeof callOutcomes)[number][0];
export type CallTask = {
  id: string;
  organisation_id: string;
  company_id: string;
  parent_id: string | null;
  assigned_user_id: string | null;
  batch_name: string;
  brief: string;
  kind: string;
  due_date: string;
  status: string;
  version: number;
  attempt_count: number;
};
export type CallCompany = {
  id: string;
  company_name: string;
  phone: string | null;
  mobile: string | null;
  contact_name: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  industry: string | null;
  call_notes: string | null;
};
export type CallMember = {
  user_id: string;
  display_name: string;
  role: string;
  is_manager: boolean;
};
export type CallEvent = {
  id: string;
  actor_id: string;
  created_at: string;
  event_type: string;
  outcome: string | null;
  rating: number | null;
  notes: string;
  next_task_id: string | null;
};
export function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
// Calendar months, clamped at month end (31 January + 3 months = 30 April).
export function addCalendarMonths(value: string, months: number) {
  const [y, m, d] = value.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  next.setUTCDate(
    Math.min(
      d,
      new Date(
        Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
      ).getUTCDate(),
    ),
  );
  return next.toISOString().slice(0, 10);
}
export function outcomeLabel(value: string | null) {
  return callOutcomes.find(([key]) => key === value)?.[1] || value || "";
}
