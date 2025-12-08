import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { ServiceMatch, AiService } from '../ai/ai.service';
import { PrismaService } from '../../prisma/prisma.service';

interface GenerateOptions {
  projectId: string;
  userId: string;
}

interface GeneratedExcelResult {
  filePath: string;
  fileName: string;
  services: ServiceMatch[];
  objectPurpose: string;
}

// Все строки услуг в шаблоне (1-based)
// Row 22 (микробиология) исключена - идёт на подряд, не в свою лабу
const SERVICE_ROWS = [16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34];

// Устаревшие листы, которые нужно удалить
const OBSOLETE_SHEETS = [
  'Акт отбора проб МБ (для ФБУЗ)',
  '773-00001-52007-18(МЭД точка)',
  '773-00001-52007-18(МЭД сеть) ',
  '772-00001-52007-18(ППР)',
  '774-00001-52007-18(ЭРОА)',
  '769-00001-52007-18(Заявка МБ)',
  '770-00001-52007-18 Зака мб вода',
  '775-00001-52007-18(МЭД здание)',
  'ГГХ',
];

// Светло-жёлтый цвет
const LIGHT_YELLOW: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFFCC' },
};

// Чёрный цвет шрифта
const BLACK_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FF000000' },
};

@Injectable()
export class ExcelService {
  private readonly templatePath = join(process.cwd(), 'templates', 'Задание ПБ2-шб.xlsx');
  private readonly outputDir = join(process.cwd(), 'generated');
  
  // Кэш для проверки адреса в названии (чтобы не вызывать AI многократно)
  private addressCheckCache = new Map<string, boolean>();

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  /**
   * Устанавливает значение ячейки с чёрным цветом шрифта
   * Используется для замены красных плейсхолдеров из шаблона
   */
  private setCellValue(cell: ExcelJS.Cell, value: string | number | null | undefined): void {
    if (value !== null && value !== undefined && value !== '') {
      cell.value = value;
      cell.font = { ...cell.font, ...BLACK_FONT };
    }
  }

  /**
   * Очищает ячейку (убирает красный плейсхолдер)
   */
  private clearCell(cell: ExcelJS.Cell): void {
    cell.value = null;
  }

  /**
   * Формирует строку "Наименование и адрес объекта"
   * Не дублирует адрес, если он уже есть в названии
   */
  private async formatObjectField(objectName: string | null, objectAddress: string | null): Promise<string> {
    const name = objectName || '';
    const address = objectAddress || '';
    
    if (!name) return address;
    if (!address) return name;
    
    // Проверяем кэш
    const cacheKey = `${name}|${address}`;
    if (this.addressCheckCache.has(cacheKey)) {
      const hasAddressInName = this.addressCheckCache.get(cacheKey)!;
      return hasAddressInName ? name : `${name} по адресу: ${address}`;
    }
    
    // Проверяем через AI, содержит ли название адрес
    const hasAddressInName = await this.aiService.checkAddressInName(name, address);
    this.addressCheckCache.set(cacheKey, hasAddressInName);
    
    return hasAddressInName ? name : `${name} по адресу: ${address}`;
  }

