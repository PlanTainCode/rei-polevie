import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ProjectsService } from './projects.service';
import { WordParserService } from './word-parser.service';
import { SamplesService } from './samples.service';
import { ExcelService } from '../excel/excel.service';
import { WordService } from '../word/word.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProjectDto, UpdateSampleDto } from './dto/project.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private wordParserService: WordParserService,
    private samplesService: SamplesService,
    private excelService: ExcelService,
    private wordService: WordService,
  ) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'tz', maxCount: 1 },
      { name: 'order', maxCount: 1 },
    ]),
  )
  async create(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateProjectDto,
    @UploadedFiles()
    files: { tz?: Express.Multer.File[]; order?: Express.Multer.File[] },
  ) {
    return this.projectsService.create(dto, files, req.user.userId);
  }

  @Get()
  async findAll(@Request() req: { user: { userId: string } }) {
    return this.projectsService.findAll(req.user.userId);
  }

  @Get(':id')
  async findById(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.projectsService.findById(id, req.user.userId);
  }

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'tz', maxCount: 1 },
      { name: 'order', maxCount: 1 },
    ]),
  )
  async update(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: Partial<CreateProjectDto>,
    @UploadedFiles()
    files: { tz?: Express.Multer.File[]; order?: Express.Multer.File[] },
  ) {
    return this.projectsService.update(id, dto, files, req.user.userId);
  }

  @Delete(':id')
  async delete(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.projectsService.delete(id, req.user.userId);
  }

  // Парсинг документов проекта
  @Get(':id/parse')
  async parseDocuments(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    const project = await this.projectsService.findById(id, req.user.userId);

    const result: {
      tz?: Awaited<ReturnType<WordParserService['parseDocument']>>;
      order?: Awaited<ReturnType<WordParserService['parseDocument']>>;
    } = {};

    if (project.tzFileUrl) {
      result.tz = await this.wordParserService.parseDocument(project.tzFileUrl);
    }

    if (project.orderFileUrl) {
      result.order = await this.wordParserService.parseDocument(
        project.orderFileUrl,
      );
    }

    return result;
  }

  // Скачивание файла
  @Get(':id/files/:type')
  async downloadFile(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('type') type: 'tz' | 'order',
    @Res() res: Response,
  ) {
    if (type !== 'tz' && type !== 'order') {
      throw new NotFoundException('Неверный тип файла');
    }

    const { path, fileName } = await this.projectsService.getFilePath(
      id,
      type,
      req.user.userId,
    );

    res.download(path, fileName || 'document.docx');
  }

  // Повторная обработка документов
  @Post(':id/reprocess')
  async reprocessDocuments(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.projectsService.reprocessDocuments(id, req.user.userId);
  }

  // Генерация Excel (все листы)
  @Post(':id/generate-excel')
  async generateExcel(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    // Проверяем доступ к проекту
    await this.projectsService.findById(id, req.user.userId);

    // Генерируем полный Excel с заявкой ИЛЦ и актом отбора проб
    const result = await this.excelService.generateFullExcel({
      projectId: id,
      userId: req.user.userId,
    });

    return {
      fileName: result.fileName,
      downloadUrl: `/generated/${result.fileName}`,
      objectPurpose: result.objectPurpose,
      services: result.services,
    };
  }

  // Скачивание сгенерированного Excel
  @Get(':id/excel/:fileName')
  async downloadExcel(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    // Проверяем доступ к проекту
    await this.projectsService.findById(id, req.user.userId);

    const { path, exists } = await this.excelService.getGeneratedFile(fileName);

    if (!exists) {
      throw new NotFoundException('Файл не найден');
    }

    res.download(path, fileName);
  }

  // Генерация заявки ФМБА на микробиологию (Word)
  @Post(':id/generate-fmba')
  async generateFmbaRequest(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    // Проверяем доступ к проекту
    await this.projectsService.findById(id, req.user.userId);

    const result = await this.wordService.generateFmbaRequest({
      projectId: id,
      userId: req.user.userId,
    });

    if (!result) {
      return {
        success: false,
        message: 'Нет проб микробиологии для генерации заявки ФМБА',
      };
    }

    return {
      success: true,
      fileName: result.fileName,
      downloadUrl: `/generated/${result.fileName}`,
    };
  }

  // Скачивание сгенерированного Word
  @Get(':id/word/:fileName')
  async downloadWord(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    // Проверяем доступ к проекту
    await this.projectsService.findById(id, req.user.userId);

    const { path, exists } = await this.wordService.getGeneratedFile(fileName);

    if (!exists) {
      throw new NotFoundException('Файл не найден');
    }

    res.download(path, fileName);
  }

  // ============ РАБОТА С ПРОБАМИ ============

  // Получить все пробы проекта
  @Get(':id/samples')
  async getSamples(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    // Проверяем доступ к проекту
    await this.projectsService.findById(id, req.user.userId);
    
    return this.samplesService.getSamplesByProject(id);
  }

  // Обновить пробу (описание, координаты)
  @Patch(':id/samples/:sampleId')
  async updateSample(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('sampleId') sampleId: string,
    @Body() dto: UpdateSampleDto,
  ) {
    // Проверяем доступ к проекту
    await this.projectsService.findById(id, req.user.userId);
    
    return this.samplesService.updateSample(sampleId, dto);
  }

  // Отметить пробу как собранную
  @Post(':id/samples/:sampleId/collect')
  async collectSample(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('sampleId') sampleId: string,
  ) {
    // Проверяем доступ к проекту
    await this.projectsService.findById(id, req.user.userId);
    
    return this.samplesService.markAsCollected(sampleId, req.user.userId);
  }

  // Перегенерировать пробы (удаляет старые и создаёт новые)
  @Post(':id/regenerate-samples')
  async regenerateSamples(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    const project = await this.projectsService.findById(id, req.user.userId);
    
    if (!project.canEdit) {
      throw new NotFoundException('Нет прав на редактирование проекта');
    }
    
    // Перезапускаем обработку документов (генерация проб внутри)
    await this.projectsService.reprocessDocuments(id, req.user.userId);
    
    return this.samplesService.getSamplesByProject(id);
  }
}

