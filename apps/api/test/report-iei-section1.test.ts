import { expect, test } from 'bun:test';
import {
  buildContractSentence,
  buildDatesSentence,
  buildIntroObjectSentence,
  buildLocationSentence,
  buildOpenGroundText,
  buildReportCipher,
  buildSiteAreaText,
  buildUrbanPlanningSentence,
  extractLandUseZoneFromTz,
  formatInventoryNumber,
  hasMedBuildingAndEroa,
  isLandscapingOnly,
  isMoscowAddress,
  stageSubtitleFromSurveyStage,
} from '../src/modules/word/report-iei/text';
import { fitTableToContentWidth, tableOccupiedWidth } from '../src/modules/word/report-iei/fit-tables';
import { fillReportIeiSection1 } from '../src/modules/word/report-iei/section-1';
import { REPORT_IEI_STAFF } from '../src/modules/word/report-iei/staff';
import { fillReportIeiTitle } from '../src/modules/word/report-iei/title';
import {
  insertDrawingIntoParagraph,
  removeParagraphIncludingMedia,
  removeParagraphOnly,
  removeParagraphOrContainingRow,
  replaceParagraphTextKeepFormatting,
} from '../src/modules/word/report-iei/xml-text';
import {
  INTRO,
  SECTION_11,
  SECTION_12,
  SECTION_13,
  SECTION_15_MOSCOW_LAB,
  SECTION_16,
  SECTION_17,
  TITLE,
} from '../src/modules/word/report-iei/ids';
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
  waterObjectText: 'Ближайшим поверхностным водным объектом является р. Москва.',
  landUseZone: 'многофункциональной общественной зоне',
  openGroundPercent: 20,
  technicalCharacteristics: 'Строительство административного здания.',
  siteArea: '0,77 га',
  excavationDepth: '-3,0 м (max)',
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
    para(TITLE.objectName, 'Название объекта Название объекта') +
    para(TITLE.stageSubtitle, 'для подготовки проектной документации') +
    para(TITLE.program71Note, '(из п. 7.1 Программы)') +
    para(TITLE.cipher, '52015-20-01-77-ИЭИ') +
    para(TITLE.volume, 'Том 1.3.1') +
    para(TITLE.inventoryNumber, '000123') +
    para(INTRO.objectSentence, 'Инженерно-экологические изыскания выполнены по объекту: «Название объекта»') +
    para(INTRO.renameSentence, 'В процессе производства работ было изменено название объекта с «старое» на актуальное: «новое».') +
    para(INTRO.urbanPlanning, 'Вид градостроительной деятельности – архитектурно-строительное проектирование, капитальный ремонт') +
    para(INTRO.surveyStage, 'Этап выполнения инженерных изысканий – инженерные изыскания для подготовки проектной документации.') +
    para(INTRO.contract, 'Основанием проведения инженерных изысканий является договор между ООО «ГВИН-ПИН» и АО «РЭИ-ЭКОАУДИТ».') +
    para(SECTION_12.techReglament384, 'Федеральный закон «Технический регламент...» (не использовать только для благоустройства)') +
    para(SECTION_13.clientName, 'ООО «ТелекомКапСтрой», ОГРН 1187746218923') +
    para(SECTION_13.extraCustomerParaIds[0], 'ООО «ВЗЛЕТ», ОГРН 1177746058610') +
    para(SECTION_17.nearby, 'Это описание по сторонам света берем из п.3.2 Программы. К северу пример.') +
    para(SECTION_17.waterObject, 'Обязательно проверить водные объекты.') +
    para(SECTION_17.building, '(При обследовании здания) На участке расположено здание.') +
    para(SECTION_17.openGround, 'Площадь поверхности открытого грунта на участке составляет около 15 %.') +
    para(SECTION_17.figure11, 'Рисунок 1.1 − Схема (выполняется в SAS.Planet - граница красным)') +
    para(SECTION_17.figure12, 'Рисунок 1.2 − Схема (выполняется в Google Земля - граница желтым)') +
    para(SECTION_17.figure13, 'Рисунок 1.3 – Фасад обследуемого здания; вид с северо-запада на юго-восток') +
    para(SECTION_17.figure13Image, '') +
    '</w:document>'
  );
}

