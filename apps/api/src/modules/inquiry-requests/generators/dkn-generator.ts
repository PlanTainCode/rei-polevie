/**
 * Генератор справки ДКН (Департамент культурного наследия) г. Москвы
 * Шаблон: 2. ДКН г.Москвы.docx
 */

import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import * as PizZip from 'pizzip';

// Плейсхолдеры в шаблоне (текст подсвечен зелёным и/или подчёркнут)
const PLACEHOLDERS = {
  // Дата (формат DD.MM.YYYY)
  DATE: '20.07.2023',
  // Средняя часть номера (в ЭА-1-XXX-YY-N) - с зелёной подсветкой
  NUMBER_MIDDLE: '201',
  // Адрес объекта (с зелёной подсветкой)
  ADDRESS: 'ЗАО г.Москвы на территории районов Дорогомилово и Филевский парк',
  // Название объекта (с зелёной подсветкой, без кавычек)
  OBJECT_NAME: 'Путепровод через ж/д пути Смоленского направления МЖД, внеуличные пешеходные переходы, переустройство инженерных сетей и коммуникаций, в т.ч. железнодорожная инфраструктура, с реконструкцией ул.Барклая, Промышленного и Багратионовского проездов, обеспечивающей их функционирование',
};

// Исполнители из шаблона
const EXECUTOR_NAMES = [
  'Исполнитель: Штефанова Ульяна ',
  'Исполнитель: Бурнацкая Ирина ',
  'Исполнитель: Ермолов Томас',
];

// Телефоны исполнителей из шаблона (для замены)
const EXECUTOR_PHONES = [
  '+7 9165939341',
  '+7 495 225-7127, доб.114',
  '+7 968 640 7221',
];

export interface Executor {
  name: string;
  phone: string;
}

export interface DknGeneratorParams {
  date: string;
  numberMiddle: string;
  year: string;
  objectName: string;
  objectAddress: string;
  executors: Executor[];
}

export interface DknGeneratorResult {
  fileName: string;
  filePath: string;
  buffer: Buffer;
}

/**
 * Генерирует справку ДКН
 */
