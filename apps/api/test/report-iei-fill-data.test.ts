import { expect, test } from 'bun:test';
import { normalizeReportIeiSection1AiData } from '../src/modules/ai/report-iei/section-1';
import { emptyReportIeiSection1AiData } from '../src/modules/ai/report-iei/section-1';
import { parseJsonObjectFromAi } from '../src/modules/ai/parse-json';
import { extractUrbanPlanningActivityFromTz } from '../src/modules/word/program-iei/urban-planning';
import {
  buildReportIeiFillData,
  mergeReportIeiOperatorFromFill,
} from '../src/modules/word/report-iei/build-fill-data';
import {
  buildDatesSentence,
  buildUrbanPlanningSentence,
  hasMedBuildingAndEroa,
  parseCgmsCertificateRef,
  shortenExcavationDepth,
  stageSubtitleFromSurveyStage,
} from '../src/modules/word/report-iei/text';
import { normalizeExecutorNames } from '../src/modules/word/report-iei/staff';
import { NO_SOCIAL_INFRA_TEXT } from '../src/modules/word/report-iei/types';

test('normalizeReportIeiSection1AiData: ИНН, скобки здания, зона', () => {
  const data = normalizeReportIeiSection1AiData({
    clientInn: 'ИНН 7712345678',
    landUseZone: 'в многофункциональной общественной зоне.',
    buildingDescription: '(При обследовании здания) Кирпичное двухэтажное здание.',
    hasBuildingSurvey: true,
    noSocialInfrastructureNearby: false,
    socialInfrastructureText: 'Школа в 40 м к востоку.',
  });
  expect(data.clientInn).toBe('7712345678');
  expect(data.landUseZone).toBe('многофункциональной общественной зоне');
  expect(data.buildingDescription).toBe('Кирпичное двухэтажное здание.');
  expect(data.hasBuildingSurvey).toBe(true);
});

test('shortenExcavationDepth: max из длинного текста ТЗ', () => {
  expect(shortenExcavationDepth('Глубина ведения земляных работ (max): до 5,0 м')).toBe(
    '-5,0 м (max)',
  );
  expect(shortenExcavationDepth('-3,0 м (max)')).toBe('-3,0 м (max)');
});

test('stageSubtitleFromSurveyStage: титул из п.7.1 / этапа ТЗ', () => {
  expect(
    stageSubtitleFromSurveyStage(
      'Инженерные изыскания для подготовки проектной документации',
    ),
  ).toBe('для подготовки проектной документации');
});

