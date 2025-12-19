import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTechnicalTaskDto, UpdateTechnicalTaskDto } from './dto/technical-task.dto';
import { TzProcessingService } from './tz-processing.service';
import { TzGeneratorService } from './tz-generator.service';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync } from 'fs';
import * as mammoth from 'mammoth';
import * as htmlDocx from 'html-docx-js';

// process.cwd() уже указывает на apps/api при запуске через bun workspaces
const API_ROOT = process.cwd();

// Декодирование имени файла из latin1 в UTF-8 (Multer проблема)
function decodeFileName(filename: string): string {
  try {
    // Пробуем декодировать из latin1 в UTF-8
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch {
    return filename;
  }
}

@Injectable()
export class TechnicalTasksService {
  private readonly logger = new Logger(TechnicalTasksService.name);
  private readonly uploadsDir = join(API_ROOT, 'uploads', 'technical-tasks');

  constructor(
    private prisma: PrismaService,
    private tzProcessingService: TzProcessingService,
    private tzGeneratorService: TzGeneratorService,
  ) {
    // Создаём директорию для загрузок если её нет
    this.ensureUploadsDir();
  }

  private async ensureUploadsDir() {
    if (!existsSync(this.uploadsDir)) {
      await mkdir(this.uploadsDir, { recursive: true });
    }
  }

  async create(
    dto: CreateTechnicalTaskDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    // Получаем компанию пользователя
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId },
    });

    if (!membership) {
      throw new ForbiddenException('Вы не состоите в компании');
    }

    // Сохраняем файл если загружен
    let sourceFileName: string | null = null;
    let sourceFileUrl: string | null = null;
    let sourceFileType: string | null = null;

    if (file) {
      const decodedName = decodeFileName(file.originalname);
      const ext = extname(decodedName).toLowerCase();
      const uniqueName = `${uuidv4()}${ext}`;
      const filePath = join(this.uploadsDir, uniqueName);
      
      await writeFile(filePath, file.buffer);
      
      sourceFileName = decodedName;
      sourceFileUrl = `technical-tasks/${uniqueName}`;
      sourceFileType = ext === '.pdf' ? 'pdf' : 'docx';
    }

    // Создаём ТЗ
    const technicalTask = await this.prisma.technicalTask.create({
      data: {
        name: dto.name,
        companyId: membership.companyId,
        createdById: userId,
        sourceFileName,
        sourceFileUrl,
        sourceFileType,
        status: file ? 'PROCESSING' : 'DRAFT',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Запускаем AI обработку файла в фоне (без await)
    if (file && sourceFileUrl) {
      this.processInBackground(technicalTask.id, sourceFileUrl).catch((error) => {
        this.logger.error(`Background processing failed for TZ ${technicalTask.id}:`, error);
      });
    }

    return technicalTask;
  }

  /**
   * Фоновая обработка ТЗ: извлечение данных и генерация документа
   */
  private async processInBackground(tzId: string, sourceFileUrl: string): Promise<void> {
    try {
      this.logger.log(`Starting background processing for TZ ${tzId}`);

      // 1. Извлекаем данные из документа через AI
      const extractedData = await this.tzProcessingService.processTechnicalTask(sourceFileUrl);
      this.logger.log(`Extracted data for TZ ${tzId}: ${extractedData.objectName}`);

      // 2. Генерируем документ в нашем формате
      const generatedFileName = `ЗИИ_${Date.now()}.docx`;
      const generatedFileUrl = await this.tzGeneratorService.generateDocument(
        extractedData,
        generatedFileName,
      );
      this.logger.log(`Generated document for TZ ${tzId}: ${generatedFileUrl}`);

      // 3. Обновляем запись в БД
      await this.prisma.technicalTask.update({
        where: { id: tzId },
        data: {
          extractedData: extractedData as any,
          generatedFileName,
          generatedFileUrl,
          generatedAt: new Date(),
          status: 'COMPLETED',
        },
      });

      this.logger.log(`TZ ${tzId} processing completed successfully`);
    } catch (error) {
      this.logger.error(`Error processing TZ ${tzId}:`, error);

      // Обновляем статус на ошибку
      await this.prisma.technicalTask.update({
        where: { id: tzId },
        data: {
          status: 'ERROR',
        },
      });

      throw error;
    }
  }

  /**
   * Повторная обработка ТЗ (ручной запуск)
   */
  async reprocess(id: string, userId: string) {
    const technicalTask = await this.findById(id, userId);

    if (!technicalTask.sourceFileUrl) {
      throw new NotFoundException('Исходный файл не найден');
    }

    // Устанавливаем статус обработки
    await this.prisma.technicalTask.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });

    // Запускаем обработку
    this.processInBackground(id, technicalTask.sourceFileUrl).catch((error) => {
      this.logger.error(`Reprocessing failed for TZ ${id}:`, error);
    });

    return { message: 'Обработка запущена' };
  }

  async findAll(userId: string) {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId },
    });

    if (!membership) {
      throw new ForbiddenException('Вы не состоите в компании');
    }

    return this.prisma.technicalTask.findMany({
      where: { companyId: membership.companyId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string) {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId },
    });

    if (!membership) {
      throw new ForbiddenException('Вы не состоите в компании');
    }

    const technicalTask = await this.prisma.technicalTask.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!technicalTask) {
      throw new NotFoundException('ТЗ не найдено');
    }

    if (technicalTask.companyId !== membership.companyId) {
      throw new ForbiddenException('Нет доступа к этому ТЗ');
    }

    return {
      ...technicalTask,
      canEdit: technicalTask.createdById === userId || ['OWNER', 'ADMIN'].includes(membership.role),
      canDelete: ['OWNER', 'ADMIN'].includes(membership.role),
    };
  }

  async update(
    id: string,
    dto: UpdateTechnicalTaskDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    const technicalTask = await this.findById(id, userId);

    if (!technicalTask.canEdit) {
      throw new ForbiddenException('Нет прав на редактирование ТЗ');
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name) {
      updateData.name = dto.name;
    }

    if (dto.extractedData) {
      updateData.extractedData = dto.extractedData;
    }

    // Если загружен новый файл
    if (file) {
      // Удаляем старый файл
      if (technicalTask.sourceFileUrl) {
        await this.deleteFile(technicalTask.sourceFileUrl);
      }

      const decodedName = decodeFileName(file.originalname);
      const ext = extname(decodedName).toLowerCase();
      const uniqueName = `${uuidv4()}${ext}`;
      const filePath = join(this.uploadsDir, uniqueName);
      
      await writeFile(filePath, file.buffer);

      updateData.sourceFileName = decodedName;
      updateData.sourceFileUrl = `technical-tasks/${uniqueName}`;
      updateData.sourceFileType = ext === '.pdf' ? 'pdf' : 'docx';
      updateData.status = 'PROCESSING';

      // TODO: Запустить AI обработку нового файла
    }

    return this.prisma.technicalTask.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async delete(id: string, userId: string) {
    const technicalTask = await this.findById(id, userId);

    // Удаляем файлы
    if (technicalTask.sourceFileUrl) {
      await this.deleteFile(technicalTask.sourceFileUrl);
    }
    if (technicalTask.generatedFileUrl) {
      await this.deleteFile(technicalTask.generatedFileUrl);
    }

    await this.prisma.technicalTask.delete({
      where: { id },
    });

    return { success: true };
  }

  async getFilePath(id: string, fileType: 'source' | 'generated', userId: string) {
    const technicalTask = await this.findById(id, userId);

    const fileUrl = fileType === 'source' 
      ? technicalTask.sourceFileUrl 
      : technicalTask.generatedFileUrl;
    const fileName = fileType === 'source' 
      ? technicalTask.sourceFileName 
      : technicalTask.generatedFileName;

    if (!fileUrl) {
      throw new NotFoundException('Файл не найден');
    }

    return {
      path: join(API_ROOT, 'uploads', fileUrl),
      fileName,
    };
  }

  private async deleteFile(fileUrl: string) {
    try {
      const filePath = join(API_ROOT, 'uploads', fileUrl);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch {
      // Игнорируем ошибки удаления
    }
  }

  /**
   * Получить HTML содержимое документа для редактирования
   */
  async getDocumentHtml(id: string, userId: string): Promise<{ html: string }> {
    const technicalTask = await this.findById(id, userId);

    if (!technicalTask.generatedFileUrl) {
      throw new NotFoundException('Сгенерированный документ не найден');
    }

    const filePath = join(API_ROOT, 'uploads', technicalTask.generatedFileUrl);
    
    this.logger.log(`Looking for file at: ${filePath}`);
    this.logger.log(`API_ROOT: ${API_ROOT}`);
    this.logger.log(`generatedFileUrl: ${technicalTask.generatedFileUrl}`);
    
    if (!existsSync(filePath)) {
      this.logger.error(`File not found at: ${filePath}`);
      throw new NotFoundException(`Файл документа не найден: ${filePath}`);
    }

    try {
      const buffer = await readFile(filePath);
      const result = await mammoth.convertToHtml({ buffer });
      
      // Добавляем базовые стили для отображения
      const styledHtml = `
        <div style="font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.6;">
          ${result.value}
        </div>
      `;
      
      return { html: styledHtml };
    } catch (error) {
      this.logger.error(`Error converting DOCX to HTML for TZ ${id}:`, error);
      throw new Error('Не удалось конвертировать документ в HTML');
    }
  }

  /**
   * Сохранить изменённый HTML документа обратно в DOCX
   */
  async saveDocumentHtml(id: string, html: string, userId: string): Promise<{ message: string }> {
    const technicalTask = await this.findById(id, userId);

    if (!technicalTask.canEdit) {
      throw new ForbiddenException('Нет прав на редактирование ТЗ');
    }

    if (!technicalTask.generatedFileUrl) {
      throw new NotFoundException('Сгенерированный документ не найден');
    }

    try {
      // Конвертируем HTML в DOCX
      const docxContent = htmlDocx.asBlob(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 14pt;
              line-height: 1.5;
            }
            h1 { font-size: 18pt; font-weight: bold; }
            h2 { font-size: 16pt; font-weight: bold; }
            h3 { font-size: 14pt; font-weight: bold; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid black; padding: 8px; }
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `);

      // Сохраняем файл
      const filePath = join(API_ROOT, 'uploads', technicalTask.generatedFileUrl);
      // html-docx-js возвращает Buffer в Node.js или Blob в браузере
      const buffer = Buffer.isBuffer(docxContent) 
        ? docxContent 
        : Buffer.from(await (docxContent as Blob).arrayBuffer());
      await writeFile(filePath, buffer);

      // Обновляем время изменения
      await this.prisma.technicalTask.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      return { message: 'Документ успешно сохранён' };
    } catch (error) {
      this.logger.error(`Error saving HTML to DOCX for TZ ${id}:`, error);
      throw new Error('Не удалось сохранить документ');
    }
  }
}
