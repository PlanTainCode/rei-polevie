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
import { mkdir, writeFile } from 'fs/promises';
import { PrismaService } from '../../prisma/prisma.service';

interface GenerateOptions {
  projectId: string;
  userId: string;
}

interface GeneratedWordResult {
  filePath: string;
  fileName: string;
}

@Injectable()
export class WordService {
  private readonly outputDir = join(process.cwd(), 'generated');

  constructor(private prisma: PrismaService) {}

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

    // Формируем данные
    const year = new Date().getFullYear().toString().slice(-2);
    const requestNumber = `${project.documentNumber || '000'}-${year}`;
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
}

