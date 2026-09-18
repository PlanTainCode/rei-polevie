const MONTHS_PREPOSITIONAL = [
  'январе',
  'феврале',
  'марте',
  'апреле',
  'мае',
  'июне',
  'июле',
  'августе',
  'сентябре',
  'октябре',
  'ноябре',
  'декабре',
];

export function formatInMonthYear(date: Date, withG = true): string {
  const month = MONTHS_PREPOSITIONAL[date.getMonth()] || 'январе';
  return withG ? `в ${month} ${date.getFullYear()} г.` : `в ${month} ${date.getFullYear()}`;
}

export function isMoscowAddress(...parts: Array<string | null | undefined>): boolean {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  if (!text) return false;
  if (text.includes('московск')) {
    return /г\.?\s*москва\b|город москва|москва,/.test(text);
  }
  return text.includes('москва');
}

export function isLandscapingOnly(urban: string): boolean {
  const u = urban.toLowerCase();
  if (!/благоустрой/.test(u)) return false;
  return !/строительств|реконструкц|капитальн|снос/.test(u);
}

export function stripOgrnPrefix(ogrn: string): string {
  return String(ogrn || '').replace(/^\s*ОГРН\s*/i, '').trim();
}

export function buildClientNameLine(name: string, ogrn: string): string {
  const n = String(name || '').trim();
  const o = stripOgrnPrefix(ogrn);
  if (n && o) return `${n}, ОГРН ${o}`;
  return n;
}

export function stageSubtitleFromSurveyStage(surveyStage: string): string {
  const s = String(surveyStage || '').trim();
  const m = s.match(/для\s+.+$/i);
  if (m) return m[0].replace(/^для\s*/i, 'для ');
  return 'для подготовки проектной документации';
}

export function buildReportCipher(documentNumber: string, override?: string): string {
  const custom = String(override || '').trim();
  if (custom) return custom;
  const num = String(documentNumber || '').trim();
  if (!num) return '801-000-25-ИЭИ';
  return /иэи/i.test(num) ? num : `${num}-ИЭИ`;
}

export function buildNearbyText(params: {
  nearbyText?: string | null;
  nearbyNorth?: string | null;
  nearbyEast?: string | null;
  nearbySouth?: string | null;
  nearbyWest?: string | null;
}): string {
  const free = String(params.nearbyText || '').trim();
  if (free) return free.replace(/\s*\n\s*/g, ' ');
  const parts: string[] = [];
  if (params.nearbyNorth) parts.push(`К северу от участка изысканий ${params.nearbyNorth}`);
  if (params.nearbyEast) parts.push(`К востоку от участка изысканий ${params.nearbyEast}`);
  if (params.nearbySouth) parts.push(`К югу от участка изысканий ${params.nearbySouth}`);
  if (params.nearbyWest) parts.push(`К западу от участка изысканий ${params.nearbyWest}`);
  return parts.join(' ');
}

export function buildLocationSentence(location: string): string {
  const loc = String(location || '').trim().replace(/[.;]+$/u, '');
  if (!loc) return 'Территория изысканий расположена (см. Рисунок 1.1).';
  if (/рисунок 1\.1/i.test(loc)) return loc.endsWith('.') ? loc : `${loc}.`;
  if (/^территори[яи]/i.test(loc)) {
    return `${loc} (см. Рисунок 1.1).`;
  }
  if (/расположен/i.test(loc) && !/^г\.|^город /i.test(loc)) {
    return `${loc} (см. Рисунок 1.1).`;
  }
  return `Территория изысканий расположена по адресу: ${loc} (см. Рисунок 1.1).`;
}

export function shortenExcavationDepth(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^-?\d+[,.]?\d*\s*м(\s*\(max\))?$/i.test(text)) {
    return text.startsWith('-') ? text : `-${text.replace(/^-/, '')}`;
  }
  const max = text.match(/(?:max|мах|до)\s*[–—-]?\s*(\d+[,.]\d+|\d+)\s*м/i);
  if (max?.[1]) {
    return `-${max[1].replace('.', ',')} м (max)`;
  }
  const any = text.match(/(\d+[,.]\d+|\d+)\s*м/);
  if (any?.[1]) {
    return `-${any[1].replace('.', ',')} м (max)`;
  }
  return text;
}

export function buildSiteAreaText(siteArea: string): string {
  const raw = String(siteArea || '').trim();
  if (!raw) return 'Площадь участка изысканий около _ га';
  if (/площад/i.test(raw)) return raw.replace(/[.;]+$/u, '');
  const num = raw.replace(/^около\s+/i, '');
  return `Площадь участка изысканий около ${num}${/га/i.test(num) ? '' : ' га'}`;
}