test('buildReportIeiFillData: ТЗ + extras, оператор перекрывает воду', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Реконструкция здания по адресу: г. Москва, ул. Лесная, д. 1',
    documentNumber: '801-67-26',
    objectAddress: 'г. Москва',
    clientName: 'ООО «Заказчик»',
    samplingDate: new Date('2026-05-12'),
    nearby: { nearbyText: 'К северу проходит ул. Лесная.' },
    openGroundPercent: 15,
    section1: {
      objectName: '',
      objectLocation: 'г. Москва, ул. Лесная, д. 1',
      clientName: 'ООО «Тест»',
      clientOgrn: '1027739558714',
      clientAddress: 'Москва',
      clientContactName: '',
      clientContactPhone: '',
      clientContactEmail: '',
      goalsAndTasks: '',
      objectPurpose: '',
      transportInfrastructure: 'Нет',
      hazardousProduction: 'Нет',
      fireHazard: 'Нет данных',
      responsibilityLevel: 'Нормальный',
      permanentOccupancy: '',
      urbanPlanningActivity: 'Реконструкция',
      surveyStage: 'Инженерные изыскания для подготовки проектной документации',
      technicalCharacteristics: 'Реконструкция существующего здания.',
      excavationDepth: 'Глубина ведения земляных работ (max): до 3,0 м',
      siteDescription: '',
      siteArea: '0,5 га',
      technicalCustomerName: '',
      technicalCustomerDirectorPosition: '',
      technicalCustomerDirectorName: '',
      clientDirectorPosition: '',
      clientDirectorName: '',
      clientShortName: '',
      coordinates: null,
      cadastralNumber: '',
      contractorRole: 'Подрядчик',
      backgroundConcentrationsRef: '',
      previousSurveyReport: '',
      reportCopiesText: '',
      titleSignatories: [],
    },
    extras: {
      clientInn: '7712345678',
      landUseZone: 'многофункциональной общественной зоне',
      waterObjectText: 'Ближайшим поверхностным водным объектом является р. Москва.',
      socialInfrastructureText: '',
      noSocialInfrastructureNearby: true,
      hasBuildingSurvey: true,
      buildingDescription: 'Кирпичное здание без подвала.',
      siteFenceText: 'Участок обнесён забором.',
      isLandscapingOnly: false,
      locationText: 'Территория изысканий расположена в районе Тверской ЦАО',
    },
    operator: {
      waterObjectText: 'Ближайшим поверхностным водным объектом является пруд на р. Сетунь.',
    },
    orderFlags: null,
  });

  expect(fill.reportCipher).toBe('801-67-26-ИЭИ');
  expect(fill.clientName).toBe('ООО «Тест»');
  expect(fill.urbanPlanningActivity).toBe('Реконструкция');
  expect(fill.excavationDepth).toBe('-3,0 м (max)');
  expect(fill.waterObjectText).toContain('пруд на р. Сетунь');
  expect(fill.hasBuildingSurvey).toBe(true);
  expect(fill.buildingDescription).toBe('Кирпичное здание без подвала.');
  expect(fill.socialInfrastructureText).toBe(NO_SOCIAL_INFRA_TEXT);
  expect(fill.locationText).toContain('Тверской');
  expect(fill.nearbyText).toContain('ул. Лесная');
});

test('extractUrbanPlanningActivityFromTz + fill: два вида из ТЗ 1:1', () => {
  const tz = [
    '3. Основание для выполнения работ',
    'Договор.',
    '4. Вид градостроительной деятельности',
    'Архитектурно-строительное проектирование, реконструкция',
    '5. Идентификационные сведения о заказчике',
    'ООО «Тест»',
  ].join('\n');
  const urban = extractUrbanPlanningActivityFromTz(tz);
  expect(urban).toBe('Архитектурно-строительное проектирование, реконструкция');

  const fill = buildReportIeiFillData({
    objectName: 'Объект 801-67-26',
    section1: {
      objectName: '',
      objectLocation: '',
      clientName: '',
      clientOgrn: '',
      clientAddress: '',
      clientContactName: '',
      clientContactPhone: '',
      clientContactEmail: '',
      goalsAndTasks: '',
      objectPurpose: '',
      transportInfrastructure: 'Нет',
      hazardousProduction: 'Нет',
      fireHazard: 'Нет данных',
      responsibilityLevel: 'Нормальный',
      permanentOccupancy: '',
      urbanPlanningActivity: urban || '',
      surveyStage: '',
      technicalCharacteristics: '',
      excavationDepth: '',
      siteDescription: '',
      siteArea: '',
      technicalCustomerName: '',
      technicalCustomerDirectorPosition: '',
      technicalCustomerDirectorName: '',
      clientDirectorPosition: '',
      clientDirectorName: '',
      clientShortName: '',
      coordinates: null,
      cadastralNumber: '',
      contractorRole: 'Подрядчик',
      backgroundConcentrationsRef: '',
      previousSurveyReport: '',
      reportCopiesText: '',
      titleSignatories: [],
    },
    extras: null,
    operator: {},
    orderFlags: null,
  });
  expect(fill.urbanPlanningActivity).toBe(
    'Архитектурно-строительное проектирование, реконструкция',
  );
  expect(fill.urbanPlanningActivity).toContain('реконструкция');
  expect(buildUrbanPlanningSentence(fill.urbanPlanningActivity)).toBe(
    'Вид градостроительной деятельности – архитектурно-строительное проектирование, реконструкция.',
  );
});

