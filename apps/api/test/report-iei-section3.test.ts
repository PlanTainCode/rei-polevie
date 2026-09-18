import { expect, test } from 'bun:test';
import { fillReportIeiSection3 } from '../src/modules/word/report-iei/section-3';
import { SECTION_3 } from '../src/modules/word/report-iei/ids';
import {
  MO_CLIMATE_TEXT,
  MO_FAUNA_TEXT,
  MO_SOILS_INTRO_TEXT,
  MO_VEGETATION_TEXT,
  MOSCOW_CLIMATE_TEXT,
  MOSCOW_FAUNA_TEXT,
  MOSCOW_SOILS_INTRO_TEXT,
  MOSCOW_VEGETATION_TEXT,
  NO_OOPT_HEADING,
  NO_OOPT_TEXT,
  buildWeatherStationSentence,
  mapProgramIeiLandscapeToReport,
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
  nearbyText: 'К северу от участка изысканий проходит ул. Лесная.',
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
    para(SECTION_3.moscowClimate, '(Москва) Климат района изысканий характеризуется как умеренно-континентальный.') +
    para(SECTION_3.moscowClimateFollow[0], 'Зима пасмурная, умеренно холодная.') +
    para(SECTION_3.moClimate, '(МО) Рассматриваемая территория относится ко II-му поясу.') +
    para(SECTION_3.moClimateFollow[0], 'Среднемесячная температура самого теплого месяца (июль) составляет плюс 19,4°С.') +
    para(
      SECTION_3.weatherStationFromCertificate,
      'Краткая климатическая характеристика района изысканий приводится по данным наблюдений метеорологической станции «Немчиновка» за период с 2001 по 2010 годы',
    ) +
    para(
      SECTION_3.weatherStationAnalytical,
      'Краткая природно-климатическая характеристика представлена в Аналитическом отчете… станции Можайск…',
    ) +
    para(SECTION_3.climateMaxTemp, '+24,8') +
    para(SECTION_3.climateColdTemp, '-14,0') +
    para(SECTION_3.climateA, '140,0') +
    para(SECTION_3.climateAppendixNote, 'Климатическая характеристика района расположения объекта приводится в Приложении Г.') +
    para(
      SECTION_3.moscowNativeLandscapes.HIMKI,
      'Участок изысканий относится к Химкинскому коренному ландшафту Смоленско-Московской возвышенности (см. Рисунок 3.2.1).',
    ) +
    para(
      SECTION_3.moscowNativeLandscapes.TSARITSYNSKIY,
      'Участок изысканий относится к Царицынскому коренному ландшафту Теплостанской возвышенности.',
    ) +
    para(
      SECTION_3.moLandscapes.APRELEVSKO_ODINTSOVSKAYA,
      '(МО) Участок изысканий относится к Апрелевско-Одинцовской равнине (см. Рисунок 3.2.1). Ландшафт представлен',
    ) +
    para(
      SECTION_3.urbanLandscapes.CENTRAL,
      'В системе городских ландшафтов участок изысканий приурочен к застроенному, озелененному центральному городскому ландшафту.',
    ) +
    para(
      SECTION_3.urbanLandscapes.RIGHT_BANK_ELEVATED,
      'В системе городских ландшафтов участок изысканий приурочен к застроенному, озелененному правобережному возвышенному городскому ландшафту.',
    ) +
    para(
      SECTION_3.economicDevelopment,
      'Коренные урочища на всей территории изысканий изменены планировкой. Основными элементами являются русло реки Москвы.',
    ) +
    para(
      SECTION_3.igiGeomorphology,
      'В геоморфологическом отношении площадка расположена в пределах третьей (Ходынской) надпойменной террасы реки Москвы.',
    ) +
    para(SECTION_3.igiComplexity, 'Инженерно-геологические условия II (средней) категории сложности.') +
    para(SECTION_3.igiGeologyIntro, 'В геологическом строении участка принимают участие отложения юрские.') +
    para(SECTION_3.igiGeologyLayers[0], '0,0-0,2 м – почвенно-растительный слой (pQIV);') +
    para(
      SECTION_3.hydroSurfaceWater,
      'Обязательно проверить. Ближайшим поверхностным водным объектом является…….. Инфо из п.1.5.4.',
    ) +
    para(SECTION_3.igiGroundwaterLevel, 'Уровень грунтовых вод вскрыт на глубине 1,5-5,5 м.') +
    para(SECTION_3.moscowSoilsIntro, '(Москва) Изначально почвенный покров Москвы состоял в основном из дерново-подзолистых почв.') +
    para(SECTION_3.moscowSoilsShare, 'Основными почвами Москвы являются дерново-подзолистые.') +
    para(
      SECTION_3.igiSoils,
      'Территория претерпела изменения в процессе строительства железной дороги с инфраструктурой.',
    ) +
    para(
      SECTION_3.fertilitySkip,
      '(если не делаем плодородие) Почвы рассматриваемого участка характеризуются запечатанностью около 60%.',
    ) +
    para(
      SECTION_3.moSoilsIntro,
      '(МО) Почвенный покров участка изысканий представлен сочетанием аллювиальных болотных почв.',
    ) +
    para(SECTION_3.moSoilsFollow[0], 'Аллювиальный процесс – это накопление речного аллювия.') +
    para(
      SECTION_3.geobotanyFromAct,
      'По результатам геоботанического исследования, проведенного в весенний период (май 2020 г.), виды Красной книги отсутствуют.',
    ) +
    para(SECTION_3.vegetationPhotoInstruction, 'Описание делается каждый раз на основе фото с объекта') +
    para(
      SECTION_3.woodyPlantings,
      'Древесные насаждения произрастают единым пологом/ рядовыми посадками вдоль … клен ясенелистный, липа сердцелистная.',
    ) +
    para(SECTION_3.vegetationTemplateExtra[0], 'Флористический состав участка представлен видами озеленения.') +
    para(SECTION_3.vegetationTableCaption, 'Таблица 3.1 – Характерная растительность участка обследования') +
    '<w:tbl>' +
    para(SECTION_3.vegetationPhotoTable, '№') +
    para('VEGIMG', 'фото чужого объекта') +
    '</w:tbl>' +
    para(SECTION_3.moscowVegetation, '(Москва) Территория изысканий находится в пределах полос отвода железной дороги.') +
    para(SECTION_3.moVegetation, '(МО) Территория изысканий покрыта растительностью пойменных лугов у канала.') +
    para(
      SECTION_3.faunaFromAct,
      'По результатам фаунистического исследования (май 2020 г.) объекты Красной книги отсутствуют.',
    ) +
    para(SECTION_3.moscowFauna, 'На территории выявлена черная ворона, сизый голубь.') +
    para(
      SECTION_3.moEcologyLetter,
      '(МО) В соответствии с письмом Министерства экологии №24Исх-10640 от 19.07.2018 зафиксирован тушканчик большой.',
    ) +
    para(SECTION_3.moFauna, 'Животный мир представлен полевыми видами.') +
    para(
      SECTION_3.ooptHeading,
      '3.8 Особо охраняемая природная территория регионального значения «Природно-исторический парк «Москворецкий» (при наличии ООПТ)',
    ) +
    para(
      SECTION_3.ooptBody[0],
      'Природно-исторический парк «Москворецкий» ˗ самый большой природный парк Москвы площадью 3660 гектаров.',
    ) +
    para(SECTION_3.ooptBody[1], 'Расположен на северо-западе и западе столицы.') +
    para(SECTION_3.pollutionLead, 'Экологическая обстановка района характеризуется как крайне неблагоприятная.') +
    para(
      SECTION_3.pollutionExamples[1],
      'Территория изысканий находится в пределах зоны влияния Грайвороновская ул.',
    ) +
    para(
      SECTION_3.pollutionExamples[2],
      'Стационарными источниками загрязнения являются: ПАО «Карачаровский механический завод».',
    ) +
    '</w:document>'
  );
}

