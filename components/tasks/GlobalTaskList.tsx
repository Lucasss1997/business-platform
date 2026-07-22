"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TaskCard from "@/components/tasks/TaskCard";
import TaskModal from "@/components/tasks/TaskModal";
import {
  changeTaskStatus,
  deleteTask,
  getAllTasks,
  updateTask,
  type GlobalTask,
} from "@/lib/tasks";
import type {
  Task,
  TaskFormValues,
} from "@/lib/types/task";

type TaskFilter =
  | "All"
  | "Overdue"
  | "Today"
  | "Upcoming"
  | "No date"
  | "Completed";

export default function GlobalTaskList() {
  const [tasks, setTasks] = useState<GlobalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [editingTask, setEditingTask] =
    useState<GlobalTask | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTaskId, setBusyTaskId] =
    useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("All");
  const [search, setSearch] = useState("");

  const today = getLocalDateString();

  const taskGroups = useMemo(() => {
    const openTasks = tasks.filter(
      (task) => task.status !== "Completed",
    );

    return {
      overdue: sortTasks(
        openTasks.filter(
          (task) =>
            Boolean(task.due_date) &&
            task.due_date !== null &&
            task.due_date < today,
        ),
      ),
      today: sortTasks(
        openTasks.filter((task) => task.due_date === today),
      ),
      upcoming: sortTasks(
        openTasks.filter(
          (task) =>
            Boolean(task.due_date) &&
            task.due_date !== null &&
            task.due_date > today,
        ),
      ),
      noDate: sortTasks(
        openTasks.filter((task) => !task.due_date),
      ),
      completed: sortTasks(
        tasks.filter((task) => task.status === "Completed"),
      ),
    };
  }, [tasks, today]);

  const counts = useMemo(
    () => ({
      open:
        taskGroups.overdue.length +
        taskGroups.today.length +
        taskGroups.upcoming.length +
        taskGroups.noDate.length,
      overdue: taskGroups.overdue.length,
      today: taskGroups.today.length,
      completed: taskGroups.completed.length,
    }),
    [taskGroups],
  );

  const filteredGroups = useMemo(() => {
    const normalisedSearch = search.trim().toLowerCase();

    function matchesSearch(task: GlobalTask) {
      if (!normalisedSearch) return true;

      return [
        task.title,
        task.description,
        task.company_name,
        task.assigned_to,
        task.priority,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalisedSearch),
        );
    }

    function applySearch(group: GlobalTask[]) {
      return group.filter(matchesSearch);
    }

    return {
      overdue:
        filter === "All" || filter === "Overdue"
          ? applySearch(taskGroups.overdue)
          : [],
      today:
        filter === "All" || filter === "Today"
          ? applySearch(taskGroups.today)
          : [],
      upcoming:
        filter === "All" || filter === "Upcoming"
          ? applySearch(taskGroups.upcoming)
          : [],
      noDate:
        filter === "All" || filter === "No date"
          ? applySearch(taskGroups.noDate)
          : [],
      completed:
        filter === "All" || filter === "Completed"
          ? applySearch(taskGroups.completed)
          : [],
    };
  }, [filter, search, taskGroups]);

  const displayedTaskCount =
    filteredGroups.overdue.length +
    filteredGroups.today.length +
    filteredGroups.upcoming.length +
    filteredGroups.noDate.length +
    filteredGroups.completed.length;

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setPageError("");

    const result = await getAllTasks();

    if (!result.success) {
      setTasks([]);
      setPageError(result.error);
      setLoading(false);
      return;
    }

    setTasks(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function openEditModal(task: GlobalTask) {
    setEditingTask(task);
    setModalError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingTask(null);
    setModalError("");
  }

  async function saveTask(values: TaskFormValues) {
    if (!editingTask) return;

    setSaving(true);
    setModalError("");

    const result = await updateTask(editingTask, values);

    if (!result.success) {
      setModalError(result.error);
      setSaving(false);
      return;
    }

    setTasks((current) =>
      sortTasks(
        current.map((task) =>
          task.id === result.data.id
            ? {
                ...result.data,
                company_name: task.company_name,
              }
            : task,
        ),
      ),
    );

    setSaving(false);
    setModalOpen(false);
    setEditingTask(null);
  }

  async function toggleTask(task: Task) {
    setBusyTaskId(task.id);
    setPageError("");

    const nextStatus =
      task.status === "Completed" ? "Open" : "Completed";

    const result = await changeTaskStatus(task, nextStatus);

    if (!result.success) {
      setPageError(result.error);
      setBusyTaskId(null);
      return;
    }

    setTasks((current) =>
      sortTasks(
        current.map((item) =>
          item.id === result.data.id
            ? {
                ...result.data,
                company_name: item.company_name,
              }
            : item,
        ),
      ),
    );

    setBusyTaskId(null);
  }

  async function removeTask(task: Task) {
    const confirmed = window.confirm(
      `Delete "${task.title}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    setBusyTaskId(task.id);
    setPageError("");

    const result = await deleteTask(task);

    if (!result.success) {
      setPageError(result.error);
      setBusyTaskId(null);
      return;
    }

    setTasks((current) =>
      current.filter((item) => item.id !== task.id),
    );

    setBusyTaskId(null);
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Open tasks"
          value={counts.open}
          description="All outstanding actions"
        />

        <SummaryCard
          label="Overdue"
          value={counts.overdue}
          description="Require attention"
          urgent={counts.overdue > 0}
        />

        <SummaryCard
          label="Due today"
          value={counts.today}
          description="Scheduled for today"
        />

        <SummaryCard
          label="Completed"
          value={counts.completed}
          description="Finished tasks"
        />
      </div>

      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              All tasks
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Review and manage tasks across every company.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="block">
              <span className="sr-only">Search tasks</span>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search tasks or companies"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 sm:w-64"
              />
            </label>

            <label className="block">
              <span className="sr-only">Filter tasks</span>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as TaskFilter)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 sm:w-44"
              >
                <option value="All">All tasks</option>
                <option value="Overdue">Overdue</option>
                <option value="Today">Due today</option>
                <option value="Upcoming">Upcoming</option>
                <option value="No date">No due date</option>
                <option value="Completed">Completed</option>
              </select>
            </label>
          </div>
        </div>

        {pageError ? (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-red-700">
              {pageError}
            </p>

            <button
              type="button"
              onClick={loadTasks}
              className="text-sm font-bold text-red-700 underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-xl bg-slate-50 p-10 text-center">
            <p className="font-bold text-slate-700">
              Loading tasks
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Reading tasks and company details from Supabase.
            </p>
          </div>
        ) : null}

        {!loading && tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            description="Tasks created from a company record will appear here."
          />
        ) : null}

        {!loading &&
        tasks.length > 0 &&
        displayedTaskCount === 0 ? (
          <EmptyState
            title="No matching tasks"
            description="Try changing the filter or clearing the search."
          />
        ) : null}

        {!loading && displayedTaskCount > 0 ? (
          <div className="mt-7 space-y-8">
            <TaskGroup
              title="Overdue"
              description="Tasks whose due date has passed."
              tasks={filteredGroups.overdue}
              busyTaskId={busyTaskId}
              onEdit={openEditModal}
              onToggleComplete={toggleTask}
              onDelete={removeTask}
            />

            <TaskGroup
              title="Due today"
              description="Tasks scheduled for completion today."
              tasks={filteredGroups.today}
              busyTaskId={busyTaskId}
              onEdit={openEditModal}
              onToggleComplete={toggleTask}
              onDelete={removeTask}
            />

            <TaskGroup
              title="Upcoming"
              description="Tasks with a future due date."
              tasks={filteredGroups.upcoming}
              busyTaskId={busyTaskId}
              onEdit={openEditModal}
              onToggleComplete={toggleTask}
              onDelete={removeTask}
            />

            <TaskGroup
              title="No due date"
              description="Open tasks without a deadline."
              tasks={filteredGroups.noDate}
              busyTaskId={busyTaskId}
              onEdit={openEditModal}
              onToggleComplete={toggleTask}
              onDelete={removeTask}
            />

            <TaskGroup
              title="Completed"
              description="Tasks that have been marked as finished."
              tasks={filteredGroups.completed}
              busyTaskId={busyTaskId}
              onEdit={openEditModal}
              onToggleComplete={toggleTask}
              onDelete={removeTask}
              collapsible
            />
          </div>
        ) : null}
      </section>

      <TaskModal
        open={modalOpen}
        task={editingTask}
        saving={saving}
        error={modalError}
        onClose={closeModal}
        onSubmit={saveTask}
      />
    </>
  );
}

function SummaryCard({
  label,
  value,
  description,
  urgent = false,
}: {
  label: string;
  value: number;
  description: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        urgent
          ? "border-red-200 bg-red-50"
          : "border-[var(--border)] bg-white"
      }`}
    >
      <p
        className={`text-xs font-black uppercase tracking-[0.18em] ${
          urgent ? "text-red-600" : "text-slate-500"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-3 text-3xl font-black ${
          urgent ? "text-red-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>

      <p
        className={`mt-1 text-sm ${
          urgent ? "text-red-600" : "text-slate-500"
        }`}
      >
        {description}
      </p>
    </div>
  );
}

function TaskGroup({
  title,
  description,
  tasks,
  busyTaskId,
  onEdit,
  onToggleComplete,
  onDelete,
  collapsible = false,
}: {
  title: string;
  description: string;
  tasks: GlobalTask[];
  busyTaskId: string | null;
  onEdit: (task: GlobalTask) => void;
  onToggleComplete: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
  collapsible?: boolean;
}) {
  if (tasks.length === 0) return null;

  const content = (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          companyName={task.company_name}
          showCompany
          busy={busyTaskId === task.id}
          onEdit={() => onEdit(task)}
          onToggleComplete={onToggleComplete}
          onDelete={onDelete}
        />
      ))}
    </div>
  );

  if (collapsible) {
    return (
      <details className="rounded-2xl border border-slate-200">
        <summary className="cursor-pointer select-none px-5 py-4">
          <span className="font-black text-slate-900">
            {title} ({tasks.length})
          </span>

          <span className="ml-2 text-sm text-slate-500">
            {description}
          </span>
        </summary>

        <div className="border-t border-slate-100 p-4">
          {content}
        </div>
      </details>
    );
  }

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">
            {title}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
          {tasks.length}
        </span>
      </div>

      {content}
    </section>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
        ✓
      </div>

      <h3 className="mt-4 text-lg font-black text-slate-900">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function sortTasks<T extends Task>(tasks: T[]): T[] {
  return [...tasks].sort((first, second) => {
    const firstCompleted = first.status === "Completed";
    const secondCompleted = second.status === "Completed";

    if (firstCompleted !== secondCompleted) {
      return firstCompleted ? 1 : -1;
    }

    if (first.due_date && second.due_date) {
      return first.due_date.localeCompare(second.due_date);
    }

    if (first.due_date) return -1;
    if (second.due_date) return 1;

    return second.created_at.localeCompare(first.created_at);
  });
}

function getLocalDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}