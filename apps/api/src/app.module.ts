import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SamplesModule } from './modules/samples/samples.module';
import { AiModule } from './modules/ai/ai.module';
import { ExcelModule } from './modules/excel/excel.module';
import { WordModule } from './modules/word/word.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { InquiryRequestsModule } from './modules/inquiry-requests/inquiry-requests.module';
import { TechnicalTasksModule } from './modules/technical-tasks/technical-tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'generated'),
      serveRoot: '/generated',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    ProjectsModule,
    SamplesModule,
    AiModule,
    ExcelModule,
    WordModule,
    TelegramModule,
    InquiryRequestsModule,
    TechnicalTasksModule,
  ],
})
export class AppModule {}

