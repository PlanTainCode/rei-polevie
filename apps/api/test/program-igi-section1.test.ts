import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import PizZip from 'pizzip';
import {
  applyProgramIeiApprovalHeaders,
  replaceProgramIgiTitleSignatories,
} from '../src/modules/word/program-iei/title-signatories';
import {
  extractGoalsTextFromSection1,
  fillProgramIgiSection1,
  findSection1Bounds,
  hasGeologicalGoals,
  omitDemolitionPhrases,
  replaceTitleObjectName,
} from '../src/modules/word/program-igi/section-1';

function visibleText(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('');
}

function plain(s: string): string {
  return [...s.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

async function loadSampleXml(): Promise<string> {
  const path = join(import.meta.dir, 'fixtures', 'program-igi-sample.docx');
  const zip = new PizZip(await readFile(path));
  return zip.file('word/document.xml')?.asText() || '';
}

function section1Rows(xml: string): { cells: number; texts: string[] }[] {
  const bounds = findSection1Bounds(xml)!;
  const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  const rows: { cells: number; texts: string[] }[] = [];
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(xml)) !== null) {
    if (match.index > bounds.end) break;
    if (match.index + match[0].length < bounds.start) continue;
    const cells = [...match[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)];
    rows.push({
      cells: cells.length,
      texts: cells.map((c) => plain(c[0]).replace(/\s+/g, ' ').trim().slice(0, 40)),
    });
  }
  return rows;
}

test('omitDemolitionPhrases убирает фразы про демонтаж в 1.9.1/1.9.2', () => {
  const tech = omitDemolitionPhrases(
    [
      'прокладка телефонной канализации (общая протяженность около 100,4 м) и обустройство телефонных колодцев;',
      'демонтаж телефонной канализации (общая протяженность около 79,5 м). Демонтируемые кабели отключаются и извлекаются, трубы извлекаются;',
      'демонтаж телефонных колодцев.',
    ].join('\n'),
  );
  expect(tech).toEqual([
    'прокладка телефонной канализации (общая протяженность около 100,4 м) и обустройство телефонных колодцев',
  ]);

  const depth = omitDemolitionPhrases(
    'прокладка телефонной канализации: открытым способом – 0,5-1,5 м; колодцев –1,7-2,3 м;\nдемонтаж телефонных колодцев - max до 2,0 м.',
  );
  expect(depth.join('; ')).toBe(
    'прокладка телефонной канализации: открытым способом – 0,5-1,5 м; колодцев –1,7-2,3 м',
  );
});

test('findSection1Bounds находит Общие сведения → Изученность', async () => {
  const xml = await loadSampleXml();
  const bounds = findSection1Bounds(xml);
  expect(bounds).not.toBeNull();
  expect(visibleText(xml.slice(bounds!.start, bounds!.end))).toContain('Наименование объекта');
});

test('hasGeologicalGoals и extractGoals из sample', async () => {
  const xml = await loadSampleXml();
  const goals = extractGoalsTextFromSection1(xml);
  expect(hasGeologicalGoals(goals)).toBe(true);
  expect(goals).toContain('инженерно-геологических');
});

