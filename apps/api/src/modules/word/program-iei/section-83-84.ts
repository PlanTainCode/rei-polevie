/**
 * Обработка пунктов 8.3 и 8.4 программы ИЭИ
 *
 * 8.3 "Обоснование предполагаемых границ зоны воздействия объекта капитального строительства"
 *   - Убирает "(реконструкции)" если объект - линейный объект связи (сети связи, ВОЛС, кабель связи)
 *
 * 8.4 "Обоснование границ изучаемой территории при выполнении инженерно-экологических изысканий"
 *   - Оставляет "(автомобильной дороги)" и "также полосой отвода автомобильной дороги" ТОЛЬКО если объект - дорога/путепровод/тоннель
 *   - В остальных случаях - удаляет эти фразы
 */

import type { ObjectTypeFlags } from '../../ai/program-iei/object-type';

// Маркеры для поиска строк таблицы
const SECTION_83_HEADER = 'Обоснование предполагаемых границ зоны воздействия';
const SECTION_84_HEADER = 'Обоснование границ изучаемой территории';

export function replaceProgramIeiSection83And84Block(params: {
  xml: string;
  objectTypeFlags: ObjectTypeFlags;
}): string {
  let xml = params.xml;
  const { isLinearCommunication, isRoadObject } = params.objectTypeFlags;

  // --- П.8.3: убираем "(реконструкции)" если линейный объект связи ---
  xml = processSection83(xml, isLinearCommunication);

  // --- П.8.4: оставляем фразы про дорогу ТОЛЬКО если дорожный объект ---
  xml = processSection84(xml, isRoadObject);

  return xml;
}

/**
 * Обработка п.8.3 - убираем "(реконструкции)" если линейный объект связи
 */
function processSection83(xml: string, isLinearCommunication: boolean): string {
  const headerIdx = xml.indexOf(SECTION_83_HEADER);
  if (headerIdx === -1) return xml;

  // Находим строку таблицы
  const beforeHeader = xml.substring(0, headerIdx);
  const trStart = beforeHeader.lastIndexOf('<w:tr');
  if (trStart === -1) return xml;

  const afterHeader = xml.substring(headerIdx);
  const trEndOffset = afterHeader.indexOf('</w:tr>');
  if (trEndOffset === -1) return xml;
  const trEnd = headerIdx + trEndOffset + 7;

  // Извлекаем строку
  let tableRow = xml.substring(trStart, trEnd);

  // Если линейный объект связи - убираем "(реконструкции)" заменой текста в <w:t>
  if (isLinearCommunication) {
    // Заменяем текст "(реконструкции)" на пустую строку внутри <w:t>
    tableRow = tableRow.replace(
      /(<w:t[^>]*>)([^<]*)\(реконструкции\)([^<]*)(<\/w:t>)/gi,
      '$1$2$3$4',
    );
    // Также обрабатываем случай когда "(реконструкции)" занимает весь <w:t>
    tableRow = tableRow.replace(/<w:t[^>]*>\(реконструкции\)<\/w:t>/gi, '<w:t></w:t>');
  }

  // Убираем выделение в любом случае
  tableRow = removeHighlightFromRow(tableRow);

  return xml.substring(0, trStart) + tableRow + xml.substring(trEnd);
}

/**
 * Обработка п.8.4 - оставляем фразы про дорогу ТОЛЬКО если дорожный объект
 */
function processSection84(xml: string, isRoadObject: boolean): string {
  const headerIdx = xml.indexOf(SECTION_84_HEADER);
  if (headerIdx === -1) return xml;

  // Находим строку таблицы
  const beforeHeader = xml.substring(0, headerIdx);
  const trStart = beforeHeader.lastIndexOf('<w:tr');
  if (trStart === -1) return xml;

  const afterHeader = xml.substring(headerIdx);
  const trEndOffset = afterHeader.indexOf('</w:tr>');
  if (trEndOffset === -1) return xml;
  const trEnd = headerIdx + trEndOffset + 7;

  // Извлекаем строку
  let tableRow = xml.substring(trStart, trEnd);

  // Если НЕ дорожный объект - убираем фразы про дорогу заменой текста в <w:t>
  if (!isRoadObject) {
    // Заменяем "(автомобильной дороги)" на пустую строку
    tableRow = tableRow.replace(
      /(<w:t[^>]*>)([^<]*)\(автомобильной дороги\)([^<]*)(<\/w:t>)/gi,
      '$1$2$3$4',
    );
    tableRow = tableRow.replace(/<w:t[^>]*>\(автомобильной дороги\)<\/w:t>/gi, '<w:t></w:t>');

    // Заменяем "также полосой отвода автомобильной дороги" на пустую строку
    tableRow = tableRow.replace(
      /(<w:t[^>]*>)([^<]*)также полосой отвода автомобильной дороги([^<]*)(<\/w:t>)/gi,
      '$1$2$3$4',
    );
    tableRow = tableRow.replace(
      /<w:t[^>]*>также полосой отвода автомобильной дороги<\/w:t>/gi,
      '<w:t></w:t>',
    );

    // Убираем лишние запятые ", " которые остались перед пустым текстом
    // Пример: "объекта , с учетом" → "объекта  с учетом"
    tableRow = tableRow.replace(
      /(<w:t[^>]*>[^<]*),\s*(<\/w:t>[\s\S]*?<w:t[^>]*>)<\/w:t>/gi,
      '$1$2</w:t>',
    );
  }

  // Убираем выделение в любом случае
  tableRow = removeHighlightFromRow(tableRow);

  return xml.substring(0, trStart) + tableRow + xml.substring(trEnd);
}

/**
 * Убирает выделение из строки таблицы
 */
function removeHighlightFromRow(row: string): string {
  // Убираем highlight
  let cleaned = row.replace(/<w:highlight[^/]*\/>/g, '');
  cleaned = cleaned.replace(/<w:highlight[^>]*>[\s\S]*?<\/w:highlight>/g, '');

  // Меняем цвет на чёрный
  cleaned = cleaned.replace(/<w:color w:val="[0-9A-Fa-f]{6}"\/>/g, '<w:color w:val="000000"/>');
  cleaned = cleaned.replace(/<w:color w:val="[0-9A-Fa-f]{6}"[^>]*>/g, '<w:color w:val="000000"/>');

  return cleaned;
}

/**
 * Убирает выделение из секции по заголовку
 */
function removeHighlightFromSection(xml: string, header: string): string {
  const headerIdx = xml.indexOf(header);
  if (headerIdx === -1) return xml;

  const beforeHeader = xml.substring(0, headerIdx);
  const trStart = beforeHeader.lastIndexOf('<w:tr');
  if (trStart === -1) return xml;

  const afterHeader = xml.substring(headerIdx);
  const trEndOffset = afterHeader.indexOf('</w:tr>');
  if (trEndOffset === -1) return xml;
  const trEnd = headerIdx + trEndOffset + 7;

  let tableRow = xml.substring(trStart, trEnd);
  tableRow = removeHighlightFromRow(tableRow);

  return xml.substring(0, trStart) + tableRow + xml.substring(trEnd);
}
