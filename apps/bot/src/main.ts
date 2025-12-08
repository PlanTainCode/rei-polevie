import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Бот будет работать через long polling
  // В продакшене рекомендуется использовать webhooks
  
  await app.init();
  console.log('🤖 Telegram Bot is running');
}

bootstrap();

