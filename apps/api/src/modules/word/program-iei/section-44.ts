import type { ProgramIeiOrderFlags } from '../../ai/ai.service';
import {
  removeParagraphByParaId,
  replaceParagraphTextByParaIdPreserveRunProps,
} from './docx-xml';

/**
 * Раздел 4.4: Мероприятия по соблюдению требований к точности
 *
 * Логика:
 * - Удаляем параграф про "Зяблик" (paraId=5A6E602E)
 * - Без донных отложений: убираем «и ДО» из пробоподготовки ПГ, удаляем абзац про влагу ДО
 * - Меняем цветной текст (фиолетовый, голубой) на черный у всех параграфов
 */
export function replaceProgramIeiSection44Block(params: {
  xml: string;
  orderFlags?: ProgramIeiOrderFlags | null;
  /** Строгое наличие ДО из количеств поручения (row 29), если известно */
  hasSedimentFromQuantities?: boolean | null;
}): string {
  let xml = params.xml;

  const hasSedimentFromFlags = Boolean(params.orderFlags?.hasSedimentSampling);
  // Если количества из поручения известны — они приоритетнее (как в п.4.2)
  const hasSediment =
    params.hasSedimentFromQuantities == null
      ? hasSedimentFromFlags
      : params.hasSedimentFromQuantities;

  // 1. Удаляем параграф про "Зяблик"
  xml = removeParagraphByParaId(xml, '5A6E602E');

  // 2. Донные отложения — только при наличии ДО
  if (!hasSediment) {
    // Пробоподготовка прокаливанием: «ПГ и ДО» → «ПГ»
    xml = replaceParagraphTextByParaIdPreserveRunProps(
      xml,
      '40AFFE3F',
      'В соответствии с п.11.1.3 ФР.1.40.2017.25774 (2016) пробоподготовка испытательных образцов ПГ проводится путем прокаливания проб для удаления органической части гумуса и корней растений согласно «Методическим рекомендациям по приготовлению счетных образцов для спектрометрических комплексов с программным обеспечением «Прогресс»(п.10).',
    );

    // Пробоподготовка ПНД: «ПГ и ДО» → «ПГ»
    xml = replaceParagraphTextByParaIdPreserveRunProps(
      xml,
      '534E152F',
      'В соответствии с п.5.1.1 ПНД Ф 16.1:2.3:3.11-98 при проведении лабораторных работ должна быть выполнена предварительная пробоподготовка каждого из отобранных образцов ПГ для выполнения физико-химических исследований солей тяжелых металлов и мышьяка.',
    );

    // Абзац только про ДО (влага) — удаляем целиком
    xml = removeParagraphByParaId(xml, '6E2000B1');
  }

  // 3. Убираем цветной текст у всех параграфов в секции 4.4
  const section44ParaIds = [
    '468208AB', // Заголовок (4.4)
    '5FA18B18', // Метрологическое обеспечение
    '5AFACCB0', // Лабораторные исследования
    '5D5F1385', // ООО «ГК РЭИ»
    '5D520082', // ФГБУЗ ГЦГиЭ
    '02E9F760', // ФБУЗ ЦГиЭ
    '1E98152E', // Климатические условия
    '40AFFE3F', // Пробоподготовка (прокаливание)
    '534E152F', // Пробоподготовка (ПГ / ПГ и ДО)
    '6E2000B1', // Пробоподготовка (влага ДО)
    '38A69E3B', // Определение тяжелых металлов
    '2A434A57', // Определение ртути
  ];

  for (const paraId of section44ParaIds) {
    const paraPattern = new RegExp(
      `(<w:p\\b[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?)</w:p>`,
      'g',
    );

    xml = xml.replace(paraPattern, (match) => {
      let cleaned = match;

      cleaned = cleaned.replace(
        /<w:color w:val="[0-9A-F]{6}"\/>/g,
        '<w:color w:val="000000"/>',
      );
      cleaned = cleaned.replace(
        /<w:color w:val="[0-9A-F]{6}"[^>]*>/g,
        '<w:color w:val="000000"/>',
      );

      return cleaned;
    });
  }

  return xml;
}
