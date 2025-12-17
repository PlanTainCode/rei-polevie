/**
 * Генератор справки ДПиООС Москвы (Департамент природопользования)
 * Шаблон: 1. ДПиООС Москвы.docx
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import PizZip from 'pizzip';

export interface Executor {
  name: string;
  phone: string;
}

export interface DpioosGeneratorParams {
  // Дата запроса (формат: DD.MM.YYYY)
  date: string;
  // Средняя часть номера (вводит пользователь)
  numberMiddle: string;
  // Год (2 цифры)
  year: string;
  // Название объекта
  objectName: string;
  // Адрес объекта (район, округ, улица)
  objectAddress: string;
  // Исполнители (массив {name, phone})
  executors: Executor[];
}

export interface DpioosGeneratorResult {
  fileName: string;
  filePath: string;
  buffer: Buffer;
}

/**
 * Генерирует справку ДПиООС
 */
export async function generateDpioosInquiry(
  templatePath: string,
  outputDir: string,
  params: DpioosGeneratorParams,
): Promise<DpioosGeneratorResult> {
  // Извлекаем порядковый номер из имени шаблона (первый символ)
  const templateFileName = templatePath.split('/').pop() || '';
  const orderFromFileName = templateFileName.charAt(0);

  // Читаем шаблон
  const templateContent = await readFile(templatePath);
  const zip = new PizZip(templateContent);

  // Получаем XML документа
  let docXml = zip.file('word/document.xml')?.asText() || '';

  // 1. Заменяем дату (26.11.2025 -> новая дата)
  docXml = replaceDate(docXml, params.date);

  // 2. Заменяем среднюю часть номера (? -> numberMiddle)
  docXml = replaceNumberMiddle(docXml, params.numberMiddle);

  // 3. Добавляем порядковый номер в конец номера
  docXml = addOrderToNumber(docXml, orderFromFileName);

  // 4. Расширяем текстовые поля для номера
  docXml = widenTextboxes(docXml);

  // 5. Заменяем адрес объекта
  docXml = replaceAddress(docXml, params.objectAddress);

  // 6. Заменяем название объекта
  docXml = replaceObjectName(docXml, params.objectName);

  // 7. Заменяем исполнителей
  docXml = replaceExecutors(docXml, params.executors);

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
  const fileName = `ДПиООС_${safeObjectName}_${Date.now()}.docx`;
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
 * Заменяет дату в документе
 * Дата в шаблоне разбита: "26.11" + ".202" + "5"
 */
function replaceDate(xml: string, newDate: string): string {
  // Разбираем новую дату
  const match = newDate.match(/^(\d{2}\.\d{2})\.(\d{4})$/);
  if (!match) return xml;
  
  const [, dayMonth, year] = match;
  const yearPrefix = year.slice(0, 3); // "202"
  const yearSuffix = year.slice(3);    // "5"
  
  // Заменяем части даты:
  // "26.11" -> новый день.месяц
  xml = xml.replace(/>26\.11</g, `>${dayMonth}<`);
  
  // ".202" остаётся как есть (если год 202X)
  // Последняя цифра года
  // Ищем паттерн: >.202</w:t>...<w:t>5</w:t>
  // Заменяем 5 на новую последнюю цифру
  const yearPattern = /(>\.202<\/w:t><\/w:r><w:r[^>]*><w:rPr>.*?<\/w:rPr><w:t>)5(<\/w:t>)/gs;
  xml = xml.replace(yearPattern, `$1${yearSuffix}$2`);
  
  return xml;
}

/**
 * Заменяет среднюю часть номера (? -> numberMiddle)
 */
function replaceNumberMiddle(xml: string, newMiddle: string): string {
  // В шаблоне ? в отдельном теге
  xml = xml.replace(/>(\?)<\/w:t>/g, `>${newMiddle}</w:t>`);
  return xml;
}

/**
 * Заменяет год в номере на текущий и добавляет порядковый номер
 * Шаблон: ЭА-1-?-23 -> ЭА-1-XXX-25-1
 */
function addOrderToNumber(xml: string, order: string): string {
  const currentYear = new Date().getFullYear().toString().slice(-2); // "25"
  const lastDigit = currentYear.slice(-1); // "5"
  
  // Структура: >2</w:t>...<w:t>3</w:t></w:r></w:p> (год 23)
  // Заменяем 3 на текущую последнюю цифру года и добавляем -N
  const pattern = /(>2<\/w:t><\/w:r><w:r[^>]*><w:rPr>)(.*?)(<\/w:rPr><w:t>)3(<\/w:t><\/w:r>)(<\/w:p>)/gs;
  
  xml = xml.replace(pattern, (_, beforeRPr, rPrContent, beforeT, afterT, endP) => {
    // Создаём новый тег с порядковым номером
    const newRun = `<w:r><w:rPr>${rPrContent}</w:rPr><w:t>-${order}</w:t></w:r>`;
    return `${beforeRPr}${rPrContent}${beforeT}${lastDigit}${afterT}${newRun}${endP}`;
  });
  
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

/**
 * Заменяет адрес объекта
 * Оригинал: "Отрадное СВАО г.Москвы напротив ул.Декабристов 15Б"
 */
function replaceAddress(xml: string, newAddress: string): string {
  // Адрес теперь в одном теге - просто заменяем
  xml = xml.replace(
    />Отрадное СВАО г\.Москвы напротив ул\.Декабристов 15Б<\/w:t>/g,
    `>${escapeXml(newAddress)}</w:t>`,
  );
  
  return xml;
}

/**
 * Заменяет название объекта
 * Находит текст после "по объекту:" и заменяет на новое название
 */
function replaceObjectName(xml: string, newObjectName: string): string {
  // Паттерн: "по объекту: «старое название»"
  // Заменяем содержимое между « и »
  
  // Ищем "Вынос сетей связи по объекту: «ТПУ «Отрадное»»"
  // и заменяем на новое название
  const pattern = /(по объекту:\s*«)[^»]*(»[^»]*»*)/g;
  
  // Упрощённо: заменяем известный текст
  xml = xml.replace(
    /Вынос сетей связи по объекту: «ТПУ/g,
    escapeXml(newObjectName),
  );
  
  // Также заменяем в других местах где может быть название
  xml = xml.replace(
    />Вынос сетей связи по объекту: «</g,
    `>${escapeXml(newObjectName)}<`,
  );
  
  return xml;
}

// Исполнители из шаблона
const ORIGINAL_EXECUTORS = [
  'Штефанова Ульяна',
  'Бурнацкая Ирина',
  'Ермолов Томас',
];

// Телефоны исполнителей из шаблона
const ORIGINAL_PHONES = [
  '+7 9165939341',
  '+7 495 225-7127, доб.114',
  '+7 968 640 7221',
];

/**
 * Заменяет исполнителей
 * В шаблоне 3 исполнителя — заменяем первого на нового, остальных удаляем
 */
function replaceExecutors(xml: string, executors: Executor[]): string {
  const executor = executors[0]; // Берём только первого
  
  // Первый исполнитель — заменяем
  if (executor && executor.name) {
    xml = xml.replace(
      new RegExp(`Исполнитель: ${escapeRegex(ORIGINAL_EXECUTORS[0])}`, 'g'),
      `Исполнитель: ${escapeXml(executor.name)}`,
    );
    if (executor.phone) {
      xml = xml.replace(ORIGINAL_PHONES[0], escapeXml(executor.phone));
    } else {
      xml = xml.replace(ORIGINAL_PHONES[0], '');
    }
  } else {
    xml = xml.replace(
      new RegExp(`Исполнитель: ${escapeRegex(ORIGINAL_EXECUTORS[0])}[^<]*`, 'g'),
      '',
    );
    xml = xml.replace(ORIGINAL_PHONES[0], '');
  }
  
  // Остальных исполнителей удаляем
  for (let i = 1; i < ORIGINAL_EXECUTORS.length; i++) {
    xml = xml.replace(
      new RegExp(`Исполнитель: ${escapeRegex(ORIGINAL_EXECUTORS[i])}[^<]*`, 'g'),
      '',
    );
    xml = xml.replace(ORIGINAL_PHONES[i], '');
  }
  
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

