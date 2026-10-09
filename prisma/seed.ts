import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@taskflow.dev';
const DEMO_PASSWORD = 'Password123';

const PRIORITY_RANK: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: 'Demo User', passwordHash },
    create: { email: DEMO_EMAIL, name: 'Demo User', passwordHash },
  });

  const categorySeed = [
    { name: 'Work', color: '#3B82F6' },
    { name: 'Personal', color: '#22C55E' },
    { name: 'Shopping', color: '#F59E0B' },
  ];

  const categories: Record<string, { id: string }> = {};
  for (const seed of categorySeed) {
    categories[seed.name] = await prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: seed.name } },
      update: { color: seed.color },
      create: { userId: user.id, name: seed.name, color: seed.color },
    });
  }

  // Reset the demo user's tasks so the seed is repeatable.
  await prisma.task.deleteMany({ where: { userId: user.id } });

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const tasks = [
    {
      title: 'Finish sprint report',
      description: 'Summarise the completed tickets before the review.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: new Date(now + DAY),
      completedAt: null,
      category: 'Work',
    },
    {
      title: 'Review open pull requests',
      description: 'Two PRs are waiting for review.',
      status: 'TODO',
      priority: 'URGENT',
      dueDate: new Date(now - DAY),
      completedAt: null,
      category: 'Work',
    },
    {
      title: 'Buy groceries',
      description: null,
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: new Date(now),
      completedAt: null,
      category: 'Shopping',
    },
    {
      title: 'Call the dentist',
      description: 'Reschedule the check-up.',
      status: 'COMPLETED',
      priority: 'LOW',
      dueDate: new Date(now - 2 * DAY),
      completedAt: new Date(now - DAY),
      category: 'Personal',
    },
    {
      title: 'Plan weekend trip',
      description: 'Ideas for a short trip.',
      status: 'CANCELLED',
      priority: 'LOW',
      dueDate: null,
      completedAt: null,
      category: 'Personal',
    },
  ];

  for (const task of tasks) {
    await prisma.task.create({
      data: {
        userId: user.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        priorityRank: PRIORITY_RANK[task.priority],
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        categoryId: categories[task.category]?.id ?? null,
      },
    });
  }

  console.log('Seed complete.');
  console.log(`  User:     ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Categories: ${categorySeed.length}`);
  console.log(`  Tasks:      ${tasks.length}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
