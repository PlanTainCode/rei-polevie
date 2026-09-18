/**
 * Пустая модель задания и типовые значения.
 *
 * Типовые формулировки взяты из действующего Word-шаблона РЭИ
 * («Задание ИИ_шаблон.docx»), а не придуманы. Всё, что здесь подставляется,
 * помечается в provenance как 'default' и свободно правится в форме.
 */

import type {
  Area,
  ArealOks,
  ArealSite,
  Boundaries,
  CoordinateSystem,
  DangerousProcesses,
  Developer,
  DocumentInfo,
  DocumentsInfo,
  Ecology,
  EnabledBlocks,
  Entrepreneur,
  Foundation,
  LinearOks,
  LinearRoute,
  LinearSite,
  ObjectInfo,
  Organization,
  Person,
  Placement,
  Representative,
  Requirements,
  Researcher,
  RussianAddress,
  Survey,
  SurveyAuthor,
  TextBlock,
  TzXmlModel,
} from './model';

export const SCHEMA_VERSION = '01.00' as const;

/** Код вида документа «Задание на проведение инженерных изысканий» (Document/@TypeCode). */
export const DOCUMENT_TYPE_CODE = '05.01';

export function textBlock(paragraphs: string[] = [], title?: string): TextBlock {
  return title ? { title, paragraphs } : { paragraphs };
}

export function emptyAddress(): RussianAddress {
  return { regionCode: '', oktmoCode: '', oktmoName: '' };
}

export function emptyOrganization(): Organization {
  return { fullName: '', inn: '', kpp: '', address: emptyAddress() };
}

export function emptyPerson(): Person {
  return { surname: '', name: '', postAddress: emptyAddress() };
}

export function emptyEntrepreneur(): Entrepreneur {
  return { surname: '', name: '', ogrnip: '', postAddress: emptyAddress() };
}

export function emptyRepresentative(role: Representative['functionalRole'] = 'Утверждено'): Representative {
  return { surname: '', name: '', position: '', functionalRole: role };
}

export function stateCoordinateSystem(): CoordinateSystem {
  return { kind: 'STATE', name: 'ГСК-2011', heightSystem: 'Балтийская 1977' };
}

export function regionalCoordinateSystem(name = 'МСК'): CoordinateSystem {
  return { kind: 'REGIONAL', name, heightSystem: 'Балтийская 1977' };
}

export function emptyArea(): Area {
  return { coordinateSystem: regionalCoordinateSystem(), points: [] };
}

export function emptyLinearRoute(): LinearRoute {
  return {
    coordinateSystem: regionalCoordinateSystem(),
    startPoint: { x: '', y: '' },
    middlePoints: [],
    finishPoint: { x: '', y: '' },
  };
}

export function emptyPlacement(): Placement {
  return { address: emptyAddress(), cadastralDistricts: [], cadastralSites: [], areas: [] };
}

export function emptyFoundation(): Foundation {
  return { types: [], materials: [], size: '', depth: '', load: {} };
}

export function emptyArealOks(): ArealOks {
  return {
    responsibilityLevel: 'нормальный',
    functionsClass: '',
    functionsFeatures: 'Не относится к объектам транспортной инфраструктуры и к другим объектам, функционально-технологические особенности которых влияют на их безопасность',
    dangerousIndustrialObject: 'Не относится к опасным производственным объектам',
    fireDangerCategory: 'Категория не устанавливается',
    peoplePermanentStay: '',
    designFeatures: textBlock(),
    planSize: { width: '', length: '', height: '' },
    overallHeight: '',
    numberFloors: '',
    approximateWeight: '',
    foundation: emptyFoundation(),
  };
}

export function emptyLinearOks(): LinearOks {
  return {
    length: '',
    responsibilityLevel: 'нормальный',
    functionsClass: '',
    kind: 'LINE_COMMUNICATION',
    foundationTypes: [],
    foundationMaterials: [],
  };
}

export function emptyArealSite(): ArealSite {
  return { planSize: { width: '', length: '' }, shootingScale: '1:500', sectionRelief: '0,5' };
}

