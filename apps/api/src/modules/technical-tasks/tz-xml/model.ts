/**
 * Модель данных задания на выполнение инженерных изысканий.
 *
 * Повторяет структуру XML-схемы Минстроя EngineeringSurveysTask-01-00,
 * но в форме, удобной для редактирования в интерфейсе. Из этой модели
 * собирается XML (build-xml.ts), в неё же раскладываются данные
 * из Word-ТЗ заказчика (через ИИ) и из XML задания на проектирование.
 *
 * Правило: коды справочников хранятся как строки, ровно как в схеме.
 * Пустая строка / пустой массив означают «не заполнено» — в XML такие
 * элементы не попадают (схема запрещает пустые теги).
 */

// ---------------------------------------------------------------------------
// Базовые типы
// ---------------------------------------------------------------------------

/** Блок текстового описания (tTextBlock): заголовок + абзацы. */
export interface TextBlock {
  title?: string;
  /** Каждый абзац становится отдельным элементом <Text>. */
  paragraphs: string[];
}

/** Адрес на территории РФ (tRussianAddress). */
export interface RussianAddress {
  regionCode: string; // код субъекта РФ, справочник REGION_CODES
  postIndex?: string; // 6 цифр
  oktmoCode: string; // 8 или 11 цифр
  oktmoName: string;
  district?: string;
  city?: string;
  settlement?: string;
  street?: string;
  building?: string;
  room?: string;
  /** Неформализованное описание. Если заполнено — структурные поля (район…помещение) в XML не выводятся. */
  note?: string;
}

/** Файл, загруженный как вложение (tFile). Контрольная сумма считается при загрузке. */
export interface AttachedFile {
  /** Путь внутри uploads/ на сервере */
  fileUrl: string;
  name: string; // имя файла с расширением
  format: string; // расширение без точки, до 4 символов (pdf, docx…)
  checksum: string; // CRC32-IEEE, 8 hex-символов
  size?: number;
}

/** Сведения о документе (tDocumentInfo). */
export interface DocumentInfo {
  /** Локальный идентификатор внутри XML (xs:ID). Генерируется автоматически. */
  id: string;
  typeCode: string; // tDocumentsTypeCode, справочник DOCUMENT_TYPES
  name: string;
  number: string;
  date: string; // ГГГГ-ММ-ДД
  /** Автор в неформализованной форме (организация/лицо). */
  authorNote: string;
  changes?: string;
  /** Как документ представлен: файлом, ссылкой в интернете или ссылкой на другой документ. */
  source: 'FILE' | 'WEBLINK' | 'REFERENCE';
  files: AttachedFile[];
  webLink?: string;
  referenceToDocumentId?: string;
}

export interface DocumentsInfo {
  documents: DocumentInfo[];
  note?: string;
}

/** Юридическое лицо (tOrganization / tOrganizationNOPRIZ). */
export interface Organization {
  fullName: string;
  abbreviatedName?: string;
  ogrn?: string; // 13 цифр (либо ОГРН, либо РАФП)
  rafp?: string; // 11 цифр
  inn: string; // 10 цифр
  kpp: string; // 9 цифр
  address: RussianAddress;
  email?: string;
  /** Реестровый номер НОПРИЗ: «И-XXX-XXXXXXXXXXXX-XXXX» или «Не требуется». Нужен там, где схема требует tOrganizationNOPRIZ. */
  noprizNumber?: string;
}

/** Физическое лицо без СНИЛС (tPersonNoSNILS). */
export interface Person {
  surname: string;
  name: string;
  patronymic?: string;
  postAddress: RussianAddress; // почтовый адрес (индекс обязателен)
  email?: string;
}

/** Индивидуальный предприниматель (tIndividualEntrepreneurNOPRIZ). */
export interface Entrepreneur {
  surname: string;
  name: string;
  patronymic?: string;
  ogrnip: string; // 15 цифр
  inn?: string; // 12 цифр
  postAddress: RussianAddress;
  email?: string;
  noprizNumber?: string;
}

