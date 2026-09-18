import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PizZip from 'pizzip';
import { fillReportIeiHeaderFooter, generateReportIeiDocx } from '../src/modules/word/report-iei/generate';
import {
  findTopLevelTables,
  introSection1Range,
  REPORT_IEI_BODY_CONTENT_WIDTH,
  tableOccupiedWidth,
} from '../src/modules/word/report-iei/fit-tables';
import { INTRO, SECTION_11, SECTION_13, SECTION_15_MOSCOW_LAB, SECTION_16, SECTION_17, SECTION_2, SECTION_3, TITLE } from '../src/modules/word/report-iei/ids';
import { NO_CGMS_CLIMATE_TEXT, NO_OOPT_HEADING, NO_OOPT_TEXT } from '../src/modules/word/report-iei/text';
import { REPORT_IEI_STAFF } from '../src/modules/word/report-iei/staff';
import { emptyReportIeiSection3Fields, type ReportIeiFillData } from '../src/modules/word/report-iei/types';

function paraText(xml: string, paraId: string): string | null {
  const match = xml.match(new RegExp(`<w:p[^>]*w14:paraId="${paraId}"[^>]*>([\\s\\S]*?)</w:p>`));
  if (!match) return null;
  return [...match[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

const data: ReportIeiFillData = {
  objectName: 'Реконструкция здания по адресу: г. Москва, ул. Лесная, д. 1',
  surveyStage: 'Инженерные изыскания для подготовки проектной документации',
  urbanPlanningActivity: 'Реконструкция',
  clientName: 'ООО «Тест»',
  clientOgrn: '1027739558714',
  clientAddress: '125130, г.Москва, ул.Тестовая, д.1',
  fieldWorkPeriod: 'в апреле 2026 г.',
  cameralWorkPeriod: 'в августе 2026',
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
  technicalCharacteristics: 'Реконструкция существующего здания.',
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

test('generateReportIeiDocx заполняет титул и §1 в боевом шаблоне', () => {
  const template = readFileSync(join(process.cwd(), 'templates/отчет-иэи/Шаблон отчета по ИЭИ.docx'));
  const out = generateReportIeiDocx(template, data);
  const xml = new PizZip(out).file('word/document.xml')!.asText();

  expect(paraText(xml, TITLE.objectName)).toBe(data.objectName);
  expect(paraText(xml, TITLE.cipher)).toBe('801-67-26-ИЭИ');
  expect(paraText(xml, TITLE.program71Note)).toBeNull();
  expect(xml).toContain('ТЕХНИЧЕСКИЙ');
  expect(xml).toContain('по результатам инженерно-экологических изысканий');
  expect(paraText(xml, TITLE.stageSubtitle)).toContain('для подготовки проектной документации');
  const objectPara = xml.match(
    new RegExp(`<w:p[^>]*w14:paraId="${TITLE.objectName}"[^>]*>[\\s\\S]*?</w:p>`),
  )?.[0] || '';
  expect(objectPara).toContain('w:val="28"');
  expect(objectPara).not.toContain('w:val="24"');
  const volumePara = xml.match(
    new RegExp(`<w:p[^>]*w14:paraId="${TITLE.volume}"[^>]*>[\\s\\S]*?</w:p>`),
  )?.[0] || '';
  expect(volumePara).toContain('w:val="32"');
  expect(paraText(xml, SECTION_11.dates)).toBe(
    'Полевые работы выполнены в апреле 2026 г. Камеральные работы выполнены в августе 2026.',
  );
  expect(paraText(xml, SECTION_11.dates)).not.toContain('мае');
  expect(paraText(xml, SECTION_11.dates)).not.toContain('июне');
  expect(paraText(xml, INTRO.objectSentence)).toContain('ул. Лесная');
  expect(paraText(xml, INTRO.renameSentence)).toBeNull();
  expect(paraText(xml, INTRO.urbanPlanning)).toContain('реконструкция');
  expect(paraText(xml, SECTION_13.clientName)).toBe('ООО «Тест», ОГРН 1027739558714');
  expect(paraText(xml, SECTION_13.extraCustomerParaIds[0])).toBeNull();
  expect(paraText(xml, SECTION_17.nearby)).toContain('ул. Лесная');
  expect(paraText(xml, SECTION_17.building)).toBeNull();
  expect(paraText(xml, SECTION_15_MOSCOW_LAB.name)).toBeNull();
  expect(paraText(xml, SECTION_15_MOSCOW_LAB.url)).toBeNull();
  expect(xml).not.toContain('w14:paraId="F159845D"');
  expect(xml).not.toContain('w14:paraId="3858C0DE"');
  expect(xml).not.toMatch(/ИЛЦ[\s\u00a0]*ФБУЗ[\s\u00a0]*ЦГиЭ[\s\u00a0]*в г\.Москве/);
  expect(xml).toContain('w14:paraId="AD038C54"');

  const zip = new PizZip(out);
  const orig = new PizZip(template);
  const headerFooterParts = Object.keys(orig.files)
    .filter((name) => /^word\/(header|footer)\d+\.xml$/.test(name))
    .sort();
  expect(headerFooterParts.length).toBeGreaterThan(0);
  for (const part of headerFooterParts) {
    expect(zip.file(part)!.asText()).toBe(orig.file(part)!.asText());
  }
  const footer1 = zip.file('word/footer1.xml')!.asText();
  expect(footer1).toContain('w:textDirection');
  expect(footer1).toContain('Взам');
  expect(footer1).toContain('Инв. № подл.');
  expect(zip.file('word/header1.xml')!.asText()).toContain('v:rect');
  expect(zip.file('word/settings.xml')!.asText()).toContain('displayBackgroundShape');

  const origDoc = orig.file('word/document.xml')!.asText();
  const pgMar = (s: string) => [...s.matchAll(/<w:pgMar\b[^/]*\/>/g)].map((m) => m[0]);
  expect(pgMar(xml)).toEqual(pgMar(origDoc));
  const titleTbl = (s: string) => {
    const t = s.slice(s.indexOf('<w:tbl'), s.indexOf('</w:tbl>') + 8);
    return {
      w: t.match(/<w:tblW [^>]*>/)?.[0],
      ind: t.match(/<w:tblInd [^>]*>/)?.[0],
      grid: [...t.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => m[1]).join(','),
      drawings: (t.match(/<w:drawing\b/g) || []).length,
    };
  };
  expect(titleTbl(xml)).toEqual(titleTbl(origDoc));
  expect((xml.match(/<w:commentRangeStart\b/g) || []).length).toBe(
    (xml.match(/<w:commentRangeEnd\b/g) || []).length,
  );
  expect((xml.match(/<w:drawing\b/g) || []).length).toBeLessThanOrEqual(
    (origDoc.match(/<w:drawing\b/g) || []).length,
  );
  expect((xml.match(/<w:pict\b/g) || []).length).toBeLessThanOrEqual(
    (origDoc.match(/<w:pict\b/g) || []).length,
  );

  const cellsWithoutP = [...xml.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].filter(
    (m) => !/<w:p[\s/>]/.test(m[0]),
  );
  expect(cellsWithoutP.length).toBe(0);

  const range = introSection1Range(xml);
  expect(range).not.toBeNull();
  const introTables = findTopLevelTables(xml).filter(
    (t) => t.start >= range!.start && t.start < range!.end,
  );
  expect(introTables.length).toBeGreaterThan(0);
  for (const table of introTables) {
    expect(tableOccupiedWidth(xml.slice(table.start, table.end))).toBeLessThanOrEqual(
      REPORT_IEI_BODY_CONTENT_WIDTH,
    );
  }
  expect(paraText(xml, SECTION_16.heading)).toBe('Состав исполнителей');
  expect(paraText(xml, SECTION_16.headerFio)).toBe('ФИО');
  for (const person of REPORT_IEI_STAFF) {
    expect(paraText(xml, person.nameId)).toBeNull();
  }
  expect(paraText(xml, TITLE.inventoryNumber) || '').toBe('');
  expect(paraText(xml, SECTION_17.figure13)).toBeNull();
  expect(paraText(xml, SECTION_17.figure11)).toBe(
    'Рисунок 1.1 − Схема расположения территории изысканий',
  );
  expect(paraText(xml, SECTION_17.figure12)).toBe('Рисунок 1.2 − Схема территории изысканий');
  expect(paraText(xml, SECTION_2.noCgmsClimate)).toBe(NO_CGMS_CLIMATE_TEXT);
  expect(xml).not.toContain('Игральная');
  expect(xml).not.toContain('Немчиновка');
  expect(xml).not.toContain('Стандарт Геострой');
  expect(paraText(xml, SECTION_2.moSources)).toBeNull();
  expect(paraText(xml, SECTION_2.moClimate)).toBeNull();
  expect(paraText(xml, SECTION_2.weatherStationFromCertificate)).toBeNull();
  expect(paraText(xml, SECTION_2.climateMaxTemp) || '').toBe('');
  expect(paraText(xml, SECTION_3.igiGeomorphology)).toBeNull();
  expect(paraText(xml, SECTION_3.ooptHeading)).toBe(NO_OOPT_HEADING);
  expect(paraText(xml, SECTION_3.ooptBody[0])).toBe(NO_OOPT_TEXT);
  expect(paraText(xml, SECTION_3.ooptBody[0])).not.toContain('Москворецкий');
  expect(paraText(xml, SECTION_3.igiSoils)).toBeNull();
  expect(paraText(xml, SECTION_3.fertilitySkip)).toBeNull();
  expect(paraText(xml, SECTION_3.geobotanyFromAct)).toBeNull();
  expect(paraText(xml, SECTION_3.moEcologyLetter)).toBeNull();
  expect(xml).not.toContain('Ходынской');
  expect(xml).not.toContain('Карачаровский');
  expect(xml).not.toContain('24Исх-10640');

  const section1 = introSection1Range(xml);
  expect(section1).not.toBeNull();
  const body = xml.slice(section1!.start, section1!.end);
  expect(body).not.toContain('SAS.Planet');
  expect(body).not.toContain('Google Земля');
  expect(body).not.toContain('Фасад обследуемого здания');
  expect(body).not.toContain('кирпичное двухэтажное');
  expect(body).not.toContain('Нагатино-Садовники');
  expect(body).not.toContain('Брынцалов');
  expect(body).not.toContain('ТелекомКапСтрой');
  expect(body).not.toContain('ГВИН-ПИН');
  expect(body).not.toContain('Иванов');
}, 30000);

test('generateReportIeiDocx вставляет фото фасада при обследовании', () => {
  const template = readFileSync(join(process.cwd(), 'templates/отчет-иэи/Шаблон отчета по ИЭИ.docx'));
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154085b63f8cfc000000301010067a7975d0000000049454e44ae426082',
    'hex',
  );
  const out = generateReportIeiDocx(
    template,
    { ...data, hasBuildingSurvey: true, hasFacadePhoto: true },
    { facadePhoto: { buffer: png, ext: 'png' } },
  );
  const zip = new PizZip(out);
  const xml = zip.file('word/document.xml')!.asText();
  expect(paraText(xml, SECTION_17.figure13)).toBe('Рисунок 1.3 – Фасад обследуемого здания');
  expect(xml).toContain('report-iei-facade.png');
  expect(zip.file('word/media/report-iei-facade.png')).toBeTruthy();
}, 30000);

test('generateReportIeiDocx пишет инв. номер на титул', () => {
  const template = readFileSync(join(process.cwd(), 'templates/отчет-иэи/Шаблон отчета по ИЭИ.docx'));
  const out = generateReportIeiDocx(template, { ...data, inventoryNumber: '784' });
  const xml = new PizZip(out).file('word/document.xml')!.asText();
  expect(paraText(xml, TITLE.inventoryNumber)).toBe('Инв. № 784');
  const origFooter = new PizZip(template).file('word/footer1.xml')!.asText();
  expect(new PizZip(out).file('word/footer1.xml')!.asText()).toBe(origFooter);
}, 30000);

test('fillReportIeiHeaderFooter не принимает w:tbl за w:t', () => {
  const xml =
    `<w:ftr>` +
    `<w:tbl><w:tr><w:tc>` +
    `<w:p><w:r><w:t>Взам. инв. №</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>52015-20-01-77-ИЭИ</w:t></w:r></w:p>` +
    `</w:tc></w:tr></w:tbl>` +
    `</w:ftr>`;
  const out = fillReportIeiHeaderFooter(xml, data);
  expect(out).toContain('<w:tbl>');
  expect(out).toContain('</w:tbl>');
  expect(out).toContain('<w:tc>');
  expect(out).toContain('Взам. инв. №');
  expect(out).toContain('801-67-26-ИЭИ');
  expect(out).not.toContain('52015-20-01-77-ИЭИ');
});

test('fillReportIeiHeaderFooter не режет вложенный w:p в textbox', () => {
  const xml =
    `<w:hdr>` +
    `<w:p><w:r><w:drawing><w:txbxContent>` +
    `<w:p><w:r><w:t>№ 52015-20-01-77-ИЭИ</w:t></w:r></w:p>` +
    `</w:txbxContent></w:drawing></w:r></w:p>` +
    `</w:hdr>`;
  const out = fillReportIeiHeaderFooter(xml, data);
  expect(out).toContain('<w:txbxContent>');
  expect(out).toContain('</w:txbxContent>');
  expect(out).toContain('№ 801-67-26-ИЭИ');
  expect(out.match(/<w:p>/g)?.length).toBe(2);
});
