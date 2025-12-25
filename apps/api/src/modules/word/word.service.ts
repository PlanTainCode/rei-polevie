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
import * as PizZip from 'pizzip';
import * as mammoth from 'mammoth';
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
  pruneProgramIeiSection42WaterBlocks,
} from './program-iei/section-42-natural-conditions';
import { 
  replaceParagraphTextByParaIdPreserveRunProps,
  normalizeDocumentStyles,
} from './program-iei/docx-xml';
import { mergeSiteDescriptionWithArea } from './program-iei/site-boundaries';
import { replaceProgramIeiSection43Block } from './program-iei/section-43';
import { replaceProgramIeiSection44Block } from './program-iei/section-44';
import { replaceProgramIeiSection45Block } from './program-iei/section-45';
import { replaceProgramIeiSection47Block } from './program-iei/section-47';
import { replaceProgramIeiSection61Block } from './program-iei/section-61';
import { replaceProgramIeiSection62Block } from './program-iei/section-62';
import { replaceProgramIeiSection71Block } from './program-iei/section-71';
import { replaceProgramIeiSection81Block } from './program-iei/section-81';
import { extractSection81FromTz } from '../ai/program-iei/section-81';
import { replaceProgramIeiSection82Block } from './program-iei/section-82';
import { replaceProgramIeiSection83And84Block } from './program-iei/section-83-84';

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
  private readonly programIeiTemplate = 'Программа ИЭИ [EKkcZq].docx';

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

    // Получаем все дочерние проекты (доотборы) для объединения данных
    const childProjects = await this.prisma.project.findMany({
      where: { parentProjectId: projectId },
    });
    console.log(`[WordService] Найдено ${childProjects.length} доотборов для объединения`);

    // Извлекаем данные из ТЗ через AI
    let tzText: string | null = null;
    let section1Data: ProgramIeiSection1Data | null = null;
    let section31Data: ProgramIeiSection31Data | null = null;
    let section32Data: ProgramIeiSection32Data | null = null;
    let section45Data: ProgramIeiSection45Data | null = null;
    let orderFlags: ProgramIeiOrderFlags | null = null;
    let orderText: string | null = null;
    let section47LayersData: import('../ai/ai.service').Section47LayersData | null = null;
    
    // Массив текстов всех поручений (основное + доотборы)
    const allOrderTexts: string[] = [];
    
    console.log('[WordService] tzFileUrl:', project.tzFileUrl);
    console.log('[WordService] Project data:', {
      clientName: project.clientName,
      clientAddress: project.clientAddress,
      objectAddress: project.objectAddress,
      objectName: project.objectName,
    });
    
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
        clientDirectorPosition: 'Директор',
        clientDirectorName: '',
        clientShortName: '',
        coordinates: null,
        cadastralNumber: '',
        backgroundConcentrationsRef: '',
        previousSurveyReport: '',
      };
    }

    // П.3.1 (краткая физико-географическая характеристика) - определяем по адресу/местоположению
    {
      const addressFor31 = String(
        section1Data?.objectLocation || project.objectAddress || '',
      ).trim();

      if (addressFor31) {
        try {
          section31Data = await this.aiService.extractProgramIeiSection31(addressFor31);
          console.log('[WordService] AI извлёк данные пункта 3.1:', JSON.stringify(section31Data, null, 2));
        } catch (error) {
          console.error('[WordService] Ошибка AI для пункта 3.1:', error);
        }
      }
    }

    // Поручение: флаги состава работ для раздела 4 (п.4.1/4.2)
    // Собираем поручения: основное + все доотборы
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

    // Читаем поручения из доотборов и объединяем данные
    for (const child of childProjects) {
      if (child.orderFileUrl) {
        try {
          const childOrderPath = join(this.uploadsDir, child.orderFileUrl);
          const childOrderBuffer = await readFile(childOrderPath);
          const childOrderResult = await mammoth.extractRawText({ buffer: childOrderBuffer });
          const childOrderText = childOrderResult.value;
          allOrderTexts.push(childOrderText);

          // Извлекаем флаги из доотбора и объединяем с основными
          const objectNameForOrder = String(project.objectName || project.name || '').trim();
          const childFlags = await this.aiService.extractProgramIeiOrderFlags(childOrderText, objectNameForOrder);
          console.log(`[WordService] AI извлёк флаги из доотбора ${child.name}:`, JSON.stringify(childFlags, null, 2));

          // Объединяем флаги: если в доотборе флаг true — он становится true в итоге
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

          console.log(`[WordService] Обработан доотбор: ${child.name}`);
        } catch (error) {
          console.error(`[WordService] Ошибка чтения поручения доотбора ${child.name}:`, error);
        }
      }
    }

    // Объединяем все тексты поручений для AI анализа
    if (allOrderTexts.length > 0) {
      const combinedOrderText = allOrderTexts.join('\n\n--- ДООТБОР ---\n\n');
      orderText = combinedOrderText;
      if (allOrderTexts.length > 1) {
        console.log(`[WordService] Объединено ${allOrderTexts.length} поручений для анализа`);
      }
    }

    // Получаем данные ЕГРН из БД (приоритет) или по координатам
    let egrnData: EgrnData | null = null;
    
    // Сначала проверяем есть ли данные в БД (введены пользователем)
    const programIei = await this.prisma.programIei.findUnique({
      where: { projectId },
    });
    
    if (programIei?.cadastralNumber || programIei?.egrnDescription) {
      // Используем данные из БД
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
    } else if (section1Data?.coordinates) {
      // Fallback на получение по координатам
      try {
        egrnData = await this.aiService.getEgrnDataByCoordinates(
          section1Data.coordinates.lat,
          section1Data.coordinates.lon,
          section1Data.cadastralNumber,
        );
        console.log('[WordService] Получены данные по координатам:', egrnData);
      } catch (error) {
        console.error('[WordService] Ошибка получения данных:', error);
      }
    }

    // Объединяем услуги (services) из основного проекта и доотборов
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
    console.log(`[WordService] Объединено ${mergedServices.length} услуг из основного проекта и доотборов`);

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
    docXml = this.replacePlaceholders(docXml, data);
    
    // Специальные замены блоков текста
    if (section1Data) {
      docXml = this.replaceGoalsAndTasksBlock(docXml, section1Data.goalsAndTasks);
      docXml = this.replacePermanentOccupancyOptions(docXml, section1Data.permanentOccupancy);
      docXml = this.replaceUrbanPlanningActivityOptions(docXml, section1Data.urbanPlanningActivity);
      docXml = this.replaceSiteDescriptionBlock(docXml, section1Data.siteDescription);
    }
    
    // Заполняем пункт 1.10 данными ЕГРН
    if (egrnData) {
      docXml = this.replaceEgrnBlock(docXml, egrnData);
    }
    
    // Заполняем пункт 2.1 "Перечень исходных материалов и данных"
    if (section1Data) {
      docXml = this.replaceSourceMaterialsBlock(docXml, section1Data);
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
    // Используем проект с объединёнными услугами из доотборов
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
      const combinedOrderTextForSection42 = orderText || allOrderTexts.join('\n\n--- ДООТБОР ---\n\n');
      
      let servicesFromOrder: ServiceMatch[] = [];
      let quantitiesByRow: Record<number, number | string> = {};

      // Обрабатываем каждое поручение отдельно и суммируем количества
      for (let orderIdx = 0; orderIdx < allOrderTexts.length; orderIdx++) {
        const singleOrderText = allOrderTexts[orderIdx];
        const orderLabel = orderIdx === 0 ? 'основное' : `доотбор ${orderIdx}`;
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

          // Обновляем servicesFromOrder с объединёнными количествами
          for (const service of singleServices) {
            const existingIdx = servicesFromOrder.findIndex(s => s.row === service.row);
            const numQty = serviceQuantities[service.row] || 0;
            
            if (existingIdx >= 0) {
              // Увеличиваем количество существующей услуги
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
          const bioNeedle = 'Оценка биологического загрязнения';
          const bioTemplateLine =
            extracted42.rows.find((r) => String(r.title || '').includes(bioNeedle))?.title || '';
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
              (t: string) => t.startsWith('характеристика фонового загрязнения компонентов окружающей среды'),
              (t: string) => t.startsWith('характеристика современного состояния территории'),
              (t: string) => t.startsWith('описание растительного и животного мира участка'),
            ];

            extracted42.workRows.forEach((r, i) => {
              const lt = String(r.title || '').trim().toLowerCase();
              if (mustKeepPredicates.some((p) => p(lt))) forceKeepWorkIdxs.push(i);
            });
          }

          const mergedKeep = Array.from(
            new Set([...(match.keepWorkRowIndexes || []), ...forceKeepWorkIdxs]),
          );

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
                // paraId этой строки в шаблоне стабилен: 70A710D2
                docXml = replaceParagraphTextByParaIdPreserveRunProps(docXml, '70A710D2', bio.finalText);
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
          docXml = applyProgramIeiSection42NaturalConditionsTop10({
            xml: docXml,
            rows: extracted42.rows,
            section1Data,
            tzText,
            radiometryAreaHa: Object.keys(quantitiesByRow).length > 0 ? Number(String(quantitiesByRow[16] ?? '').replace(',', '.')) : undefined,
            orderFlags,
            project,
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

            // ВАЖНО: воду/донки считаем ТОЛЬКО по количествам из табличной части поручения (консервативно).
            // Если AI не извлёк количества — считаем что воды/донок НЕТ (чтобы не подмешивать лишнее).
            const hasQuantities = Object.keys(quantitiesByRow).length > 0;
            const hasSediment = hasQuantities ? toNum(quantitiesByRow[29]) > 0 : false;
            const hasSurfaceWater = hasQuantities ? toNum(quantitiesByRow[28]) > 0 : false;
            const hasGroundWater = hasQuantities ? toNum(quantitiesByRow[30]) > 0 : false;

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

    // --- П.4.4: Мероприятия по соблюдению требований к точности (удаляем "Зяблик", убираем цвет)
    docXml = replaceProgramIeiSection44Block({ xml: docXml });

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

    const safeObjectName = (project.objectName || project.name || 'Объект')
      .replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, '')
      .substring(0, 50)
      .trim();
    const fileName = `Программа_ИЭИ_${safeObjectName}_${Date.now()}.docx`;
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

    return {
      // Титульная страница
      Объект: objectName || project.name || '—',
      Адрес: aiData?.objectLocation || project.objectAddress || '',
      ДиректорДолжность: aiData?.clientDirectorPosition || 'Директор',
      ДиректорФИО: aiData?.clientDirectorName || '',
      НазваниеОрганизации: shortName,
      
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
   * Заменяет блок "Цели и задачи инженерных изысканий" (п.1.5)
   * Заменяет весь шаблонный текст новым текстом из ТЗ
   */
  private replaceGoalsAndTasksBlock(xml: string, newText: string): string {
    if (!newText || newText.trim() === '') {
      return xml;
    }

    const escapedNewText = this.escapeXml(newText);

    // Заменяем первую часть шаблонного текста на новый текст
    // Учитываем xml:space="preserve" в атрибутах
    xml = xml.replace(
      /(<w:t[^>]*>)Инженерно-экологические изыскания \(ИЭИ\) выполняют для оценки современного состояния\s*(<\/w:t>)/g,
      `$1${escapedNewText}$2`,
    );

    // Удаляем ВСЕ остальные части старого шаблонного текста п.1.5
    // Эти части идут после первого абзаца и не нужны
    const partsToRemove = [
      'территории \\(соврем, грунты\\)',
      '\\(соврем, грунты\\)',
      'и прогноза возможных изменений окружающей среды под влиянием техногенной нагрузки',
      '\\(для полного\\s+отчета\\)',
      'для полного\\s+отчета',
      'для экологического обоснования строительства',
      ', для обеспечения благоприятных условий жизни населения',
      'для обеспечения благоприятных условий жизни населения',
      'обеспечения безопасности зданий, сооружений, территории',
      'и предотвращения, снижения или ликвидации неблагоприятных воздействий на окружающую среду',
      'предотвращения, снижения или ликвидации неблагоприятных воздействий на окружающую среду',
    ];

    for (const part of partsToRemove) {
      const regex = new RegExp(`<w:t[^>]*>[^<]*${part}[^<]*<\\/w:t>`, 'gi');
      xml = xml.replace(regex, '<w:t></w:t>');
    }

    // Удаляем шаблонный второй абзац "Задачи ИЭИ определены..." из шаблона
    // (он уже есть в новом тексте из ТЗ)
    xml = xml.replace(
      /<w:t[^>]*>Задачи ИЭИ определены видом разрабатываемой градостроительной документации – подготовка проектной документации – и особенностями природной и техногенной обстановки территории изысканий –\s*<\/w:t>/g,
      '<w:t></w:t>',
    );

    // Удаляем варианты типов территории (они были после тире в шаблоне)
    const territoryTypes = [
      'бывшие земли с/х назначения',
      'складывающаяся городская среда',
      'земли объекта производственного назначения',
    ];

    for (const type of territoryTypes) {
      const regex = new RegExp(`<w:t[^>]*>\\s*${type}\\s*<\\/w:t>`, 'gi');
      xml = xml.replace(regex, '<w:t></w:t>');
    }

    return xml;
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
   * Удаляет лишние варианты в поле "Вид градостроительной деятельности" (п.1.7)
   * Оставляет только выбранное значение
   */
  private replaceUrbanPlanningActivityOptions(xml: string, selectedValue: string): string {
    if (!selectedValue || selectedValue.trim() === '') {
      return xml;
    }

    // Все возможные варианты из шаблона
    const allOptions = [
      'Архитектурно-строительное проектирование',
      'Капитальный ремонт',
      'Реконструкция',
      'Строительство',
      'Территориальное планирование',
      'Градостроительное зонирование',
      'Планировка территории',
      'Снос объектов капитального строительства',
      'Эксплуатация зданий, сооружений',
      'Комплексное развитие территории и их благоустройство',
    ];

    const normalizedSelected = selectedValue.trim().toLowerCase();

    // Удаляем все варианты кроме выбранного
    for (const option of allOptions) {
      if (!normalizedSelected.includes(option.toLowerCase().substring(0, 15))) {
        // Удаляем этот вариант из XML
        const escapedOption = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`<w:t[^>]*>\\s*${escapedOption}[^<]*<\\/w:t>`, 'gi');
        xml = xml.replace(regex, '<w:t></w:t>');
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
      '>Участок изысканий относится к Химкинскому коренному ландшафту Смоленско-Московской возвышенности.</w:t>',
      '>Участок изысканий относится к Москворецко-Грайворонскому коренному ландшафту долины р.Москвы.</w:t>',
      '>Участок изысканий относится к Москворецко-Сходненскому коренному ландшафту долины р.Москвы.</w:t>',
      '>Участок изысканий относится к Царицынскому коренному ландшафту Теплостанской возвышенности Москворецко-Окской физико-географической провинции</w:t>',
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
    // Заменяем "Кадастровый номер участка" на реальный кадастровый номер
    if (egrnData.cadastralNumber) {
      xml = xml.split('>Кадастровый номер участка</w:t>').join(
        `>Кадастровый номер участка: ${this.escapeXml(egrnData.cadastralNumber)}</w:t>`,
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
   * - Если нет данных в ТЗ - УДАЛЯЕМ весь параграф
   * - Если есть - заменяем данные
   */
  private replaceSourceMaterialsBlock(xml: string, section1Data: ProgramIeiSection1Data): string {
    // П.3 - Справка о фоновых концентрациях (п.22.5 ТЗ)
    if (section1Data.backgroundConcentrationsRef) {
      // Есть данные - заменяем номер/дату
      xml = xml.split('>№ Э-312/15/05/ Э-574 от 28.02.2022</w:t>').join(
        `>${section1Data.backgroundConcentrationsRef}</w:t>`
      );
    } else {
      // Нет данных - удаляем весь параграф (paraId="76A91CB9")
      // Параграф: <w:p w14:paraId="76A91CB9">...</w:p>
      xml = xml.replace(
        /<w:p w14:paraId="76A91CB9"[^>]*>[\s\S]*?<\/w:p>/g,
        ''
      );
    }
    
    // П.4 - Технический отчет по результатам ИЭИ (п.22.3 ТЗ)
    if (section1Data.previousSurveyReport) {
      // Есть данные - заменяем текст
      xml = xml.replace(
        />Технический отчет по результатам инженерно-экологических изысканий для подготовки проектной документации № 736-00046-52018-19[^<]*<\/w:t>/g,
        `>${this.escapeXml(section1Data.previousSurveyReport)}</w:t>`,
      );
    } else {
      // Нет данных - удаляем весь параграф (paraId="792BA78F")
      xml = xml.replace(
        /<w:p w14:paraId="792BA78F"[^>]*>[\s\S]*?<\/w:p>/g,
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
    const hasPreviousSurveyReport = Boolean(section1Data.previousSurveyReport?.trim());
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
   * - В климатическом абзаце убираем слово "Москва" если адрес относится к МО.
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

    // --- 3.1: ландшафты (оставляем только один)
    const landscapeMap: Record<ProgramIeiSection31Data['landscape'], string | null> = {
      HIMKI: '446E8C78',
      MOSKVORETSKO_GRAYVORONSKIY: '56FF4617',
      MOSKVORETSKO_SKHODNENSKIY: '00ED25F0',
      TSARITSYNSKIY: '79DFDC31',
      UNKNOWN: null,
    };

    const keepLandscapeParaId =
      (section31Data?.landscape && landscapeMap[section31Data.landscape]) ||
      // фоллбэк: оставляем наиболее "универсальный" вариант из шаблона
      '56FF4617';

    const allLandscapeParaIds = ['446E8C78', '56FF4617', '00ED25F0', '79DFDC31'];
    for (const paraId of allLandscapeParaIds) {
      if (paraId !== keepLandscapeParaId) {
        xml = this.removeParagraphByParaId(xml, paraId);
      }
    }

    // --- 3.1: климатический абзац (paraId="0F3987D3") - убираем "Москва" для МО
    if (inferredRegion === 'MOSCOW_OBLAST') {
      const climateText =
        'по схематической карте климатического районирования для строительства Московский регион относится к IIВ климатической зоне; Москва среднегодовая температура воздуха – +5,9 ºС, минимальная среднемесячная температура воздуха наблюдается в январе – -7,0 ºС, максимальная в июле +19,2 ºС.';
      const climateTextMo = climateText.replace(
        '; Москва среднегодовая температура воздуха',
        '; Среднегодовая температура воздуха',
      );
      xml = this.replaceParagraphTextByParaId(xml, '0F3987D3', climateTextMo);
    }

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
  private replaceProgramIeiSection32Block(
    xml: string,
    programIei: any | null,
    section32Data: ProgramIeiSection32Data | null,
  ): string {
    const normalizeNearby = (value: string): string => {
      let v = String(value || '').trim();
      v = v.replace(/^[Кк]\\s*(югу|востоку|западу|северу)\\s*:\\s*/i, '');
      v = v.replace(/[;.]\\s*$/, '');
      return v.trim();
    };

    const getPrefer = (dbValue: unknown, aiValue?: string) => {
      const db = String(dbValue ?? '').trim();
      if (db) return db;
      const ai = String(aiValue ?? '').trim();
      return ai || '';
    };

    // --- Границы (paraId из шаблона)
    const south = normalizeNearby(getPrefer(programIei?.nearbySouth, section32Data?.nearbySouth));
    const east = normalizeNearby(getPrefer(programIei?.nearbyEast, section32Data?.nearbyEast));
    const west = normalizeNearby(getPrefer(programIei?.nearbyWest, section32Data?.nearbyWest));
    const north = normalizeNearby(getPrefer(programIei?.nearbyNorth, section32Data?.nearbyNorth));

    const hasAnyNearby = Boolean(south || east || west || north);

    if (south) {
      xml = this.replaceParagraphTextByParaId(xml, '3DE2F9B1', `К югу: ${south};`);
    } else {
      xml = this.removeParagraphByParaId(xml, '3DE2F9B1');
    }

    if (east) {
      xml = this.replaceParagraphTextByParaId(xml, '5CD070FB', `К востоку: ${east};`);
    } else {
      xml = this.removeParagraphByParaId(xml, '5CD070FB');
    }

    if (west) {
      xml = this.replaceParagraphTextByParaId(xml, '76F32DCE', `К западу: ${west};`);
    } else {
      xml = this.removeParagraphByParaId(xml, '76F32DCE');
    }

    if (north) {
      xml = this.replaceParagraphTextByParaId(xml, '7A0BBC43', `К северу: ${north}.`);
    } else {
      xml = this.removeParagraphByParaId(xml, '7A0BBC43');
    }

    // Если окружение не заполнено вообще — убираем строку "Вблизи участка изысканий расположены:"
    // чтобы не оставлять пустой блок.
    if (!hasAnyNearby) {
      xml = this.removeParagraphByParaId(xml, '504302FF');
    }

    // --- Современное использование территории –
    if (section32Data?.currentLandUse?.trim()) {
      const lu = section32Data.currentLandUse.trim().replace(/[.;]\\s*$/, '');
      xml = this.replaceParagraphTextByParaId(xml, '1B840970', `Современное использование территории – ${lu}.`);
    } else {
      // Если данных нет — удаляем строку с тире, чтобы не было "Современное использование территории –"
      xml = this.removeParagraphByParaId(xml, '1B840970');
    }

    // --- Условия/ограничения (выбираем один из шаблонных вариантов)
    const condition = section32Data?.territoryCondition || 'UNKNOWN';
    const textFromAi = String(section32Data?.territoryConditionText || '').trim();

    const cleanParen = (t: string) =>
      t.replace(/\s*\\(если[^)]*\\)\\.?\\s*$/i, '').trim();

    const setCondition = (keepParaId: string, fallbackText: string) => {
      // Удаляем остальные варианты
      for (const id of ['125D6552', '3D0D51B4', '5B90CB03', '5E5BD3BA']) {
        if (id !== keepParaId) {
          xml = this.removeParagraphByParaId(xml, id);
        }
      }
      if (textFromAi) {
        xml = this.replaceParagraphTextByParaId(xml, keepParaId, textFromAi);
      } else {
        xml = this.replaceParagraphTextByParaId(xml, keepParaId, cleanParen(fallbackText));
      }
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
      // PARTIALLY_SEALED + UNKNOWN → используем наиболее универсальный вариант
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
   * Объединяет флаги из основного поручения и доотбора
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
   * Объединяет слои грунта из основного поручения и доотбора
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

