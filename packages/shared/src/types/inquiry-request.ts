/**
 * Типы для запросов справок в ведомства
 */

// Регион объекта (определяет набор справок)
export type InquiryRegion = 'MOSCOW' | 'MOSCOW_OBLAST';

// Базовый интерфейс справки
export interface InquiryType {
  id: string;
  name: string;
  shortName: string;
  templateFile: string;
  order: number; // порядок в списке
  description?: string;
}

// Справки для г. Москвы
export const MOSCOW_INQUIRIES: InquiryType[] = [
  {
    id: 'CGMS_CLIMATE',
    name: 'ФГБУ «Центральное УГМС» - фон/климат',
    shortName: 'ЦГМС-Р фон-климат',
    templateFile: '0. ЦГМС-Р фон-климат.docx',
    order: 0,
    description: 'Справка о фоновых концентрациях и климатических характеристиках',
  },
  {
    id: 'DPOOS',
    name: 'Департамент природопользования и охраны окружающей среды города Москвы',
    shortName: 'ДПиООС Москвы',
    templateFile: '1. ДПиООС Москвы.docx',
    order: 1,
    description: 'ООПТ, водные объекты, зеленые насаждения',
  },
  {
    id: 'DKN',
    name: 'Департамент культурного наследия города Москвы',
    shortName: 'ДКН г.Москвы',
    templateFile: '2. ДКН г.Москвы.docx',
    order: 2,
    description: 'Объекты культурного наследия',
  },
  {
    id: 'VETERINARY',
    name: 'Комитет ветеринарии города Москвы',
    shortName: 'Комитет ветеринарии',
    templateFile: '3. Комитет ветеринарии г.Москвы.docx',
    order: 3,
    description: 'Сибирская язва, скотомогильники',
  },
  {
    id: 'MVK_ZSO',
    name: 'Межведомственная комиссия по ЗСО источников питьевого водоснабжения',
    shortName: 'МВК ЗСО',
    templateFile: '4. МВК ЗСО.docx',
    order: 4,
    description: 'Зоны санитарной охраны водоисточников',
  },
  {
    id: 'DEP_TRADE',
    name: 'Департамент торговли и услуг города Москвы',
    shortName: 'ДепТорговли Москвы',
    templateFile: '5. ДепТорговли Москвы.docx',
    order: 5,
    description: 'Рынки, ярмарки',
  },
  {
    id: 'DEP_GKH',
    name: 'Департамент ЖКХ города Москвы',
    shortName: 'Департамент ЖКХ',
    templateFile: '6. Департамент ЖКХ.docx',
    order: 6,
    description: 'Полигоны ТКО, свалки',
  },
  {
    id: 'UPRAVA',
    name: 'Управа района',
    shortName: 'Управа района',
    templateFile: '7. Управа района.docx',
    order: 7,
    description: 'Информация о территории',
  },
  {
    id: 'MINPRIRODY',
    name: 'Министерство природных ресурсов и экологии РФ',
    shortName: 'МинПрироды РФ',
    templateFile: '8. МинПрироды РФ.docx',
    order: 8,
    description: 'Недра, ООПТ федерального значения',
  },
];

