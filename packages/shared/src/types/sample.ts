// Проба
export interface Sample {
  id: string;
  orderId: string;
  cipher: string; // Шифр пробы
  platformNumber: string; // ПП1, СК1 и т.д.
  platformType: PlatformType;
  depth: number; // Глубина в метрах
  type: SampleType;
  characteristic?: SampleCharacteristic;
  coordinates?: Coordinates;
  gpsPhotoUrl?: string;
  isSubcontract: boolean; // Уходит на подряд
  status: SampleStatus;
  collectedAt?: Date;
  collectedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PlatformType = 'PP' | 'SK'; // ПП или СК

export type SampleType = 
  | 'SOIL'      // Почва
  | 'SEDIMENT'  // Донные отложения
  | 'WATER'     // Вода
  | 'AIR'       // Воздух
  | 'WASTE'     // Отходы
  | 'OTHER';

export type SampleStatus = 
  | 'PENDING'    // Ожидает отбора
  | 'COLLECTED'  // Отобрана
  | 'DELIVERED'  // Доставлена в лабораторию
  | 'ANALYZED'   // Проанализирована
  | 'COMPLETED'; // Завершено

export type SampleCharacteristic = 
  | 'CLAY'           // Глина
  | 'LOAM'           // Суглинок
  | 'SANDY_LOAM'     // Супесь
  | 'SAND'           // Песок
  | 'PEAT'           // Торф
  | 'SILT'           // Ил
  | 'GRAVEL'         // Гравий
  | 'ROCK'           // Скальный грунт
  | 'CHERNOZEM'      // Чернозем
  | 'OTHER';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CreateSampleDto {
  orderId: string;
  platformNumber: string;
  platformType: PlatformType;
  depth: number;
  type: SampleType;
  isSubcontract?: boolean;
}

export interface UpdateSampleDto {
  characteristic?: SampleCharacteristic;
  coordinates?: Coordinates;
  gpsPhotoUrl?: string;
  status?: SampleStatus;
}

// Платформа/Площадка
export interface Platform {
  id: string;
  orderId: string;
  number: number;
  type: PlatformType;
  label: string; // ПП1, СК1 и т.д.
  samples: Sample[];
}

