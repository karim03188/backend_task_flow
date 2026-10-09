import request from 'supertest';
import { bearer, createTestApp, registerUser, TestContext } from './test-app';

describe('Statistics (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ token } = await registerUser(ctx.server, { email: 'stats@test.dev' }));

    const past = new Date(Date.now() - 86_400_000).toISOString();
    const seed = [
      { title: 'A', status: 'TODO', priority: 'LOW', dueDate: past },
      { title: 'B', status: 'IN_PROGRESS', priority: 'HIGH' },
      { title: 'C', status: 'COMPLETED', priority: 'URGENT' },
      { title: 'D', status: 'CANCELLED', priority: 'LOW' },
    ];

    for (const item of seed) {
      await request(ctx.server)
        .post('/api/v1/tasks')
        .set(bearer(token))
        .send(item)
        .expect(201);
    }
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns a correct overview for the authenticated user', async () => {
    const res = await request(ctx.server)
      .get('/api/v1/statistics/overview')
      .set(bearer(token))
      .expect(200);

    const data = res.body.data;
    expect(data).toMatchObject({
      totalTasks: 4,
      completedTasks: 1,
      pendingTasks: 2,
      todoTasks: 1,
      inProgressTasks: 1,
      cancelledTasks: 1,
      overdueTasks: 1,
      completionPercentage: 25,
    });
    expect(data.byPriority).toEqual({
      LOW: 2,
      MEDIUM: 0,
      HIGH: 1,
      URGENT: 1,
    });
    expect(data.byStatus).toEqual({
      TODO: 1,
      IN_PROGRESS: 1,
      COMPLETED: 1,
      CANCELLED: 1,
    });
  });

  it('returns zeros and 0% for a user with no tasks', async () => {
    const { token: empty } = await registerUser(ctx.server, {
      email: 'empty@test.dev',
    });

    const res = await request(ctx.server)
      .get('/api/v1/statistics/overview')
      .set(bearer(empty))
      .expect(200);

    expect(res.body.data).toMatchObject({
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      completionPercentage: 0,
    });
    expect(res.body.data.byStatus.COMPLETED).toBe(0);
  });
});
