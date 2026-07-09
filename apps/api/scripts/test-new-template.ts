/**
 * Smoke-тест адаптации генерации «Программа ИЭИ» под актуальный шаблон.
 * Прогоняет чистые replace-функции секций на новом document.xml и проверяет,
 * что каждая замена реально сработала (а не тихо стала no-op).
 *
 * Запуск: bun run apps/api/scripts/test-new-template.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import PizZip from 'pizzip';

import {
  extractProgramIeiSection42Table,
  applyProgramIeiSection42TableFiltering,
} from '../src/modules/word/program-iei/section-42';
import {
  applyProgramIeiSection42NaturalConditionsTop10,
} from '../src/modules/word/program-iei/section-42-natural-conditions';
import { replaceProgramIeiSection43Block } from '../src/modules/word/program-iei/section-43';
import { replaceProgramIeiSection44Block } from '../src/modules/word/program-iei/section-44';
import { replaceProgramIeiSection45Block } from '../src/modules/word/program-iei/section-45';
import { replaceProgramIeiSection47Block } from '../src/modules/word/program-iei/section-47';
import { replaceProgramIeiSection72Block } from '../src/modules/word/program-iei/section-72';
import {
  removeCystsFromLine,
} from '../src/modules/ai/program-iei/bio-contamination-line';

const TEMPLATE = join(process.cwd(), 'templates', 'Программа ИЭИ актуальная.docx');

let failures = 0;
const check = (name: string, cond: boolean, extra = '') => {
  const mark = cond ? '✅' : '❌';
  if (!cond) failures += 1;
  console.log(`  ${mark} ${name}${extra ? ' — ' + extra : ''}`);
};

const textOf = (xml: string) =>
  (xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]*>/g, ''))
    .join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const balanced = (xml: string, tag: string) =>
  (xml.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length ===
  (xml.match(new RegExp(`</${tag}>`, 'g')) || []).length;

// ─── загрузка шаблона ───
const zip = new PizZip(readFileSync(TEMPLATE, 'binary'));
let docXml = zip.file('word/document.xml')!.asText();
console.log('Шаблон загружен, document.xml:', docXml.length, 'симв.\n');

// ═══ 1. Извлечение таблицы 4.2 ═══
console.log('1) extractProgramIeiSection42Table');
const extracted = extractProgramIeiSection42Table(docXml);
check('таблица 4.2 найдена (якорь 0196987F)', !!extracted);
if (!extracted) {
  console.log('\nКРИТИЧНО: экстракция вернула null, дальше нет смысла.');
  process.exit(1);
}
const titles = extracted.rows.map((r) => r.title.toLowerCase());
check('есть строка санитарно-бактериологических', titles.some((t) => t.includes('санитарно-бактериологических')));
check('есть строка санитарно-паразитологических', titles.some((t) => t.includes('санитарно-паразитологических')));
check('есть строка санитарно-энтомологических', titles.some((t) => t.includes('санитарно-энтомологических')));
check('есть строка ландшафтных условий', titles.some((t) => t.includes('ландшафтных условий')));
check('есть строка геоморфологических', titles.some((t) => t.includes('геоморфологических')));
check('есть строка почвенного покрова', titles.some((t) => t.includes('почвенного покрова, растительного')));
check('соц-эконом строка на месте', titles.some((t) => t.includes('социально-экономических условий')));
check('нет старой единой строки «оценка биологического загрязнения»',
  !titles.some((t) => t.startsWith('оценка биологического загрязнения')));
check('строка «расстояние от базы» удалена из таблицы',
  !titles.some((t) => t.includes('расстояние от базы')));
check('нет «объед-ная» в единицах', !extracted.rows.some((r) => (r.unit || '').includes('объед')));
check('«Подготовка технического отчета» присутствует', titles.some((t) => t.includes('подготовка технического отчета')));

// ═══ 2. Природные условия (топ-10) + расстояние ═══
console.log('\n2) applyProgramIeiSection42NaturalConditionsTop10');
{
  let xml = docXml;
  xml = applyProgramIeiSection42NaturalConditionsTop10({
    xml,
    rows: extracted.rows,
    section1Data: { siteArea: 'около 0,77 га', siteDescription: '', technicalCharacteristics: '' } as any,
    tzText: '',
    orderFlags: null,
    project: { objectName: 'Тестовый объект' },
    distanceFromOfficeKm: 96.4,
  });
  check('расстояние подставлено в абзац 6E2000D1', textOf(xml).includes('до участка изысканий: 96,4 км.'));
  check('соц-эконом строка НЕ удалена', xml.includes('социально-экономических условий'));
  check('баланс <w:tr> сохранён', balanced(xml, 'w:tr'));
}

// ═══ 3. Фильтрация таблицы (оставляем только природные) ═══
console.log('\n3) applyProgramIeiSection42TableFiltering');
{
  const keep: number[] = [];
  extracted.workRows.forEach((r, i) => {
    if (r.title.toLowerCase().startsWith('характеристика') ||
        r.title.toLowerCase().startsWith('рекогносцировочное') ||
        r.title.toLowerCase().startsWith('описание точек')) keep.push(i);
  });
  const xml = applyProgramIeiSection42TableFiltering({ xml: docXml, extracted, keepWorkRowIndexes: keep, filterEnabled: true });
  check('таблица отфильтрована (стала короче)', xml.length < docXml.length);
  check('заголовок «Краткая характеристика природных условий» остался', xml.includes('Краткая характеристика природных условий'));
  check('баланс <w:tbl> сохранён', balanced(xml, 'w:tbl'));
}

// ═══ 4. Раздел 4.7: слои + бактериология/паразитология ═══
console.log('\n4) replaceProgramIeiSection47Block');
{
  const xml = replaceProgramIeiSection47Block({
    xml: docXml,
    orderFlags: {
      hasWaterSampling: false, hasSedimentSampling: false, hasAirSampling: false,
      hasPhysicalImpacts: false, hasBuildingSurvey: false, isCommunicationNetworksObject: false,
      hasPPR: false, hasGasGeochemistry: false, hasSurfaceWater: false, hasGroundwater: false,
    } as any,
    layersData: { layers: [{ from: 0.2, to: 1.0, count: 15 }], maxDepth: 5, surfacePlatformCount: 15, totalBoreholeCount: 15 } as any,
    uniquePlatformCount: 8,
  });
  const t = textOf(xml);
  check('основной абзац 4.7 обновлён (радиац. и санитарно-химических)', t.includes('для радиационных и санитарно-химических исследований'));
  check('бактериология: 8 площадок', t.includes('бактериологических (микробиологических) исследований осуществляется в поверхностном слое 0,0-0,2 м с 8 пробных площадок'));
  check('паразитология: 8 площадок', t.includes('паразитологических исследований осуществляется в поверхностном слое 0,0-0,1 м с 8 пробных площадок'));
  check('нет дублей слоёв 0,2-0,5 (шаблонный удалён)', (t.match(/в слое 0,2-0,5 м/g) || []).length <= 1);
  check('баланс <w:p> сохранён', balanced(xml, 'w:p'));
}

// ═══ 5. Раздел 4.3: приборы удалены из шаблона ═══
console.log('\n5) replaceProgramIeiSection43Block');
{
  const xml = replaceProgramIeiSection43Block({ xml: docXml, orderFlags: { hasBuildingSurvey: true, hasSedimentSampling: false } as any });
  const t = textOf(xml);
  check('нет «Терра» в приборах', !t.includes('МКС 05 «Терра»'));
  check('нет «ДКС-96»', !t.includes('ДКС-96'));
  check('нет «РАА-20П2»', !t.includes('РАА-20П2'));
  check('GPS-приёмник остался', t.includes('GPS') || xml.includes('1EFEBEAC'));
}

// ═══ 6. Раздел 4.4 + 4.5 + 7.2 ═══
console.log('\n6) sections 4.4 / 4.5 / 7.2');
{
  const x44 = replaceProgramIeiSection44Block({ xml: docXml });
  check('4.4: «Зяблик» удалён', !textOf(x44).includes('Зяблик'));
  check('4.4: пробоподготовка «ПГ и ДО»', textOf(x44).includes('образцов ПГ и ДО'));
  check('4.4: абзац влаги ДО присутствует', x44.includes('6E2000B1'));

  // 4.5 — взаимоисключающие варианты: «Не требуется» ⇄ блок обоснования прогноза
  const x45no = replaceProgramIeiSection45Block({ xml: docXml, section45Data: null });
  check('4.5 (не требуется): показано «Не требуется»', textOf(x45no).includes('Не требуется'));
  check('4.5 (не требуется): зелёный блок прогноза УБРАН',
    !textOf(x45no).includes('Предварительный прогноз возможных неблагоприятных изменений'));
  const x45yes = replaceProgramIeiSection45Block({ xml: docXml, section45Data: { forecastRequirements: 'По ТЗ требуется прогноз изменения природных условий.' } as any });
  check('4.5 (требуется): блок прогноза + НТД показан',
    textOf(x45yes).includes('Предварительный прогноз возможных неблагоприятных изменений') && textOf(x45yes).includes('ГОСТ 22.0.06-2023'));
  check('4.5 (требуется): абзац «Не требуется» (7A32DBD3) УБРАН', !x45yes.includes('w14:paraId="7A32DBD3"'));

  const x72 = replaceProgramIeiSection72Block({ xml: docXml, section1Data: { reportCopiesText: 'на бумажном носителе - 4 экз., на электронном носителе - 2 экз.' } as any });
  check('7.2: бумажные экземпляры → 4', textOf(x72).includes('на бумажном носителе – 4 экз.'));
  check('7.2: строка «в электронном виде – 1 экз.» на месте', textOf(x72).includes('Количество экземпляров в электронном виде – 1 экз.'));
}

// ═══ 7. Цисты (санитарно-паразитологическая строка) ═══
console.log('\n7) removeCystsFromLine (новая формулировка)');
{
  const line = 'Оценка санитарно-паразитологических показателей: жизнеспособные яйца и личинки гельминтов опасные для человека и животных, цист кишечных патогенных простейших';
  const stripped = removeCystsFromLine(line);
  check('фраза про цисты удалена', !stripped.includes('цист'));
  check('яйца и личинки гельминтов сохранены', stripped.includes('яйца и личинки гельминтов'));
  check('нет висячей запятой в конце', !/,\s*$/.test(stripped), JSON.stringify(stripped.slice(-40)));
}

// ═══ 8. Статические правки шаблона ═══
console.log('\n8) статические правки шаблона');
{
  const t = textOf(docXml);
  check('ГОСТ Р 21.101-2026', t.includes('ГОСТ Р 21.101-2026') && !t.includes('21.101-2020'));
  check('«точек измерений» (опечатка исправлена)', t.includes('точек измерений') && !t.includes('точек изменений'));
  check('сертификат СДС.ТП.СМ.22265-26', t.includes('СДС.ТП.СМ.22265-26') && !t.includes('14697-20'));
  check('УГМС № 312/… (без Э-)', t.includes('№ 312/15/05/ Э-574') && !t.includes('№ Э-312/15/05'));
  check('п.8.1 «не является объектом негативного воздействия»', t.includes('не является объектом негативного воздействия'));
  check('удалён абзац «Оценка загрязненности…из ранее выполненных ИЭИ»',
    !t.includes('будет выполнена на основании данных, взятых из ранее выполненных ИЭИ'));
  check('HYPERLINK-плейсхолдеры целы (Объект/Заказчик)', docXml.includes('&quot;Объект&quot;') && docXml.includes('&quot;Заказчик&quot;'));
}

// ═══ 9. Полный XML-конвейер: HYPERLINK-плейсхолдеры + нормализация стилей ═══
console.log('\n9) WordService.replacePlaceholders + normalizeDocumentStyles');
{
  const { WordService } = await import('../src/modules/word/word.service');
  const svc: any = new WordService({} as any, {} as any, {} as any);
  const data: Record<string, string> = {
    Объект: 'ТЕСТ-ОБЪЕКТ №1',
    Адрес: 'г. Москва, ул. Тестовая, д.1',
    Заказчик: 'ООО «ТЕСТ-ЗАКАЗЧИК»',
    ОГРН: '1234567890123',
    ЮридическийАдрес: '101000, г. Москва',
    КонтактноеЛицо: 'Иванов И.И.',
    НомерТелефона: '+7 900 000-00-00',
    EMAIL: 'test@example.com',
    ФункцНазначение: 'Территория жилой застройки',
    XrObject: 'Краткая характеристика тест',
    ГлубинаРабот: 'до 5,0 м',
    ПлощадьУчастка: '0,77',
  };
  let xml = svc.replacePlaceholders(docXml, data);
  const filled = textOf(xml);
  check('плейсхолдер Объект заполнен', filled.includes('ТЕСТ-ОБЪЕКТ №1'));
  check('плейсхолдер Заказчик заполнен', filled.includes('ООО «ТЕСТ-ЗАКАЗЧИК»'));
  check('плейсхолдер EMAIL заполнен', filled.includes('test@example.com'));
  check('плейсхолдер ФункцНазначение заполнен', filled.includes('Территория жилой застройки'));
  const { normalizeDocumentStyles } = await import('../src/modules/word/program-iei/docx-xml');
  xml = normalizeDocumentStyles(xml);
  check('нормализация стилей отработала (валидный XML)', balanced(xml, 'w:p') && balanced(xml, 'w:tbl'));
  check('нет остаточной подсветки highlight', !/<w:highlight\b/.test(xml));
}

console.log(`\n${failures === 0 ? '✅ ВСЕ ПРОВЕРКИ ПРОШЛИ' : '❌ ПРОВАЛЕНО ПРОВЕРОК: ' + failures}`);
process.exit(failures === 0 ? 0 : 1);
