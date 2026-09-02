"use client";

import { useEffect, useState } from "react";
import {
  taskPriorities,
  type Task,
  type TaskFormValues,
  type TaskPriority,
} from "@/lib/types/task";

type TaskModalProps = {
  open: boolean;
  task?: Task | null;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void>;
};

const initialValues: TaskFormValues = {
  title: "",
  description: "",
  priority: "Medium",
  due_date: "",
  assigned_to: "",
};

export default function TaskModal({
  open,
  task,
  saving,
  error = "",
  onClose,
  onSubmit,
}: TaskModalProps) {
  const [values, setValues] =
    useState<TaskFormValues>(initialValues);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) return;

    if (task) {
      setValues({
        title: task.title,
        description: task.description || "",
        priority: isTaskPriority(task.priority)
          ? task.priority
          : "Medium",
        due_date: task.due_date || "",
        assigned_to: task.assigned_to || "",
      });
    } else {
      setValues(initialValues);
    }

    setValidationError("");
  }, [open, task]);

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!values.title.trim()) {
      setValidationError("Enter a task title.");
      return;
    }

    setValidationError("");
    await onSubmit(values);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-6">
          <div>
            <h2
              id="task-modal-title"
              className="text-xl font-black text-[var(--text-primary)]"
            >
              {task ? "Edit task" : "Add task"}
            </h2>

            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {task
                ? "Update the task details and deadline."
                : "Create a follow-up task for this company."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[var(--text-secondary)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)] disabled:opacity-50"
            aria-label="Close task form"
          >
            X
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="space-y-5 p-6">
            <FormField label="Task title" required>
              <input
                type="text"
                value={values.title}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="For example, call customer"
                autoFocus
                disabled={saving}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 disabled:bg-[var(--surface-soft)]"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                value={values.description}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Add any notes or instructions..."
                rows={4}
                disabled={saving}
                className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 disabled:bg-[var(--surface-soft)]"
              />
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Due date">
                <input
                  type="date"
                  value={values.due_date}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      due_date: event.target.value,
                    }))
                  }
                  disabled={saving}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 disabled:bg-[var(--surface-soft)]"
                />
              </FormField>

              <FormField label="Priority">
                <select
                  value={values.priority}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      priority: event.target.value as TaskPriority,
                    }))
                  }
                  disabled={saving}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 disabled:bg-[var(--surface-soft)]"
                >
                  {taskPriorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Assigned to">
              <input
                type="text"
                value={values.assigned_to}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    assigned_to: event.target.value,
                  }))
                }
                placeholder="For example, Lucas"
                disabled={saving}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/10 disabled:bg-[var(--surface-soft)]"
              />
            </FormField>

            {validationError || error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {validationError || error}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 border-t border-[var(--border)] bg-[var(--surface-soft)] p-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : task
                  ? "Save changes"
                  : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[var(--text-primary)]">
        {label}

        {required ? (
          <span className="ml-1 text-red-600">*</span>
        ) : null}
      </span>

      {children}
    </label>
  );
}

function isTaskPriority(value: string): value is TaskPriority {
  return taskPriorities.some((priority) => priority === value);
}
