import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { endOfDay, startOfDay } from '../common/utils/date.util';
import { paginate } from '../common/utils/pagination.util';
import { PaginatedResult } from '../common/interfaces/api-response.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto, TaskSortField } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PRIORITY_RANK, TaskPriority, TaskStatus } from './task.enums';
import { TaskResponse, toTaskResponse } from './task-response.type';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto): Promise<TaskResponse> {
    if (dto.categoryId) {
      await this.assertCategoryOwnership(userId, dto.categoryId);
    }

    const status = dto.status ?? TaskStatus.TODO;
    const priority = dto.priority ?? TaskPriority.MEDIUM;

    const task = await this.prisma.task.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description ?? null,
        status,
        priority,
        priorityRank: PRIORITY_RANK[priority],
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
        categoryId: dto.categoryId ?? null,
      },
    });

    return toTaskResponse(task);
  }

  async findAll(
    userId: string,
    query: QueryTasksDto,
  ): Promise<PaginatedResult<TaskResponse>> {
    const where = this.buildWhere(userId, query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        orderBy: this.buildOrderBy(query.sortBy, query.sortOrder),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return paginate(rows.map(toTaskResponse), query.page, query.limit, total);
  }

  async findOne(userId: string, id: string): Promise<TaskResponse> {
    return toTaskResponse(await this.findOwnedTaskOrThrow(userId, id));
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponse> {
    const existing = await this.findOwnedTaskOrThrow(userId, id);

    if (dto.categoryId) {
      await this.assertCategoryOwnership(userId, dto.categoryId);
    }

    const data: Prisma.TaskUncheckedUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) {
      data.priority = dto.priority;
      data.priorityRank = PRIORITY_RANK[dto.priority];
    }
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.categoryId !== undefined) {
      data.categoryId = dto.categoryId;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      this.applyCompletionTransition(data, existing, dto.status);
    }

    const task = await this.prisma.task.update({ where: { id }, data });
    return toTaskResponse(task);
  }

  async complete(userId: string, id: string): Promise<TaskResponse> {
    const existing = await this.findOwnedTaskOrThrow(userId, id);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: existing.completedAt ?? new Date(),
      },
    });

    return toTaskResponse(task);
  }

  async reopen(userId: string, id: string): Promise<TaskResponse> {
    await this.findOwnedTaskOrThrow(userId, id);

    const task = await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.TODO, completedAt: null },
    });

    return toTaskResponse(task);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.prisma.task.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      throw new NotFoundException('Task not found');
    }
  }

  private applyCompletionTransition(
    data: Prisma.TaskUncheckedUpdateInput,
    existing: Task,
    nextStatus: TaskStatus,
  ): void {
    const becomingCompleted = nextStatus === TaskStatus.COMPLETED;
    const leavingCompleted =
      existing.status === TaskStatus.COMPLETED &&
      nextStatus !== TaskStatus.COMPLETED;

    if (becomingCompleted && !existing.completedAt) {
      data.completedAt = new Date();
    } else if (leavingCompleted) {
      data.completedAt = null;
    }
  }

  private async findOwnedTaskOrThrow(
    userId: string,
    id: string,
  ): Promise<Task> {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private async assertCategoryOwnership(
    userId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private buildWhere(userId: string, q: QueryTasksDto): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = { userId };
    const and: Prisma.TaskWhereInput[] = [];

    if (q.status) where.status = q.status;
    if (q.priority) where.priority = q.priority;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search } },
        { description: { contains: q.search } },
      ];
    }

    const dueDate: Prisma.DateTimeNullableFilter = {};
    if (q.dueDateFrom) dueDate.gte = new Date(q.dueDateFrom);
    if (q.dueDateTo) dueDate.lte = new Date(q.dueDateTo);
    if (q.dueToday) {
      dueDate.gte = startOfDay();
      dueDate.lte = endOfDay();
    }
    if (Object.keys(dueDate).length > 0) {
      where.dueDate = dueDate;
    }

    if (q.overdue) {
      and.push({
        dueDate: { lt: new Date() },
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    return where;
  }

  private buildOrderBy(
    sortBy: TaskSortField,
    sortOrder: 'asc' | 'desc',
  ): Prisma.TaskOrderByWithRelationInput {
    switch (sortBy) {
      case 'priority':
        return { priorityRank: sortOrder };
      case 'title':
        return { title: sortOrder };
      case 'dueDate':
        return { dueDate: sortOrder };
      case 'updatedAt':
        return { updatedAt: sortOrder };
      case 'createdAt':
      default:
        return { createdAt: sortOrder };
    }
  }
}