export function buildOpenGroundText(percent: number | null, hasBuilding: boolean): string {
  const n = percent == null ? 15 : percent;
  const rest = hasBuilding
    ? 'Остальная территория занята строением и заасфальтирована под автомобильные проезды и тротуар (см. Рисунок 1.2) (см. Рисунок 1.3).'
    : 'Остальная территория заасфальтирована под автомобильные проезды и тротуар (см. Рисунок 1.2).';
  return `Площадь поверхности открытого грунта на участке составляет около ${n} %. ${rest}`;
}

export function buildUrbanPlanningSentence(urban: string): string {
  const value = String(urban || '').trim().replace(/[.;]+$/u, '');
  const body = value || 'архитектурно-строительное проектирование';
  const lower = body.charAt(0).toLowerCase() + body.slice(1);
  return `Вид градостроительной деятельности – ${lower}.`;
}

export function buildSurveyStageSentence(stage: string): string {
  const value = String(stage || 'инженерные изыскания для подготовки проектной документации')
    .trim()
    .replace(/[.;]+$/u, '');
  const lower = value.charAt(0).toLowerCase() + value.slice(1);
  return `Этап выполнения инженерных изысканий – ${lower}.`;
}

export function buildContractSentence(clientName: string): string {
  const name = String(clientName || '').trim() || 'заказчиком';
  return `Основанием проведения инженерных изысканий является договор между ${name} и АО «РЭИ-ЭКОАУДИТ».`;
}

export function buildIntroObjectSentence(objectName: string): string {
  const name = String(objectName || '').trim() || 'Название объекта';
  return `Инженерно-экологические изыскания выполнены по объекту: «${name}» в полном соответствии с Заданием на выполнение инженерных изысканий (см. Приложение Б) и Программой инженерно-экологических изысканий (см. Приложение В).`;
}

export function buildRenameSentence(previousName: string, currentName: string): string {
  return `В процессе производства работ было изменено название объекта с «${previousName}» на актуальное: «${currentName}».`;
}

function normalizeInPeriod(value: string): string {
  return String(value || '')
    .trim()
    .replace(/^в\s+/i, 'в ')
    .replace(/\.+$/u, '');
}

/** Пустые периоды не подставляют шаблонные май/июнь — авто считает fill. */
export function buildDatesSentence(fieldWork: string, cameralWork: string): string {
  const field = normalizeInPeriod(fieldWork);
  const cameral = normalizeInPeriod(cameralWork);
  return `Полевые работы выполнены ${field}. Камеральные работы выполнены ${cameral}.`;
}

export function clean384Text(): string {
  return 'Федеральный закон «Технический регламент о безопасности зданий и сооружений» № 384-ФЗ от 30.12.2009.';
}

export function formatInventoryNumber(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/инв/i.test(value)) return value;
  return `Инв. № ${value}`;
}

/** МЭД здания и ЭРОА радона вместе — условие абзаца здания по пометке [80]. */
export function hasMedBuildingAndEroa(orderText?: string | null): boolean {
  const t = String(orderText || '');
  if (!t.trim()) return false;
  const hasMed =
    /мэд\s*зд|мэд\s*здан|мэд[\s\S]{0,40}здан|радиометрическ[а-яёА-ЯЁ]*\s+обследован[а-яёА-ЯЁ]*\s+здан|гамма[\s\S]{0,40}здан/i.test(
      t,
    );
  const hasEroa =
    /эроа|оа\s*\/\s*эроа|объемн[а-яёА-ЯЁ]*\s+активност[а-яёА-ЯЁ]*[\s\S]{0,60}радон|радон[\s\S]{0,40}здан/i.test(
      t,
    );
  return hasMed && hasEroa;
}