test('report iei text helpers', () => {
  expect(buildReportCipher('801-67-26')).toBe('801-67-26-ИЭИ');
  expect(stageSubtitleFromSurveyStage(baseData.surveyStage)).toBe(
    'для подготовки проектной документации',
  );
  expect(isMoscowAddress('г. Москва, ул. Лесная')).toBe(true);
  expect(isLandscapingOnly('Комплексное развитие территории и их благоустройство')).toBe(true);
  expect(isLandscapingOnly('Реконструкция')).toBe(false);
  expect(buildUrbanPlanningSentence('Реконструкция')).toBe(
    'Вид градостроительной деятельности – реконструкция.',
  );
  expect(
    buildUrbanPlanningSentence('Архитектурно-строительное проектирование, реконструкция'),
  ).toBe(
    'Вид градостроительной деятельности – архитектурно-строительное проектирование, реконструкция.',
  );
  expect(buildContractSentence('ООО «Тест»')).toContain('ООО «Тест»');
  expect(buildIntroObjectSentence('Объект А')).toContain('«Объект А»');
  expect(buildDatesSentence('в мае 2026 г.', 'в июне 2026')).toContain('мае 2026');
  expect(buildDatesSentence('в апреле 2026 г.', 'в августе 2026')).toBe(
    'Полевые работы выполнены в апреле 2026 г. Камеральные работы выполнены в августе 2026.',
  );
  expect(buildDatesSentence('', '')).not.toContain('мае');
  expect(buildDatesSentence('', '')).not.toContain('июне');
  expect(buildLocationSentence('г. Москва, ул. Лесная, д. 1')).toContain('по адресу:');
  expect(buildSiteAreaText('0,77 га')).toBe('Площадь участка изысканий около 0,77 га');
  expect(buildOpenGroundText(20, false)).toContain('около 20 %');
  expect(buildOpenGroundText(20, false)).not.toContain('занята строением');
  expect(
    extractLandUseZoneFromTz(
      'Территория изысканий расположена в зоне жилой застройки. Площадь 0,5 га.',
    ),
  ).toBe('зоне жилой застройки');
  expect(
    extractLandUseZoneFromTz(
      'Участок расположен в многофункциональной общественной зоне, кадастр 77:01.',
    ),
  ).toBe('многофункциональной общественной зоне');
  expect(
    extractLandUseZoneFromTz('Зона использования территории: производственной зоне.'),
  ).toBe('производственной зоне');
  expect(extractLandUseZoneFromTz('Площадь участка 0,5 га. Заказчик ООО «Тест».')).toBe('');
  expect(formatInventoryNumber('')).toBe('');
  expect(formatInventoryNumber(' 784 ')).toBe('Инв. № 784');
  expect(formatInventoryNumber('Инв. № 784')).toBe('Инв. № 784');
  expect(hasMedBuildingAndEroa('МЭДзд, ЭРОА радона в здании')).toBe(true);
  expect(hasMedBuildingAndEroa('радиометрическое обследование здания и ЭРОА')).toBe(true);
  expect(hasMedBuildingAndEroa('только ЭРОА радона')).toBe(false);
  expect(hasMedBuildingAndEroa('МЭД территории')).toBe(false);
});

test('fillReportIeiTitle: имя, шифр, том, без пометки 7.1', () => {
  const xml = fillReportIeiTitle(sampleXml(), baseData);
  expect(paraText(xml, TITLE.objectName)).toBe(baseData.objectName);
  expect(paraText(xml, TITLE.cipher)).toBe('801-67-26-ИЭИ');
  expect(paraText(xml, TITLE.volume)).toBe('Том 1.3.1');
  expect(paraText(xml, TITLE.program71Note)).toBeNull();
  expect(paraText(xml, TITLE.stageSubtitle)).toBe('для подготовки проектной документации');
  expect(paraText(xml, TITLE.inventoryNumber)).toBe('');
  expect(xml).not.toContain('000123');
});

