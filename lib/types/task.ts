export const taskStatuses = ["Open", "Completed"] as const;

export const taskPriorities = ["Low", "Medium", "High"] as const;

export type TaskStatus = (typeof taskStatuses)[number];
export type TaskPriority = (typeof taskPriorities)[number];

export type Task = {
  id: string;
  company_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskFormValues = {
  title: string;
  description: string;
  priority: TaskPriority;
  due_date: string;
  assigned_to: string;
};