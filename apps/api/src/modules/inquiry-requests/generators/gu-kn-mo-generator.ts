/**
 * Генератор справки ГУ КН МО (Главное управление культурного наследия МО)
 * Шаблон: 1. ГУ КН МО.docx
 */

import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import * as PizZip from 'pizzip';

// Плейсхолдеры в шаблоне (текст с красным цветом)
const PLACEHOLDERS = {
  // Дата (формат DD.MM.YYYY) - красным цветом
  DATE: '27.08.2025',
  // Средняя часть номера (в ЭА-1-XXX-YY-N) - красным цветом
  NUMBER_MIDDLE: '124',
  // Адрес объекта (красным цветом)
  // Формат для МО: г.Куровское, Орехово-Зуевского г.о., Московской области
  ADDRESS: 'г.Куровское, Орехово-Зуевского г.о., Московской области',
  // Название объекта (красным цветом)
  OBJECT_NAME:
    '«Капитальный ремонт мостового перехода через р.Нерская, расположенного на Новинском шоссе г.Куровское Орехово-Зуевского городского округа Московской области»',
  // Кадастровые кварталы (красным цветом)
  CADASTRAL: '50:24:0070101, 50:24:0070214, 50:24:0070608, 50:24:0070501, 50:24:0070602',
};

// Исполнитель из шаблона
const EXECUTOR_NAME = 'Исполнитель: Бурнацкая Ирина';
const EXECUTOR_PHONE = '+7 495 225-7127, доб.114';

export interface Executor {
  name: string;
  phone: string;
}

export interface GuKnMoGeneratorParams {
  date: string;
  numberMiddle: string;
  year: string;
  objectName: string;
  objectAddress: string;
  cadastralNumbers?: string;
  executors: Executor[];
}

export interface GuKnMoGeneratorResult {
  fileName: string;
  filePath: string;
  buffer: Buffer;
}

/**
 * Генерирует справку ГУ КН МО
 */
export async function generateGuKnMoInquiry(
  templatePath: string,
  outputDir: string,
  params: GuKnMoGeneratorParams,
): Promise<GuKnMoGeneratorResult> {
  // Читаем шаблон
  const templateContent = await readFile(templatePath);
  const zip = new PizZip(templateContent);

  // Получаем XML документа
  let docXml = zip.file('word/document.xml')?.asText() || '';

  // 1. Заменяем дату
  docXml = replaceDate(docXml, params.date);

  // 2. Заменяем среднюю часть номера
  docXml = replaceNumberMiddle(docXml, params.numberMiddle);

  // 3. Заменяем адрес объекта (формат МО)
  docXml = replaceAddress(docXml, params.objectAddress);

  // 4. Заменяем название объекта
  docXml = replaceObjectName(docXml, params.objectName);

  // 5. Заменяем кадастровые кварталы
  if (params.cadastralNumbers) {
    docXml = replaceCadastralNumbers(docXml, params.cadastralNumbers);
  }

  // 6. Заменяем исполнителя
  docXml = replaceExecutor(docXml, params.executors);

  // 7. Убираем красный цвет (FF0000)
  docXml = removeRedColor(docXml);

  // 8. Расширяем текстовое поле если нужно
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
  const fileName = `ГУ_КН_МО_${safeObjectName}_${Date.now()}.docx`;
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
 * Заменяет дату
 */
function replaceDate(xml: string, newDate: string): string {
  // Заменяем дату в двух форматах: 27.08.2025 и 27.08 + .2025
  const escapedDate = escapeXml(newDate);

  // Разбиваем новую дату
  const parts = newDate.split('.');
  if (parts.length === 3) {
    const dayMonth = `${parts[0]}.${parts[1]}`;
    const year = `.${parts[2]}`;

    // Заменяем "27.08" на новую дату (день.месяц)
    xml = xml.replace(/>27\.08</g, `>${escapeXml(dayMonth)}<`);
    // Заменяем ".2025" на новый год
    xml = xml.replace(/>\.2025</g, `>${escapeXml(year)}<`);
  }

  // Также пробуем заменить полную дату если она есть
  xml = xml.replace(/>27\.08\.2025</g, `>${escapedDate}<`);

  return xml;
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
  // Оборачиваем в кавычки если их нет
  let formattedName = newObjectName;
  if (!formattedName.startsWith('«')) {
    formattedName = `«${formattedName}`;
  }
  if (!formattedName.endsWith('»')) {
    formattedName = `${formattedName}»`;
  }

  return xml.replace(
    new RegExp(escapeRegex(PLACEHOLDERS.OBJECT_NAME), 'g'),
    escapeXml(formattedName),
  );
}

/**
 * Заменяет кадастровые кварталы
 */
function replaceCadastralNumbers(xml: string, newCadastral: string): string {
  return xml.replace(
    new RegExp(escapeRegex(PLACEHOLDERS.CADASTRAL), 'g'),
    escapeXml(newCadastral),
  );
}

/**
 * Заменяет исполнителя
 */
function replaceExecutor(xml: string, executors: Executor[]): string {
  const executor = executors[0];

  if (executor && executor.name.trim()) {
    xml = xml.replace(EXECUTOR_NAME, `Исполнитель: ${escapeXml(executor.name)}`);
    if (executor.phone) {
      xml = xml.replace(EXECUTOR_PHONE, escapeXml(executor.phone));
    }
  }

  return xml;
}

/**
 * Убирает красный цвет из текста
 */
function removeRedColor(xml: string): string {
  // Убираем <w:color w:val="FF0000"/>
  xml = xml.replace(/<w:color w:val="FF0000"\/>/g, '');
  return xml;
}

/**
 * Расширяет текстовые поля (textbox) для корректного отображения номера
 */
function widenTextboxes(xml: string): string {
  // Расширяем типичные размеры textbox на ~200000 EMU (~0.5 см)
  xml = xml.replace(/cx="241\d{4}"/g, 'cx="2700000"');
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

