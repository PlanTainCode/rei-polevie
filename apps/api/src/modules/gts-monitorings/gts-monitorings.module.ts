import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GtsMonitoringsController } from './gts-monitorings.controller';
import { GtsMonitoringsService } from './gts-monitorings.service';
import { GtsExcelParserService } from './gts-excel-parser.service';
import { GtsPhotosService } from './gts-photos.service';
import { GtsDefectStatementService } from './gts-defect-statement.service';
import { GtsPresentationService } from './gts-presentation.service';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  ],
  controllers: [GtsMonitoringsController],
  providers: [
    GtsMonitoringsService,
    GtsExcelParserService,
    GtsPhotosService,
    GtsDefectStatementService,
    GtsPresentationService,
  ],
  exports: [
    GtsMonitoringsService,
    GtsPhotosService,
  ],
})
export class GtsMonitoringsModule {}
