import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WeatherService } from '../weather/weather.service';
import * as ExcelJS from 'exceljs';
import { join } from 'path';

const BLACK_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF000000' } };
const DATA_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

@Injectable()
export class MonitoringExcelService {
  private readonly logger = new Logger(MonitoringExcelService.name);

  constructor(
    private prisma: PrismaService,
    private weatherService: WeatherService,
  ) {}

  private setCellValue(cell: ExcelJS.Cell, value: string | number | null | undefined): void {
    if (value !== null && value !== undefined && value !== '') {
      cell.value = value;
      cell.font = { ...cell.font, ...BLACK_FONT };
    }
  }

  private clearDataRow(sheet: ExcelJS.Worksheet, rowNum: number): void {
    for (const col of DATA_COLS) {
      sheet.getCell(`${col}${rowNum}`).value = null;
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  async generateAct(monitoringId: string, type: 'water' | 'sediment', dateStr: string): Promise<{ buffer: Buffer; filename: string }> {
    const monitoring = await this.prisma.monitoring.findUnique({
      where: { id: monitoringId },
    });
    if (!monitoring) throw new NotFoundException('Мониторинг не найден');

    const targetDate = new Date(dateStr);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const probeType = type === 'water' ? 'WATER' : 'SEDIMENT';

    const probes = await this.prisma.monitoringProbe.findMany({
      where: {
        monitoringId,
        type: probeType,
        status: 'COLLECTED',
        collectedAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (probes.length === 0) {
      throw new BadRequestException(
        `Нет отобранных проб типа "${type === 'water' ? 'Вода' : 'Донные отложения'}" за ${this.formatDate(targetDate)}`,
      );
    }

    const templateName = type === 'water'
      ? 'Шаблон акта отбора Вода.xlsx'
      : 'Шаблон акта отбора ДО.xlsx';
    const templatePath = join(process.cwd(), 'templates', 'мониторинги', templateName);

    let weather = {
      temperature: monitoring.weatherTemperature,
      pressure: monitoring.weatherPressure,
      humidity: monitoring.weatherHumidity,
    };

    const address = monitoring.objectAddress || monitoring.objectName;
    if (address) {
      try {
        const fetched = await this.weatherService.getWeatherByAddress(address, targetDate);
        if (fetched) {
          weather = {
            temperature: fetched.temperature,
            pressure: fetched.pressure,
            humidity: fetched.humidity,
          };
          this.logger.log(`Метеоданные получены для "${address}" на ${dateStr}`);
        }
      } catch (err) {
        this.logger.warn(`Не удалось получить метеоданные: ${err}`);
      }
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Не найден лист в шаблоне');

    if (type === 'water') {
      this.fillWaterAct(sheet, monitoring, probes, targetDate, weather);
    } else {
      this.fillSedimentAct(sheet, monitoring, probes, targetDate, weather);
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const dateFormatted = this.formatDate(targetDate).replace(/\./g, '-');
    const typeLabel = type === 'water' ? 'Вода' : 'ДО';
    const safeName = (monitoring.name || 'Мониторинг').replace(/[<>:"/\\|?*]/g, '_');
    const filename = `Акт_${typeLabel}_${safeName}_${dateFormatted}.xlsx`;

    return { buffer, filename };
  }

  /**
   * Вода: строка 19 = нумерация колонок, строки 20-46 = данные (27 строк), строка 47+ = подвал
   * Колонки: A=№, B-C=Название, D=Объём/тара, E=Кол-во ёмкостей, F=Глубина, G=Температура, H=Широта, I=Долгота, J-K=Описание, L=Примечание
   * Метео: строка 14, A=температура, E=давление, I=влажность (ветра нет в шаблоне)
   */
  private fillWaterAct(
    sheet: ExcelJS.Worksheet,
    monitoring: any,
    probes: any[],
    date: Date,
    weather: { temperature: string | null; pressure: string | null; humidity: string | null },
  ) {
    const dateStr = this.formatDate(date);

    this.setCellValue(sheet.getCell('E6'), dateStr);

    const objectField = monitoring.objectName
      ? (monitoring.objectAddress ? `${monitoring.objectName}, ${monitoring.objectAddress}` : monitoring.objectName)
      : monitoring.objectAddress || '';
    this.setCellValue(sheet.getCell('E7'), objectField);
    if (monitoring.customerName) this.setCellValue(sheet.getCell('E9'), monitoring.customerName);
    this.setCellValue(sheet.getCell('E11'), dateStr);

    if (weather.temperature) this.setCellValue(sheet.getCell('A14'), weather.temperature);
    if (weather.pressure) this.setCellValue(sheet.getCell('E14'), weather.pressure);
    if (weather.humidity) this.setCellValue(sheet.getCell('I14'), weather.humidity);

    const DATA_START = 20;
    const TEMPLATE_ROWS = 27;

    if (probes.length > TEMPLATE_ROWS) {
      sheet.duplicateRow(DATA_START, probes.length - TEMPLATE_ROWS, true);
    }

    for (let i = 0; i < probes.length; i++) {
      const probe = probes[i];
      const r = DATA_START + i;

      this.clearDataRow(sheet, r);
      sheet.getRow(r).hidden = false;

      this.setCellValue(sheet.getCell(`A${r}`), i + 1);
      this.setCellValue(sheet.getCell(`B${r}`), probe.name);
      if (probe.containerVolume || probe.container) {
        this.setCellValue(sheet.getCell(`D${r}`), [probe.containerVolume, probe.container].filter(Boolean).join('/'));
      }
      if (probe.containerCount) this.setCellValue(sheet.getCell(`E${r}`), probe.containerCount);
      if (probe.depth) this.setCellValue(sheet.getCell(`F${r}`), probe.depth);
      if (probe.temperature) this.setCellValue(sheet.getCell(`G${r}`), probe.temperature);
      if (probe.latitude) this.setCellValue(sheet.getCell(`H${r}`), probe.latitude);
      if (probe.longitude) this.setCellValue(sheet.getCell(`I${r}`), probe.longitude);
      if (probe.description) this.setCellValue(sheet.getCell(`J${r}`), probe.description);
      if (probe.note) this.setCellValue(sheet.getCell(`L${r}`), probe.note);
    }

    if (probes.length < TEMPLATE_ROWS) {
      for (let r = DATA_START + probes.length; r < DATA_START + TEMPLATE_ROWS; r++) {
        this.clearDataRow(sheet, r);
        sheet.getRow(r).hidden = true;
      }
    }
  }

  /**
   * ДО: строка 18 = нумерация колонок, строки 19-20 = данные (2 строки), строка 21+ = подвал
   * Колонки: A=№, B-C=Название, D-E=Масса/тара, F-G=Глубина, H=Широта, I=Долгота, J-K=Описание, L=Примечание
   * Метео: строка 13, A=температура, E=давление, I=влажность (ветра нет в шаблоне)
   */
  private fillSedimentAct(
    sheet: ExcelJS.Worksheet,
    monitoring: any,
    probes: any[],
    date: Date,
    weather: { temperature: string | null; pressure: string | null; humidity: string | null },
  ) {
    const dateStr = this.formatDate(date);

    this.setCellValue(sheet.getCell('E5'), dateStr);

    const objectField = monitoring.objectName
      ? (monitoring.objectAddress ? `${monitoring.objectName}, ${monitoring.objectAddress}` : monitoring.objectName)
      : monitoring.objectAddress || '';
    this.setCellValue(sheet.getCell('E6'), objectField);
    if (monitoring.customerName) this.setCellValue(sheet.getCell('E8'), monitoring.customerName);
    this.setCellValue(sheet.getCell('E10'), dateStr);

    if (weather.temperature) this.setCellValue(sheet.getCell('A13'), weather.temperature);
    if (weather.pressure) this.setCellValue(sheet.getCell('E13'), weather.pressure);
    if (weather.humidity) this.setCellValue(sheet.getCell('I13'), weather.humidity);

    const DATA_START = 19;
    const TEMPLATE_ROWS = 2;

    if (probes.length > TEMPLATE_ROWS) {
      sheet.duplicateRow(DATA_START, probes.length - TEMPLATE_ROWS, true);
    }

    for (let i = 0; i < probes.length; i++) {
      const probe = probes[i];
      const r = DATA_START + i;

      this.clearDataRow(sheet, r);
      sheet.getRow(r).hidden = false;

      this.setCellValue(sheet.getCell(`A${r}`), i + 1);
      this.setCellValue(sheet.getCell(`B${r}`), probe.name);
      if (probe.mass || probe.container) {
        this.setCellValue(sheet.getCell(`D${r}`), [probe.mass, probe.container].filter(Boolean).join('/'));
      }
      if (probe.depth) this.setCellValue(sheet.getCell(`F${r}`), probe.depth);
      if (probe.latitude) this.setCellValue(sheet.getCell(`H${r}`), probe.latitude);
      if (probe.longitude) this.setCellValue(sheet.getCell(`I${r}`), probe.longitude);
      if (probe.description) this.setCellValue(sheet.getCell(`J${r}`), probe.description);
      if (probe.note) this.setCellValue(sheet.getCell(`L${r}`), probe.note);
    }

    if (probes.length < TEMPLATE_ROWS) {
      for (let r = DATA_START + probes.length; r < DATA_START + TEMPLATE_ROWS; r++) {
        this.clearDataRow(sheet, r);
        sheet.getRow(r).hidden = true;
      }
    }
  }
}
