import type { SampleCharacteristic, SampleType, PlatformType } from '../types/sample';

export const SAMPLE_TYPE_LABELS: Record<SampleType, string> = {
  SOIL: 'Почва',
  SEDIMENT: 'Донные отложения',
  WATER: 'Вода',
  AIR: 'Воздух',
  WASTE: 'Отходы',
  OTHER: 'Прочее',
};

export const SAMPLE_CHARACTERISTIC_LABELS: Record<SampleCharacteristic, string> = {
  CLAY: 'Глина',
  LOAM: 'Суглинок',
  SANDY_LOAM: 'Супесь',
  SAND: 'Песок',
  PEAT: 'Торф',
  SILT: 'Ил',
  GRAVEL: 'Гравий',
  ROCK: 'Скальный грунт',
  CHERNOZEM: 'Чернозем',
  OTHER: 'Прочее',
};

export const PLATFORM_TYPE_LABELS: Record<PlatformType, string> = {
  PP: 'ПП',
  SK: 'СК',
};

// Правила генерации проб для площадок
export const SAMPLE_GENERATION_RULES = {
  // Если площадок <= 3 и глубина <= 3м
  STANDARD: {
    maxPlatforms: 3,
    maxDepth: 3,
    samplesPerPlatform: {
      PP: 3,
      SK: 4, // Дополнительно 2 пробы на СК (всего 5 на площадку: 3 ПП + 4 СК = 7, но имелось в виду 3+2=5?)
    },
  },
};