test('fillReportIeiTitle сохраняет sz из run с атрибутами, не ставит 24', () => {
  const xml =
    `<w:p w14:paraId="${TITLE.objectName}">` +
    `<w:pPr><w:rPr><w:sz w:val="32"/></w:rPr></w:pPr>` +
    `<w:r w:rsidRPr="004D4E01"><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>` +
    `<w:t>Название объекта</w:t></w:r></w:p>` +
    `<w:p w14:paraId="${TITLE.stageSubtitle}"><w:r w:rsidR="1"><w:rPr><w:sz w:val="32"/></w:rPr>` +
    `<w:t>для подготовки проектной документации</w:t></w:r></w:p>` +
    `<w:p w14:paraId="${TITLE.program71Note}"><w:r><w:t>(из п. 7.1 Программы)</w:t></w:r></w:p>` +
    `<w:p w14:paraId="${TITLE.cipher}"><w:r w:rsidR="2"><w:rPr><w:sz w:val="32"/></w:rPr>` +
    `<w:t>52015-20-01-77-ИЭИ</w:t></w:r></w:p>` +
    `<w:p w14:paraId="${TITLE.volume}"><w:r w:rsidR="3"><w:rPr><w:sz w:val="32"/></w:rPr>` +
    `<w:t>Том 1.3.1</w:t></w:r></w:p>`;
  const out = fillReportIeiTitle(xml, baseData);
  const objectPara = out.match(new RegExp(`<w:p[^>]*w14:paraId="${TITLE.objectName}"[^>]*>[\\s\\S]*?</w:p>`))?.[0] || '';
  expect(objectPara).toContain('w:val="28"');
  expect(objectPara).toContain('<w:b/>');
  expect(objectPara).not.toContain('w:val="24"');
  expect(paraText(out, TITLE.stageSubtitle)).toBe('для подготовки проектной документации');
});

test('fillReportIeiSection1: два вида из ТЗ оба в абзаце', () => {
  const xml = fillReportIeiSection1(sampleXml(), {
    ...baseData,
    urbanPlanningActivity: 'Архитектурно-строительное проектирование, реконструкция',
  });
  const sentence = paraText(xml, INTRO.urbanPlanning) || '';
  expect(sentence).toContain('архитектурно-строительное проектирование, реконструкция');
  expect(sentence).not.toMatch(/архитектурно-строительное проектирование\.?$/);
});

test('fillReportIeiSection1: заказчик один, rename и здание удалены, 384 очищен', () => {
  const xml = fillReportIeiSection1(sampleXml(), baseData);
  expect(paraText(xml, INTRO.objectSentence)).toContain('ул. Лесная');
  expect(paraText(xml, INTRO.renameSentence)).toBeNull();
  expect(paraText(xml, INTRO.urbanPlanning)).toContain('архитектурно-строительное проектирование');
  expect(paraText(xml, SECTION_13.clientName)).toBe('ООО «Тест», ОГРН 1027739558714');
  expect(paraText(xml, SECTION_13.extraCustomerParaIds[0])).toBeNull();
  expect(paraText(xml, SECTION_12.techReglament384)).toBe(
    'Федеральный закон «Технический регламент о безопасности зданий и сооружений» № 384-ФЗ от 30.12.2009.',
  );
  expect(paraText(xml, SECTION_17.nearby)).toContain('ул. Лесная');
  expect(paraText(xml, SECTION_17.building)).toBeNull();
  expect(paraText(xml, SECTION_17.openGround)).toContain('около 20 %');
});

test('replaceParagraphTextKeepFormatting сохраняет drawing/pict и вложенный w:p', () => {
  const xml =
    `<w:p w14:paraId="DRAW1">` +
    `<w:pPr><w:jc w:val="center"/></w:pPr>` +
    `<w:r><w:rPr><w:sz w:val="28"/><w:highlight w:val="yellow"/></w:rPr><w:t>старый</w:t></w:r>` +
    `<w:r><w:drawing><w:txbxContent>` +
    `<w:p><w:r><w:t>боковик</w:t></w:r></w:p>` +
    `</w:txbxContent></w:drawing></w:r>` +
    `<w:r><w:pict><v:rect/></w:pict></w:r>` +
    `</w:p>`;
  const out = replaceParagraphTextKeepFormatting(xml, 'DRAW1', 'новый текст');
  expect(out).toContain('новый текст');
  expect(out).not.toContain('старый');
  expect(out).toContain('<w:drawing>');
  expect(out).toContain('</w:drawing>');
  expect(out).toContain('<w:txbxContent>');
  expect(out).toContain('боковик');
  expect(out).toContain('<w:pict>');
  expect(out).toContain('<v:rect/>');
  expect(out).toContain('w:val="28"');
  expect(out).not.toContain('w:highlight');
  expect(out.match(/<w:p[\s>]/g)?.length).toBe(2);
});