test('extractUrbanPlanningActivityFromTz: вид в той же строке, что заголовок', () => {
  expect(
    extractUrbanPlanningActivityFromTz(
      '4. Вид градостроительной деятельности Архитектурно-строительное проектирование, реконструкция\n5. Заказчик',
    ),
  ).toBe('Архитектурно-строительное проектирование, реконструкция');
});

test('buildReportIeiFillData: зона из ТЗ, если AI пустой', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: {},
    orderFlags: null,
    tzLandUseZone: 'зоне жилой застройки',
  });
  expect(fill.landUseZone).toBe('зоне жилой застройки');
});

test('buildReportIeiFillData: зона из ТЗ важнее выдумки AI', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: { ...emptyReportIeiSection1AiData(), landUseZone: 'многофункциональной общественной зоне' },
    operator: {},
    orderFlags: null,
    tzLandUseZone: 'зоне жилой застройки',
  });
  expect(fill.landUseZone).toBe('зоне жилой застройки');
});

test('mergeReportIeiOperatorFromFill не затирает ручную зону', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: { ...emptyReportIeiSection1AiData(), landUseZone: 'производственной зоне' },
    operator: { landUseZone: 'зоне Ж-1' },
    orderFlags: null,
  });
  const merged = mergeReportIeiOperatorFromFill({ landUseZone: 'зоне Ж-1' }, fill);
  expect(merged.landUseZone).toBe('зоне Ж-1');
});

test('buildReportIeiFillData: пробы без воды важнее orderFlags', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект, г. Москва',
    section1: null,
    extras: null,
    operator: {},
    hasWaterSamples: false,
    orderFlags: {
      hasWaterSampling: true,
      hasSedimentSampling: false,
      hasAirSampling: false,
      hasPhysicalImpacts: false,
      hasBuildingSurvey: false,
      isCommunicationNetworksObject: false,
      hasPPR: false,
      hasGasGeochemistry: false,
      hasSurfaceWater: true,
      hasGroundwater: false,
    },
  });
  expect(fill.hasWaterSamples).toBe(false);
});

test('buildReportIeiFillData: без проб вода из orderFlags как в программе', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект, г. Москва',
    section1: null,
    extras: null,
    operator: {},
    orderFlags: {
      hasWaterSampling: false,
      hasSedimentSampling: false,
      hasAirSampling: false,
      hasPhysicalImpacts: false,
      hasBuildingSurvey: false,
      isCommunicationNetworksObject: false,
      hasPPR: false,
      hasGasGeochemistry: false,
      hasSurfaceWater: true,
      hasGroundwater: false,
    },
  });
  expect(fill.hasWaterSamples).toBe(true);
});

test('buildReportIeiFillData: нет проб и нет воды в поручении', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект, г. Москва',
    section1: null,
    extras: null,
    operator: {},
    orderFlags: null,
  });
  expect(fill.hasWaterSamples).toBe(false);
});

test('buildReportIeiFillData: полевые из samplingDate, камеральные из текущего месяца', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: {},
    orderFlags: null,
    samplingDate: new Date(2026, 3, 15),
    now: new Date(2026, 7, 19),
  });
  expect(fill.fieldWorkPeriod).toBe('в апреле 2026 г.');
  expect(fill.cameralWorkPeriod).toBe('в августе 2026');
  expect(fill.fieldWorkPeriod).not.toContain('мае');
  expect(fill.cameralWorkPeriod).not.toContain('июне');
  expect(buildDatesSentence(fill.fieldWorkPeriod, fill.cameralWorkPeriod)).toBe(
    'Полевые работы выполнены в апреле 2026 г. Камеральные работы выполнены в августе 2026.',
  );
});

test('buildReportIeiFillData: явные периоды оператора побеждают авто', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: {
      fieldWorkPeriod: 'в январе 2025 г.',
      cameralWorkPeriod: 'в феврале 2025',
    },
    orderFlags: null,
    samplingDate: new Date(2026, 3, 15),
    now: new Date(2026, 7, 19),
  });
  expect(fill.fieldWorkPeriod).toBe('в январе 2025 г.');
  expect(fill.cameralWorkPeriod).toBe('в феврале 2025');
});