test('mapProgramIeiLandscapeToReport: только список из программы, без выдумки', () => {
  expect(mapProgramIeiLandscapeToReport('HIMKI')).toBe('HIMKI');
  expect(mapProgramIeiLandscapeToReport('TSARITSYNSKIY')).toBe('TSARITSYNSKIY');
  expect(mapProgramIeiLandscapeToReport('YAUZSKIY')).toBe('');
  expect(mapProgramIeiLandscapeToReport('UNKNOWN')).toBe('');
});

test('fillReportIeiSection3: нет справки — чужие станция и числа убраны', () => {
  const out = fillReportIeiSection3(sampleXml(), baseData);
  expect(paraText(out, SECTION_3.weatherStationFromCertificate)).toBeNull();
  expect(paraText(out, SECTION_3.weatherStationAnalytical)).toBeNull();
  expect(out).not.toContain('Немчиновка');
  expect(out).not.toContain('Можайск');
  expect(paraText(out, SECTION_3.climateMaxTemp) || '').toBe('');
  expect(paraText(out, SECTION_3.climateColdTemp) || '').toBe('');
  expect(paraText(out, SECTION_3.climateA) || '').toBe('');
  expect(paraText(out, SECTION_3.climateAppendixNote)).toBeNull();
});

test('fillReportIeiSection3: Москва — климат, почвы, растительность, фауна; не МО', () => {
  const out = fillReportIeiSection3(sampleXml(), {
    ...baseData,
    isMoscow: true,
    landscape: 'HIMKI',
    urbanLandscape: 'CENTRAL',
  });
  expect(paraText(out, SECTION_3.moscowClimate)).toBe(MOSCOW_CLIMATE_TEXT);
  expect(paraText(out, SECTION_3.moClimate)).toBeNull();
  expect(paraText(out, SECTION_3.moClimateFollow[0])).toBeNull();
  expect(paraText(out, SECTION_3.moscowClimateFollow[0])).toBe('Зима пасмурная, умеренно холодная.');
  expect(paraText(out, SECTION_3.moscowNativeLandscapes.HIMKI)).toContain('Химкинскому');
  expect(paraText(out, SECTION_3.moscowNativeLandscapes.TSARITSYNSKIY)).toBeNull();
  expect(paraText(out, SECTION_3.moLandscapes.APRELEVSKO_ODINTSOVSKAYA)).toBeNull();
  expect(paraText(out, SECTION_3.urbanLandscapes.CENTRAL)).toContain('центральному');
  expect(paraText(out, SECTION_3.urbanLandscapes.RIGHT_BANK_ELEVATED)).toBeNull();
  expect(paraText(out, SECTION_3.moscowSoilsIntro)).toBe(MOSCOW_SOILS_INTRO_TEXT);
  expect(paraText(out, SECTION_3.moSoilsIntro)).toBeNull();
  expect(paraText(out, SECTION_3.moSoilsFollow[0])).toBeNull();
  expect(paraText(out, SECTION_3.moscowVegetation)).toBe(MOSCOW_VEGETATION_TEXT);
  expect(paraText(out, SECTION_3.moVegetation)).toBeNull();
  expect(out).not.toContain('пойменных лугов');
  expect(paraText(out, SECTION_3.moscowFauna)).toBe(MOSCOW_FAUNA_TEXT);
  expect(paraText(out, SECTION_3.moEcologyLetter)).toBeNull();
  expect(out).not.toContain('24Исх-10640');
});

