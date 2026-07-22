"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TaskCard from "@/components/tasks/TaskCard";
import TaskModal from "@/components/tasks/TaskModal";
import {
  changeTaskStatus,
  createTask,
  deleteTask,
  getCompanyTasks,
  updateTask,
} from "@/lib/tasks";
import type { Task, TaskFormValues } from "@/lib/types/task";

type TaskListProps = {
  companyId: string | number;
  onOpenCountChange?: (count: number) => void;
};

export default function TaskList({
  companyId,
  onOpenCountChange,
}: TaskListProps) {
  const resolvedCompanyId = String(companyId);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== "Completed"),
    [tasks],
  );

  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === "Completed"),
    [tasks],
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setPageError("");

    const result = await getCompanyTasks(resolvedCompanyId);

    if (!result.success) {
      setTasks([]);
      setPageError(result.error);
      setLoading(false);
      return;
    }

    setTasks(result.data);
    setLoading(false);
  }, [resolvedCompanyId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    onOpenCountChange?.(openTasks.length);
  }, [onOpenCountChange, openTasks.length]);

  function openCreateModal() {
    setEditingTask(null);
    setModalError("");
    setModalOpen(true);
  }

  function openEditModal(task: Task) {
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
    setSaving(true);
    setModalError("");

    const result = editingTask
      ? await updateTask(editingTask, values)
      : await createTask(resolvedCompanyId, values);

    if (!result.success) {
      setModalError(result.error);
      setSaving(false);
      return;
    }

    if (editingTask) {
      setTasks((current) =>
        sortTasks(
          current.map((task) =>
            task.id === result.data.id ? result.data : task,
          ),
        ),
      );
    } else {
      setTasks((current) => sortTasks([result.data, ...current]));
    }

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
          item.id === result.data.id ? result.data : item,
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
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Tasks
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage follow-ups, deadlines and actions for this company.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            + Add task
          </button>
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
          <div className="mt-6 rounded-xl bg-slate-50 p-8 text-center">
            <p className="font-bold text-slate-700">
              Loading tasks
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Reading the latest tasks from Supabase.
            </p>
          </div>
        ) : null}

        {!loading && tasks.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
              ✓
            </div>

            <h3 className="mt-4 text-lg font-black text-slate-900">
              No tasks yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Add the first task to record a follow-up, deadline or
              action for this company.
            </p>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              + Add task
            </button>
          </div>
        ) : null}

        {!loading && openTasks.length > 0 ? (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
                Open tasks
              </h3>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                {openTasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {openTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  busy={busyTaskId === task.id}
                  onEdit={openEditModal}
                  onToggleComplete={toggleTask}
                  onDelete={removeTask}
                />
              ))}
            </div>
          </div>
        ) : null}

        {!loading && completedTasks.length > 0 ? (
          <details className="mt-7 rounded-xl border border-slate-200">
            <summary className="cursor-pointer select-none px-5 py-4 text-sm font-black text-slate-700">
              Completed tasks ({completedTasks.length})
            </summary>

            <div className="space-y-3 border-t border-slate-100 p-4">
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  busy={busyTaskId === task.id}
                  onEdit={openEditModal}
                  onToggleComplete={toggleTask}
                  onDelete={removeTask}
                />
              ))}
            </div>
          </details>
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

function sortTasks(tasks: Task[]) {
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