/** Должностное лицо — подписант (tWorkPersonNoSNILS). */
export interface Representative {
  surname: string;
  name: string;
  patronymic?: string;
  position: string;
  email?: string;
  functionalRole: 'Утверждено' | 'Согласовано';
}

/** Контролёр (tControlPerson). */
export interface ControlPerson {
  surname: string;
  name: string;
  patronymic?: string;
  email?: string;
}

/** Координатная точка. */
export interface Point {
  x: string;
  y: string;
}

/** Система координат и высот (tCoordinateAndHeightSystems). */
export interface CoordinateSystem {
  kind: 'STATE' | 'REGIONAL' | 'LOCAL' | 'INTERNATIONAL';
  /** Для STATE фиксировано «ГСК-2011», для REGIONAL — название МСК. */
  name: string;
  /** Для STATE и REGIONAL фиксировано «Балтийская 1977». */
  heightSystem: string;
}

/** Координаты участка (tArea). */
export interface Area {
  name?: string;
  coordinateSystem: CoordinateSystem;
  points: Point[];
}

/** Маршрут линейного объекта (tLinearRoute). */
export interface LinearRoute {
  name?: string;
  coordinateSystem: CoordinateSystem;
  startPoint: Point;
  middlePoints: Point[];
  finishPoint: Point;
}

/** Изображение площадки/трассы (tImage). Файл хранится на сервере, в XML уходит base64. */
export interface BoundaryImage {
  fileUrl: string;
  name: string;
  type: 'jpg' | 'jpeg' | 'png' | 'gif';
  comment?: string;
}

// ---------------------------------------------------------------------------
// Объект
// ---------------------------------------------------------------------------

/** Местоположение объекта (tPlacement). */
export interface Placement {
  address: RussianAddress;
  cadastralDistricts: string[]; // XX:XX:XXXXXXX
  cadastralSites: string[]; // XX:XX:XXXXXXX:XXX
  areas: Area[];
}

/** Сведения о фундаменте (tFoundation). */
export interface Foundation {
  types: string[]; // FOUNDATION_TYPES, минимум один
  /** Один материал (SingleMaterial) или несколько (CombinedMaterial). */
  materials: string[]; // FOUNDATION_MATERIALS, минимум один
  size: string; // десятичное число
  pilesCross?: string; // «300х300»
  depth: string; // м
  load: {
    pileLoad?: string; // кН
    stripLoad?: string; // кН/м²
    soilLoad?: string; // кН/м²
  };
}

/** Площадной объект капитального строительства (tArealOKS). */
export interface ArealOks {
  responsibilityLevel: string; // RESPONSIBILITY_LEVELS
  functionsClass: string; // xx.xx.xxx.xxx
  functionsFeatures: string; // принадлежность к транспортной инфраструктуре и т.п. (текст)
  energyEfficiency?: string; // ENERGY_EFFICIENCY_CLASSES
  dangerousIndustrialObject: string; // DANGER_INDUSTRIAL_CLASSES
  fireDangerCategory: string; // FIRE_DANGER_CATEGORIES
  peoplePermanentStay: string; // текст
  designFeatures: TextBlock; // конструктивные особенности
  planSize: { width: string; length: string; height: string };
  overallHeight: string;
  numberFloors: string; // целое
  approximateWeight: string; // т
  foundation: Foundation;
  foundationPit?: { depth: string; fence: string };
  earthworksDepth?: string;
  compressibleSoilThickness?: string;
  basement?: string;
  structuresBelowFoundation?: TextBlock;
  loads?: TextBlock;
  permissibleDraft?: string; // см
}

export type LinearKind =
  | 'LINE_POWER'
  | 'LINE_COMMUNICATION'
  | 'PIPELINE'
  | 'AUTOMOBILE_ROAD'
  | 'LINE_RAILWAY'
  | 'BRIDGE';

