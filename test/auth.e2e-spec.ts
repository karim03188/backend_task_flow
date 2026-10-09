import request from 'supertest';
import { bearer, createTestApp, registerUser, TestContext } from './test-app';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('registers a user, hashes the password and returns a token', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/auth/register')
      .send({ name: 'Alice', email: 'alice@test.dev', password: 'Password123' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe('alice@test.dev');
    expect(res.body.data.user.passwordHash).toBeUndefined();

    const stored = await ctx.prisma.user.findUnique({
      where: { email: 'alice@test.dev' },
    });
    expect(stored?.passwordHash).not.toBe('Password123');
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects duplicate emails with 409', async () => {
    await request(ctx.server).post('/api/v1/auth/register').send({
      name: 'Alice',
      email: 'duplicate@test.dev',
      password: 'Password123',
    });

    await request(ctx.server)
      .post('/api/v1/auth/register')
      .send({
        name: 'Alice 2',
        email: 'duplicate@test.dev',
        password: 'Password123',
      })
      .expect(409);
  });

  it('validates the registration payload with 400', async () => {
    const res = await request(ctx.server)
      .post('/api/v1/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    const user = await registerUser(ctx.server, { email: 'login@test.dev' });

    await request(ctx.server)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    await request(ctx.server)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'WrongPassword1' })
      .expect(401);

    await request(ctx.server)
      .post('/api/v1/auth/login')
      .send({ email: 'missing@test.dev', password: 'WrongPassword1' })
      .expect(401);
  });

  it('rejects protected endpoints without a token', async () => {
    await request(ctx.server).get('/api/v1/auth/me').expect(401);
  });

  it('returns the current user for a valid token', async () => {
    const user = await registerUser(ctx.server, { email: 'me@test.dev' });

    const res = await request(ctx.server)
      .get('/api/v1/auth/me')
      .set(bearer(user.token))
      .expect(200);

    expect(res.body.data.email).toBe('me@test.dev');
  });

  it('logout revokes previously issued tokens', async () => {
    const user = await registerUser(ctx.server, { email: 'logout@test.dev' });

    await request(ctx.server)
      .post('/api/v1/auth/logout')
      .set(bearer(user.token))
      .expect(200);

    await request(ctx.server)
      .get('/api/v1/auth/me')
      .set(bearer(user.token))
      .expect(401);
  });

  it('changing the password revokes existing tokens', async () => {
    const user = await registerUser(ctx.server, { email: 'pw@test.dev' });

    await request(ctx.server)
      .patch('/api/v1/users/me/password')
      .set(bearer(user.token))
      .send({ currentPassword: user.password, newPassword: 'NewPassword456' })
      .expect(200);

    await request(ctx.server)
      .get('/api/v1/auth/me')
      .set(bearer(user.token))
      .expect(401);

    await request(ctx.server)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'NewPassword456' })
      .expect(200);
  });
});