test('mergeReportIeiOperatorFromFill не затирает ручные сроки', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: {},
    orderFlags: null,
    samplingDate: new Date(2026, 3, 15),
    now: new Date(2026, 7, 19),
  });
  const merged = mergeReportIeiOperatorFromFill(
    { fieldWorkPeriod: 'в марте 2024 г.', cameralWorkPeriod: 'в октябре 2024' },
    fill,
  );
  expect(merged.fieldWorkPeriod).toBe('в марте 2024 г.');
  expect(merged.cameralWorkPeriod).toBe('в октябре 2024');
});

test('normalizeExecutorNames: только ФИО из шаблона, чужие отбрасываются', () => {
  expect(normalizeExecutorNames(['Иванов И.И.', 'Штефанова У.Н.', 'Штефанова У.Н.'])).toEqual([
    'Штефанова У.Н.',
  ]);
  expect(normalizeExecutorNames([])).toEqual([]);
  expect(normalizeExecutorNames(undefined)).toEqual([]);
});

test('buildReportIeiFillData: чужие ФИО не попадают в состав исполнителей', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: { executorNames: ['Иванов И.И.', 'Матвеева Т.С.'] },
    orderFlags: null,
  });
  expect(fill.executorNames).toEqual(['Матвеева Т.С.']);
  expect(fill.executorNames).not.toContain('Иванов И.И.');
});

const noBuildingFlags = {
  hasWaterSampling: false,
  hasSedimentSampling: false,
  hasAirSampling: false,
  hasPhysicalImpacts: false,
  hasBuildingSurvey: false,
  isCommunicationNetworksObject: false,
  hasPPR: false,
  hasGasGeochemistry: false,
  hasSurfaceWater: false,
  hasGroundwater: false,
};

test('buildReportIeiFillData: МЭДзд и ЭРОА включают обследование здания', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: {},
    orderFlags: noBuildingFlags,
    orderText: 'Радиометрическое обследование здания, измерение ЭРОА радона',
  });
  expect(hasMedBuildingAndEroa('Радиометрическое обследование здания, измерение ЭРОА радона')).toBe(
    true,
  );
  expect(fill.hasBuildingSurvey).toBe(true);
});

test('buildReportIeiFillData: только ЭРОА без МЭДзд не включает здание', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: {},
    orderFlags: noBuildingFlags,
    orderText: 'ЭРОА радона',
  });
  expect(fill.hasBuildingSurvey).toBe(false);
});

test('buildReportIeiFillData: галочка здания включает абзац без услуг', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: { hasBuildingSurvey: true, buildingDescription: 'Кирпичное здание.' },
    orderFlags: noBuildingFlags,
    orderText: '',
  });
  expect(fill.hasBuildingSurvey).toBe(true);
  expect(fill.buildingDescription).toBe('Кирпичное здание.');
});

test('buildReportIeiFillData: фото фасада только вместе с обследованием', () => {
  const withoutSurvey = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: {},
    orderFlags: noBuildingFlags,
    hasFacadePhoto: true,
  });
  expect(withoutSurvey.hasFacadePhoto).toBe(false);

  const withSurvey = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: { hasBuildingSurvey: true },
    orderFlags: noBuildingFlags,
    hasFacadePhoto: true,
  });
  expect(withSurvey.hasFacadePhoto).toBe(true);
});

test('buildReportIeiFillData: инв. номер из формы оператора', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект',
    section1: null,
    extras: null,
    operator: { inventoryNumber: '784' },
    orderFlags: null,
  });
  expect(fill.inventoryNumber).toBe('784');
});

test('buildReportIeiFillData: Москва vs МО как в программе ИЭИ', () => {
  const moscow = buildReportIeiFillData({
    objectName: 'Реконструкция по адресу: г. Москва, ул. Лесная, д. 1',
    objectAddress: 'г. Москва, ул. Лесная, д. 1',
    section1: null,
    extras: null,
    operator: {},
    orderFlags: null,
  });
  const mo = buildReportIeiFillData({
    objectName: 'Строительство, Московская область, г. Балашиха',
    objectAddress: 'Московская область, г. Балашиха',
    section1: null,
    extras: null,
    operator: {},
    orderFlags: null,
  });
  expect(moscow.isMoscow).toBe(true);
  expect(mo.isMoscow).toBe(false);
});

