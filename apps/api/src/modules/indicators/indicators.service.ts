import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProtocolParserService, ParsedProtocol } from './protocol-parser.service';
import * as XLSX from 'xlsx';

// Типы грунтов для классификации
const SANDY_TYPES = ['песок', 'супесь', 'песчаный', 'супесчаный', 'пс'];
const CLAY_TYPES = ['глина', 'суглинок', 'глинистый', 'суглинистый', 'сг'];

@Injectable()
export class IndicatorsService {
  constructor(
    private prisma: PrismaService,
    private protocolParser: ProtocolParserService,
  ) {}

  /**
   * Получить все проекты с показателями для компании пользователя
   */
  async findAllWithIndicators(userId: string) {
    // Получаем компанию пользователя
    const member = await this.prisma.companyMember.findFirst({
      where: { userId },
      select: { companyId: true },
    });

    if (!member) {
      return [];
    }

    // Получаем проекты с показателями
    const projects = await this.prisma.project.findMany({
      where: {
        companyId: member.companyId,
        indicator: { isNot: null },
      },
      include: {
        indicator: {
          include: {
            samples: true,
          },
        },
        _count: {
          select: { samples: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      documentNumber: p.documentNumber,
      objectAddress: p.objectAddress,
      indicator: p.indicator
        ? {
            id: p.indicator.id,
            type: p.indicator.type,
            protocolNumber: p.indicator.protocolNumber,
            sampleCount: p.indicator.sampleCount,
            matchedSampleCount: p.indicator.samples.filter(
              (s) => s.matchedSampleId,
            ).length,
            createdAt: p.indicator.createdAt,
          }
        : null,
      totalSamples: p._count.samples,
    }));
  }

  /**
   * Получить список проектов без показателей (для выбора при создании)
   */
  async findProjectsWithoutIndicators(userId: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: { userId },
      select: { companyId: true },
    });

    if (!member) {
      return [];
    }

    const projects = await this.prisma.project.findMany({
      where: {
        companyId: member.companyId,
        indicator: null,
      },
      select: {
        id: true,
        name: true,
        documentNumber: true,
        objectAddress: true,
        _count: {
          select: { samples: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      documentNumber: p.documentNumber,
      objectAddress: p.objectAddress,
      sampleCount: p._count.samples,
    }));
  }

  /**
   * Создать показатели из загруженного протокола
   */
  async createFromProtocol(
    projectId: string,
    protocolFile: Express.Multer.File,
    userId: string,
  ) {
    // Проверяем доступ к проекту
    const project = await this.validateProjectAccess(projectId, userId);

    // Проверяем что у проекта ещё нет показателей
    const existingIndicator = await this.prisma.indicator.findUnique({
      where: { projectId },
    });
    if (existingIndicator) {
      throw new BadRequestException('У этого объекта уже есть показатели');
    }

    // Парсим протокол
    const parsed = this.protocolParser.parseProtocol(protocolFile.path);

    // Получаем пробы проекта для сопоставления
    const projectSamples = await this.prisma.sample.findMany({
      where: { projectId },
      select: {
        id: true,
        cipher: true,
        description: true,
      },
    });

    // Создаём показатели
    const indicator = await this.prisma.indicator.create({
      data: {
        projectId,
        type: 'SOIL_CHEMISTRY', // Грунты: химия + ЕРН в одном протоколе
        protocolFileName: protocolFile.originalname,
        protocolFileUrl: protocolFile.path,
        protocolNumber: parsed.metadata.protocolNumber,
        samplingDate: parsed.metadata.samplingDate,
        testingDateFrom: parsed.metadata.testingDateFrom,
        testingDateTo: parsed.metadata.testingDateTo,
        sampleCount: parsed.samples.length,
        samples: {
          create: parsed.samples.map((sample) => {
            // Ищем соответствующую пробу в проекте
            const matchedSample = projectSamples.find(
              (ps) => ps.cipher === sample.cipher,
            );

            // Определяем тип грунта
            const soilTypeCode = matchedSample
              ? this.determineSoilType(matchedSample.description)
              : null;

            return {
              sampleCipher: sample.cipher,
              matchedSampleId: matchedSample?.id || undefined,
              soilTypeCode,
              chemistryData: sample.chemistry.length > 0
                ? this.formatChemistryData(sample.chemistry)
                : undefined,
              radiationData: sample.radiation.length > 0
                ? this.formatRadiationData(sample.radiation)
                : undefined,
            };
          }),
        },
      },
      include: {
        samples: {
          include: {
            matchedSample: true,
          },
        },
      },
    });

    return {
      id: indicator.id,
      type: indicator.type,
      protocolNumber: indicator.protocolNumber,
      sampleCount: indicator.sampleCount,
      matchedSampleCount: indicator.samples.filter((s) => s.matchedSampleId)
        .length,
      samples: indicator.samples.map((s) => ({
        id: s.id,
        sampleCipher: s.sampleCipher,
        soilTypeCode: s.soilTypeCode,
        isMatched: !!s.matchedSampleId,
        matchedSampleDescription: s.matchedSample?.description,
      })),
    };
  }

  /**
   * Получить показатели по ID проекта
   */
  async findByProjectId(projectId: string, userId: string) {
    await this.validateProjectAccess(projectId, userId);

    const indicator = await this.prisma.indicator.findUnique({
      where: { projectId },
      include: {
        samples: {
          include: {
            matchedSample: {
              select: {
                id: true,
                cipher: true,
                description: true,
                depthLabel: true,
                platform: {
                  select: { label: true },
                },
              },
            },
          },
          orderBy: { sampleCipher: 'asc' },
        },
        project: {
          select: {
            id: true,
            name: true,
            documentNumber: true,
            objectAddress: true,
          },
        },
      },
    });

    if (!indicator) {
      throw new NotFoundException('Показатели не найдены');
    }

    return {
      id: indicator.id,
      type: indicator.type,
      protocolNumber: indicator.protocolNumber,
      protocolFileName: indicator.protocolFileName,
      samplingDate: indicator.samplingDate,
      testingDateFrom: indicator.testingDateFrom,
      testingDateTo: indicator.testingDateTo,
      sampleCount: indicator.sampleCount,
      biotestFileName: indicator.biotestFileName,
      biotestData: indicator.biotestData as Record<string, { bkr: number; tkr: number }> | null,
      project: indicator.project,
      samples: indicator.samples.map((s) => ({
        id: s.id,
        sampleCipher: s.sampleCipher,
        soilTypeCode: s.soilTypeCode,
        isMatched: !!s.matchedSampleId,
        matchedSample: s.matchedSample,
        chemistryData: s.chemistryData,
        radiationData: s.radiationData,
      })),
    };
  }

  /**
   * Загрузить файл биотестирования
   */
  async uploadBiotest(
    projectId: string,
    file: Express.Multer.File,
    userId: string,
  ) {
    await this.validateProjectAccess(projectId, userId);

    const indicator = await this.prisma.indicator.findUnique({
      where: { projectId },
    });

    if (!indicator) {
      throw new NotFoundException('Показатели не найдены. Сначала загрузите протокол.');
    }

    const biotestData = this.parseBiotestFile(file.path);

    await this.prisma.indicator.update({
      where: { id: indicator.id },
      data: {
        biotestFileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        biotestData,
      },
    });

    return {
      success: true,
      samplesCount: Object.keys(biotestData).length,
      fileName: file.originalname,
    };
  }

  /**
   * Парсинг файла биотестирования
   * Извлекает БКР и ТКР для каждой пробы
   */
  private parseBiotestFile(
    filePath: string,
  ): Record<string, { bkr: number; tkr: number }> {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
    });

    const result: Record<string, { bkr: number; tkr: number }> = {};
    let currentCipher: string | null = null;
    let currentBkr: number | null = null;
    let currentTkr: number | null = null;

    const saveCurrent = () => {
      if (currentCipher && currentBkr !== null && currentTkr !== null) {
        result[currentCipher] = { bkr: currentBkr, tkr: currentTkr };
      }
    };

    for (const row of rows) {
      const cellA = String(row[0] || '').trim();
      const cellALower = cellA.toLowerCase();

      // Шифр пробы — два формата:
      // "Наименование образца испытаний (маркировка) : 01АХ.01"
      // "Наименование испытательного образца: 01АХ.01"
      const cipherMatch = cellA.match(
        /(?:маркировка\)?\s*:|испытательного образца\s*:)\s*(.+)/i,
      );
      if (cipherMatch) {
        saveCurrent();
        currentCipher = cipherMatch[1].trim();
        currentBkr = null;
        currentTkr = null;
        continue;
      }

      if (!currentCipher) continue;

      // Ищем БКР/ТКР в столбце A или B (разные форматы файлов)
      const cellB = String(row[1] || '').trim().toLowerCase();
      const label = cellALower || cellB;

      if (label.includes('безвредная кратность')) {
        // Значение в столбце D (index 3) или G (index 6)
        const val = this.parseBiotestValue(row[3]) ?? this.parseBiotestValue(row[6]);
        if (val !== null) currentBkr = val;
      } else if (label.includes('токсичная кратность')) {
        const val = this.parseBiotestValue(row[3]) ?? this.parseBiotestValue(row[6]);
        if (val !== null) currentTkr = val;
      }
    }

