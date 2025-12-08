import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname, join } from 'path';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { WordParserService } from './word-parser.service';
import { SamplesService } from './samples.service';
import { CompaniesModule } from '../companies/companies.module';
import { ExcelModule } from '../excel/excel.module';
import { WordModule } from '../word/word.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    CompaniesModule,
    AiModule,
    forwardRef(() => ExcelModule),
    forwardRef(() => WordModule),
    MulterModule.register({
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads'),
        filename: (req, file, callback) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Разрешаем только Word документы
        const allowedMimes = [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error('Разрешены только файлы Word (.doc, .docx)'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, WordParserService, SamplesService],
  exports: [ProjectsService, WordParserService, SamplesService],
})
export class ProjectsModule {}