test('buildReportIeiFillData: нет справки ЦГМС — не берём шаблонный № 312/15/05', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект, г. Москва',
    section1: {
      objectName: '',
      objectLocation: '',
      clientName: '',
      clientOgrn: '',
      clientAddress: '',
      clientContactName: '',
      clientContactPhone: '',
      clientContactEmail: '',
      goalsAndTasks: '',
      objectPurpose: '',
      transportInfrastructure: 'Нет',
      hazardousProduction: 'Нет',
      fireHazard: 'Нет данных',
      responsibilityLevel: 'Нормальный',
      permanentOccupancy: '',
      urbanPlanningActivity: '',
      surveyStage: '',
      technicalCharacteristics: '',
      excavationDepth: '',
      siteDescription: '',
      siteArea: '',
      technicalCustomerName: '',
      technicalCustomerDirectorPosition: '',
      technicalCustomerDirectorName: '',
      clientDirectorPosition: '',
      clientDirectorName: '',
      clientShortName: '',
      coordinates: null,
      cadastralNumber: '',
      contractorRole: 'Подрядчик',
      backgroundConcentrationsRef: '№ 312/15/05/ Э-574 от 28.02.2022',
      previousSurveyReport: 'Технический отчет … ул.Игральная … Мосгоргеотрест',
      reportCopiesText: '',
      titleSignatories: [],
    },
    extras: null,
    operator: {},
    orderFlags: null,
  });
  expect(fill.hasCgmsCertificate).toBe(false);
  expect(fill.cgmsCertificateNumber).toBe('');
  expect(fill.previousSurveyReport).toBe('');
});

test('buildReportIeiFillData: справка из ТЗ — номер и дата', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект, г. Москва',
    section1: {
      objectName: '',
      objectLocation: '',
      clientName: '',
      clientOgrn: '',
      clientAddress: '',
      clientContactName: '',
      clientContactPhone: '',
      clientContactEmail: '',
      goalsAndTasks: '',
      objectPurpose: '',
      transportInfrastructure: 'Нет',
      hazardousProduction: 'Нет',
      fireHazard: 'Нет данных',
      responsibilityLevel: 'Нормальный',
      permanentOccupancy: '',
      urbanPlanningActivity: '',
      surveyStage: '',
      technicalCharacteristics: '',
      excavationDepth: '',
      siteDescription: '',
      siteArea: '',
      technicalCustomerName: '',
      technicalCustomerDirectorPosition: '',
      technicalCustomerDirectorName: '',
      clientDirectorPosition: '',
      clientDirectorName: '',
      clientShortName: '',
      coordinates: null,
      cadastralNumber: '',
      contractorRole: 'Подрядчик',
      backgroundConcentrationsRef: '№ 100/5/Э-12 от 01.03.2025',
      previousSurveyReport: '',
      reportCopiesText: '',
      titleSignatories: [],
    },
    extras: null,
    operator: {},
    orderFlags: null,
  });
  expect(fill.hasCgmsCertificate).toBe(true);
  expect(fill.cgmsCertificateNumber).toBe('100/5/Э-12');
  expect(fill.cgmsCertificateDate).toBe('01.03.2025');
  expect(parseCgmsCertificateRef('№ 100/5/Э-12 от 01.03.2025')).toEqual({
    number: '100/5/Э-12',
    date: '01.03.2025',
  });
});

test('buildReportIeiFillData: оператор перекрывает справку из ТЗ', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект, Московская область, г. Балашиха',
    objectAddress: 'Московская область, г. Балашиха',
    section1: null,
    extras: null,
    operator: {
      cgmsCertificateRef: '№ 77-А от 12.04.2026',
      weatherStation: 'Немчиновка',
      weatherStationPeriod: 'за период с 2018 по 2023 годы',
    },
    orderFlags: null,
  });
  expect(fill.isMoscow).toBe(false);
  expect(fill.hasCgmsCertificate).toBe(true);
  expect(fill.cgmsCertificateNumber).toBe('77-А');
  expect(fill.cgmsCertificateDate).toBe('12.04.2026');
  expect(fill.weatherStation).toBe('Немчиновка');
});

