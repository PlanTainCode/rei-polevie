import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SamplingLayer } from './word-parser.service';
import { PlatformType, SampleType } from '@prisma/client';

export interface GenerateSamplesInput {
  projectId: string;
  samplingLayers: SamplingLayer[];
  platformCount: number; // Количество площадок (ПП и СК)
  hasMicrobiology?: boolean; // Есть ли микробиология (АМ + АП)
  sedimentCount?: number; // Количество проб донных отложений (БХ)
  sedimentLayers?: SamplingLayer[]; // Слои донных отложений
  waterCount?: number; // Количество проб воды (ВХ)
  waterLayers?: SamplingLayer[]; // Слои воды
}

interface GeneratedSample {
  cipher: string;
  sampleNumber: number;
  analysisCode: string;
  layerNumber: number;
  depthFrom: number;
  depthTo: number;
  depthLabel: string;
  platformType: PlatformType;
  platformNumber: number;
  platformLabel: string;
  type: SampleType;
}

@Injectable()
export class SamplesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Генерирует пробы для проекта на основе слоёв отбора
   */
  async generateSamplesForProject(input: GenerateSamplesInput): Promise<void> {
    const { 
      projectId, 
      samplingLayers, 
      platformCount, 
      hasMicrobiology, 
      sedimentCount, 
      sedimentLayers,
      waterCount,
      waterLayers,
    } = input;

    const samples: GeneratedSample[] = [];

    // Генерируем пробы АХ (почва) если есть слои
    if (samplingLayers.length > 0 && platformCount > 0) {
      const soilSamples = this.generateSamples(samplingLayers, platformCount);
      samples.push(...soilSamples);
    }
    
    // Генерируем пробы АМ и АП (микробиология + паразитология) если есть
    if (hasMicrobiology && platformCount > 0) {
      const mbSamples = this.generateMicrobiologySamples(platformCount);
      samples.push(...mbSamples);
    }

    // Генерируем пробы БХ (донные отложения) если есть
    if (sedimentCount && sedimentCount > 0) {
      const sedimentSamples = this.generateSedimentSamples(sedimentCount, sedimentLayers);
      samples.push(...sedimentSamples);
    }

    // Генерируем пробы ВХ (вода) если есть
    if (waterCount && waterCount > 0) {
      const waterSamples = this.generateWaterSamples(waterCount, waterLayers);
      samples.push(...waterSamples);
    }

    if (samples.length === 0) {
      // Просто удаляем старые данные если нет новых проб
      await this.prisma.$transaction([
        this.prisma.sample.deleteMany({ where: { projectId } }),
        this.prisma.platform.deleteMany({ where: { projectId } }),
      ]);
      return;
    }

    // Создаём площадки
    const platformsToCreate = new Map<string, { type: PlatformType; number: number; label: string }>();
    
    for (const sample of samples) {
      const key = `${sample.platformType}-${sample.platformNumber}`;
      if (!platformsToCreate.has(key)) {
        platformsToCreate.set(key, {
          type: sample.platformType,
          number: sample.platformNumber,
          label: sample.platformLabel,
        });
      }
    }

    // Выполняем всё в транзакции
    await this.prisma.$transaction(async (tx) => {
      // Удаляем старые пробы и площадки
      await tx.sample.deleteMany({ where: { projectId } });
      await tx.platform.deleteMany({ where: { projectId } });

      // Создаём площадки в БД
      const platformRecords: Record<string, string> = {};
      
      for (const [key, platform] of platformsToCreate) {
        const created = await tx.platform.create({
          data: {
            projectId,
            type: platform.type,
            number: platform.number,
            label: platform.label,
          },
        });
        platformRecords[key] = created.id;
      }

      // Создаём пробы в БД
      for (const sample of samples) {
        const platformKey = `${sample.platformType}-${sample.platformNumber}`;
        const platformId = platformRecords[platformKey];

        // Определяем массу в зависимости от типа анализа
        let mass = '1,0 кг/Пэ'; // По умолчанию для АХ, БХ
        if (sample.analysisCode === 'АМ') {
          mass = '750 г/Пэ';
        } else if (sample.analysisCode === 'АП') {
          mass = '200 г/Пэ';
        } else if (sample.analysisCode === 'ВХ') {
          mass = '1,0 л/Ст; 1,5л Пэ';
        }

        await tx.sample.create({
          data: {
            projectId,
            platformId,
            cipher: sample.cipher,
            sampleNumber: sample.sampleNumber,
            analysisCode: sample.analysisCode,
            layerNumber: sample.layerNumber,
            depthFrom: sample.depthFrom,
            depthTo: sample.depthTo,
            depthLabel: sample.depthLabel,
            type: sample.type,
            mass,
          },
        });
      }
    });
  }

  /**
   * Генерирует список проб на основе слоёв
   * 
   * Формат шифра: {номер_площадки}{код_анализа}.{номер_слоя}
   * Пример: 01АХ.01, 02АХ.01, 03АХ.01, 01АХ.02, 02АХ.02...
   * 
   * Первый номер (01, 02, 03) — номер площадки
   * Второй номер (.01, .02) — номер слоя
   * 
   * Количество проб для каждого слоя берётся из layer.count
   */
  private generateSamples(
    samplingLayers: SamplingLayer[],
    platformCount: number, // используется как fallback если layer.count не задан
  ): GeneratedSample[] {
    const samples: GeneratedSample[] = [];
    let layerNumber = 1;

    // Сортируем слои по глубине
    const sortedLayers = [...samplingLayers].sort(
      (a, b) => a.depthFrom - b.depthFrom,
    );

    for (const layer of sortedLayers) {
      // Количество проб для данного слоя (из таблицы или fallback)
      const layerCount = layer.count > 0 ? layer.count : platformCount;
      
      // Для каждой площадки создаём пробу в данном слое
      for (let pNum = 1; pNum <= layerCount; pNum++) {
        // Определяем тип площадки
        // Слой 0,0-0,2 = ПП, остальные = СК
        const platformType: PlatformType = layer.isPP ? 'PP' : 'SK';
        const platformLabel = layer.isPP ? `ПП${pNum}` : `СК${pNum}`;

        // Формируем шифр: 01АХ.01
        // Первый номер = номер площадки, второй = номер слоя
        const platformNumStr = pNum.toString().padStart(2, '0');
        const layerNumStr = layerNumber.toString().padStart(2, '0');
        const analysisCode = 'АХ'; // Для почв по умолчанию АХ
        const cipher = `${platformNumStr}${analysisCode}.${layerNumStr}`;

        samples.push({
          cipher,
          sampleNumber: pNum, // Номер площадки
          analysisCode,
          layerNumber,
          depthFrom: layer.depthFrom,
          depthTo: layer.depthTo,
          depthLabel: layer.label,
          platformType,
          platformNumber: pNum,
          platformLabel,
          type: 'SOIL',
        });
      }

      layerNumber++;
    }

    return samples;
  }

  /**
   * Генерирует пробы АМ (микробиология) и АП (паразитология)
   * 
   * АМ: глубина 0,0-0,2, масса 750 г/Пэ
   * АП: глубина 0,0-0,1, масса 200 г/Пэ
   * 
   * Одна строка в акте = одна площадка = пара проб АМ + АП
   */
  private generateMicrobiologySamples(platformCount: number): GeneratedSample[] {
    const samples: GeneratedSample[] = [];

    for (let pNum = 1; pNum <= platformCount; pNum++) {
      const platformNumStr = pNum.toString().padStart(2, '0');

      // Проба АМ (микробиология)
      samples.push({
        cipher: `${platformNumStr}АМ.01`,
        sampleNumber: pNum,
        analysisCode: 'АМ',
        layerNumber: 1,
        depthFrom: 0,
        depthTo: 0.2,
        depthLabel: '0,0-0,2',
        platformType: 'PP',
        platformNumber: pNum,
        platformLabel: `ПП${pNum}`,
        type: 'SOIL',
      });

      // Проба АП (паразитология)
      samples.push({
        cipher: `${platformNumStr}АП.01`,
        sampleNumber: pNum,
        analysisCode: 'АП',
        layerNumber: 1,
        depthFrom: 0,
        depthTo: 0.1,
        depthLabel: '0,0-0,1',
        platformType: 'PP',
        platformNumber: pNum,
        platformLabel: `ПП${pNum}`,
        type: 'SOIL',
      });
    }

    return samples;
  }

  /**
   * Генерирует пробы БХ (донные отложения)
   * 
   * БХ: масса 1,0 кг/Пэ
   * Площадки: ДО1, ДО2, ДО3...
   * Глубина берётся из слоёв, если есть
   */
  private generateSedimentSamples(count: number, layers?: SamplingLayer[]): GeneratedSample[] {
    const samples: GeneratedSample[] = [];

    // Если есть слои — генерируем по слоям
    if (layers && layers.length > 0) {
      const sortedLayers = [...layers].sort((a, b) => a.depthFrom - b.depthFrom);
      let layerNumber = 1;
      
      for (const layer of sortedLayers) {
        // Количество проб на слое
        const layerCount = layer.count || count;
        
        for (let pNum = 1; pNum <= layerCount; pNum++) {
          const platformNumStr = pNum.toString().padStart(2, '0');
          const layerNumStr = layerNumber.toString().padStart(2, '0');

          samples.push({
            cipher: `${platformNumStr}БХ.${layerNumStr}`,
            sampleNumber: pNum,
            analysisCode: 'БХ',
            layerNumber,
            depthFrom: layer.depthFrom,
            depthTo: layer.depthTo,
            depthLabel: layer.label,
            platformType: 'DO',
            platformNumber: pNum,
            platformLabel: `ДО${pNum}`,
            type: 'SEDIMENT',
          });
        }
        layerNumber++;
      }
    } else {
      // Резервный вариант: один слой 0,0-0,2
      for (let pNum = 1; pNum <= count; pNum++) {
        const platformNumStr = pNum.toString().padStart(2, '0');

        samples.push({
          cipher: `${platformNumStr}БХ.01`,
          sampleNumber: pNum,
          analysisCode: 'БХ',
          layerNumber: 1,
          depthFrom: 0,
          depthTo: 0.2,
          depthLabel: '0,0-0,2',
          platformType: 'DO',
          platformNumber: pNum,
          platformLabel: `ДО${pNum}`,
          type: 'SEDIMENT',
        });
      }
    }

    return samples;
  }

  /**
   * Генерирует пробы ВХ (вода)
   * 
   * ВХ: масса 1,0 л/Ст; 1,5л Пэ
   * Площадки: В1, В2, В3...
   * Глубина берётся из слоёв, если есть
   */
  private generateWaterSamples(count: number, layers?: SamplingLayer[]): GeneratedSample[] {
    const samples: GeneratedSample[] = [];

    // Если есть слои — генерируем по слоям
    if (layers && layers.length > 0) {
      const sortedLayers = [...layers].sort((a, b) => a.depthFrom - b.depthFrom);
      let layerNumber = 1;
      
      for (const layer of sortedLayers) {
        const layerCount = layer.count || count;
        
        for (let pNum = 1; pNum <= layerCount; pNum++) {
          const platformNumStr = pNum.toString().padStart(2, '0');
          const layerNumStr = layerNumber.toString().padStart(2, '0');

          samples.push({
            cipher: `${platformNumStr}ВХ.${layerNumStr}`,
            sampleNumber: pNum,
            analysisCode: 'ВХ',
            layerNumber,
            depthFrom: layer.depthFrom,
            depthTo: layer.depthTo,
            depthLabel: layer.label,
            platformType: 'V',
            platformNumber: pNum,
            platformLabel: `В${pNum}`,
            type: 'WATER',
          });
        }
        layerNumber++;
      }
    } else {
      // Резервный вариант: один слой (глубина не применима к воде)
      for (let pNum = 1; pNum <= count; pNum++) {
        const platformNumStr = pNum.toString().padStart(2, '0');

        samples.push({
          cipher: `${platformNumStr}ВХ.01`,
          sampleNumber: pNum,
          analysisCode: 'ВХ',
          layerNumber: 1,
          depthFrom: 0,
          depthTo: 0,
          depthLabel: '-',
          platformType: 'V',
          platformNumber: pNum,
          platformLabel: `В${pNum}`,
          type: 'WATER',
        });
      }
    }

    return samples;
  }

  /**
   * Получает все пробы проекта с площадками
   */
  async getSamplesByProject(projectId: string) {
    return this.prisma.sample.findMany({
      where: { projectId },
      include: {
        platform: true,
      },
      orderBy: [
        { sampleNumber: 'asc' }, // По номеру площадки
        { layerNumber: 'asc' },   // По номеру слоя
      ],
    });
  }

  /**
   * Обновляет описание и координаты пробы
   */
  async updateSample(
    sampleId: string,
    data: {
      description?: string;
      latitude?: string;
      longitude?: string;
    },
  ) {
    return this.prisma.sample.update({
      where: { id: sampleId },
      data,
    });
  }

  /**
   * Отмечает пробу как собранную
   */
  async markAsCollected(sampleId: string, userId: string) {
    return this.prisma.sample.update({
      where: { id: sampleId },
      data: {
        status: 'COLLECTED',
        collectedAt: new Date(),
        collectedById: userId,
      },
    });
  }
}

