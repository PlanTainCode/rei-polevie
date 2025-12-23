/**
 * Генератор справки Водоканал местный
 * Шаблон: 3. Водоканал местный.docx
 */

import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import * as PizZip from 'pizzip';

// Плейсхолдеры в шаблоне
const PLACEHOLDERS = {
  DATE: '27.08.2025',
  NUMBER_MIDDLE: '124',
  ADDRESS: 'г.Куровское, Орехово-Зуевского г.о., Московской области',
  OBJECT_NAME:
    '«Капитальный ремонт мостового перехода через р.Нерская, расположенного на Новинском шоссе г.Куровское Орехово-Зуевского городского округа Московской области»',
  CADASTRAL: '50:24:0070101, 50:24:0070214, 50:24:0070608, 50:24:0070501, 50:24:0070602',
};

// Исполнитель из шаблона
const EXECUTOR_NAME_OLD = 'Бурнацкая Ирина';
const EXECUTOR_PHONE_OLD = '+7 495 225-7127';
// Добавочный номер разбит в шаблоне на части: ", доб.1" + "14"
const EXECUTOR_EXT_PART1 = ', доб.1';
const EXECUTOR_EXT_PART2 = '14';

export interface Executor {
  name: string;
  phone: string;
}

export interface VodokanalGeneratorParams {
  date: string;
  numberMiddle: string;
  year: string;
  objectName: string;
  objectAddress: string;
  cadastralNumbers?: string;
  executors: Executor[];
}

export interface VodokanalGeneratorResult {
  fileName: string;
  filePath: string;
  buffer: Buffer;
}

/**
 * Генерирует справку Водоканал местный
 */
export async function generateVodokanalInquiry(
  templatePath: string,
  outputDir: string,
  params: VodokanalGeneratorParams,
): Promise<VodokanalGeneratorResult> {
  const templateContent = await readFile(templatePath);
  const zip = new PizZip(templateContent);

  let docXml = zip.file('word/document.xml')?.asText() || '';

  // 1. Заменяем дату
  docXml = replaceDate(docXml, params.date);

  // 2. Заменяем среднюю часть номера
  docXml = replaceNumberMiddle(docXml, params.numberMiddle);

  // 3. Заменяем адрес объекта
  docXml = replaceAddress(docXml, params.objectAddress);

  // 4. Заменяем название объекта
  docXml = replaceObjectName(docXml, params.objectName);

  // 5. Заменяем кадастровые кварталы
  if (params.cadastralNumbers) {
    docXml = replaceCadastralNumbers(docXml, params.cadastralNumbers);
  }

  // 6. Заменяем исполнителя
  docXml = replaceExecutor(docXml, params.executors);

  // 7. Убираем красный цвет
  docXml = removeRedColor(docXml);

  // 8. Расширяем textbox
  docXml = widenTextboxes(docXml);

  zip.file('word/document.xml', docXml);

  const buffer = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  }) as Buffer;

  await mkdir(outputDir, { recursive: true });

  const safeObjectName = params.objectName
    .replace(/[«»"']/g, '')
    .replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s]/g, '')
    .substring(0, 30)
    .trim();
  const fileName = `Водоканал_${safeObjectName}_${Date.now()}.docx`;
  const filePath = join(outputDir, fileName);

  await writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    buffer,
  };
}

function replaceDate(xml: string, newDate: string): string {
  const escapedDate = escapeXml(newDate);
  const parts = newDate.split('.');
  if (parts.length === 3) {
    const dayMonth = `${parts[0]}.${parts[1]}`;
    const year = `.${parts[2]}`;
    xml = xml.replace(/>27\.08</g, `>${escapeXml(dayMonth)}<`);
    xml = xml.replace(/>\.2025</g, `>${escapeXml(year)}<`);
  }
  xml = xml.replace(/>27\.08\.2025</g, `>${escapedDate}<`);
  return xml;
}

function replaceNumberMiddle(xml: string, newMiddle: string): string {
  return xml.replace(
    new RegExp(`(>)${escapeRegex(PLACEHOLDERS.NUMBER_MIDDLE)}(<)`, 'g'),
    `$1${escapeXml(newMiddle)}$2`,
  );
}

function replaceAddress(xml: string, newAddress: string): string {
  return xml.replace(
    new RegExp(escapeRegex(PLACEHOLDERS.ADDRESS), 'g'),
    escapeXml(newAddress),
  );
}

function replaceObjectName(xml: string, newObjectName: string): string {
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

function replaceCadastralNumbers(xml: string, newCadastral: string): string {
  return xml.replace(
    new RegExp(escapeRegex(PLACEHOLDERS.CADASTRAL), 'g'),
    escapeXml(newCadastral),
  );
}

function replaceExecutor(xml: string, executors: Executor[]): string {
  const executor = executors[0];
  if (executor && executor.name.trim()) {
    xml = xml.replace(
      new RegExp(`>${escapeRegex(EXECUTOR_NAME_OLD)}<`, 'g'),
      `>${escapeXml(executor.name)}<`,
    );
    // Заменяем телефон исполнителя (обрезанный в шаблоне: "+7 495 225-712" + "7" в отдельных тегах)
    // НЕ трогаем полный телефон в таблице реквизитов!
    if (executor.phone) {
      // Заменяем обрезанный телефон (с пробелами перед ним в xml:space="preserve")
      xml = xml.replace(
        />\s*\+7 495 225-712</g,
        `>${escapeXml(executor.phone)}<`,
      );
      // Удаляем последнюю цифру "7" которая в отдельном теге после обрезанного телефона
      xml = xml.replace(/>7<\/w:t><\/w:r><\/w:p>/g, '></w:t></w:r></w:p>');
      
      // Удаляем добавочный номер (разбит на части в шаблоне)
      xml = xml.replace(
        new RegExp(`>${escapeRegex(EXECUTOR_EXT_PART1)}<`, 'g'),
        '><',
      );
      xml = xml.replace(
        new RegExp(`>${escapeRegex(EXECUTOR_EXT_PART2)}<`, 'g'),
        '><',
      );
    }
  }
  return xml;
}

function removeRedColor(xml: string): string {
  return xml.replace(/<w:color w:val="FF0000"\/>/g, '');
}

function widenTextboxes(xml: string): string {
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

