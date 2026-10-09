import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  server: any;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  await resetDatabase(prisma);

  return { app, prisma, server: app.getHttpServer() };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.task.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

export interface RegisteredUser {
  token: string;
  userId: string;
  email: string;
  password: string;
}

export async function registerUser(
  server: any,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<RegisteredUser> {
  const email =
    overrides.email ?? `user-${Date.now()}-${Math.random()}@test.dev`;
  const password = overrides.password ?? 'Password123';
  const name = overrides.name ?? 'Test User';

  const response = await request(server)
    .post('/api/v1/auth/register')
    .send({ name, email, password })
    .expect(201);

  return {
    token: response.body.data.accessToken,
    userId: response.body.data.user.id,
    email,
    password,
  };
}

export const bearer = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
});
