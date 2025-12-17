/**
 * Генератор справки ЦГМС (фон-климат)
 * Шаблоны: 0. ЦГМС-Р фон-климат.docx (Москва), 7. ЦГМС-Р фон-климат.docx (МО)
 */

import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import * as PizZip from 'pizzip';

// Плейсхолдеры в шаблоне (текст подсвечен зелёным)
const PLACEHOLDERS = {
  // Дата (формат DD.MM.YYYY) - разбита на "20.07.202" + "3"
  DATE_PART1: '20.07.202',
  DATE_PART2: '3',
  // Средняя часть номера (в ЭА-1-XXX-YY-N)
  NUMBER_MIDDLE: '201',
  // Последняя цифра года (для добавления порядкового номера справки)
  YEAR_LAST_DIGIT: '5',
  // Химические вещества
  CHEMICALS: 'диоксид серы, оксид углерода, диоксид азота, взвешенные вещества',
  // Название объекта (БЕЗ открывающей кавычки, она отдельным элементом)
  OBJECT_NAME: 'Жилая и общественно-деловая застройка с объектами социального назначения»',
  // Адрес объекта (только этот текст, не трогаем адрес юр. лица в таблице!)
  ADDRESS: 'Москва,',
};

// Исполнители из шаблона (точные строки для замены)
const EXECUTOR_NAMES = [
  'Исполнитель: Штефанова Ульяна ',
  'Исполнитель: Бурнацкая Ирина ',
  'Исполнитель: Ермолов Томас',
];

// Телефоны исполнителей (для удаления)
// Телефон Бурнацкой разбит на части: "+7 495 225-712" + "7" + ", доб.114"
const EXECUTOR_PHONES = [
  '               +7 9165939341',
  '               +7 495 225-712',
  '              +7 968 640 7221',
];

// Дополнительные части телефонов (разбитые в XML)
const PHONE_EXTRA_PARTS = ['7', ', доб.114'];

export interface Executor {
  name: string;
  phone: string;
}

export interface CgmsGeneratorParams {
  // Дата запроса (формат DD.MM.YYYY)
  date: string;
  // Средняя часть номера
  numberMiddle: string;
  // Год (2 цифры)
  year: string;
  // Химические вещества
  chemicals: string;
  // Название объекта
  objectName: string;
  // Адрес объекта
  objectAddress: string;
  // Исполнители (массив {name, phone})
  executors: Executor[];
}

export interface CgmsGeneratorResult {
  fileName: string;
  filePath: string;
  buffer: Buffer;
}

/**
 * Генерирует справку ЦГМС
 */
export async function generateCgmsInquiry(
  templatePath: string,
  outputDir: string,
  params: CgmsGeneratorParams,
): Promise<CgmsGeneratorResult> {
  // Читаем шаблон
  const templateContent = await readFile(templatePath);
  const zip = new PizZip(templateContent);

  // Получаем XML документа
  let docXml = zip.file('word/document.xml')?.asText() || '';

  // Замены с использованием подсветки (ДО removeHighlights):
  
  // 1. Заменяем исполнителей
  docXml = replaceExecutors(docXml, params.executors);

  // 2. Заменяем адрес объекта (только подсвеченный, не адрес юр. лица!)
  docXml = replaceAddress(docXml, params.objectAddress);

  // 3. Убираем всю зелёную подсветку
  docXml = removeHighlights(docXml);

  // Замены после удаления подсветки:

  // 4. Заменяем дату
  docXml = replaceDate(docXml, params.date);

  // 5. Заменяем среднюю часть номера
  docXml = replaceNumberMiddle(docXml, params.numberMiddle);

  // 6. Заменяем химические вещества
  docXml = replaceChemicals(docXml, params.chemicals);

  // 7. Заменяем название объекта
  docXml = replaceObjectName(docXml, params.objectName);
  
  // Сохраняем обратно в архив
  zip.file('word/document.xml', docXml);

  // Генерируем буфер
  const buffer = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Buffer;

  // Создаём директорию если нужно
  await mkdir(outputDir, { recursive: true });

  // Генерируем имя файла
  const safeObjectName = params.objectName
    .replace(/[«»"']/g, '')
    .replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, '')
    .substring(0, 30)
    .trim();
  const fileName = `ЦГМС_${safeObjectName}_${Date.now()}.docx`;
  const filePath = join(outputDir, fileName);

  // Записываем файл
  await writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    buffer,
  };
}

/**
 * Убирает зелёную подсветку (highlight="green") из XML
 */
function removeHighlights(xml: string): string {
  // Убираем <w:highlight w:val="green"/>
  xml = xml.replace(/<w:highlight w:val="green"\/>/g, '');
  // Убираем <w:highlight w:val="green">...</w:highlight>
  xml = xml.replace(/<w:highlight w:val="green">[^<]*<\/w:highlight>/g, '');
  return xml;
}

/**
 * Заменяет дату в документе
 * Дата разбита на части в XML: "20.07.202" + "3"
 */
