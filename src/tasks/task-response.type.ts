import { Task } from '@prisma/client';
import { TaskPriority, TaskStatus } from './task.enums';

export interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  completedAt: Date | null;
  categoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toTaskResponse(task: Task): TaskResponse {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    categoryId: task.categoryId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