test('removeParagraphOnly не сносит абзац с якорем фигуры', () => {
  const xml =
    `<w:p w14:paraId="KEEPFIG"><w:r><w:drawing><wp:anchor/></w:drawing></w:r></w:p>` +
    `<w:p w14:paraId="DROPFIG"><w:r><w:t>убрать</w:t></w:r></w:p>`;
  const out = removeParagraphOnly(xml, 'KEEPFIG');
  expect(out).toContain('KEEPFIG');
  expect(out).toContain('<wp:anchor');
  expect(removeParagraphOnly(out, 'DROPFIG')).not.toContain('убрать');
});

test('removeParagraphOrContainingRow убирает строку таблицы, не ячейку без w:p', () => {
  const xml =
    `<w:tbl>` +
    `<w:tr><w:tc><w:p w14:paraId="KEEP1"><w:r><w:t>остаётся</w:t></w:r></w:p></w:tc></w:tr>` +
    `<w:tr><w:tc><w:p w14:paraId="DROP1"><w:r><w:t>лишний заказчик</w:t></w:r></w:p></w:tc></w:tr>` +
    `</w:tbl>`;
  const out = removeParagraphOrContainingRow(xml, 'DROP1');
  expect(out).toContain('остаётся');
  expect(out).not.toContain('лишний заказчик');
  expect(out).toContain('<w:tbl>');
  expect(out.match(/<w:tr[\s>]/g)?.length).toBe(1);
  expect(out).not.toMatch(/<w:tc\b[^>]*>\s*<\/w:tc>/);
});

test('fillReportIeiSection1: благоустройство удаляет 384-ФЗ', () => {
  const xml = fillReportIeiSection1(sampleXml(), { ...baseData, isLandscapingOnly: true });
  expect(paraText(xml, SECTION_12.techReglament384)).toBeNull();
});

test('fillReportIeiSection1: пустой clientInn не оставляет шаблонный ИНН 9717066587', () => {
  const xml =
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">' +
    para(SECTION_13.clientName, 'ООО «ТелекомКапСтрой», ОГРН 1187746218923') +
    para(SECTION_13.clientInn, 'ИНН 9717066587') +
    '</w:document>';
  const out = fillReportIeiSection1(xml, { ...baseData, clientInn: '' });
  expect(out).not.toContain('9717066587');
  expect(paraText(out, SECTION_13.clientInn)).toBe('');
  expect(paraText(out, SECTION_13.clientName)).toBe('ООО «Тест», ОГРН 1027739558714');
});

test('fillReportIeiSection1: Москва без проб воды снимает ИЛЦ ФБУЗ ЦГиЭ', () => {
  const xml =
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">' +
    para(SECTION_15_MOSCOW_LAB.name, 'ИЛЦ ФБУЗ ЦГиЭ в г.Москве') +
    para(SECTION_15_MOSCOW_LAB.number, 'RA.RU.21HH96') +
    para(SECTION_15_MOSCOW_LAB.url, 'https://pub.fsa.gov.ru/ral/view/32963/applicant') +
    '</w:document>';
  const out = fillReportIeiSection1(xml, { ...baseData, isMoscow: true, hasWaterSamples: false });
  expect(out).not.toContain('ИЛЦ ФБУЗ ЦГиЭ в г.Москве');
  expect(paraText(out, SECTION_15_MOSCOW_LAB.name)).toBeNull();
  expect(paraText(out, SECTION_15_MOSCOW_LAB.number)).toBeNull();
  expect(paraText(out, SECTION_15_MOSCOW_LAB.url)).toBeNull();
  expect(out).not.toContain('3858C0DE');
  expect(out).not.toContain('F159845D');
});

test('fillReportIeiSection1: Москва с пробами воды оставляет лабораторию воды', () => {
  const xml =
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">' +
    para(SECTION_15_MOSCOW_LAB.name, 'ИЛЦ ФБУЗ ЦГиЭ в г.Москве') +
    para(SECTION_15_MOSCOW_LAB.number, 'RA.RU.21HH96') +
    para(SECTION_15_MOSCOW_LAB.url, 'https://pub.fsa.gov.ru/ral/view/32963/applicant') +
    '</w:document>';
  const out = fillReportIeiSection1(xml, { ...baseData, isMoscow: true, hasWaterSamples: true });
  expect(paraText(out, SECTION_15_MOSCOW_LAB.name)).toBe('ИЛЦ ФБУЗ ЦГиЭ в г.Москве');
  expect(paraText(out, SECTION_15_MOSCOW_LAB.url)).toContain('32963');
});

