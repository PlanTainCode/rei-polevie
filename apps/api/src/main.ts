import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: configService.get('FRONTEND_URL', 'http://localhost:5173'),
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  // Глобальный префикс
  app.setGlobalPrefix('api');

  const port = configService.get('PORT', 3001);
  await app.listen(port);

  console.log(`🚀 API is running on: http://localhost:${port}/api`);
}

bootstrap();

