"use client";

import Link from "next/link";
import type { Task } from "@/lib/types/task";

type TaskCardProps = {
  task: Task;
  busy: boolean;
  companyName?: string | null;
  showCompany?: boolean;
  onEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
};

export default function TaskCard({
  task,
  busy,
  companyName,
  showCompany = false,
  onEdit,
  onToggleComplete,
  onDelete,
}: TaskCardProps) {
  const completed = task.status === "Completed";
  const overdue = isTaskOverdue(task);
  const dueLabel = formatDueDate(task.due_date);

  return (
    <article
      className={`rounded-2xl border p-5 transition ${
        completed
          ? "border-slate-200 bg-slate-50"
          : overdue
            ? "border-red-200 bg-red-50/40"
            : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => onToggleComplete(task)}
          disabled={busy}
          aria-label={
            completed
              ? `Reopen ${task.title}`
              : `Complete ${task.title}`
          }
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
            completed
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-300 bg-white text-transparent hover:border-emerald-600"
          }`}
        >
          ✓
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {showCompany ? (
                <Link
                  href={`/companies/${task.company_id}`}
                  className="mb-2 inline-flex text-xs font-black uppercase tracking-wide text-blue-700 transition hover:text-blue-900 hover:underline"
                >
                  {companyName || "Unknown company"}
                </Link>
              ) : null}

              <h3
                className={`break-words text-base font-black ${
                  completed
                    ? "text-slate-500 line-through"
                    : "text-slate-900"
                }`}
              >
                {task.title}
              </h3>

              {task.description ? (
                <p
                  className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${
                    completed
                      ? "text-slate-400"
                      : "text-slate-600"
                  }`}
                >
                  {task.description}
                </p>
              ) : null}
            </div>

            <PriorityBadge priority={task.priority} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {dueLabel ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  overdue && !completed
                    ? "bg-red-100 text-red-700"
                    : completed
                      ? "bg-slate-200 text-slate-500"
                      : "bg-blue-50 text-blue-700"
                }`}
              >
                {overdue && !completed ? "Overdue · " : ""}
                {dueLabel}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                No due date
              </span>
            )}

            {task.assigned_to ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                Assigned to {task.assigned_to}
              </span>
            ) : null}

            {completed ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Completed
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => onEdit(task)}
              disabled={busy}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Edit
            </button>

            <button
              type="button"
              onClick={() => onToggleComplete(task)}
              disabled={busy}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {completed ? "Reopen" : "Mark complete"}
            </button>

            <button
              type="button"
              onClick={() => onDelete(task)}
              disabled={busy}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const classes =
    priority === "High"
      ? "bg-red-100 text-red-700"
      : priority === "Low"
        ? "bg-slate-100 text-slate-600"
        : "bg-amber-100 text-amber-700";

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${classes}`}
    >
      {priority} priority
    </span>
  );
}

function isTaskOverdue(task: Task) {
  if (!task.due_date || task.status === "Completed") {
    return false;
  }

  return task.due_date < getLocalDateString();
}

function formatDueDate(value: string | null) {
  if (!value) return null;

  const today = getLocalDateString();

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const tomorrow = toLocalDateString(tomorrowDate);

  if (value === today) return "Due today";
  if (value === tomorrow) return "Due tomorrow";

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `Due ${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)}`;
}

function getLocalDateString() {
  return toLocalDateString(new Date());
}

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}