test('fillReportIeiSection1: сроки заменяют разбитый шаблон май/июнь', () => {
  const xml =
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">' +
    `<w:p w14:paraId="${SECTION_11.dates}">` +
    `<w:r><w:t xml:space="preserve">Полевые работы выполнены </w:t></w:r>` +
    `<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>в мае 202</w:t></w:r>` +
    `<w:r><w:t>6</w:t></w:r>` +
    `<w:r><w:t xml:space="preserve"> г</w:t></w:r>` +
    `<w:r><w:t>. Камеральные работы выполнены в </w:t></w:r>` +
    `<w:r><w:t>июне 202</w:t></w:r>` +
    `<w:r><w:t>6</w:t></w:r>` +
    `<w:r><w:t>.</w:t></w:r>` +
    `</w:p>` +
    '</w:document>';
  const out = fillReportIeiSection1(xml, {
    ...baseData,
    fieldWorkPeriod: 'в апреле 2026 г.',
    cameralWorkPeriod: 'в августе 2026',
  });
  expect(paraText(out, SECTION_11.dates)).toBe(
    'Полевые работы выполнены в апреле 2026 г. Камеральные работы выполнены в августе 2026.',
  );
  expect(out).not.toContain('мае 202');
  expect(out).not.toContain('июне 202');
});

test('fillReportIeiSection1: пустые zone/fence не оставляют шаблонные фразы', () => {
  const xml =
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">' +
    para(
      SECTION_17.landUseZone,
      'Территория изысканий расположена в многофункциональной общественной зоне.',
    ) +
    para(
      SECTION_17.fence,
      'Рельеф участка выровненный, искусственно спланированный (см. Рисунок 1.4). Участок изысканий обнесен бетонным и металлическим забором, охраняется, оборудован системой уличного освещения.',
    ) +
    '</w:document>';
  const out = fillReportIeiSection1(xml, {
    ...baseData,
    landUseZone: '',
    siteFenceText: '',
  });
  expect(out).not.toContain('многофункциональной общественной зоне');
  expect(out).not.toContain('обнесен бетонным и металлическим забором');
  expect(paraText(out, SECTION_17.landUseZone)).toBeNull();
  expect(paraText(out, SECTION_17.fence)).toBe(
    'Рельеф участка выровненный, искусственно спланированный (см. Рисунок 1.4).',
  );
});

function staffTableXml(): string {
  const rows = REPORT_IEI_STAFF.map(
    (person) =>
      `<w:tr><w:tc><w:p w14:paraId="${person.nameId}"><w:r><w:t>${person.name}</w:t></w:r></w:p></w:tc></w:tr>`,
  ).join('');
  return (
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">' +
    para(SECTION_16.heading, 'Состав исполнителей') +
    para(SECTION_16.headerFio, 'ФИО') +
    `<w:tbl><w:tblPr/><w:tr><w:tc>${para(SECTION_16.headerFio, 'ФИО')}</w:tc></w:tr>${rows}</w:tbl>` +
    '</w:document>'
  );
}

test('fillReportIeiSection1: пустой состав исполнителей убирает шаблонные ФИО', () => {
  const out = fillReportIeiSection1(staffTableXml(), { ...baseData, executorNames: [] });
  expect(paraText(out, SECTION_16.heading)).toBe('Состав исполнителей');
  expect(paraText(out, SECTION_16.headerFio)).toBe('ФИО');
  for (const person of REPORT_IEI_STAFF) {
    expect(out).not.toContain(person.name);
    expect(paraText(out, person.nameId)).toBeNull();
  }
});

test('fillReportIeiTitle: инв. номер пишется, пустой стирает пример', () => {
  const withNumber = fillReportIeiTitle(sampleXml(), { ...baseData, inventoryNumber: '784' });
  expect(paraText(withNumber, TITLE.inventoryNumber)).toBe('Инв. № 784');
  const empty = fillReportIeiTitle(sampleXml(), { ...baseData, inventoryNumber: '' });
  expect(paraText(empty, TITLE.inventoryNumber)).toBe('');
  expect(empty).not.toContain('000123');
});

