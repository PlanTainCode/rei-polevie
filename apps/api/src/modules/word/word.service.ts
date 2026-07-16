import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
  HeadingLevel,
  CheckBox,
} from 'docx';
import { join } from 'path';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { PrismaService } from '../../prisma/prisma.service';
import PizZip = require('pizzip');
import * as mammoth from 'mammoth';
import { DistanceService } from '../distance/distance.service';
import {
  AiService,
  ServiceMatch,
  ProgramIeiOrderFlags,
  ProgramIeiSection1Data,
  ProgramIeiSection31Data,
  ProgramIeiSection32Data,
  ProgramIeiSection45Data,
  EgrnData,
} from '../ai/ai.service';
import { replaceProgramIeiSection41Block } from './program-iei/section-4';
import {
  applyProgramIeiSection42Footnotes,
  applyProgramIeiSection42TableFiltering,
  extractProgramIeiSection42Table,
} from './program-iei/section-42';
import {
  applyProgramIeiSection42NaturalConditionsTop10,
  applyProgramIeiSection42QuantitiesFromServices,
  parseHaFromText,
  pruneProgramIeiSection42PprRows,
  pruneProgramIeiSection42WaterBlocks,
} from './program-iei/section-42-natural-conditions';
import { 
  replaceParagraphTextByParaIdPreserveRunProps,
  normalizeDocumentStyles,
  fixMissingSpacesInDocxXml,
  replaceTextAcrossWordRuns,
  extractProgramIeiEndSignaturesBlock,
  restoreProgramIeiEndSignaturesBlock,
} from './program-iei/docx-xml';
import { mergeSiteDescriptionWithArea } from './program-iei/site-boundaries';
import { replaceProgramIeiSection43Block } from './program-iei/section-43';
import { replaceProgramIeiSection44Block } from './program-iei/section-44';
import { replaceProgramIeiSection45Block } from './program-iei/section-45';
import { replaceProgramIeiSection47Block } from './program-iei/section-47';
import { replaceProgramIeiSection61Block } from './program-iei/section-61';
import { replaceProgramIeiSection62Block } from './program-iei/section-62';
import { replaceProgramIeiSection71Block } from './program-iei/section-71';
import { replaceProgramIeiSection72Block } from './program-iei/section-72';
import { replaceProgramIeiSection81Block } from './program-iei/section-81';
import { extractSection81FromTz } from '../ai/program-iei/section-81';
import { replaceProgramIeiSection82Block } from './program-iei/section-82';
import { replaceProgramIeiSection83And84Block } from './program-iei/section-83-84';
import {
  applyProgramIeiApprovalHeaders,
  replaceTitleSignatories,
} from './program-iei/title-signatories';
import { resolveProgramIeiLocation12 } from './program-iei/precise-location';
import {
  extractUrbanPlanningActivityFromTz,
  URBAN_PLANNING_ACTIVITY_OPTIONS,
} from './program-iei/urban-planning';

interface GenerateOptions {
  projectId: string;
  userId: string;
}

interface GeneratedWordResult {
  filePath: string;
  fileName: string;
}

// Данные для замены плейсхолдеров в программе ИЭИ (расширенный интерфейс)
interface ProgramIeiData {
  // Титульная страница
  Объект: string;
  Адрес: string;
  ДиректорДолжность: string;
  ДиректорФИО: string;
  НазваниеОрганизации: string;
  // Роль АО «РЭИ-ЭКОАУДИТ»: "Подрядчик" или "Исполнитель"
  РольПодрядчика: string;
  
  // 1.3 Сведения о заказчике
  Заказчик: string;
  ОГРН: string;
  ЮридическийАдрес: string;
  КонтактноеЛицо: string;
  НомерТелефона: string;
  EMAIL: string;
  
  // 1.5 Цели и задачи - БЕРЁТСЯ ПОЛНОСТЬЮ из ТЗ
  ЦелиИЗадачи: string;
  
  // 1.6 Идентификационные сведения
  ФункцНазначение: string;
  ТранспортнаяИнфраструктура: string;
  ОпасноеПроизводство: string;
  ПожарнаяОпасность: string;
  УровеньОтветственности: string;
  НаличиеПомещений: string;
  
  // 1.7 Вид градостроительной деятельности
  ВидГрадДеятельности: string;
  
  // 1.8 Этап выполнения
  ЭтапВыполнения: string;
  
  // 1.9 Характеристика объекта
  XrObject: string;
  ГлубинаРабот: string;
  ПлощадьУчастка: string;
  ОписаниеТерритории: string;
  Глубина: string;
}

