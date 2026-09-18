import { expect, test } from 'bun:test';
import { fillReportIeiSection2 } from '../src/modules/word/report-iei/section-2';
import { SECTION_2 } from '../src/modules/word/report-iei/ids';
import {
  MO_CLIMATE_TEXT,
  MO_SOURCES_TEXT,
  MOSCOW_CLIMATE_TEXT,
  MOSCOW_SOURCES_NO_CERT_TEXT,
  MOSCOW_SOURCES_WITH_CERT_TEXT,
  NO_CGMS_CLIMATE_TEXT,
  NO_PREVIOUS_IEI_TEXT,
  buildWeatherStationSentence,
  parseCgmsCertificateRef,
} from '../src/modules/word/report-iei/text';
import { emptyReportIeiSection3Fields, type ReportIeiFillData } from '../src/modules/word/report-iei/types';

function para(id: string, text: string): string {
  return `<w:p w14:paraId="${id}"><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function paraText(xml: string, paraId: string): string | null {
  const match = xml.match(new RegExp(`<w:p[^>]*w14:paraId="${paraId}"[^>]*>([\\s\\S]*?)</w:p>`));
  if (!match) return null;
  return [...match[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

const baseData: ReportIeiFillData = {
  objectName: 'Реконструкция сетей по адресу: г. Москва, ул. Лесная, д. 1',
  surveyStage: 'Инженерные изыскания для подготовки проектной документации',
  urbanPlanningActivity: 'Архитектурно-строительное проектирование',
  clientName: 'ООО «Тест»',
  clientOgrn: '1027739558714',
  clientAddress: '125130, г.Москва, ул.Тестовая, д.1',
  fieldWorkPeriod: 'в мае 2026 г.',
  cameralWorkPeriod: 'в июне 2026',
  hasObjectRename: false,
  isLandscapingOnly: false,
  isMoscow: true,
  hasWaterSamples: false,
  hasBuildingSurvey: false,
  locationText: 'г. Москва, ул. Лесная, д. 1',
  nearbyText: '',
  socialInfrastructureText: '',
  waterObjectText: '',
  landUseZone: '',
  openGroundPercent: null,
  technicalCharacteristics: '',
  siteArea: '',
  excavationDepth: '',
  volume: 'Том 1.3.1',
  reportCipher: '801-67-26-ИЭИ',
  year: '2026',
  executorNames: [],
  inventoryNumber: '',
  hasFacadePhoto: false,
  hasCgmsCertificate: false,
  cgmsCertificateNumber: '',
  cgmsCertificateDate: '',
  weatherStation: '',
  weatherStationPeriod: '',
  climateValues: null,
  previousSurveyReport: '',
  ...emptyReportIeiSection3Fields(),
};

function sampleXml(): string {
  return (
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">' +
    para(SECTION_2.previousIeiIntro, 'В 2014 и 2015 гг. на обследуемой территории выполнялись инженерно-экологические изыскания:') +
    para(
      SECTION_2.previousIeiReport,
      'Технический отчет «…ул.Игральная, д.8». ГУП «Мосгоргеотрест», М.:2014;',
    ) +
    para(SECTION_2.previousIeiExpired, 'Использование результатов инженерно-экологических изысканий, проведенных ранее, невозможно в связи с истечением срока давности.') +
    para(SECTION_2.noPreviousIei, '(Если нет ИЭИ, проведенных ранее) Степень изученности низка.') +
    para(
      SECTION_2.noCgmsClimate,
      '(Если не справка от ЦГМС) Климатическая характеристика района изысканий приведена согласно аналитическому отчету «Расчет…», Москва - 2025 г.',
    ) +
    para(SECTION_2.cgmsLetterNumber, '312/15/05/ Э-574') +
    para(SECTION_2.cgmsLetterDate, '28.02.2022') +
    para(
      SECTION_2.moscowSources,
      'При подготовке данного раздела были использованы данные из справки… Геотехнология. – М., 2014.',
    ) +
    para(
      SECTION_2.moSources,
      '(МО) При подготовке данного раздела были использованы литературные и фондовые материалы [21]… ООО «Стандарт Геострой». – М., 2014.',
    ) +
    para(SECTION_2.moscowClimate, '(Москва) Климат района изысканий характеризуется как умеренно-континентальный.') +
    para(SECTION_2.moscowClimateFollow[0], 'Зима пасмурная, умеренно холодная.') +
    para(SECTION_2.moClimate, '(МО) Рассматриваемая территория относится ко II-му поясу.') +
    para(SECTION_2.moClimateFollow[0], 'Среднемесячная температура самого теплого месяца (июль) составляет плюс 19,4°С.') +
    para(
      SECTION_2.weatherStationFromCertificate,
      'Краткая климатическая характеристика района изысканий приводится по данным наблюдений метеорологической станции «Немчиновка» за период с 2001 по 2010 годы',
    ) +
    para(
      SECTION_2.weatherStationAnalytical,
      'Краткая природно-климатическая характеристика представлена в Аналитическом отчете… станции Можайск…',
    ) +
    para(SECTION_2.climateMaxTemp, '+24,8') +
    para(SECTION_2.climateColdTemp, '-14,0') +
    para(SECTION_2.climateA, '140,0') +
    para(SECTION_2.climateWindRose[0], '8') +
    para(SECTION_2.climateAppendixNote, 'Климатическая характеристика района расположения объекта приводится в Приложении Г.') +
    '</w:document>'
  );
}

test('parseCgmsCertificateRef: номер и дата', () => {
  expect(parseCgmsCertificateRef('№ 100/5/Э-12 от 01.03.2025')).toEqual({
    number: '100/5/Э-12',
    date: '01.03.2025',
  });
});

test('fillReportIeiSection2: нет справки — ветка [88], чужие номера и станция убраны', () => {
  const out = fillReportIeiSection2(sampleXml(), baseData);
  expect(paraText(out, SECTION_2.noCgmsClimate)).toBe(NO_CGMS_CLIMATE_TEXT);
  expect(paraText(out, SECTION_2.noCgmsClimate)).not.toContain('Если не справка');
  expect(paraText(out, SECTION_2.cgmsLetterNumber) || '').toBe('');
  expect(paraText(out, SECTION_2.cgmsLetterDate) || '').toBe('');
  expect(out).not.toContain('312/15/05');
  expect(out).not.toContain('28.02.2022');
  expect(paraText(out, SECTION_2.weatherStationFromCertificate)).toBeNull();
  expect(paraText(out, SECTION_2.weatherStationAnalytical)).toBeNull();
  expect(out).not.toContain('Немчиновка');
  expect(out).not.toContain('Можайск');
  expect(paraText(out, SECTION_2.climateMaxTemp) || '').toBe('');
  expect(paraText(out, SECTION_2.climateColdTemp) || '').toBe('');
  expect(paraText(out, SECTION_2.climateA) || '').toBe('');
  expect(paraText(out, SECTION_2.climateAppendixNote)).toBeNull();
  expect(paraText(out, SECTION_2.previousIeiReport)).toBeNull();
  expect(out).not.toContain('Игральная');
  expect(paraText(out, SECTION_2.noPreviousIei)).toBe(NO_PREVIOUS_IEI_TEXT);
});

test('fillReportIeiSection2: Москва без справки — источники Москвы, не МО', () => {
  const out = fillReportIeiSection2(sampleXml(), { ...baseData, isMoscow: true });
  expect(paraText(out, SECTION_2.moscowSources)).toBe(MOSCOW_SOURCES_NO_CERT_TEXT);
  expect(paraText(out, SECTION_2.moscowSources)).not.toContain('Геотехнология');
  expect(paraText(out, SECTION_2.moSources)).toBeNull();
  expect(out).not.toContain('Стандарт Геострой');
  expect(paraText(out, SECTION_2.moscowClimate)).toBe(MOSCOW_CLIMATE_TEXT);
  expect(paraText(out, SECTION_2.moClimate)).toBeNull();
  expect(paraText(out, SECTION_2.moClimateFollow[0])).toBeNull();
  expect(paraText(out, SECTION_2.moscowClimateFollow[0])).toBe('Зима пасмурная, умеренно холодная.');
});

test('fillReportIeiSection2: МО — фондовые материалы и климат МО', () => {
  const out = fillReportIeiSection2(sampleXml(), { ...baseData, isMoscow: false });
  expect(paraText(out, SECTION_2.moscowSources)).toBeNull();
  expect(paraText(out, SECTION_2.moSources)).toBe(MO_SOURCES_TEXT);
  expect(paraText(out, SECTION_2.moSources)).not.toContain('(МО)');
  expect(paraText(out, SECTION_2.moSources)).not.toContain('Стандарт Геострой');
  expect(paraText(out, SECTION_2.moClimate)).toBe(MO_CLIMATE_TEXT);
  expect(paraText(out, SECTION_2.moscowClimate)).toBeNull();
  expect(paraText(out, SECTION_2.moscowClimateFollow[0])).toBeNull();
  expect(paraText(out, SECTION_2.noCgmsClimate)).toBe(NO_CGMS_CLIMATE_TEXT);
});

test('fillReportIeiSection2: справка ЦГМС — номер, дата, станция, числа', () => {
  const out = fillReportIeiSection2(sampleXml(), {
    ...baseData,
    isMoscow: true,
    hasCgmsCertificate: true,
    cgmsCertificateNumber: '100/5/Э-12',
    cgmsCertificateDate: '01.03.2025',
    weatherStation: 'Балчуг',
    weatherStationPeriod: 'за период с 2015 по 2024 годы',
    climateValues: {
      atmosphereA: '140,0',
      maxTempHotMonth: '+25,1',
      meanTempColdMonth: '-12,3',
      windN: '7',
    },
  });
  expect(paraText(out, SECTION_2.noCgmsClimate)).toBeNull();
  expect(paraText(out, SECTION_2.cgmsLetterNumber)).toBe('100/5/Э-12');
  expect(paraText(out, SECTION_2.cgmsLetterDate)).toBe('01.03.2025');
  expect(paraText(out, SECTION_2.weatherStationFromCertificate)).toBe(
    buildWeatherStationSentence('Балчуг', 'за период с 2015 по 2024 годы'),
  );
  expect(paraText(out, SECTION_2.weatherStationFromCertificate)).not.toContain('Немчиновка');
  expect(paraText(out, SECTION_2.weatherStationAnalytical)).toBeNull();
  expect(paraText(out, SECTION_2.climateMaxTemp)).toBe('+25,1');
  expect(paraText(out, SECTION_2.climateColdTemp)).toBe('-12,3');
  expect(paraText(out, SECTION_2.climateA)).toBe('140,0');
  expect(paraText(out, SECTION_2.climateWindRose[0])).toBe('7');
  expect(paraText(out, SECTION_2.moscowSources)).toBe(MOSCOW_SOURCES_WITH_CERT_TEXT);
  expect(paraText(out, SECTION_2.climateAppendixNote)).toBe(
    'Климатическая характеристика района расположения объекта приводится в Приложении Г.',
  );
});