function normalizeLandUseZone(raw: string): string {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^в\s+/i, '')
    .replace(/^[«"']+|[»"']+$/g, '')
    .replace(/[.;]+$/u, '')
    .trim();
}

/** Зона использования 1:1 из ТЗ, без шаблонной «многофункциональной общественной зоне». */
export function extractLandUseZoneFromTz(...parts: Array<string | null | undefined>): string {
  const text = parts.filter(Boolean).join('\n').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  const labeled = text.match(
    /зон[аеыу]\s+использования\s+территории\s*[:–—-]?\s*([^.;\n]+)/i,
  );
  if (labeled?.[1]) return normalizeLandUseZone(labeled[1]);

  const located = text.match(
    /расположен[аоы]?\s+в\s+((?:зоне\s+[^.;]{3,80})|(?:[^.;]{3,80}зоне))/i,
  );
  if (located?.[1]) return normalizeLandUseZone(located[1]);

  const territorial = text.match(
    /(?:территориальн(?:ая|ой)|функциональн(?:ая|ой))\s+зон[аеы]\s+([^.;\n]{3,90})/i,
  );
  if (territorial?.[1]) {
    const tail = normalizeLandUseZone(territorial[1]);
    if (/^зоне\b/i.test(tail)) return tail;
    return normalizeLandUseZone(`зоне ${tail}`);
  }

  return '';
}

const TEMPLATE_CGMS_REF_RE = /312\/15\/05\s*\/?\s*Э-574/i;
const TEMPLATE_PREVIOUS_IEI_RE =
  /736-00046-52018-19|РЭИ-Регион|Игральная|Мосгоргеотрест/i;

export function isTemplateCgmsCertificateRef(raw: string): boolean {
  return TEMPLATE_CGMS_REF_RE.test(String(raw || ''));
}

export function isTemplatePreviousSurveyReport(raw: string): boolean {
  return TEMPLATE_PREVIOUS_IEI_RE.test(String(raw || ''));
}

export function parseCgmsCertificateRef(raw: string): { number: string; date: string } {
  const src = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!src) return { number: '', date: '' };
  const ot = src.match(/^(.*?)(?:\s+от\s+)(.+)$/i);
  if (ot) {
    return {
      number: ot[1].replace(/^№\s*/u, '').trim(),
      date: ot[2].replace(/[.;]+$/u, '').trim(),
    };
  }
  return { number: src.replace(/^№\s*/u, '').trim(), date: '' };
}

export function formatCgmsLetterNumber(number: string): string {
  return String(number || '')
    .replace(/^№\s*/u, '')
    .trim();
}

export function buildWeatherStationSentence(station: string, period?: string): string {
  const name = String(station || '').trim().replace(/^[«"]+|[»"]+$/g, '');
  if (!name) return '';
  const periodText = String(period || '').trim().replace(/[.;]+$/u, '');
  if (periodText) {
    const withZa = /^за\s+/i.test(periodText) ? periodText : `за ${periodText}`;
    return `Краткая климатическая характеристика района изысканий приводится по данным наблюдений метеорологической станции «${name}» ${withZa}.`;
  }
  return `Краткая климатическая характеристика района изысканий приводится по данным наблюдений метеорологической станции «${name}».`;
}

export const NO_CGMS_CLIMATE_TEXT =
  'Климатическая характеристика района изысканий приведена согласно аналитическому отчету «Расчет метеорологических характеристик и коэффициентов, определяющих условия рассеивания загрязняющих веществ», Москва - 2025 г.';

export const NO_PREVIOUS_IEI_TEXT =
  'Степень изученности санитарно-химического и радиологического состояния почв (грунтов), степень акустического загрязнения, загрязнения воздуха в районе проектируемого объекта низка и требуют изучения на данном этапе подготовки проектной документации.';

export const MOSCOW_SOURCES_WITH_CERT_TEXT =
  'При подготовке данного раздела были использованы данные из справки о климатической характеристике (см. Приложение Г), литературные и фондовые материалы [19, 20, 21], электронный атлас г.Москвы [23], электронный ресурс «Государственная информационная система обеспечения градостроительной деятельности города Москвы» [24] и результаты маршрутных наблюдений.';

export const MOSCOW_SOURCES_NO_CERT_TEXT =
  'При подготовке данного раздела были использованы литературные и фондовые материалы [19, 20, 21], электронный атлас г.Москвы [23], электронный ресурс «Государственная информационная система обеспечения градостроительной деятельности города Москвы» [24] и результаты маршрутных наблюдений.';

export const MO_SOURCES_TEXT =
  'При подготовке данного раздела были использованы литературные и фондовые материалы [21], эколого-геохимическая карта Московской области [22], данные Центра государственного мониторинга состояния недр [25], ландшафтная карта Подмосковья [26] и результаты маршрутных наблюдений.';

export const MOSCOW_CLIMATE_TEXT =
  'Климат района изысканий характеризуется как умеренно-континентальный с относительно мягкой зимой с редкими оттепелями и теплым сравнительно влажным летом. Годовая амплитуда температуры воздуха достигает 28°C. За год район получает около 90 ккал/см суммарной солнечной радиации, из которых 40 % составляет рассеянная радиация.';

export const MO_CLIMATE_TEXT =
  'Рассматриваемая территория относится ко II-му поясу умеренно-континентального климата. Климат района характеризуется морозной, снежной зимой, влажным, относительно теплым летом и хорошо выраженными переходными сезонами.';

export function stripBranchPrefix(text: string): string {
  return String(text || '')
    .replace(/^\((?:Москва|МО|если не делаем плодородие)\)\s*/i, '')
    .trim();
}

export function hasAgrochemistryInOrder(orderText?: string | null): boolean {
  return /агрохим|плодород|мгсн\s*1\.02/i.test(String(orderText || ''));
}