test('fillReportIeiSection1: здание остаётся только при обследовании и описании', () => {
  const withBuilding = fillReportIeiSection1(sampleXml(), {
    ...baseData,
    hasBuildingSurvey: true,
    buildingDescription: 'Кирпичное здание без подвала.',
  });
  expect(paraText(withBuilding, SECTION_17.building)).toBe('Кирпичное здание без подвала.');
  const noDesc = fillReportIeiSection1(sampleXml(), {
    ...baseData,
    hasBuildingSurvey: true,
    buildingDescription: '',
  });
  expect(paraText(noDesc, SECTION_17.building)).toBeNull();
});

test('fillReportIeiSection1: фото фасада — подпись только если есть фото', () => {
  const without = fillReportIeiSection1(sampleXml(), { ...baseData, hasFacadePhoto: false });
  expect(paraText(without, SECTION_17.figure13)).toBeNull();
  expect(without).not.toContain('Фасад обследуемого здания');
  expect(paraText(without, SECTION_17.figure11)).toBe(
    'Рисунок 1.1 − Схема расположения территории изысканий',
  );
  expect(paraText(without, SECTION_17.figure12)).toBe('Рисунок 1.2 − Схема территории изысканий');
  expect(without).not.toContain('SAS.Planet');
  expect(without).not.toContain('Google Земля');

  const withPhoto = fillReportIeiSection1(sampleXml(), { ...baseData, hasFacadePhoto: true });
  expect(paraText(withPhoto, SECTION_17.figure13)).toBe('Рисунок 1.3 – Фасад обследуемого здания');
});

test('fillReportIeiSection1: выбранные исполнители остаются, остальные удаляются', () => {
  const out = fillReportIeiSection1(staffTableXml(), {
    ...baseData,
    executorNames: ['Штефанова У.Н.', 'Ермолов Т.А.'],
  });
  expect(paraText(out, '6EA215B3')).toBe('Штефанова У.Н.');
  expect(paraText(out, 'BDB2AFDC')).toBe('Ермолов Т.А.');
  expect(out).not.toContain('Матвеева Т.С.');
  expect(out).not.toContain('Гасилин П.В.');
  expect(out).not.toContain('Иванов И.И.');
});

test('fillReportIeiSection1: неизвестное ФИО не попадает в документ', () => {
  const out = fillReportIeiSection1(staffTableXml(), {
    ...baseData,
    executorNames: ['Иванов И.И.'],
  });
  expect(out).not.toContain('Иванов И.И.');
  expect(out).not.toContain('Матвеева Т.С.');
});

test('insertDrawingIntoParagraph вставляет drawing, removeParagraphIncludingMedia убирает пример', () => {
  const xml =
    `<w:p w14:paraId="${SECTION_17.figure13Image}"><w:pPr><w:jc w:val="center"/></w:pPr></w:p>` +
    `<w:p w14:paraId="EXIMG"><w:r><w:drawing><wp:inline/></w:drawing></w:r></w:p>`;
  const withImg = insertDrawingIntoParagraph(
    xml,
    SECTION_17.figure13Image,
    '<w:r><w:drawing><wp:inline/></w:drawing></w:r>',
  );
  expect(withImg).toContain('w14:paraId="CC2C6422"');
  expect(withImg).toContain('<w:drawing>');
  expect(removeParagraphOnly(xml, 'EXIMG')).toContain('EXIMG');
  expect(removeParagraphIncludingMedia(xml, 'EXIMG')).not.toContain('EXIMG');
});

test('fitTableToContentWidth: tblInd+grid 10456 сжимается до 10370', () => {
  const tbl =
    '<w:tbl>' +
    '<w:tblPr><w:tblW w:w="9922" w:type="dxa"/><w:tblInd w:w="534" w:type="dxa"/></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="2454"/><w:gridCol w:w="7468"/></w:tblGrid>' +
    '<w:tr><w:tc><w:tcPr><w:tcW w:w="2454" w:type="dxa"/></w:tcPr><w:p/></w:tc>' +
    '<w:tc><w:tcPr><w:tcW w:w="7468" w:type="dxa"/></w:tcPr><w:p/></w:tc></w:tr>' +
    '</w:tbl>';
  expect(tableOccupiedWidth(tbl)).toBe(10456);
  const fitted = fitTableToContentWidth(tbl, 10370);
  expect(tableOccupiedWidth(fitted)).toBeLessThanOrEqual(10370);
  expect(fitted).toContain('w:tblInd');
  expect(fitted).toContain('w:tblW');
  expect(fitted).toContain('w:gridCol');
});