test('fillProgramIgiSection1 меняет значения и сохраняет 3-колоночные строки', async () => {
  const xml = await loadSampleXml();
  const afterMarker = 'Бурение скважин';
  expect(visibleText(xml)).toContain(afterMarker);

  const beforeRows = section1Rows(xml);
  const nameRowBefore = beforeRows.find((r) => r.texts.some((t) => t.includes('Наименование объекта')));
  expect(nameRowBefore?.cells).toBe(3);

  const filled = fillProgramIgiSection1(xml, {
    objectName: 'ТЕСТОВЫЙ ОБЪЕКТ ИГИ',
    objectLocation: 'г. Москва, тестовый адрес',
    clientNameLine: 'ООО «Тест», ОГРН 123',
    clientAddressLine: 'г. Москва, ул. Тестовая, 1',
    clientContactLines: ['Иванов И.И.', '+79990001122'],
    executorNameLine: 'АО «РЭИ-ЭКОАУДИТ», ОГРН 1037789070153',
    executorAddressLine: '117513, Город Москва',
    goalsAndTasks: null,
    objectPurpose: 'Инженерные сети',
    transportInfrastructure: 'Нет',
    hazardousProduction: 'Нет',
    fireHazard: 'Нет данных',
    responsibilityLevel: 'Нормальный',
    permanentOccupancy: 'Отсутствуют',
    urbanPlanningActivity: 'Реконструкция',
    surveyStage: 'Инженерные изыскания для подготовки проектной документации',
    technicalCharacteristics: 'Тестовая теххарактеристика',
    excavationDepth: 'до 2,0 м',
    siteDescription: 'Площадь участка – около 0,1 га.',
    egrnLines: ['Кадастровый квартал 77:01:0000000', 'Земли населённых пунктов'],
  });

  const text = visibleText(filled);
  expect(text).toContain('ТЕСТОВЫЙ ОБЪЕКТ ИГИ');
  expect(text).toContain('г. Москва, тестовый адрес');
  expect(text).toContain('Реконструкция');
  expect(text).toContain('инженерно-геологических');
  expect(text).toContain(afterMarker);

  const afterRows = section1Rows(filled);
  const nameRow = afterRows.find((r) => r.texts.some((t) => t.includes('Наименование объекта')));
  const locRow = afterRows.find((r) => r.texts.some((t) => t.includes('Местоположение объекта')));
  expect(nameRow?.cells).toBe(3);
  expect(locRow?.cells).toBe(3);
  // Не должно склеивать метки в одну строку
  expect(nameRow?.texts.join('|')).not.toContain('Местоположение');
});

test('replaceProgramIgiTitleSignatories сохраняет шапку и ставит подписантов из ТЗ', async () => {
  const xml = await loadSampleXml();
  expect(xml.includes('a:blip') || xml.includes('w:drawing')).toBe(true);

  const signatories = applyProgramIeiApprovalHeaders([
    {
      header: 'СОГЛАСОВАНО',
      label: 'Технический заказчик',
      position: 'Директор',
      organization: 'ПАО «МГТС»',
      name: 'Д.П. Кондратов',
      basis: '',
    },
    {
      header: 'СОГЛАСОВАНО',
      label: 'Проектировщик',
      position: 'Зам. ген. директора',
      organization: 'ООО «ТелекомКапСтрой»',
      name: 'А.В.Пономарёв',
      basis: '',
    },
    {
      header: 'УТВЕРЖДАЮ',
      label: 'Исполнитель',
      position: 'Директор',
      organization: 'АО «РЭИ-ЭКОАУДИТ»',
      name: 'М.А.Маренный',
      basis: '',
    },
    {
      header: 'СОГЛАСОВАНО',
      label: 'Заказчик',
      position: 'Генеральный директор',
      organization: 'ООО «ТЕЛЕСИТИ-ИНЖИНИРИНГ»',
      name: 'К.А.Белов',
      basis: '',
    },
  ]);

  const updated = replaceProgramIgiTitleSignatories({
    xml,
    signatories,
    contractorRole: 'Исполнитель',
  });
  const withName = replaceTitleObjectName(updated, 'ОБЪЕКТ НА ТИТУЛЕ');
  const titleText = visibleText(withName).slice(
    0,
    visibleText(withName).indexOf('Общие сведения'),
  );

  // Шапка на месте
  expect(withName.includes('a:blip') || withName.includes('w:drawing')).toBe(true);
  expect(titleText).toMatch(/РЭИ-ЭКОА[Уу]дит/i);
  expect(titleText).toMatch(/СРО|Ассоциация|Центризыскан/i);

  // Подписанты из ТЗ, не старые «Подрядчик/Исполнитель» из sample без проектировщика
  expect(titleText).toContain('ПАО «МГТС»');
  expect(titleText).toContain('ТелекомКапСтрой');
  expect(titleText).toContain('ТЕЛЕСИТИ-ИНЖИНИРИНГ');
  expect(titleText).toContain('УТВЕРЖДАЮ');
  expect(titleText).toContain('ОБЪЕКТ НА ТИТУЛЕ');
  expect(titleText).toContain('инженерно-геологических изысканий');

  const openTbl = (withName.match(/<w:tbl(?:\s|>)/g) || []).length;
  const closeTbl = (withName.match(/<\/w:tbl>/g) || []).length;
  expect(openTbl).toBe(closeTbl);
});
