import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { TechnicalTasksService } from './technical-tasks.service';
import { TechnicalTasksController } from './technical-tasks.controller';
import { TzXmlExtractorService } from './tz-xml-extractor.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CompaniesModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB для Word/PDF/XML и вложений
      },
    }),
  ],
  controllers: [TechnicalTasksController],
  providers: [TechnicalTasksService, TzXmlExtractorService],
  exports: [TechnicalTasksService],
})
export class TechnicalTasksModule {}
