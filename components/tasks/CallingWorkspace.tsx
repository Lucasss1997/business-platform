"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import GlobalTaskList from "@/components/tasks/GlobalTaskList";
import {
  addCalendarMonths,
  callOutcomes,
  localDate,
  outcomeLabel,
  type CallCompany,
  type CallEvent,
  type CallMember,
  type CallOutcome,
  type CallTask,
} from "@/lib/calling-workflow";

const field =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--text-primary)]";
const button =
  "rounded-xl border border-[var(--border)] px-4 py-2 font-semibold disabled:opacity-40";
type Disposition = { company_id: string; disposition: string; reason: string };
type Scope = "mine" | "team" | "upcoming" | "closed" | "existing";

async function paged<T>(table: string, org: string, columns = "*") {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const result = await supabase
      .from(table)
      .select(columns)
      .eq("organisation_id", org)
      .order("id")
      .range(start, start + 999);
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data as T[]));
    if (result.data.length < 1000) return rows;
  }
}

export default function CallingWorkspace() {
  const [scope, setScope] = useState<Scope>("mine");
  const [userId, setUserId] = useState("");
  const [org, setOrg] = useState("");
  const [members, setMembers] = useState<CallMember[]>([]);
  const [tasks, setTasks] = useState<CallTask[]>([]);
  const [companies, setCompanies] = useState<CallCompany[]>([]);
  const [states, setStates] = useState<Disposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CallTask | null>(null);
  const [enqueueOpen, setEnqueueOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const today = localDate();
  const me = members.find((m) => m.user_id === userId);
  const admin = me?.role === "admin";
  const companyMap = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again.");
      const membership = await supabase
        .from("organisation_members")
        .select("organisation_id")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();
      if (membership.error || !membership.data)
        throw new Error("No single active organisation is available.");
      const organisation = membership.data.organisation_id;
      const [taskRows, companyRows, team, stateRows] = await Promise.all([
        paged<CallTask>("crm_call_tasks", organisation),
        paged<CallCompany>(
          "companies",
          organisation,
          "id,company_name,phone,mobile,contact_name,email,website,notes,industry,call_notes",
        ),
        supabase.rpc("crm_call_team", { p_org: organisation }),
        supabase
          .from("crm_call_company_state")
          .select("company_id,disposition,reason")
          .eq("organisation_id", organisation),
      ]);
      if (team.error) throw new Error(team.error.message);
      if (stateRows.error) throw new Error(stateRows.error.message);
      setUserId(user.id);
      setOrg(organisation);
      setTasks(taskRows);
      setCompanies(companyRows);
      setMembers(team.data || []);
      setStates(stateRows.data || []);
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : "Loading failed."} If the calling tables are missing, ask your admin to install the calling-workflow migration. Existing tasks remain available below.`,
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function assign(task: CallTask, target: string | null, open = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("crm_call_assign", {
        p_task: task.id,
        p_version: task.version,
        p_user: target,
      });
      if (result.error) throw new Error(result.error.message);
      const updated = result.data as CallTask;
      setTasks((previous) =>
        previous.map((t) => (t.id === task.id ? updated : t)),
      );
      if (open) setSelected(updated);
      else setMessage("Task assignment saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const visible = tasks
    .filter((t) => {
      const c = companyMap.get(t.company_id);
      if (
        ![c?.company_name, c?.phone, c?.contact_name, t.batch_name]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false;
      if (scope === "closed") return t.status !== "open";
      if (t.status !== "open") return false;
      if (scope === "upcoming") return t.due_date > today;
      if (t.due_date > today) return false;
      return scope === "team" || t.assigned_user_id === userId;
    })
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) || a.id.localeCompare(b.id),
    );

  return (
    <div className="space-y-5">
      <nav aria-label="Task views" className="flex flex-wrap gap-2">
        {(
          [
            ["mine", "My calls"],
            ["team", "Team tasks"],
            ["upcoming", "Scheduled callbacks"],
            ["closed", "Call history"],
            ["existing", "Existing tasks"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`${button} ${scope === key ? "bg-[var(--accent)] text-white" : ""}`}
            aria-pressed={scope === key}
            onClick={() => setScope(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {scope === "existing" ? (
        <GlobalTaskList />
      ) : (
        <>
          {error && (
            <p role="alert" className="rounded-xl border border-red-400 p-4">
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="rounded-xl border border-[var(--accent)] p-4"
            >
              {message}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <input
              aria-label="Search calling tasks"
              className={`${field} max-w-lg`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company, phone or research batch"
            />
            <button
              className={button}
              disabled={busy || loading}
              onClick={() => void load()}
            >
              Refresh
            </button>
            {admin && (
              <>
                <button
                  className={button}
                  onClick={() => setEnqueueOpen((v) => !v)}
                >
                  Create calling batch
                </button>
                <button
                  className={button}
                  onClick={() => setTeamOpen((v) => !v)}
                >
                  Sales managers
                </button>
              </>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Due calls appear in My calls / Team tasks. Future callbacks stay in
            Scheduled callbacks until due. A team task must be claimed before a
            call is saved.
          </p>
          {teamOpen && admin && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="font-bold">Who can receive qualified leads?</h2>
              {members.map((member) => (
                <label key={member.user_id} className="flex gap-3 items-center">
                  <input
                    type="checkbox"
                    checked={member.is_manager}
                    disabled={busy}
                    onChange={async (e) => {
                      const enabled = e.target.checked;
                      setBusy(true);
                      setError("");
                      try {
                        const result = await supabase.rpc(
                          "crm_call_set_manager",
                          {
                            p_org: org,
                            p_user: member.user_id,
                            p_enabled: enabled,
                          },
                        );
                        if (result.error) throw result.error;
                        await load();
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Manager settings could not be saved.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  {member.display_name} ({member.role})
                </label>
              ))}
            </section>
          )}
          {enqueueOpen && admin && (
            <CallingBatch
              companies={companies}
              tasks={tasks}
              states={states}
              org={org}
              members={members}
              onSaved={async (text) => {
                setMessage(text);
                setEnqueueOpen(false);
                await load();
              }}
            />
          )}
          {loading ? (
            <p>Loading calling queue…</p>
          ) : (
            <>
              <p>
                {visible.length}{" "}
                {scope === "closed" ? "completed / closed calls" : "tasks"}
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {visible.slice(0, 200).map((task) => {
                  const c = companyMap.get(task.company_id);
                  const mine = task.assigned_user_id === userId;
                  const owner =
                    members.find((m) => m.user_id === task.assigned_user_id)
                      ?.display_name || (task.assigned_user_id ? "Inactive / former team member" : "Unassigned");
                  return (
                    <article
                      key={task.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3"
                    >
                      <h2 className="font-bold text-lg">
                        {c?.company_name || "Company unavailable"}
                      </h2>
                      <p>
                        {task.kind.replaceAll("_", " ")} · {task.due_date}{" "}
                        {task.status === "open" && task.due_date < today
                          ? "· Overdue"
                          : ""}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {owner} · {task.batch_name} · {task.status}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={button}
                          disabled={busy || !c}
                          onClick={() => {
                            if (
                              task.status !== "open" ||
                              task.due_date > today ||
                              (!mine && task.assigned_user_id)
                            )
                              setSelected(task);
                            else void assign(task, userId, true);
                          }}
                        >
                          {task.status !== "open" ||
                          task.due_date > today ||
                          (!mine && task.assigned_user_id)
                            ? "View details"
                            : mine
                              ? "Open call"
                              : "Claim and open call"}
                        </button>
                        {mine && task.status === "open" && (
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() => void assign(task, null)}
                          >
                            Return to team
                          </button>
                        )}
                        {admin && task.status === "open" && (
                          <select
                            aria-label={`Assign ${c?.company_name || "task"}`}
                            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"
                            disabled={busy}
                            value={task.assigned_user_id || ""}
                            onChange={(e) =>
                              void assign(task, e.target.value || null)
                            }
                          >
                            <option value="">Unassigned</option>
                            {members.map((m) => (
                              <option key={m.user_id} value={m.user_id}>
                                {m.display_name}
                              </option>
                            ))}
                          </select>
                        )}
                        {admin &&
                          task.status !== "open" &&
                          states.some(
                            (s) =>
                              s.company_id === task.company_id &&
                              s.disposition !== "active" &&
                              s.disposition !== "do_not_contact",
                          ) && (
                            <button
                              className={button}
                              disabled={busy}
                              onClick={async () => {
                                const reason = window.prompt(
                                  "Reason for restoring this prospect? Correct any wrong number in the company profile first.",
                                );
                                if (!reason?.trim()) return;
                                setBusy(true);
                                setError("");
                                try {
                                  const result = await supabase.rpc(
                                    "crm_call_reactivate",
                                    {
                                      p_company: task.company_id,
                                      p_reason: reason,
                                    },
                                  );
                                  if (result.error)
                                    throw new Error(result.error.message);
                                  setMessage(
                                    "Prospect restored. An admin can deliberately add it to a new calling batch.",
                                  );
                                  await load();
                                } catch (err) {
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Restore failed.",
                                  );
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Restore prospect
                            </button>
                          )}
                      </div>
                    </article>
                  );
                })}
              </div>
              {visible.length > 200 && (
                <p>
                  Showing the first 200 results. Search to narrow the queue.
                </p>
              )}
              {!visible.length && (
                <p className="rounded-xl border border-[var(--border)] p-6">
                  No calls in this view. Check Team tasks or Scheduled
                  callbacks.
                </p>
              )}
            </>
          )}
        </>
      )}
      {selected && companyMap.get(selected.company_id) && (
        <CallDialog
          key={`${selected.id}-${selected.version}`}
          task={selected}
          company={companyMap.get(selected.company_id)!}
          userId={userId}
          members={members}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            setSelected(null);
            setMessage("Call recorded. The next action has been saved.");
            await load();
          }}
        />
      )}
    </div>
  );
}

function CallingBatch({
  companies,
  tasks,
  states,
  org,
  members,
  onSaved,
}: {
  companies: CallCompany[];
  tasks: CallTask[];
  states: Disposition[];
  org: string;
  members: CallMember[];
  onSaved: (text: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const openIds = new Set(
    tasks.filter((t) => t.status === "open").map((t) => t.company_id),
  );
  const closedIds = new Set(
    states.filter((s) => s.disposition !== "active").map((s) => s.company_id),
  );
  const eligible = companies
    .filter(
      (c) =>
        (c.phone || c.mobile) &&
        !openIds.has(c.id) &&
        !closedIds.has(c.id) &&
        [c.company_name, c.industry]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => a.company_name.localeCompare(b.company_name));
  return (
    <form
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          const result = await supabase.rpc("crm_call_enqueue", {
            p_org: org,
            p_companies: ids,
            p_batch: String(f.get("batch")),
            p_brief: String(f.get("brief")),
            p_due: String(f.get("due")),
            p_assignee: String(f.get("assignee")) || null,
            p_screened: f.get("screened") === "on",
          });
          if (result.error) throw new Error(result.error.message);
          await onSaved(
            `${result.data.added} calling tasks created; ${result.data.skipped} skipped (already queued, closed, suppressed or missing a number).`,
          );
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Batch creation failed.",
          );
        } finally {
          setBusy(false);
          lock.current = false;
        }
      }}
    >
      <h2 className="font-bold text-lg">
        Create a calling batch from CRM companies
      </h2>
      <p className="text-sm">
        Research/import companies first, then select them here. No numbers have
        been TPS/CTPS-screened by this feature. Closed and suppressed records
        are excluded by the database.
      </p>
      {error && <p role="alert">{error}</p>}
      <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
        <label>
          Batch name
          <input
            required
            maxLength={160}
            name="batch"
            className={field}
            placeholder="Rail battery prospects — November"
          />
        </label>
        <label>
          First call due
          <input
            required
            type="date"
            name="due"
            defaultValue={localDate()}
            className={field}
          />
        </label>
        <label>
          Assign to
          <select name="assignee" className={field}>
            <option value="">Team queue — unassigned</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Calling brief
          <textarea
            name="brief"
            maxLength={4000}
            className={field}
            placeholder="Potential use, product and questions to ask"
          />
        </label>
      </fieldset>
      <input
        aria-label="Filter companies for batch"
        className={field}
        placeholder="Filter by company or industry"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={busy}
      />
      <button
        type="button"
        className={button}
        disabled={busy}
        onClick={() => setIds(eligible.slice(0, 500).map((c) => c.id))}
      >
        Select up to 500 filtered companies
      </button>
      <button
        type="button"
        className={`${button} ml-2`}
        disabled={busy}
        onClick={() => setIds([])}
      >
        Clear selection
      </button>
      <div className="max-h-60 overflow-auto space-y-2">
        {eligible.slice(0, 500).map((c) => (
          <label key={c.id} className="flex gap-3">
            <input
              type="checkbox"
              checked={ids.includes(c.id)}
              disabled={busy}
              onChange={(e) =>
                setIds((old) =>
                  e.target.checked
                    ? [...old, c.id]
                    : old.filter((id) => id !== c.id),
                )
              }
            />
            {c.company_name} · {c.phone || c.mobile}
          </label>
        ))}
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="screened" required disabled={busy} />I have
        checked the selected numbers against TPS/CTPS and our do-not-call
        records, or recorded specific consent where required.
      </label>
      <button
        className={`${button} bg-[var(--accent)] text-white`}
        disabled={busy || !ids.length}
      >
        {busy ? "Creating tasks…" : `Create ${ids.length} calling tasks`}
      </button>
    </form>
  );
}

function CallDialog({
  task,
  company,
  userId,
  members,
  onClose,
  onSaved,
}: {
  task: CallTask;
  company: CallCompany;
  userId: string;
  members: CallMember[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [history, setHistory] = useState<CallEvent[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = localDate();
  const writable =
    task.status === "open" &&
    task.assigned_user_id === userId &&
    task.due_date <= today;
  const needsDate =
    ["callback", "send_information", "qualified"].includes(outcome) ||
    (["no_answer", "voicemail"].includes(outcome) && task.attempt_count < 2);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  useEffect(() => {
    if (!notes && !outcome) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [notes, outcome]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await supabase
        .from("crm_call_events")
        .select("*")
        .eq("organisation_id", task.organisation_id)
        .eq("company_id", task.company_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (alive) {
        if (result.error) setHistoryError(result.error.message);
        else setHistory(result.data || []);
      }
    })();
    return () => {
      alive = false;
    };
  }, [task.company_id, task.organisation_id]);
  function close() {
    if (busy) return;
    if (
      (notes || outcome) &&
      !window.confirm("Discard these unsaved call notes?")
    )
      return;
    ref.current?.close();
    onClose();
  }
  return (
    <dialog
      ref={ref}
      aria-labelledby="call-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="m-auto max-h-[90dvh] w-[min(900px,95vw)] overflow-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--text-primary)] backdrop:bg-black/60"
    >
      <div className="flex justify-between gap-4">
        <h2 id="call-title" className="text-2xl font-bold">
          {company.company_name}
        </h2>
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={close}
        >
          Close
        </button>
      </div>
      <p className="my-2">
        {company.contact_name ||
          "Ask for the person responsible for site power / equipment"}{" "}
        · {task.due_date}
      </p>
      <div className="flex flex-wrap gap-4 my-4 text-[var(--accent)]">
        {company.phone && <a href={`tel:${company.phone}`}>{company.phone}</a>}
        {company.mobile && (
          <a href={`tel:${company.mobile}`}>{company.mobile}</a>
        )}
        {company.email && (
          <a href={`mailto:${company.email}`}>{company.email}</a>
        )}
        <Link href={`/companies/${company.id}`}>Company profile</Link>
      </div>
      <section className="rounded-xl bg-[var(--surface-muted)] p-4 space-y-2">
        <h3 className="font-bold">Calling brief</h3>
        <p className="whitespace-pre-wrap">
          {task.brief || "No brief recorded"}
        </p>
        <p className="whitespace-pre-wrap">{company.notes}</p>
      </section>
      {!writable && (
        <p className="my-4">
          Read only: this task is completed, scheduled for a future date, or
          assigned to another person.
        </p>
      )}
      {error && (
        <p role="alert" className="my-4 text-red-600">
          {error} Your notes remain on screen.
        </p>
      )}
      {writable && (
        <form
          className="my-5 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const result = await supabase.rpc("crm_call_record", {
                p_task: task.id,
                p_version: task.version,
                p_outcome: outcome,
                p_rating: f.get("rating") ? Number(f.get("rating")) : null,
                p_notes: notes,
                p_due: needsDate ? due : null,
                p_manager:
                  outcome === "qualified"
                    ? String(f.get("manager")) || null
                    : null,
              });
              if (result.error) throw new Error(result.error.message);
              await onSaved();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed.");
            } finally {
              setBusy(false);
              lock.current = false;
            }
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <label className="block">
              Call outcome
              <select
                required
                className={field}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as CallOutcome)}
              >
                <option value="">Choose outcome</option>
                {callOutcomes
                  .filter(
                    ([key]) =>
                      key !== "opportunity_started" ||
                      members.some(
                        (m) =>
                          m.user_id === userId &&
                          (m.is_manager || m.role === "admin"),
                      ),
                  )
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            {["no_answer", "voicemail"].includes(outcome) && (
              <p>
                Unanswered attempt {task.attempt_count + 1} of 3.
                {task.attempt_count >= 2
                  ? " This closes the queue as unreachable; it does not mark the prospect unsuitable."
                  : ""}
              </p>
            )}
            <label className="block">
              Lead rating
              <select
                name="rating"
                className={field}
                required={[
                  "callback",
                  "send_information",
                  "qualified",
                  "opportunity_started",
                ].includes(outcome)}
              >
                <option value="">Not assessed</option>
                {[
                  "1 — Poor fit",
                  "2 — Low potential",
                  "3 — Worth following up",
                  "4 — Strong prospect",
                  "5 — High priority",
                ].map((label, i) => (
                  <option key={i} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Call notes / reason
              <textarea
                required
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={10000}
                rows={5}
                className={field}
              />
            </label>
            {outcome === "qualified" && (
              <label className="block">
                Sales manager
                <select required name="manager" className={field}>
                  <option value="">Select manager</option>
                  {members
                    .filter((m) => m.is_manager)
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name}
                      </option>
                    ))}
                </select>
                <span className="text-sm">
                  An admin can designate recipients using Sales managers in
                  Tasks.
                </span>
              </label>
            )}
            {needsDate && (
              <div className="space-y-2">
                <label className="block">
                  Next action due
                  <input
                    type="date"
                    required
                    min={today}
                    className={field}
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  {[1, 3, 6].map((months) => (
                    <button
                      type="button"
                      className={button}
                      key={months}
                      onClick={() => setDue(addCalendarMonths(today, months))}
                    >
                      {months} month{months > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {outcome === "send_information" && (
              <p>
                This records the request and creates a follow-up task. It does
                not send an email automatically.
              </p>
            )}
            {outcome === "opportunity_started" && (
              <p>
                Record the opportunity reference and owner in your notes. Manage
                the opportunity in the{" "}
                <Link className="underline" href="/sales">
                  sales pipeline
                </Link>
                ; this action closes only the calling task.
              </p>
            )}
            {["not_suitable", "do_not_contact", "wrong_number"].includes(
              outcome,
            ) && (
              <p>
                This closes the calling task and prevents automatic requeueing.
                The company and history are retained.
              </p>
            )}
            <button className={`${button} bg-[var(--accent)] text-white`}>
              {busy
                ? "Saving call and next action…"
                : "Save outcome and next action"}
            </button>
          </fieldset>
        </form>
      )}
      <section className="mt-6 space-y-3">
        <h3 className="font-bold">Call history</h3>
        {company.call_notes && (
          <p className="whitespace-pre-wrap rounded-xl border p-3">
            Earlier company calling notes: {company.call_notes}
          </p>
        )}
        {historyError && (
          <p role="alert">Could not load history: {historyError}</p>
        )}
        {history.map((event) => (
          <article
            key={event.id}
            className="rounded-xl border border-[var(--border)] p-3"
          >
            <p className="font-semibold">
              {outcomeLabel(event.outcome) || event.event_type}
              {event.rating ? ` · ${event.rating}/5` : ""}
            </p>
            <p className="text-sm">
              {new Date(event.created_at).toLocaleString("en-GB")} ·{" "}
              {members.find((m) => m.user_id === event.actor_id)
                ?.display_name || "Former team member"}
            </p>
            <p className="whitespace-pre-wrap">{event.notes}</p>
            {event.next_task_id && (
              <p className="text-sm">Follow-up task recorded</p>
            )}
          </article>
        ))}
      </section>
    </dialog>
  );
}
