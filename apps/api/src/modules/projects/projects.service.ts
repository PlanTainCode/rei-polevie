import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { AiService, ServiceMatch } from '../ai/ai.service';
import { WordParserService, SamplingLayer } from './word-parser.service';
import { SamplesService } from './samples.service';
import { CreateProjectDto } from './dto/project.dto';
import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private companiesService: CompaniesService,
    private aiService: AiService,
    private wordParser: WordParserService,
    private samplesService: SamplesService,
  ) {}

  async create(
    dto: CreateProjectDto,
    files: { tz?: Express.Multer.File[]; order?: Express.Multer.File[] },
    userId: string,
  ) {
    // Получаем компанию пользователя
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId },
    });

    if (!membership) {
      throw new ForbiddenException('Вы не состоите в компании');
    }

    const tzFile = files.tz?.[0];
    const orderFile = files.order?.[0];

    // Создаём проект
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        companyId: membership.companyId,
        createdById: userId,
        tzFileName: tzFile?.originalname,
        tzFileUrl: tzFile?.filename,
        orderFileName: orderFile?.originalname,
        orderFileUrl: orderFile?.filename,
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

    // Запускаем обработку документов в фоне (не ждём)
    if (tzFile || orderFile) {
      this.processDocuments(project.id).catch((err) => {
        console.error('Error processing documents:', err);
      });
    }

    return project;
  }

  /**
   * Обрабатывает документы проекта через AI и сохраняет результаты
   */
  async processDocuments(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) return;

    let tzData = null;
    let orderData = null;
    let combinedText = '';

    // Парсим документы
    if (project.tzFileUrl) {
      try {
        tzData = await this.wordParser.parseDocument(project.tzFileUrl);
        combinedText += tzData.rawText + '\n\n';
      } catch (err) {
        console.error('Error parsing TZ:', err);
      }
    }

    if (project.orderFileUrl) {
      try {
        orderData = await this.wordParser.parseDocument(project.orderFileUrl);
        combinedText += orderData.rawText;
      } catch (err) {
        console.error('Error parsing order:', err);
      }
    }

    if (!combinedText) return;

    // Извлекаем данные
    const extractedData = {
      objectName: tzData?.extractedData?.objectName || orderData?.extractedData?.objectName || project.name,
      address: tzData?.extractedData?.address || orderData?.extractedData?.address || '',
      clientName: tzData?.extractedData?.clientName || orderData?.extractedData?.clientName || '',
      numbers: [
        ...(tzData?.extractedData?.numbers || []),
        ...(orderData?.extractedData?.numbers || []),
      ],
    };

    // Извлекаем номер документа
    const documentNumber = this.extractDocumentNumber(combinedText, extractedData.numbers);

    // Извлекаем адрес через AI (если не найден парсером или неполный)
    let objectAddress = extractedData.address || '';
    try {
      const aiAddress = await this.aiService.extractObjectAddress(
        extractedData.objectName,
        combinedText,
      );
      // Используем AI адрес если он найден и более информативный
      if (aiAddress && (!objectAddress || aiAddress.length > objectAddress.length)) {
        objectAddress = aiAddress;
      }
    } catch (err) {
      console.error('Error extracting address:', err);
    }

    // Извлекаем адрес заказчика через AI
    let clientAddress = '';
    try {
      clientAddress = await this.aiService.extractClientAddress(combinedText);
    } catch (err) {
      console.error('Error extracting client address:', err);
    }

    // Определяем назначение объекта через AI
    let objectPurpose = 'Территория участков под строительство';
    try {
      objectPurpose = await this.aiService.determineObjectPurpose(
        extractedData.objectName,
        objectAddress,
      );
    } catch (err) {
      console.error('Error determining purpose:', err);
    }

    // Сопоставляем услуги через AI
    let services: ServiceMatch[] = [];
    try {
      services = await this.aiService.matchServicesFromOrder(combinedText);
    } catch (err) {
      console.error('Error matching services:', err);
    }

    // Извлекаем данные для проб из распарсенных таблиц
    const samplingData = orderData?.extractedData?.samplingData;
    const samplingLayers: SamplingLayer[] = samplingData?.soilLayers || orderData?.extractedData?.samplingLayers || [];
    const microbiologyCount = orderData?.extractedData?.microbiologyCount || 0;
    
    // Количество площадок = кол-во микробиологических проб или кол-во проб первого слоя
    const platformCount = microbiologyCount || samplingLayers[0]?.count || 3;

    // Определяем количество донок и воды из распарсенных таблиц (приоритет)
    // или из сопоставленных услуг (резерв)
    let sedimentCount = samplingData?.sedimentCount || 0;
    let waterCount = samplingData?.waterCount || 0;

    // Если в таблицах не нашли, пробуем определить по услугам
    if (sedimentCount === 0) {
      const sedimentService = services.find(
        (s) => s.row === 29 || s.name?.toLowerCase().includes('донн')
      );
      sedimentCount = sedimentService?.quantity 
        ? (typeof sedimentService.quantity === 'number' ? sedimentService.quantity : parseInt(String(sedimentService.quantity), 10) || 0)
        : 0;
    }

    if (waterCount === 0) {
      const surfaceWaterService = services.find(
        (s) => s.row === 28 || s.name?.toLowerCase().includes('поверхностн')
      );
      const groundWaterService = services.find(
        (s) => s.row === 30 || s.name?.toLowerCase().includes('подземн')
      );
      const surfaceWaterCount = surfaceWaterService?.quantity 
        ? (typeof surfaceWaterService.quantity === 'number' ? surfaceWaterService.quantity : parseInt(String(surfaceWaterService.quantity), 10) || 0)
        : 0;
      const groundWaterCount = groundWaterService?.quantity 
        ? (typeof groundWaterService.quantity === 'number' ? groundWaterService.quantity : parseInt(String(groundWaterService.quantity), 10) || 0)
        : 0;
      waterCount = surfaceWaterCount + groundWaterCount;
    }

    // Сохраняем результаты в БД
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        objectName: extractedData.objectName,
        objectAddress,
        objectPurpose,
        documentNumber,
        clientName: extractedData.clientName,
        clientAddress,
        services: services as unknown as object,
        samplingLayers: samplingLayers as unknown as object,
        platformCount,
        microbiologyCount,
        processedAt: new Date(),
        status: 'ACTIVE',
      },
    });

    // Определяем наличие микробиологии по услугам (row 22 — микробиология)
    const hasMicrobiology = services.some(
      (s) => s.row === 22 || s.name?.toLowerCase().includes('микробиолог')
    );

    // Слои для донок и воды из таблиц
    const sedimentLayers = samplingData?.sedimentLayers || [];
    const waterLayers = samplingData?.waterLayers || [];

    console.log(`Parsed sampling data: soil layers=${samplingLayers.length}, sediment=${sedimentCount} (layers: ${sedimentLayers.length}), water=${waterCount} (layers: ${waterLayers.length})`);

    // Генерируем пробы
    const shouldGenerate = (samplingLayers.length > 0 && platformCount > 0) || sedimentCount > 0 || waterCount > 0;
    
    if (shouldGenerate) {
      try {
        await this.samplesService.generateSamplesForProject({
          projectId,
          samplingLayers,
          platformCount,
          hasMicrobiology,
          sedimentCount,
          sedimentLayers,
          waterCount,
          waterLayers,
        });
        console.log(`Generated samples for project ${projectId}, microbiology: ${hasMicrobiology}, sediment: ${sedimentCount}, water: ${waterCount}`);
      } catch (err) {
        console.error('Error generating samples:', err);
      }
    }
  }

  /**
   * Извлекает номер документа из текста (например 801-110-25 -> 110)
   */
  private extractDocumentNumber(text: string, numbers: string[]): string {
    const patterns = [
      /\b(\d{3})-(\d{2,4})-(\d{2})\b/g,
      /№\s*(\d{3})-(\d{2,4})-(\d{2})/gi,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[2]) {
          return match[2];
        }
      }
    }

    for (const num of numbers) {
      const match = num.match(/(\d{3})-(\d{2,4})-(\d{2})/);
      if (match && match[2]) {
        return match[2];
      }
    }

    return String(Math.floor(Math.random() * 900) + 100);
  }

  async findAll(userId: string) {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId },
    });

    if (!membership) {
      throw new ForbiddenException('Вы не состоите в компании');
    }

    return this.prisma.project.findMany({
      where: { companyId: membership.companyId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            samples: true,
            platforms: true,
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

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        platforms: {
          include: {
            samples: true,
          },
        },
        samples: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    if (project.companyId !== membership.companyId) {
      throw new ForbiddenException('Нет доступа к этому проекту');
    }

    return {
      ...project,
      canEdit: project.createdById === userId || ['OWNER', 'ADMIN'].includes(membership.role),
      canDelete: ['OWNER', 'ADMIN'].includes(membership.role),
    };
  }

  async update(
    id: string,
    dto: Partial<CreateProjectDto>,
    files: { tz?: Express.Multer.File[]; order?: Express.Multer.File[] } | undefined,
    userId: string,
  ) {
    const project = await this.findById(id, userId);

    if (!project.canEdit) {
      throw new ForbiddenException('Нет прав на редактирование проекта');
    }

    const updateData: Record<string, string | null | undefined> = {};

    if (dto.name) {
      updateData.name = dto.name;
    }

    const tzFile = files?.tz?.[0];
    const orderFile = files?.order?.[0];
    let needsReprocessing = false;

    // Если загружен новый файл ТЗ - удаляем старый
    if (tzFile) {
      if (project.tzFileUrl) {
        await this.deleteFile(project.tzFileUrl);
      }
      updateData.tzFileName = tzFile.originalname;
      updateData.tzFileUrl = tzFile.filename;
      needsReprocessing = true;
    }

    // Если загружен новый файл поручения - удаляем старый
    if (orderFile) {
      if (project.orderFileUrl) {
        await this.deleteFile(project.orderFileUrl);
      }
      updateData.orderFileName = orderFile.originalname;
      updateData.orderFileUrl = orderFile.filename;
      needsReprocessing = true;
    }

    const updated = await this.prisma.project.update({
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

    // Перезапускаем обработку если загружены новые файлы
    if (needsReprocessing) {
      this.processDocuments(id).catch((err) => {
        console.error('Error reprocessing documents:', err);
      });
    }

    return updated;
  }

  /**
   * Повторно обрабатывает документы
   */
  async reprocessDocuments(id: string, userId: string) {
    await this.findById(id, userId); // Проверка доступа
    await this.processDocuments(id);
    return this.findById(id, userId);
  }

  async delete(id: string, userId: string) {
    const project = await this.findById(id, userId);

    if (!project.canDelete) {
      throw new ForbiddenException('Нет прав на удаление проекта');
    }

    // Удаляем файлы
    if (project.tzFileUrl) {
      await this.deleteFile(project.tzFileUrl);
    }
    if (project.orderFileUrl) {
      await this.deleteFile(project.orderFileUrl);
    }
    if (project.generatedFileUrl) {
      await this.deleteGeneratedFile(project.generatedFileUrl);
    }

    await this.prisma.project.delete({
      where: { id },
    });

    return { success: true };
  }

  async getFilePath(projectId: string, fileType: 'tz' | 'order', userId: string) {
    const project = await this.findById(projectId, userId);

    const fileUrl = fileType === 'tz' ? project.tzFileUrl : project.orderFileUrl;
    const fileName = fileType === 'tz' ? project.tzFileName : project.orderFileName;

    if (!fileUrl) {
      throw new NotFoundException('Файл не найден');
    }

    return {
      path: join(process.cwd(), 'uploads', fileUrl),
      fileName,
    };
  }

  private async deleteFile(filename: string) {
    try {
      await unlink(join(process.cwd(), 'uploads', filename));
    } catch {
      // Игнорируем ошибки удаления
    }
  }

  private async deleteGeneratedFile(filename: string) {
    try {
      await unlink(join(process.cwd(), 'generated', filename));
    } catch {
      // Игнорируем ошибки удаления
    }
  }
}
