import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as ExcelJS from 'exceljs';

interface ParsedGtsRow {
  number: number;
  watercourseName: string;
  settlement: string;
  yearBuilt: number | null;
  volume: string | null;
  area: string | null;
  safetyLevel: string | null;
  ownerName: string | null;
  latitude: string | null;
  longitude: string | null;
  districtName: string;
  elements: string[];
}

@Injectable()
export class GtsExcelParserService {
  private readonly logger = new Logger(GtsExcelParserService.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads');

  constructor(private prisma: PrismaService) {}

  async parseAndImport(monitoringId: string, file: Express.Multer.File) {
    const ext = extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    const filePath = join(this.uploadsDir, uniqueName);

    if (!existsSync(this.uploadsDir)) {
      await mkdir(this.uploadsDir, { recursive: true });
    }
    await writeFile(filePath, file.buffer);

    const rows = await this.parseExcel(file.buffer);
    if (rows.length === 0) {
      throw new BadRequestException(
        'Не удалось распознать строки ГТС в Excel. Проверьте формат файла (районы и нумерацию).',
      );
    }
    await this.importRows(monitoringId, rows);
    await this.prisma.gtsMonitoring.update({
      where: { id: monitoringId },
      data: {
        sourceFileName: file.originalname,
        sourceFileUrl: `/uploads/${uniqueName}`,
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Импортировано ${rows.length} ГТС для мониторинга ${monitoringId}`);
  }

  private async parseExcel(buffer: Buffer): Promise<ParsedGtsRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('Лист не найден в Excel файле');

    const rows: ParsedGtsRow[] = [];
    let currentDistrict = '';

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 1) return;

      const values = row.values as any[];
      if (!values || values.length < 3) return;

      const rowTexts = values
        .slice(1)
        .map((cell) => this.getCellText(cell))
        .map((text) => text.trim())
        .filter(Boolean);
      if (rowTexts.length === 0) return;

      const firstCell = this.getCellText(values[1]);
      const num = this.extractObjectNumber(firstCell);

      const districtCandidate = this.detectDistrictName(rowTexts);
      if (districtCandidate && num === null) {
        currentDistrict = districtCandidate;
        return;
      }

      if (num === null || !currentDistrict) return;

      const watercourseName = this.getCellText(values[2]);
      const settlement = this.getCellText(values[3]);
      if (!watercourseName && !settlement) return;

      const yearBuilt = parseInt(this.getCellText(values[4]), 10) || null;
      const volume = this.getCellText(values[5]) || null;
      const area = this.getCellText(values[6]) || null;
      const safetyLevel = this.getCellText(values[7]) || null;
      const ownerName = this.getCellText(values[8]) || null;
      const latitude = this.getCellText(values[9]) || null;
      const longitude = this.getCellText(values[10]) || null;

      const elements = this.detectElements(watercourseName, settlement);

      rows.push({
        number: num,
        watercourseName,
        settlement,
        yearBuilt,
        volume,
        area,
        safetyLevel,
        ownerName,
        latitude,
        longitude,
        districtName: currentDistrict,
        elements,
      });
    });

    return rows;
  }

  private extractObjectNumber(value: string): number | null {
    const cleaned = value.trim();
    if (!cleaned) return null;
    const match = cleaned.match(/^\d+/);
    if (!match) return null;
    const parsed = parseInt(match[0], 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private detectDistrictName(rowTexts: string[]): string | null {
    const withDistrictWord = rowTexts.find((text) => /\bрайон\b/i.test(text));
    if (withDistrictWord) return withDistrictWord.trim();

    // Для merged-строк Excel: район часто дублируется в большинстве ячеек строки.
    const counts = new Map<string, { original: string; count: number }>();
    for (const text of rowTexts) {
      const key = this.normalizeText(text);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { original: text.trim(), count: 1 });
      }
    }

    let top: { original: string; count: number } | null = null;
    for (const value of counts.values()) {
      if (!top || value.count > top.count) top = value;
    }

    if (!top) return null;

    const threshold = Math.max(3, Math.floor(rowTexts.length * 0.6));
    if (top.count >= threshold && !this.isHeaderLike(top.original)) {
      return top.original;
    }

    if (rowTexts.length === 1 && !this.isHeaderLike(rowTexts[0])) {
      return rowTexts[0].trim();
    }

    return null;
  }

  private normalizeText(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private isHeaderLike(value: string): boolean {
    const normalized = this.normalizeText(value);
    return [
      '№',
      'п/п',
      'наименование',
      'водотока',
      'населенный пункт',
      'населённый пункт',
      'год ввода',
      'объем',
      'объём',
      'площадь',
      'собственник',
      'координаты',
      'примечания',
      'коментарии',
      'комментарии',
      'фото',
    ].some((token) => normalized.includes(token));
  }

  private getCellText(cell: any): string {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'object' && cell.result !== undefined) return String(cell.result);
    if (typeof cell === 'object' && cell.text !== undefined) return String(cell.text);
    if (typeof cell === 'object' && cell.richText) {
      return cell.richText.map((r: any) => r.text || '').join('');
    }
    return String(cell).trim();
  }

  private detectElements(watercourseName: string, settlement: string): string[] {
    return ['Плотина', 'Водосбросное сооружение', 'Донный водоспуск'];
  }

  private async importRows(monitoringId: string, rows: ParsedGtsRow[]) {
    const districtRanges = new Map<string, { min: number; max: number }>();
    for (const row of rows) {
      const existing = districtRanges.get(row.districtName);
      if (!existing) {
        districtRanges.set(row.districtName, { min: row.number, max: row.number });
        continue;
      }
      existing.min = Math.min(existing.min, row.number);
      existing.max = Math.max(existing.max, row.number);
    }

    const districtMap = new Map<string, string>();
    let districtOrder = 0;

    for (const row of rows) {
      if (!districtMap.has(row.districtName)) {
        const range = districtRanges.get(row.districtName);
        const numberRange = range
          ? `${String(range.min).padStart(3, '0')}-${String(range.max).padStart(3, '0')}`
          : null;

        const district = await this.prisma.gtsDistrict.create({
          data: {
            gtsMonitoringId: monitoringId,
            name: row.districtName,
            numberRange,
            sortOrder: districtOrder++,
          },
        });
        districtMap.set(row.districtName, district.id);
      }
    }

    for (const row of rows) {
      const districtId = districtMap.get(row.districtName)!;

      const object = await this.prisma.gtsObject.create({
        data: {
          gtsMonitoringId: monitoringId,
          gtsDistrictId: districtId,
          number: row.number,
          watercourseName: row.watercourseName,
          settlement: row.settlement,
          yearBuilt: row.yearBuilt,
          volume: row.volume,
          area: row.area,
          safetyLevel: row.safetyLevel,
          ownerName: row.ownerName,
          latitude: row.latitude,
          longitude: row.longitude,
        },
      });

      if (row.elements.length > 0) {
        await this.prisma.gtsElement.createMany({
          data: row.elements.map((name, idx) => ({
            gtsObjectId: object.id,
            name,
            sortOrder: idx,
          })),
        });
      }
    }
  }
}
