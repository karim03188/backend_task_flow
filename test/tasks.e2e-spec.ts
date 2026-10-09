import request from 'supertest';
import { bearer, createTestApp, registerUser, TestContext } from './test-app';

describe('Tasks (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ token } = await registerUser(ctx.server, { email: 'tasks@test.dev' }));
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const createTask = async (body: Record<string, unknown>) => {
    const res = await request(ctx.server)
      .post('/api/v1/tasks')
      .set(bearer(token))
      .send(body)
      .expect(201);
    return res.body.data;
  };

  it('creates a task with defaults', async () => {
    const task = await createTask({ title: 'Default task' });

    expect(task).toMatchObject({
      title: 'Default task',
      status: 'TODO',
      priority: 'MEDIUM',
      completedAt: null,
      categoryId: null,
    });
    expect(task.id).toEqual(expect.any(String));
    expect(task.createdAt).toEqual(expect.any(String));
  });

  it('rejects an invalid priority/status', async () => {
    await request(ctx.server)
      .post('/api/v1/tasks')
      .set(bearer(token))
      .send({ title: 'Bad', priority: 'SUPER' })
      .expect(400);

    await request(ctx.server)
      .post('/api/v1/tasks')
      .set(bearer(token))
      .send({ title: 'Bad', status: 'DONE' })
      .expect(400);
  });

  it('retrieves a single task', async () => {
    const task = await createTask({ title: 'Retrieve me' });

    const res = await request(ctx.server)
      .get(`/api/v1/tasks/${task.id}`)
      .set(bearer(token))
      .expect(200);

    expect(res.body.data.id).toBe(task.id);
    expect(res.body.data.title).toBe('Retrieve me');
  });

  it('partially updates a task and clears due date / category', async () => {
    const task = await createTask({
      title: 'Update me',
      dueDate: '2026-12-31T17:00:00.000Z',
    });

    const updated = await request(ctx.server)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(bearer(token))
      .send({ title: 'Updated title', dueDate: null })
      .expect(200);

    expect(updated.body.data.title).toBe('Updated title');
    expect(updated.body.data.dueDate).toBeNull();
  });

  it('completes and reopens tasks, keeping completedAt consistent', async () => {
    const task = await createTask({ title: 'Complete me' });

    const completed = await request(ctx.server)
      .patch(`/api/v1/tasks/${task.id}/complete`)
      .set(bearer(token))
      .expect(200);

    expect(completed.body.data.status).toBe('COMPLETED');
    expect(completed.body.data.completedAt).toEqual(expect.any(String));

    const reopened = await request(ctx.server)
      .patch(`/api/v1/tasks/${task.id}/reopen`)
      .set(bearer(token))
      .expect(200);

    expect(reopened.body.data.status).toBe('TODO');
    expect(reopened.body.data.completedAt).toBeNull();
  });

  it('sets completedAt when status is patched to COMPLETED and clears it otherwise', async () => {
    const task = await createTask({ title: 'Status transitions' });

    const completed = await request(ctx.server)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(bearer(token))
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect(completed.body.data.completedAt).toEqual(expect.any(String));

    const back = await request(ctx.server)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(bearer(token))
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(back.body.data.completedAt).toBeNull();
  });

  it('filters, searches, sorts and paginates in the database', async () => {
    // Fresh user to keep counts deterministic.
    const { token: t } = await registerUser(ctx.server, {
      email: 'filter@test.dev',
    });

    const seed = [
      { title: 'Urgent report', priority: 'URGENT', status: 'TODO' },
      { title: 'Low cleanup', priority: 'LOW', status: 'COMPLETED' },
      { title: 'Medium report', priority: 'MEDIUM', status: 'IN_PROGRESS' },
    ];
    for (const item of seed) {
      await request(ctx.server)
        .post('/api/v1/tasks')
        .set(bearer(t))
        .send(item)
        .expect(201);
    }

    const filtered = await request(ctx.server)
      .get('/api/v1/tasks?status=TODO')
      .set(bearer(t))
      .expect(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].title).toBe('Urgent report');

    const searched = await request(ctx.server)
      .get('/api/v1/tasks?search=report')
      .set(bearer(t))
      .expect(200);
    expect(searched.body.data).toHaveLength(2);

    const sorted = await request(ctx.server)
      .get('/api/v1/tasks?sortBy=priority&sortOrder=desc')
      .set(bearer(t))
      .expect(200);
    expect(sorted.body.data[0].priority).toBe('URGENT');
    expect(sorted.body.data[2].priority).toBe('LOW');

    const paged = await request(ctx.server)
      .get('/api/v1/tasks?page=1&limit=2')
      .set(bearer(t))
      .expect(200);
    expect(paged.body.data).toHaveLength(2);
    expect(paged.body.meta).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it('deletes a task and returns 204', async () => {
    const task = await createTask({ title: 'Delete me' });

    await request(ctx.server)
      .delete(`/api/v1/tasks/${task.id}`)
      .set(bearer(token))
      .expect(204);

    await request(ctx.server)
      .get(`/api/v1/tasks/${task.id}`)
      .set(bearer(token))
      .expect(404);
  });

  it('prevents access to another user task', async () => {
    const task = await createTask({ title: 'Private task' });
    const { token: other } = await registerUser(ctx.server, {
      email: 'other@test.dev',
    });

    await request(ctx.server)
      .get(`/api/v1/tasks/${task.id}`)
      .set(bearer(other))
      .expect(404);

    await request(ctx.server)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(bearer(other))
      .send({ title: 'Hijacked' })
      .expect(404);

    await request(ctx.server)
      .delete(`/api/v1/tasks/${task.id}`)
      .set(bearer(other))
      .expect(404);
  });

  it('returns 404 for unknown task ids', async () => {
    await request(ctx.server)
      .get('/api/v1/tasks/does-not-exist')
      .set(bearer(token))
      .expect(404);
  });
});