    saveCurrent();

    if (Object.keys(result).length === 0) {
      throw new BadRequestException(
        'Не удалось извлечь данные биотестирования из файла',
      );
    }

    return result;
  }

  private parseBiotestValue(cell: unknown): number | null {
    if (cell === null || cell === undefined) return null;
    if (typeof cell === 'number') return cell;
    const str = String(cell).trim().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Удалить показатели
   */
  async delete(projectId: string, userId: string) {
    await this.validateProjectAccess(projectId, userId);

    const indicator = await this.prisma.indicator.findUnique({
      where: { projectId },
    });

    if (!indicator) {
      throw new NotFoundException('Показатели не найдены');
    }

    await this.prisma.indicator.delete({
      where: { id: indicator.id },
    });

    return { success: true };
  }

  /**
   * Определение типа грунта по описанию пробы
   * ПС = песок/супесь, СГ = суглинок/глина, null = нет характеристики
   */
  private determineSoilType(description: string | null): string | null {
    if (!description) return null;

    const lowerDesc = description.toLowerCase();

    // Проверяем песчаные типы
    for (const type of SANDY_TYPES) {
      if (lowerDesc.includes(type)) {
        return 'ПС';
      }
    }

    // Проверяем глинистые типы
    for (const type of CLAY_TYPES) {
      if (lowerDesc.includes(type)) {
        return 'СГ';
      }
    }

    return null;
  }

  /**
   * Форматирование данных химии в JSON
   */
  private formatChemistryData(
    chemistry: ParsedProtocol['samples'][0]['chemistry'],
  ): Record<string, { value: string | number; uncertainty: string | null; unit: string }> {
    const result: Record<string, { value: string | number; uncertainty: string | null; unit: string }> = {};

    for (const item of chemistry) {
      // Используем нормализованный ключ
      const key = this.normalizeIndicatorKey(item.name);
      result[key] = {
        value: item.value,
        uncertainty: item.uncertainty,
        unit: item.unit,
      };
    }

    return result;
  }

  /**
   * Форматирование данных радиации в JSON
   */
  private formatRadiationData(
    radiation: ParsedProtocol['samples'][0]['radiation'],
  ): Record<string, { value: string | number; unit: string }> {
    const result: Record<string, { value: string | number; unit: string }> = {};

    for (const item of radiation) {
      const key = this.normalizeIndicatorKey(item.name);
      result[key] = {
        value: item.value,
        unit: item.unit,
      };
    }

    // Расчёт Аэфф если отсутствует: Аэфф = ARa-226 + 1.31*ATh-232 + 0.085*AK-40
    if (!result.Aeff) {
      const toNum = (v: string | number | undefined): number | null => {
        if (v === undefined) return null;
        if (typeof v === 'number') return v;
        const n = parseFloat(String(v).replace(',', '.'));
        return isNaN(n) ? null : n;
      };
      const ra = toNum(result.Ra226?.value);
      const th = toNum(result.Th232?.value);
      const k = toNum(result.K40?.value);
      if (ra !== null && th !== null && k !== null) {
        result.Aeff = {
          value: Math.round(ra + 1.31 * th + 0.085 * k),
          unit: result.Ra226?.unit || 'Бк/кг',
        };
      }
    }

    return result;
  }

  /**
   * Нормализация названия показателя для использования в качестве ключа
   */
  private normalizeIndicatorKey(name: string): string {
    // Маппинг известных показателей
    const mapping: Record<string, string> = {
      'pH солевой вытяжки': 'pH',
      'Бенз(а)пирен': 'benzapyrene',
      'Кадмий (Cd)': 'Cd',
      'Медь (Cu)': 'Cu',
      'Мышьяк (As)': 'As',
      'Нефтепродукты': 'oilProducts',
      'Никель (Ni)': 'Ni',
      'Ртуть (Hg)': 'Hg',
      'Свинец (Pb)': 'Pb',
      'Цинк (Zn)': 'Zn',
      'Удельная активность Cs-137': 'Cs137',
      'Удельная активность K-40': 'K40',
      'Удельная активность Ra-226': 'Ra226',
      'Удельная активностьTh-232': 'Th232',
      'Эффективная удельная  активность природных радионуклидов (Aэфф)': 'Aeff',
    };

    return mapping[name] || name;
  }

  /**
   * Проверка доступа к проекту
   */
  private async validateProjectAccess(projectId: string, userId: string) {
    const member = await this.prisma.companyMember.findFirst({
      where: { userId },
      select: { companyId: true },
    });

    if (!member) {
      throw new NotFoundException('Компания не найдена');
    }

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: member.companyId,
      },
    });

    if (!project) {
      throw new NotFoundException('Объект не найден');
    }

    return project;
  }
}