test('buildReportIeiFillData: галочка нет справки ЦГМС перекрывает номер из ТЗ', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект, г. Москва',
    section1: {
      objectName: '',
      objectLocation: '',
      clientName: '',
      clientOgrn: '',
      clientAddress: '',
      clientContactName: '',
      clientContactPhone: '',
      clientContactEmail: '',
      goalsAndTasks: '',
      objectPurpose: '',
      transportInfrastructure: 'Нет',
      hazardousProduction: 'Нет',
      fireHazard: 'Нет данных',
      responsibilityLevel: 'Нормальный',
      permanentOccupancy: '',
      urbanPlanningActivity: '',
      surveyStage: '',
      technicalCharacteristics: '',
      excavationDepth: '',
      siteDescription: '',
      siteArea: '',
      technicalCustomerName: '',
      technicalCustomerDirectorPosition: '',
      technicalCustomerDirectorName: '',
      clientDirectorPosition: '',
      clientDirectorName: '',
      clientShortName: '',
      coordinates: null,
      cadastralNumber: '',
      contractorRole: 'Подрядчик',
      backgroundConcentrationsRef: '№ 100/5/Э-12 от 01.03.2025',
      previousSurveyReport: '',
      reportCopiesText: '',
      titleSignatories: [],
    },
    extras: null,
    operator: { hasCgmsCertificate: false },
    orderFlags: null,
  });
  expect(fill.hasCgmsCertificate).toBe(false);
  expect(fill.cgmsCertificateNumber).toBe('');
  expect(fill.cgmsCertificateDate).toBe('');
});

test('parseJsonObjectFromAi: fence и пустой ответ', () => {
  expect(parseJsonObjectFromAi('```json\n{"landUseZone":"зоне Ж-1"}\n```')).toEqual({
    landUseZone: 'зоне Ж-1',
  });
  expect(parseJsonObjectFromAi('')).toBeNull();
  expect(parseJsonObjectFromAi('нет данных')).toBeNull();
});

test('buildReportIeiFillData: §3 пустые ИГИ/ООПТ/справка не подставляют примеры', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект, г. Москва, ул. Лесная',
    objectAddress: 'г. Москва, ул. Лесная',
    nearby: { nearbyText: 'К северу проходит ул. Лесная' },
    section1: null,
    extras: null,
    operator: {},
    orderFlags: null,
    tzLandUseZone: 'производственной зоне',
    landscape: 'YAUZSKIY',
  });
  expect(fill.isMoscow).toBe(true);
  expect(fill.landscape).toBe('');
  expect(fill.hasIgiReport).toBe(false);
  expect(fill.hasOopt).toBe(false);
  expect(fill.hasCgmsCertificate).toBe(false);
  expect(fill.igiGeologyText).toBe('');
  expect(fill.moEcologyLetterText).toBe('');
  expect(fill.economicDevelopmentText).toContain('производственной зоне');
  expect(fill.economicDevelopmentText).toContain('ул. Лесная');
});

test('buildReportIeiFillData: ландшафт из программы и ИГИ только из данных', () => {
  const fill = buildReportIeiFillData({
    objectName: 'Объект, г. Москва',
    section1: null,
    extras: null,
    operator: {
      landscape: 'HIMKI',
      igiGeologyText: 'Насыпные грунты 1,2 м.',
      hasOopt: true,
      ooptName: 'Долина реки Сетунь',
    },
    orderFlags: null,
    landscape: 'TSARITSYNSKIY',
    hasIgiReport: true,
  });
  expect(fill.landscape).toBe('HIMKI');
  expect(fill.hasIgiReport).toBe(true);
  expect(fill.igiGeologyText).toBe('Насыпные грунты 1,2 м.');
  expect(fill.hasOopt).toBe(true);
  expect(fill.ooptName).toBe('Долина реки Сетунь');
});
