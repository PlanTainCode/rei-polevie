/**
 * Генератор справки ЦГМС-Р фон-климат (Московская область)
 * Шаблон: 7. ЦГМС-Р фон-климат.docx
 */

import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import * as PizZip from 'pizzip';

const PLACEHOLDERS = {
  DATE: '27.08.2025',
  NUMBER_MIDDLE: '124',
  CHEMICALS: 'диоксид серы, оксид углерода, диоксид азота, взвешенные вещества',
  OBJECT_NAME: 'Жилая и общественно-деловая застройка с объектами социального назначения»',
  ADDRESS: 'Москва, ',
};

const EXECUTOR_NAME_OLD = 'Бурнацкая Ирина';
const EXECUTOR_PHONE_OLD = '+7 495 225-7127';
// Добавочный номер разбит в шаблоне на части: ", доб.1" + "14"
const EXECUTOR_EXT_PART1 = ', доб.1';
const EXECUTOR_EXT_PART2 = '14';

export interface Executor {
  name: string;
  phone: string;
}

export interface CgmsMoGeneratorParams {
  date: string;
  numberMiddle: string;
  year: string;
  chemicals: string;
  objectName: string;
  objectAddress: string;
  executors: Executor[];
}

export interface CgmsMoGeneratorResult {
  fileName: string;
  filePath: string;
  buffer: Buffer;
}

export async function generateCgmsMoInquiry(
  templatePath: string,
  outputDir: string,
  params: CgmsMoGeneratorParams,
): Promise<CgmsMoGeneratorResult> {
  const templateContent = await readFile(templatePath);
  const zip = new PizZip(templateContent);

  let docXml = zip.file('word/document.xml')?.asText() || '';

  docXml = replaceDate(docXml, params.date);
  docXml = replaceNumberMiddle(docXml, params.numberMiddle);
  docXml = replaceChemicals(docXml, params.chemicals);
  docXml = replaceObjectName(docXml, params.objectName);
  docXml = replaceAddress(docXml, params.objectAddress);
  docXml = replaceExecutor(docXml, params.executors);
  docXml = removeRedColor(docXml);
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
  const fileName = `ЦГМС_МО_${safeObjectName}_${Date.now()}.docx`;
  const filePath = join(outputDir, fileName);

  await writeFile(filePath, buffer);

  return { fileName, filePath, buffer };
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

function replaceChemicals(xml: string, newChemicals: string): string {
  return xml.replace(
    new RegExp(escapeRegex(PLACEHOLDERS.CHEMICALS), 'g'),
    escapeXml(newChemicals),
  );
}

function replaceObjectName(xml: string, newObjectName: string): string {
  // Убираем кавычки из нового названия, добавляем закрывающую (она в плейсхолдере)
  let formattedName = newObjectName
    .replace(/^«/, '')
    .replace(/»$/, '');
  formattedName = formattedName + '»';
  
  return xml.replace(
    new RegExp(escapeRegex(PLACEHOLDERS.OBJECT_NAME), 'g'),
    escapeXml(formattedName),
  );
}

function replaceAddress(xml: string, newAddress: string): string {
  // Адрес должен заканчиваться точкой
  let formattedAddress = newAddress.trim();
  if (!formattedAddress.endsWith('.')) {
    formattedAddress += '.';
  }
  
  // Заменяем "Москва, " на новый адрес (с точкой)
  xml = xml.replace(
    new RegExp(`>${escapeRegex(PLACEHOLDERS.ADDRESS)}<`, 'g'),
    `>${escapeXml(formattedAddress)}<`,
  );
  
  // Удаляем "..." после адреса (плейсхолдер в шаблоне)
  xml = xml.replace(/>\.\.\.+</g, '><');
  
  // Удаляем одиночную точку после многоточия (она отдельным тегом без красного цвета)
  xml = xml.replace(/<\/w:rPr><w:t>\.<\/w:t><\/w:r><\/w:p>/g, '</w:rPr><w:t></w:t></w:r></w:p>');
  
  return xml;
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
  return xml.replace(/cx="241\d{4}"/g, 'cx="2700000"');
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

