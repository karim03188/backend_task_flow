import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryResponse, toCategoryResponse } from './category-response.type';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponse> {
    await this.assertNameAvailable(userId, dto.name);

    const category = await this.prisma.category.create({
      data: { userId, name: dto.name, color: dto.color ?? null },
    });

    return toCategoryResponse(category, 0);
  }

  async findAll(userId: string): Promise<CategoryResponse[]> {
    const categories = await this.prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { tasks: true } } },
    });

    return categories.map((category) =>
      toCategoryResponse(category, category._count.tasks),
    );
  }

  async findOne(userId: string, id: string): Promise<CategoryResponse> {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
      include: { _count: { select: { tasks: true } } },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return toCategoryResponse(category, category._count.tasks);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    const existing = await this.findOwnedCategoryOrThrow(userId, id);

    if (dto.name !== undefined && dto.name !== existing.name) {
      await this.assertNameAvailable(userId, dto.name);
    }

    const data: Prisma.CategoryUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.color !== undefined) data.color = dto.color;

    const category = await this.prisma.category.update({
      where: { id },
      data,
      include: { _count: { select: { tasks: true } } },
    });

    return toCategoryResponse(category, category._count.tasks);
  }

  /**
   * Deletes a category. Tasks that referenced it are preserved and have their
   * category cleared (the foreign key uses ON DELETE SET NULL).
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOwnedCategoryOrThrow(userId, id);
    await this.prisma.category.delete({ where: { id } });
  }

  private async findOwnedCategoryOrThrow(
    userId: string,
    id: string,
  ): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async assertNameAvailable(
    userId: string,
    name: string,
  ): Promise<void> {
    const existing = await this.prisma.category.findFirst({
      where: { userId, name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A category with this name already exists');
    }
  }
}
