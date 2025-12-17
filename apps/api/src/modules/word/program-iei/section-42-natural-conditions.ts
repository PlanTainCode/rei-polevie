import type { ProgramIeiOrderFlags, ProgramIeiSection1Data, ServiceMatch } from '../../ai/ai.service';

import {
  removeTableRowByTrParaId,
  replaceParagraphTextByParaIdPreserveRunProps,
} from './docx-xml';
import { extractSiteAreaSentence } from './site-boundaries';

export interface ProgramIeiSection42RowMeta {
  title: string;
  trIndex: number;
  trParaId: string;
  unit: string;
  qtyParaId: string;
}

const normalize = (s: string): string =>
  String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim();

const lower = (s: string): string => normalize(s).toLowerCase();

export const parseHaFromText = (text: string): number | null => {
  const s = String(text || '').replace(/\u00A0/g, ' ');
  const m =
    s.match(/(\d+(?:[.,]\d+)?)\s*га\b/i) ||
    s.match(/площад[^\n]{0,80}?(\d+(?:[.,]\d+)?)\s*га\b/i);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

const formatDecimalComma = (n: number, digits: number): string => {
  const f = n.toFixed(digits);
  return f.replace('.', ',');
};

const extractLinearLengthKmFromText = (text: string): number | null => {
  const s = String(text || '').replace(/\u00A0/g, ' ');

  // 1) явное "протяженность/длина ... X км"
  {
    const m = s.match(/(?:протяженн\w*|длин\w*)[^\d]{0,40}(\d+(?:[.,]\d+)?)\s*км\b/i);
    if (m?.[1]) {
      const n = Number(m[1].replace(',', '.'));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  // 2) "X м" (конвертим в км), только если явно рядом длина/протяженность
  {
    const m = s.match(/(?:протяженн\w*|длин\w*)[^\d]{0,40}(\d+(?:[.,]\d+)?)\s*м\b/i);
    if (m?.[1]) {
      const n = Number(m[1].replace(',', '.'));
      if (Number.isFinite(n) && n > 0) return n / 1000;
    }
  }

  return null;
};

const inferIsLinearObject = (params: {
  orderFlags: ProgramIeiOrderFlags | null;
  objectName: string;
  technicalCharacteristics: string;
  siteDescription: string;
}): boolean => {
  if (params.orderFlags?.isCommunicationNetworksObject) return true;

  const t = [params.objectName, params.technicalCharacteristics, params.siteDescription]
    .join(' ')
    .toLowerCase();

  return /(трасс\w*|протяженн\w*|линейн\w*|\\bучастк\\w*\\s+от\\b[\\s\\S]{0,80}\\bдо\\b|дорог\w*|улиц\w*|проезд\w*|шоссе|волс|кабель|сети\s+связи|линии\s+связи)/i.test(t);
};

const computeReconKm = (params: {
  areaHa: number;
  isLinear: boolean;
  sourceTextForLinear: string;
}): number => {
  const areaHa = params.areaHa;
  const areaM2 = areaHa * 10000;

  if (params.isLinear) {
    const fromText = extractLinearLengthKmFromText(params.sourceTextForLinear);
    if (fromText && fromText > 0) return fromText;

    // Фоллбэк: считаем протяженность как площадь / условная ширина коридора.
    // Выбрано 20 м как наиболее нейтральное значение для линейных работ.
    const assumedWidthM = 20;
    return areaM2 / assumedWidthM / 1000;
  }

  // Площадный объект: эквивалентный периметр по окружности (даёт ~0.31км для 0.77га)
  const circumferenceM = 2 * Math.sqrt(Math.PI * areaM2);
  return circumferenceM / 1000;
};

const computeObservationPoints = (areaHa: number): number => {
  if (!Number.isFinite(areaHa) || areaHa <= 0) return 1;
  return Math.max(1, Math.ceil(areaHa / 0.5));
};

const findRow = (rows: ProgramIeiSection42RowMeta[], predicate: (t: string) => boolean) =>
  rows.find((r) => predicate(lower(r.title)));

const qtyFromServicesRow = (services: ServiceMatch[], row: number): string | null => {
  const s = (services || []).find((x) => x.row === row);
  if (!s) return null;
  if (typeof s.quantity === 'number' && Number.isFinite(s.quantity)) return String(s.quantity);
  const q = String(s.quantity || '').trim();
  return q || null;
};

export function applyProgramIeiSection42NaturalConditionsTop10(params: {
  xml: string;
  rows: ProgramIeiSection42RowMeta[];
  section1Data: ProgramIeiSection1Data | null;
  tzText: string | null;
  radiometryAreaHa?: number;
  orderFlags: ProgramIeiOrderFlags | null;
  project: any;
}): string {
  let xml = params.xml;

  // ВАЖНО: для расчётов берём площадь строго из 1.9.3 (siteArea / предложение \"Площадь ... га.\").
  // Не парсим всю простыню ТЗ, потому что там могут быть другие \"... га\" (и будут неверные расчёты).
  const areaFrom19_3 =
    parseHaFromText(String(params.section1Data?.siteArea || '')) ||
    // предпочтительно: предложение о площади внутри 1.9.3 (siteDescription уже = текст п.1.9.3)
    parseHaFromText(String(extractSiteAreaSentence(String(params.section1Data?.siteDescription || '')) || '')) ||
    // запасной вариант: если в siteDescription не нашли, тогда пробуем по всему tzText
    parseHaFromText(String(extractSiteAreaSentence(String(params.tzText || '')) || '')) ||
    (typeof params.radiometryAreaHa === 'number' && Number.isFinite(params.radiometryAreaHa)
      ? params.radiometryAreaHa
      : 0);
  const areaHaEffective = areaFrom19_3 > 0 ? areaFrom19_3 : 0.77;

  const isLinear = inferIsLinearObject({
    orderFlags: params.orderFlags,
    objectName: String(params.project?.objectName || params.project?.name || ''),
    technicalCharacteristics: String(params.section1Data?.technicalCharacteristics || ''),
    siteDescription: String(params.section1Data?.siteDescription || ''),
  });

  // 2/3/6/10 — удаляем строки
  const toRemovePredicates: Array<(t: string) => boolean> = [
    (t) => t.startsWith('обследование объектов неблагоприятного техногенного воздействия'),
    (t) => t.startsWith('наблюдения при передвижении по маршруту'),
    (t) => t.startsWith('описание современного состояния растительного покрова'),
    (t) => t.startsWith('характеристика социально-экономических условий'),
  ];

  for (const pred of toRemovePredicates) {
    const row = findRow(params.rows, pred);
    if (row?.trParaId) {
      xml = removeTableRowByTrParaId(xml, row.trParaId);
    }
  }

  // 1) Рекогносцировочное (маршрутное) обследование — км
  {
    const row = findRow(params.rows, (t) => t.startsWith('рекогносцировочное (маршрутное) обследование'));
    if (row?.qtyParaId) {
      const km = computeReconKm({
        areaHa: areaHaEffective,
        isLinear,
        sourceTextForLinear: [
          String(params.tzText || ''),
          String(params.section1Data?.technicalCharacteristics || ''),
          String(params.section1Data?.siteDescription || ''),
          String(params.project?.objectName || params.project?.name || ''),
        ].join('\n'),
      });

      const rounded = Math.max(0.1, Math.round(km * 10) / 10);
      xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, formatDecimalComma(rounded, 1));
    }
  }

  // 4) Описание точек наблюдений — количество точек по площади
  {
    const row = findRow(params.rows, (t) => t.startsWith('описание точек наблюдений'));
    if (row?.qtyParaId) {
      const cnt = computeObservationPoints(areaHaEffective);
      xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, String(cnt));
    }
  }

  // 5/7/8/9 — оставляем, количество = 1
  for (const pred of [
    (t: string) => t.startsWith('характеристика климатических условий'),
    (t: string) => t.startsWith('характеристика фонового загрязнения компонентов окружающей среды'),
    (t: string) => t.startsWith('характеристика современного состояния территории'),
    (t: string) => t.startsWith('описание растительного и животного мира участка'),
  ]) {
    const row = findRow(params.rows, pred);
    if (row?.qtyParaId) {
      xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, '1');
    }
  }

  return xml;
}

