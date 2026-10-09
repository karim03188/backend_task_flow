// Runs before any test module is imported (jest `setupFiles`), so the
// configuration read by ConfigModule / PrismaClient is already in place.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret-please-change-0123456789abcdef';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGIN = '*';
process.env.THROTTLE_TTL = '60';
process.env.THROTTLE_LIMIT = '1000';