export function emptyLinearSite(): LinearSite {
  return { length: '', shootingWidth: '', shootingScale: '1:500', scalePlanProfile: '1:500', sectionRelief: '0,5' };
}

export function emptyObject(): ObjectInfo {
  return {
    kind: 'AREAL_OKS',
    status: 'Проектируемый',
    name: '',
    placement: emptyPlacement(),
    areal: emptyArealOks(),
    linear: emptyLinearOks(),
    siteKind: 'AREAL',
    arealSite: emptyArealSite(),
    linearSite: emptyLinearSite(),
  };
}

let docCounter = 0;
export function newDocumentId(): string {
  docCounter += 1;
  return `doc-${Date.now().toString(36)}-${docCounter}`;
}

export function emptyDocument(typeCode = ''): DocumentInfo {
  return {
    id: newDocumentId(),
    typeCode,
    name: '',
    number: '',
    date: '',
    authorNote: '',
    source: 'FILE',
    files: [],
  };
}

export function emptyDocuments(): DocumentsInfo {
  return { documents: [] };
}

export function emptyDeveloper(): Developer {
  return { kind: 'ORGANIZATION', organization: emptyOrganization(), person: emptyPerson() };
}

export function emptyResearcher(): Researcher {
  return {
    kind: 'ORGANIZATION',
    organization: emptyOrganization(),
    entrepreneur: emptyEntrepreneur(),
    contract: { number: '', date: '', files: [] },
  };
}

export function emptySurveyAuthor(): SurveyAuthor {
  return { kind: 'ORGANIZATION', organization: emptyOrganization(), entrepreneur: emptyEntrepreneur() };
}

/** Типовые цели и задачи по видам изысканий (из шаблона РЭИ). */
export const SURVEY_DEFAULTS: Record<string, { purposes: string[]; tasks: string[] }> = {
  // Инженерно-экологические
  '4': {
    purposes: [
      'Оценка современного состояния и прогноз возможных изменений окружающей среды под влиянием антропогенной нагрузки с целью предотвращения, минимизации или ликвидации вредных и нежелательных экологических и связанных с ними социальных, экономических и других последствий и сохранения оптимальных условий жизни населения.',
    ],
    tasks: [
      'Оценка экологического состояния территории (почв и грунтов, атмосферного воздуха, поверхностных и подземных вод, радиационной обстановки, физических факторов воздействия).',
      'Получение исходных данных для разработки раздела «Перечень мероприятий по охране окружающей среды» проектной документации.',
    ],
  },
  // Инженерно-геологические
  '2': {
    purposes: [
      'Получение материалов об инженерно-геологических условиях территории, необходимых и достаточных для подготовки проектной документации.',
    ],
    tasks: [
      'Изучение геологического строения, гидрогеологических условий, физико-механических свойств грунтов, опасных геологических и инженерно-геологических процессов.',
    ],
  },
  // Инженерно-гидрометеорологические
  '3': {
    purposes: [
      'Получение материалов о гидрометеорологических условиях территории, необходимых и достаточных для подготовки проектной документации.',
    ],
    tasks: [
      'Определение возможного воздействия на площадку строительства опасных гидрометеорологических процессов и явлений, оценка их характеристик.',
    ],
  },
  // Инженерно-геодезические
  '1': {
    purposes: [
      'Получение топографо-геодезических материалов и данных о ситуации и рельефе местности, необходимых для подготовки проектной документации.',
    ],
    tasks: ['Создание инженерно-топографического плана в заданном масштабе.'],
  },
};

export function emptySurvey(kind: Survey['kind'] = 'BASIC', typeCode = ''): Survey {
  const d = SURVEY_DEFAULTS[typeCode];
  return {
    kind,
    typeCode,
    otherNames: [],
    purposes: d ? [...d.purposes] : [],
    tasks: d ? [...d.tasks] : [],
    authors: [],
  };
}

export function emptyEcology(): Ecology {
  return {};
}

export function emptyBoundaries(): Boundaries {
  return { images: [], areas: [], linearRoutes: [] };
}