export function applyProgramIeiSection42QuantitiesFromServices(params: {
  xml: string;
  rows: ProgramIeiSection42RowMeta[];
  services: ServiceMatch[];
  areaHa?: number;
}): string {
  let xml = params.xml;
  const services = params.services || [];
  const areaHa = typeof params.areaHa === 'number' && Number.isFinite(params.areaHa) ? params.areaHa : null;

  // Базовые количества проб по прейскуранту
  const pprCount = qtyFromServicesRow(services, 17);
  const radiometryHaRaw = qtyFromServicesRow(services, 16);
  const soilCount = qtyFromServicesRow(services, 20);
  const soilToxicCount = qtyFromServicesRow(services, 21);
  const soilMicroCount = qtyFromServicesRow(services, 22);
  const flyCount = qtyFromServicesRow(services, 23);
  const surfaceWaterCount = qtyFromServicesRow(services, 28);
  const sedimentCount = qtyFromServicesRow(services, 29);
  const groundWaterCount = qtyFromServicesRow(services, 30);

  const toNum = (v: string | number | null): number | null => {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s || s === '-' || s === '–') return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  // Радиометрия по территории (га): приоритет — из поручения (row 16), затем из площади участка.
  const radiometryHa = toNum(radiometryHaRaw) ?? areaHa;

  const hasSediment = (toNum(sedimentCount) ?? 0) > 0;
  const hasSurfaceWater = (toNum(surfaceWaterCount) ?? 0) > 0;
  const hasGroundWater = (toNum(groundWaterCount) ?? 0) > 0;

  type Group = 'NONE' | 'SOIL' | 'SEDIMENT' | 'SURFACE_WATER' | 'GROUND_WATER' | 'AIR';
  let group: Group = 'NONE';

  // rows должны быть в исходном порядке таблицы
  const rows = [...params.rows].sort((a, b) => a.trIndex - b.trIndex);

  // Проходим по строкам и заполняем те, где единица измерения = проба/проба (объед-ная)
  for (const row of rows) {
    const t = lower(row.title);

    // переключаем группу на подзаголовках
    if (t.startsWith('исследование состояния почв')) group = 'SOIL';
    else if (t.startsWith('исследование состояния донных отложений')) group = 'SEDIMENT';
    else if (t.startsWith('исследование загрязнения поверхностных вод')) group = 'SURFACE_WATER';
    else if (t.startsWith('исследование загрязнения подземных вод')) group = 'GROUND_WATER';
    else if (t.startsWith('исследование загрязнения атмосферного воздуха')) group = 'AIR';

    const u = lower(row.unit);

    // га (радиометрия) — берём из площади участка
    if (radiometryHa != null && u === 'га') {
      if (row.qtyParaId) {
        xml = replaceParagraphTextByParaIdPreserveRunProps(
          xml,
          row.qtyParaId,
          formatDecimalComma(radiometryHa, 2),
        );
      }
      continue;
    }

    // точки (ППР) — row 17
    if (u.includes('точка') && t.includes('ппр')) {
      if (row.qtyParaId && pprCount) {
        xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, String(pprCount));
      }
      continue;
    }

    if (!u.includes('проба')) continue;

    // Вода/донные — по текущей группе
    if (group === 'SURFACE_WATER') {
      if (surfaceWaterCount) {
        xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, surfaceWaterCount);
      }
      continue;
    }

    if (group === 'GROUND_WATER' || t.includes('скважин')) {
      if (groundWaterCount) {
        xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, groundWaterCount);
      }
      continue;
    }

    if (group === 'SEDIMENT') {
      if (sedimentCount) {
        xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, sedimentCount);
      }
      continue;
    }

    if (group === 'AIR') {
      // пока не заполняем (нет стабильного соответствия прейскуранту)
      continue;
    }

    // Подгруппы почвы
    if (t.includes('мух') || t.includes('личинок') || t.includes('куколок')) {
      if (flyCount) {
        xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, flyCount);
      }
      continue;
    }

    if (t.includes('колиформ') || t.includes('микробиолог') || t.includes('бактери') || t.includes('гельминт') || t.includes('цист')) {
      if (soilMicroCount) {
        xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, soilMicroCount);
      }
      continue;
    }

    if (t.includes('токсич') || t.includes('биотест')) {
      if (soilToxicCount) {
        xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, soilToxicCount);
      }
      continue;
    }

    // По умолчанию: почва по СанПиН (ряд 20)
    if (soilCount) {
      xml = replaceParagraphTextByParaIdPreserveRunProps(xml, row.qtyParaId, soilCount);
    }
  }

  return xml;
}