  /**
   * Генерирует Excel файл "Заявка в ИЛЦ" на основе сохранённых данных проекта
   */
  async generateIlcRequest(options: GenerateOptions): Promise<GeneratedExcelResult> {
    const { projectId } = options;

    // Получаем проект с сохранёнными данными
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { company: true },
    });

    if (!project) {
      throw new NotFoundException('Проект не найден');
    }

    // Проверяем, что данные обработаны
    if (!project.processedAt) {
      throw new BadRequestException('Документы ещё не обработаны. Подождите завершения обработки.');
    }

    // Получаем сохранённые данные
    const objectName = project.objectName || project.name;
    const objectAddress = project.objectAddress || '';
    const objectPurpose = project.objectPurpose || 'Территория участков под строительство';
    const documentNumber = project.documentNumber || String(Math.floor(Math.random() * 900) + 100);
    const services = (project.services as unknown as ServiceMatch[]) || [];

    // Загружаем шаблон
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.templatePath);

    // Работаем с листом "Заявка в ИЛЦ"
    const sheet = workbook.getWorksheet('Заявка в ИЛЦ');

    if (!sheet) {
      throw new Error('Лист "Заявка в ИЛЦ" не найден в шаблоне');
    }

    // 1. Заполняем номер заявки (формат 801-XXX-25-ЗЛР-1)
    const year = new Date().getFullYear().toString().slice(-2);
    const requestNumber = `801-${documentNumber}-${year}-ЗЛР-1`;
    sheet.getCell('E7').value = requestNumber;

    // 2. Заполняем наименование и адрес объекта (проверяем через AI, есть ли адрес в названии)
    const objectField = await this.formatObjectField(objectName, objectAddress);
    
    const objectCell = sheet.getCell('D9');
    objectCell.value = objectField;
    objectCell.alignment = { wrapText: true, vertical: 'top' };
    
    // Подстраиваем высоту строки под текст (примерно 15 пунктов на строку)
    const charsPerLine = 80; // примерно столько символов в объединённой ячейке D-E
    const textLines = Math.ceil(objectField.length / charsPerLine);
    const row9 = sheet.getRow(9);
    row9.height = Math.max(30, textLines * 15);

    // 3. Назначение объекта и дата
    sheet.getCell('D11').value = objectPurpose;
    sheet.getCell('D13').value = this.formatDate(new Date());

    // 4. Заполняем количество по услугам (исключаем микробиологию - row 22, идёт на подряд)
    const filteredServices = services.filter(s => s.row !== 22);
    const serviceRows = new Set(filteredServices.map(s => s.row));
    for (const service of filteredServices) {
      const cell = sheet.getCell(`G${service.row}`);
      cell.value = typeof service.quantity === 'number' ? service.quantity : service.quantity;
    }

    // 5. Скрываем столбец A
    sheet.getColumn('A').hidden = true;

    // 6. Настраиваем ширину столбцов
    sheet.getColumn('B').width = 5;    // № пп - узкий
    sheet.getColumn('C').width = 8;    // Код работ - узкий
    sheet.getColumn('D').width = 45;   // Наименование работ - широкий
    sheet.getColumn('E').width = 45;   // продолжение наименования - широкий
    sheet.getColumn('F').width = 14;   // Ед.изм.
    sheet.getColumn('G').width = 10;   // Кол-во
    sheet.getColumn('H').width = 15;   // Примечание

    // 7. Скрываем строки услуг, которых нет + красим таблицу в светло-жёлтый
    // Также всегда скрываем row 22 (микробиология) - идёт на подряд
    const allServiceRows = [...SERVICE_ROWS, 22];
    for (const rowNum of allServiceRows) {
      const row = sheet.getRow(rowNum);
      
      // Скрываем строки без услуг (кроме строки 34 - протоколы, она всегда есть)
      // Row 22 (микробиология) скрываем всегда
      if (rowNum === 22 || (!serviceRows.has(rowNum) && rowNum !== 34)) {
        row.hidden = true;
      }

      // Красим ячейки таблицы в светло-жёлтый и включаем перенос текста
      for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        const cell = sheet.getCell(`${col}${rowNum}`);
        cell.fill = LIGHT_YELLOW;
        cell.alignment = { wrapText: true, vertical: 'top' };
      }
    }

    // Также красим заголовок таблицы (строка 15)
    for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      const cell = sheet.getCell(`${col}15`);
      cell.fill = LIGHT_YELLOW;
      cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    }

    // Создаём папку для выходных файлов
    await mkdir(this.outputDir, { recursive: true });

    // Генерируем имя файла
    const fileName = `Заявка_ИЛЦ_${project.name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_')}_${Date.now()}.xlsx`;
    const filePath = join(this.outputDir, fileName);

    // Сохраняем файл
    await workbook.xlsx.writeFile(filePath);

    // Сохраняем информацию о сгенерированном файле в БД
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        generatedFileName: fileName,
        generatedFileUrl: fileName,
        generatedAt: new Date(),
      },
    });

    return {
      filePath,
      fileName,
      services,
      objectPurpose,
    };
  }

  /**
   * Форматирует дату в формат DD.MM.YYYY
   */
  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Возвращает завтрашнюю дату
   */
  private getTomorrowDate(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
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
   * Заполняет лист "Акт отбора проб Почва" в рабочей книге
   */
  async fillSoilActSheet(workbook: ExcelJS.Workbook, projectId: string): Promise<void> {
    // Получаем проект и пробы
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
          orderBy: [
            { layerNumber: 'asc' },   // Сначала по слою (0,0-0,2, потом 0,2-0,5...)
            { sampleNumber: 'asc' },   // Потом по номеру площадки (ПП1, ПП2, ПП3, СК1...)
          ],
        },
      },
    });

    if (!project) return;

    const sheet = workbook.getWorksheet('Акт отбора проб Почва');
    if (!sheet) return;

    // Фильтруем пробы почвы (тип SOIL с кодом АХ)
    const soilSamples = project.samples.filter(
      (s) => s.type === 'SOIL' && s.analysisCode === 'АХ'
    );

    if (soilSamples.length === 0) return;

    // ========== ЗАПОЛНЯЕМ ШАПКУ ==========
    
    // Номер акта (J2) - формат: 801-XXX-25-АОП-1
    const year = new Date().getFullYear().toString().slice(-2);
    const actNumber = `801-${project.documentNumber || '000'}-${year}-АОП-1`;
    this.setCellValue(sheet.getCell('J2'), actNumber);

    // Переименовываем лист по номеру акта
    sheet.name = actNumber;

    // Дата составления Акта (E4) — завтрашняя дата
    const tomorrow = this.getTomorrowDate();
    this.setCellValue(sheet.getCell('E4'), this.formatDate(tomorrow));

    // Наименование объекта и адрес (E5) — проверяем через AI
    const objectField = await this.formatObjectField(
      project.objectName || project.name,
      project.objectAddress,
    );
    const objectCell = sheet.getCell('E5');
    this.setCellValue(objectCell, objectField);
    objectCell.alignment = { wrapText: true, vertical: 'top' };
    // Автовысота строки
    const charsPerLine = 60;
    const textLines = Math.ceil(objectField.length / charsPerLine);
    sheet.getRow(5).height = Math.max(20, textLines * 15);

    // Заказчик с адресом (E6)
    const clientInfo = project.clientAddress 
      ? `${project.clientName || ''}, ${project.clientAddress}`.trim()
      : project.clientName;
    if (clientInfo) {
      this.setCellValue(sheet.getCell('E6'), clientInfo);
    }

    // Дата отбора проб (E9) — завтрашняя дата
    this.setCellValue(sheet.getCell('E9'), this.formatDate(tomorrow));

    // Количество проб (E119)
    this.setCellValue(sheet.getCell('E119'), soilSamples.length);

    // ========== ЗАПОЛНЯЕМ ТАБЛИЦУ ПРОБ ==========
    
    // Строки данных начинаются с 20
    const DATA_START_ROW = 20;
    const MAX_ROWS = 60; // Максимум строк в шаблоне

    for (let i = 0; i < soilSamples.length && i < MAX_ROWS; i++) {
      const sample = soilSamples[i];
      const rowNum = DATA_START_ROW + i;
      const row = sheet.getRow(rowNum);

      // A: № п/п
      this.setCellValue(sheet.getCell(`A${rowNum}`), i + 1);

      // B: Глубина отбора (0,0-0,2)
      this.setCellValue(sheet.getCell(`B${rowNum}`), sample.depthLabel);

      // C: № пробы (01АХ.01)
      this.setCellValue(sheet.getCell(`C${rowNum}`), sample.cipher);

      // E: Описание/характеристика (заполняется пользователем, очищаем плейсхолдер)
      if (sample.description) {
        this.setCellValue(sheet.getCell(`E${rowNum}`), sample.description);
      } else {
        this.clearCell(sheet.getCell(`E${rowNum}`));
      }

      // F: Место отбора (ПП1, СК1)
      this.setCellValue(sheet.getCell(`F${rowNum}`), sample.platform.label);

      // H: Масса пробы/тара (1,0 кг/Пэ)
      this.setCellValue(sheet.getCell(`H${rowNum}`), sample.mass);

      // Q: Широта - только если есть в БД
      if (sample.latitude) {
        this.setCellValue(sheet.getCell(`Q${rowNum}`), sample.latitude);
      } else {
        this.clearCell(sheet.getCell(`Q${rowNum}`));
      }

      // R: Долгота - только если есть в БД
      if (sample.longitude) {
        this.setCellValue(sheet.getCell(`R${rowNum}`), sample.longitude);
      } else {
        this.clearCell(sheet.getCell(`R${rowNum}`));
      }

      // Скрываем неиспользуемые строки
      row.hidden = false;
    }

    // Скрываем строки после последней заполненной пробы
    for (let i = soilSamples.length; i < MAX_ROWS; i++) {
      const rowNum = DATA_START_ROW + i;
      const row = sheet.getRow(rowNum);
      // Проверяем, есть ли данные в шаблоне
      if (row && sheet.getCell(`C${rowNum}`).value) {
        row.hidden = true;
      }
    }

    // Очищаем колонки энтомологических исследований (J-P) - оставляем пустыми
    for (let i = 0; i < soilSamples.length && i < MAX_ROWS; i++) {
      const rowNum = DATA_START_ROW + i;
      for (const col of ['J', 'K', 'L', 'M', 'N', 'O', 'P']) {
        sheet.getCell(`${col}${rowNum}`).value = null;
      }
    }

    // ========== КООРДИНАТЫ РЕПЕРНЫХ ТОЧЕК ==========
    
    // Получаем уникальные площадки для таблицы координат (строки 85+)
    const platforms = [...new Set(soilSamples.map((s) => s.platform.label))];
    
    // Заполняем первую колонку координат (C85-C89)
    for (let i = 0; i < Math.min(platforms.length, 5); i++) {
      const rowNum = 85 + i;
      const platformNum = i + 1;
      sheet.getCell(`C${rowNum}`).value = platformNum;
      sheet.getCell(`D${rowNum}`).value = platformNum;
      
      // Находим первую пробу этой площадки с координатами
      const sampleWithCoords = soilSamples.find(
        (s) => s.platform.label === platforms[i] && (s.latitude || s.longitude)
      );
      
      // Записываем координаты только если они есть, иначе очищаем
      sheet.getCell(`E${rowNum}`).value = sampleWithCoords?.longitude || null;
      sheet.getCell(`F${rowNum}`).value = sampleWithCoords?.latitude || null;
    }

    // Очищаем неиспользуемые строки в таблице координат (первая колонка)
    for (let i = platforms.length; i < 5; i++) {
      const rowNum = 85 + i;
      sheet.getCell(`C${rowNum}`).value = null;
      sheet.getCell(`D${rowNum}`).value = null;
      sheet.getCell(`E${rowNum}`).value = null;
      sheet.getCell(`F${rowNum}`).value = null;
    }

    // Вторая колонка (6-10)
    for (let i = 5; i < Math.min(platforms.length, 10); i++) {
      const rowNum = 85 + (i - 5);
      const platformNum = i + 1;
      sheet.getCell(`H${rowNum}`).value = platformNum;
      sheet.getCell(`I${rowNum}`).value = platformNum;
      
      // Координаты для площадок 6-10
      const sampleWithCoords = soilSamples.find(
        (s) => s.platform.label === platforms[i] && (s.latitude || s.longitude)
      );
      sheet.getCell(`J${rowNum}`).value = sampleWithCoords?.longitude || null;
      sheet.getCell(`K${rowNum}`).value = sampleWithCoords?.latitude || null;
    }

    // Очищаем неиспользуемые строки во второй колонке координат
    for (let i = Math.max(0, platforms.length - 5); i < 5; i++) {
      const rowNum = 85 + i;
      if (platforms.length <= 5 + i) {
        sheet.getCell(`H${rowNum}`).value = null;
        sheet.getCell(`I${rowNum}`).value = null;
        sheet.getCell(`J${rowNum}`).value = null;
        sheet.getCell(`K${rowNum}`).value = null;
      }
    }
  }

  /**
   * Заполняет лист "Акт отбора проб МБ" (микробиология + паразитология)
   */
  async fillMbActSheet(workbook: ExcelJS.Workbook, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
          orderBy: { sampleNumber: 'asc' },
        },
      },
    });

    if (!project) return;

    const sheet = workbook.getWorksheet('Акт отбора проб МБ');
    if (!sheet) return;

    // Фильтруем пробы АМ и АП
    const amSamples = project.samples.filter((s) => s.analysisCode === 'АМ');
    const apSamples = project.samples.filter((s) => s.analysisCode === 'АП');

    if (amSamples.length === 0) return;

    // ========== ЗАПОЛНЯЕМ ШАПКУ ==========
    
    // Номер акта (J3) - формат: 801-XXX-25-АОП-2
    const year = new Date().getFullYear().toString().slice(-2);
    const actNumber = `801-${project.documentNumber || '000'}-${year}-АОП-2`;
    this.setCellValue(sheet.getCell('J3'), actNumber);

    // Переименовываем лист по номеру акта
    sheet.name = actNumber;

    // Дата составления Акта (E5) — завтрашняя дата
    const tomorrow = this.getTomorrowDate();
    this.setCellValue(sheet.getCell('E5'), this.formatDate(tomorrow));

    // Наименование объекта и адрес (E6) — проверяем через AI
    const objectField = await this.formatObjectField(
      project.objectName || project.name,
      project.objectAddress,
    );
    const objectCell = sheet.getCell('E6');
    this.setCellValue(objectCell, objectField);
    objectCell.alignment = { wrapText: true, vertical: 'top' };
    // Автовысота строки
    const charsPerLine = 60;
    const textLines = Math.ceil(objectField.length / charsPerLine);
    sheet.getRow(6).height = Math.max(20, textLines * 15);

    // Заказчик с адресом (E7)
    const clientInfo = project.clientAddress 
      ? `${project.clientName || ''}, ${project.clientAddress}`.trim()
      : project.clientName;
    if (clientInfo) {
      this.setCellValue(sheet.getCell('E7'), clientInfo);
    }

    // Дата отбора проб (E10) — завтрашняя дата
    this.setCellValue(sheet.getCell('E10'), this.formatDate(tomorrow));

    // ========== ЗАПОЛНЯЕМ ТАБЛИЦУ ПРОБ ==========
    
    const DATA_START_ROW = 20;
    const MAX_ROWS = 68; // Строки 20-87

    for (let i = 0; i < amSamples.length && i < MAX_ROWS; i++) {
      const amSample = amSamples[i];
      const apSample = apSamples[i]; // Парная проба АП
      const rowNum = DATA_START_ROW + i;

      // A: № п/п
      sheet.getCell(`A${rowNum}`).value = i + 1;

      // === Микробиология (B-I) ===
      // B: Глубина отбора
      sheet.getCell(`B${rowNum}`).value = amSample.depthLabel;
      // C-D: № пробы АМ
      sheet.getCell(`C${rowNum}`).value = amSample.cipher;
      // E: Описание
      sheet.getCell(`E${rowNum}`).value = amSample.description || null;
      // F-G: Место отбора
      sheet.getCell(`F${rowNum}`).value = amSample.platform.label;
      // H-I: Масса
      sheet.getCell(`H${rowNum}`).value = amSample.mass;

      // === Паразитология (J-P) ===
      if (apSample) {
        // J: Глубина отбора
        sheet.getCell(`J${rowNum}`).value = apSample.depthLabel;
        // K: № пробы АП
        sheet.getCell(`K${rowNum}`).value = apSample.cipher;
        // L-M: Описание
        sheet.getCell(`L${rowNum}`).value = apSample.description || null;
        // N-O: Место отбора
        sheet.getCell(`N${rowNum}`).value = apSample.platform.label;
        // P: Масса
        sheet.getCell(`P${rowNum}`).value = apSample.mass;
      }

      // Q-R: Координаты (общие для обеих проб)
      sheet.getCell(`Q${rowNum}`).value = amSample.latitude || null;
      sheet.getCell(`R${rowNum}`).value = amSample.longitude || null;
    }

    // Скрываем пустые строки после данных
    for (let i = amSamples.length; i < MAX_ROWS; i++) {
      const rowNum = DATA_START_ROW + i;
      const row = sheet.getRow(rowNum);
      if (row) {
        row.hidden = true;
      }
    }

    // Итого проб (C89, K89)
    sheet.getCell('C89').value = amSamples.length;
    sheet.getCell('K89').value = apSamples.length;
  }

  /**
   * Заполняет лист "Акт отбора проб ДО" (донные отложения)
   */
  async fillSedimentActSheet(workbook: ExcelJS.Workbook, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
          orderBy: { sampleNumber: 'asc' },
        },
      },
    });

    if (!project) return;

    const sheet = workbook.getWorksheet('Акт отбора проб ДО');
    if (!sheet) return;

    // Фильтруем пробы БХ (донные отложения)
    const sedimentSamples = project.samples.filter((s) => s.analysisCode === 'БХ');

    if (sedimentSamples.length === 0) return;

    // ========== ЗАПОЛНЯЕМ ШАПКУ ==========
    
    // Номер акта (J2) - формат: 801-XXX-25-АОП-3
    const year = new Date().getFullYear().toString().slice(-2);
    const actNumber = `801-${project.documentNumber || '000'}-${year}-АОП-3`;
    sheet.getCell('J2').value = actNumber;

    // Дата составления Акта (E4) — завтрашняя дата
    const tomorrow = this.getTomorrowDate();
    sheet.getCell('E4').value = this.formatDate(tomorrow);

    // Наименование объекта и адрес (E5) — проверяем через AI
    const objectField = await this.formatObjectField(
      project.objectName || project.name,
      project.objectAddress,
    );
    const objectCell = sheet.getCell('E5');
    objectCell.value = objectField;
    objectCell.alignment = { wrapText: true, vertical: 'top' };
    // Автовысота строки
    const charsPerLine = 60;
    const textLines = Math.ceil(objectField.length / charsPerLine);
    sheet.getRow(5).height = Math.max(20, textLines * 15);

    // Заказчик (E6)
    if (project.clientName) {
      sheet.getCell('E6').value = project.clientName;
    }

    // Дата отбора проб (E9) — завтрашняя дата
    sheet.getCell('E9').value = this.formatDate(tomorrow);

    // ========== ЗАПОЛНЯЕМ ТАБЛИЦУ ПРОБ ==========
    
    const DATA_START_ROW = 20;
    const MAX_ROWS = 15; // Строки 20-34

    for (let i = 0; i < sedimentSamples.length && i < MAX_ROWS; i++) {
      const sample = sedimentSamples[i];
      const rowNum = DATA_START_ROW + i;

      // A: № п/п
      sheet.getCell(`A${rowNum}`).value = i + 1;

      // B: Глубина отбора
      sheet.getCell(`B${rowNum}`).value = sample.depthLabel;

      // C-D: № пробы (01БХ.01)
      sheet.getCell(`C${rowNum}`).value = sample.cipher;

      // E: Описание
      sheet.getCell(`E${rowNum}`).value = sample.description || null;

      // F-G: Место отбора (ДО1, ДО2...)
      sheet.getCell(`F${rowNum}`).value = sample.platform.label;

      // H-I: Масса
      sheet.getCell(`H${rowNum}`).value = sample.mass;

      // J-L: Глубина водного объекта (заполняется пользователем)
      // M-P: Наименование водного объекта (заполняется пользователем)

      // Q: Широта - только если есть в БД
      sheet.getCell(`Q${rowNum}`).value = sample.latitude || null;

      // R: Долгота - только если есть в БД
      sheet.getCell(`R${rowNum}`).value = sample.longitude || null;
    }

    // Скрываем пустые строки после данных
    for (let i = sedimentSamples.length; i < MAX_ROWS; i++) {
      const rowNum = DATA_START_ROW + i;
      const row = sheet.getRow(rowNum);
      if (row) {
        row.hidden = true;
      }
    }

    // Количество проб (E42)
    sheet.getCell('E42').value = sedimentSamples.length;
  }

  /**
   * Заполняет лист "Акт отбора проб Вода"
   */
  async fillWaterActSheet(workbook: ExcelJS.Workbook, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
          orderBy: { sampleNumber: 'asc' },
        },
      },
    });

    if (!project) return;

    const sheet = workbook.getWorksheet('Акт отбора проб Вода');
    if (!sheet) return;

    // Фильтруем пробы ВХ (вода)
    const waterSamples = project.samples.filter((s) => s.analysisCode === 'ВХ');

    if (waterSamples.length === 0) return;

    // ========== ЗАПОЛНЯЕМ ШАПКУ ==========
    
    // Номер акта (J2) - формат: 801-XXX-25-АОП-4
    const year = new Date().getFullYear().toString().slice(-2);
    const actNumber = `801-${project.documentNumber || '000'}-${year}-АОП-4`;
    sheet.getCell('J2').value = actNumber;

    // Дата составления Акта (E4) — завтрашняя дата
    const tomorrow = this.getTomorrowDate();
    sheet.getCell('E4').value = this.formatDate(tomorrow);

    // Наименование объекта и адрес (E5) — проверяем через AI
    const objectField = await this.formatObjectField(
      project.objectName || project.name,
      project.objectAddress,
    );
    const objectCell = sheet.getCell('E5');
    objectCell.value = objectField;
    objectCell.alignment = { wrapText: true, vertical: 'top' };
    // Автовысота строки
    const charsPerLine = 60;
    const textLines = Math.ceil(objectField.length / charsPerLine);
    sheet.getRow(5).height = Math.max(20, textLines * 15);

    // Заказчик (E6)
    if (project.clientName) {
      sheet.getCell('E6').value = project.clientName;
    }

    // Дата отбора проб (E9) — завтрашняя дата
    sheet.getCell('E9').value = this.formatDate(tomorrow);

    // ========== ЗАПОЛНЯЕМ ТАБЛИЦУ ПРОБ ==========
    
    const DATA_START_ROW = 19;
    const MAX_ROWS = 80; // Много строк в шаблоне

    for (let i = 0; i < waterSamples.length && i < MAX_ROWS; i++) {
      const sample = waterSamples[i];
      const rowNum = DATA_START_ROW + i;

      // A: № п/п
      sheet.getCell(`A${rowNum}`).value = i + 1;

      // B: Глубина отбора
      sheet.getCell(`B${rowNum}`).value = sample.depthLabel;

      // C-D: № пробы (01ВХ.01)
      sheet.getCell(`C${rowNum}`).value = sample.cipher;

      // E: Описание
      sheet.getCell(`E${rowNum}`).value = sample.description || null;

      // F-G: Место отбора (В1, В2...)
      sheet.getCell(`F${rowNum}`).value = sample.platform.label;

      // H-J: Масса (для воды особый формат)
      sheet.getCell(`H${rowNum}`).value = '1,0 л/Ст; 1,5л Пэ';

      // K-L: Количество емкостей
      sheet.getCell(`K${rowNum}`).value = 2;

      // M-N: Температура (заполняется пользователем)
      // O-P: Наименование водного объекта (заполняется пользователем)

      // Q: Широта - только если есть в БД
      sheet.getCell(`Q${rowNum}`).value = sample.latitude || null;

      // R: Долгота - только если есть в БД
      sheet.getCell(`R${rowNum}`).value = sample.longitude || null;
    }

    // Скрываем пустые строки после данных
    for (let i = waterSamples.length; i < MAX_ROWS; i++) {
      const rowNum = DATA_START_ROW + i;
      const row = sheet.getRow(rowNum);
      if (row && sheet.getCell(`C${rowNum}`).value) {
        row.hidden = true;
      }
    }

    // Количество проб (E134)
    sheet.getCell('E134').value = waterSamples.length;
  }

  /**
   * Заполняет лист "БОП" (бирки для проб почвы)
   * 
   * Структура одной бирки (13 строк):
   * - Row N+0: № задания (B), Дата отбора (H)
   * - Row N+2-3: Адрес объекта (B-J)
   * - Row N+4: Номер площадки (D-F), Глубина (J)
   * - Row N+6: Номер пробы (B)
   * - Row N+8-9: Состав пробы (пусто)
   * - Row N+10-11: Пробы отобрал / подпись
   * 
   * Правая колонка (K) использует формулы из шаблона
   */
  async fillSoilTagsSheet(workbook: ExcelJS.Workbook, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
          orderBy: [
            { layerNumber: 'asc' },
            { sampleNumber: 'asc' },
          ],
        },
      },
    });

    if (!project) return;

    const sheet = workbook.getWorksheet('БОП');
    if (!sheet) return;

    // Фильтруем пробы почвы (тип SOIL с кодом АХ)
    const soilSamples = project.samples.filter(
      (s) => s.type === 'SOIL' && s.analysisCode === 'АХ'
    );

    if (soilSamples.length === 0) return;

    // Константы шаблона
    const TAG_HEIGHT = 13; // Высота одной бирки в строках
    const FIRST_TAG_START = 2; // Первая бирка начинается со строки 2
    const ROW_HEIGHT_MULTIPLIER = 1.25; // Увеличиваем высоту строк

    // Формируем номер задания
    const year = new Date().getFullYear().toString().slice(-2);
    const taskNumber = `801-${project.documentNumber || '000'}-${year}`;
    
    // Адрес объекта
    const address = project.objectAddress || '';

    // Определяем последнюю строку с бирками
    const lastTagRow = FIRST_TAG_START + (soilSamples.length * TAG_HEIGHT) - 1;

    // Увеличиваем высоту только используемых строк в 1.25 раза
    for (let i = 1; i <= lastTagRow; i++) {
      const row = sheet.getRow(i);
      if (row.height) {
        row.height = row.height * ROW_HEIGHT_MULTIPLIER;
      } else {
        row.height = 10.5 * ROW_HEIGHT_MULTIPLIER;
      }
    }

    // Дата отбора — завтрашний день в формате ДД.ММ.ГГГГ
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${String(tomorrow.getDate()).padStart(2, '0')}.${String(tomorrow.getMonth() + 1).padStart(2, '0')}.${tomorrow.getFullYear()}`;

    // Заполняем бирки - только левую часть (A-J)
    // Правая часть (K) использует формулы из шаблона, которые ссылаются на левую часть
    for (let i = 0; i < soilSamples.length; i++) {
      const sample = soilSamples[i];
      const baseRow = FIRST_TAG_START + (i * TAG_HEIGHT);

      // === ЛЕВАЯ БИРКА (A-J) ===
      
      // Row N+0: № задания ПБ (B), Дата отбора (H)
      sheet.getCell(`B${baseRow}`).value = taskNumber;
      sheet.getCell(`H${baseRow}`).value = tomorrowStr;

      // Row N+2-3: Адрес объекта (B)
      sheet.getCell(`B${baseRow + 2}`).value = address;

      // Row N+4: Номер площадки (D), Глубина (J)
      sheet.getCell(`D${baseRow + 4}`).value = sample.platform.label;
      sheet.getCell(`J${baseRow + 4}`).value = sample.depthLabel;

      // Row N+6: Номер пробы (B)
      sheet.getCell(`B${baseRow + 6}`).value = sample.cipher;
      
      // Правая бирка (K) - НЕ ТРОГАЕМ, там формулы из шаблона
      // K3/K16/... = формула на $B$2 (номер задания) -> покажет "0" если не нужно
      // K6/K19/... = формула на H2 (дата)
      // K8/K21/... = формула на B8 (номер пробы)
      // K10/K23/... = формула на J6 (глубина)
    }

    // Скрываем ВСЕ строки после последней бирки
    const firstHiddenRow = FIRST_TAG_START + (soilSamples.length * TAG_HEIGHT);
    for (let i = firstHiddenRow; i <= sheet.rowCount; i++) {
      sheet.getRow(i).hidden = true;
    }
  }

  /**
   * Заполняет лист "БОП МБ" (бирки для проб микробиологии АМ)
   * Структура аналогична БОП, формулы ссылаются на Акт отбора проб МБ
   */
  async fillMbTagsSheet(workbook: ExcelJS.Workbook, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
          orderBy: { sampleNumber: 'asc' },
        },
      },
    });

    if (!project) return;

    const sheet = workbook.getWorksheet('БОП МБ');
    if (!sheet) return;

    // Фильтруем пробы АМ (микробиология)
    const amSamples = project.samples.filter((s) => s.analysisCode === 'АМ');

    if (amSamples.length === 0) return;

    const TAG_HEIGHT = 13;
    const FIRST_TAG_START = 2;
    const ROW_HEIGHT_MULTIPLIER = 1.25;

    // Формируем номер задания
    const year = new Date().getFullYear().toString().slice(-2);
    const taskNumber = `801-${project.documentNumber || '000'}-${year}`;
    
    // Адрес объекта (берётся из БОП через формулу, но заполним для первой бирки)
    const address = project.objectAddress || '';

    const lastTagRow = FIRST_TAG_START + (amSamples.length * TAG_HEIGHT) - 1;

    // Увеличиваем высоту используемых строк
    for (let i = 1; i <= lastTagRow; i++) {
      const row = sheet.getRow(i);
      row.height = (row.height || 10.5) * ROW_HEIGHT_MULTIPLIER;
    }

    // Дата отбора — завтрашний день
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${String(tomorrow.getDate()).padStart(2, '0')}.${String(tomorrow.getMonth() + 1).padStart(2, '0')}.${tomorrow.getFullYear()}`;

    // Заполняем бирки - только левую часть
    for (let i = 0; i < amSamples.length; i++) {
      const sample = amSamples[i];
      const baseRow = FIRST_TAG_START + (i * TAG_HEIGHT);

      // Row N+0: № задания ПБ (B), Дата отбора (H)
      sheet.getCell(`B${baseRow}`).value = taskNumber;
      sheet.getCell(`H${baseRow}`).value = tomorrowStr;

      // Row N+2: Адрес объекта (B) - на всех бирках
      sheet.getCell(`B${baseRow + 2}`).value = address;

      // Row N+4: Номер площадки (D), Глубина (J)
      sheet.getCell(`D${baseRow + 4}`).value = sample.platform.label;
      sheet.getCell(`J${baseRow + 4}`).value = sample.depthLabel;

      // Row N+6: Номер пробы (B)
      sheet.getCell(`B${baseRow + 6}`).value = sample.cipher;
    }

    // Скрываем строки после последней бирки
    const firstHiddenRow = FIRST_TAG_START + (amSamples.length * TAG_HEIGHT);
    for (let i = firstHiddenRow; i <= sheet.rowCount; i++) {
      sheet.getRow(i).hidden = true;
    }
  }

  /**
   * Заполняет лист "БОП БАК" (бирки для проб паразитологии АП)
   * Структура аналогична БОП, формулы ссылаются на Акт отбора проб МБ
   */
  async fillBakTagsSheet(workbook: ExcelJS.Workbook, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
          orderBy: { sampleNumber: 'asc' },
        },
      },
    });

    if (!project) return;

    const sheet = workbook.getWorksheet('БОП БАК');
    if (!sheet) return;

    // Фильтруем пробы АП (паразитология)
    const apSamples = project.samples.filter((s) => s.analysisCode === 'АП');

    if (apSamples.length === 0) return;

    const TAG_HEIGHT = 13;
    const FIRST_TAG_START = 2;
    const ROW_HEIGHT_MULTIPLIER = 1.25;

    // Формируем номер задания
    const year = new Date().getFullYear().toString().slice(-2);
    const taskNumber = `801-${project.documentNumber || '000'}-${year}`;
    
    // Адрес объекта
    const address = project.objectAddress || '';

    const lastTagRow = FIRST_TAG_START + (apSamples.length * TAG_HEIGHT) - 1;

    // Увеличиваем высоту используемых строк
    for (let i = 1; i <= lastTagRow; i++) {
      const row = sheet.getRow(i);
      row.height = (row.height || 10.5) * ROW_HEIGHT_MULTIPLIER;
    }

    // Дата отбора — завтрашний день
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${String(tomorrow.getDate()).padStart(2, '0')}.${String(tomorrow.getMonth() + 1).padStart(2, '0')}.${tomorrow.getFullYear()}`;

    // Заполняем бирки - только левую часть
    for (let i = 0; i < apSamples.length; i++) {
      const sample = apSamples[i];
      const baseRow = FIRST_TAG_START + (i * TAG_HEIGHT);

      // Row N+0: № задания ПБ (B), Дата отбора (H)
      sheet.getCell(`B${baseRow}`).value = taskNumber;
      sheet.getCell(`H${baseRow}`).value = tomorrowStr;

      // Row N+2: Адрес объекта (B) - на всех бирках
      sheet.getCell(`B${baseRow + 2}`).value = address;

      // Row N+4: Номер площадки (D), Глубина (J)
      sheet.getCell(`D${baseRow + 4}`).value = sample.platform.label;
      sheet.getCell(`J${baseRow + 4}`).value = sample.depthLabel;

      // Row N+6: Номер пробы (B)
      sheet.getCell(`B${baseRow + 6}`).value = sample.cipher;
    }

    // Скрываем строки после последней бирки
    const firstHiddenRow = FIRST_TAG_START + (apSamples.length * TAG_HEIGHT);
    for (let i = firstHiddenRow; i <= sheet.rowCount; i++) {
      sheet.getRow(i).hidden = true;
    }
  }

  /**
   * Заполняет лист "БОП ДО" (бирки для донных отложений БХ)
   */
  async fillDoTagsSheet(workbook: ExcelJS.Workbook, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
          orderBy: { sampleNumber: 'asc' },
        },
      },
    });

    if (!project) return;

    const sheet = workbook.getWorksheet('БОП ДО');
    if (!sheet) return;

    // Фильтруем пробы БХ (донные отложения)
    const doSamples = project.samples.filter((s) => s.analysisCode === 'БХ');

    if (doSamples.length === 0) return;

    const TAG_HEIGHT = 13;
    const FIRST_TAG_START = 2;
    const ROW_HEIGHT_MULTIPLIER = 1.25;

    const year = new Date().getFullYear().toString().slice(-2);
    const taskNumber = `801-${project.documentNumber || '000'}-${year}`;
    const address = project.objectAddress || '';

    const lastTagRow = FIRST_TAG_START + (doSamples.length * TAG_HEIGHT) - 1;

    // Увеличиваем высоту используемых строк
    for (let i = 1; i <= lastTagRow; i++) {
      const row = sheet.getRow(i);
      row.height = (row.height || 10.5) * ROW_HEIGHT_MULTIPLIER;
    }

    // Дата отбора — завтрашний день
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${String(tomorrow.getDate()).padStart(2, '0')}.${String(tomorrow.getMonth() + 1).padStart(2, '0')}.${tomorrow.getFullYear()}`;

    // Заполняем бирки
    for (let i = 0; i < doSamples.length; i++) {
      const sample = doSamples[i];
      const baseRow = FIRST_TAG_START + (i * TAG_HEIGHT);

      sheet.getCell(`B${baseRow}`).value = taskNumber;
      sheet.getCell(`H${baseRow}`).value = tomorrowStr;

      if (i === 0) {
        sheet.getCell(`B${baseRow + 2}`).value = address;
      }

      sheet.getCell(`D${baseRow + 4}`).value = sample.platform.label;
      sheet.getCell(`J${baseRow + 4}`).value = sample.depthLabel;
      sheet.getCell(`B${baseRow + 6}`).value = sample.cipher;
    }

    // Скрываем строки после последней бирки
    const firstHiddenRow = FIRST_TAG_START + (doSamples.length * TAG_HEIGHT);
    for (let i = firstHiddenRow; i <= sheet.rowCount; i++) {
      sheet.getRow(i).hidden = true;
    }
  }

  /**
   * Заполняет лист "БОП Вода" (бирки для проб воды ВХ)
   */
  async fillWaterTagsSheet(workbook: ExcelJS.Workbook, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
          orderBy: { sampleNumber: 'asc' },
        },
      },
    });

    if (!project) return;

    const sheet = workbook.getWorksheet('БОП Вода');
    if (!sheet) return;

    // Фильтруем пробы ВХ (вода)
    const waterSamples = project.samples.filter((s) => s.analysisCode === 'ВХ');

    if (waterSamples.length === 0) return;

    const TAG_HEIGHT = 13;
    const FIRST_TAG_START = 2;
    const ROW_HEIGHT_MULTIPLIER = 1.25;

    const year = new Date().getFullYear().toString().slice(-2);
    const taskNumber = `801-${project.documentNumber || '000'}-${year}`;
    const address = project.objectAddress || '';

    const lastTagRow = FIRST_TAG_START + (waterSamples.length * TAG_HEIGHT) - 1;

    // Увеличиваем высоту используемых строк
    for (let i = 1; i <= lastTagRow; i++) {
      const row = sheet.getRow(i);
      row.height = (row.height || 10.5) * ROW_HEIGHT_MULTIPLIER;
    }

    // Дата отбора — завтрашний день
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${String(tomorrow.getDate()).padStart(2, '0')}.${String(tomorrow.getMonth() + 1).padStart(2, '0')}.${tomorrow.getFullYear()}`;

    // Заполняем бирки
    for (let i = 0; i < waterSamples.length; i++) {
      const sample = waterSamples[i];
      const baseRow = FIRST_TAG_START + (i * TAG_HEIGHT);

      sheet.getCell(`B${baseRow}`).value = taskNumber;
      sheet.getCell(`H${baseRow}`).value = tomorrowStr;

      if (i === 0) {
        sheet.getCell(`B${baseRow + 2}`).value = address;
      }

      sheet.getCell(`D${baseRow + 4}`).value = sample.platform.label;
      sheet.getCell(`J${baseRow + 4}`).value = sample.depthLabel;
      sheet.getCell(`B${baseRow + 6}`).value = sample.cipher;
    }

    // Скрываем строки после последней бирки
    const firstHiddenRow = FIRST_TAG_START + (waterSamples.length * TAG_HEIGHT);
    for (let i = firstHiddenRow; i <= sheet.rowCount; i++) {
      sheet.getRow(i).hidden = true;
    }
  }

  /**
   * Заполняет лист "Табличка в поле (2)" (таблички под печать для фото)
   * 
   * Структура:
   * - A1:A20 объединены - наименование объекта
   * - C2-D16: Справочник ПП/СК (ПП1/СК1, ПП2/СК2...)
   * - Row 21 (h=102): CONCATENATE(C2,"/",D2) => "ПП1/СК1"
   * - A22:A41 объединены - формула =A1 (наименование)
   * - И так далее... каждая табличка = 21 строка
   */
  async fillFieldTableSheet(workbook: ExcelJS.Workbook, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        samples: {
          include: { platform: true },
        },
      },
    });

    if (!project) return;

    // Используем лист "Табличка в поле (2)" с правильными настройками печати
    const sheet = workbook.getWorksheet('Табличка в поле (2)');
    if (!sheet) return;

    // Скрываем старый лист "Табличка в поле" (с неправильной вёрсткой)
    const oldSheet = workbook.getWorksheet('Табличка в поле');
    if (oldSheet) {
      oldSheet.state = 'hidden';
    }

    // Определяем количество уникальных площадок (только почва АХ)
    const soilSamples = project.samples.filter((s) => s.analysisCode === 'АХ');
    const uniquePlatforms = new Set(soilSamples.map((s) => s.platform.number));
    const platformCount = uniquePlatforms.size;

    if (platformCount === 0) {
      sheet.state = 'hidden';
      return;
    }

    // Заполняем A1 - наименование объекта (объединённая ячейка A1:A20)
    const objectNameField = await this.formatObjectField(
      project.objectName || project.name,
      project.objectAddress,
    );
    sheet.getCell('A1').value = objectNameField;

    // Константы
    const TABLE_HEIGHT = 21;

    // Скрываем таблички после последней нужной площадки
    const lastVisibleRow = platformCount * TABLE_HEIGHT;
    
    for (let i = lastVisibleRow + 1; i <= sheet.rowCount; i++) {
      sheet.getRow(i).hidden = true;
    }
  }

  /**
   * Удаляет устаревшие листы из рабочей книги
   */
  private removeObsoleteSheets(workbook: ExcelJS.Workbook): void {
    for (const sheetName of OBSOLETE_SHEETS) {
      const sheet = workbook.getWorksheet(sheetName);
      if (sheet) {
        workbook.removeWorksheet(sheet.id);
      }
    }
  }

  /**
   * Генерирует полный Excel файл со всеми листами
   */
  async generateFullExcel(options: GenerateOptions): Promise<GeneratedExcelResult> {
    const { projectId } = options;

    // Сначала генерируем заявку ИЛЦ
    const ilcResult = await this.generateIlcRequest(options);

    // Загружаем сгенерированный файл
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(ilcResult.filePath);

    // Удаляем устаревшие листы
    this.removeObsoleteSheets(workbook);

    // Заполняем лист "Акт отбора проб Почва"
    await this.fillSoilActSheet(workbook, projectId);

    // Заполняем лист "Акт отбора проб МБ" (если есть пробы АМ)
    await this.fillMbActSheet(workbook, projectId);

    // Заполняем лист "Акт отбора проб ДО" (если есть пробы БХ)
    await this.fillSedimentActSheet(workbook, projectId);

    // Заполняем лист "Акт отбора проб Вода" (если есть пробы ВХ)
    await this.fillWaterActSheet(workbook, projectId);

    // Заполняем лист "БОП" (бирки для проб почвы АХ)
    await this.fillSoilTagsSheet(workbook, projectId);

    // Заполняем лист "БОП МБ" (бирки для проб микробиологии АМ)
    await this.fillMbTagsSheet(workbook, projectId);

    // Заполняем лист "БОП БАК" (бирки для проб паразитологии АП)
    await this.fillBakTagsSheet(workbook, projectId);

    // Заполняем лист "БОП ДО" (бирки для донных отложений БХ)
    await this.fillDoTagsSheet(workbook, projectId);

    // Заполняем лист "БОП Вода" (бирки для воды ВХ)
    await this.fillWaterTagsSheet(workbook, projectId);

    // Заполняем лист "Табличка в поле" (таблички для фото)
    await this.fillFieldTableSheet(workbook, projectId);

    // Проверяем, есть ли пробы для каждого типа, и скрываем/удаляем пустые листы
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { samples: true },
    });

    if (project) {
      const hasAX = project.samples.some((s) => s.analysisCode === 'АХ');
      const hasAM = project.samples.some((s) => s.analysisCode === 'АМ');
      const hasAP = project.samples.some((s) => s.analysisCode === 'АП');
      const hasBX = project.samples.some((s) => s.analysisCode === 'БХ');
      const hasVX = project.samples.some((s) => s.analysisCode === 'ВХ');

      // Скрываем листы без данных
      if (!hasAX) {
        const soilSheet = workbook.getWorksheet('Акт отбора проб Почва');
        if (soilSheet) soilSheet.state = 'hidden';
        const bopSheet = workbook.getWorksheet('БОП');
        if (bopSheet) bopSheet.state = 'hidden';
      }

      if (!hasAM) {
        const mbSheet = workbook.getWorksheet('Акт отбора проб МБ');
        if (mbSheet) mbSheet.state = 'hidden';
        const bopMbSheet = workbook.getWorksheet('БОП МБ');
        if (bopMbSheet) bopMbSheet.state = 'hidden';
      }

      if (!hasAP) {
        const bopBakSheet = workbook.getWorksheet('БОП БАК');
        if (bopBakSheet) bopBakSheet.state = 'hidden';
      }

      if (!hasBX) {
        const doSheet = workbook.getWorksheet('Акт отбора проб ДО');
        if (doSheet) doSheet.state = 'hidden';
        const bopDoSheet = workbook.getWorksheet('БОП ДО');
        if (bopDoSheet) bopDoSheet.state = 'hidden';
      }

      if (!hasVX) {
        const waterSheet = workbook.getWorksheet('Акт отбора проб Вода');
        if (waterSheet) waterSheet.state = 'hidden';
        const bopWaterSheet = workbook.getWorksheet('БОП Вода');
        if (bopWaterSheet) bopWaterSheet.state = 'hidden';
      }
    }

    // Сохраняем обратно
    await workbook.xlsx.writeFile(ilcResult.filePath);

    return ilcResult;
  }
}
