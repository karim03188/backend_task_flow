import request from 'supertest';
import { createTestApp, TestContext } from './test-app';

describe('Health (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/v1/health returns ok and reports the database as up', async () => {
    const res = await request(ctx.server).get('/api/v1/health').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'up' });
    expect(typeof res.body.data.uptime).toBe('number');
  });

  it('GET /api/v1/health is public (no token required)', async () => {
    await request(ctx.server).get('/api/v1/health').expect(200);
  });
});
