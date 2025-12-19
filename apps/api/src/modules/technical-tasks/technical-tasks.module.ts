import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { TechnicalTasksService } from './technical-tasks.service';
import { TechnicalTasksController } from './technical-tasks.controller';
import { TzProcessingService } from './tz-processing.service';
import { TzGeneratorService } from './tz-generator.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CompaniesModule } from '../companies/companies.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CompaniesModule,
    AiModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB для Word/PDF файлов
      },
    }),
  ],
  controllers: [TechnicalTasksController],
  providers: [TechnicalTasksService, TzProcessingService, TzGeneratorService],
  exports: [TechnicalTasksService],
})
export class TechnicalTasksModule {}