@Injectable()
export class WordService {
  private readonly outputDir = join(process.cwd(), 'generated');
  private readonly uploadsDir = join(process.cwd(), 'uploads');

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private distanceService: DistanceService,
  ) {}

  /**
   * Генерирует заявку ФМБА на микробиологические исследования
   */
  async generateFmbaRequest(options: GenerateOptions): Promise<GeneratedWordResult | null> {
    const { projectId } = options;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
          orderBy: { sampleNumber: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    // Фильтруем пробы АМ и АП
    const amSamples = project.samples.filter((s) => s.analysisCode === 'АМ');
    const apSamples = project.samples.filter((s) => s.analysisCode === 'АП');

    // Если нет микробиологии - не генерируем
    if (amSamples.length === 0 && apSamples.length === 0) {
      return null;
    }

    // Формируем данные (documentNumber теперь полный номер, напр. 801-115-25)
    const year = new Date().getFullYear().toString().slice(-2);
    const requestNumber = project.documentNumber || `801-000-${year}`;
    const currentDate = this.formatDate(new Date());
    const address = project.objectAddress || '';

    // Определяем тип объекта (почва или донные отложения)
    const hasSediment = project.samples.some((s) => s.analysisCode === 'БХ');

    // Создаём документ
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720, // 0.5 inch
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          children: [
            // Шапка
            this.createHeader(),
            
            // Заголовок заявки
            new Paragraph({
              children: [
                new TextRun({
                  text: `З А Я В К А  № ${requestNumber} от ${currentDate}`,
                  bold: true,
                  size: 24,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 100 },
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: '(указывается Заказчиком, если номера нет - б/н)',
                  size: 16,
                  italics: true,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: 'В ИЛЦ ФГБУЗ ГЦГ и Э ФМБА России',
                  bold: true,
                  size: 22,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),

            // Объект исследования
            new Paragraph({
              children: [
                new TextRun({ text: 'Объект исследования/испытания: ', size: 22 }),
                new TextRun({ text: 'Почва', bold: true, size: 22 }),
              ],
              spacing: { after: 100 },
            }),

            // Чекбоксы типа объекта
            this.createObjectTypeTable(hasSediment),

            // Заказчик
            this.createCustomerTable(),

            // Текст заявки
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Прошу Вас провести испытания (исследования) образцов (проб) почвы (таблица «Информация о пробе (ах)») в соответствии с договором. Гарантирую оплату услуг.',
                  italics: true,
                  size: 20,
                }),
              ],
              spacing: { before: 200, after: 100 },
            }),

            // Чекбоксы экспертного заключения
            this.createExpertTable(),

            // Цель исследования
            this.createPurposeTable(),

            // Дата и место отбора
            this.createSamplingInfoTable(address),

            // Заголовок таблицы проб
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Информация о пробе (ах)',
                  bold: true,
                  size: 22,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 300, after: 100 },
            }),

            // Таблица проб
            this.createSamplesTable(amSamples, apSamples),

            // Дата доставки
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Дата доставки образцов (проб): «____» _________________  202    г.',
                  size: 20,
                }),
              ],
              spacing: { before: 200, after: 100 },
            }),

            // Выбор метода
            new Paragraph({
              children: [
                new TextRun({ text: '☑ ', size: 20 }),
                new TextRun({
                  text: 'Оставляю право выбора оптимального метода (методик) исследований, испытаний и измерений образцов (проб) за ИЛЦ ФГБУЗ ГЦГ и Э ФМБА России.',
                  size: 20,
                }),
              ],
              spacing: { before: 100, after: 200 },
            }),

            // Подпись
            this.createSignatureTable(),
          ],
        },
      ],
    });

    // Создаём папку и сохраняем файл
    await mkdir(this.outputDir, { recursive: true });

    const fileName = `Заявка_ФМБА_${project.name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_')}_${Date.now()}.docx`;
    const filePath = join(this.outputDir, fileName);

    const buffer = await Packer.toBuffer(doc);
    await writeFile(filePath, buffer);

    return { filePath, fileName };
  }

  private createHeader(): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Договор № 48/2025/л', size: 20 })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'от «23» января 2025 г.', size: 20 })],
                }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Главному врачу', size: 20 })],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'ФГБУЗ ГЦ Г и Э ФМБА России', size: 20 })],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'С.А. Богдану', size: 20 })],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
    });
  }

  private createObjectTypeTable(hasSediment: boolean): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: hasSediment ? '☐ Почва' : '☑ Почва', size: 20 })],
                }),
              ],
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: hasSediment ? '☑ Донные отложения' : '☐ Донные отложения', size: 20 })],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  private createCustomerTable(): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Заказчик:', bold: true, size: 20 })] })],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'АО «РЭИ-ЭКОАудит»', size: 20 })] })],
              width: { size: 70, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Контактное лицо:', bold: true, size: 20 })] })],
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: 'Главный специалист, Ермолов Томас Александрович,', size: 20 })] }),
                new Paragraph({ children: [new TextRun({ text: '+7 (968) 640-72-21, termolov@gruppa-rei.ru', size: 20 })] }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  private createExpertTable(): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '☐ с экспертным заключением', size: 20 })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '☑ без экспертного заключения', size: 20 })] })],
            }),
          ],
        }),
      ],
    });
  }

  private createPurposeTable(): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Цель исследования:', bold: true, size: 20 })] })],
              width: { size: 100, type: WidthType.PERCENTAGE },
              columnSpan: 2,
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '☑ инженерно-экологические изыскания', size: 20 })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '☐ иное', size: 20 })] })],
            }),
          ],
        }),
      ],
    });
  }

  private createSamplingInfoTable(address: string): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Дата отбора проб:', bold: true, size: 20 })] })],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '__.__.202_ г.', size: 20 })] })],
              width: { size: 70, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Место и адрес отбора:', bold: true, size: 20 })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: address || '', size: 20 })] })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Условия доставки:', bold: true, size: 20 })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Автотранспорт, термобокс', size: 20 })] })],
            }),
          ],
        }),
      ],
    });
  }

  private createSamplesTable(amSamples: any[], apSamples: any[]): Table {
    const headerRow = new TableRow({
      children: [
        this.createHeaderCell('Название объекта, точка отбора'),
        this.createHeaderCell('Глубина отбора'),
        this.createHeaderCell('Характеристика'),
        this.createHeaderCell('Масса'),
        this.createHeaderCell('Определяемые показатели'),
        this.createHeaderCell('НД'),
      ],
    });

    const rows = [headerRow];

    // Добавляем пробы АМ (микробиология)
    amSamples.forEach((sample, idx) => {
      const isFirst = idx === 0;
      rows.push(
        new TableRow({
          children: [
            this.createCell(`${sample.platform.label}, ${sample.cipher}`),
            this.createCell(sample.depthLabel),
            this.createCell('-'),
            this.createCell('1 кг'),
            this.createCell(
              isFirst
                ? 'Обобщенные колиформные бактерии (ОКБ), в т.ч. Escherichia coli, энтерококки (фекальные энтерококки), патогенные бактерии, в т.ч. сальмонеллы'
                : ''
            ),
            this.createCell(isFirst ? 'СанПиН 1.2.3685-21' : ''),
          ],
        })
      );
    });

    // Добавляем пробы АП (паразитология)
    apSamples.forEach((sample, idx) => {
      const isFirst = idx === 0;
      rows.push(
        new TableRow({
          children: [
            this.createCell(`${sample.platform.label}, ${sample.cipher}`),
            this.createCell(sample.depthLabel),
            this.createCell('-'),
            this.createCell('1 кг'),
            this.createCell(isFirst ? 'яйца и личинки гельминтов' : ''),
            this.createCell(''),
          ],
        })
      );
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    });
  }

  private createHeaderCell(text: string): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 18 })],
          alignment: AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
      shading: { fill: 'E0E0E0' },
    });
  }

  private createCell(text: string): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 18 })],
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
    });
  }

  private createSignatureTable(): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'ФИО лица, отбиравшего образцы (пробы)/', size: 20 })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'представителя Заказчика', size: 20 })],
                }),
              ],
              width: { size: 50, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: '_______________________', size: 20 })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'ФИО', size: 16, italics: true })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              width: { size: 25, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: '_______________________', size: 20 })],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'Подпись', size: 16, italics: true })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
              width: { size: 25, type: WidthType.PERCENTAGE },
            }),
          ],
        }),
      ],
    });
  }

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // ==================== ПРОГРАММА ИЭИ ====================

  private readonly templateDir = join(process.cwd(), 'templates');
  private readonly programIeiTemplate = 'Программа ИЭИ актуальная.docx';
  private readonly programIgmiTemplate = 'Программа ИГМИ (1).docx';

  /**
   * Генерирует программу инженерно-экологических изысканий
   * на основе шаблона с заменой плейсхолдеров
   * 
   * Использует AI для извлечения данных из ТЗ
   */
  async generateProgramIei(options: GenerateOptions): Promise<GeneratedWordResult> {
    const { projectId } = options;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    // Получаем все дочерние проекты (допотборы) для объединения данных
    const childProjects = await this.prisma.project.findMany({
      where: { parentProjectId: projectId },
    });
    console.log(`[WordService] Найдено ${childProjects.length} допотборов для объединения`);

    // Извлекаем данные из ТЗ через AI
    let tzText: string | null = null;
    let section1Data: ProgramIeiSection1Data | null = null;
    let section31Data: ProgramIeiSection31Data | null = null;
    let section32Data: ProgramIeiSection32Data | null = null;
    let section45Data: ProgramIeiSection45Data | null = null;
    let orderFlags: ProgramIeiOrderFlags | null = null;
    let orderText: string | null = null;
    let section47LayersData: import('../ai/ai.service').Section47LayersData | null = null;
    
    // Массив текстов всех поручений (основное + допотборы)
    const allOrderTexts: string[] = [];
    // Кол-во точек опробования почвы из п.4.2 (для фразы про запечатанность)
    let soilSamplingPointsCount: number | null = null;
    // Наличие ДО по количествам поручения (row 29) — для п.4.4
    let hasSedimentFromQuantities: boolean | null = null;
    
    console.log('[WordService] tzFileUrl:', project.tzFileUrl);
    console.log('[WordService] Project data:', {
      clientName: project.clientName,
      clientAddress: project.clientAddress,
      objectAddress: project.objectAddress,
      objectName: project.objectName,
    });

    // Расстояние от офиса: берём сохранённое или вычисляем
    let distanceFromOfficeKm: number | null = project.distanceKm ?? null;
    if (distanceFromOfficeKm == null && project.objectAddress) {
      distanceFromOfficeKm = await this.distanceService.getDistanceToAddress(
        project.objectAddress,
        project.objectName || undefined,
      );
      console.log(`[WordService] Расстояние от офиса (рассчитано): ${distanceFromOfficeKm} км`);
    } else {
      console.log(`[WordService] Расстояние от офиса (сохранённое): ${distanceFromOfficeKm} км`);
    }
    
    if (project.tzFileUrl) {
      try {
        // Читаем текст ТЗ
        const tzPath = join(this.uploadsDir, project.tzFileUrl);
        const tzBuffer = await readFile(tzPath);
        const tzResult = await mammoth.extractRawText({ buffer: tzBuffer });
        const tzTextValue = tzResult.value;
        tzText = tzTextValue;

        // Читаем текст шаблона раздела 1 для контекста AI
        const templateSection1Text = await this.extractSection1FromTemplate();

        // Извлекаем данные через AI
        section1Data = await this.aiService.extractProgramIeiSection1(tzTextValue, templateSection1Text);

        // ВАЖНО: в \"Границы площадки...\" всегда должна быть фраза про площадь (из ТЗ).
        // AI иногда обрезает/теряет её — склеиваем детерминированно.
        if (section1Data) {
          const merged = mergeSiteDescriptionWithArea({
            siteDescription: section1Data.siteDescription,
            siteArea: section1Data.siteArea,
            tzText: tzTextValue,
          });
          section1Data.siteDescription = merged.siteDescription;
          // если siteArea пустой — попробуем заполнить хотя бы из предложения
          if (!section1Data.siteArea && merged.siteAreaSentence) {
            section1Data.siteArea = merged.siteAreaSentence;
          }

          // п.1.7: если AI не вытащил / вытащил криво — берём 1:1 из ТЗ (п.4 или п.1.7)
          const urbanFromTz = extractUrbanPlanningActivityFromTz(tzTextValue);
          if (urbanFromTz) {
            section1Data.urbanPlanningActivity = urbanFromTz;
          }
        }
        
        console.log('[WordService] AI извлёк данные раздела 1:', JSON.stringify(section1Data, null, 2));

        // П.3.2 - пробуем извлечь данные из ТЗ (для автозаполнения, если в UI пусто)
        section32Data = await this.aiService.extractProgramIeiSection32(tzTextValue);
        console.log('[WordService] AI извлёк данные пункта 3.2:', JSON.stringify(section32Data, null, 2));

        // П.4.5 - извлекаем требования к прогнозу из ТЗ
        section45Data = await this.aiService.extractProgramIeiSection45(tzTextValue);
        console.log('[WordService] AI извлёк данные пункта 4.5:', JSON.stringify(section45Data, null, 2));
      } catch (error) {
        console.error('[WordService] Ошибка чтения ТЗ или AI:', error);
      }
    } else {
      console.warn('[WordService] ТЗ не загружено (tzFileUrl пуст) - используем данные из project');
    }

    // Если section1Data не было получено из AI - используем данные из project
    if (!section1Data) {
      console.warn('[WordService] section1Data пуст - создаём из данных project');
      section1Data = {
        objectName: project.objectName || project.name || '',
        objectLocation: project.objectAddress || '',
        clientName: project.clientName || '',
        clientOgrn: '',
        clientAddress: project.clientAddress || '',
        clientContactName: '',
        clientContactPhone: '',
        clientContactEmail: '',
        goalsAndTasks: '',
        objectPurpose: project.objectPurpose || '',
        transportInfrastructure: 'Нет',
        hazardousProduction: 'Нет',
        fireHazard: 'Нет данных',
        responsibilityLevel: 'Нормальный',
        permanentOccupancy: '',
        urbanPlanningActivity: '',
        surveyStage: 'Инженерные изыскания для подготовки проектной документации',
        technicalCharacteristics: '',
        excavationDepth: '',
        siteDescription: '',
        siteArea: '',
        technicalCustomerName: '',
        technicalCustomerDirectorPosition: 'Генеральный директор',
        technicalCustomerDirectorName: '',
        clientDirectorPosition: 'Директор',
        clientDirectorName: '',
        clientShortName: '',
        coordinates: null,
        cadastralNumber: '',
        backgroundConcentrationsRef: '',
        previousSurveyReport: '',
        reportCopiesText: '',
        contractorRole: 'Подрядчик',
        titleSignatories: [],
      };
    }

    // П.3.1 (краткая физико-географическая характеристика) - определяем по адресу/местоположению
    {
      // Собираем адрес и наименование объекта для определения района
      const objectLocation = String(section1Data?.objectLocation || project.objectAddress || '').trim();
      const objectName = String(section1Data?.objectName || project.objectName || project.name || '').trim();
      
      // Объединяем для анализа — район может быть в наименовании объекта (например "р-н Фили-Давыдково")
      const textFor31 = [objectName, objectLocation].filter(Boolean).join('\n');

      if (textFor31) {
        try {
          section31Data = await this.aiService.extractProgramIeiSection31(textFor31);
          console.log('[WordService] AI извлёк данные пункта 3.1:', JSON.stringify(section31Data, null, 2));
        } catch (error) {
          console.error('[WordService] Ошибка AI для пункта 3.1:', error);
        }
      }
    }

    // Поручение: флаги состава работ для раздела 4 (п.4.1/4.2)
    // Собираем поручения: основное + все допотборы
    if (project.orderFileUrl) {
      try {
        const orderPath = join(this.uploadsDir, project.orderFileUrl);
        const orderBuffer = await readFile(orderPath);
        const orderResult = await mammoth.extractRawText({ buffer: orderBuffer });
        orderText = orderResult.value;
        allOrderTexts.push(orderText);

        const objectNameForOrder = String(project.objectName || project.name || '').trim();
        orderFlags = await this.aiService.extractProgramIeiOrderFlags(orderText, objectNameForOrder);
        console.log('[WordService] AI извлёк флаги по поручению:', JSON.stringify(orderFlags, null, 2));

        // П.4.7 - извлекаем слои грунта из поручения
        section47LayersData = await this.aiService.extractSection47Layers(orderText);
        console.log('[WordService] AI извлёк слои грунта п.4.7:', JSON.stringify(section47LayersData, null, 2));
      } catch (error) {
        console.error('[WordService] Ошибка чтения поручения или AI (order flags):', error);
      }
    }

    // Читаем поручения из допотборов и объединяем данные
    for (const child of childProjects) {
      if (child.orderFileUrl) {
        try {
          const childOrderPath = join(this.uploadsDir, child.orderFileUrl);
          const childOrderBuffer = await readFile(childOrderPath);
          const childOrderResult = await mammoth.extractRawText({ buffer: childOrderBuffer });
          const childOrderText = childOrderResult.value;
          allOrderTexts.push(childOrderText);

          // Извлекаем флаги из допотбора и объединяем с основными
          const objectNameForOrder = String(project.objectName || project.name || '').trim();
          const childFlags = await this.aiService.extractProgramIeiOrderFlags(childOrderText, objectNameForOrder);
          console.log(`[WordService] AI извлёк флаги из допотбора ${child.name}:`, JSON.stringify(childFlags, null, 2));

          // Объединяем флаги: если в допотборе флаг true — он становится true в итоге
          if (childFlags && orderFlags) {
            orderFlags = this.mergeOrderFlags(orderFlags, childFlags);
          } else if (childFlags && !orderFlags) {
            orderFlags = childFlags;
          }

          // Объединяем слои грунта п.4.7
          const childLayers = await this.aiService.extractSection47Layers(childOrderText);
          if (childLayers && section47LayersData) {
            section47LayersData = this.mergeSection47Layers(section47LayersData, childLayers);
          } else if (childLayers && !section47LayersData) {
            section47LayersData = childLayers;
          }

          console.log(`[WordService] Обработан допотбор: ${child.name}`);
        } catch (error) {
          console.error(`[WordService] Ошибка чтения поручения допотбора ${child.name}:`, error);
        }
      }
    }

    // Объединяем все тексты поручений для AI анализа
    if (allOrderTexts.length > 0) {
      const combinedOrderText = allOrderTexts.join('\n\n--- ДОПОТБОР ---\n\n');
      orderText = combinedOrderText;
      if (allOrderTexts.length > 1) {
        console.log(`[WordService] Объединено ${allOrderTexts.length} поручений для анализа`);
      }
    }

    // Получаем данные ЕГРН ТОЛЬКО из БД (введены пользователем на странице генерации)
    // Если данные не заполнены — в шаблоне остаётся "Нет данных"
    let egrnData: EgrnData | null = null;
    
    const programIei = await this.prisma.programIei.findUnique({
      where: { projectId },
    });
    
    // Заполняем egrnData ТОЛЬКО если пользователь явно ввёл данные
    if (programIei?.cadastralNumber || programIei?.egrnDescription) {
      egrnData = {
        cadastralNumber: programIei.cadastralNumber || '',
        category: '',
        permittedUse: '',
        address: '',
        area: 0,
        status: '',
      };
      // Если есть описание - оно заменит автогенерированный текст
      if (programIei.egrnDescription) {
        (egrnData as EgrnData & { customDescription?: string }).customDescription = programIei.egrnDescription;
      }
      console.log('[WordService] Используем данные ЕГРН из БД:', egrnData);
    } else {
      console.log('[WordService] Данные ЕГРН не заполнены — оставляем "Нет данных" в шаблоне');
    }

    // Объединяем услуги (services) из основного проекта и допотборов
    const mergedServices = [...(Array.isArray(project.services) ? project.services : [])];
    for (const child of childProjects) {
      if (Array.isArray(child.services)) {
        for (const childService of child.services as any[]) {
          const existingIndex = mergedServices.findIndex(
            (s: any) => s.row === childService.row || (s.name && s.name === childService.name),
          );
          if (existingIndex >= 0) {
            // Увеличиваем количество существующей услуги
            const existing = mergedServices[existingIndex] as any;
            existing.quantity = (Number(existing.quantity) || 0) + (Number(childService.quantity) || 0);
          } else {
            // Добавляем новую услугу
            mergedServices.push({ ...childService });
          }
        }
      }
    }
    console.log(`[WordService] Объединено ${mergedServices.length} услуг из основного проекта и допотборов`);

    // Создаём объект проекта с объединёнными услугами
    const projectWithMergedServices = {
      ...project,
      services: mergedServices,
    };

    // Подготавливаем данные для замены (объединяем AI данные и данные проекта)
    const data = this.prepareProgramIeiData(project, section1Data);

    // Читаем шаблон
    const templatePath = join(this.templateDir, this.programIeiTemplate);
    const templateContent = await readFile(templatePath, 'binary');
    const zip = new PizZip(templateContent);

    // Заменяем плейсхолдеры в document.xml
    let docXml = zip.file('word/document.xml')?.asText() || '';

    // Подписи в конце файла — снимок из шаблона, восстановим после всех правок
    const endSignaturesBlock = extractProgramIeiEndSignaturesBlock(docXml);
    
    // Логируем данные для п.1.9.1 (technicalCharacteristics -> XrObject)
    console.log('[WordService] XrObject (technicalCharacteristics) для замены:', data.XrObject);
    
    // Подписанты на титульной странице: генерируем из массива titleSignatories
    if (section1Data?.titleSignatories && section1Data.titleSignatories.length > 0) {
      // Фолбэк: если у подписанта нет ФИО — ищем его ТОЛЬКО в тексте ТЗ
      // рядом с организацией этого конкретного подписанта (не подставляем чужие данные)
      for (const sig of section1Data.titleSignatories) {
        if (sig.name || !tzText || !sig.organization) continue;

        const orgShort = sig.organization
          .replace(/^(ООО|АО|ЗАО|ПАО|ГУП|МУП|ФГУП|ФГБУ)\s*[«"]/i, '')
          .replace(/[»"]\s*$/, '')
          .trim();
        if (orgShort.length < 3) continue;

        // Ищем ВСЕ вхождения организации в ТЗ и для каждого пробуем найти ФИО
        let searchFrom = 0;
        while (searchFrom < tzText.length) {
          const orgIdx = tzText.indexOf(orgShort, searchFrom);
          if (orgIdx === -1) break;

          // ФИО должно быть ПОСЛЕ организации (в пределах 150 символов) — на титуле имя идёт под организацией
          const afterOrg = tzText.substring(orgIdx, orgIdx + orgShort.length + 150);
          const nameMatch = afterOrg.match(/([А-ЯЁ]\.[А-ЯЁ]\.[\s]?[А-ЯЁ][а-яё]{2,})/);
          if (nameMatch) {
            sig.name = nameMatch[1].trim();
            console.log(`[WordService] ФИО "${sig.name}" извлечено из ТЗ для "${sig.organization}"`);
            break;
          }
          searchFrom = orgIdx + orgShort.length;
        }

        if (!sig.name) {
          console.warn(`[WordService] Подписант "${sig.label}" / "${sig.organization}" — ФИО не найдено в ТЗ`);
        }
      }

      // В программе «УТВЕРЖДАЮ» у РЭИ (низ слева), у остальных «СОГЛАСОВАНО» — не как в ТЗ
      section1Data.titleSignatories = applyProgramIeiApprovalHeaders(section1Data.titleSignatories);

      console.log('[WordService] titleSignatories:', JSON.stringify(section1Data.titleSignatories, null, 2));
      docXml = replaceTitleSignatories({
        xml: docXml,
        signatories: section1Data.titleSignatories,
        contractorRole: data.РольПодрядчика,
      });
    } else {
      // Фолбэк: если titleSignatories нет — используем старую логику
      if (section1Data) {
        docXml = this.replaceCustomerTitleBlock(docXml, section1Data);
      }
      docXml = this.replaceContractorRole(docXml, data.РольПодрядчика);
    }

    // Общая замена плейсхолдеров (для полей внутри документа, НЕ титула)
    docXml = this.replacePlaceholders(docXml, data);
    
    // Специальные замены блоков текста
    if (section1Data) {
      docXml = this.replaceGoalsAndTasksBlock(docXml, section1Data.goalsAndTasks);
      docXml = this.replacePermanentOccupancyOptions(docXml, section1Data.permanentOccupancy);
      docXml = this.replaceUrbanPlanningActivityOptions(docXml, section1Data.urbanPlanningActivity);
      docXml = this.replaceSiteDescriptionBlock(docXml, section1Data.siteDescription);
      
      // Замена пунктов 1.6.2, 1.6.3, 1.6.4 - значения из ТЗ
      docXml = this.replaceSection162Value(docXml, section1Data.transportInfrastructure);
      docXml = this.replaceSection163Value(docXml, section1Data.hazardousProduction);
      docXml = this.replaceSection164Value(docXml, section1Data.fireHazard);
      
      // Замена п.1.9.1 "Краткая техническая характеристика объекта" с форматированием списка
      docXml = this.replaceTechnicalCharacteristicsBlock(docXml, section1Data.technicalCharacteristics);
      
      // Замена п.1.9.2 "Глубина ведения земляных работ" с форматированием списка
      docXml = this.replaceExcavationDepthBlock(docXml, section1Data.excavationDepth);
    }
    
    // Заполняем пункт 1.10 данными ЕГРН
    if (egrnData) {
      docXml = this.replaceEgrnBlock(docXml, egrnData);
    } else {
      // Если данные ЕГРН не заполнены — заменяем плейсхолдеры на "Нет данных"
      docXml = this.replaceEgrnBlockWithNoData(docXml);
    }
    
    // Заполняем пункт 2.1 "Перечень исходных материалов и данных"
    if (section1Data) {
      const customerProvidesBackground =
        programIei?.customerProvidesBackgroundConcentrations === true;
      docXml = this.replaceSourceMaterialsBlock(docXml, section1Data, customerProvidesBackground);
      // Заполняем пункт 2.2 "Изученность территории" (оставляем только нужные абзацы)
      docXml = this.replaceStudyDegreeBlock(docXml, section1Data);
    }

    // Заполняем пункт 2.3 "Дополнительно получаемые материалы" (правила зависят от итогового 2.1)
    docXml = this.replaceAdditionalMaterialsBlock(docXml);

    // Заполняем пункт 3.1 (картинку не трогаем)
    docXml = this.replaceProgramIeiSection31Block(docXml, section31Data, section1Data, project);

    // Заполняем пункт 3.2 (границы + условия)
    docXml = this.replaceProgramIeiSection32Block(docXml, programIei, section32Data);

    // Заполняем раздел 4 (п.4.1/4.2) по поручению — изолированная логика (в отдельном модуле)
    // Используем проект с объединёнными услугами из допотборов
    docXml = replaceProgramIeiSection41Block({
      xml: docXml,
      orderFlags,
      section1Data,
      section31Data,
      project: projectWithMergedServices,
    });

    // --- П.4.2: таблица работ (фильтруем строки по поручению, стиль таблицы не трогаем)
    // Извлекаем услуги из каждого поручения отдельно и суммируем количества
    if (allOrderTexts.length > 0) {
      // Гарантированно есть хотя бы одно поручение — используем объединённый текст
      const combinedOrderTextForSection42 = orderText || allOrderTexts.join('\n\n--- ДОПОТБОР ---\n\n');
      
      let servicesFromOrder: ServiceMatch[] = [];
      let quantitiesByRow: Record<number, number | string> = {};

      // Обрабатываем каждое поручение отдельно и суммируем количества
      for (let orderIdx = 0; orderIdx < allOrderTexts.length; orderIdx++) {
        const singleOrderText = allOrderTexts[orderIdx];
        const orderLabel = orderIdx === 0 ? 'основное' : `допотбор ${orderIdx}`;
        try {
          console.log(`[WordService] Поручение ${orderLabel}: текст ${singleOrderText.length} символов`);
          const singleServices = await this.aiService.matchServicesFromOrder(singleOrderText);
          console.log(`[WordService] Поручение ${orderLabel}: найдено ${singleServices.length} услуг`);
          if (singleServices.length > 0) {
            console.log(`[WordService] Поручение ${orderLabel} услуги:`, 
              singleServices.map(s => `row=${s.row}, qty=${s.quantity || '?'}`).join('; '));
          }
          
          // Извлекаем количества из этого поручения
          const q = await this.aiService.extractOrderServiceQuantities({
            orderText: singleOrderText,
            servicesFromOrder: singleServices,
          });

          // Объединяем количества из extractOrderServiceQuantities и matchServicesFromOrder
          const serviceQuantities: Record<number, number> = {};
          
          // Сначала берём количества из extractOrderServiceQuantities (более точные)
          if (q.ok) {
            console.log(`[WordService] Поручение ${orderLabel}: извлечены количества:`, JSON.stringify(q.byRow));
            for (const [rowStr, value] of Object.entries(q.byRow)) {
              const row = Number(rowStr);
              const numValue = typeof value === 'number' ? value : Number(String(value).replace(',', '.')) || 0;
              if (numValue > 0) serviceQuantities[row] = numValue;
            }
          } else {
            console.log(`[WordService] Поручение ${orderLabel}: не удалось извлечь количества через extractOrderServiceQuantities`);
          }
          
          // Дополняем количествами из matchServicesFromOrder (fallback)
          for (const service of singleServices) {
            if (serviceQuantities[service.row] === undefined && service.quantity !== undefined) {
              const numQty = typeof service.quantity === 'number' 
                ? service.quantity 
                : Number(String(service.quantity).replace(',', '.')) || 0;
              if (numQty > 0) serviceQuantities[service.row] = numQty;
            }
          }

          // Суммируем количества в общий quantitiesByRow
          for (const [rowStr, numValue] of Object.entries(serviceQuantities)) {
            const row = Number(rowStr);
            const existing = typeof quantitiesByRow[row] === 'number' 
              ? quantitiesByRow[row] as number 
              : Number(String(quantitiesByRow[row] || 0).replace(',', '.')) || 0;
            quantitiesByRow[row] = existing + numValue;
            console.log(`[WordService] Поручение ${orderLabel}: row=${row}, было=${existing}, добавлено=${numValue}, стало=${quantitiesByRow[row]}`);
          }

          // Обновляем servicesFromOrder — дедуплицируем по row внутри одного поручения
          const seenRowsInThisOrder = new Set<number>();
          for (const service of singleServices) {
            // Пропускаем дубликаты внутри одного поручения
            if (seenRowsInThisOrder.has(service.row)) continue;
            seenRowsInThisOrder.add(service.row);
            
            const existingIdx = servicesFromOrder.findIndex(s => s.row === service.row);
            const numQty = serviceQuantities[service.row] || 0;
            
            if (existingIdx >= 0) {
              // Увеличиваем количество существующей услуги (суммируем между поручениями)
              const existingQty = typeof servicesFromOrder[existingIdx].quantity === 'number'
                ? servicesFromOrder[existingIdx].quantity as number
                : Number(String(servicesFromOrder[existingIdx].quantity || 0).replace(',', '.')) || 0;
              servicesFromOrder[existingIdx] = {
                ...servicesFromOrder[existingIdx],
                quantity: existingQty + numQty,
              };
            } else {
              // Добавляем новую услугу
              servicesFromOrder.push({ ...service, quantity: numQty });
            }
          }
        } catch (error) {
          console.error('[WordService] Ошибка AI при обработке поручения:', error);
        }
      }

      console.log(`[WordService] Объединённые услуги из ${allOrderTexts.length} поручений (${servicesFromOrder.length} услуг):`);
      for (const s of servicesFromOrder) {
        console.log(`  - row=${s.row}, qty=${s.quantity}, name=${s.name || '?'}`);
      }
      console.log(`[WordService] Итоговые количества по row:`, JSON.stringify(quantitiesByRow));

      const extracted42 = extractProgramIeiSection42Table(docXml);
      if (extracted42) {
        try {
          // Сохраняем исходный текст строки (шаблон), но НЕ меняем docXml до фильтрации таблицы,
          // иначе сдвинутся индексы tableStart/tableEnd и документ может обрезаться.
          // В актуальном шаблоне строка биозагрязнения разбита на три (бактериология/
          // паразитология/энтомология). «Цисты» теперь в санитарно-паразитологической строке.
          const bioNeedle = 'санитарно-паразитологических показателей';
          const bioTemplateLine =
            extracted42.rows.find((r) => String(r.title || '').toLowerCase().includes(bioNeedle))?.title || '';
          // Для AI добавляем контекст подзаголовков групп, чтобы он не оставлял \"голые\" заголовки
          // и лучше сопоставлял пункты внутри групп.
          const contextByTrIndex = new Map<number, string>();
          {
            let currentGroup = '';
            const sorted = [...extracted42.rows].sort((a, b) => a.trIndex - b.trIndex);
            for (const r of sorted) {
              const isGroupHeader = r.isHeaderLike && !r.unit && r.title && r.title !== '1';
              if (isGroupHeader) {
                currentGroup = String(r.title || '').trim();
                continue;
              }
              if (!r.isHeaderLike && currentGroup) {
                contextByTrIndex.set(r.trIndex, currentGroup);
              }
            }
          }

          const workRowsForAi = extracted42.workRows.map((r) => {
            const g = contextByTrIndex.get(r.trIndex);
            return g ? `${g}: ${r.title}` : r.title;
          });

          const match = await this.aiService.matchProgramIeiSection42TableRows({
            orderText: combinedOrderTextForSection42,
            workRows: workRowsForAi,
            servicesFromOrder,
            tzContextText: section1Data?.siteDescription || '',
          });

          // Если AI не смог — не фильтруем таблицу (лучше оставить всё, чем удалить нужное)
          const forceKeepWorkIdxs: number[] = [];
          if (match.ok) {
            const mustKeepPredicates = [
              (t: string) => t.startsWith('рекогносцировочное (маршрутное) обследование'),
              (t: string) => t.startsWith('описание точек наблюдений'),
              (t: string) => t.startsWith('характеристика климатических условий'),
              (t: string) => t.startsWith('характеристика ландшафтных условий'),
              (t: string) => t.startsWith('характеристика геоморфологических'),
              (t: string) => t.startsWith('характеристика почвенного покрова'),
              (t: string) => t.startsWith('характеристика социально-экономических условий'),
              (t: string) => t.startsWith('характеристика фонового загрязнения'),
            ];

            extracted42.workRows.forEach((r, i) => {
              const lt = String(r.title || '').trim().toLowerCase();
              if (mustKeepPredicates.some((p) => p(lt))) forceKeepWorkIdxs.push(i);
            });
          }

          let mergedKeep = Array.from(
            new Set([...(match.keepWorkRowIndexes || []), ...forceKeepWorkIdxs]),
          );

          // Жёстко убираем ППР из keep, если в поручении нет услуги row=17.
          // Иначе AI иногда оставляет строку из‑за «в соответствии с ППР» (проект производства работ).
          const hasPprService = servicesFromOrder.some((s) => s.row === 17);
          if (!hasPprService) {
            const pprWorkIdxs = new Set(
              extracted42.workRows
                .map((r, i) => ({ r, i }))
                .filter(({ r }) => {
                  const t = String(r.title || '').toLowerCase();
                  return (
                    t.includes('ппр') &&
                    (t.includes('измерен') || t.includes('радон') || t.includes('контуре'))
                  );
                })
                .map(({ i }) => i),
            );
            if (pprWorkIdxs.size > 0) {
              mergedKeep = mergedKeep.filter((i) => !pprWorkIdxs.has(i));
            }
          }

          if (match.ok && mergedKeep.length > 0) {
            docXml = applyProgramIeiSection42TableFiltering({
              xml: docXml,
              extracted: extracted42,
              keepWorkRowIndexes: mergedKeep,
              filterEnabled: true,
            });
          }

          // Спец-правило: строка \"Оценка биологического загрязнения...\" → убираем/оставляем \"цисты простейших\" по поручению.
          // Важно: делаем ПОСЛЕ фильтрации таблицы, чтобы не сдвигать индексы tableStart/tableEnd.
          try {
            if (bioTemplateLine) {
              const bio = await this.aiService.buildProgramIeiBioContaminationLine({
                orderText: combinedOrderTextForSection42,
                templateLineText: bioTemplateLine,
              });
              if (bio.finalText) {
                // paraId ячейки-названия санитарно-паразитологической строки (актуальный шаблон)
                docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '6E200023', bio.finalText);
              }
            }
          } catch (error) {
            console.error('[WordService] Ошибка обработки строки про цисты:', error);
          }

          // Строки со звёздочками после таблицы — по наличию работ в поручении
          // Если по поручению ничего не определили — не трогаем эти строки (чтобы не удалить нужное).
          // Сноски/водные блоки синхронизируем позже по количествам из поручения (строго).

          // Таблица 4.2 → блок \"Краткая характеристика природных условий\" (пункты 1–10)
          // и количества проб по остальным пунктам (берём из сопоставленных услуг).
          const orderRadiometry = Object.keys(quantitiesByRow).length > 0 ? Number(String(quantitiesByRow[16] ?? '').replace(',', '.')) : undefined;

          // Значение из project.services (редактируемое в админке)
          const savedServices = Array.isArray((project as any)?.services) ? ((project as any).services as ServiceMatch[]) : [];
          const savedRadiometryRow = savedServices.find(s => s.row === 16);
          const savedRadiometryHa = savedRadiometryRow
            ? (typeof savedRadiometryRow.quantity === 'number' ? savedRadiometryRow.quantity : Number(String(savedRadiometryRow.quantity).replace(',', '.')) || undefined)
            : undefined;

          // Приоритет: ручное поле ProgramIei → значение из adminки (services) → парсинг текста поручения
          const effectiveRadiometryHa = (programIei?.radiometryAreaHa != null && programIei.radiometryAreaHa > 0)
            ? programIei.radiometryAreaHa
            : (savedRadiometryHa != null && savedRadiometryHa > 0)
              ? savedRadiometryHa
              : orderRadiometry;

          docXml = applyProgramIeiSection42NaturalConditionsTop10({
            xml: docXml,
            rows: extracted42.rows,
            section1Data,
            tzText,
            radiometryAreaHa: effectiveRadiometryHa,
            orderFlags,
            project,
            distanceFromOfficeKm,
          });

          const servicesForQuantities: ServiceMatch[] =
            servicesFromOrder.length > 0
              ? servicesFromOrder
              : Array.isArray((project as any)?.services) && (project as any).services.length > 0
                ? ((project as any).services as ServiceMatch[])
                : [];

          if (servicesForQuantities.length > 0) {
            const areaHa =
              parseHaFromText(String(section1Data?.siteArea || '')) ||
              parseHaFromText(String(section1Data?.siteDescription || '')) ||
              parseHaFromText(String(tzText || '')) ||
              undefined;
            docXml = applyProgramIeiSection42QuantitiesFromServices({
              xml: docXml,
              rows: extracted42.rows,
              services: servicesForQuantities,
              areaHa,
              manualRadiometryHa: effectiveRadiometryHa,
            });

            // Жёсткая защита: если в поручении нет воды/донок — вычищаем эти блоки из таблицы
            // независимо от того, что вернул AI на этапе фильтрации.
            const toNum = (v: number | string | undefined): number => {
              if (v === undefined) return 0;
              if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
              const s = String(v).trim();
              if (!s || s === '-' || s === '–') return 0;
              const n = Number(s.replace(',', '.'));
              return Number.isFinite(n) ? n : 0;
            };

            // Точки опробования почвы: СанПиН (20) / бактериология (22) / токсичность (21)
            {
              let maxPoints = 0;
              let foundPoints = false;
              for (const row of [20, 22, 21]) {
                const fromQty = toNum(quantitiesByRow[row]);
                const fromSvc = toNum(
                  servicesForQuantities.find((s) => s.row === row)?.quantity as number | string | undefined,
                );
                const n = Math.max(fromQty, fromSvc);
                if (n > 0) {
                  foundPoints = true;
                  maxPoints = Math.max(maxPoints, n);
                }
              }
              if (foundPoints) {
                soilSamplingPointsCount = maxPoints;
                console.log(`[WordService] Точки опробования почвы (п.4.2): ${soilSamplingPointsCount}`);
              }
            }

            // ВАЖНО: воду/донки считаем ТОЛЬКО по количествам из табличной части поручения (консервативно).
            // Если AI не извлёк количества — считаем что воды/донок НЕТ (чтобы не подмешивать лишнее).
            const hasQuantities = Object.keys(quantitiesByRow).length > 0;
            const hasSediment = hasQuantities ? toNum(quantitiesByRow[29]) > 0 : false;
            const hasSurfaceWater = hasQuantities ? toNum(quantitiesByRow[28]) > 0 : false;
            const hasGroundWater = hasQuantities ? toNum(quantitiesByRow[30]) > 0 : false;
            if (hasQuantities) {
              hasSedimentFromQuantities = hasSediment;
            }

            docXml = pruneProgramIeiSection42WaterBlocks({
              xml: docXml,
              rows: extracted42.rows,
              hasSediment,
              hasSurfaceWater,
              hasGroundWater,
            });

            // И синхронизируем сноски после таблицы
            docXml = applyProgramIeiSection42Footnotes({
              xml: docXml,
              hasSediment,
              hasSurfaceWater,
              hasGroundWater,
            });
          }

          // ППР: всегда вычищаем строку, если в поручении нет услуги/количества row=17
          // (даже если AI-фильтрация таблицы не сработала).
          {
            const toNum = (v: number | string | undefined): number => {
              if (v === undefined) return 0;
              if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
              const s = String(v).trim();
              if (!s || s === '-' || s === '–') return 0;
              const n = Number(s.replace(',', '.'));
              return Number.isFinite(n) ? n : 0;
            };
            const hasPPR =
              toNum(quantitiesByRow[17]) > 0 ||
              servicesFromOrder.some((s) => s.row === 17);
            docXml = pruneProgramIeiSection42PprRows({
              xml: docXml,
              rows: extracted42.rows,
              hasPPR,
            });
          }
        } catch (error) {
          console.error('[WordService] Ошибка обработки п.4.2:', error);
        }
      }
    }

    // --- П.4.3: Применяемые приборы, оборудование (условное удаление по флагам)
    docXml = replaceProgramIeiSection43Block({
      xml: docXml,
      orderFlags,
    });

    // --- П.4.4: Мероприятия по соблюдению требований к точности
    // (Зяблик, цвет, условные фразы про ДО)
    docXml = replaceProgramIeiSection44Block({
      xml: docXml,
      orderFlags,
      hasSedimentFromQuantities,
    });

    // --- П.4.5: Обоснование выбора методик прогноза (подставляем текст из ТЗ)
    docXml = replaceProgramIeiSection45Block({
      xml: docXml,
      section45Data,
    });

    // --- П.4.7: Организация выполнения полевых работ (условное удаление, слои грунта)
    {
      // Подсчёт уникальных площадок: ПП1=СК1, ПП2=СК2 и т.д.
      // Берём Platform напрямую, т.к. platformId - это cuid, а не "ПП1"
      const platforms = await this.prisma.platform.findMany({
        where: { projectId },
        select: { label: true, number: true },
      });
      
      // Извлекаем уникальные номера площадок: ПП1 и СК1 - это одна площадка (номер 1)
      const platformNumbers = new Set<number>();
      for (const p of platforms) {
        platformNumbers.add(p.number);
      }
      const uniquePlatformCount = platformNumbers.size;
      
      console.log('[WordService п.4.7] Platforms:', platforms.map(p => p.label), 'Уникальных:', uniquePlatformCount);

      // Фраза «В связи с запечатанностью... сокращено до двух точек» —
      // оставляем только если точек опробования ≤ 2; если больше — убираем.
      // Приоритет: площадки (ПП/СК / surfacePlatformCount) — это точки, не суммарные пробы по слоям.
      {
        const layersPlatformCount = section47LayersData?.surfacePlatformCount || 0;
        let points: number | null = null;
        if (uniquePlatformCount > 0) {
          points = uniquePlatformCount;
        } else if (layersPlatformCount > 0) {
          points = layersPlatformCount;
        } else if (soilSamplingPointsCount != null) {
          points = soilSamplingPointsCount;
        } else {
          const merged = Array.isArray((projectWithMergedServices as any)?.services)
            ? ((projectWithMergedServices as any).services as ServiceMatch[])
            : [];
          const toNum = (v: unknown): number => {
            if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
            const s = String(v ?? '').trim();
            if (!s || s === '-' || s === '–') return 0;
            const n = Number(s.replace(',', '.'));
            return Number.isFinite(n) ? n : 0;
          };
          let maxPoints = 0;
          let found = false;
          for (const row of [20, 22, 21]) {
            const n = toNum(merged.find((s) => s.row === row)?.quantity);
            if (n > 0) {
              found = true;
              maxPoints = Math.max(maxPoints, n);
            }
          }
          if (found) points = maxPoints;
        }

        console.log(
          `[WordService] Фраза про запечатанность/2 точки: points=${points}, platforms=${uniquePlatformCount}, layersPlatforms=${layersPlatformCount}, soilQty=${soilSamplingPointsCount}`,
        );
        if (points != null && points > 2) {
          docXml = this.removeParagraphByParaId(docXml, '053B59A9');
        }
      }

      docXml = replaceProgramIeiSection47Block({
        xml: docXml,
        orderFlags,
        layersData: section47LayersData,
        uniquePlatformCount,
      });
    }

    // --- П.6.1: Перечень нормативных документов (условное удаление/добавление)
    {
      // Определяем Москва или нет по адресу
      const addressForCheck = String(
        section1Data?.objectLocation || project.objectAddress || '',
      ).toLowerCase();
      const isMoscow =
        section31Data?.regionType === 'MOSCOW_CITY' ||
        (addressForCheck.includes('москва') &&
          !addressForCheck.includes('московская область') &&
          !addressForCheck.includes('моск. обл') &&
          !addressForCheck.includes('мо,'));

      docXml = replaceProgramIeiSection61Block({
        xml: docXml,
        orderFlags,
        isMoscow,
      });
    }

    // --- П.6.2: Материалы ранее выполненных ИИ (техотчёт из ТЗ или "Не используются")
    docXml = replaceProgramIeiSection62Block({
      xml: docXml,
      previousSurveyReport: section1Data?.previousSurveyReport,
    });

    // --- П.7.1: Представляемые отчетные материалы (условные части, удаление блока)
    docXml = replaceProgramIeiSection71Block({
      xml: docXml,
      orderFlags,
    });

    // --- П.7.2: Количество экземпляров технических отчетов (из п.21 ТЗ)
    docXml = replaceProgramIeiSection72Block({
      xml: docXml,
      section1Data,
    });

    // --- П.8.1: Краткая природно-хозяйственная характеристика территории
    // Заменяем шаблонное содержимое на текст из ТЗ (Сведения о существующих источниках загрязнения)
    const section81Data = tzText ? extractSection81FromTz(tzText) : null;
    docXml = replaceProgramIeiSection81Block({
      xml: docXml,
      section81Data,
    });

    // --- П.8.2: Предварительные сведения о загрязнении и экологических ограничениях
    // Берём текст из БД (редактируется пользователем в UI)
    docXml = replaceProgramIeiSection82Block({
      xml: docXml,
      section82Text: programIei?.section82Text,
    });

    // --- П.8.3 и 8.4: Обоснование границ (условное удаление фраз)
    // Определяем тип объекта через AI
    const objectNameForType = String(project.objectName || project.name || '');
    const objectTypeFlags = await this.aiService.determineObjectType(objectNameForType);
    docXml = replaceProgramIeiSection83And84Block({
      xml: docXml,
      objectTypeFlags,
    });

    // ЖЁСТКО: наименование объекта берём из БД и вбиваем в 2 paraId шаблона
    // (титульник и п.1.1). Это не зависит от AI/плейсхолдеров.
    {
      const objectNameFromDb = String(project.objectName || project.name || '').trim();
      if (objectNameFromDb) {
        docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '3F9ED9A3', objectNameFromDb);
        docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '6A987DB7', objectNameFromDb);
      }
    }

    // Финальная нормализация оформления:
    // 1. Убираем все highlight, shd и цветной текст → чёрный
    docXml = normalizeDocumentStyles(docXml);
    // 2. Дополнительная нормализация для старого кода
    docXml = this.normalizeGeneratedTextFormatting(docXml);
    // 3. Пробелы между runs, где в шаблоне слова слиплись
    docXml = fixMissingSpacesInDocxXml(docXml);

    // 4. Блок подписей в конце — строго как в шаблоне (не трогаем пробелы/разметку)
    docXml = restoreProgramIeiEndSignaturesBlock(docXml, endSignaturesBlock);

    // п.1.3 Наименование заказчика — подчёркивание всех ранов (HYPERLINK-раны теряют
    // подчёркивание после удаления rStyle "24", но они должны быть underlined)
    docXml = this.ensureUnderlineInParagraph(docXml, '64AE6358');

    // Заголовок «Программа инженерно-экологических изысканий» — uppercase
    docXml = docXml.replace(
      /(<w:p[^>]*w14:paraId="4A7786BB"[^>]*>[\s\S]*?<w:t[^>]*>)Программа\s*(<\/w:t>)/,
      '$1ПРОГРАММА $2',
    );
    docXml = docXml.replace(
      /(<w:p[^>]*w14:paraId="1231F572"[^>]*>[\s\S]*?<w:t[^>]*>)инженерно-экологических изысканий(<\/w:t>)/,
      '$1ИНЖЕНЕРНО-ЭКОЛОГИЧЕСКИХ ИЗЫСКАНИЙ$2',
    );
    
    zip.file('word/document.xml', docXml);

    // Заменяем плейсхолдеры в headers
    for (const headerFile of ['word/header1.xml', 'word/header2.xml']) {
      const header = zip.file(headerFile);
      if (header) {
        let headerXml = header.asText();
        headerXml = this.replacePlaceholders(headerXml, data);
        headerXml = normalizeDocumentStyles(headerXml);
        headerXml = this.normalizeGeneratedTextFormatting(headerXml);
        zip.file(headerFile, headerXml);
      }
    }

    // Заменяем плейсхолдеры и номер документа в footers
    const docNumber = project.documentNumber || '801-000-25';
    for (const footerFile of ['word/footer1.xml', 'word/footer2.xml']) {
      const footer = zip.file(footerFile);
      if (footer) {
        let footerXml = footer.asText();
        footerXml = this.replacePlaceholders(footerXml, data);
        footerXml = this.replaceDocumentNumber(footerXml, docNumber);
        footerXml = normalizeDocumentStyles(footerXml);
        footerXml = this.normalizeGeneratedTextFormatting(footerXml);
        zip.file(footerFile, footerXml);
      }
    }

    // Нормализуем styles.xml — убираем синий цвет и подчёркивание из Hyperlink
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
      let stylesXml = stylesFile.asText();
      // Убираем синий цвет из стилей
      stylesXml = stylesXml.replace(/w:val="0000FF"/gi, 'w:val="000000"');
      // Убираем подчёркивание из стилей (только <w:u w:val="..."/>, не <w:uiPriority>)
      stylesXml = stylesXml.replace(/<w:u w:val="[^"]*"\/>/g, '');
      zip.file('word/styles.xml', stylesXml);
    }

    // Заменяем обзорную схему (п.1.9.4) - это image2.png в шаблоне
    if (programIei?.overviewImageName) {
      const imagePath = join(process.cwd(), 'uploads', 'program-iei', programIei.overviewImageName);
      const imageBuffer = await readFile(imagePath);
      const ext = programIei.overviewImageName.split('.').pop()?.toLowerCase() || 'png';
      
      // Удаляем старый файл image2.png
      delete zip.files['word/media/image2.png'];
      
      // Добавляем новый файл
      zip.file(`word/media/image2.${ext}`, imageBuffer);
      
      // Обновляем ссылку в relationships (rId9 -> image2)
      const relsFile = zip.file('word/_rels/document.xml.rels');
      if (relsFile) {
        let relsXml = relsFile.asText();
        relsXml = relsXml.replace(/media\/image2\.\w+/g, `media/image2.${ext}`);
        zip.file('word/_rels/document.xml.rels', relsXml);
      }
      
      // Добавляем Content-Type для jpg если нужно
      if (ext === 'jpg' || ext === 'jpeg') {
        const ctFile = zip.file('[Content_Types].xml');
        if (ctFile) {
          let ctXml = ctFile.asText();
          if (!ctXml.includes('Extension="jpg"') && !ctXml.includes('Extension="jpeg"')) {
            ctXml = ctXml.replace('</Types>', '<Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
            zip.file('[Content_Types].xml', ctXml);
          }
        }
      }
    }

    // Генерируем буфер
    const buffer = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // Создаём папку и сохраняем файл
    await mkdir(this.outputDir, { recursive: true });

    const safeDocumentNumber = String(project.documentNumber || '801-000-25')
      .replace(/[^0-9A-Za-zА-Яа-яЁё-]/g, '')
      .substring(0, 40)
      .trim() || '801-000-25';
    const fileName = `${safeDocumentNumber}_ПЭ_${Date.now()}.docx`;
    const filePath = join(this.outputDir, fileName);

    await writeFile(filePath, buffer);

    // Сохраняем информацию о сгенерированном файле в БД
    await this.prisma.programIei.upsert({
      where: { projectId },
      create: {
        projectId,
        generatedFileName: fileName,
        generatedFileUrl: `/generated/${fileName}`,
        generatedAt: new Date(),
      },
      update: {
        generatedFileName: fileName,
        generatedFileUrl: `/generated/${fileName}`,
        generatedAt: new Date(),
      },
    });

    return { filePath, fileName };
  }

  /**
   * Генерирует программу инженерно-гидрометеорологических изысканий (ИГМИ).
   * Заполняет разделы до п.4 включительно, остальное оставляет как в шаблоне.
   * Использует paraId-замены (в ИГМИ-шаблоне нет HYPERLINK-плейсхолдеров).
   */
  async generateProgramIgmi(options: GenerateOptions): Promise<GeneratedWordResult> {
    const { projectId } = options;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });


    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    // ─── Извлечение данных из ТЗ — идентично ИЭИ ───
    let tzText: string | null = null;
    let section1Data: ProgramIeiSection1Data | null = null;

    if (project.tzFileUrl) {
      try {
        const tzPath = join(this.uploadsDir, project.tzFileUrl);
        const tzBuffer = await readFile(tzPath);
        const tzResult = await mammoth.extractRawText({ buffer: tzBuffer });
        tzText = tzResult.value;
        const templateSection1Text = await this.extractSection1FromTemplate();
        section1Data = await this.aiService.extractProgramIeiSection1(tzText, templateSection1Text);

        if (section1Data) {
          const merged = mergeSiteDescriptionWithArea({
            siteDescription: section1Data.siteDescription,
            siteArea: section1Data.siteArea,
            tzText: tzText,
          });
          section1Data.siteDescription = merged.siteDescription;
          if (!section1Data.siteArea && merged.siteAreaSentence) {
            section1Data.siteArea = merged.siteAreaSentence;
          }
        }
        console.log('[IGMI] AI извлёк данные раздела 1');
      } catch (error) {
        console.error('[IGMI] Ошибка чтения ТЗ или AI:', error);
      }
    }

    if (!section1Data) {
      section1Data = {
        objectName: project.objectName || project.name || '',
        objectLocation: project.objectAddress || '',
        clientName: project.clientName || '',
        clientOgrn: '',
        clientAddress: project.clientAddress || '',
        clientContactName: '',
        clientContactPhone: '',
        clientContactEmail: '',
        goalsAndTasks: '',
        objectPurpose: project.objectPurpose || '',
        transportInfrastructure: 'Нет',
        hazardousProduction: 'Нет',
        fireHazard: 'Нет данных',
        responsibilityLevel: 'Нормальный',
        permanentOccupancy: '',
        urbanPlanningActivity: '',
        surveyStage: 'Инженерные изыскания для подготовки проектной документации',
        technicalCharacteristics: '',
        excavationDepth: '',
        siteDescription: '',
        siteArea: '',
        technicalCustomerName: '',
        technicalCustomerDirectorPosition: 'Генеральный директор',
        technicalCustomerDirectorName: '',
        clientDirectorPosition: 'Директор',
        clientDirectorName: '',
        clientShortName: '',
        coordinates: null,
        cadastralNumber: '',
        backgroundConcentrationsRef: '',
        previousSurveyReport: '',
        reportCopiesText: '',
        contractorRole: 'Подрядчик',
        titleSignatories: [],
      };
    }

    // Подписанты — фолбэк ФИО из ТЗ (как в ИЭИ)
    if (section1Data.titleSignatories && section1Data.titleSignatories.length > 0) {
      for (const sig of section1Data.titleSignatories) {
        if (sig.name || !tzText || !sig.organization) continue;
        const orgShort = sig.organization
          .replace(/^(ООО|АО|ЗАО|ПАО|ГУП|МУП|ФГУП|ФГБУ)\s*[«"]/i, '')
          .replace(/[»"]\s*$/, '')
          .trim();
        if (orgShort.length < 3) continue;
        let searchFrom = 0;
        while (searchFrom < tzText.length) {
          const orgIdx = tzText.indexOf(orgShort, searchFrom);
          if (orgIdx === -1) break;
          const afterOrg = tzText.substring(orgIdx, orgIdx + orgShort.length + 150);
          const nameMatch = afterOrg.match(/([А-ЯЁ]\.[А-ЯЁ]\.[\s]?[А-ЯЁ][а-яё]{2,})/);
          if (nameMatch) { sig.name = nameMatch[1].trim(); break; }
          searchFrom = orgIdx + orgShort.length;
        }
      }
      section1Data.titleSignatories = applyProgramIeiApprovalHeaders(section1Data.titleSignatories);
    }

    // ─── ЕГРН из БД ───
    const programIei = await this.prisma.programIei.findUnique({
      where: { projectId },
    });

    const normalizeNearbyValue = (value: unknown, direction: string): string =>
      String(value ?? '')
        .trim()
        .replace(new RegExp(`^[Кк]\\s*${direction}\\s*:\\s*`, 'i'), '')
        .replace(/[;.]\s*$/, '')
        .trim();
    const nearbyFreeText = String(programIei?.nearbyText ?? '').trim();
    const nearbyLines = nearbyFreeText
      ? [nearbyFreeText]
      : [
          ['югу', 'К югу', programIei?.nearbySouth],
          ['востоку', 'К востоку', programIei?.nearbyEast],
          ['западу', 'К западу', programIei?.nearbyWest],
          ['северу', 'К северу', programIei?.nearbyNorth],
        ]
          .map(([direction, label, value]) => {
            const normalized = normalizeNearbyValue(value, String(direction));
            return normalized ? `${label}: ${normalized}` : '';
          })
          .filter(Boolean);

    let distanceFromOfficeKm: number | null = project.distanceKm ?? null;
    if (distanceFromOfficeKm == null) {
      const effectiveAddress =
        String(programIei?.customObjectAddress ?? '').trim() || project.objectAddress;
      if (effectiveAddress) {
        try {
          distanceFromOfficeKm = await this.distanceService.getDistanceToAddress(
            effectiveAddress,
            project.objectName || undefined,
          );
        } catch (error) {
          console.error('[IGMI] Ошибка расчёта расстояния до объекта:', error);
        }
      }
    }

    // ─── Загрузка ИГМИ-шаблона ───
    const templatePath = join(this.templateDir, 'игми', this.programIgmiTemplate);
    const templateContent = await readFile(templatePath, 'binary');
    const zip = new PizZip(templateContent);
    let docXml = zip.file('word/document.xml')?.asText() || '';
    const igmiEndBlock = extractProgramIeiEndSignaturesBlock(docXml);

    // ═══════════════════════════════════════════════════════
    // ТИТУЛ — paraId-замены (в ИГМИ нет HYPERLINK-плейсхолдеров)
    // ═══════════════════════════════════════════════════════

    // Наименование объекта — жёстко из БД
    const objectName = String(project.objectName || section1Data.objectName || project.name || '').trim();
    if (objectName) {
      docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '22CE0801', objectName);
      docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '1B932D72', objectName);
    }

    // Подписанты — переиспользуем динамическую генерацию из ИЭИ (paraId «Программа» = 45F9CC84)
    if (section1Data?.titleSignatories && section1Data.titleSignatories.length > 0) {
      docXml = replaceTitleSignatories({
        xml: docXml,
        signatories: section1Data.titleSignatories,
        contractorRole: section1Data.contractorRole || 'Подрядчик',
        programmaParaId: '45F9CC84',
      });
    } else {
      docXml = this.replaceCustomerTitleBlock(docXml, section1Data);
      docXml = this.replaceContractorRole(
        docXml,
        section1Data.contractorRole || 'Подрядчик',
      );
    }

    // ═══════════════════════════════════════════════════════
    // РАЗДЕЛ 1 — paraId-замены (для полей которые не HYPERLINK)
    // ═══════════════════════════════════════════════════════

    // 1.2 Местоположение объекта — точный адрес из наименования, если есть
    const objectLocation = resolveProgramIeiLocation12({
      objectName: project.objectName || section1Data.objectName || project.name,
      objectLocation: section1Data.objectLocation,
      projectAddress: project.objectAddress,
    });
    if (objectLocation) {
      docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '5FD52690', objectLocation);
    }

    // 1.3.1 Сведения о заказчике — первый заказчик, остальные удаляем
    {
      const clientLine1 = [
        section1Data.clientName || project.clientName || '',
        section1Data.clientOgrn ? `, ОГРН ${section1Data.clientOgrn}` : '',
      ].join('');
      const clientLine2 = section1Data.clientAddress || project.clientAddress || '';
      if (clientLine1) docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '6FDC7127', clientLine1);
      if (clientLine2) docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '704C104C', clientLine2);
      for (const pid of ['736B7648', '000744B0', '31E2B3A2', '34058FC7', '46449462', '2999382D']) {
        docXml = this.removeParagraphByParaId(docXml, pid);
      }
    }

    // 1.3.2 Контактное лицо
    {
      const contactParts = [
        section1Data.clientContactName || '',
        section1Data.clientContactPhone || '',
        section1Data.clientContactEmail || '',
      ].filter(Boolean);
      docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '67BAE660',
        contactParts.length > 0 ? contactParts.join(', ') : 'Нет данных');
    }

    // ═══════════════════════════════════════════════════════
    // ParaId-ЗАМЕНЫ — для полей без текстовых маркеров в ИГМИ
    // ═══════════════════════════════════════════════════════

    if (section1Data) {
      // 1.5 Цели и задачи (маркер «Инженерно-экологические изыскания» отсутствует в ИГМИ)
      if (section1Data.goalsAndTasks) {
        docXml = this.replaceParagraphTextWithBreaks(docXml, '0776C9D2', section1Data.goalsAndTasks);
      }

      // 1.6.1 Назначение объекта
      if (section1Data.objectPurpose || project.objectPurpose) {
        docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '0A50C18A',
          section1Data.objectPurpose || project.objectPurpose || '');
      }

      // 1.6.5 Уровень ответственности
      if (section1Data.responsibilityLevel) {
        docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '4B564305', section1Data.responsibilityLevel);
      }

      // 1.6.6 Наличие помещений с постоянным нахождением людей
      {
        const occupancyVal = section1Data.permanentOccupancy || 'Отсутствуют';
        docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '5E2E8280', occupancyVal);
      }

      // 1.8 Этап выполнения
      if (section1Data.surveyStage) {
        docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '5F0BF964', section1Data.surveyStage);
      }

      // 1.9.2 Границы площадки / описание территории (маркер отличается от ИЭИ)
      {
        const siteDesc = section1Data.siteDescription || objectLocation || '';
        if (siteDesc) {
          docXml = this.replaceParagraphTextWithBreaks(docXml, '148B1686', siteDesc);
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // TEXT_BASED ЗАМЕНЫ — работают и в ИЭИ, и в ИГМИ (маркеры совпадают)
    // ═══════════════════════════════════════════════════════

    if (section1Data) {
      // 1.7 Вид градостроительной деятельности
      docXml = this.replaceUrbanPlanningActivityOptions(docXml, section1Data.urbanPlanningActivity);

      // 1.6.2/1.6.3/1.6.4 — значения в таблице
      docXml = this.replaceSection162Value(docXml, section1Data.transportInfrastructure);
      docXml = this.replaceSection163Value(docXml, section1Data.hazardousProduction);
      docXml = this.replaceSection164Value(docXml, section1Data.fireHazard);

      // 1.9.1 Краткая техническая характеристика
      docXml = this.replaceTechnicalCharacteristicsBlock(docXml, section1Data.technicalCharacteristics);
    }

    // 1.10 ЕГРН — paraId-замены (маркеры «Кадастровый номер участка» отсутствуют в ИГМИ)
    {
      if (programIei?.cadastralNumber || programIei?.egrnDescription) {
        const cadastralNumbers = this.parseCadastralNumbers(programIei?.cadastralNumber || '');
        let cadastralText = '';
        if (cadastralNumbers.length === 1) {
          cadastralText = `Территория изысканий расположена в кадастровом квартале ${cadastralNumbers[0]}`;
        } else if (cadastralNumbers.length > 1) {
          cadastralText = `Территория изысканий расположена в кадастровых кварталах ${cadastralNumbers.join(', ')}`;
        }
        if (cadastralText) {
          docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '4F881704', cadastralText);
        }
        if (programIei?.egrnDescription) {
          docXml = this.replaceParagraphTextWithBreaks(docXml, '64264199', programIei.egrnDescription);
        }
      }
    }

    // 3.2 Окружение участка — ручные данные из интерфейса имеют приоритет.
    if (nearbyLines.length > 0) {
      docXml = this.replaceParagraphTextWithBreaks(
        docXml,
        '332D0BAC',
        nearbyLines.join('\n'),
      );
    } else {
      docXml = this.removeParagraphByParaId(docXml, '332D0BAC');
    }

    // 4.1 Расстояние от базы до участка.
    if (distanceFromOfficeKm != null && Number.isFinite(distanceFromOfficeKm)) {
      const distanceText = new Intl.NumberFormat('ru-RU', {
        maximumFractionDigits: 1,
      }).format(distanceFromOfficeKm);
      docXml = replaceParagraphTextByParaIdPreserveRunProps(
        docXml,
        '6A4D9E21',
        `Расстояние от базы изыскательской организации до участка изысканий: ${distanceText} км.`,
      );
    } else {
      docXml = this.removeParagraphByParaId(docXml, '6A4D9E21');
    }

    // ═══════════════════════════════════════════════════════
    // ОБЗОРНАЯ СХЕМА (п.1.9.3) — вставка нового изображения в ячейку
    // ═══════════════════════════════════════════════════════
    if (programIei?.overviewImageName) {
      try {
        const imagePath = join(process.cwd(), 'uploads', 'program-iei', programIei.overviewImageName);
        const imageBuffer = await readFile(imagePath);
        const ext = programIei.overviewImageName.split('.').pop()?.toLowerCase() || 'png';

        const mediaName = `igmi-overview.${ext}`;
        zip.file(`word/media/${mediaName}`, imageBuffer);

        const relsFile = zip.file('word/_rels/document.xml.rels');
        if (relsFile) {
          let relsXml = relsFile.asText();
          const usedRelationshipIds = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map(
            (match) => Number(match[1]),
          );
          const newRid = `rId${Math.max(0, ...usedRelationshipIds) + 1}`;
          relsXml = relsXml.replace(
            '</Relationships>',
            `<Relationship Id="${newRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`,
          );
          zip.file('word/_rels/document.xml.rels', relsXml);

          if (ext === 'jpg' || ext === 'jpeg') {
            const ctFile = zip.file('[Content_Types].xml');
            if (ctFile) {
              let ctXml = ctFile.asText();
              if (!ctXml.includes('Extension="jpg"') && !ctXml.includes('Extension="jpeg"')) {
                ctXml = ctXml.replace('</Types>',
                  '<Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
                zip.file('[Content_Types].xml', ctXml);
              }
            }
          }

          let imgWidthEmu = 5400000;
          let imgHeightEmu = 3600000;
          if (ext === 'png' && imageBuffer.length > 24) {
            const w = imageBuffer.readUInt32BE(16);
            const h = imageBuffer.readUInt32BE(20);
            if (w > 0 && h > 0) {
              const maxWidthEmu = 5400000;
              const ratio = h / w;
              imgWidthEmu = maxWidthEmu;
              imgHeightEmu = Math.round(maxWidthEmu * ratio);
            }
          }

          const usedDocPrIds = [...docXml.matchAll(/<wp:docPr[^>]*\bid="(\d+)"/g)].map(
            (match) => Number(match[1]),
          );
          const docPrId = Math.max(0, ...usedDocPrIds) + 1;
          const drawingXml =
            `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
            `<wp:extent cx="${imgWidthEmu}" cy="${imgHeightEmu}"/>` +
            `<wp:docPr id="${docPrId}" name="OverviewImage"/>` +
            `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
            `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
            `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
            `<pic:nvPicPr><pic:cNvPr id="0" name="${mediaName}"/><pic:cNvPicPr/></pic:nvPicPr>` +
            `<pic:blipFill><a:blip r:embed="${newRid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
            `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${imgWidthEmu}" cy="${imgHeightEmu}"/></a:xfrm>` +
            `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
            `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

          const targetParaId = '3180C077';
          const paraRe = new RegExp(
            `(<w:p[^>]*w14:paraId="${targetParaId}"[^>]*>)([\\s\\S]*?)(</w:p>)`,
          );
          docXml = docXml.replace(
            paraRe,
            (_m: string, open: string, body: string, close: string) => {
              const pPrMatch = body.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
              const pPr = pPrMatch ? pPrMatch[0] : '';
              return `${open}${pPr}${drawingXml}${close}`;
            },
          );
        }
      } catch (error) {
        console.error('[IGMI] Ошибка вставки обзорной схемы:', error);
      }
    }

    // ═══════════════════════════════════════════════════════
    // НОРМАЛИЗАЦИЯ СТИЛЕЙ (идентично ИЭИ)
    // ═══════════════════════════════════════════════════════
    docXml = normalizeDocumentStyles(docXml);
    docXml = this.normalizeGeneratedTextFormatting(docXml);
    docXml = fixMissingSpacesInDocxXml(docXml);
    docXml = restoreProgramIeiEndSignaturesBlock(docXml, igmiEndBlock);
    zip.file('word/document.xml', docXml);

    // Колонтитулы — номер документа
    const docNumber = project.documentNumber || '801-000-25';
    const docParts = docNumber.split('-');
    const year = docParts.length >= 3 ? docParts[2] : '25';
    const fullYear = year.length === 2 ? `20${year}` : year;

    const footerFiles = Object.keys(zip.files).filter((name) =>
      /^word\/footer\d+\.xml$/.test(name),
    );
    for (const footerFile of footerFiles) {
      const footer = zip.file(footerFile);
      if (footer) {
        let footerXml = footer.asText();
        footerXml = replaceTextAcrossWordRuns(
          footerXml,
          /№\s*801-[^-]*-\d{2}-ПГМ(?:-1)?/,
          `№ ${docNumber}-ПГМ-1`,
        );
        footerXml = replaceTextAcrossWordRuns(footerXml, /\b20\d{2}\b/, fullYear);
        footerXml = normalizeDocumentStyles(footerXml);
        zip.file(footerFile, footerXml);
      }
    }

    const headerFiles = Object.keys(zip.files).filter((name) =>
      /^word\/header\d+\.xml$/.test(name),
    );
    for (const headerFile of headerFiles) {
      const header = zip.file(headerFile);
      if (header) {
        let headerXml = header.asText();
        headerXml = normalizeDocumentStyles(headerXml);
        zip.file(headerFile, headerXml);
      }
    }

    // styles.xml
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
      let stylesXml = stylesFile.asText();
      stylesXml = stylesXml.replace(/w:val="0000FF"/gi, 'w:val="000000"');
      stylesXml = stylesXml.replace(/<w:u w:val="[^"]*"\/>/g, '');
      zip.file('word/styles.xml', stylesXml);
    }

    // ═══════════════════════════════════════════════════════
    // ГЕНЕРАЦИЯ ФАЙЛА + СОХРАНЕНИЕ В БД
    // ═══════════════════════════════════════════════════════
    const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    await mkdir(this.outputDir, { recursive: true });
    const safeDocumentNumber = String(project.documentNumber || '801-000-25')
      .replace(/[^0-9A-Za-zА-Яа-яЁё-]/g, '')
      .substring(0, 40).trim() || '801-000-25';
    const fileName = `${safeDocumentNumber}_ПГМИ_${Date.now()}.docx`;
    const filePath = join(this.outputDir, fileName);
    await writeFile(filePath, buffer);

    await this.prisma.programIei.upsert({
      where: { projectId },
      create: {
        projectId,
        igmiGeneratedFileName: fileName,
        igmiGeneratedFileUrl: `/generated/${fileName}`,
        igmiGeneratedAt: new Date(),
      },
      update: {
        igmiGeneratedFileName: fileName,
        igmiGeneratedFileUrl: `/generated/${fileName}`,
        igmiGeneratedAt: new Date(),
      },
    });

    return { filePath, fileName };
  }


      /**
   * Извлекает текст раздела 1 из шаблона программы ИЭИ для контекста AI
   */
  private async extractSection1FromTemplate(): Promise<string> {
    const templatePath = join(this.templateDir, this.programIeiTemplate);
    const buffer = await readFile(templatePath);
    const result = await mammoth.extractRawText({ buffer });
    const fullText = result.value;
    
    // Извлекаем раздел 1 (от "Общие сведения" до следующего раздела)
    const section1Start = fullText.indexOf('Общие сведения');
    const section2Start = fullText.indexOf('Изученность территории');
    
    if (section1Start !== -1 && section2Start !== -1) {
      return fullText.substring(section1Start, section2Start);
    }
    
    // Если не нашли точные границы - возвращаем первые 5000 символов
    return fullText.substring(0, 5000);
  }

  /**
   * Подготавливает данные для замены плейсхолдеров
   * Объединяет данные из AI (ТЗ) и данные проекта
   */
  private prepareProgramIeiData(
    project: any,
    aiData: ProgramIeiSection1Data | null,
  ): ProgramIeiData {
    // Извлекаем короткое название заказчика из кавычек (фоллбэк)
    const clientName = aiData?.clientName || project.clientName || '';
    const quotedMatch = clientName.match(/[«"]([^»"]+)[»"]/);
    const shortName = aiData?.clientShortName || (quotedMatch ? quotedMatch[1] : clientName);

    // objectName: БЕРЁМ ИЗ БАЗЫ (project.objectName), как было раньше. AI только запасной вариант.
    const objectName = String(project.objectName || aiData?.objectName || project.name || '').trim();

    // п.1.2: точный адрес из наименования; в БД по-прежнему краткое Москва/не Москва
    const addressFor12 = resolveProgramIeiLocation12({
      objectName,
      objectLocation: aiData?.objectLocation,
      projectAddress: project.objectAddress,
    });

    return {
      // Титульная страница
      Объект: objectName || project.name || '—',
      Адрес: addressFor12,
      // Технический заказчик (из ТЗ) - отдельная организация от заказчика!
      ДиректорДолжность: aiData?.technicalCustomerDirectorPosition || 'Генеральный директор',
      ДиректорФИО: aiData?.technicalCustomerDirectorName || '',
      НазваниеОрганизации: aiData?.technicalCustomerName || '',
      // Роль АО «РЭИ-ЭКОАУДИТ» из ТЗ: "Подрядчик" или "Исполнитель"
      РольПодрядчика: aiData?.contractorRole || 'Подрядчик',
      
      // 1.3 Сведения о заказчике
      Заказчик: clientName,
      ОГРН: aiData?.clientOgrn || '',
      ЮридическийАдрес: aiData?.clientAddress || project.clientAddress || '',
      КонтактноеЛицо: aiData?.clientContactName || '',
      НомерТелефона: aiData?.clientContactPhone || '',
      EMAIL: aiData?.clientContactEmail || '',
      
      // 1.5 Цели и задачи - БЕРЁТСЯ ПОЛНОСТЬЮ из ТЗ
      ЦелиИЗадачи: aiData?.goalsAndTasks || '',
      
      // 1.6 Идентификационные сведения
      ФункцНазначение: aiData?.objectPurpose || project.objectPurpose || '',
      ТранспортнаяИнфраструктура: aiData?.transportInfrastructure || 'Нет',
      ОпасноеПроизводство: aiData?.hazardousProduction || 'Нет',
      ПожарнаяОпасность: aiData?.fireHazard || 'Нет данных',
      УровеньОтветственности: aiData?.responsibilityLevel || 'Нормальный',
      НаличиеПомещений: aiData?.permanentOccupancy || '',
      
      // 1.7 Вид градостроительной деятельности
      ВидГрадДеятельности: aiData?.urbanPlanningActivity || '',
      
      // 1.8 Этап выполнения
      ЭтапВыполнения: aiData?.surveyStage || 'Инженерные изыскания для подготовки проектной документации',
      
      // 1.9 Характеристика объекта
      XrObject: aiData?.technicalCharacteristics || '',
      ГлубинаРабот: aiData?.excavationDepth || '',
      ПлощадьУчастка: '', // Не заполняем - площадь уже в siteDescription
      ОписаниеТерритории: aiData?.siteDescription || '',
      Глубина: aiData?.excavationDepth || '',
    };
  }

  /**
   * Заменяет плейсхолдеры HYPERLINK в XML и удаляет закраску фона
   * Структура: fldChar begin -> instrText HYPERLINK -> fldChar separate -> <w:t>ТЕКСТ</w:t> -> fldChar end
   */
  private replacePlaceholders(xml: string, data: ProgramIeiData): string {
    // Заменяем каждый плейсхолдер только если есть значение
    for (const [key, value] of Object.entries(data)) {
      // Пропускаем пустые значения - оставляем плейсхолдер
      if (!value || value.trim() === '') {
        continue;
      }

      // Паттерн для поиска HYPERLINK с плейсхолдером и текстом после separate
      // HYPERLINK \l "Ключ" ... fldCharType="separate" ... <w:t>Ключ</w:t> ... fldCharType="end"
      const pattern = new RegExp(
        `(HYPERLINK\\s+\\\\l\\s+&quot;${key}&quot;[^]*?fldCharType="separate"[^]*?<w:t[^>]*>)${key}(</w:t>)`,
        'g',
      );
      xml = xml.replace(pattern, `$1${this.escapeXml(value)}$2`);
    }

    // Удаляем закраску фона (highlight) у заполненных плейсхолдеров
    xml = this.removeHighlightFromFilledPlaceholders(xml, data);

    return xml;
  }

  /**
   * Удаляет закраску фона (w:highlight) для заполненных плейсхолдеров
   * Также удаляет все highlight в документе для чистого вида
   */
  private removeHighlightFromFilledPlaceholders(xml: string, data: ProgramIeiData): string {
    // Удаляем ВСЕ highlight элементы из документа для чистого вида
    // Это безопасно, так как highlight используется только для маркировки полей
    xml = xml.replace(/<w:highlight[^/]*\/>/g, '');
    xml = xml.replace(/<w:highlight[^>]*>[^<]*<\/w:highlight>/g, '');
    
    return xml;
  }

  private parseCadastralNumbers(raw: string): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((n: string) => n.trim());
    } catch {}
    return raw.trim() ? [raw.trim()] : [];
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
   * Заменяет текст "Подрядчик/Исполнитель" на правильную роль из ТЗ
   * В шаблоне на титульной странице есть текст "Подрядчик/Исполнитель",
   * который нужно заменить на "Подрядчик" или "Исполнитель" в зависимости от ТЗ
   */
  private replaceContractorRole(xml: string, role: string): string {
    const normalizedRole = role === 'Исполнитель' ? 'Исполнитель' : 'Подрядчик';
    
    // Простой случай: текст целиком в одном теге
    xml = xml.replace(
      />Подрядчик\/Исполнитель</g,
      `>${normalizedRole}<`,
    );
    
    // Случай когда текст разбит Word на части (Подрядчик + /Исполнитель или Подрядчик/ + Исполнитель)
    // Паттерн: <w:t>Подрядчик</w:t>...<w:t>/Исполнитель</w:t>
    xml = xml.replace(
      /(<w:t[^>]*>)Подрядчик(<\/w:t>[\s\S]*?<w:t[^>]*>)\/Исполнитель(<\/w:t>)/g,
      `$1${normalizedRole}$2$3`,
    );
    
    // Паттерн: <w:t>Подрядчик/</w:t>...<w:t>Исполнитель</w:t>
    xml = xml.replace(
      /(<w:t[^>]*>)Подрядчик\/(<\/w:t>[\s\S]*?<w:t[^>]*>)Исполнитель(<\/w:t>)/g,
      `$1${normalizedRole}$2$3`,
    );
    
    return xml;
  }

  /**
   * Заменяет блок "Цели и задачи инженерных изысканий" (п.1.5)
   * Находит все теги пункта 1.5, очищает их и вставляет текст из ТЗ
   */
  private replaceGoalsAndTasksBlock(xml: string, newText: string): string {
    if (!newText || newText.trim() === '') {
      return xml;
    }

    const startMarker = 'Инженерно-экологические изыскания';
    const endMarker = 'Идентификационные сведения';

    const markerPos = xml.indexOf(startMarker);
    const endPos = xml.indexOf(endMarker);

    if (markerPos === -1) {
      console.warn('[replaceGoalsAndTasksBlock] Не найден начальный маркер п.1.5');
      return xml;
    }

    // Отступаем до начала <w:t> тега, содержащего маркер
    const tTagStart = xml.lastIndexOf('<w:t', markerPos);
    if (tTagStart === -1) {
      return xml;
    }

    const sectionEndPos = endPos !== -1 ? endPos : markerPos + 5000;

    const beforeSection = xml.substring(0, tTagStart);
    const sectionXml = xml.substring(tTagStart, sectionEndPos);
    const afterSection = xml.substring(sectionEndPos);

    // Очищаем ВСЕ теги <w:t>...</w:t> в секции п.1.5 (убираем и атрибуты, и текст)
    let cleanedSection = sectionXml.replace(/<w:t[^>]*>[^<]*<\/w:t>/g, '<w:t></w:t>');

    // Вставляем текст из ТЗ в первый пустой тег
    const escapedNewText = this.escapeXml(newText);
    cleanedSection = cleanedSection.replace(
      /<w:t><\/w:t>/,
      `<w:t xml:space="preserve">${escapedNewText}</w:t>`,
    );

    return beforeSection + cleanedSection + afterSection;
  }

  /**
   * Заменяет п.1.9.1 "Краткая техническая характеристика объекта"
   * Создаёт ненумерованный список с дефисами в правой ячейке таблицы
   */
  private replaceTechnicalCharacteristicsBlock(xml: string, text: string): string {
    if (!text || text.trim() === '') {
      return xml;
    }

    // Маркеры границ строки таблицы с п.1.9.1
    const startMarker = 'Краткая техническая характеристика объекта';
    const endMarker = 'Глубина ведения земляных работ';
    
    const startPos = xml.indexOf(startMarker);
    if (startPos === -1) {
      console.warn('[replaceTechnicalCharacteristicsBlock] Не найден маркер п.1.9.1');
      return xml;
    }
    
    let endPos = xml.indexOf(endMarker, startPos + 1);
    if (endPos === -1) {
      endPos = startPos + 10000;
    }
    
    // Извлекаем секцию (строка таблицы)
    const beforeSection = xml.substring(0, startPos);
    const sectionXml = xml.substring(startPos, endPos);
    const afterSection = xml.substring(endPos);
    
    // В таблице Word: <w:tc> — ячейка. Левая ячейка содержит название, правая — значение.
    // Находим вторую ячейку <w:tc> после названия пункта (это правая колонка со значением)
    
    // Ищем закрывающий тег ячейки с названием и начало следующей ячейки
    const tcEndPos = sectionXml.indexOf('</w:tc>');
    if (tcEndPos === -1) {
      console.warn('[replaceTechnicalCharacteristicsBlock] Не найдена ячейка таблицы');
      return xml;
    }
    
    // Правая ячейка начинается после </w:tc> и <w:tc...>
    const rightCellStart = sectionXml.indexOf('<w:tc', tcEndPos);
    if (rightCellStart === -1) {
      console.warn('[replaceTechnicalCharacteristicsBlock] Не найдена правая ячейка');
      return xml;
    }
    
    // Находим конец правой ячейки
    const rightCellEnd = sectionXml.indexOf('</w:tc>', rightCellStart);
    if (rightCellEnd === -1) {
      console.warn('[replaceTechnicalCharacteristicsBlock] Не найден конец правой ячейки');
      return xml;
    }
    
    // Извлекаем правую ячейку
    const rightCell = sectionXml.substring(rightCellStart, rightCellEnd + 7);
    
    // Извлекаем свойства ячейки <w:tcPr>
    const tcPrMatch = rightCell.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
    const tcPr = tcPrMatch ? tcPrMatch[0] : '';
    
    // Извлекаем свойства абзаца из существующего контента
    const pPrMatch = rightCell.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    
    // Извлекаем свойства текста
    const rPrMatch = rightCell.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    const rPr = rPrMatch ? rPrMatch[0] : '';
    
    // Разбиваем текст на строки
    let lines = text.split(/\n/).map(line => line.trim()).filter(line => line);
    
    // Убираем вводную фразу из данных ТЗ (она будет добавлена отдельно с подчёркиванием)
    lines = lines.filter(line => {
      const lower = line.toLowerCase();
      return !lower.includes('на участке предусматривается') && 
             !lower.includes('предусматривается:') &&
             !lower.startsWith('на участке');
    });
    
    // Оставляем только строки с дефисом или добавляем дефис
    lines = lines.map(line => {
      // Если строка уже начинается с дефиса — оставляем как есть
      if (line.startsWith('-') || line.startsWith('–') || line.startsWith('—')) {
        return line;
      }
      // Если это пустая или служебная строка — пропускаем
      if (line.length < 3) {
        return null;
      }
      // Добавляем дефис к строке
      return `- ${line}`;
    }).filter((line): line is string => line !== null);
    
    // Первый абзац — «На участке предусматривается:» с подчёркиванием
    const underlineRPr = rPr
      ? rPr.replace('</w:rPr>', '<w:u w:val="single"/></w:rPr>')
      : '<w:rPr><w:u w:val="single"/></w:rPr>';
    const headerPara = `<w:p>${pPr}<w:r>${underlineRPr}<w:t xml:space="preserve">На участке предусматривается:</w:t></w:r></w:p>`;

    // Создаём абзацы для каждой строки списка
    const newParagraphs: string[] = [headerPara];
    for (const line of lines) {
      const escapedLine = this.escapeXml(line);
      const paragraph = `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapedLine}</w:t></w:r></w:p>`;
      newParagraphs.push(paragraph);
    }
    
    // Создаём новую правую ячейку с нашим контентом
    const newRightCell = `<w:tc>${tcPr}${newParagraphs.join('')}</w:tc>`;
    
    // Заменяем правую ячейку на новую
    const modifiedSection = 
      sectionXml.substring(0, rightCellStart) + 
      newRightCell + 
      sectionXml.substring(rightCellEnd + 7);
    
    return beforeSection + modifiedSection + afterSection;
  }

  /**
   * Заменяет п.1.9.2 "Глубина ведения земляных работ"
   * Создаёт ненумерованный список с дефисами в правой ячейке таблицы
   */
  private replaceExcavationDepthBlock(xml: string, text: string): string {
    if (!text || text.trim() === '') {
      return xml;
    }

    // Маркеры границ строки таблицы с п.1.9.2
    const startMarker = 'Глубина ведения земляных работ';
    const endMarker = 'Границы площадки';
    
    const startPos = xml.indexOf(startMarker);
    if (startPos === -1) {
      console.warn('[replaceExcavationDepthBlock] Не найден маркер п.1.9.2');
      return xml;
    }
    
    let endPos = xml.indexOf(endMarker, startPos + 1);
    if (endPos === -1) {
      endPos = startPos + 10000;
    }
    
    // Извлекаем секцию (строка таблицы)
    const beforeSection = xml.substring(0, startPos);
    const sectionXml = xml.substring(startPos, endPos);
    const afterSection = xml.substring(endPos);
    
    // Находим вторую ячейку <w:tc> (правая колонка со значением)
    const tcEndPos = sectionXml.indexOf('</w:tc>');
    if (tcEndPos === -1) {
      console.warn('[replaceExcavationDepthBlock] Не найдена ячейка таблицы');
      return xml;
    }
    
    const rightCellStart = sectionXml.indexOf('<w:tc', tcEndPos);
    if (rightCellStart === -1) {
      console.warn('[replaceExcavationDepthBlock] Не найдена правая ячейка');
      return xml;
    }
    
    const rightCellEnd = sectionXml.indexOf('</w:tc>', rightCellStart);
    if (rightCellEnd === -1) {
      console.warn('[replaceExcavationDepthBlock] Не найден конец правой ячейки');
      return xml;
    }
    
    // Извлекаем правую ячейку
    const rightCell = sectionXml.substring(rightCellStart, rightCellEnd + 7);
    
    // Извлекаем свойства ячейки
    const tcPrMatch = rightCell.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
    const tcPr = tcPrMatch ? tcPrMatch[0] : '';
    
    // Извлекаем свойства абзаца
    const pPrMatch = rightCell.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    
    // Извлекаем свойства текста
    const rPrMatch = rightCell.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    const rPr = rPrMatch ? rPrMatch[0] : '';
    
    // Разбиваем текст на строки
    let lines = text.split(/\n/).map(line => line.trim()).filter(line => line);
    
    // Убираем вводную фразу "Глубина ведения земляных работ:" если есть
    lines = lines.filter(line => {
      const lower = line.toLowerCase();
      return !lower.startsWith('глубина ведения земляных работ');
    });
    
    // Добавляем дефис к строкам если его нет
    lines = lines.map(line => {
      if (line.startsWith('-') || line.startsWith('–') || line.startsWith('—')) {
        return line;
      }
      if (line.length < 3) {
        return null;
      }
      return `- ${line}`;
    }).filter((line): line is string => line !== null);
    
    // Создаём новые абзацы для каждой строки
    const newParagraphs: string[] = [];
    for (const line of lines) {
      const escapedLine = this.escapeXml(line);
      const paragraph = `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapedLine}</w:t></w:r></w:p>`;
      newParagraphs.push(paragraph);
    }
    
    // Создаём новую правую ячейку с нашим контентом
    const newRightCell = `<w:tc>${tcPr}${newParagraphs.join('')}</w:tc>`;
    
    // Заменяем правую ячейку на новую
    const modifiedSection = 
      sectionXml.substring(0, rightCellStart) + 
      newRightCell + 
      sectionXml.substring(rightCellEnd + 7);
    
    return beforeSection + modifiedSection + afterSection;
  }

  /**
   * Заменяет значение п.1.6.2 "Принадлежность к объектам транспортной инфраструктуры"
   * Текст берётся из п.10.2 ТЗ и вставляется как есть
   */
  private replaceSection162Value(xml: string, value: string): string {
    if (!value || value.trim() === '') {
      return xml;
    }
    return this.replaceTableCellValue(
      xml, 
      'Принадлежность к объектам транспортной инфраструктуры',
      'Принадлежность к опасным',
      value,
    );
  }

  /**
   * Заменяет значение п.1.6.3 "Принадлежность к опасным производственным объектам"
   * Текст берётся из п.10.3 ТЗ и вставляется как есть
   */
  private replaceSection163Value(xml: string, value: string): string {
    if (!value || value.trim() === '') {
      return xml;
    }
    return this.replaceTableCellValue(
      xml,
      'производственным объектам',
      'Пожарная и взрывопожарная',
      value,
    );
  }

  /**
   * Заменяет значение п.1.6.4 "Пожарная и взрывопожарная опасность"
   * Текст берётся из п.10.4 ТЗ и вставляется как есть
   */
  private replaceSection164Value(xml: string, value: string): string {
    if (!value || value.trim() === '') {
      return xml;
    }
    return this.replaceTableCellValue(
      xml,
      'Пожарная и взрывопожарная',
      'Уровень ответственности',
      value,
    );
  }

  /**
   * Заменяет значение в ячейке таблицы после заголовка строки
   * Ищет строку по названию (startMarker), затем заменяет значение в следующей ячейке
   */
  private replaceTableCellValue(
    xml: string, 
    startMarker: string, 
    endMarker: string, 
    newValue: string,
  ): string {
    // Находим позицию названия строки
    const startPos = xml.indexOf(startMarker);
    if (startPos === -1) {
      console.warn(`[replaceTableCellValue] Не найден маркер: ${startMarker}`);
      return xml;
    }
    
    // Находим позицию следующей строки (конец текущей секции)
    let endPos = xml.indexOf(endMarker, startPos + 1);
    if (endPos === -1) {
      endPos = startPos + 3000; // fallback
    }
    
    // Извлекаем секцию между маркерами
    const beforeSection = xml.substring(0, startPos);
    const sectionXml = xml.substring(startPos, endPos);
    const afterSection = xml.substring(endPos);
    
    const escapedValue = this.escapeXml(newValue.trim());
    
    let modifiedSection = sectionXml;
    let replaced = false;
    
    // 1. Сначала пробуем заменить целые значения в одном теге
    const singleTagPatterns = [
      /(<w:t[^>]*>)\s*Не принадлежит\s*(<\/w:t>)/gi,
      /(<w:t[^>]*>)\s*Не пренадлежит\s*(<\/w:t>)/gi,
      /(<w:t[^>]*>)\s*Нет данных\s*(<\/w:t>)/gi,
      /(<w:t[^>]*>)\s*Не определена\s*(<\/w:t>)/gi,
    ];
    
    for (const pattern of singleTagPatterns) {
      const beforeReplace = modifiedSection;
      modifiedSection = modifiedSection.replace(pattern, `$1${escapedValue}$2`);
      if (modifiedSection !== beforeReplace) {
        replaced = true;
        break;
      }
    }
    
    // 2. Если не нашли целое значение, проверяем разбитый текст "Не" + "принадлежит"
    if (!replaced) {
      // Заменяем "Не " на значение (с пробелом после или без)
      const nePattern = /(<w:t[^>]*>)\s*Не\s*(<\/w:t>)/i;
      const prinadlezhitPattern = /(<w:t[^>]*>)\s*принадлежит\s*(<\/w:t>)/i;
      
      if (nePattern.test(modifiedSection) && prinadlezhitPattern.test(modifiedSection)) {
        // Заменяем "Не" на новое значение
        modifiedSection = modifiedSection.replace(nePattern, `$1${escapedValue}$2`);
        // Очищаем "принадлежит"
        modifiedSection = modifiedSection.replace(prinadlezhitPattern, '$1$2');
        replaced = true;
      }
    }
    
    // 3. Если всё ещё не нашли, пробуем заменить одиночное "Нет"
    if (!replaced && newValue.trim() !== 'Нет') {
      const beforeReplace = modifiedSection;
      modifiedSection = modifiedSection.replace(
        /(<w:t[^>]*>)\s*Нет\s*(<\/w:t>)/i,
        `$1${escapedValue}$2`,
      );
      if (modifiedSection !== beforeReplace) {
        replaced = true;
      }
    }
    
    return beforeSection + modifiedSection + afterSection;
  }

  /**
   * Удаляет лишний вариант в поле "Наличие помещений с постоянным нахождением людей" (п.1.6.6)
   * Оставляет только выбранное значение: "Предусмотрено" или "Отсутствуют"
   */
  private replacePermanentOccupancyOptions(xml: string, selectedValue: string): string {
    if (!selectedValue || selectedValue.trim() === '') {
      return xml;
    }

    const normalizedValue = selectedValue.trim().toLowerCase();
    
    if (normalizedValue.includes('предусмотрено')) {
      // Удаляем "Отсутствуют"
      xml = xml.replace(/<w:t[^>]*>\s*Отсутствуют\s*<\/w:t>/g, '<w:t></w:t>');
    } else if (normalizedValue.includes('отсутствуют')) {
      // Удаляем "Предусмотрено"
      xml = xml.replace(/<w:t[^>]*>\s*Предусмотрено\s*<\/w:t>/g, '<w:t></w:t>');
    }

    return xml;
  }

  /**
   * Заменяет данные ЗАКАЗЧИКА на титульной странице по paraId.
   * Нужно отдельно от общей замены плейсхолдеров, т.к. одинаковые плейсхолдеры
   * используются для технического заказчика и заказчика.
   * 
   * ParaId для блока ЗАКАЗЧИК на титуле:
   * - 464E563C: ДиректорДолжность (должность руководителя заказчика)
   * - 481DA297: НазваниеОрганизации (название организации заказчика)
   * - 2D94512F: ДиректорФИО (ФИО руководителя заказчика)
   */
  private replaceCustomerTitleBlock(xml: string, section1Data: ProgramIeiSection1Data): string {
    // Данные заказчика (из шапки/титула ТЗ)
    const customerPosition = section1Data.clientDirectorPosition || 'Генеральный директор';
    const customerName = section1Data.clientName || '';
    const customerDirectorName = section1Data.clientDirectorName || '';

    // Заменяем должность заказчика (paraId 464E563C)
    xml = this.replaceHyperlinkTextByParaId(xml, '464E563C', 'ДиректорДолжность', customerPosition);
    
    // Заменяем название организации заказчика (paraId 481DA297)
    xml = this.replaceHyperlinkTextByParaId(xml, '481DA297', 'НазваниеОрганизации', customerName);
    
    // Заменяем ФИО заказчика (paraId 2D94512F)
    xml = this.replaceHyperlinkTextByParaId(xml, '2D94512F', 'ДиректорФИО', customerDirectorName);

    // В ИГМИ плейсхолдеры заказчика присутствуют также в нижнем блоке титула.
    xml = replaceTextAcrossWordRuns(xml, /ДиректорДолжность/, customerPosition);
    xml = replaceTextAcrossWordRuns(xml, /НазваниеОрганизации/, customerName);
    xml = replaceTextAcrossWordRuns(xml, /ДиректорФИО/, customerDirectorName);

    return xml;
  }

  /**
   * Заменяет текст HYPERLINK плейсхолдера по paraId
   */
  private replaceHyperlinkTextByParaId(xml: string, paraId: string, placeholder: string, newValue: string): string {
    if (!newValue || newValue.trim() === '') {
      return xml;
    }

    // Паттерн для поиска параграфа по paraId с HYPERLINK плейсхолдером
    const paraPattern = new RegExp(
      `(<w:p\\b[^>]*w14:paraId="${paraId}"[^>]*>)([\\s\\S]*?)(</w:p>)`,
      'g',
    );

    return xml.replace(paraPattern, (match, openTag, content, closeTag) => {
      // Внутри параграфа заменяем текст плейсхолдера
      const placeholderPattern = new RegExp(
        `(HYPERLINK\\s+\\\\l\\s+&quot;${placeholder}&quot;[^]*?fldCharType="separate"[^]*?<w:t[^>]*>)${placeholder}(</w:t>)`,
        'g',
      );
      const newContent = content.replace(placeholderPattern, `$1${this.escapeXml(newValue)}$2`);
      return `${openTag}${newContent}${closeTag}`;
    });
  }

  /**
   * Удаляет лишние варианты в поле "Вид градостроительной деятельности" (п.1.7)
   * Оставляет только выбранное значение (как в ТЗ, 1:1)
   */
  private replaceUrbanPlanningActivityOptions(xml: string, selectedValue: string): string {
    if (!selectedValue || selectedValue.trim() === '') {
      return xml;
    }

    const allOptions = [...URBAN_PLANNING_ACTIVITY_OPTIONS];
    const normalizedSelected = selectedValue.trim();
    const normalizedLower = normalizedSelected.toLowerCase();

    // Находим совпадение со списком шаблона (или оставляем текст из ТЗ как есть)
    let matchedOption =
      allOptions.find((o) => o.toLowerCase() === normalizedLower) ||
      allOptions.find((o) => normalizedLower.includes(o.toLowerCase().substring(0, 15))) ||
      normalizedSelected;

    let keptOne = false;
    for (const option of allOptions) {
      const escapedOption = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(<w:t[^>]*>)\\s*${escapedOption}[^<]*(<\\/w:t>)`, 'gi');
      if (option.toLowerCase() === matchedOption.toLowerCase() && !keptOne) {
        xml = xml.replace(regex, `$1${this.escapeXml(matchedOption)}$2`);
        keptOne = true;
      } else {
        xml = xml.replace(regex, '$1$2');
      }
    }

    // Если в шаблоне не нашли ни одного варианта — подставляем текст в первый непустой слот списка
    if (!keptOne) {
      for (const option of allOptions) {
        const escapedOption = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(<w:t[^>]*>)\\s*${escapedOption}[^<]*(<\\/w:t>)`, 'i');
        if (regex.test(xml)) {
          xml = xml.replace(regex, `$1${this.escapeXml(matchedOption)}$2`);
          break;
        }
      }
    }

    return xml;
  }

  /**
   * Заменяет описание территории в п.1.9.3 "Границы площадки"
   * Данные берутся из п.12 ТЗ
   */
  private replaceSiteDescriptionBlock(xml: string, newDescription: string): string {
    if (!newDescription || newDescription.trim() === '') {
      return xml;
    }

    const escapedDescription = this.escapeXml(newDescription);

    // Простая строковая замена - ищем точный текст
    const searchText = 'Территория обследования расположена в поселении ';
    
    if (xml.includes(searchText)) {
      // Заменяем текст напрямую
      xml = xml.replace(
        new RegExp(`>Территория обследования расположена в поселении </w:t>`, 'g'),
        `>${escapedDescription}</w:t>`,
      );
      console.log('[WordService] Заменено описание территории на:', escapedDescription.substring(0, 50) + '...');
    } else {
      console.log('[WordService] ВНИМАНИЕ: Не найден текст "Территория обследования расположена в поселении "');
    }

    // Удаляем ВСЕ части старого шаблона п.1.9.3 - ТОЧНЫЕ строки из XML
    // Используем простую замену строк без regex
    const exactTextsToRemove = [
      '>Кокошкино</w:t>',
      '> Новомосковского административного округа г.Москвы</w:t>',
      '>. Проектируемая трасса начинается от пересечения ул.Железнодорожной с ул.Дачной и следует вдоль ул.Дачной до пересечения с ул.Школьной, далее трасса проходит вдоль застройки на северо-восток </w:t>',
      '>до границы с Московской областью.</w:t>',
      '>Площадь обследуемого участка – около </w:t>',
      '>Территория обследования расположена в Луховицком районе Московской области на пойме р.Оки на км 21,820 автодороги Белоомут – Ловцы в Луховицком районе Московской области.</w:t>',
      '>Территория обследования расположена в водоохранной зоне и прибрежной защитной полосе р.Москвы (Кожуховский затон).</w:t>',
    ];

    for (const text of exactTextsToRemove) {
      // Простая замена - заменяем ">текст</w:t>" на "></w:t>"
      xml = xml.split(text).join('></w:t>');
    }

    // Удаляем плейсхолдер ПлощадьУчастка и окружающий текст (площадь уже в siteDescription)
    xml = xml.split('>ПлощадьУчастка</w:t>').join('></w:t>');
    xml = xml.split('> га.</w:t>').join('></w:t>');
    xml = xml.split('>га.</w:t>').join('></w:t>');
    xml = xml.split('>около </w:t>').join('></w:t>');
    xml = xml.split('> га</w:t>').join('></w:t>');

    return xml;
  }

  /**
   * Заполняет пункт 1.10 данными из ЕГРН
   */
  private replaceEgrnBlock(xml: string, egrnData: EgrnData): string {
    const cadastralNumbers = this.parseCadastralNumbers(egrnData.cadastralNumber);
    if (cadastralNumbers.length > 0) {
      const label = cadastralNumbers.length === 1 ? 'Кадастровый номер участка' : 'Кадастровые номера участков';
      const joined = cadastralNumbers.map((n) => this.escapeXml(n)).join(', ');
      xml = xml.split('>Кадастровый номер участка</w:t>').join(
        `>${label}: ${joined}</w:t>`,
      );
    } else {
      xml = xml.split('>Кадастровый номер участка</w:t>').join(
        '></w:t>',
      );
    }

    // Формируем текст сведений из ЕГРН
    const egrnText = this.formatEgrnText(egrnData);
    
    // Заменяем "Прописать сведения из ЕГРН" на реальные данные
    xml = xml.split('>Прописать сведения из ЕГРН</w:t>').join(
      `>${this.escapeXml(egrnText)}</w:t>`,
    );

    return xml;
  }

  /**
   * Заменяет плейсхолдеры п.1.10 на "Нет данных" когда данные ЕГРН не заполнены
   */
  private replaceEgrnBlockWithNoData(xml: string): string {
    // Заменяем "Кадастровый номер участка" на "Нет данных"
    xml = xml.split('>Кадастровый номер участка</w:t>').join(
      '>Нет данных</w:t>',
    );
    
    // Удаляем "Прописать сведения из ЕГРН" (делаем пустым)
    xml = xml.split('>Прописать сведения из ЕГРН</w:t>').join(
      '></w:t>',
    );
    
    return xml;
  }

  /**
   * Форматирует данные ЕГРН в текст для документа
   */
  private formatEgrnText(egrnData: EgrnData & { customDescription?: string }): string {
    // Если есть кастомное описание из БД - используем его
    if (egrnData.customDescription) {
      return egrnData.customDescription;
    }

    const parts: string[] = [];

    if (egrnData.category) {
      parts.push(`Категория земель: ${egrnData.category}`);
    }

    if (egrnData.permittedUse) {
      parts.push(`Разрешённое использование: ${egrnData.permittedUse}`);
    }

    if (egrnData.area) {
      parts.push(`Площадь участка: ${egrnData.area} кв.м`);
    }

    if (egrnData.address) {
      parts.push(`Адрес: ${egrnData.address}`);
    }

    return parts.length > 0 ? parts.join('. ') + '.' : 'Данные не получены';
  }

  /**
   * Заполняет пункт 2.1 "Перечень исходных материалов и данных"
   * - Справка о фонах: в 2.1 только если заказчик предоставляет (галочка), иначе удаляем
   * - Техотчёт: если нет данных в ТЗ — удаляем параграф
   */
  private replaceSourceMaterialsBlock(
    xml: string,
    section1Data: ProgramIeiSection1Data,
    customerProvidesBackgroundConcentrations: boolean,
  ): string {
    // П.3 - Справка о фоновых концентрациях
    if (customerProvidesBackgroundConcentrations) {
      // Заказчик предоставляет — оставляем в 2.1, подставляем номер/дату из ТЗ если есть
      if (section1Data.backgroundConcentrationsRef) {
        xml = xml.split('>№ 312/15/05/ Э-574 от 28.02.2022</w:t>').join(
          `>${section1Data.backgroundConcentrationsRef}</w:t>`,
        );
      } else {
        xml = xml.split('>№ 312/15/05/ Э-574 от 28.02.2022</w:t>').join('></w:t>');
      }
    } else {
      // Мы заказываем сами — убираем из 2.1 (останется в 2.3)
      xml = xml.replace(
        /<w:p w14:paraId="76A91CB9"[^>]*>[\s\S]*?<\/w:p>/g,
        '',
      );
    }
    
    // П.4 - Технический отчет по результатам ИЭИ (п.22.3 ТЗ)
    const reportText = (section1Data.previousSurveyReport || '').trim();
    const isTemplateText = reportText.includes('736-00046-52018-19') || reportText.includes('РЭИ-Регион');
    if (reportText && !isTemplateText) {
      xml = xml.replace(
        />Технический отчет по результатам инженерно-экологических изысканий для подготовки проектной документации № 736-00046-52018-19[^<]*<\/w:t>/g,
        `>${this.escapeXml(reportText)}</w:t>`,
      );
    } else {
      xml = xml.replace(
        /<w:p[^>]*w14:paraId="792BA78F"[^>]*>[\s\S]*?<\/w:p>/g,
        ''
      );
    }
    
    return xml;
  }

  /**
   * Заполняет пункт 2.2 "Изученность территории" (шаблонный блок).
   *
   * Правила:
   * - Оставляем абзацы:
   *   1) "Материалы ранее выполненных..." (paraId="58FE7443")
   *   2) "При проведении ИЭИ возможно использование..." (paraId="5C01C57D")
   * - Удаляем из генерации абзацы 3–9 (фиксированные paraId в шаблоне)
   * - Абзац 10 (paraId="1982F7E3") добавляем только если в п.2.1 присутствует п.4
   *   (то есть есть `previousSurveyReport` из ТЗ)
   */
  private replaceStudyDegreeBlock(xml: string, section1Data: ProgramIeiSection1Data): string {
    // Абзацы 3, 5–9 из шаблона (удаляем всегда)
    const paraIdsToRemoveAlways = [
      '7A7DB2DB', // 3) и материалов инженерно-экологических...
      '60F05BD2', // 5) На части территории ...
      '0AD39382', // 6) При проведении ИЭИ возможно использование ... и результатов ИЭИ ...
      '7E6DA29B', // 7) Использование результатов ... невозможно ...
      '3071D664', // 8) В 2016 и 2017 гг. ...
      '4CA88345', // 9) Использование результатов изучения гидрологического режима ...
    ];

    for (const paraId of paraIdsToRemoveAlways) {
      // Удаляем весь параграф с нужным paraId
      xml = xml.replace(
        new RegExp(`<w:p[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?<\\/w:p>`, 'g'),
        '',
      );
    }

    // Абзац 4: "В ____ г. ... – Технический отчет (см. выше)."
    // Оставляем только если в п.2.1 присутствует техотчёт (previousSurveyReport),
    // при этом переписываем под наш техотчёт из ТЗ.
    const rawReport = (section1Data.previousSurveyReport || '').trim();
    const isReportTemplateText = rawReport.includes('736-00046-52018-19') || rawReport.includes('РЭИ-Регион');
    const hasPreviousSurveyReport = Boolean(rawReport) && !isReportTemplateText;
    if (hasPreviousSurveyReport) {
      const refText = this.formatPreviousSurveyReference(section1Data.previousSurveyReport);
      xml = this.replaceParagraphTextByParaId(xml, '61DBF39E', refText);
    } else {
      xml = this.removeParagraphByParaId(xml, '61DBF39E');
    }

    // Абзац 10: оставляем только если есть п.4 в 2.1 (previousSurveyReport)
    if (!hasPreviousSurveyReport) {
      xml = xml.replace(
        /<w:p[^>]*w14:paraId="1982F7E3"[^>]*>[\s\S]*?<\/w:p>/g,
        '',
      );
    }

    return xml;
  }

  private formatPreviousSurveyReference(previousSurveyReport: string): string {
    const src = String(previousSurveyReport || '').replace(/\s+/g, ' ').trim();

    // Год: берём последний год 19xx/20xx из строки
    const years = src.match(/\b(19\d{2}|20\d{2})\b/g) || [];
    const year = years.length > 0 ? years[years.length - 1] : '';

    // Объект: сначала пробуем "для объекта: «...», иначе первую «...»
    const obj1 = src.match(/для объекта[:\s]*[«"]([^»"]+)[»"]/i)?.[1]?.trim() || '';
    const obj2 = src.match(/[«"]([^»"]+)[»"]/)?.[1]?.trim() || '';
    const objectName = obj1 || obj2;

    if (year && objectName) {
      return `В ${year} г. на территории были выполнены инженерно-экологические изыскания для объекта «${objectName}» – Технический отчет (см. выше).`;
    }

    if (objectName) {
      return `На территории ранее были выполнены инженерно-экологические изыскания для объекта «${objectName}» – Технический отчет (см. выше).`;
    }

    return 'На территории ранее были выполнены инженерно-экологические изыскания – Технический отчет (см. выше).';
  }

  /**
   * Заполняет пункт 2.3 "Перечень материалов и данных, дополнительно получаемых..."
   *
   * Правила:
   * - Пункт про "Справка о фоновых концентрациях..." (paraId="3F0E763F")
   *   включаем только если в п.2.1 НЕТ соответствующего пункта (paraId="76A91CB9").
   * - Удаляем из генерации (всегда):
   *   - paraId="561BC5A7" (ООПТ федерального значения)
   *   - paraId="118C85D9" (полезные ископаемые)
   *   - paraId="533DE1BB" (рыбохозяйственная категория)
   *   - paraId="74CD0224" ("Не требуется")
   * - Остальные пункты (2–5) оставляем всегда.
   */
  private replaceAdditionalMaterialsBlock(xml: string): string {
    const hasBackgroundConcentrationsInSection21 = /w14:paraId="76A91CB9"/.test(xml);

    // Если справка уже есть в 2.1 — убираем её из 2.3
    if (hasBackgroundConcentrationsInSection21) {
      xml = xml.replace(
        /<w:p[^>]*w14:paraId="3F0E763F"[^>]*>[\s\S]*?<\/w:p>/g,
        '',
      );
    }

    const paraIdsToRemoveAlways = [
      '561BC5A7', // 6) ООПТ федерального значения
      '118C85D9', // 7) полезные ископаемые
      '533DE1BB', // 8) рыбохозяйственная категория
      '74CD0224', // финальная строка "Не требуется"
    ];

    for (const paraId of paraIdsToRemoveAlways) {
      xml = xml.replace(
        new RegExp(`<w:p[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?<\\/w:p>`, 'g'),
        '',
      );
    }

    return xml;
  }

  /**
   * Вспомогательный хелпер: удаляет параграф по w14:paraId
   */
  private removeParagraphByParaId(xml: string, paraId: string): string {
    return xml.replace(
      new RegExp(`<w:p[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?<\\/w:p>`, 'g'),
      '',
    );
  }

  /**
   * Вставляет новый абзац с текстом после абзаца с указанным paraId
   * Копирует стиль (pPr, rPr) из исходного абзаца
   */
  private insertParagraphAfterParaId(xml: string, paraId: string, newText: string): string {
    const escaped = this.escapeXml(newText);
    
    // Находим абзац с нужным paraId
    const re = new RegExp(
      `(<w:p[^>]*w14:paraId="${paraId}"[^>]*>)([\\s\\S]*?)(<\\/w:p>)`,
      'g',
    );
    
    // Стандартный rPr с курсивом (как в п.3.2)
    const defaultRPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:iCs/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="000000"/></w:rPr>';
    
    return xml.replace(re, (_m, open, body, close) => {
      const bodyStr = String(body);
      
      // Копируем pPr из исходного абзаца (без красной строки)
      const pPrMatch = bodyStr.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
      let pPr = pPrMatch ? pPrMatch[0] : '';
      // Убираем красную строку если есть
      pPr = pPr.replace(/<w:ind[^>]*w:firstLine[^>]*\/>/g, '');
      
      // Копируем rPr из первого run, добавляем курсив если нет
      const runMatch = bodyStr.match(/<w:r[^>]*>[\s\S]*?<\/w:r>/);
      let rPr = defaultRPr;
      if (runMatch) {
        const runRprMatch = runMatch[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
        if (runRprMatch) {
          rPr = runRprMatch[0];
          // Добавляем курсив если его нет
          if (!rPr.includes('<w:i/>') && !rPr.includes('<w:i ')) {
            rPr = rPr.replace('</w:rPr>', '<w:i/><w:iCs/></w:rPr>');
          }
        }
      }
      
      // Создаём новый абзац
      const newParagraph = `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
      
      // Возвращаем исходный абзац + новый
      return `${open}${body}${close}${newParagraph}`;
    });
  }

  /**
   * Вспомогательный хелпер: заменяет текст параграфа по w14:paraId,
   * сохраняя <w:pPr> и rPr (шрифт/размер) из исходного run.
   */
  private replaceParagraphTextByParaId(xml: string, paraId: string, newText: string): string {
    const escaped = this.escapeXml(newText);
    const re = new RegExp(
      `(<w:p[^>]*w14:paraId="${paraId}"[^>]*>)([\\s\\S]*?)(<\\/w:p>)`,
      'g',
    );

    // Стандартный rPr если в параграфе нет своего
    const defaultRPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="000000"/></w:rPr>';

    return xml.replace(re, (_m, open, body, close) => {
      const bodyStr = String(body);
      const pPrMatch = bodyStr.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
      const pPr = pPrMatch ? pPrMatch[0] : '';

      // Ищем rPr ТОЛЬКО внутри <w:r> (не в pPr!) - берём первый run
      const runMatch = bodyStr.match(/<w:r>[\s\S]*?<\/w:r>/);
      let rPr = defaultRPr;
      if (runMatch) {
        const runRprMatch = runMatch[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/);
        if (runRprMatch) {
          rPr = runRprMatch[0];
        }
      }

      // Чистим highlight/shd и принудительно ставим чёрный цвет
      rPr = rPr
        .replace(/<w:highlight[^/]*\/>/g, '')
        .replace(/<w:highlight[^>]*>[\s\S]*?<\/w:highlight>/g, '')
        .replace(/<w:shd[^/]*\/>/g, '')
        .replace(/<w:shd[^>]*>[\s\S]*?<\/w:shd>/g, '');

      if (rPr.includes('<w:color')) {
        rPr = rPr.replace(/<w:color[^/]*\/>/g, '<w:color w:val="000000"/>');
        rPr = rPr.replace(/<w:color[^>]*>[\s\S]*?<\/w:color>/g, '<w:color w:val="000000"/>');
      } else {
        rPr = rPr.replace('<w:rPr>', '<w:rPr><w:color w:val="000000"/>');
      }

      return `${open}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escaped}</w:t></w:r>${close}`;
    });
  }

  /**
   * Финальная нормализация оформления:
   * - перекрашиваем красный текст в чёрный, чтобы заполненные поля не выделялись
   */
  private ensureUnderlineInParagraph(xml: string, paraId: string): string {
    const paraRegex = new RegExp(
      `(<w:p[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?</w:p>)`,
    );
    return xml.replace(paraRegex, (paraXml) => {
      // Добавляем <w:u w:val="single"/> в каждый rPr, где его ещё нет
      return paraXml.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (match, inner) => {
        if (inner.includes('<w:u ')) return match;
        return `<w:rPr>${inner}<w:u w:val="single"/></w:rPr>`;
      });
    });
  }

  private normalizeGeneratedTextFormatting(xml: string): string {
    xml = xml.replace(/(<w:color[^>]*w:val=")FF0000(")/g, '$1000000$2');
    xml = xml.replace(/(<w:color[^>]*w:val=")ff0000(")/g, '$1000000$2');
    xml = xml.replace(/(<w:color[^>]*w:val=")red(")/g, '$1000000$2');
    return xml;
  }

  /**
   * Заполняет пункт 3.1 "Краткая физико-географическая характеристика района работ".
   *
   * Правила (по договорённости):
   * - Абзац про административное расположение берём по адресу (заменяем район в тексте).
   * - Из 4 ландшафтов оставляем только один, остальные удаляем.
   * - В климатическом абзаце убрано слово "Москва" перед температурой.
   * - Картинку (paraId="592EDF35") НЕ трогаем.
   */
  private replaceProgramIeiSection31Block(
    xml: string,
    section31Data: ProgramIeiSection31Data | null,
    section1Data: ProgramIeiSection1Data | null,
    project: any,
  ): string {
    const address = String(section1Data?.objectLocation || project?.objectAddress || '').trim();
    if (!address) {
      return xml;
    }

    // Определяем регион (Москва / МО) - сначала AI, затем эвристика по строке адреса
    const addressLower = address.toLowerCase();
    const inferredRegion: ProgramIeiSection31Data['regionType'] =
      section31Data?.regionType && section31Data.regionType !== 'UNKNOWN'
        ? section31Data.regionType
        : (addressLower.includes('московская область') ||
          addressLower.includes('моск. обл') ||
          addressLower.includes('мо,') ||
          addressLower.includes('обл.'))
          ? 'MOSCOW_OBLAST'
          : addressLower.includes('москва')
            ? 'MOSCOW_CITY'
            : 'UNKNOWN';

    // --- 3.1: административный абзац (paraId="3A032580")
    const tailMoscow =
      'Территория г.Москвы расположена в центральной части Восточно-Европейской равнины (Среднерусской возвышенности); в бассейне р.Москвы (левого притока Оки), в подзоне хвойно-широколиственных лесов.';
    const tailMo =
      'Территория Московского региона расположена в центральной части Восточно-Европейской равнины (Среднерусской возвышенности); в бассейне р.Москвы (левого притока Оки), в подзоне хвойно-широколиственных лесов.';

    const districtFromAi = String(section31Data?.moscowDistrict || '').trim();
    const districtFromTextMatch = address.match(/район\\s+([А-Яа-яЁё\\-\\s]+?)(?:,|\\.|\\s+г\\.|\\s+г\\s*\\.|\\s+Москва|$)/);
    const districtFromText = districtFromTextMatch ? String(districtFromTextMatch[1]).trim() : '';
    const district = districtFromAi || districtFromText;

    if (inferredRegion === 'MOSCOW_CITY') {
      const adminText = district
        ? `В административном отношении участок изысканий расположен в районе ${district} г.Москвы. ${tailMoscow}`
        : `В административном отношении участок изысканий расположен в г.Москве. ${tailMoscow}`;
      xml = this.replaceParagraphTextByParaId(xml, '3A032580', adminText);
    } else if (inferredRegion === 'MOSCOW_OBLAST') {
      const adminText = `В административном отношении участок изысканий расположен в Московской области. ${tailMo}`;
      xml = this.replaceParagraphTextByParaId(xml, '3A032580', adminText);
    }

    // --- 3.1: абзац "Территория обследования расположена ..." (paraId="67F16F92")
    // Для г. Москвы НЕ допускаем шаблонный текст про МО (Луховицы).
    // Если в siteDescription есть нужная фраза — подставляем её, иначе удаляем абзац.
    // Для МО/UNKNOWN — формируем по AI/из siteDescription/фоллбэк.
    if (inferredRegion === 'MOSCOW_CITY') {
      const siteDescription = String(section1Data?.siteDescription || '').trim();
      const m = siteDescription.match(/Территория обследования расположена[^.]*\./);
      if (m?.[0]) {
        xml = this.replaceParagraphTextByParaId(xml, '67F16F92', m[0].trim());
      } else {
        xml = this.removeParagraphByParaId(xml, '67F16F92');
      }
    } else {
      let territoryText = String(section31Data?.territoryLocationText || '').trim();

      if (!territoryText) {
        const siteDescription = String(section1Data?.siteDescription || '').trim();
        const m = siteDescription.match(/Территория обследования расположена[^.]*\./);
        if (m?.[0]) {
          territoryText = m[0].trim();
        }
      }

      if (!territoryText) {
        territoryText = `Территория обследования расположена по адресу: ${address}.`;
      }

      xml = this.replaceParagraphTextByParaId(xml, '67F16F92', territoryText);
    }

    // --- 3.1: ландшафты — оставляем все варианты из шаблона без изменений,
    // т.к. автоопределение работает ненадёжно. Пользователь удалит лишние вручную.

    // --- 3.1: климатический абзац (paraId="0F3987D3") - убираем слово "Москва" перед температурой
    const climateTextCorrected =
      'по схематической карте климатического районирования для строительства Московский регион относится к IIВ климатической зоне; среднегодовая температура воздуха – +5,9 ºС, минимальная среднемесячная температура воздуха наблюдается в январе – -7,0 ºС, максимальная в июле +19,2 ºС.';
    xml = this.replaceParagraphTextByParaId(xml, '0F3987D3', climateTextCorrected);

    return xml;
  }

  /**
   * Заполняет пункт 3.2 "Краткая характеристика природных условий..." (границы + условия).
   *
   * Источник данных (приоритет):
   * 1) ProgramIei из БД (введено пользователем через UI)
   * 2) AI-извлечение из ТЗ (section32Data)
   *
   * Если данных по направлению нет — строку удаляем, чтобы не оставлять неверный шаблонный текст.
   */
  private parseNearbyDirections(text: string): { south: string; east: string; west: string; north: string } {
    const markers = [
      { key: 'south' as const, prefix: /к\s*югу\s*:\s*/i },
      { key: 'east' as const, prefix: /к\s*востоку\s*:\s*/i },
      { key: 'west' as const, prefix: /к\s*западу\s*:\s*/i },
      { key: 'north' as const, prefix: /к\s*северу\s*:\s*/i },
    ];
    const result = { south: '', east: '', west: '', north: '' };
    const positions: { key: keyof typeof result; start: number; prefixEnd: number }[] = [];

    for (const m of markers) {
      const match = text.match(m.prefix);
      if (match && match.index !== undefined) {
        positions.push({ key: m.key, start: match.index, prefixEnd: match.index + match[0].length });
      }
    }
    positions.sort((a, b) => a.start - b.start);

    for (let i = 0; i < positions.length; i++) {
      const from = positions[i].prefixEnd;
      const to = i + 1 < positions.length ? positions[i + 1].start : text.length;
      result[positions[i].key] = text.slice(from, to).trim();
    }
    return result;
  }

  private replaceProgramIeiSection32Block(
    xml: string,
    programIei: any | null,
    section32Data: ProgramIeiSection32Data | null,
  ): string {
    const normalizeNearby = (value: string): string => {
      let v = String(value || '').trim();
      v = v.replace(/^[Кк]\s*(югу|востоку|западу|северу)\s*:\s*/i, '');
      v = v.replace(/[;.]\s*$/, '');
      return v.trim();
    };

    const getPrefer = (dbValue: unknown, aiValue?: string) => {
      const db = String(dbValue ?? '').trim();
      if (db) return db;
      const ai = String(aiValue ?? '').trim();
      return ai || '';
    };

    const PARA_NEARBY_HEADER = '504302FF';
    const PARA_SOUTH = '3DE2F9B1';
    const PARA_EAST = '5CD070FB';
    const PARA_WEST = '76F32DCE';
    const PARA_NORTH = '7A0BBC43';

    // --- Границы / окружение
    // nearbyText: любой текст из UI вставляем как есть (направления — опционально)
    let south = '';
    let east = '';
    let west = '';
    let north = '';
    let freeTextAsIs = '';

    const freeText = String(programIei?.nearbyText ?? '').trim();
    if (freeText) {
      const parsed = this.parseNearbyDirections(freeText);
      south = normalizeNearby(parsed.south);
      east = normalizeNearby(parsed.east);
      west = normalizeNearby(parsed.west);
      north = normalizeNearby(parsed.north);
      // Нет маркеров направлений — весь текст поля целиком
      if (!south && !east && !west && !north) {
        freeTextAsIs = freeText;
      }
    } else {
      south = normalizeNearby(getPrefer(programIei?.nearbySouth, section32Data?.nearbySouth));
      east = normalizeNearby(getPrefer(programIei?.nearbyEast, section32Data?.nearbyEast));
      west = normalizeNearby(getPrefer(programIei?.nearbyWest, section32Data?.nearbyWest));
      north = normalizeNearby(getPrefer(programIei?.nearbyNorth, section32Data?.nearbyNorth));
    }

    const hasAnyNearby = Boolean(freeTextAsIs || south || east || west || north);

    if (freeTextAsIs) {
      // Свободный текст — в первый абзац направлений, остальные убираем
      xml = this.replaceParagraphTextWithBreaks(xml, PARA_SOUTH, freeTextAsIs);
      xml = this.removeParagraphByParaId(xml, PARA_EAST);
      xml = this.removeParagraphByParaId(xml, PARA_WEST);
      xml = this.removeParagraphByParaId(xml, PARA_NORTH);
    } else {
      if (south) {
        xml = this.replaceParagraphTextWithBreaks(xml, PARA_SOUTH, `К югу: ${south};`);
      } else {
        xml = this.removeParagraphByParaId(xml, PARA_SOUTH);
      }

      if (east) {
        xml = this.replaceParagraphTextWithBreaks(xml, PARA_EAST, `К востоку: ${east};`);
      } else {
        xml = this.removeParagraphByParaId(xml, PARA_EAST);
      }

      if (west) {
        xml = this.replaceParagraphTextWithBreaks(xml, PARA_WEST, `К западу: ${west};`);
      } else {
        xml = this.removeParagraphByParaId(xml, PARA_WEST);
      }

      if (north) {
        xml = this.replaceParagraphTextWithBreaks(xml, PARA_NORTH, `К северу: ${north}.`);
      } else {
        xml = this.removeParagraphByParaId(xml, PARA_NORTH);
      }
    }

    // --- Степень запечатанности (площадь открытого грунта)
    const openGroundPercent = programIei?.openGroundPercent;
    if (openGroundPercent !== null && openGroundPercent !== undefined) {
      const sealingText = `Степень запечатанности и захламленности территории – площадь поверхности открытого грунта на участке составляет около ${openGroundPercent} %.`;
      // Вставляем после последнего существующего абзаца окружения
      const afterId = freeTextAsIs
        ? PARA_SOUTH
        : north
          ? PARA_NORTH
          : west
            ? PARA_WEST
            : east
              ? PARA_EAST
              : south
                ? PARA_SOUTH
                : PARA_NEARBY_HEADER;
      xml = this.insertParagraphAfterParaId(xml, afterId, sealingText);
    }

    // Если окружение не заполнено вообще — убираем строку "Вблизи участка изысканий расположены:"
    if (!hasAnyNearby) {
      xml = this.removeParagraphByParaId(xml, PARA_NEARBY_HEADER);
    }

    // --- Современное использование территории –
    if (section32Data?.currentLandUse?.trim()) {
      const lu = section32Data.currentLandUse.trim().replace(/[.;]\s*$/, '');
      xml = this.replaceParagraphTextByParaId(xml, '1B840970', `Современное использование территории – ${lu}.`);
    } else {
      xml = this.removeParagraphByParaId(xml, '1B840970');
    }

    // --- Условия/ограничения (только шаблонные фразы, без AI-отсебятины)
    const isRestricted = programIei?.isRestrictedObject === true;

    const inferConditionFromInputs = (): ProgramIeiSection32Data['territoryCondition'] => {
      // Режимный объект — только по галочке оператора
      if (isRestricted) return 'RESTRICTED';

      const aiCondition = section32Data?.territoryCondition || 'UNKNOWN';
      // AI-RESTRICTED игнорируем — только галочка
      if (aiCondition !== 'UNKNOWN' && aiCondition !== 'RESTRICTED') return aiCondition;

      const openGround = programIei?.openGroundPercent;
      const currentLandUse = String(section32Data?.currentLandUse || '').toLowerCase();
      const nearbyBlob = [freeTextAsIs, south, east, west, north].join(' ').toLowerCase();
      const context = `${currentLandUse} ${nearbyBlob}`;

      if (typeof openGround === 'number') {
        if (openGround >= 80) return 'OPEN_SOIL';
        if (openGround <= 5) return 'OCCUPIED_BY_BUILDING';
        return 'PARTIALLY_SEALED';
      }

      if (/(здан|строен|сооружен|помещени|корпус|цех)/i.test(context)) {
        return 'OCCUPIED_BY_BUILDING';
      }

      if (/(асфальт|тротуар|бетон|плит|парковк|дорог|запечатан)/i.test(context)) {
        return 'PARTIALLY_SEALED';
      }

      if (/(грунт|пустыр|газон|луг|лес|почв|открыт)/i.test(context)) {
        return 'OPEN_SOIL';
      }

      return 'PARTIALLY_SEALED';
    };

    const condition = inferConditionFromInputs();

    const cleanParen = (t: string) =>
      t.replace(/\s*\(если[^)]*\)\.?\s*$/i, '').trim();

    const setCondition = (keepParaId: string, fallbackText: string) => {
      for (const id of ['125D6552', '3D0D51B4', '5B90CB03', '5E5BD3BA']) {
        if (id !== keepParaId) {
          xml = this.removeParagraphByParaId(xml, id);
        }
      }
      xml = this.replaceParagraphTextByParaId(xml, keepParaId, cleanParen(fallbackText));
    };

    if (condition === 'OPEN_SOIL') {
      setCondition(
        '125D6552',
        'Ограничений для проведения в полном объеме радиационного обследования территории и геоэкологического опробования почв и грунтов не имеется.',
      );
    } else if (condition === 'OCCUPIED_BY_BUILDING') {
      setCondition(
        '5B90CB03',
        'Территория занята строением. Организация и выполнение работ осуществляются в соответствии с ППР.',
      );
    } else if (condition === 'RESTRICTED') {
      setCondition(
        '5E5BD3BA',
        'Режимный объект, требуется содействие Заказчика в получении допуска на территорию.',
      );
    } else {
      setCondition(
        '3D0D51B4',
        'Ограничений для проведения радиационного обследования территории не имеется, геоэкологическое опробование почв и грунтов будет выполнено в местах открытого грунта.',
      );
    }

    return xml;
  }

  /**
   * Заменяет номер документа в колонтитулах
   * Шаблон: 801-…-25-ПЭ-1 → 801-115-25-ПЭ-1
   * Структура XML: <w:t>801-</w:t>...<w:t>…</w:t>...<w:t>-25-ПЭ-1</w:t>
   */
  private replaceDocumentNumber(xml: string, docNumber: string): string {
    // Парсим номер документа (например: 801-115-25)
    const parts = docNumber.split('-');
    if (parts.length >= 3) {
      const prefix = parts[0]; // 801
      const middle = parts[1]; // 115
      const year = parts[2]; // 25

      // Заменяем шаблон "801-" + "…" + "-25" на реальные значения
      // Паттерн: <w:t>801-</w:t>...<w:t>…</w:t>...<w:t>-25-ПЭ-1</w:t>
      
      // Заменяем многоточие на средний номер
      xml = xml.replace(
        /(<w:t[^>]*>)…(<\/w:t>)/g,
        `$1${middle}$2`,
      );
      
      // Заменяем -25- на реальный год (если отличается)
      xml = xml.replace(
        /(<w:t[^>]*>)-25(-ПЭ-1<\/w:t>)/g,
        `$1-${year}$2`,
      );
    }

    return xml;
  }

  /**
   * Заменяет текст параграфа по paraId, поддерживая переносы строк (\n → <w:br/>).
   */
  private replaceParagraphTextWithBreaks(xml: string, paraId: string, text: string): string {
    const lines = text.split('\n');
    if (lines.length <= 1) {
      return this.replaceParagraphTextByParaId(xml, paraId, text);
    }

    const defaultRPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="000000"/></w:rPr>';

    const re = new RegExp(
      `(<w:p[^>]*w14:paraId="${paraId}"[^>]*>)([\\s\\S]*?)(<\\/w:p>)`,
      'g',
    );

    return String(xml).replace(re, (_m, open, body, close) => {
      const bodyStr = String(body);
      const pPrMatch = bodyStr.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
      const pPr = pPrMatch ? pPrMatch[0] : '';

      const runMatch = bodyStr.match(/<w:r>[\s\S]*?<\/w:r>/);
      let rPr = defaultRPr;
      if (runMatch) {
        const runRprMatch = runMatch[0].match(/<w:rPr[\s\S]*?<\/w:rPr>/);
        if (runRprMatch) {
          rPr = runRprMatch[0];
        }
      }
      rPr = rPr
        .replace(/<w:highlight[^/]*\/>/g, '')
        .replace(/<w:highlight[^>]*>[\s\S]*?<\/w:highlight>/g, '')
        .replace(/<w:shd[^/]*\/>/g, '')
        .replace(/<w:shd[^>]*>[\s\S]*?<\/w:shd>/g, '');
      if (rPr.includes('<w:color')) {
        rPr = rPr.replace(/<w:color[^/]*\/>/g, '<w:color w:val="000000"/>');
        rPr = rPr.replace(/<w:color[^>]*>[\s\S]*?<\/w:color>/g, '<w:color w:val="000000"/>');
      } else {
        rPr = rPr.replace('<w:rPr>', '<w:rPr><w:color w:val="000000"/>');
      }

      const runParts = lines.map((line, i) => {
        const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const br = i < lines.length - 1 ? '<w:br/>' : '';
        return `<w:t xml:space="preserve">${escaped}</w:t>${br}`;
      });

      return `${open}${pPr}<w:r>${rPr}${runParts.join('')}</w:r>${close}`;
    });
  }

  private buildProgramIgmiSection4WorksText(
    services: ServiceMatch[],
    quantitiesByRow: Record<number, number>,
  ): string {
    if (!services.length) {
      return 'Состав и объем работ уточняется по тексту поручения заказчика.';
    }

    const lines = services.map((service, index) => {
      const qty = quantitiesByRow[service.row];
      const qtyText = qty && qty > 0 ? ` — ${qty} ${service.unit || ''}`.trim() : '';
      return `${index + 1}. ${service.name}${qtyText}`;
    });

    return lines.join('\n');
  }

  private getParagraphDescriptors(xml: string): Array<{ paraId: string; text: string }> {
    const out: Array<{ paraId: string; text: string }> = [];
    const paragraphMatches = String(xml).match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];

    for (const p of paragraphMatches) {
      const paraIdMatch = p.match(/w14:paraId="([A-F0-9]+)"/i);
      if (!paraIdMatch) continue;

      const textMatches = p.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || [];
      if (!textMatches.length) continue;

      const text = textMatches
        .map((t) =>
          t
            .replace(/^<w:t[^>]*>/, '')
            .replace(/<\/w:t>$/, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim(),
        )
        .join('')
        .trim();

      if (!text) continue;
      out.push({ paraId: paraIdMatch[1], text });
    }

    return out;
  }

  private findParagraphAfterLabelParaId(
    xml: string,
    label: string,
    occurrence = 0,
  ): string | null {
    const paragraphs = this.getParagraphDescriptors(xml);
    const foundIndexes = paragraphs
      .map((p, i) => (p.text.includes(label) ? i : -1))
      .filter((i) => i >= 0);

    const labelIndex = foundIndexes[occurrence];
    if (labelIndex === undefined) return null;

    const target = paragraphs[labelIndex + 1];
    return target?.paraId || null;
  }

  private replaceParagraphAfterLabel(
    xml: string,
    label: string,
    newText: string,
    occurrence = 0,
  ): string {
    const text = String(newText || '').trim();
    if (!text) return xml;

    const paraId = this.findParagraphAfterLabelParaId(xml, label, occurrence);
    if (!paraId) return xml;

    return this.replaceParagraphTextWithBreaks(xml, paraId, text);
  }

  /**
   * Получает путь к сгенерированному файлу
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
   * Объединяет флаги из основного поручения и допотбора
   * Логика: если флаг true в любом из источников — он становится true
   */
  private mergeOrderFlags(
    base: ProgramIeiOrderFlags,
    child: ProgramIeiOrderFlags,
  ): ProgramIeiOrderFlags {
    return {
      hasWaterSampling: base.hasWaterSampling || child.hasWaterSampling,
      hasSedimentSampling: base.hasSedimentSampling || child.hasSedimentSampling,
      hasAirSampling: base.hasAirSampling || child.hasAirSampling,
      hasPhysicalImpacts: base.hasPhysicalImpacts || child.hasPhysicalImpacts,
      hasBuildingSurvey: base.hasBuildingSurvey || child.hasBuildingSurvey,
      isCommunicationNetworksObject: base.isCommunicationNetworksObject || child.isCommunicationNetworksObject,
      hasPPR: base.hasPPR || child.hasPPR,
      hasGasGeochemistry: base.hasGasGeochemistry || child.hasGasGeochemistry,
      hasSurfaceWater: base.hasSurfaceWater || child.hasSurfaceWater,
      hasGroundwater: base.hasGroundwater || child.hasGroundwater,
    };
  }

  /**
   * Объединяет слои грунта из основного поручения и допотбора
   * Логика: берём максимальную глубину и объединяем слои, увеличивая количества
   */
  private mergeSection47Layers(
    base: import('../ai/ai.service').Section47LayersData,
    child: import('../ai/ai.service').Section47LayersData,
  ): import('../ai/ai.service').Section47LayersData {
    // Берём максимальные значения
    const maxDepth = Math.max(base.maxDepth || 0, child.maxDepth || 0);
    const surfacePlatformCount = (base.surfacePlatformCount || 0) + (child.surfacePlatformCount || 0);
    const totalBoreholeCount = (base.totalBoreholeCount || 0) + (child.totalBoreholeCount || 0);

    // Объединяем слои: добавляем новые, увеличиваем кол-во существующих
    const layersMap = new Map<string, { from: number; to: number; count: number; platformNumbers?: number[] }>();

    // Сначала добавляем базовые слои
    for (const layer of base.layers || []) {
      const key = `${layer.from}-${layer.to}`;
      layersMap.set(key, { ...layer, platformNumbers: [...(layer.platformNumbers || [])] });
    }

    // Затем объединяем с дочерними
    for (const layer of child.layers || []) {
      const key = `${layer.from}-${layer.to}`;
      const existing = layersMap.get(key);
      if (existing) {
        // Увеличиваем количество
        existing.count = (existing.count || 0) + (layer.count || 0);
        // Объединяем номера площадок
        if (layer.platformNumbers) {
          existing.platformNumbers = [
            ...(existing.platformNumbers || []),
            ...layer.platformNumbers,
          ];
        }
      } else {
        // Добавляем новый слой
        layersMap.set(key, { ...layer, platformNumbers: [...(layer.platformNumbers || [])] });
      }
    }

    // Сортируем слои по глубине
    const mergedLayers = Array.from(layersMap.values()).sort((a, b) => a.from - b.from);

    return {
      maxDepth,
      surfacePlatformCount,
      totalBoreholeCount,
      layers: mergedLayers,
    };
  }
}

