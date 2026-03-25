import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { extname, join } from 'path';
import { writeFile, mkdtemp, rm, mkdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { PDFDocument } from 'pdf-lib';
import { convertDocxToPdf } from '../inquiry-requests/pdf.utils';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import * as mammoth from 'mammoth';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
  AlignmentType,
  VerticalAlign,
  TextRun,
  PageOrientation,
  Footer,
  PageNumber,
  BorderStyle,
} from 'docx';

@Injectable()
export class GtsDefectStatementService {
  private readonly logger = new Logger(GtsDefectStatementService.name);
  private readonly sourceDir = join(process.cwd(), 'uploads', 'gts-dv', 'source');
  private readonly generatedDir = join(process.cwd(), 'uploads', 'gts-dv', 'generated');

  constructor(private prisma: PrismaService) {
    void this.ensureDirectories();
  }

  async generateForObject(objectId: string): Promise<{ filename: string; buffer: Buffer }> {
    const object = await this.prisma.gtsObject.findUnique({
      where: { id: objectId },
      include: {
        district: true,
        elements: { orderBy: { sortOrder: 'asc' } },
        monitoring: true,
      },
    });
    if (!object) throw new NotFoundException('Объект ГТС не найден');

    const docxBuffer = await this.generateSingleDV(object);
    await this.saveGeneratedForObject(object.id, object.number, object.settlement, docxBuffer);
    const safeName = `${object.number}_${object.settlement}`.replace(/[<>:"/\\|?*]/g, '_');
    return { filename: `ДВ_${safeName}.docx`, buffer: docxBuffer };
  }

  async generateForDistrict(districtId: string): Promise<{ filename: string; buffer: Buffer }> {
    const district = await this.prisma.gtsDistrict.findUnique({
      where: { id: districtId },
      include: {
        objects: {
          orderBy: { number: 'asc' },
          include: {
            elements: { orderBy: { sortOrder: 'asc' } },
            monitoring: true,
          },
        },
      },
    });
    if (!district) throw new NotFoundException('Район не найден');
    if (district.objects.length === 0) throw new NotFoundException('В районе нет объектов ГТС');

    const pdfBuffers: Buffer[] = [];
    for (const object of district.objects) {
      try {
        const docxBuffer = await this.generateSingleDV({ ...object, district });
        await this.saveGeneratedForObject(object.id, object.number, object.settlement, docxBuffer);
        const pdfBuffer = await this.convertDocxBufferToPdf(docxBuffer);
        pdfBuffers.push(pdfBuffer);
      } catch (err) {
        this.logger.error(`Ошибка генерации ДВ для объекта ${object.id}:`, err);
      }
    }

    if (pdfBuffers.length === 0) throw new Error('Не удалось сгенерировать ни одну ДВ');

    const mergedBuffer = await this.mergePdfBuffers(pdfBuffers);
    const safeName = district.name.replace(/[<>:"/\\|?*]/g, '_');
    return { filename: `ДВ_${safeName}.pdf`, buffer: mergedBuffer };
  }

  async uploadSourceForObject(objectId: string, file: Express.Multer.File) {
    const object = await this.prisma.gtsObject.findUnique({
      where: { id: objectId },
      include: {
        elements: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!object) throw new NotFoundException('Объект ГТС не найден');

    const normalizedOriginalName = this.normalizeOriginalFileName(file.originalname);
    const extension = extname(normalizedOriginalName).toLowerCase();
    if (extension !== '.docx') {
      throw new BadRequestException('Поддерживается только формат .docx для импорта данных из старой ДВ');
    }

    const storedName = `${object.id}-${randomUUID()}${extension}`;
    const sourcePath = join(this.sourceDir, storedName);
    await writeFile(sourcePath, file.buffer);

    const parsed = await this.parseSourceDefectStatement(file.buffer);
    const objectUpdateData: Record<string, any> = {
      sourceDvOriginalName: normalizedOriginalName,
      sourceDvStoredName: storedName,
      sourceDvUploadedAt: new Date(),
    };

    if (parsed.inspectionDate) objectUpdateData.inspectionDate = parsed.inspectionDate;
    if (parsed.inspectorName) objectUpdateData.inspectorName = parsed.inspectorName;
    if (parsed.overallCondition) objectUpdateData.overallCondition = parsed.overallCondition;
    if (parsed.ownerName) objectUpdateData.ownerName = parsed.ownerName;
    if (parsed.latitude) objectUpdateData.latitude = parsed.latitude;
    if (parsed.longitude) objectUpdateData.longitude = parsed.longitude;
    if (parsed.volume) objectUpdateData.volume = parsed.volume;
    if (parsed.area) objectUpdateData.area = parsed.area;
    if (parsed.hasTechnicalDoc !== null) objectUpdateData.hasTechnicalDoc = parsed.hasTechnicalDoc;

    await this.prisma.gtsObject.update({
      where: { id: object.id },
      data: objectUpdateData,
    });

    await this.applyParsedElements(object.elements, parsed.elements);
  }

  async getSourceFile(objectId: string): Promise<{ path: string; filename: string }> {
    const object = await this.prisma.gtsObject.findUnique({ where: { id: objectId } });
    if (!object) throw new NotFoundException('Объект ГТС не найден');
    if (!object.sourceDvStoredName || !object.sourceDvOriginalName) {
      throw new NotFoundException('Старая ДВ не загружена');
    }

    const sourcePath = join(this.sourceDir, object.sourceDvStoredName);
    if (!existsSync(sourcePath)) throw new NotFoundException('Файл старой ДВ не найден');
    return { path: sourcePath, filename: this.normalizeOriginalFileName(object.sourceDvOriginalName) };
  }

  async getGeneratedFile(objectId: string): Promise<{ path: string; filename: string }> {
    const object = await this.prisma.gtsObject.findUnique({ where: { id: objectId } });
    if (!object) throw new NotFoundException('Объект ГТС не найден');
    if (!object.generatedDvStoredName || !object.generatedDvOriginalName) {
      throw new NotFoundException('Сгенерированная ДВ отсутствует');
    }

    const generatedPath = join(this.generatedDir, object.generatedDvStoredName);
    if (!existsSync(generatedPath)) throw new NotFoundException('Файл сгенерированной ДВ не найден');
    let filename = this.normalizeOriginalFileName(object.generatedDvOriginalName);

    // Совместимость с уже сгенерированными ранее файлами: могли сохранить PDF под расширением .docx.
    if (filename.toLowerCase().endsWith('.docx')) {
      try {
        const signature = (await readFile(generatedPath)).subarray(0, 5).toString('utf8');
        if (signature === '%PDF-') {
          filename = filename.replace(/\.docx$/i, '.pdf');
        }
      } catch {
        // ignore read errors, вернем исходное имя
      }
    }

    return { path: generatedPath, filename };
  }

  private async generateSingleDV(object: any): Promise<Buffer> {
    const doc = this.buildDefectStatementDocument(object);
    return Packer.toBuffer(doc);
  }

  private buildDefectStatementDocument(object: any): Document {
    const inspectionDate = this.formatInspectionDate(object.inspectionDate);
    const coords = [object.latitude, object.longitude].filter(Boolean).join(' / ') || '—';
    const owner = object.ownerName || '—';
    const watercourse = object.watercourseName || '—';
    const volume = object.volume || '—';
    const area = object.area || '—';
    const districtName = object?.district?.name || '';
    const inspectorName = object.inspectorName || '________________';
    const overallCondition = object.overallCondition || '—';
    const settlement = object.settlement || '—';
    const objectAddress = `ГТС пруда на ${watercourse} у ${settlement} ${districtName} Курской области`.replace(/\s+/g, ' ').trim();

    const rows = (object.elements || []).map((el: any, idx: number) => {
      const technicalAndDefects = [
        el.technicalCondition ? `Техническое состояние: ${el.technicalCondition}` : '',
        el.defects ? `Выявленные дефекты: ${el.defects}` : '',
      ].filter(Boolean).join('\n');

      return new TableRow({
        children: [
          this.createTableCell(String(idx + 1), 3, false, AlignmentType.CENTER),
          this.createTableCell(el.name || '—', 17),
          this.createTableCell(el.characteristics || '—', 35),
          this.createTableCell(technicalAndDefects || '—', 25),
          this.createTableCell(el.recommendations || '—', 20),
        ],
      });
    });

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      },
      rows: [
        new TableRow({
          children: [
            this.createTableCell('№\nп/п', 3, true, AlignmentType.CENTER),
            this.createTableCell('Наименование ГТС', 17, true, AlignmentType.CENTER),
            this.createTableCell('Характеристика', 35, true, AlignmentType.CENTER),
            this.createTableCell('Техническое состояние,\nвыявленные дефекты', 25, true, AlignmentType.CENTER),
            this.createTableCell('Рекомендации', 20, true, AlignmentType.CENTER),
          ],
        }),
        ...rows,
      ],
    });

    return new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: PageOrientation.LANDSCAPE,
              },
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: 'Стр. ', font: 'Times New Roman', size: 22 }),
                    new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 22 }),
                  ],
                }),
              ],
            }),
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [new TextRun({ text: 'Дефектная ведомость ГТС', bold: true, underline: {}, size: 24, font: 'Times New Roman' })],
            }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { after: 180 },
              children: [new TextRun({ text: inspectionDate, bold: true, underline: {}, size: 24, font: 'Times New Roman' })],
            }),
            this.metaParagraph('Наименование и адрес объекта', objectAddress),
            this.metaParagraph('Наименование водотока', watercourse),
            this.metaParagraph('Наименование собственника ГТС', owner),
            this.metaParagraph('Географические координаты', coords),
            this.metaParagraph('Объем и площадь образованного водохранилища', `${volume}  тыс.м3; ${area}  га`),
            this.metaParagraph('Наличие технической документации (есть/нет)', `${object.hasTechnicalDoc ? 'есть' : 'нет'} - водохозяйственный паспорт`),
            this.metaParagraph(`Общее техническое состояние объекта: ${overallCondition}`),
            new Paragraph({ text: '' }),
            table,
            new Paragraph({ text: '' }),
            new Paragraph({
              spacing: { before: 240 },
              children: [new TextRun({ text: `Обследование выполнил: ___________ / ${inspectorName}`, font: 'Times New Roman', size: 24 })],
            }),
            new Paragraph({
              children: [new TextRun({ text: 'подпись              Ф.И.О.', italics: true, font: 'Times New Roman', size: 22 })],
            }),
          ],
        },
      ],
    });
  }

  private metaParagraph(label: string, value?: string): Paragraph {
    if (value === undefined) {
      return new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: label, size: 24, font: 'Times New Roman', bold: true })],
      });
    }
    return new Paragraph({
      spacing: { after: 130, line: 320 },
      children: [
        new TextRun({ text: `${label}: `, size: 24, font: 'Times New Roman', bold: true }),
        new TextRun({ text: value, size: 24, font: 'Times New Roman' }),
      ],
    });
  }

  private createTableCell(
    text: string,
    widthPct: number,
    isHeader = false,
    align:
      | 'center'
      | 'right'
      | 'left'
      | 'start'
      | 'end'
      | 'both'
      | 'mediumKashida'
      | 'distribute'
      | 'numTab'
      | 'highKashida'
      | 'lowKashida'
      | 'thaiDistribute' = AlignmentType.LEFT,
    underline = false,
  ): TableCell {
    const lines = (text || '—').split('\n');
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      verticalAlign: isHeader ? VerticalAlign.CENTER : VerticalAlign.TOP,
      shading: isHeader ? { fill: 'F2F2F2' } : undefined,
      children: lines.map((line) => new Paragraph({
        alignment: align,
        spacing: { after: 40 },
        children: [new TextRun({
          text: line || ' ',
          bold: isHeader,
          underline: underline ? {} : undefined,
          size: 22,
          font: 'Times New Roman',
        })],
      })),
    });
  }

  private formatInspectionDate(value: Date | string | null): string {
    if (!value) return '«___» __________ 20__ года';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '«___» __________ 20__ года';

    const day = date.toLocaleDateString('ru-RU', { day: '2-digit' });
    const month = date.toLocaleDateString('ru-RU', { month: 'long' });
    const year = date.toLocaleDateString('ru-RU', { year: 'numeric' });
    return `«${day}» ${month} ${year} года`;
  }

  private async ensureDirectories() {
    if (!existsSync(this.sourceDir)) await mkdir(this.sourceDir, { recursive: true });
    if (!existsSync(this.generatedDir)) await mkdir(this.generatedDir, { recursive: true });
  }

  private async saveGeneratedForObject(
    objectId: string,
    objectNumber: number,
    settlement: string,
    docxBuffer: Buffer,
  ) {
    const safeObjectName = `${objectNumber}_${settlement || 'ГТС'}`.replace(/[<>:"/\\|?*]/g, '_');
    const originalName = `ДВ_${safeObjectName}.docx`;
    const storedName = `${objectId}-${Date.now()}-${randomUUID()}.docx`;
    const generatedPath = join(this.generatedDir, storedName);
    await writeFile(generatedPath, docxBuffer);

    await this.prisma.gtsObject.update({
      where: { id: objectId },
      data: {
        generatedDvOriginalName: originalName,
        generatedDvStoredName: storedName,
        generatedDvGeneratedAt: new Date(),
      },
    });
  }

  private async convertDocxBufferToPdf(docxBuffer: Buffer): Promise<Buffer> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gts-dv-pdf-'));
    const tmpDocx = join(tmpDir, 'dv.docx');
    await writeFile(tmpDocx, docxBuffer);
    try {
      return await convertDocxToPdf(tmpDocx);
    } finally {
      try { await rm(tmpDir, { recursive: true }); } catch { /* ignore */ }
    }
  }

  private async parseSourceDefectStatement(buffer: Buffer): Promise<{
    inspectionDate: Date | null;
    inspectorName: string | null;
    overallCondition: string | null;
    ownerName: string | null;
    latitude: string | null;
    longitude: string | null;
    volume: string | null;
    area: string | null;
    hasTechnicalDoc: boolean | null;
    elements: Array<{
      name: string;
      characteristics: string;
      technicalCondition: string;
      defects: string;
      recommendations: string;
    }>;
  }> {
    const raw = await mammoth.extractRawText({ buffer });
    const html = await mammoth.convertToHtml({ buffer });
    const text = raw.value.replace(/\r/g, '').replace(/\u00A0/g, ' ');

    const inspectionDate = this.parseInspectionDate(text);
    const ownerName = this.extractByLabel(text, 'Наименование собственника ГТС');
    const overallCondition = this.extractByLabel(text, 'Общее техническое состояние объекта');
    const inspectorName = this.extractInspectorName(text);

    const coordinateMatch = text.match(/Географические координаты\s*:\s*([0-9.,\-]+)\s*\/\s*([0-9.,\-]+)/i);
    const latitude = coordinateMatch ? coordinateMatch[1].replace(',', '.').trim() : null;
    const longitude = coordinateMatch ? coordinateMatch[2].replace(',', '.').trim() : null;

    const volumeAreaMatch = text.match(/Объем.*?:\s*([0-9.,]+)[^;\n]*;\s*([0-9.,]+)/i);
    const volume = volumeAreaMatch ? volumeAreaMatch[1].replace(',', '.').trim() : null;
    const area = volumeAreaMatch ? volumeAreaMatch[2].replace(',', '.').trim() : null;

    const hasTechnicalDoc = this.parseHasTechnicalDoc(text);
    const elements = this.parseElementsFromHtml(html.value || '');

    return {
      inspectionDate,
      inspectorName,
      overallCondition,
      ownerName,
      latitude,
      longitude,
      volume,
      area,
      hasTechnicalDoc,
      elements,
    };
  }

  private parseInspectionDate(text: string): Date | null {
    const quoted = text.match(/«\s*(\d{1,2})\s*»\s*([А-Яа-яёЁ]+)\s*(\d{4})/);
    if (quoted) {
      const day = parseInt(quoted[1], 10);
      const month = this.russianMonthToNumber(quoted[2]);
      const year = parseInt(quoted[3], 10);
      if (month !== null) return new Date(Date.UTC(year, month, day));
    }

    const numeric = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
    if (!numeric) return null;
    const day = parseInt(numeric[1], 10);
    const month = parseInt(numeric[2], 10) - 1;
    const year = parseInt(numeric[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  private russianMonthToNumber(month: string): number | null {
    const normalized = month.trim().toLowerCase();
    const map: Record<string, number> = {
      января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5,
      июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11,
    };
    return normalized in map ? map[normalized] : null;
  }

  private extractByLabel(text: string, label: string): string | null {
    const regex = new RegExp(`${label}\\s*:\\s*([^\\n]+)`, 'i');
    const match = text.match(regex);
    if (!match) return null;
    const value = match[1].trim();
    return value || null;
  }

  private extractInspectorName(text: string): string | null {
    const match = text.match(/Обследование выполнил\s*:\s*[^\n/]*\/\s*([^\n]+)/i);
    if (!match) return null;
    const value = match[1].trim();
    return value || null;
  }

  private parseHasTechnicalDoc(text: string): boolean | null {
    const line = this.extractByLabel(text, 'Наличие технической документации \\(есть\\/нет\\)');
    if (!line) return null;
    const normalized = line.toLowerCase();
    if (normalized.includes('есть')) return true;
    if (normalized.includes('нет')) return false;
    return null;
  }

  private parseElementsFromHtml(html: string): Array<{
    name: string;
    characteristics: string;
    technicalCondition: string;
    defects: string;
    recommendations: string;
  }> {
    const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
    if (!tableMatch) return [];

    const tableHtml = tableMatch[0];
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    const rows = rowMatches
      .map((rowHtml) => {
        const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
        return cellMatches.map((cell) => this.stripHtml(cell));
      })
      .filter((cells) => cells.length >= 5);

    const dataRows = rows.filter((cells) => {
      const rowText = cells.join(' ').toLowerCase();
      return !rowText.includes('наименование гтс') && cells[1].trim().length > 0;
    });

    return dataRows.map((cells) => {
      const combined = cells[3] || '';
      const { technicalCondition, defects } = this.splitTechnicalAndDefects(combined);
      return {
        name: cells[1]?.trim() || '',
        characteristics: cells[2]?.trim() || '',
        technicalCondition,
        defects,
        recommendations: cells[4]?.trim() || '',
      };
    });
  }

  private splitTechnicalAndDefects(value: string): { technicalCondition: string; defects: string } {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return { technicalCondition: '', defects: '' };

    const technicalMatch = normalized.match(/Техническое состояние\s*:\s*(.*?)(?=Выявленные дефекты\s*:|$)/i);
    const defectsMatch = normalized.match(/Выявленные дефекты\s*:\s*(.*)$/i);
    const technicalCondition = technicalMatch?.[1]?.trim() || '';
    const defects = defectsMatch?.[1]?.trim() || '';

    if (!technicalCondition && !defects) {
      return { technicalCondition: normalized, defects: '' };
    }
    return { technicalCondition, defects };
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, '\'')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeName(value: string): string {
    return value.toLowerCase().replace(/[^a-zа-я0-9]+/gi, ' ').trim();
  }

  private normalizeOriginalFileName(name: string): string {
    if (!name) return name;
    const looksMojibake = /[ÐÑ]/.test(name);
    if (!looksMojibake) return name;

    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    const hasCyrillic = /[А-Яа-яЁё]/.test(decoded);
    return hasCyrillic ? decoded : name;
  }

  private async applyParsedElements(
    existingElements: Array<{ id: string; name: string }>,
    parsedElements: Array<{
      name: string;
      characteristics: string;
      technicalCondition: string;
      defects: string;
      recommendations: string;
    }>,
  ) {
    if (!parsedElements.length || !existingElements.length) return;

    const remaining = [...existingElements];
    for (let index = 0; index < parsedElements.length; index += 1) {
      const parsed = parsedElements[index];
      if (!parsed.name) continue;

      const normalizedParsedName = this.normalizeName(parsed.name);
      let targetIdx = remaining.findIndex((el) => this.normalizeName(el.name) === normalizedParsedName);
      if (targetIdx < 0) {
        targetIdx = remaining.findIndex(
          (el) => normalizedParsedName.includes(this.normalizeName(el.name)) || this.normalizeName(el.name).includes(normalizedParsedName),
        );
      }
      if (targetIdx < 0 && index < remaining.length) targetIdx = index;
      if (targetIdx < 0 || !remaining[targetIdx]) continue;

      const [target] = remaining.splice(targetIdx, 1);
      await this.prisma.gtsElement.update({
        where: { id: target.id },
        data: {
          characteristics: parsed.characteristics || null,
          technicalCondition: parsed.technicalCondition || null,
          defects: parsed.defects || null,
          recommendations: parsed.recommendations || null,
        },
      });
    }
  }

  private async mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
    if (buffers.length === 1) return buffers[0];

    const mergedPdf = await PDFDocument.create();
    for (const buf of buffers) {
      const srcPdf = await PDFDocument.load(buf);
      const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      for (const page of pages) {
        mergedPdf.addPage(page);
      }
    }
    const mergedBytes = await mergedPdf.save();
    return Buffer.from(mergedBytes);
  }
}
