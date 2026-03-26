import { NestFactory }       from '@nestjs/core';
import { ValidationPipe }    from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule }         from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // FIX: disable verbose logger in production — reduces noise in Coolify logs
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'error', 'warn', 'debug'],
  });

  // Global validation — strip unknown fields, transform types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      transform:            true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS
  app.enableCors({
    origin:      process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  // Swagger — only in non-production or when explicitly enabled
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Desk Beacon API')
      .setDescription('Reserti — desk/hotdesk management system')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Server on http://localhost:${port}/api/v1`);
}
bootstrap();