export function emptyDangerous(): DangerousProcesses {
  return { processes: [], permafrost: 'нет', soils: [] };
}

/** Типовые тексты обязательных требований (из Word-шаблона РЭИ). */
export const REQUIREMENT_DEFAULTS = {
  scientificSupport: ['Не требуется'],
  accuracySecurity: [
    'Метрологическое обеспечение единства и точность измерений при инженерно-экологических изысканиях осуществляется по ГОСТ Р 8.589-2001 «Государственная система обеспечения единства измерений. Контроль загрязнения окружающей природной среды. Метрологическое обеспечение. Основные положения».',
    'Расчётные характеристики должны быть приведены при доверительной вероятности α=0,85 и α=0,95.',
  ],
  forecastChangesNaturalConditions: ['Не требуется'],
  suggestionsRecommendation: ['Не требуется'],
  insideControl: [
    'Технический контроль работ включает в себя 2 этапа.',
    'Внутренний контроль: полевой контроль и документарная подготовка к передаче полевого материала (камеральный контроль) осуществляется руководством отдела; приемка-передача полевых материалов для камеральной обработки (камеральный контроль) осуществляется руководством отдела.',
    'Результаты полевого и камерального контроля оформляются Актом контроля качества полевых материалов.',
  ],
  outsideControlDescription: ['Внешний контроль осуществляется заказчиком / техническим заказчиком.'],
  compositionOrderTransfer: [
    'Результатом инженерных изысканий является технический отчет по результатам соответствующего вида инженерных изысканий.',
    'Количество экземпляров в электронном виде – 1 экз. (в нередактируемом формате .pdf, подписанный ЭЦП, и в редактируемом формате (.dwg, .xls, .doc)).',
    'Документация в электронном виде в соответствии с Приказом Минстроя России № 783/пр от 12.05.2017 «Об утверждении требований к формату электронных документов, представляемых для проведения государственной экспертизы проектной документации и (или) результатов инженерных изысканий и проверки достоверности определения сметной стоимости строительства, реконструкции, капитального ремонта объектов капитального строительства» предоставляется в следующих форматах: pdf, doc, docx, odt, xls, xlsx – для документов с текстовым содержанием; pdf, dwg – для документов с графическим содержанием.',
  ],
  usedNorms: [
    'СП 47.13330.2016 «СНиП 11-02-96 Инженерные изыскания для строительства. Основные положения» (с изменением № 1).',
    'СП 502.1325800.2021 «Инженерно-экологические изыскания для строительства. Общие правила производства работ».',
    'СанПиН 2.1.3684-21 «Санитарно-эпидемиологические требования к содержанию территорий городских и сельских поселений, к водным объектам, питьевой воде и питьевому водоснабжению, атмосферному воздуху, почвам, жилым помещениям, эксплуатации производственных, общественных помещений, организации и проведению санитарно-противоэпидемических (профилактических) мероприятий».',
    'СанПиН 1.2.3685-21 «Гигиенические нормативы и требования к обеспечению безопасности и (или) безвредности для человека факторов среды обитания».',
    'СанПиН 2.6.1.2523-09 «Нормы радиационной безопасности (НРБ-99/2009)».',
    'СП 2.6.1.2612-10 «Основные санитарные правила обеспечения радиационной безопасности (ОСПОРБ-99/2010)».',
    'СанПиН 2.6.1.2800-10 «Гигиенические требования по ограничению облучения населения за счет природных источников ионизирующего излучения».',
    'МР 2.6.1.0361-24 «Радиационный контроль земельных участков, предназначенных под строительство жилых домов, зданий и сооружений общественного и производственного назначения, а также прилегающей к зданиям и сооружениям территории и территории общего пользования».',
  ],
  purposes: [
    'Инженерные изыскания выполняются с целью комплексного изучения условий территории (площадки, участка, трассы) для получения необходимых и достаточных материалов при подготовке документов архитектурно-строительного проектирования, строительства и реконструкции зданий и сооружений.',
  ],
  tasks: [
    'Задачи инженерных изысканий определены видом разрабатываемой градостроительной документации (подготовка проектной документации) и особенностями природной и техногенной обстановки территории изысканий.',
  ],
};