test('fillReportIeiSection3: МО — климат, почвы, растительность; письмо Минэкологии не выдумываем', () => {
  const out = fillReportIeiSection3(sampleXml(), {
    ...baseData,
    isMoscow: false,
    moLandscape: 'APRELEVSKO_ODINTSOVSKAYA',
  });
  expect(paraText(out, SECTION_3.moscowClimate)).toBeNull();
  expect(paraText(out, SECTION_3.moClimate)).toBe(MO_CLIMATE_TEXT);
  expect(paraText(out, SECTION_3.moscowClimateFollow[0])).toBeNull();
  expect(paraText(out, SECTION_3.moscowNativeLandscapes.HIMKI)).toBeNull();
  expect(paraText(out, SECTION_3.moLandscapes.APRELEVSKO_ODINTSOVSKAYA)).toContain(
    'Апрелевско-Одинцовской',
  );
  expect(paraText(out, SECTION_3.moLandscapes.APRELEVSKO_ODINTSOVSKAYA)).not.toContain('(МО)');
  expect(paraText(out, SECTION_3.urbanLandscapes.CENTRAL)).toBeNull();
  expect(paraText(out, SECTION_3.moscowSoilsIntro)).toBeNull();
  expect(paraText(out, SECTION_3.moSoilsIntro)).toBe(MO_SOILS_INTRO_TEXT);
  expect(paraText(out, SECTION_3.moscowVegetation)).toBeNull();
  expect(paraText(out, SECTION_3.moVegetation)).toBe(MO_VEGETATION_TEXT);
  expect(paraText(out, SECTION_3.moEcologyLetter)).toBeNull();
  expect(out).not.toContain('24Исх-10640');
  expect(out).not.toContain('тушканчик');
  expect(paraText(out, SECTION_3.moFauna)).toBe(MO_FAUNA_TEXT);
});

