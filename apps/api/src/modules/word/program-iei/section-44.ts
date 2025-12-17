import { removeParagraphByParaId } from './docx-xml';

/**
 * Раздел 4.4: Мероприятия по соблюдению требований к точности
 * 
 * Логика:
 * - Удаляем параграф про "Зяблик" (paraId=5A6E602E)
 * - Меняем цветной текст (фиолетовый, голубой) на черный у всех параграфов
 */
export function replaceProgramIeiSection44Block(params: { xml: string }): string {
  let xml = params.xml;

  // 1. Удаляем параграф про "Зяблик"
  xml = removeParagraphByParaId(xml, '5A6E602E');

  // 2. Убираем цветной текст у всех параграфов в секции 4.4
  const section44ParaIds = [
    '468208AB', // Заголовок (4.4)
    '5FA18B18', // Метрологическое обеспечение
    '5AFACCB0', // Лабораторные исследования
    '5D5F1385', // ООО «ГК РЭИ»
    '5D520082', // ФГБУЗ ГЦГиЭ
    '02E9F760', // ФБУЗ ЦГиЭ
    '1E98152E', // Климатические условия (фиолетовый)
    // '5A6E602E', // Зяблик - удаляем выше
    '40AFFE3F', // Пробоподготовка (прокаливание)
    '534E152F', // Пробоподготовка (ПГ)
    '38A69E3B', // Определение тяжелых металлов
    '2A434A57', // Определение ртути (голубой)
  ];

  // Меняем цветной текст на черный
  for (const paraId of section44ParaIds) {
    const paraPattern = new RegExp(
      `(<w:p\\b[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?)</w:p>`,
      'g',
    );

    xml = xml.replace(paraPattern, (match) => {
      let cleaned = match;

      // Меняем все цвета на черный (фиолетовый 7030A0, голубой 00B0F0 и т.д.)
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
