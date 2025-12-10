import { Module, forwardRef } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { AiModule } from '../ai/ai.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [AiModule, forwardRef(() => ProjectsModule)],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}

