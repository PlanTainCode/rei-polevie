import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname, join } from 'path';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { WordParserService } from './word-parser.service';
import { SamplesService } from './samples.service';
import { PhotosService } from './photos.service';
import { PresentationService } from './presentation.service';
import { ProgramIeiService } from './program-iei.service';
import { CompaniesModule } from '../companies/companies.module';
import { ExcelModule } from '../excel/excel.module';
import { WordModule } from '../word/word.module';
import { AiModule } from '../ai/ai.module';
import { WeatherModule } from '../weather/weather.module';

// Конфигурация Multer для документов Word
const documentsStorage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (req, file, callback) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

// Фильтр для документов
const documentsFilter = (req: Express.Request, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error('Разрешены только файлы Word (.doc, .docx)'), false);
  }
};

@Module({
  imports: [
    CompaniesModule,
    AiModule,
    WeatherModule,
    forwardRef(() => ExcelModule),
    forwardRef(() => WordModule),
    // Регистрируем Multer с memory storage для фото (обрабатываем вручную)
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB
      },
    }),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, WordParserService, SamplesService, PhotosService, PresentationService, ProgramIeiService],
  exports: [ProjectsService, WordParserService, SamplesService, PhotosService, PresentationService, ProgramIeiService],
})
export class ProjectsModule {}

