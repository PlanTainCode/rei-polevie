import { Module, forwardRef } from '@nestjs/common';
import { WordService } from './word.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ProjectsModule), AiModule],
  providers: [WordService],
  exports: [WordService],
})
export class WordModule {}

