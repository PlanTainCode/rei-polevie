import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MonitoringsController } from './monitorings.controller';
import { MonitoringsService } from './monitorings.service';
import { MonitoringProbesService } from './monitoring-probes.service';
import { MonitoringPhotosService } from './monitoring-photos.service';
import { MonitoringExcelService } from './monitoring-excel.service';
import { MonitoringPresentationService } from './monitoring-presentation.service';
import { AiModule } from '../ai/ai.module';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [
    AiModule,
    WeatherModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  ],
  controllers: [MonitoringsController],
  providers: [
    MonitoringsService, MonitoringProbesService, MonitoringPhotosService,
    MonitoringExcelService, MonitoringPresentationService,
  ],
  exports: [
    MonitoringsService, MonitoringProbesService, MonitoringPhotosService,
    MonitoringExcelService, MonitoringPresentationService,
  ],
})
export class MonitoringsModule {}
