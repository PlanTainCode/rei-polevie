import { Injectable, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { mkdir, writeFile, readFile } from 'fs/promises';
import * as PizZip from 'pizzip';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type InquiryRegion,
  type InquiryRequest,
  type GeneratedInquiryFile,
  type UpdateInquiryRequestDto,
  type GenerateInquiriesResult,
  type InquiryType,
  getInquiriesByRegion,
  detectRegionFromAddress,
} from './inquiry-requests.types';
import { generateCgmsInquiry } from './generators/cgms-generator';
import { generateDpioosInquiry } from './generators/dpioos-generator';
import { generateDknInquiry } from './generators/dkn-generator';
import { generateVetInquiry } from './generators/vet-generator';
import { generateMvkInquiry } from './generators/mvk-generator';
import { generateTradeInquiry } from './generators/trade-generator';
import { generateZhkhInquiry } from './generators/zhkh-generator';
import { generateUpravaInquiry } from './generators/uprava-generator';
import { generateMinprirodaInquiry } from './generators/minprirody-generator';
import { generateGuKnMoInquiry } from './generators/gu-kn-mo-generator';
import { generateMshMoInquiry } from './generators/msh-mo-generator';
import { generateVodokanalInquiry } from './generators/vodokanal-generator';
import { generateMvkMoInquiry } from './generators/mvk-mo-generator';
import { generateAdministrationInquiry } from './generators/administration-generator';
import { generateKlhInquiry } from './generators/klh-generator';
import { generateCgmsMoInquiry } from './generators/cgms-mo-generator';
import { generateMinEcologyInquiry } from './generators/min-ecology-generator';
import { generateMinprirodaMoInquiry } from './generators/minpriroda-mo-generator';

@Injectable()
export class InquiryRequestsService {
  private readonly templateDir = join(process.cwd(), 'templates');
  private readonly outputDir = join(process.cwd(), 'generated', 'inquiries');

  constructor(private prisma: PrismaService) {}

  /**
   * Получить или создать запрос справок для проекта
   */
  async getOrCreate(projectId: string): Promise<InquiryRequest> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        objectAddress: true,
        inquiryRequest: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    // Определяем регион по адресу
    const region = detectRegionFromAddress(project.objectAddress || '');

    // Если запрос уже существует — возвращаем
    if (project.inquiryRequest) {
      return this.mapToDto(project.inquiryRequest);
    }

    // Создаём новый запрос
    const inquiryRequest = await this.prisma.inquiryRequest.create({
      data: {
        projectId,
        region,
        selectedInquiries: [],
      },
    });

