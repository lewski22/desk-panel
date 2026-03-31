import { NestFactory }                   from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule }                     from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'error', 'warn', 'debug'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      transform:            true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin:      process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
  });

  // /install/* serwuje skrypt bash — poza prefixem /api/v1
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'install/(.*)', method: RequestMethod.GET }],
  });

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
  console.log(`🚀  API:     https://api.prohalw2026.ovh/api/v1`);
  console.log(`📦  Install: https://api.prohalw2026.ovh/install/gateway/:token`);
}
bootstrap();