// Справки для Московской области
export const MOSCOW_OBLAST_INQUIRIES: InquiryType[] = [
  {
    id: 'GU_KN_MO',
    name: 'Главное управление культурного наследия Московской области',
    shortName: 'ГУ КН МО',
    templateFile: '1. ГУ КН МО.docx',
    order: 1,
    description: 'Объекты культурного наследия',
  },
  {
    id: 'MSH_VETERINARY',
    name: 'Министерство сельского хозяйства и продовольствия МО (ветеринария)',
    shortName: 'МСХ МО (ветеринария)',
    templateFile: '2. МСХ МО (ветеринария).docx',
    order: 2,
    description: 'Сибирская язва, скотомогильники',
  },
  {
    id: 'VODOKANAL',
    name: 'Местный водоканал',
    shortName: 'Водоканал местный',
    templateFile: '3. Водоканал местный.docx',
    order: 3,
    description: 'Зоны санитарной охраны водоисточников',
  },
  {
    id: 'MVK_ZSO_MO',
    name: 'Межведомственная комиссия по ЗСО источников питьевого водоснабжения',
    shortName: 'МВК ЗСО',
    templateFile: '4. МВК ЗСО.docx',
    order: 4,
    description: 'Зоны санитарной охраны водоисточников',
  },
  {
    id: 'ADMINISTRATION',
    name: 'Администрация муниципального образования',
    shortName: 'Администрация',
    templateFile: '5. Адм-я.docx',
    order: 5,
    description: 'Информация о территории, свалки, скотомогильники',
  },
  {
    id: 'KLH',
    name: 'Комитет лесного хозяйства Московской области',
    shortName: 'КЛХ',
    templateFile: '6. КЛХ.docx',
    order: 6,
    description: 'Леса, лесничества',
  },
  {
    id: 'CGMS_CLIMATE_MO',
    name: 'ФГБУ «Центральное УГМС» - фон/климат',
    shortName: 'ЦГМС-Р фон-климат',
    templateFile: '7. ЦГМС-Р фон-климат.docx',
    order: 7,
    description: 'Справка о фоновых концентрациях и климатических характеристиках',
  },
  {
    id: 'MIN_ECOLOGY_ZSO',
    name: 'Министерство экологии и природопользования МО (ЗСО)',
    shortName: 'Мин Экологии ЗСО',
    templateFile: '8. Мин Экологии ЗСО.docx',
    order: 8,
    description: 'ООПТ, водные объекты',
  },
  {
    id: 'MINPRIRODY_MO',
    name: 'Министерство природных ресурсов и экологии РФ',
    shortName: 'МинПрироды РФ',
    templateFile: '9. МинПрироды РФ.docx',
    order: 9,
    description: 'Недра, ООПТ федерального значения',
  },
];

// Получить список справок по региону
export function getInquiriesByRegion(region: InquiryRegion): InquiryType[] {
  return region === 'MOSCOW' ? MOSCOW_INQUIRIES : MOSCOW_OBLAST_INQUIRIES;
}

// Определить регион по адресу
export function detectRegionFromAddress(address: string): InquiryRegion {
  const addressLower = address.toLowerCase();
  
  // Признаки Московской области
  const moPatterns = [
    'московская область',
    'моск. обл',
    'мо,',
    'московской области',
    'г.о.',
    'городской округ',
    'район московской',
  ];
  
  // Признаки г. Москвы (проверяем если нет признаков МО)
  const moscowPatterns = [
    'г. москва',
    'г.москва',
    'город москва',
    'москва,',
  ];
  
  // Сначала проверяем на МО (приоритет)
  for (const pattern of moPatterns) {
    if (addressLower.includes(pattern)) {
      return 'MOSCOW_OBLAST';
    }
  }
  
  // Затем на Москву
  for (const pattern of moscowPatterns) {
    if (addressLower.includes(pattern)) {
      return 'MOSCOW';
    }
  }
  
  // По умолчанию — Москва
  return 'MOSCOW';
}

// Интерфейс сгенерированного файла
export interface GeneratedInquiryFile {
  inquiryId: string;
  inquiryName: string;
  fileName: string;
  fileUrl: string;
  generatedAt: string;
}

// Интерфейс запроса справок (для API)
export interface InquiryRequest {
  id: string;
  projectId: string;
  region: InquiryRegion;
  selectedInquiries: string[];
  additionalData?: Record<string, string>;
  generatedFiles?: GeneratedInquiryFile[];
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// DTO для создания/обновления запроса справок
export interface UpdateInquiryRequestDto {
  selectedInquiries?: string[];
  additionalData?: Record<string, string>;
}

// DTO для генерации справок
export interface GenerateInquiriesDto {
  inquiryIds: string[]; // какие справки генерировать
}

// Результат генерации
export interface GenerateInquiriesResult {
  success: boolean;
  generatedFiles: GeneratedInquiryFile[];
  errors?: { inquiryId: string; error: string }[];
}

