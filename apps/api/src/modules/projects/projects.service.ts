import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { AiService, ServiceMatch } from '../ai/ai.service';
import { WordParserService, SamplingLayer } from './word-parser.service';
import { SamplesService } from './samples.service';
import { WeatherService } from '../weather/weather.service';
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
    private weatherService: WeatherService,
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
      coordinates: tzData?.extractedData?.coordinates || orderData?.extractedData?.coordinates || null,
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

    // Извлекаем название заказчика через AI из ТЗ (приоритет у ТЗ)
    let clientName = extractedData.clientName || '';
    if (tzData?.rawText) {
      try {
        const aiClientName = await this.aiService.extractClientName(tzData.rawText);
        if (aiClientName && (!clientName || aiClientName.length > clientName.length)) {
          clientName = aiClientName;
        }
      } catch (err) {
        console.error('Error extracting client name:', err);
      }
    }

    // Извлекаем адрес заказчика через AI из ТЗ
    let clientAddress = '';
    if (tzData?.rawText) {
      try {
        clientAddress = await this.aiService.extractClientAddress(tzData.rawText);
      } catch (err) {
        console.error('Error extracting client address:', err);
      }
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
    // ВАЖНО: не перетираем данные пустыми значениями при ошибках AI (402 и т.д.)
    const updateData: Record<string, unknown> = {
      objectPurpose,
      documentNumber,
      samplingLayers: samplingLayers as unknown as object,
      platformCount,
      microbiologyCount,
      processedAt: new Date(),
      status: 'ACTIVE',
    };

    // objectName: не перетираем пустым/хуже текущего
    {
      const next = String(extractedData.objectName || '').trim();
      const current = String(project.objectName || '').trim();
      if (next && (!current || next.length >= current.length)) {
        updateData.objectName = next;
      }
    }

    // objectAddress: обновляем только если нашли непустой адрес и он не хуже текущего
    const nextAddress = String(objectAddress || '').trim();
    const currentAddress = String(project.objectAddress || '').trim();
    if (nextAddress && (!currentAddress || nextAddress.length >= currentAddress.length)) {
      updateData.objectAddress = nextAddress;
    }

    // clientName/clientAddress: обновляем только если непустые (приоритет у данных из ТЗ)
    const nextClientName = String(clientName || '').trim();
    if (nextClientName) updateData.clientName = nextClientName;
    const nextClientAddress = String(clientAddress || '').trim();
    if (nextClientAddress) updateData.clientAddress = nextClientAddress;

    // services: не затираем существующие при пустом результате
    if (Array.isArray(services) && services.length > 0) {
      updateData.services = services as unknown as object;
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });

    // Сохраняем координаты из ТЗ в ProgramIei (для ссылки на Яндекс.Карты), если они ещё не сохранены
    if (extractedData.coordinates?.lat && extractedData.coordinates?.lon) {
      try {
        const current = await this.prisma.programIei.findUnique({ where: { projectId } });
        if (!current) {
          await this.prisma.programIei.create({
            data: {
              projectId,
              coordinatesLat: extractedData.coordinates.lat,
              coordinatesLon: extractedData.coordinates.lon,
            },
          });
        } else if (!current.coordinatesLat || !current.coordinatesLon) {
          await this.prisma.programIei.update({
            where: { projectId },
            data: {
              coordinatesLat: extractedData.coordinates.lat,
              coordinatesLon: extractedData.coordinates.lon,
            },
          });
        }
      } catch (err) {
        console.error('Error saving ProgramIei coordinates:', err);
      }
    }

    // Определяем наличие микробиологии по услугам (row 22 — микробиология)
    const hasMicrobiology = services.some(
      (s) => s.row === 22 || s.name?.toLowerCase().includes('микробиолог')
    );

    // Определяем наличие энтомологии по услугам (row 23 — энтомология)
    const hasEntomology = services.some(
      (s) => s.row === 23 || s.name?.toLowerCase().includes('мух') || s.name?.toLowerCase().includes('энтомолог')
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
          hasEntomology,
          sedimentCount,
          sedimentLayers,
          waterCount,
          waterLayers,
        });
        console.log(`Generated samples for project ${projectId}, microbiology: ${hasMicrobiology}, entomology: ${hasEntomology}, sediment: ${sedimentCount}, water: ${waterCount}`);
      } catch (err) {
        console.error('Error generating samples:', err);
      }
    }
  }

  /**
   * Извлекает полный номер документа из текста (например 801-110-25)
   */
  private extractDocumentNumber(text: string, numbers: string[]): string {
    const patterns = [
      /\b(\d{3}-\d{2,4}-\d{2})\b/g,
      /№\s*(\d{3}-\d{2,4}-\d{2})/gi,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          return match[1]; // Возвращаем полный номер (801-110-25)
        }
      }
    }

    for (const num of numbers) {
      const match = num.match(/(\d{3}-\d{2,4}-\d{2})/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Если не найден — генерируем с текущим годом
    const year = new Date().getFullYear().toString().slice(-2);
    return `801-${Math.floor(Math.random() * 900) + 100}-${year}`;
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
        parentProject: {
          select: {
            id: true,
            name: true,
            tzFileName: true,
            tzFileUrl: true,
            objectName: true,
            objectAddress: true,
            objectPurpose: true,
            clientName: true,
            clientAddress: true,
          },
        },
        childProjects: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    if (project.companyId !== membership.companyId) {
      throw new ForbiddenException('Нет доступа к этому проекту');
    }

    // Если это дочерний проект (доотбор) — мержим данные из ТЗ родителя
    let mergedProject = { ...project };
    if (project.parentProjectId && project.parentProject) {
      const parent = project.parentProject;
      mergedProject = {
        ...project,
        // ТЗ берём от родителя
        tzFileName: parent.tzFileName,
        tzFileUrl: parent.tzFileUrl,
        // Данные из ТЗ берём от родителя (если свои не заполнены)
        objectName: project.objectName || parent.objectName,
        objectAddress: project.objectAddress || parent.objectAddress,
        objectPurpose: project.objectPurpose || parent.objectPurpose,
        clientName: project.clientName || parent.clientName,
        clientAddress: project.clientAddress || parent.clientAddress,
      };
    }

    return {
      ...mergedProject,
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

  /**
   * Перегенерация данных проекта из обновленного ТЗ
   * ВАЖНО: не трогает пробы (samples), только обновляет метаданные проекта
   */
  async regenerateFromTz(
    id: string,
    tzFile: Express.Multer.File,
    userId: string,
  ) {
    const project = await this.findById(id, userId);

    if (!project.canEdit) {
      throw new ForbiddenException('Нет прав на редактирование проекта');
    }

    // Удаляем старый файл ТЗ если есть
    if (project.tzFileUrl) {
      await this.deleteFile(project.tzFileUrl);
    }

    // Обновляем файл ТЗ в БД
    await this.prisma.project.update({
      where: { id },
      data: {
        tzFileName: tzFile.originalname,
        tzFileUrl: tzFile.filename,
      },
    });

    // Запускаем обработку ТОЛЬКО ТЗ, без генерации проб
    await this.processDocumentsFromTzOnly(id);

    return this.findById(id, userId);
  }

  /**
   * Обрабатывает ТОЛЬКО ТЗ для обновления метаданных проекта
   * НЕ трогает пробы и данные из поручения
   */
  private async processDocumentsFromTzOnly(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || !project.tzFileUrl) return;

    let tzData = null;
    let tzText = '';

    // Парсим только ТЗ
    try {
      tzData = await this.wordParser.parseDocument(project.tzFileUrl);
      tzText = tzData.rawText;
    } catch (err) {
      console.error('Error parsing TZ:', err);
      return;
    }

    if (!tzText) return;

    // Извлекаем данные из ТЗ
    const extractedData = {
      objectName: tzData?.extractedData?.objectName || '',
      address: tzData?.extractedData?.address || '',
      clientName: tzData?.extractedData?.clientName || '',
      coordinates: tzData?.extractedData?.coordinates || null,
    };

    // Извлекаем адрес через AI (приоритет у ТЗ)
    let objectAddress = extractedData.address || '';
    try {
      const aiAddress = await this.aiService.extractObjectAddress(
        extractedData.objectName,
        tzText,
      );
      if (aiAddress && (!objectAddress || aiAddress.length > objectAddress.length)) {
        objectAddress = aiAddress;
      }
    } catch (err) {
      console.error('Error extracting address:', err);
    }

    // Извлекаем название заказчика через AI из ТЗ
    let clientName = extractedData.clientName || '';
    try {
      const aiClientName = await this.aiService.extractClientName(tzText);
      if (aiClientName && (!clientName || aiClientName.length > clientName.length)) {
        clientName = aiClientName;
      }
    } catch (err) {
      console.error('Error extracting client name:', err);
    }

    // Извлекаем адрес заказчика через AI
    let clientAddress = '';
    try {
      clientAddress = await this.aiService.extractClientAddress(tzText);
    } catch (err) {
      console.error('Error extracting client address:', err);
    }

    // Определяем назначение объекта через AI
    let objectPurpose = project.objectPurpose || 'Территория участков под строительство';
    try {
      objectPurpose = await this.aiService.determineObjectPurpose(
        extractedData.objectName,
        objectAddress,
      );
    } catch (err) {
      console.error('Error determining purpose:', err);
    }

    // Подготавливаем данные для обновления
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      processedAt: new Date(),
    };

    // objectName: берём из ТЗ (приоритет при перегенерации)
    const nextObjectName = String(extractedData.objectName || '').trim();
    if (nextObjectName) {
      updateData.objectName = nextObjectName;
    }

    // objectAddress: обновляем если нашли
    const nextAddress = String(objectAddress || '').trim();
    if (nextAddress) {
      updateData.objectAddress = nextAddress;
    }

    // clientName/clientAddress: обновляем только если непустые (данные из ТЗ через AI)
    const nextClientName = String(clientName || '').trim();
    if (nextClientName) updateData.clientName = nextClientName;
    const nextClientAddress = String(clientAddress || '').trim();
    if (nextClientAddress) updateData.clientAddress = nextClientAddress;

    // objectPurpose
    if (objectPurpose) {
      updateData.objectPurpose = objectPurpose;
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });

    // Обновляем координаты в ProgramIei если есть
    if (extractedData.coordinates?.lat && extractedData.coordinates?.lon) {
      try {
        const current = await this.prisma.programIei.findUnique({ where: { projectId } });
        if (!current) {
          await this.prisma.programIei.create({
            data: {
              projectId,
              coordinatesLat: extractedData.coordinates.lat,
              coordinatesLon: extractedData.coordinates.lon,
            },
          });
        } else {
          await this.prisma.programIei.update({
            where: { projectId },
            data: {
              coordinatesLat: extractedData.coordinates.lat,
              coordinatesLon: extractedData.coordinates.lon,
            },
          });
        }
      } catch (err) {
        console.error('Error saving ProgramIei coordinates:', err);
      }
    }

    console.log(`[regenerateFromTz] Updated project ${projectId} from TZ only`);
  }

  /**
   * Создаёт дочерний проект (доотбор) на основе родительского
   * Наследует ТЗ от родителя, но имеет своё поручение и свои пробы
   */
  async createChildProject(
    parentId: string,
    name: string,
    orderFile: Express.Multer.File,
    userId: string,
  ) {
    const parentProject = await this.findById(parentId, userId);

    // Нельзя создать доотбор от доотбора — только от корневого проекта
    if (parentProject.parentProjectId) {
      throw new ForbiddenException('Нельзя создать доотбор от доотбора. Создайте доотбор от основного объекта.');
    }

    // Создаём дочерний проект
    const childProject = await this.prisma.project.create({
      data: {
        name,
        companyId: parentProject.companyId,
        createdById: userId,
        parentProjectId: parentId,
        // ТЗ не копируем — будем читать от родителя
        tzFileName: null,
        tzFileUrl: null,
        // Поручение — своё
        orderFileName: orderFile.originalname,
        orderFileUrl: orderFile.filename,
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

    // Запускаем обработку поручения в фоне (только поручение, не ТЗ)
    this.processChildProjectDocuments(childProject.id, parentId).catch((err) => {
      console.error('Error processing child project documents:', err);
    });

    return childProject;
  }

  /**
   * Обрабатывает документы дочернего проекта (только поручение)
   * ТЗ берётся от родителя
   */
  private async processChildProjectDocuments(childProjectId: string, parentProjectId: string): Promise<void> {
    const childProject = await this.prisma.project.findUnique({
      where: { id: childProjectId },
    });

    const parentProject = await this.prisma.project.findUnique({
      where: { id: parentProjectId },
    });

    if (!childProject || !parentProject) return;

    let orderData = null;
    let combinedText = '';

    // Парсим ТЗ родителя (для извлечения общих данных)
    if (parentProject.tzFileUrl) {
      try {
        const tzData = await this.wordParser.parseDocument(parentProject.tzFileUrl);
        combinedText += tzData.rawText + '\n\n';
      } catch (err) {
        console.error('Error parsing parent TZ:', err);
      }
    }

    // Парсим поручение дочернего проекта
    if (childProject.orderFileUrl) {
      try {
        orderData = await this.wordParser.parseDocument(childProject.orderFileUrl);
        combinedText += orderData.rawText;
      } catch (err) {
        console.error('Error parsing child order:', err);
      }
    }

    if (!orderData) return;

    // Извлекаем номер документа из поручения
    const extractedNumbers = orderData?.extractedData?.numbers || [];
    const documentNumber = this.extractDocumentNumber(combinedText, extractedNumbers);

    // Сопоставляем услуги через AI (из поручения)
    let services: ServiceMatch[] = [];
    try {
      services = await this.aiService.matchServicesFromOrder(orderData.rawText);
    } catch (err) {
      console.error('Error matching services:', err);
    }

    // Извлекаем данные для проб из распарсенных таблиц поручения
    const samplingData = orderData?.extractedData?.samplingData;
    const samplingLayers: SamplingLayer[] = samplingData?.soilLayers || orderData?.extractedData?.samplingLayers || [];
    const microbiologyCount = orderData?.extractedData?.microbiologyCount || 0;
    const platformCount = microbiologyCount || samplingLayers[0]?.count || 3;

    // Определяем количество донок и воды
    let sedimentCount = samplingData?.sedimentCount || 0;
    let waterCount = samplingData?.waterCount || 0;

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

    // Обновляем дочерний проект (данные из поручения)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      documentNumber,
      samplingLayers: samplingLayers as unknown as object,
      platformCount,
      microbiologyCount,
      processedAt: new Date(),
      status: 'ACTIVE',
    };

    if (Array.isArray(services) && services.length > 0) {
      updateData.services = services as unknown as object;
    }

    await this.prisma.project.update({
      where: { id: childProjectId },
      data: updateData,
    });

    // Определяем наличие микробиологии и энтомологии
    const hasMicrobiology = services.some(
      (s) => s.row === 22 || s.name?.toLowerCase().includes('микробиолог')
    );
    const hasEntomology = services.some(
      (s) => s.row === 23 || s.name?.toLowerCase().includes('мух') || s.name?.toLowerCase().includes('энтомолог')
    );

    const sedimentLayers = samplingData?.sedimentLayers || [];
    const waterLayers = samplingData?.waterLayers || [];

    console.log(`[createChildProject] Parsed child sampling data: soil layers=${samplingLayers.length}, sediment=${sedimentCount}, water=${waterCount}`);

    // Генерируем пробы для дочернего проекта
    const shouldGenerate = (samplingLayers.length > 0 && platformCount > 0) || sedimentCount > 0 || waterCount > 0;
    
    if (shouldGenerate) {
      try {
        await this.samplesService.generateSamplesForProject({
          projectId: childProjectId,
          samplingLayers,
          platformCount,
          hasMicrobiology,
          hasEntomology,
          sedimentCount,
          sedimentLayers,
          waterCount,
          waterLayers,
        });
        console.log(`[createChildProject] Generated samples for child project ${childProjectId}`);
      } catch (err) {
        console.error('Error generating samples for child project:', err);
      }
    }
  }

  /**
   * Получает список дочерних проектов (доотборов) для родительского проекта
   */
  async getChildProjects(parentId: string, userId: string) {
    await this.findById(parentId, userId); // Проверка доступа

    return this.prisma.project.findMany({
      where: { parentProjectId: parentId },
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Устанавливает даты документов и получает метеоданные для даты отбора
   */
  async setDocumentDates(
    id: string, 
    dates: { ilcRequestDate?: Date; fmbaRequestDate?: Date; samplingDate?: Date },
    userId: string,
  ) {
    const project = await this.findById(id, userId);

    if (!project.canEdit) {
      throw new ForbiddenException('Нет прав на редактирование проекта');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if (dates.ilcRequestDate !== undefined) {
      updateData.ilcRequestDate = dates.ilcRequestDate;
    }
    if (dates.fmbaRequestDate !== undefined) {
      updateData.fmbaRequestDate = dates.fmbaRequestDate;
    }
    if (dates.samplingDate !== undefined) {
      updateData.samplingDate = dates.samplingDate;
      
      // Сбрасываем метеоданные при изменении даты отбора (будут перезапрошены при генерации)
      updateData.weatherTemperature = null;
      updateData.weatherWind = null;
      updateData.weatherPressure = null;
      updateData.weatherHumidity = null;
      updateData.weatherSnowDepth = null;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.project.update({
        where: { id },
        data: updateData,
      });
    }

    return this.findById(id, userId);
  }

  /**
   * Обновляет метеоданные для проекта (перезапрос)
   */
  async refreshWeather(id: string, userId: string) {
    const project = await this.findById(id, userId);

    if (!project.canEdit) {
      throw new ForbiddenException('Нет прав на редактирование проекта');
    }

    // Берём дату из проекта или завтра
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectData = await this.prisma.project.findUnique({ where: { id } }) as any;
    const date = projectData?.samplingDate || new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (!project.objectAddress) {
      throw new ForbiddenException('Адрес объекта не указан');
    }

    const weather = await this.weatherService.getWeatherByAddress(project.objectAddress, date);

    if (!weather) {
      throw new NotFoundException('Не удалось получить метеоданные');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.prisma.project.update({
      where: { id },
      data: {
        samplingDate: date,
        weatherTemperature: weather.temperature,
        weatherWind: weather.wind,
        weatherPressure: weather.pressure,
        weatherHumidity: weather.humidity,
        weatherSnowDepth: weather.snowDepth,
      } as any,
    });

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
