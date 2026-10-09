import { TaskPriority, TaskStatus } from '../tasks/task.enums';

export type PriorityBreakdown = Record<TaskPriority, number>;
export type StatusBreakdown = Record<TaskStatus, number>;

export interface StatisticsOverview {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  cancelledTasks: number;
  overdueTasks: number;
  dueTodayTasks: number;
  completionPercentage: number;
  byPriority: PriorityBreakdown;
  byStatus: StatusBreakdown;
}
