import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { AiModule } from '../ai/ai.module';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [AiModule, WeatherModule],
  providers: [ExcelService],
  exports: [ExcelService],
})
export class ExcelModule {}

