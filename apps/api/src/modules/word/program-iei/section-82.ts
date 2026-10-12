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

Объекты культурного наследия:

Объекты культурного наследия федерального и регионального значения, выявленные объекты культурного наследия и объекты, обладающие признаками объектов культурного наследия, зоны охраны объектов культурного наследия на обследуемой территории и вблизи отсутствуют.

Особо охраняемые природные территории и особо охраняемые зеленые территории:

ООПТ и ООЗТ федерального и регионального значения на обследуемой территории и вблизи отсутствуют.

К северу от участка изысканий располагается территория охраняемого природного ландшафта (см. рисунок 7.2), территория планируемого к созданию ООПТ: Ландшафтный заказник «Лес на реке Самородинке» (западный участок).

Природные комплексы:

Природные комплексы на обследуемой территории и вблизи отсутствуют.

В 35 м к западу от участка изысканий расположен ПК № 80-ЗАО «Бульвар по Можайскому шоссе» (РРГД 2), на расстоянии около 120 м к югу − ООПТ Природный заказник «Долина реки Сетунь».

Санитарно-защитные и водоохранные зоны

Водоохранные зоны, прибрежные защитные и береговые полосы в районе участка изысканий отсутствуют (см. рисунок 5.4).

Территория обследования расположена в установленных санитарно-защитных зонах, затрагивает охранную зону КЛ 220кВ «Южная – Павелецкая №1, 2» (см. рисунок 7.4). На территории изысканий отсутствуют проектируемые объекты, противоречащие режиму СЗЗ, согласно пп. 5.1 и 5.2 СанПиН 2.2.1/2.1.1.1200-03.

Зоны санитарной охраны источников водопользования

Отсутствуют.

Проектируемый объект находится в пределах 2-го и 3-го пояса ЗСО. Согласно п.3.2.2.2 СанПиН 2.1.4.1110-02 новое строительство, связанное с нарушением почвенного покрова, производится при обязательном согласовании с центром государственного санитарно-эпидемиологического надзора.

Зоны затопления и подтопления:

Отсутствуют.

На всем протяжении участок изысканий находится в зоне затопления, сильного, умеренного и слабого подтопления.

Скотомогильники и биотермические ямы, месторождения полезных ископаемых, свалки и полигоны ТБО, кладбища, приаэродромные территории отсутствуют.`;

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
  // Начальный текст формы уже содержится в шаблоне: сохраняем его заголовки,
  // выделение вариантов и оформление. Пользовательский текст заменяем как раньше.
  if (text.replace(/\r\n?/g, '\n') === SECTION_82_DEFAULT_TEXT) {
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
  return `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:iCs/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="000000"/></w:rPr><w:t xml:space="preserve">${escapedText}</w:t></w:r></w:p>`;
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