function replaceDate(xml: string, newDate: string): string {
  // Новая дата разбиваем так же как в шаблоне
  const newDatePart1 = newDate.slice(0, -1); // Всё кроме последней цифры
  const newDatePart2 = newDate.slice(-1);    // Последняя цифра
  
  // Заменяем первую часть
  xml = xml.replace(
    new RegExp(`(>)${escapeRegex(PLACEHOLDERS.DATE_PART1)}(<)`, 'g'),
    `$1${newDatePart1}$2`,
  );
  
  // Заменяем последнюю цифру года даты
  // Ищем "3" который идёт в контексте даты (после первой части)
  const dateContextPattern = new RegExp(
    `(${escapeRegex(newDatePart1)}</w:t></w:r><w:r[^>]*><w:rPr>[^<]*(?:<[^>]*>[^<]*)*</w:rPr><w:t[^>]*>)${escapeRegex(PLACEHOLDERS.DATE_PART2)}(</w:t>)`,
    'g',
  );
  xml = xml.replace(dateContextPattern, `$1${newDatePart2}$2`);

  return xml;
}

/**
 * Заменяет среднюю часть номера (201 → новое значение)
 * В шаблоне номер разбит: "ЭА", "-", "1", "-", "201", "-", "2", "5"
 */
function replaceNumberMiddle(xml: string, newMiddle: string): string {
  // Заменяем "201" на новую среднюю часть
  xml = xml.replace(
    new RegExp(`(>)${escapeRegex(PLACEHOLDERS.NUMBER_MIDDLE)}(<)`, 'g'),
    `$1${escapeXml(newMiddle)}$2`,
  );
  
  return xml;
}

/**
 * Заменяет химические вещества
 */
function replaceChemicals(xml: string, newChemicals: string): string {
  const oldChemicals = PLACEHOLDERS.CHEMICALS;
  return xml.replace(
    new RegExp(escapeRegex(oldChemicals), 'g'),
    escapeXml(newChemicals),
  );
}

/**
 * Заменяет название объекта
 * Открывающая кавычка «» идёт отдельным элементом, заменяем только название
 */
function replaceObjectName(xml: string, newObjectName: string): string {
  // Убираем кавычки из нового названия если есть (кавычки уже в шаблоне)
  let formattedName = newObjectName
    .replace(/^«/, '')
    .replace(/»$/, '');
  
  // Добавляем закрывающую кавычку (она часть плейсхолдера)
  formattedName = formattedName + '»';
  
  return xml.replace(
    new RegExp(escapeRegex(PLACEHOLDERS.OBJECT_NAME), 'g'),
    escapeXml(formattedName),
  );
}

/**
 * Заменяет адрес объекта (только адрес после "расположенному по адресу:")
 * НЕ трогает адрес юр. лица в таблице!
 */
function replaceAddress(xml: string, newAddress: string): string {
  let formattedAddress = newAddress.trim();
  if (!formattedAddress.endsWith('.')) {
    formattedAddress += '.';
  }
  
  // Ищем подсвеченный адрес: <w:highlight w:val="green"/>...<w:t>Москва,</w:t>
  // Между highlight и </w:rPr> могут быть другие теги (например <w:u w:val="none"/>)
  const addressPattern = /(<w:highlight w:val="green"\/>.*?<\/w:rPr><w:t[^>]*>)Москва,(<\/w:t>)/gs;
  xml = xml.replace(addressPattern, `$1${escapeXml(formattedAddress)}$2`);
  
  return xml;
}

/**
 * Форматирует телефон для вставки в документ (с отступом как в шаблоне)
 */
function formatPhoneForDoc(phone: string): string {
  // Добавляем отступ как в шаблоне (15 пробелов)
  return '               ' + phone;
}

/**
 * Заменяет блоки исполнителей
 * В шаблоне 3 исполнителя — заменяем первого на нового, остальных удаляем
 */
function replaceExecutors(xml: string, executors: Executor[]): string {
  const executor = executors[0]; // Берём только первого
  
  // Первый исполнитель — заменяем
  if (executor && executor.name.trim()) {
    xml = xml.replace(EXECUTOR_NAMES[0], `Исполнитель: ${escapeXml(executor.name)}`);
    if (executor.phone) {
      xml = xml.replace(EXECUTOR_PHONES[0], formatPhoneForDoc(escapeXml(executor.phone)));
    } else {
      xml = xml.replace(EXECUTOR_PHONES[0], '');
    }
  } else {
    xml = xml.replace(EXECUTOR_NAMES[0], '');
    xml = xml.replace(EXECUTOR_PHONES[0], '');
  }
  
  // Остальных исполнителей удаляем
  for (let i = 1; i < EXECUTOR_NAMES.length; i++) {
    xml = xml.replace(EXECUTOR_NAMES[i], '');
    xml = xml.replace(EXECUTOR_PHONES[i], '');
  }
  
  // Убираем дополнительные части разбитых телефонов (они шаблонные, не нужны)
  for (const part of PHONE_EXTRA_PARTS) {
    const pattern = new RegExp(
      `(<w:highlight w:val="green"\\/><\\/w:rPr><w:t[^>]*>)${escapeRegex(part)}(<\\/w:t>)`,
      'g',
    );
    xml = xml.replace(pattern, '$1$2');
  }
  
  return xml;
}

/**
 * Экранирует строку для использования в регулярном выражении
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Экранирует специальные символы XML
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


