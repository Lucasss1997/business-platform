import { logActivity } from "@/lib/activity";
import { supabase } from "@/lib/supabase";
import type {
  Task,
  TaskFormValues,
  TaskStatus,
} from "@/lib/types/task";

type ServiceResult<T> =
  | {
      success: true;
      data: T;
      error: null;
    }
  | {
      success: false;
      data: null;
      error: string;
    };

type CompanyRelationship =
  | {
      company_name: string | null;
    }
  | {
      company_name: string | null;
    }[]
  | null;

type GlobalTaskRow = Task & {
  companies?: CompanyRelationship;
};

export type GlobalTask = Task & {
  company_name: string;
};

export async function getCompanyTasks(
  companyId: string,
): Promise<ServiceResult<Task[]>> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .order("status", { ascending: false })
    .order("due_date", {
      ascending: true,
      nullsFirst: false,
    })
    .order("created_at", { ascending: false });

  if (error) {
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }

  return {
    success: true,
    data: (data || []) as Task[],
    error: null,
  };
}

export async function getAllTasks(): Promise<
  ServiceResult<GlobalTask[]>
> {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      companies (
        company_name
      )
    `)
    .order("status", { ascending: false })
    .order("due_date", {
      ascending: true,
      nullsFirst: false,
    })
    .order("created_at", { ascending: false });

  if (error) {
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }

  const tasks = ((data || []) as GlobalTaskRow[]).map((task) => {
    const companyRelationship = task.companies;

    const companyName = Array.isArray(companyRelationship)
      ? companyRelationship[0]?.company_name
      : companyRelationship?.company_name;

    const { companies: _companies, ...taskFields } = task;

    return {
      ...taskFields,
      company_name: companyName || "Unknown company",
    };
  });

  return {
    success: true,
    data: tasks,
    error: null,
  };
}

export async function createTask(
  companyId: string,
  values: TaskFormValues,
): Promise<ServiceResult<Task>> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      company_id: companyId,
      title: values.title.trim(),
      description: values.description.trim() || null,
      priority: values.priority,
      due_date: values.due_date || null,
      assigned_to: values.assigned_to.trim() || null,
      status: "Open",
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }

  const task = data as Task;

  await logActivity({
    companyId,
    entityType: "task",
    entityId: task.id,
    action: "created",
    description: `Created task ${task.title}`,
    metadata: {
      title: task.title,
      priority: task.priority,
      due_date: task.due_date,
      assigned_to: task.assigned_to,
    },
  });

  return {
    success: true,
    data: task,
    error: null,
  };
}

export async function updateTask(
  task: Task,
  values: TaskFormValues,
): Promise<ServiceResult<Task>> {
  const changes: Record<string, string | null> = {};

  const nextTitle = values.title.trim();
  const nextDescription = values.description.trim() || null;
  const nextDueDate = values.due_date || null;
  const nextAssignedTo = values.assigned_to.trim() || null;

  if (task.title !== nextTitle) {
    changes.title_before = task.title;
    changes.title_after = nextTitle;
  }

  if (task.description !== nextDescription) {
    changes.description_before = task.description;
    changes.description_after = nextDescription;
  }

  if (task.priority !== values.priority) {
    changes.priority_before = task.priority;
    changes.priority_after = values.priority;
  }

  if (task.due_date !== nextDueDate) {
    changes.due_date_before = task.due_date;
    changes.due_date_after = nextDueDate;
  }

  if (task.assigned_to !== nextAssignedTo) {
    changes.assigned_to_before = task.assigned_to;
    changes.assigned_to_after = nextAssignedTo;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: nextTitle,
      description: nextDescription,
      priority: values.priority,
      due_date: nextDueDate,
      assigned_to: nextAssignedTo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .select("*")
    .single();

  if (error) {
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }

  const updatedTask = data as Task;

  await logActivity({
    companyId: String(task.company_id),
    entityType: "task",
    entityId: task.id,
    action: "updated",
    description: `Updated task ${updatedTask.title}`,
    metadata: {
      title: updatedTask.title,
      ...changes,
    },
  });

  return {
    success: true,
    data: updatedTask,
    error: null,
  };
}

export async function changeTaskStatus(
  task: Task,
  status: TaskStatus,
): Promise<ServiceResult<Task>> {
  const completedAt =
    status === "Completed" ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .select("*")
    .single();

  if (error) {
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }

  const updatedTask = data as Task;

  await logActivity({
    companyId: String(task.company_id),
    entityType: "task",
    entityId: task.id,
    action: status === "Completed" ? "completed" : "reopened",
    description:
      status === "Completed"
        ? `Completed task ${task.title}`
        : `Reopened task ${task.title}`,
    metadata: {
      title: task.title,
      status_before: task.status,
      status_after: status,
      completed_at: completedAt,
    },
  });

  return {
    success: true,
    data: updatedTask,
    error: null,
  };
}

export async function deleteTask(
  task: Task,
): Promise<ServiceResult<true>> {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", task.id);

  if (error) {
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }

  await logActivity({
    companyId: String(task.company_id),
    entityType: "task",
    entityId: task.id,
    action: "deleted",
    description: `Deleted task ${task.title}`,
    metadata: {
      title: task.title,
      priority: task.priority,
      due_date: task.due_date,
      assigned_to: task.assigned_to,
      status: task.status,
    },
  });

  return {
    success: true,
    data: true,
    error: null,
  };
}