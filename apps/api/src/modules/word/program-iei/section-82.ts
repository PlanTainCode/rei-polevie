/**
 * Замена пункта 8.2 программы ИЭИ
 * "Предварительные сведения о наличии участков с ранее выявленным загрязнением окружающей среды
 * и зон с особым режимом природопользования (зон экологических ограничений)"
 *
 * Структура шаблона - таблица с 3 колонками:
 * - Cell 0: номер пункта (пустой для 8.2)
 * - Cell 1: заголовок
 * - Cell 2: содержимое (нужно заменить)
 */

// Маркер для поиска строки таблицы
const SECTION_HEADER = 'Предварительные сведения о наличии участков с ранее выявленным загрязнением';

// Текст по умолчанию из шаблона
export const SECTION_82_DEFAULT_TEXT = `Нет данных о наличии участков с ранее выявленным загрязнением окружающей среды.

Объектов культурного наследия федерального и регионального значения, объектов, обладающих признаками объектов культурного наследия, зон санитарной охраны источников водопользования, санитарно-защитных зон на обследуемой территории не имеется. ООПТ федерального, регионального значения и иные ограничения природопользования в районе расположения объекта отсутствуют.

Территория обследования расположена в водоохранной зоне и прибрежной защитной полосе р.Москвы (Кожуховский затон).`;

export function replaceProgramIeiSection82Block(params: {
  xml: string;
  section82Text: string | null | undefined;
}): string {
  let xml = params.xml;

  const text = params.section82Text?.trim();
  if (!text) {
    // Нет данных - оставляем шаблон как есть
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
  const cellOpenMatch = contentCell.content.match(
    /^(<w:tc\b[^>]*>[\s\S]*?<w:tcPr>[\s\S]*?<\/w:tcPr>)/,
  );
  const cellOpen = cellOpenMatch ? cellOpenMatch[1] : '<w:tc>';

  // Формируем новое содержимое ячейки - разбиваем на параграфы по переносам строк
  const paragraphs = createParagraphs(text);
  const newCellContent = cellOpen + paragraphs + '</w:tc>';

  // Заменяем ячейку
  xml = xml.substring(0, contentCell.start) + newCellContent + xml.substring(contentCell.end);

  return xml;
}

/**
 * Создаёт параграфы из многострочного текста
 */
function createParagraphs(text: string): string {
  // Нормализуем переносы строк (Windows \r\n -> \n)
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim());
  return lines.map((line) => createParagraph(line.trim())).join('');
}

/**
 * Создаёт параграф с текстом и корректными стилями
 */
function createParagraph(text: string): string {
  const escapedText = escapeXml(text);
  return `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="000000"/></w:rPr><w:t xml:space="preserve">${escapedText}</w:t></w:r></w:p>`;
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
