/**
 * Структура полей ТЗ (Задание на инженерные изыскания)
 * Соответствует шаблону "Задание ИИ_шаблон.docx"
 */

// Виды инженерных изысканий (чекбоксы)
export interface SurveyTypes {
  hydrometeorology: boolean;  // Инженерно-гидрометеорологические изыскания
  geology: boolean;           // Инженерно-геологические изыскания
  ecology: boolean;           // Инженерно-экологические изыскания
}

// Виды градостроительной деятельности (чекбоксы)
export interface UrbanPlanningActivities {
  architecturalDesign: boolean;      // Архитектурно-строительное проектирование
  capitalRepair: boolean;            // Капитальный ремонт
  reconstruction: boolean;           // Реконструкция
  territoryDevelopment: boolean;     // Комплексное развитие территории
  territorialPlanning: boolean;      // Территориальное планирование
  urbanZoning: boolean;              // Градостроительное зонирование
  territoryPlanning: boolean;        // Планировка территории
  construction: boolean;             // Строительство
  demolition: boolean;               // Снос объектов капитального строительства
  buildingOperation: boolean;        // Эксплуатация зданий, сооружений
}

// Идентификационные сведения о заказчике
export interface CustomerInfo {
  name: string;                // Наименование (ООО "Название")
  ogrn?: string;               // ОГРН
  address: string;             // Юридический адрес
  contactName?: string;        // ФИО контактного лица
  contactPhone?: string;       // Телефон
  contactEmail?: string;       // Email
}

// Идентификационные сведения об объекте
export interface ObjectInfo {
  purpose?: string;                        // Назначение объекта
  transportInfrastructure: boolean;        // Принадлежность к транспортной инфраструктуре
  dangerousProduction: boolean;            // Принадлежность к опасным производственным объектам
  fireHazard?: string;                     // Пожарная и взрывопожарная опасность
  responsibilityLevel?: string;            // Уровень ответственности (Нормальный/Повышенный)
  permanentPresence?: string;              // Наличие помещений с постоянным нахождением людей
  technogenicImpact?: string;              // Предполагаемые техногенные воздействия
}

// Технические характеристики объекта
export interface TechnicalCharacteristics {
  description?: string;                    // Описание объекта
  excavationDepth?: string;                // Глубина ведения земляных работ
  foundationType?: string;                 // Тип фундамента
  foundationDepth?: string;                // Глубина заложения фундамента
  foundationLoad?: string;                 // Нагрузка на основание
  basementInfo?: string;                   // Местоположение и глубины подвалов
  settlementInfo?: string;                 // Допустимые осадки
}

// Состав работ ИЭИ (инженерно-экологические изыскания)
export interface EcologySurveyWorks {
  gammaTerrain: boolean;                   // Измерение МЭД гамма-излучения на территории
  gammaBuilding: boolean;                  // Измерение МЭД гамма-излучения в здании
  gammaSpectrometerySoil: boolean;         // Гамма-спектрометрия проб грунта
  gammaSpectrometryOss: boolean;           // Гамма-спектрометрия проб ОСС
  radonTerrain: boolean;                   // Измерение ПП радона на территории
  radonBuilding: boolean;                  // Измерение ЭРОА радона в здании
  heavyMetalsSoil: boolean;                // Определение тяжелых металлов в грунте
  heavyMetalsOss: boolean;                 // Определение тяжелых металлов в ОСС
  benzpyrene: boolean;                     // Определение 3,4-бенз(а)пирена
  oilProducts: boolean;                    // Определение нефтепродуктов
  microbiologySoil: boolean;               // Микробиологическое исследование грунта
  airAnalysis: boolean;                    // Санитарно-химический анализ воздуха
  waterChemistry: boolean;                 // Санитарно-химический анализ воды
  waterMicrobiology: boolean;              // Микробиологический анализ воды
  gasGeochemistry: boolean;                // Газогеохимические исследования
  noiseLevel: boolean;                     // Измерение шума
  vibration: boolean;                      // Измерение вибрации
  emf: boolean;                            // Измерение электромагнитного поля
}

// Полная структура данных ТЗ
export interface TechnicalTaskData {
  // Основная информация
  contractNumber?: string;                 // № договора
  contractDate?: string;                   // Дата договора
  taskNumber?: string;                     // № ЗИИ (задания)
  year?: string;                           // Год

  // Наименование и местоположение
  objectName: string;                      // Полное наименование объекта
  objectLocation: string;                  // Местоположение объекта (адрес)
  cadastralNumber?: string;                // Кадастровый номер
  territoryDescription?: string;           // Описание границ территории
  areaSize?: string;                       // Площадь участка

  // Виды работ
  surveyTypes: SurveyTypes;
  urbanPlanningActivities: UrbanPlanningActivities;
  ecologySurveyWorks?: EcologySurveyWorks;

  // Участники
  customer: CustomerInfo;

  // Объект
  objectInfo: ObjectInfo;
  technicalCharacteristics: TechnicalCharacteristics;

  // Дополнительные сведения
  additionalRequirements?: string[];       // Дополнительные требования
  pollutionSources?: string;               // Сведения об источниках загрязнения
  previousSurveys?: string;                // Материалы ранее выполненных изысканий
  providedDocuments?: string[];            // Перечень предоставленных документов
  normativeDocuments?: string[];           // Перечень НТД
  
  // Для ИГИ (геология)
  projectSolutions?: string;               // Основные проектные решения
  
  // Для ИГМИ (гидрометеорология)
  hydrometeoCharacteristics?: string[];    // Перечень гидрометеорологических характеристик

  // Результаты работ
  reportRequirements?: string;             // Требования к отчетной документации
}

// Поля шаблона для замены
export const TEMPLATE_PLACEHOLDERS = {
  // Договор
  CONTRACT_NUMBER: '____________',
  CONTRACT_DATE: '_____________',
  TASK_NUMBER: '________-ЗИИ-1',
  YEAR: '2025',

  // Заказчик (в шапке)
  CUSTOMER_NAME_SHORT: '',  // Для подписи
  CUSTOMER_DIRECTOR_NAME: '',

  // Объект
  OBJECT_NAME: 'Реконструкция (снос и восстановление) сетей связи ПАО МГТС по объекту:',
  OBJECT_LOCATION: 'Москва',
  TERRITORY_DESCRIPTION: 'Территория обследования расположена в',
  AREA_SIZE: '  га',

  // Заказчик (полные данные)
  CUSTOMER_FULL_NAME: 'ООО "ГОРСВЯЗЬСТРОЙ", ОГРН 1097746501269',
  CUSTOMER_ADDRESS: '121059, Город Москва',
  CUSTOMER_CONTACT_NAME: 'Бордуков Александр Николаевич',
  CUSTOMER_PHONE: '+74997133710',
  CUSTOMER_EMAIL: 'gorsviaz@mail.ru',

  // Технические характеристики
  EXCAVATION_DEPTH: '',
  FOUNDATION_DEPTH: '',
} as const;