/** Линейный объект капитального строительства (tLinearOKS). */
export interface LinearOks {
  length: string; // протяжённость
  responsibilityLevel: string;
  functionsClass: string;
  kind: LinearKind;
  /** Параметры конкретного вида линейного объекта; заполняются в зависимости от kind. */
  foundationTypes: string[]; // ЛЭП, связь (необязательно), мост
  foundationMaterials: string[];
  foundationDepth?: string;
  layingMethod?: string; // связь, трубопровод
  cableMaterial?: string; // связь
  cableDepth?: string; // связь
  pipeMaterial?: string; // трубопровод
  pipeDepth?: string;
  pipeDiameter?: string;
  pressure?: string;
  embankmentHeight?: string; // дорога, ж/д
  sleepersMaterial?: string; // ж/д
}

/** Параметры основного площадного объекта без ОКС (tArealObject) — площадка. */
export interface ArealSite {
  planSize: { width: string; length: string };
  shootingScale: string; // SCALES
  sectionRelief: string; // SECTION_RELIEFS
  additionalRequirements?: TextBlock;
}

/** Параметры основного линейного объекта без ОКС (tLinearObject) — трасса. */
export interface LinearSite {
  length: string; // км
  shootingWidth: string; // м
  shootingScale: string;
  scalePlanProfile: string;
  sectionRelief: string;
  additionalRequirements?: TextBlock;
}

export type ObjectKind = 'AREAL_OKS' | 'LINEAR_OKS';
export type SiteKind = 'AREAL' | 'LINEAR';

/**
 * Сведения об объекте (tObjectInfo). По схеме это всегда две части:
 * объект капитального строительства (площадной или линейный) И параметры
 * основной площадки или трассы изысканий. Составные объекты (ComplexObject)
 * в первой версии не поддерживаются.
 */
export interface ObjectInfo {
  kind: ObjectKind;
  status: string; // OBJECT_STATUSES
  name: string;
  placement: Placement;
  areal: ArealOks;
  linear: LinearOks;
  /** Параметры площадки (AREAL) или трассы (LINEAR) изысканий. */
  siteKind: SiteKind;
  arealSite: ArealSite;
  linearSite: LinearSite;
}

// ---------------------------------------------------------------------------
// Участники
// ---------------------------------------------------------------------------

export interface Approver {
  /** Утверждающая организация (Author/Organization, tOrganizationNOPRIZ). */
  organization: Organization;
  /** Подписанты; ровно один с ролью «Утверждено». */
  representatives: Representative[];
}

export interface Developer {
  kind: 'ORGANIZATION' | 'PERSON';
  organization: Organization;
  person: Person;
}

export interface Researcher {
  kind: 'ORGANIZATION' | 'ENTREPRENEUR';
  organization: Organization;
  entrepreneur: Entrepreneur;
  contract: {
    number: string;
    date: string;
    files: AttachedFile[];
  };
}

// ---------------------------------------------------------------------------
// Виды изысканий, требования
// ---------------------------------------------------------------------------

export interface SurveyAuthor {
  kind: 'ORGANIZATION' | 'ENTREPRENEUR';
  organization: Organization;
  entrepreneur: Entrepreneur;
}

export interface Survey {
  kind: 'BASIC' | 'SPECIAL' | 'OTHER';
  /** Код вида для BASIC (1–5) и SPECIAL (6–11). */
  typeCode: string;
  /** Наименования иных исследований для OTHER (минимум одно). */
  otherNames: string[];
  purposes: string[];
  tasks: string[];
  additionalRequirements?: TextBlock;
  authors: SurveyAuthor[];
}

export interface Ecology {
  existingPollutionSources?: TextBlock;
  plannedPollutionSources?: TextBlock;
  possibleAccident?: TextBlock;
  landWithdraw?: TextBlock;
  waterSource?: TextBlock;
  waterRelease?: TextBlock;
}

export interface Boundaries {
  images: BoundaryImage[]; // минимум одно
  areas: Area[];
  linearRoutes: LinearRoute[];
  projectedPlanningMarks?: TextBlock;
  areaOutWorks?: TextBlock;
}

export interface DangerousProcesses {
  processes: string[]; // DANGEROUS_PROCESSES, минимум один
  processesAdditional?: TextBlock;
  permafrost: 'да' | 'нет' | '';
  permafrostAdditional?: TextBlock;
  soils: string[]; // SPECIFIC_SOILS
  soilsAdditional?: TextBlock;
}