    return this.mapToDto(inquiryRequest);
  }

  /**
   * Получить запрос справок
   */
  async get(projectId: string): Promise<InquiryRequest | null> {
    const inquiryRequest = await this.prisma.inquiryRequest.findUnique({
      where: { projectId },
    });

    if (!inquiryRequest) {
      return null;
    }

    return this.mapToDto(inquiryRequest);
  }

  /**
   * Обновить выбранные справки и дополнительные данные
   */
  async update(
    projectId: string,
    dto: UpdateInquiryRequestDto,
  ): Promise<InquiryRequest> {
    // Проверяем существование
    let inquiryRequest = await this.prisma.inquiryRequest.findUnique({
      where: { projectId },
    });

    if (!inquiryRequest) {
      // Создаём если не существует
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { objectAddress: true },
      });

      if (!project) {
        throw new NotFoundException('Проект не найден');
      }

      const region = detectRegionFromAddress(project.objectAddress || '');

      inquiryRequest = await this.prisma.inquiryRequest.create({
        data: {
          projectId,
          region,
          selectedInquiries: dto.selectedInquiries || [],
          additionalData: dto.additionalData || {},
        },
      });

      return this.mapToDto(inquiryRequest);
    }

    // Обновляем
    const updated = await this.prisma.inquiryRequest.update({
      where: { projectId },
      data: {
        ...(dto.selectedInquiries !== undefined && {
          selectedInquiries: dto.selectedInquiries,
        }),
        ...(dto.additionalData !== undefined && {
          additionalData: dto.additionalData,
        }),
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Генерировать выбранные справки
   */
  async generate(
    projectId: string,
    inquiryIds: string[],
  ): Promise<GenerateInquiriesResult> {
    const inquiryRequest = await this.prisma.inquiryRequest.findUnique({
      where: { projectId },
    });

    if (!inquiryRequest) {
      throw new NotFoundException('Запрос справок не найден');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        objectName: true,
        objectAddress: true,
        inquiryAddress: true,
        documentNumber: true,
        clientName: true,
        clientAddress: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    const region = inquiryRequest.region as InquiryRegion;
    const availableInquiries = getInquiriesByRegion(region);
    const additionalData = (inquiryRequest.additionalData as Record<string, string>) || {};

    // Создаём папку для вывода
    await mkdir(this.outputDir, { recursive: true });

    const generatedFiles: GeneratedInquiryFile[] = [];
    const errors: { inquiryId: string; error: string }[] = [];

    // Генерируем каждую справку
    for (const inquiryId of inquiryIds) {
      const inquiry = availableInquiries.find((i) => i.id === inquiryId);
      if (!inquiry) {
        errors.push({ inquiryId, error: 'Справка не найдена для данного региона' });
        continue;
      }

      try {
        const result = await this.generateSingleInquiry(
          inquiry,
          region,
          project,
          additionalData,
        );
        generatedFiles.push(result);
      } catch (error) {
        console.error(`[InquiryRequestsService] Ошибка генерации ${inquiryId}:`, error);
        errors.push({
          inquiryId,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        });
      }
    }

    // Сохраняем информацию о сгенерированных файлах
    const existingFiles = (inquiryRequest.generatedFiles as unknown as GeneratedInquiryFile[]) || [];
    
    // Обновляем или добавляем файлы
    const updatedFiles = [...existingFiles];
    for (const newFile of generatedFiles) {
      const existingIndex = updatedFiles.findIndex(
        (f) => f.inquiryId === newFile.inquiryId,
      );
      if (existingIndex >= 0) {
        updatedFiles[existingIndex] = newFile;
      } else {
        updatedFiles.push(newFile);
      }
    }

    await this.prisma.inquiryRequest.update({
      where: { projectId },
      data: {
        generatedFiles: updatedFiles as unknown as object,
        generatedAt: new Date(),
      },
    });

    return {
      success: errors.length === 0,
      generatedFiles,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Генерирует один документ справки
   */
  private async generateSingleInquiry(
    inquiry: InquiryType,
    region: InquiryRegion,
    project: {
      id: string;
      name: string;
      objectName: string | null;
      objectAddress: string | null;
      inquiryAddress: string | null;
      documentNumber: string | null;
      clientName: string | null;
      clientAddress: string | null;
    },
    additionalData: Record<string, string>,
  ): Promise<GeneratedInquiryFile> {
    // Определяем путь к шаблону
    const templateFolder = region === 'MOSCOW' ? 'запросы мск' : 'запросы мо';
    const templatePath = join(this.templateDir, templateFolder, inquiry.templateFile);

    // Парсим исполнителя (формат: {name, phone})
    let executor: { name: string; phone: string } = { name: '', phone: '' };
    if (additionalData.executor) {
      try {
        const parsed = JSON.parse(additionalData.executor);
        if (parsed && typeof parsed === 'object') {
          executor = parsed;
        }
      } catch {
        executor = { name: additionalData.executor, phone: '' };
      }
    }
    // Передаём одного исполнителя — генераторы сами удалят лишних из шаблона
    const executors = executor.name ? [executor] : [];

    // Форматируем дату
    let formattedDate = this.formatDate(new Date());
    if (additionalData.requestDate) {
      const parts = additionalData.requestDate.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
    }

    // Год (2 цифры)
    const year = new Date().getFullYear().toString().slice(-2);

    // Используем специализированный генератор для ЦГМС (Москва)
    if (inquiry.id === 'CGMS_CLIMATE') {
      const result = await generateCgmsInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        chemicals: additionalData.chemicals || 'диоксид серы, оксид углерода, диоксид азота, взвешенные вещества',
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для ЦГМС (МО)
    if (inquiry.id === 'CGMS_CLIMATE_MO') {
      const result = await generateCgmsMoInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        chemicals: additionalData.chemicals || 'диоксид серы, оксид углерода, диоксид азота, взвешенные вещества',
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для ДПиООС
    if (inquiry.id === 'DPOOS') {
      const result = await generateDpioosInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для ДКН
    if (inquiry.id === 'DKN') {
      const result = await generateDknInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для Комитета ветеринарии
    if (inquiry.id === 'VETERINARY') {
      const result = await generateVetInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для МВК ЗСО
    if (inquiry.id === 'MVK_ZSO') {
      const result = await generateMvkInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для ДепТорговли
    if (inquiry.id === 'DEP_TRADE') {
      const result = await generateTradeInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для Департамента ЖКХ
    if (inquiry.id === 'DEP_GKH') {
      const result = await generateZhkhInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для Управы района
    if (inquiry.id === 'UPRAVA') {
      const result = await generateUpravaInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для МинПрироды РФ
    if (inquiry.id === 'MINPRIRODY') {
      const result = await generateMinprirodaInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для ГУ КН МО (культурное наследие МО)
    if (inquiry.id === 'GU_KN_MO') {
      const result = await generateGuKnMoInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        cadastralNumbers: additionalData.cadastralNumbers,
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для МСХ МО (ветеринария)
    if (inquiry.id === 'MSH_VETERINARY') {
      const result = await generateMshMoInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        cadastralNumbers: additionalData.cadastralNumbers,
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для Водоканала
    if (inquiry.id === 'VODOKANAL') {
      const result = await generateVodokanalInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        cadastralNumbers: additionalData.cadastralNumbers,
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для МВК ЗСО (МО)
    if (inquiry.id === 'MVK_ZSO_MO') {
      const result = await generateMvkMoInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        cadastralNumbers: additionalData.cadastralNumbers,
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для Администрации (МО)
    if (inquiry.id === 'ADMINISTRATION') {
      const result = await generateAdministrationInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        cadastralNumbers: additionalData.cadastralNumbers,
        administrationName: additionalData.administrationName,
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для КЛХ (МО)
    if (inquiry.id === 'KLH') {
      const result = await generateKlhInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        cadastralNumbers: additionalData.cadastralNumbers,
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для Мин Экологии ЗСО (МО)
    if (inquiry.id === 'MIN_ECOLOGY_ZSO') {
      const result = await generateMinEcologyInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        cadastralNumbers: additionalData.cadastralNumbers,
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Используем специализированный генератор для МинПрироды РФ (МО)
    if (inquiry.id === 'MINPRIRODY_MO') {
      const result = await generateMinprirodaMoInquiry(templatePath, this.outputDir, {
        date: formattedDate,
        numberMiddle: additionalData.requestNumberMiddle || '000',
        year,
        objectName: project.objectName || project.name || 'Объект',
        objectAddress: project.inquiryAddress || project.objectAddress || '',
        executors,
      });

      return {
        inquiryId: inquiry.id,
        inquiryName: inquiry.shortName,
        fileName: result.fileName,
        fileUrl: `/generated/inquiries/${result.fileName}`,
        generatedAt: new Date().toISOString(),
      };
    }

    // Для остальных справок используем общий генератор
    const templateContent = await readFile(templatePath);
    const zip = new PizZip(templateContent);

    let docXml = zip.file('word/document.xml')?.asText() || '';

    const replacements = this.prepareReplacements(project, additionalData, inquiry);
    docXml = this.replacePlaceholders(docXml, replacements);

    zip.file('word/document.xml', docXml);

    const safeObjectName = (project.objectName || project.name || 'Объект')
      .replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, '')
      .substring(0, 30)
      .trim();
    const fileName = `${inquiry.shortName}_${safeObjectName}_${Date.now()}.docx`;
    const filePath = join(this.outputDir, fileName);

    const buffer = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    await writeFile(filePath, buffer);

    return {
      inquiryId: inquiry.id,
      inquiryName: inquiry.shortName,
      fileName,
      fileUrl: `/generated/inquiries/${fileName}`,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Форматирует дату в DD.MM.YYYY
   */
  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Подготавливает данные для замены в шаблоне
   */
  private prepareReplacements(
    project: {
      objectName: string | null;
      objectAddress: string | null;
      documentNumber: string | null;
      clientName: string | null;
      clientAddress: string | null;
    },
    additionalData: Record<string, string>,
    inquiry: { id: string; order: number },
  ): Record<string, string> {
    // Базовые данные организации (АО "РЭИ-ЭКОАудит")
    const defaultOrganization = {
      name: 'АО «РЭИ-ЭКОАудит»',
      address: '105318, г. Москва, ул. Ибрагимова, д. 31, стр. 37',
      phone: '+7 (495) 789-45-15',
      email: 'office@gruppa-rei.ru',
      signerName: 'Ковалев В.Л.',
      signerPosition: 'Генеральный директор',
    };

    const today = new Date();

    // Форматируем дату запроса из additionalData
    let formattedRequestDate = this.formatDate(today);
    if (additionalData.requestDate) {
      // Преобразуем YYYY-MM-DD в DD.MM.YYYY
      const parts = additionalData.requestDate.split('-');
      if (parts.length === 3) {
        formattedRequestDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
    }

    // Формируем номер запроса: ЭА-1-{middle}-{year}-{order}
    const year = today.getFullYear().toString().slice(-2);
    const middle = additionalData.requestNumberMiddle || '000';
    const requestNumber = `ЭА-1-${middle}-${year}-${inquiry.order}`;

    // Парсим исполнителей
    let executorsText = '';
    if (additionalData.executors) {
      try {
        const executors = JSON.parse(additionalData.executors) as string[];
        executorsText = executors.filter((e) => e.trim()).join(', ');
      } catch {
        executorsText = additionalData.executors;
      }
    }

    return {
      // Данные организации
      'НазваниеОрганизации': defaultOrganization.name,
      'АдресОрганизации': defaultOrganization.address,
      'ТелефонОрганизации': defaultOrganization.phone,
      'EmailОрганизации': defaultOrganization.email,
      'ФИОПодписанта': defaultOrganization.signerName,
      'ДолжностьПодписанта': defaultOrganization.signerPosition,

      // Данные объекта
      'НазваниеОбъекта': project.objectName || '',
      'Объект': project.objectName || '',
      'АдресОбъекта': project.objectAddress || '',
      'Адрес': project.objectAddress || '',

      // Данные запроса
      'ДатаЗапроса': formattedRequestDate,
      'Дата': formattedRequestDate,
      'НомерЗапроса': requestNumber,
      'Номер': requestNumber,
      'НомерДокумента': project.documentNumber || '',

      // Исполнители
      'Исполнитель': executorsText,
      'Исполнители': executorsText,

      // Данные заказчика
      'Заказчик': project.clientName || '',
      'АдресЗаказчика': project.clientAddress || '',

      // Химические вещества (для ЦГМС)
      'ХимическиеВещества': additionalData.chemicals || '',
      'Вещества': additionalData.chemicals || '',
    };
  }

  /**
   * Заменяет плейсхолдеры в XML
   * Поддерживает как HYPERLINK плейсхолдеры, так и простые текстовые
   */
  private replacePlaceholders(
    xml: string,
    replacements: Record<string, string>,
  ): string {
    for (const [key, value] of Object.entries(replacements)) {
      if (!value) continue;

      const escapedValue = this.escapeXml(value);

      // Заменяем HYPERLINK плейсхолдеры (как в word.service.ts)
      const hyperlinkPattern = new RegExp(
        `(HYPERLINK\\s+\\\\l\\s+&quot;${key}&quot;[^]*?fldCharType="separate"[^]*?<w:t[^>]*>)${key}(</w:t>)`,
        'g',
      );
      xml = xml.replace(hyperlinkPattern, `$1${escapedValue}$2`);

      // Заменяем простые текстовые плейсхолдеры
      const textPattern = new RegExp(`>${key}<`, 'g');
      xml = xml.replace(textPattern, `>${escapedValue}<`);
    }

    // Удаляем highlight (подсветку) для чистого вида
    xml = xml.replace(/<w:highlight[^/]*\/>/g, '');
    xml = xml.replace(/<w:highlight[^>]*>[^<]*<\/w:highlight>/g, '');

    return xml;
  }

  /**
   * Экранирует специальные символы XML
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Преобразует модель Prisma в DTO
   */
  private mapToDto(model: {
    id: string;
    projectId: string;
    region: string;
    selectedInquiries: unknown;
    additionalData: unknown;
    generatedFiles: unknown;
    generatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): InquiryRequest {
    return {
      id: model.id,
      projectId: model.projectId,
      region: model.region as InquiryRegion,
      selectedInquiries: (model.selectedInquiries as string[]) || [],
      additionalData: (model.additionalData as Record<string, string>) || undefined,
      generatedFiles: (model.generatedFiles as GeneratedInquiryFile[]) || undefined,
      generatedAt: model.generatedAt?.toISOString(),
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
    };
  }

  /**
   * Получить путь к сгенерированному файлу
   */
  async getGeneratedFile(fileName: string): Promise<{ path: string; exists: boolean }> {
    const filePath = join(this.outputDir, fileName);
    try {
      const { access } = await import('fs/promises');
      await access(filePath);
      return { path: filePath, exists: true };
    } catch {
      return { path: filePath, exists: false };
    }
  }

  /**
   * Получить список доступных справок для проекта
   */
  async getAvailableInquiries(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectAddress: true },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    const region = detectRegionFromAddress(project.objectAddress || '');
    const inquiries = getInquiriesByRegion(region);

    return {
      region,
      regionName: region === 'MOSCOW' ? 'г. Москва' : 'Московская область',
      inquiries,
    };
  }
}

