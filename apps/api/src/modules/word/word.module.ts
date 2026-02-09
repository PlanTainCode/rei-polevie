import { Module, forwardRef } from '@nestjs/common';
import { WordService } from './word.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { AiModule } from '../ai/ai.module';
import { DistanceModule } from '../distance/distance.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ProjectsModule), AiModule, DistanceModule],
  providers: [WordService],
  exports: [WordService],
})
export class WordModule {}