test('fillReportIeiSection3: нет ИГИ — не оставляем Ходынскую и слои чужого разреза', () => {
  const out = fillReportIeiSection3(sampleXml(), { ...baseData, hasIgiReport: false });
  expect(paraText(out, SECTION_3.igiGeomorphology)).toBeNull();
  expect(paraText(out, SECTION_3.igiComplexity)).toBeNull();
  expect(paraText(out, SECTION_3.igiGeologyIntro)).toBeNull();
  expect(paraText(out, SECTION_3.igiGeologyLayers[0])).toBeNull();
  expect(paraText(out, SECTION_3.igiGroundwaterLevel)).toBeNull();
  expect(paraText(out, SECTION_3.igiSoils)).toBeNull();
  expect(out).not.toContain('Ходынской');
  expect(out).not.toContain('0,0-0,2 м');
  expect(out).not.toContain('железной дороги');
});

test('fillReportIeiSection3: ИГИ есть — подставляем тексты, слои-пример убираем', () => {
  const out = fillReportIeiSection3(sampleXml(), {
    ...baseData,
    hasIgiReport: true,
    igiGeomorphologyText: 'Площадка на второй надпойменной террасе р. Москвы.',
    igiGeologyText: 'Разрез представлен насыпными грунтами и покровными суглинками.',
    igiHydroText: 'Подземные воды вскрыты на глубине 3,2 м.',
    igiSoilsText: 'Почвы участка — урбаноземы на насыпных грунтах.',
  });
  expect(paraText(out, SECTION_3.igiGeomorphology)).toBe(
    'Площадка на второй надпойменной террасе р. Москвы.',
  );
  expect(out).not.toContain('Ходынской');
  expect(paraText(out, SECTION_3.igiGeologyIntro)).toContain('насыпными грунтами');
  expect(paraText(out, SECTION_3.igiGeologyLayers[0])).toBeNull();
  expect(paraText(out, SECTION_3.igiGroundwaterLevel)).toBe('Подземные воды вскрыты на глубине 3,2 м.');
  expect(paraText(out, SECTION_3.igiSoils)).toBe('Почвы участка — урбаноземы на насыпных грунтах.');
});

