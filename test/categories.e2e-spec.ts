import request from 'supertest';
import { bearer, createTestApp, registerUser, TestContext } from './test-app';

describe('Categories (e2e)', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ token } = await registerUser(ctx.server, { email: 'cats@test.dev' }));
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const createCategory = async (body: Record<string, unknown>) => {
    const res = await request(ctx.server)
      .post('/api/v1/categories')
      .set(bearer(token))
      .send(body)
      .expect(201);
    return res.body.data;
  };

  it('creates and lists categories with task counts', async () => {
    const category = await createCategory({ name: 'Work', color: '#3B82F6' });
    expect(category).toMatchObject({ name: 'Work', taskCount: 0 });

    await request(ctx.server)
      .post('/api/v1/tasks')
      .set(bearer(token))
      .send({ title: 'Task in category', categoryId: category.id })
      .expect(201);

    const list = await request(ctx.server)
      .get('/api/v1/categories')
      .set(bearer(token))
      .expect(200);

    const found = list.body.data.find((c: any) => c.id === category.id);
    expect(found.taskCount).toBe(1);
  });

  it('rejects duplicate category names for the same user with 409', async () => {
    await createCategory({ name: 'Unique' });
    await request(ctx.server)
      .post('/api/v1/categories')
      .set(bearer(token))
      .send({ name: 'Unique' })
      .expect(409);
  });

  it('updates a category', async () => {
    const category = await createCategory({ name: 'To Update' });

    const res = await request(ctx.server)
      .patch(`/api/v1/categories/${category.id}`)
      .set(bearer(token))
      .send({ name: 'Updated' })
      .expect(200);

    expect(res.body.data.name).toBe('Updated');
  });

  it('deleting a category keeps its tasks and clears their category', async () => {
    const category = await createCategory({ name: 'Temporary' });
    const task = await request(ctx.server)
      .post('/api/v1/tasks')
      .set(bearer(token))
      .send({ title: 'Survivor', categoryId: category.id })
      .expect(201);

    await request(ctx.server)
      .delete(`/api/v1/categories/${category.id}`)
      .set(bearer(token))
      .expect(204);

    const res = await request(ctx.server)
      .get(`/api/v1/tasks/${task.body.data.id}`)
      .set(bearer(token))
      .expect(200);

    expect(res.body.data.categoryId).toBeNull();
  });

  it('prevents access to another user category', async () => {
    const category = await createCategory({ name: 'Mine' });
    const { token: other } = await registerUser(ctx.server, {
      email: 'cat-other@test.dev',
    });

    await request(ctx.server)
      .get(`/api/v1/categories/${category.id}`)
      .set(bearer(other))
      .expect(404);

    await request(ctx.server)
      .delete(`/api/v1/categories/${category.id}`)
      .set(bearer(other))
      .expect(404);
  });
});
