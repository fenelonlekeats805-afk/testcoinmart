import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = (
    process.env.CORS_ORIGINS ||
    // Include both http/https for first-time server bring-up (before TLS) and IP-based access.
    // Operator can override via CORS_ORIGINS.
    'http://testcoinmart.top,https://testcoinmart.top,http://www.testcoinmart.top,https://www.testcoinmart.top,http://admin.testcoinmart.top,https://admin.testcoinmart.top'
  )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Testcoin Public API')
    .setDescription('Public purchase API for testnet token store')
    .setVersion('1.0.0')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('v1/docs', app, swaggerDoc);

  const port = Number(process.env.API_PORT || 3001);
  await app.listen(port);
}

bootstrap();