export function emptyRequirements(): Requirements {
  return {
    scientificSupport: textBlock([...REQUIREMENT_DEFAULTS.scientificSupport]),
    accuracySecurity: textBlock([...REQUIREMENT_DEFAULTS.accuracySecurity]),
    forecastChangesNaturalConditions: textBlock([...REQUIREMENT_DEFAULTS.forecastChangesNaturalConditions]),
    suggestionsRecommendation: textBlock([...REQUIREMENT_DEFAULTS.suggestionsRecommendation]),
    controlQuality: {
      inside: textBlock([...REQUIREMENT_DEFAULTS.insideControl]),
      outside: {
        description: textBlock([...REQUIREMENT_DEFAULTS.outsideControlDescription]),
        by: 'DEVELOPER',
        representatives: [],
        organizations: [],
      },
    },
    compositionOrderTransfer: textBlock([...REQUIREMENT_DEFAULTS.compositionOrderTransfer]),
    archivalMaterials: emptyDocuments(),
    modelFormat: textBlock(['Не требуется']),
    usedNorms: [...REQUIREMENT_DEFAULTS.usedNorms],
  };
}

export function defaultEnabledBlocks(): EnabledBlocks {
  return {
    researchers: true,
    technogenicImpacts: false,
    ecology: false,
    timePeriod: false,
    suggestionsRecommendation: false,
    archivalMaterials: false,
    modelFormat: false,
    usedNorms: true,
    areas: false,
    linearRoutes: false,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Пустое задание с типовыми значениями РЭИ. Экология включена по умолчанию —
 * это основной вид работ; остальные виды добавляются в форме.
 */
export function createEmptyModel(): TzXmlModel {
  const model: TzXmlModel = {
    schemaVersion: SCHEMA_VERSION,
    requisites: { number: '', date: today(), securityLabel: '0', versionNumber: 1 },
    approver: { organization: emptyOrganization(), representatives: [emptyRepresentative('Утверждено')] },
    object: emptyObject(),
    initiationDocuments: emptyDocuments(),
    constructionType: 'архитектурно-строительное проектирование',
    customerKind: 'DEVELOPER',
    developer: emptyDeveloper(),
    technicalCustomer: emptyOrganization(),
    researchers: [],
    purposes: [...REQUIREMENT_DEFAULTS.purposes],
    tasks: [...REQUIREMENT_DEFAULTS.tasks],
    stage: '4',
    surveys: [emptySurvey('BASIC', '4')],
    ecology: emptyEcology(),
    boundaries: emptyBoundaries(),
    dangerous: emptyDangerous(),
    requirements: emptyRequirements(),
    availableDocuments: emptyDocuments(),
    enabled: defaultEnabledBlocks(),
    provenance: {},
  };
  const prov = model.provenance!;
  for (const key of [
    'requisites.securityLabel',
    'constructionType',
    'stage',
    'purposes',
    'tasks',
    'surveys',
    'requirements.scientificSupport',
    'requirements.accuracySecurity',
    'requirements.forecastChangesNaturalConditions',
    'requirements.controlQuality',
    'requirements.compositionOrderTransfer',
    'requirements.usedNorms',
    'object.areal.responsibilityLevel',
    'object.areal.dangerousIndustrialObject',
    'object.areal.fireDangerCategory',
    'object.areal.functionsFeatures',
  ]) {
    prov[key] = 'default';
  }
  return model;
}

/**
 * Глубокое слияние: заполненные значения из patch перекрывают base.
 * Массивы заменяются целиком, пустые строки/undefined в patch игнорируются.
 */
export function mergeModel<T>(base: T, patch: Partial<T> | undefined | null): T {
  if (!patch) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === undefined || v === null || v === '') continue;
    const cur = out[k];
    if (Array.isArray(v)) {
      if (v.length) out[k] = v;
    } else if (typeof v === 'object' && cur && typeof cur === 'object' && !Array.isArray(cur)) {
      out[k] = mergeModel(cur, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
