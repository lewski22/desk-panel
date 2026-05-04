import { NestFactory }                   from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet                            from 'helmet';
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

  // Trust proxy — poprawne IP klienta za load balancerem (Coolify/Nginx)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security headers — CSP disabled for Swagger UI compatibility (inline scripts)
  app.use(helmet({ contentSecurityPolicy: false }));

  // Cookie parser — wymagany przez httpOnly JWT cookies
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

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

  // Fail fast if required env vars are missing — prevents silent use of hardcoded fallbacks
  const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL', 'PUBLIC_API_URL'] as const;
  const missing = REQUIRED_ENV.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`[bootstrap] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const port    = process.env.PORT ?? 3000;
  const apiUrl  = process.env.PUBLIC_API_URL;
  await app.listen(port);
  console.log(`🚀  API:     ${apiUrl}/api/v1`);
  console.log(`📦  Install: ${apiUrl}/install/gateway/:token`);
}
bootstrap();