export interface OutsideControlOrganization {
  kind: 'ORGANIZATION' | 'ENTREPRENEUR';
  organization: Organization;
  entrepreneur: Entrepreneur;
  representatives: ControlPerson[];
}

export interface OutsideControl {
  description?: TextBlock;
  /** Кто обеспечивает внешний контроль. */
  by: 'DEVELOPER' | 'TECHNICAL_CUSTOMER' | 'ORGANIZATION';
  representatives: ControlPerson[]; // для DEVELOPER / TECHNICAL_CUSTOMER
  organizations: OutsideControlOrganization[]; // для ORGANIZATION
}

export interface Requirements {
  scientificSupport: TextBlock;
  accuracySecurity: TextBlock;
  forecastChangesNaturalConditions: TextBlock;
  suggestionsRecommendation?: TextBlock;
  controlQuality: {
    inside?: TextBlock;
    outside?: OutsideControl;
  };
  compositionOrderTransfer: TextBlock;
  archivalMaterials?: DocumentsInfo;
  modelFormat?: TextBlock;
  usedNorms: string[];
}

// ---------------------------------------------------------------------------
// Документ целиком
// ---------------------------------------------------------------------------

export interface Requisites {
  /** Шифр задания (Requisites/Number). */
  number: string;
  /** Дата составления, ГГГГ-ММ-ДД. */
  date: string;
  securityLabel: string; // SECURITY_LABELS
  /** Номер версии документа (Document/@VersionNumber), с 1. */
  versionNumber: number;
  /** Идентификатор документа (Document/@Id), GUID. */
  id?: string;
}

/**
 * Какие необязательные блоки включены в задание. Обязательные блоки схемы
 * присутствуют всегда и здесь не перечисляются.
 */
export interface EnabledBlocks {
  researchers: boolean;
  technogenicImpacts: boolean;
  ecology: boolean;
  timePeriod: boolean;
  suggestionsRecommendation: boolean;
  archivalMaterials: boolean;
  modelFormat: boolean;
  usedNorms: boolean;
  areas: boolean; // координаты участков в границах
  linearRoutes: boolean; // маршруты трасс в границах
}

export interface TzXmlModel {
  schemaVersion: '01.00';
  requisites: Requisites;
  approver: Approver;
  object: ObjectInfo;
  initiationDocuments: DocumentsInfo;
  constructionType: string; // CONSTRUCTION_TYPES
  timePeriod?: string;
  /** Стороны задания: застройщик, технический заказчик или оба. */
  customerKind: 'DEVELOPER' | 'TECHNICAL_CUSTOMER' | 'BOTH';
  developer: Developer;
  technicalCustomer: Organization;
  researchers: Researcher[];
  purposes: string[];
  tasks: string[];
  stage: string; // SURVEY_STAGES
  surveys: Survey[];
  technogenicImpacts?: TextBlock;
  ecology: Ecology;
  boundaries: Boundaries;
  dangerous: DangerousProcesses;
  requirements: Requirements;
  availableDocuments: DocumentsInfo;
  enabled: EnabledBlocks;
  /**
   * Откуда взято значение поля: путь в модели → источник. Используется
   * интерфейсом, чтобы подсветить, что пришло из документа, а что подставлено
   * по умолчанию. Не участвует в сборке XML.
   */
  provenance?: Record<string, 'document' | 'default' | 'company' | 'manual'>;
  /** Итог импорта из документа: что перенесено и на что обратить внимание. */
  importInfo?: {
    imported: string[];
    notes: string[];
  };
}

/** Реквизиты компании-исполнителя (хранятся в Company.requisites). */
export interface CompanyRequisites {
  organization: Organization;
  /** Подписант со стороны исполнителя. */
  signatory?: {
    surname: string;
    name: string;
    patronymic?: string;
    position: string;
    email?: string;
  };
}

export type TzSource = 'WORD' | 'DESIGN_XML' | 'SCRATCH';
