export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwt: JwtConfig;
  corsOrigin: string;
  throttle: ThrottleConfig;
}

export default (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '10', 10),
  },
});
