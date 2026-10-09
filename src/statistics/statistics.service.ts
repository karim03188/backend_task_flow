import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { endOfDay, startOfDay } from '../common/utils/date.util';
import { PrismaService } from '../prisma/prisma.service';
import { TaskPriority, TaskStatus } from '../tasks/task.enums';
import {
  PriorityBreakdown,
  StatisticsOverview,
  StatusBreakdown,
} from './statistics-response.type';

type GroupRow<T extends string> = { _count: { _all: number } } & Record<
  T,
  string
>;

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string): Promise<StatisticsOverview> {
    const now = new Date();
    const activeStatuses: Prisma.TaskWhereInput['status'] = {
      notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
    };

    const [
      total,
      completed,
      todo,
      inProgress,
      cancelled,
      overdue,
      dueToday,
      byPriority,
      byStatus,
    ] = await this.prisma.$transaction([
      this.prisma.task.count({ where: { userId } }),
      this.prisma.task.count({
        where: { userId, status: TaskStatus.COMPLETED },
      }),
      this.prisma.task.count({ where: { userId, status: TaskStatus.TODO } }),
      this.prisma.task.count({
        where: { userId, status: TaskStatus.IN_PROGRESS },
      }),
      this.prisma.task.count({
        where: { userId, status: TaskStatus.CANCELLED },
      }),
      this.prisma.task.count({
        where: {
          userId,
          status: activeStatuses,
          dueDate: { lt: now },
        },
      }),
      this.prisma.task.count({
        where: {
          userId,
          status: activeStatuses,
          dueDate: { gte: startOfDay(), lte: endOfDay() },
        },
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
    ]);

    const pending = todo + inProgress;

    return {
      totalTasks: total,
      completedTasks: completed,
      pendingTasks: pending,
      todoTasks: todo,
      inProgressTasks: inProgress,
      cancelledTasks: cancelled,
      overdueTasks: overdue,
      dueTodayTasks: dueToday,
      completionPercentage:
        total === 0 ? 0 : Math.round((completed / total) * 100),
      byPriority: this.toPriorityBreakdown(byPriority),
      byStatus: this.toStatusBreakdown(byStatus),
    };
  }

  private toPriorityBreakdown(rows: GroupRow<'priority'>[]): PriorityBreakdown {
    const breakdown = Object.values(TaskPriority).reduce(
      (acc, priority) => ({ ...acc, [priority]: 0 }),
      {} as PriorityBreakdown,
    );
    for (const row of rows) {
      breakdown[row.priority as TaskPriority] = row._count._all;
    }
    return breakdown;
  }

  private toStatusBreakdown(rows: GroupRow<'status'>[]): StatusBreakdown {
    const breakdown = Object.values(TaskStatus).reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as StatusBreakdown,
    );
    for (const row of rows) {
      breakdown[row.status as TaskStatus] = row._count._all;
    }
    return breakdown;
  }
}
