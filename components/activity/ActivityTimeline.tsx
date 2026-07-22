"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ActivityMetadata = Record<
  string,
  string | number | boolean | null
>;

type ActivityRecord = {
  id: string;
  company_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  description: string;
  actor_name: string;
  metadata: ActivityMetadata;
  created_at: string;
};

type ActivityTimelineProps = {
  companyId: string;
  limit?: number;
};

type DateGroup = {
  label: string;
  activities: ActivityRecord[];
};

const actionStyles: Record<
  string,
  {
    label: string;
    icon: string;
    badgeClassName: string;
    iconClassName: string;
  }
> = {
  created: {
    label: "Created",
    icon: "+",
    badgeClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  updated: {
    label: "Updated",
    icon: "✎",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
    iconClassName: "border-blue-200 bg-blue-50 text-blue-700",
  },
  stage_changed: {
    label: "Stage changed",
    icon: "→",
    badgeClassName:
      "border-violet-200 bg-violet-50 text-violet-700",
    iconClassName:
      "border-violet-200 bg-violet-50 text-violet-700",
  },
  deleted: {
    label: "Deleted",
    icon: "×",
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
    iconClassName: "border-red-200 bg-red-50 text-red-700",
  },
  completed: {
    label: "Completed",
    icon: "✓",
    badgeClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  reopened: {
    label: "Reopened",
    icon: "↻",
    badgeClassName:
      "border-amber-200 bg-amber-50 text-amber-700",
    iconClassName:
      "border-amber-200 bg-amber-50 text-amber-700",
  },
  note_added: {
    label: "Note added",
    icon: "≡",
    badgeClassName:
      "border-slate-200 bg-slate-100 text-slate-700",
    iconClassName:
      "border-slate-200 bg-slate-100 text-slate-700",
  },
  document_uploaded: {
    label: "Document uploaded",
    icon: "↑",
    badgeClassName:
      "border-cyan-200 bg-cyan-50 text-cyan-700",
    iconClassName:
      "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
};

const defaultActionStyle = {
  label: "Activity",
  icon: "•",
  badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
  iconClassName: "border-slate-200 bg-slate-100 text-slate-700",
};

function getActionStyle(action: string) {
  return actionStyles[action] || {
    ...defaultActionStyle,
    label: action
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase()),
  };
}

function formatActivityTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFullDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDateKey(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getDateLabel(value: string) {
  const activityDate = new Date(value);

  if (Number.isNaN(activityDate.getTime())) {
    return "Earlier";
  }

  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  const activityKey = getDateKey(activityDate.toISOString());
  const todayKey = getDateKey(today.toISOString());
  const yesterdayKey = getDateKey(yesterday.toISOString());

  if (activityKey === todayKey) {
    return "Today";
  }

  if (activityKey === yesterdayKey) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(activityDate);
}

function getEntityLabel(entityType: string) {
  const labels: Record<string, string> = {
    company: "Company",
    contact: "Contact",
    opportunity: "Opportunity",
    task: "Task",
    document: "Document",
  };

  return (
    labels[entityType] ||
    entityType
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

export default function ActivityTimeline({
  companyId,
  limit = 100,
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivities = useCallback(async () => {
    if (!companyId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("activity_log")
      .select(
        `
          id,
          company_id,
          entity_type,
          entity_id,
          action,
          description,
          actor_name,
          metadata,
          created_at
        `,
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (queryError) {
      setError(queryError.message);
      setActivities([]);
      setLoading(false);
      return;
    }

    setActivities((data || []) as ActivityRecord[]);
    setLoading(false);
  }, [companyId, limit]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const groupedActivities = useMemo<DateGroup[]>(() => {
    const groups = new Map<string, ActivityRecord[]>();

    activities.forEach((activity) => {
      const key = getDateKey(activity.created_at);
      const existingActivities = groups.get(key) || [];

      existingActivities.push(activity);
      groups.set(key, existingActivities);
    });

    return Array.from(groups.values()).map((groupActivities) => ({
      label: getDateLabel(groupActivities[0].created_at),
      activities: groupActivities,
    }));
  }, [activities]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-center py-10">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

            <p className="mt-4 text-sm font-semibold text-slate-500">
              Loading company activity...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h3 className="text-sm font-black text-red-800">
          Activity could not be loaded
        </h3>

        <p className="mt-2 text-sm text-red-700">{error}</p>

        <button
          type="button"
          onClick={loadActivities}
          className="mt-4 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-800"
        >
          Try again
        </button>
      </section>
    );
  }

  if (activities.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl font-black text-slate-400 shadow-sm">
          ↻
        </div>

        <h3 className="mt-4 text-lg font-black text-slate-900">
          No activity yet
        </h3>

        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          Changes involving this company will appear here automatically.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            Activity timeline
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            A chronological record of activity involving this company.
          </p>
        </div>

        <button
          type="button"
          onClick={loadActivities}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Refresh
        </button>
      </header>

      <div className="p-6">
        <div className="space-y-8">
          {groupedActivities.map((group) => (
            <section key={group.label}>
              <div className="mb-4 flex items-center gap-3">
                <h3 className="shrink-0 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  {group.label}
                </h3>

                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="space-y-0">
                {group.activities.map((activity, index) => {
                  const actionStyle = getActionStyle(activity.action);
                  const isLast =
                    index === group.activities.length - 1;

                  return (
                    <article
                      key={activity.id}
                      className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-4"
                    >
                      {!isLast ? (
                        <div className="absolute bottom-0 left-[21px] top-11 w-px bg-slate-200" />
                      ) : null}

                      <div
                        className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full border text-lg font-black ${actionStyle.iconClassName}`}
                      >
                        {actionStyle.icon}
                      </div>

                      <div
                        className={`min-w-0 ${
                          isLast ? "pb-0" : "pb-6"
                        }`}
                      >
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${actionStyle.badgeClassName}`}
                                >
                                  {actionStyle.label}
                                </span>

                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500">
                                  {getEntityLabel(
                                    activity.entity_type,
                                  )}
                                </span>
                              </div>

                              <p className="mt-3 break-words text-sm font-bold leading-6 text-slate-900">
                                {activity.description}
                              </p>

                              <p className="mt-2 text-xs text-slate-500">
                                By{" "}
                                <span className="font-bold text-slate-700">
                                  {activity.actor_name || "System"}
                                </span>
                              </p>
                            </div>

                            <time
                              dateTime={activity.created_at}
                              title={formatFullDate(
                                activity.created_at,
                              )}
                              className="shrink-0 text-xs font-bold text-slate-400"
                            >
                              {formatActivityTime(
                                activity.created_at,
                              )}
                            </time>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}