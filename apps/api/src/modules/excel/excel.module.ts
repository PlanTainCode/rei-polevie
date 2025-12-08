import { Module } from '@nestjs/common';
import { ExcelService } from './excel.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [ExcelService],
  exports: [ExcelService],
})
export class ExcelModule {}