export function mapProgramIeiLandscapeToReport(
  landscape?: string | null,
): import('./types').ReportIeiNativeLandscape {
  const value = String(landscape || '').trim();
  if (value === 'HIMKI') return 'HIMKI';
  if (value === 'MOSKVORETSKO_GRAYVORONSKIY') return 'MOSKVORETSKO_GRAYVORONSKIY';
  if (value === 'MOSKVORETSKO_SKHODNENSKIY') return 'MOSKVORETSKO_SKHODNENSKIY';
  if (value === 'TSARITSYNSKIY') return 'TSARITSYNSKIY';
  if (value === 'KUNTSEVSKIY') return 'KUNTSEVSKIY';
  return '';
}

export function buildEconomicDevelopmentText(params: {
  nearbyText?: string;
  landUseZone?: string;
  override?: string;
}): string {
  const override = String(params.override || '').trim();
  if (override) return override.replace(/[.;]+$/u, '') + (override.endsWith('.') ? '' : '.');
  const parts: string[] = [];
  const zone = String(params.landUseZone || '')
    .trim()
    .replace(/^в\s+/i, '')
    .replace(/[.;]+$/u, '');
  if (zone) parts.push(`Участок расположен в ${zone}.`);
  const nearby = String(params.nearbyText || '')
    .trim()
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[.;]+$/u, '');
  if (nearby) parts.push(`${nearby}.`);
  return parts.join(' ');
}

export const MOSCOW_SOILS_INTRO_TEXT =
  'Изначально почвенный покров Москвы состоял в основном из дерново-подзолистых почв. Большие площади приходились на массивы болотных почв. С течением времени в ходе значительного антропогенного влияния почвы поменяли строение, состав, режим функционирования, физические и химические характеристики. Протеканию естественных почвообразовательных процессов препятствуют масштабное строительство, срезка грунтов при вертикальной планировке, асфальтирование и пр. Искусственное почвообразование происходит в основном благодаря насыпным грунтам при организации парков, скверов, бульваров и пр.';

export const MOSCOW_SOILS_SHARE_TEXT =
  'Основными почвами Москвы являются дерново-подзолистые, занимающие 55,9 % территории. Затем идут болотно-подзолистые (19.2 %), серые лесные (8.2 %). Болотные почвы, в основном низинные и переходные, занимают 5 % территории, пойменные – 4,5 %, черноземные – 0,9 %.';

export const MO_SOILS_INTRO_TEXT =
  'Почвенный покров участка изысканий представлен сочетанием аллювиальных болотных иловато-торфяных, аллювиальных болотных иловато-перегнойно-глеевых (25-50%) и аллювиальных болотных иловато-торфяно-глеевых почв (25-50%) (см. Рисунок 3.6.1).';

export const MOSCOW_VEGETATION_TEXT =
  'Территория изысканий находится в пределах полос отвода действующих железной и автомобильной дорог, где естественная растительность развита фрагментарно, преобладает культивируемая и сорная (рудеральная) растительность. Сообщества рудеральных растений занимают стройплощадки, местами откосы железнодорожных насыпей.';

export const MO_VEGETATION_TEXT =
  'Территория изысканий покрыта в основном растительностью пойменных лугов. Насаждения на участке естественного происхождения. В непосредственной близости от русла канала на участке изысканий произрастают единичные деревья следующих видов: ива белая, клен ясенелистный (см. рисунок 2.2). Травянистая растительность в основном представлена прибрежными (сусак зонтичный, тростник обыкновенный) (см. рисунок 2.3), луговыми (полынь обыкновенная, вьюнок полевой, подмаренник желтый, подмаренник мягкий, вербейник обыкновенный, некоторые виды злаковых) (см. рисунок 2.4) и сорными (крапива двудомная, синеголовник, гвоздика травянка, дудник лекарственный) (см. рисунок 2.5) видами растений.';

export const MOSCOW_FAUNA_TEXT =
  'Биологическое разнообразие участка изысканий определяется его принадлежностью к урбанизированным территориям. Во время проведения изысканий на территории выявлено присутствие лишь некоторых синантропных видов птиц: черная ворона, сизый голубь, домовый воробей, а также млекопитающих – бродячих собак (см. Рисунок 3.8.1).';

export const MO_FAUNA_TEXT =
  'Животный мир участка изысканий представлен в основном полевыми видами: крот, полевая мышь, бурозубка, различные виды насекомых и птиц. На момент проведения изысканий редких, реликтовых и находящихся под угрозой исчезновения видов животных, занесенных в Красную книгу, не обнаружено.';

export const NO_OOPT_HEADING = '3.8 Особо охраняемые природные территории';

export const NO_OOPT_TEXT =
  'ООПТ федерального, регионального значения и иные ограничения природопользования в районе расположения объекта отсутствуют.';

