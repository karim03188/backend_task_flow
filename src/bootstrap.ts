import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

export const API_PREFIX = 'api/v1';

/**
 * Applies all framework-level configuration shared by the real server and the
 * e2e test bootstrap: global prefix, security headers, CORS, Swagger and
 * graceful shutdown.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());

  const corsOrigin = config.get<string>('corsOrigin') ?? '*';
  app.enableCors({
    origin:
      corsOrigin === '*'
        ? true
        : corsOrigin
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.enableShutdownHooks();

  setupSwagger(app);

  Logger.log(`Global prefix set to /${API_PREFIX}`, 'Bootstrap');
}

function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Task Flow API')
      .setDescription(
        'REST API for the Task Flow mobile application. Authenticate with the ' +
          '`Authorization: Bearer <accessToken>` header.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter the JWT access token returned by /auth/login',
        },
        'access-token',
      )
      .build(),
  );

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
