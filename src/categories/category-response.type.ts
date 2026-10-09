import { Category } from '@prisma/client';

export interface CategoryResponse {
  id: string;
  name: string;
  color: string | null;
  taskCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toCategoryResponse(
  category: Category,
  taskCount = 0,
): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    taskCount,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