test('fillReportIeiSection3: нет ООПТ — формулировка отсутствия, не Москворецкий', () => {
  const out = fillReportIeiSection3(sampleXml(), { ...baseData, hasOopt: false });
  expect(paraText(out, SECTION_3.ooptHeading)).toBe(NO_OOPT_HEADING);
  expect(paraText(out, SECTION_3.ooptBody[0])).toBe(NO_OOPT_TEXT);
  expect(paraText(out, SECTION_3.ooptBody[1])).toBeNull();
  expect(paraText(out, SECTION_3.ooptHeading)).not.toContain('Москворецкий');
  expect(paraText(out, SECTION_3.ooptBody[0])).not.toContain('Москворецкий');
});

test('fillReportIeiSection3: ООПТ только если передали название/текст', () => {
  const out = fillReportIeiSection3(sampleXml(), {
    ...baseData,
    hasOopt: true,
    ooptName: 'Особо охраняемая природная территория регионального значения «Долина реки Сетунь»',
    ooptText: 'Участок частично расположен в границах ООПТ «Долина реки Сетунь».',
  });
  expect(paraText(out, SECTION_3.ooptHeading)).toContain('Долина реки Сетунь');
  expect(paraText(out, SECTION_3.ooptBody[0])).toContain('Долина реки Сетунь');
  expect(out).not.toContain('Москворецкий');
  expect(paraText(out, SECTION_3.ooptBody[1])).toBeNull();
});

test('fillReportIeiSection3: пустые акт/поле/плодородие/загрязнение — убираем чужие примеры', () => {
  const out = fillReportIeiSection3(sampleXml(), {
    ...baseData,
    economicDevelopmentText: 'Участок расположен в производственной зоне. К северу проходит ул. Лесная.',
    waterObjectText: 'Ближайший водный объект — р. Москва, в 400 м к востоку.',
  });
  expect(paraText(out, SECTION_3.economicDevelopment)).toContain('ул. Лесная');
  expect(paraText(out, SECTION_3.economicDevelopment)).not.toContain('реки Москвы');
  expect(paraText(out, SECTION_3.hydroSurfaceWater)).toContain('р. Москва');
  expect(out).not.toContain('является……');
  expect(paraText(out, SECTION_3.geobotanyFromAct)).toBeNull();
  expect(out).not.toContain('май 2020');
  expect(paraText(out, SECTION_3.woodyPlantings)).toBeNull();
  expect(out).not.toContain('липа сердцелистная');
  expect(paraText(out, SECTION_3.vegetationPhotoInstruction)).toBeNull();
  expect(paraText(out, SECTION_3.vegetationTableCaption)).toBeNull();
  expect(paraText(out, SECTION_3.vegetationPhotoTable)).toBeNull();
  expect(paraText(out, SECTION_3.faunaFromAct)).toBeNull();
  expect(paraText(out, SECTION_3.fertilitySkip)).toBeNull();
  expect(out).not.toContain('запечатанностью около 60%');
  expect(paraText(out, SECTION_3.pollutionLead)).toBeNull();
  expect(out).not.toContain('Карачаровский');
  expect(out).not.toContain('Грайвороновская');
});

test('fillReportIeiSection3: справка ЦГМС — станция и числа, не Немчиновка', () => {
  const out = fillReportIeiSection3(sampleXml(), {
    ...baseData,
    hasCgmsCertificate: true,
    weatherStation: 'Балчуг',
    weatherStationPeriod: 'за период с 2015 по 2024 годы',
    climateValues: { maxTempHotMonth: '+25,1', meanTempColdMonth: '-12,3', atmosphereA: '140,0' },
  });
  expect(paraText(out, SECTION_3.weatherStationFromCertificate)).toBe(
    buildWeatherStationSentence('Балчуг', 'за период с 2015 по 2024 годы'),
  );
  expect(paraText(out, SECTION_3.weatherStationFromCertificate)).not.toContain('Немчиновка');
  expect(paraText(out, SECTION_3.climateMaxTemp)).toBe('+25,1');
});
