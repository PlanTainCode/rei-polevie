import { Module, forwardRef } from '@nestjs/common';
import { WordService } from './word.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ProjectsModule)],
  providers: [WordService],
  exports: [WordService],
})
export class WordModule {}

