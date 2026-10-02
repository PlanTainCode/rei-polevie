import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, TechnicalTaskSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTechnicalTaskDto, UpdateTechnicalTaskDto } from './dto/technical-task.dto';
import { TzXmlExtractorService } from './tz-xml-extractor.service';
import { parseDesignAssignment } from './design-assignment-parser';
import {
  applyCompanyRequisites,
  buildTzXml,
  crc32Hex,
  createEmptyModel,
  validateModel,
  type AttachedFile,
  type BoundaryImage,
  type CompanyRequisites,
  type TzXmlModel,
  type ValidationIssue,
} from './tz-xml';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync } from 'fs';
import * as mammoth from 'mammoth';
import { convertTzXmlToPdf } from './pdf-preview';

// process.cwd() уже указывает на apps/api при запуске через bun workspaces
const API_ROOT = process.cwd();

const IMAGE_TYPES: Record<string, BoundaryImage['type']> = {
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpeg',
  '.gif': 'gif',
};

// Декодирование имени файла из latin1 в UTF-8 (Multer проблема)
function decodeFileName(filename: string): string {
  try {
    return Buffer.from(filename, 'latin1').toString('utf8');
  } catch {
    return filename;
  }
}

function safeBaseName(name: string): string {
  return basename(name).replace(/[\\/:*?"<>|]/g, '_');
}

@Injectable()
export class TechnicalTasksService {
  private readonly logger = new Logger(TechnicalTasksService.name);
  private readonly uploadsDir = join(API_ROOT, 'uploads', 'technical-tasks');
  private readonly attachmentsDir = join(this.uploadsDir, 'attachments');
  private readonly xmlDir = join(this.uploadsDir, 'xml');
  private readonly xslPath = join(API_ROOT, 'templates', 'тз', 'xml', 'EngineeringSurveysTask-01-00.xsl');

  constructor(
    private prisma: PrismaService,
    private extractor: TzXmlExtractorService,
  ) {
    this.ensureDirs();
  }

  private async ensureDirs() {
    for (const dir of [this.uploadsDir, this.attachmentsDir, this.xmlDir]) {
      if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    }
  }

  private async membership(userId: string) {
    const membership = await this.prisma.companyMember.findFirst({ where: { userId }, include: { company: true } });
    if (!membership) throw new ForbiddenException('Вы не состоите в компании');
    return membership;
  }

  private companyRequisites(company: { requisites: Prisma.JsonValue | null }): CompanyRequisites | null {
    const r = company.requisites as unknown as CompanyRequisites | null;
    return r && typeof r === 'object' && r.organization ? r : null;
  }

  // ---------------------------------------------------------------------------
  // Создание
  // ---------------------------------------------------------------------------

  async create(dto: CreateTechnicalTaskDto, file: Express.Multer.File | undefined, userId: string) {
    const membership = await this.membership(userId);
    const source = (dto.source ?? 'SCRATCH') as TechnicalTaskSource;
    const requisites = this.companyRequisites(membership.company);

    if ((source === 'WORD' || source === 'DESIGN_XML') && !file) {
      throw new BadRequestException('Для этого способа создания нужно загрузить файл');
    }

    let sourceFileName: string | null = null;
    let sourceFileUrl: string | null = null;
    let sourceFileType: string | null = null;
    let xmlData: TzXmlModel | null = null;
    let status: 'DRAFT' | 'PROCESSING' | 'ERROR' = 'DRAFT';
    let processingError: string | null = null;

    if (file) {
      const decodedName = decodeFileName(file.originalname);
      const ext = extname(decodedName).toLowerCase();
      const uniqueName = `${uuidv4()}${ext}`;
      await writeFile(join(this.uploadsDir, uniqueName), file.buffer);
      sourceFileName = decodedName;
      sourceFileUrl = `technical-tasks/${uniqueName}`;
      sourceFileType = ext.replace('.', '') || null;
    }

    if (source === 'SCRATCH') {
      xmlData = applyCompanyRequisites(createEmptyModel(), requisites);
    } else if (source === 'DESIGN_XML') {
      try {
        const parsed = parseDesignAssignment(file!.buffer.toString('utf8'));
        xmlData = applyCompanyRequisites(parsed.model, requisites);
        xmlData.importInfo = { imported: parsed.imported, notes: parsed.notes };
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'Не удалось разобрать XML задания на проектирование');
      }
    } else {
      status = 'PROCESSING';
    }

    const task = await this.prisma.technicalTask.create({
      data: {
        name: dto.name,
        companyId: membership.companyId,
        createdById: userId,
        source,
        sourceFileName,
        sourceFileUrl,
        sourceFileType,
        xmlData: xmlData as unknown as Prisma.InputJsonValue,
        status,
        processingError,
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (source === 'WORD' && sourceFileUrl) {
      this.extractInBackground(task.id, sourceFileUrl, requisites).catch((error) => {
        this.logger.error(`Извлечение данных ТЗ ${task.id} упало:`, error);
      });
    }

    return task;
  }

  /** Фоновое извлечение данных из Word/PDF через ИИ. */
  private async extractInBackground(taskId: string, sourceFileUrl: string, requisites: CompanyRequisites | null): Promise<void> {
    try {
      const { model, imported } = await this.extractor.extractModel(sourceFileUrl);
      const xmlData = applyCompanyRequisites(model, requisites);
      xmlData.importInfo = { imported, notes: [] };
      await this.prisma.technicalTask.update({
        where: { id: taskId },
        data: { xmlData: xmlData as unknown as Prisma.InputJsonValue, status: 'DRAFT', processingError: null },
      });
      this.logger.log(`ТЗ ${taskId}: данные извлечены (${imported.length} полей)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const task = await this.prisma.technicalTask.findUnique({ where: { id: taskId } });
      await this.prisma.technicalTask.update({
        where: { id: taskId },
        data: {
          status: 'ERROR', processingError: message,
          // После ошибки извлечения можно сразу заполнить и сохранить черновик вручную.
          ...(!task?.xmlData ? { xmlData: applyCompanyRequisites(createEmptyModel(), requisites) as unknown as Prisma.InputJsonValue } : {}),
        },
      });
      throw error;
    }
  }

  /** Повторный запуск извлечения из исходного файла (для Word/PDF). */
  async reprocess(id: string, userId: string) {
    const task = await this.findById(id, userId);
    if (!task.sourceFileUrl) throw new NotFoundException('Исходный файл не найден');
    if (task.source !== 'WORD') throw new BadRequestException('Повторная обработка доступна только для ТЗ из Word/PDF');
    const membership = await this.membership(userId);
    await this.prisma.technicalTask.update({ where: { id }, data: { status: 'PROCESSING', processingError: null } });
    this.extractInBackground(id, task.sourceFileUrl, this.companyRequisites(membership.company)).catch((error) => {
      this.logger.error(`Повторное извлечение ТЗ ${id} упало:`, error);
    });
    return { message: 'Обработка запущена' };
  }

  // ---------------------------------------------------------------------------
  // Чтение
  // ---------------------------------------------------------------------------

  async findAll(userId: string) {
    const membership = await this.membership(userId);
    return this.prisma.technicalTask.findMany({
      where: { companyId: membership.companyId },
      select: {
        id: true,
        name: true,
        status: true,
        source: true,
        sourceFileName: true,
        xmlFileName: true,
        xmlGeneratedAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string) {
    const membership = await this.membership(userId);
    const task = await this.prisma.technicalTask.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!task) throw new NotFoundException('ТЗ не найдено');
    if (task.companyId !== membership.companyId) throw new ForbiddenException('Нет доступа к этому ТЗ');

    const xmlData = task.xmlData as unknown as TzXmlModel | null;
    const issues: ValidationIssue[] = xmlData ? validateModel(xmlData) : [];
    return {
      ...task,
      issues,
      canEdit: task.createdById === userId || ['OWNER', 'ADMIN'].includes(membership.role),
      canDelete: ['OWNER', 'ADMIN'].includes(membership.role),
    };
  }

  // ---------------------------------------------------------------------------
  // Изменение
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdateTechnicalTaskDto, userId: string) {
    const task = await this.findById(id, userId);
    if (!task.canEdit) throw new ForbiddenException('Нет прав на редактирование ТЗ');

    const data: Prisma.TechnicalTaskUpdateInput = {};
    if (dto.name) data.name = dto.name;
    if (dto.xmlData) {
      const model = dto.xmlData as unknown as TzXmlModel;
      if (!model.requisites || !model.object || !model.requirements) {
        throw new BadRequestException('Некорректная структура данных задания');
      }
      data.xmlData = model as unknown as Prisma.InputJsonValue;
      // Ошибки обязательных полей относятся к экспорту XML, а не к сохранению черновика.
      // после правок сгенерированный XML устаревает
      if (task.status === 'ERROR' || (task.status === 'COMPLETED' && JSON.stringify(task.xmlData) !== JSON.stringify(model))) {
        data.status = 'DRAFT';
        data.processingError = null;
      }
    }
    await this.prisma.technicalTask.update({ where: { id }, data });
    return this.findById(id, userId);
  }

  async delete(id: string, userId: string) {
    const task = await this.findById(id, userId);
    if (!task.canDelete) throw new ForbiddenException('Нет прав на удаление ТЗ');
    for (const url of [task.sourceFileUrl, task.generatedFileUrl, task.xmlFileUrl]) {
      if (url) await this.deleteFile(url);
    }
    const model = task.xmlData as unknown as TzXmlModel | null;
    if (model) {
      for (const f of this.collectAttachments(model)) await this.deleteFile(f);
    }
    await this.prisma.technicalTask.delete({ where: { id } });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Вложения (файлы документов и изображения границ)
  // ---------------------------------------------------------------------------

  async uploadAttachment(id: string, file: Express.Multer.File, userId: string): Promise<AttachedFile & { imageType?: BoundaryImage['type'] }> {
    const task = await this.findById(id, userId);
    if (!task.canEdit) throw new ForbiddenException('Нет прав на редактирование ТЗ');
    const decodedName = safeBaseName(decodeFileName(file.originalname));
    const ext = extname(decodedName).toLowerCase();
    const format = ext.replace('.', '').slice(0, 4);
    if (!format) throw new BadRequestException('У файла должно быть расширение');
    const uniqueName = `${id}-${uuidv4()}${ext}`;
    await writeFile(join(this.attachmentsDir, uniqueName), file.buffer);
    return {
      fileUrl: `technical-tasks/attachments/${uniqueName}`,
      name: decodedName,
      format,
      checksum: crc32Hex(new Uint8Array(file.buffer)),
      size: file.size,
      imageType: IMAGE_TYPES[ext],
    };
  }

  async getAttachmentPath(id: string, fileName: string, userId: string) {
    await this.findById(id, userId);
    const safe = safeBaseName(fileName);
    if (!safe.startsWith(`${id}-`)) throw new ForbiddenException('Файл не принадлежит этому ТЗ');
    const path = join(this.attachmentsDir, safe);
    if (!existsSync(path)) throw new NotFoundException('Файл не найден');
    return path;
  }

  private collectAttachments(model: TzXmlModel): string[] {
    const urls: string[] = [];
    const docs = [
      ...model.initiationDocuments.documents,
      ...model.availableDocuments.documents,
      ...(model.requirements.archivalMaterials?.documents ?? []),
    ];
    for (const d of docs) for (const f of d.files) if (f.fileUrl) urls.push(f.fileUrl);
    for (const r of model.researchers) for (const f of r.contract.files) if (f.fileUrl) urls.push(f.fileUrl);
    for (const img of model.boundaries.images) if (img.fileUrl) urls.push(img.fileUrl);
    return urls;
  }

  // ---------------------------------------------------------------------------
  // Генерация XML
  // ---------------------------------------------------------------------------

  async generate(id: string, userId: string) {
    const task = await this.findById(id, userId);
    if (!task.canEdit) throw new ForbiddenException('Нет прав на редактирование ТЗ');
    const model = task.xmlData as unknown as TzXmlModel | null;
    if (!model) throw new BadRequestException('Данные задания ещё не заполнены');

    const issues = validateModel(model);
    if (issues.length > 0) {
      throw new BadRequestException({ message: 'Задание заполнено не полностью', issues });
    }

    const images = await this.loadBoundaryImages(model);

    const xml = buildTzXml(model, { images, objectId: `object-${id}` });
    if (task.xmlFileUrl) await this.deleteFile(task.xmlFileUrl);
    const cipher = model.requisites.number.replace(/[\\/:*?"<>|\s]+/g, '_') || 'ЗИИ';
    const xmlFileName = `${cipher}.xml`;
    const uniqueName = `${id}-${Date.now()}.xml`;
    await writeFile(join(this.xmlDir, uniqueName), xml, 'utf8');

    await this.prisma.technicalTask.update({
      where: { id },
      data: { xmlFileName, xmlFileUrl: `technical-tasks/xml/${uniqueName}`, xmlGeneratedAt: new Date(), status: 'COMPLETED', processingError: null },
    });
    return this.findById(id, userId);
  }

  async getXmlPath(id: string, userId: string) {
    const task = await this.findById(id, userId);
    if (!task.xmlFileUrl) throw new NotFoundException('XML ещё не сгенерирован');
    return { path: join(API_ROOT, 'uploads', task.xmlFileUrl), fileName: task.xmlFileName || 'task.xml' };
  }

  getXslPath(): string {
    if (!existsSync(this.xslPath)) throw new NotFoundException('Файл визуализации схемы не найден');
    return this.xslPath;
  }

  private async loadBoundaryImages(model: TzXmlModel): Promise<Record<string, string>> {
    const images: Record<string, string> = {};
    for (const img of model.boundaries.images) {
      const path = join(API_ROOT, 'uploads', img.fileUrl);
      if (!existsSync(path)) throw new BadRequestException(`Файл изображения «${img.name}» не найден, загрузите его заново`);
      images[img.fileUrl] = (await readFile(path)).toString('base64');
    }
    return images;
  }

  /** Просмотр сохранённого черновика, даже если обязательные поля ещё не заполнены. */
  async getPreviewPdf(id: string, userId: string) {
    const task = await this.findById(id, userId);
    const model = task.xmlData as unknown as TzXmlModel | null;
    if (!model) throw new BadRequestException('Данные задания ещё не заполнены');
    const images = await this.loadBoundaryImages(model);
    const xml = buildTzXml(model, { images, objectId: `object-${id}`, preview: true });
    const buffer = await convertTzXmlToPdf(xml, this.getXslPath());
    const fileName = `${safeBaseName(model.requisites.number || task.name || 'ЗИИ')}.pdf`;
    return { buffer, fileName };
  }

  // ---------------------------------------------------------------------------
  // Файлы (исходный и сгенерированный Word прежних записей)
  // ---------------------------------------------------------------------------

  async getFilePath(id: string, fileType: 'source' | 'generated', userId: string) {
    const task = await this.findById(id, userId);
    const fileUrl = fileType === 'source' ? task.sourceFileUrl : task.generatedFileUrl;
    const fileName = fileType === 'source' ? task.sourceFileName : task.generatedFileName;
    if (!fileUrl) throw new NotFoundException('Файл не найден');
    return { path: join(API_ROOT, 'uploads', fileUrl), fileName };
  }

  /** HTML сгенерированного Word (для ТЗ, созданных по старому шаблону). */
  async getDocumentHtml(id: string, userId: string): Promise<{ html: string }> {
    const task = await this.findById(id, userId);
    if (!task.generatedFileUrl) throw new NotFoundException('Сгенерированный документ не найден');
    const filePath = join(API_ROOT, 'uploads', task.generatedFileUrl);
    if (!existsSync(filePath)) throw new NotFoundException('Файл документа не найден');
    const buffer = await readFile(filePath);
    const result = await mammoth.convertToHtml({ buffer });
    return {
      html: `<div style="font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.6;">${result.value}</div>`,
    };
  }

  private async deleteFile(fileUrl: string) {
    try {
      const filePath = join(API_ROOT, 'uploads', fileUrl);
      if (existsSync(filePath)) await unlink(filePath);
    } catch {
      // Игнорируем ошибки удаления
    }
  }
}