export async function generateDknInquiry(
  templatePath: string,
  outputDir: string,
  params: DknGeneratorParams,
): Promise<DknGeneratorResult> {
  // Извлекаем порядковый номер из имени шаблона (первый символ)
  const templateFileName = templatePath.split('/').pop() || '';
  const orderFromFileName = templateFileName.charAt(0);

  // Читаем шаблон
  const templateContent = await readFile(templatePath);
  const zip = new PizZip(templateContent);

  // Получаем XML документа
  let docXml = zip.file('word/document.xml')?.asText() || '';

  // 1. Заменяем исполнителей
  docXml = replaceExecutors(docXml, params.executors);

  // 2. Заменяем адрес объекта
  docXml = replaceAddress(docXml, params.objectAddress);

  // 3. Заменяем название объекта
  docXml = replaceObjectName(docXml, params.objectName);

  // 4. Убираем зелёную подсветку
  docXml = removeHighlights(docXml);

  // 5. Убираем подчёркивание
  docXml = removeUnderlines(docXml);

  // 6. Заменяем дату
  docXml = replaceDate(docXml, params.date);

  // 7. Заменяем среднюю часть номера
  docXml = replaceNumberMiddle(docXml, params.numberMiddle);

  // 8. Добавляем порядковый номер справки
  docXml = addOrderToNumber(docXml, orderFromFileName);

  // 9. Расширяем текстовое поле с датой и номером
  docXml = widenTextboxes(docXml);

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
  const fileName = `ДКН_${safeObjectName}_${Date.now()}.docx`;
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
 * Убирает зелёную подсветку
 */
function removeHighlights(xml: string): string {
  xml = xml.replace(/<w:highlight w:val="green"\/>/g, '');
  xml = xml.replace(/<w:highlight w:val="green">[^<]*<\/w:highlight>/g, '');
  return xml;
}

/**
 * Убирает подчёркивание (но не w:u w:val="none")
 */
function removeUnderlines(xml: string): string {
  // Убираем все <w:u .../> кроме w:val="none"
  xml = xml.replace(/<w:u w:val="single"\/>/g, '');
  xml = xml.replace(/<w:u w:val="wave"\/>/g, '');
  // Оставляем w:u w:val="none" — это явное отключение подчёркивания
  return xml;
}

/**
 * Заменяет дату
 */
function replaceDate(xml: string, newDate: string): string {
  return xml.replace(
    new RegExp(escapeRegex(PLACEHOLDERS.DATE), 'g'),
    escapeXml(newDate),
  );
}

/**
 * Заменяет среднюю часть номера
 */
function replaceNumberMiddle(xml: string, newMiddle: string): string {
  return xml.replace(
    new RegExp(`(>)${escapeRegex(PLACEHOLDERS.NUMBER_MIDDLE)}(<)`, 'g'),
    `$1${escapeXml(newMiddle)}$2`,
  );
}

/**
 * Добавляет порядковый номер в конец номера
 * Номер: ЭА-1-201-23, нужно: ЭА-1-XXX-YY-N
 * Структура: ...<w:t>2</w:t>...<w:t>3</w:t></w:r></w:p>
 */
function addOrderToNumber(xml: string, order: string): string {
  // Ищем паттерн: >3</w:t></w:r></w:p> в контексте номера (после 2)
  const pattern = /(>2<\/w:t><\/w:r><w:r[^>]*><w:rPr>)(.*?)(<\/w:rPr><w:t>3<\/w:t><\/w:r>)(<\/w:p>)/gs;

  xml = xml.replace(pattern, (_, beforeRPr, rPrContent, afterRPr, endP) => {
    const newRun = `<w:r><w:rPr>${rPrContent}</w:rPr><w:t>-${order}</w:t></w:r>`;
    return `${beforeRPr}${rPrContent}${afterRPr}${newRun}${endP}`;
  });

  return xml;
}

/**
 * Заменяет адрес объекта
 */
function replaceAddress(xml: string, newAddress: string): string {
  return xml.replace(
    new RegExp(escapeRegex(PLACEHOLDERS.ADDRESS), 'g'),
    escapeXml(newAddress),
  );
}

/**
 * Заменяет название объекта
 */
function replaceObjectName(xml: string, newObjectName: string): string {
  // Убираем кавычки из нового названия если есть
  const formattedName = newObjectName.replace(/^«/, '').replace(/»$/, '');

  return xml.replace(
    new RegExp(escapeRegex(PLACEHOLDERS.OBJECT_NAME), 'g'),
    escapeXml(formattedName),
  );
}

/**
 * Заменяет исполнителей
 * В шаблоне 3 исполнителя — заменяем первого на нового, остальных удаляем
 */
function replaceExecutors(xml: string, executors: Executor[]): string {
  const executor = executors[0]; // Берём только первого

  // Первый исполнитель — заменяем
  if (executor && executor.name.trim()) {
    xml = xml.replace(EXECUTOR_NAMES[0], `Исполнитель: ${escapeXml(executor.name)}`);
    if (executor.phone) {
      xml = xml.replace(EXECUTOR_PHONES[0], escapeXml(executor.phone));
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

  return xml;
}

/**
 * Расширяет текстовые поля (textbox) для корректного отображения номера с порядковым числом
 * Универсальная функция — расширяет типичные размеры textbox во всех шаблонах
 */
function widenTextboxes(xml: string): string {
  // Расширяем типичные размеры textbox на ~200000 EMU (~0.5 см)
  xml = xml.replace(/cx="2258060"/g, 'cx="2500000"');
  xml = xml.replace(/cx="2257425"/g, 'cx="2500000"');
  xml = xml.replace(/cx="2256790"/g, 'cx="2500000"');
  // Другие возможные размеры
  xml = xml.replace(/cx="225\d{4}"/g, 'cx="2500000"');
  return xml;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

