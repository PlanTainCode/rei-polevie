import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';

// TODO: Реализовать модули бота
// - BotModule - основные команды бота
// - WebAppModule - интеграция с Mini App

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN') || '',
        launchOptions: {
          // В разработке используем polling
          // В продакшене - webhooks
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}

