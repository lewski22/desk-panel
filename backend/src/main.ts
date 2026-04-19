import { NestFactory }                   from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule }                     from './app.module';

// CommonJS `require` is always available at runtime; declared here because
// @types/node is a devDep and may not be resolved by the IDE language server.
declare function require(module: string): any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'error', 'warn', 'debug'],
    bodyParser: false,
  });

  // Increase body limit to handle base64-encoded floor plan images (~2 MB file → ~2.7 MB JSON)
  const bodyParser = require('body-parser');
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

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

  app.setGlobalPrefix('api/v1', {
    exclude: [
      // Skrypt instalacyjny gateway (Raspberry Pi)
      { path: 'install/{*path}',       method: RequestMethod.GET  },
      // Prometheus scraper — poza /api/v1
      { path: 'metrics',               method: RequestMethod.GET  },
      // Health check (Coolify, load balancer)
      { path: 'health',                method: RequestMethod.GET  },
      // Google OAuth2 — Google nie wie o /api/v1 prefiksie
      { path: 'auth/google/callback',  method: RequestMethod.GET  },
      // Microsoft Graph OAuth2 — redirect + callback poza prefixem
      { path: 'auth/graph/redirect',   method: RequestMethod.GET  },
      { path: 'auth/graph/callback',   method: RequestMethod.GET  },
      // Microsoft Graph webhook — musi być publiczny (MS nie wysyła żadnego auth)
      { path: 'graph/webhook',         method: RequestMethod.POST },
    ],
  });

  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Desk Beacon API')
      .setDescription('Reserti — desk/hotdesk management system')
      .setVersion('0.17.0')
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
