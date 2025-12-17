/**
 * Замена пункта 8.1 программы ИЭИ
 * "Краткая природно-хозяйственная характеристика территории по имеющимся материалам о состоянии окружающей среды"
 *
 * Заменяет шаблонное содержимое на текст из ТЗ (пункт 24.1 или 25.1)
 *
 * Структура шаблона - таблица с 3 колонками:
 * - Cell 0: номер пункта
 * - Cell 1: заголовок
 * - Cell 2: содержимое (нужно заменить)
 */

import type { ProgramIeiSection81Data } from '../../ai/program-iei/section-81';

// Маркер для поиска строки таблицы
const SECTION_HEADER = 'Краткая природно-хозяйственная характеристика территории';

export function replaceProgramIeiSection81Block(params: {
  xml: string;
  section81Data: ProgramIeiSection81Data | null;
}): string {
  let xml = params.xml;

  const pollutionText = params.section81Data?.pollutionSourcesText?.trim();
  if (!pollutionText) {
    // Нет данных из ТЗ - оставляем шаблон как есть
    return xml;
  }

  // Находим заголовок в ячейке таблицы
  const headerIdx = xml.indexOf(SECTION_HEADER);
  if (headerIdx === -1) {
    return xml;
  }

  // Находим границы строки таблицы (<w:tr>...</w:tr>)
  const beforeHeader = xml.substring(0, headerIdx);
  const trStart = beforeHeader.lastIndexOf('<w:tr');
  if (trStart === -1) {
    return xml;
  }

  const afterHeader = xml.substring(headerIdx);
  const trEndOffset = afterHeader.indexOf('</w:tr>');
  if (trEndOffset === -1) {
    return xml;
  }
  const trEnd = headerIdx + trEndOffset + 7;

  // Извлекаем строку таблицы
  const tableRow = xml.substring(trStart, trEnd);

  // Находим все ячейки в строке
  const cellPattern = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
  const cells: { start: number; end: number; content: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = cellPattern.exec(tableRow)) !== null) {
    cells.push({
      start: trStart + match.index,
      end: trStart + match.index + match[0].length,
      content: match[0],
    });
  }

  // Нам нужна третья ячейка (индекс 2) - с содержимым
  if (cells.length < 3) {
    return xml;
  }

  const contentCell = cells[2];

  // Извлекаем открывающий тег и свойства ячейки
  const cellOpenMatch = contentCell.content.match(/^(<w:tc\b[^>]*>[\s\S]*?<w:tcPr>[\s\S]*?<\/w:tcPr>)/);
  const cellOpen = cellOpenMatch ? cellOpenMatch[1] : '<w:tc>';

  // Формируем новое содержимое ячейки
  const newCellContent = cellOpen + generateSection81Paragraphs(pollutionText) + '</w:tc>';

  // Заменяем ячейку
  xml = xml.substring(0, contentCell.start) + newCellContent + xml.substring(contentCell.end);

  return xml;
}

/**
 * Генерирует XML-параграфы из текста ТЗ
 */
function generateSection81Paragraphs(text: string): string {
  const paragraphs: string[] = [];

  // Разбиваем текст на блоки по заголовкам
  // Паттерн: "Существующие источники воздействия:" и "Проектируемые источники воздействия:"
  const blocks = text.split(/(?=Существующие источники воздействия:|Проектируемые источники воздействия:)/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Проверяем, начинается ли блок с заголовка
    const headerMatch = trimmed.match(/^(Существующие источники воздействия:|Проектируемые источники воздействия:)\s*/);

    if (headerMatch) {
      // Добавляем заголовок курсивом
      paragraphs.push(createItalicParagraph(headerMatch[1]));

      // Остальной текст блока - обычным шрифтом
      const content = trimmed.substring(headerMatch[0].length).trim();
      if (content) {
        paragraphs.push(createNormalParagraph(content));
      }
    } else {
      // Просто текст без заголовка
      paragraphs.push(createNormalParagraph(trimmed));
    }
  }

  return paragraphs.join('');
}

/**
 * Создаёт обычный параграф
 */
function createNormalParagraph(text: string): string {
  const escapedText = escapeXml(text);
  return `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:sz-cs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapedText}</w:t></w:r></w:p>`;
}

/**
 * Создаёт параграф курсивом (для заголовков подразделов)
 */
function createItalicParagraph(text: string): string {
  const escapedText = escapeXml(text);
  return `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:sz-cs w:val="24"/><w:i/></w:rPr><w:t xml:space="preserve">${escapedText}</w:t></w:r></w:p>`;
}

/**
 * Экранирует спецсимволы XML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