/**
 * Убирает целиком блоки \"донные/поверхностные/подземные воды\", если соответствующих услуг нет.
 * Это защита от ложных совпадений AI при фильтрации таблицы.
 */
export function pruneProgramIeiSection42WaterBlocks(params: {
  xml: string;
  rows: ProgramIeiSection42RowMeta[];
  hasSediment: boolean;
  hasSurfaceWater: boolean;
  hasGroundWater: boolean;
}): string {
  let xml = params.xml;
  const rows = [...params.rows].sort((a, b) => a.trIndex - b.trIndex);

  type Group = 'NONE' | 'SOIL' | 'SEDIMENT' | 'SURFACE_WATER' | 'GROUND_WATER' | 'AIR';
  let group: Group = 'NONE';

  for (const row of rows) {
    const t = lower(row.title);

    if (t.startsWith('исследование состояния почв')) group = 'SOIL';
    else if (t.startsWith('исследование состояния донных отложений')) group = 'SEDIMENT';
    else if (t.startsWith('исследование загрязнения поверхностных вод')) group = 'SURFACE_WATER';
    else if (t.startsWith('исследование загрязнения подземных вод')) group = 'GROUND_WATER';
    else if (t.startsWith('исследование загрязнения атмосферного воздуха')) group = 'AIR';

    const shouldRemove =
      (group === 'SEDIMENT' && !params.hasSediment) ||
      (group === 'SURFACE_WATER' && !params.hasSurfaceWater) ||
      (group === 'GROUND_WATER' && !params.hasGroundWater);

    if (shouldRemove && row.trParaId) {
      xml = removeTableRowByTrParaId(xml, row.trParaId);
    }
  }

  return xml;
}
