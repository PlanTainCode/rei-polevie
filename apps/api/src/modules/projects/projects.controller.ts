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
  UploadedFile,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname, join } from 'path';
import { existsSync } from 'fs';
import { Response } from 'express';
import { ProjectsService } from './projects.service';
import { WordParserService } from './word-parser.service';
import { SamplesService } from './samples.service';
import { PhotosService } from './photos.service';
import { PresentationService } from './presentation.service';
import { ExcelService } from '../excel/excel.service';
import { WordService } from '../word/word.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProjectDto, UpdateSampleDto, UpdatePhotoDto, ReorderPhotosDto, GenerateAlbumDto } from './dto/project.dto';

// Multer config для документов Word
const documentsStorage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (req, file, callback) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

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

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private wordParserService: WordParserService,
    private samplesService: SamplesService,
    private photosService: PhotosService,
    private presentationService: PresentationService,
    private excelService: ExcelService,
    private wordService: WordService,
  ) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'tz', maxCount: 1 },
        { name: 'order', maxCount: 1 },
      ],
      {
        storage: documentsStorage,
        fileFilter: documentsFilter,
      },
    ),
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
    FileFieldsInterceptor(
      [
        { name: 'tz', maxCount: 1 },
        { name: 'order', maxCount: 1 },
      ],
      {
        storage: documentsStorage,
        fileFilter: documentsFilter,
      },
    ),
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

  // Установить даты документов
  @Post(':id/document-dates')
  async setDocumentDates(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: { 
      ilcRequestDate?: string; 
      fmbaRequestDate?: string; 
      samplingDate?: string;
    },
  ) {
    console.log('setDocumentDates called with dto:', dto);
    try {
      const result = await this.projectsService.setDocumentDates(id, {
        ilcRequestDate: dto.ilcRequestDate ? new Date(dto.ilcRequestDate) : undefined,
        fmbaRequestDate: dto.fmbaRequestDate ? new Date(dto.fmbaRequestDate) : undefined,
        samplingDate: dto.samplingDate ? new Date(dto.samplingDate) : undefined,
      }, req.user.userId);
      console.log('setDocumentDates success');
      return result;
    } catch (error) {
      console.error('setDocumentDates error:', error);
      throw error;
    }
  }

  // Обновить метеоданные
  @Post(':id/refresh-weather')
  async refreshWeather(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.projectsService.refreshWeather(id, req.user.userId);
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

  // ============ РАБОТА С ФОТОГРАФИЯМИ ============

  // Получить все фото проекта
  @Get(':id/photos')
  async getPhotos(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    // Проверяем доступ к проекту
    await this.projectsService.findById(id, req.user.userId);
    
    return this.photosService.getPhotosByProject(id);
  }

  // Загрузить фото (одно или несколько)
  @Post(':id/photos')
  @UseInterceptors(FilesInterceptor('photos', 50)) // до 50 фото за раз
  async uploadPhotos(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // Проверяем доступ к проекту
    const project = await this.projectsService.findById(id, req.user.userId);
    
    if (!project.canEdit) {
      throw new NotFoundException('Нет прав на редактирование проекта');
    }

    if (!files || files.length === 0) {
      throw new NotFoundException('Файлы не загружены');
    }

    return this.photosService.uploadPhotos(id, files, req.user.userId);
  }

  // Обновить данные фото
  @Patch(':id/photos/:photoId')
  async updatePhoto(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Body() dto: UpdatePhotoDto,
  ) {
    // Проверяем доступ к проекту
    const project = await this.projectsService.findById(id, req.user.userId);
    
    if (!project.canEdit) {
      throw new NotFoundException('Нет прав на редактирование проекта');
    }

    return this.photosService.updatePhoto(photoId, {
      description: dto.description,
      photoDate: dto.photoDate ? new Date(dto.photoDate) : undefined,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });
  }

  // Изменить порядок фото
  @Patch(':id/photos-reorder')
  async reorderPhotos(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: ReorderPhotosDto,
  ) {
    // Проверяем доступ к проекту
    const project = await this.projectsService.findById(id, req.user.userId);
    
    if (!project.canEdit) {
      throw new NotFoundException('Нет прав на редактирование проекта');
    }

    return this.photosService.reorderPhotos(id, dto.orders);
  }

  // Удалить фото
  @Delete(':id/photos/:photoId')
  async deletePhoto(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    // Проверяем доступ к проекту
    const project = await this.projectsService.findById(id, req.user.userId);
    
    if (!project.canEdit) {
      throw new NotFoundException('Нет прав на редактирование проекта');
    }

    return this.photosService.deletePhoto(photoId);
  }

  // Скачать оригинал фото (с именем "Название объекта_001.jpg")
  @Get(':id/photos/:photoId/original')
  async downloadOriginal(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Res() res: Response,
  ) {
    // Проверяем доступ к проекту
    const project = await this.projectsService.findById(id, req.user.userId);

    // Получаем фото и его индекс для правильного нейминга
    const photos = await this.photosService.getPhotosByProject(id);
    const photoIndex = photos.findIndex((p: { id: string }) => p.id === photoId);
    
    if (photoIndex === -1) {
      throw new NotFoundException('Фото не найдено');
    }

    const photo = photos[photoIndex];
    const filePath = this.photosService.getOriginalPath(id, photo.filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Файл не найден');
    }

    // Формируем имя файла: "Название объекта_001.jpg"
    const ext = photo.filename.substring(photo.filename.lastIndexOf('.'));
    const downloadName = this.photosService.getDownloadFilename(project.name, photoIndex + 1, ext);

    // Устанавливаем заголовки для скачивания с правильным именем
    res.set({
      'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadName)}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      'Content-Type': 'image/jpeg',
    });
    
    res.sendFile(filePath);
  }

  // Скачать все фото проекта как ZIP-архив
  @Get(':id/photos-download')
  async downloadAllPhotos(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    // Проверяем доступ к проекту
    const project = await this.projectsService.findById(id, req.user.userId);

    const { buffer, filename } = await this.photosService.createPhotosArchive(id, project.name);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  // Получить превью фото (для отображения в списке)
  @Get(':id/photos/:photoId/thumbnail')
  async getThumbnail(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Res() res: Response,
  ) {
    // Проверяем доступ к проекту
    await this.projectsService.findById(id, req.user.userId);

    const photo = await this.photosService.getPhotoById(photoId);
    
    // Если есть превью — отдаём его, иначе оригинал
    if (photo.thumbnailName) {
      const thumbnailPath = this.photosService.getThumbnailPath(photo.thumbnailName);
      if (existsSync(thumbnailPath)) {
        return res.sendFile(thumbnailPath);
      }
    }

    // Fallback на оригинал
    const filePath = this.photosService.getOriginalPath(id, photo.filename);
    if (!existsSync(filePath)) {
      throw new NotFoundException('Файл не найден');
    }

    res.sendFile(filePath);
  }

  // ============ ГЕНЕРАЦИЯ ФОТОАЛЬБОМА ============

  // Сгенерировать фотоальбом в PPTX
  @Post(':id/generate-album')
  async generateAlbum(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: GenerateAlbumDto,
    @Res() res: Response,
  ) {
    // Проверяем доступ к проекту
    await this.projectsService.findById(id, req.user.userId);

    const { buffer, filename } = await this.presentationService.generatePhotoAlbum(
      id,
      dto.crewMembers,
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }
}

