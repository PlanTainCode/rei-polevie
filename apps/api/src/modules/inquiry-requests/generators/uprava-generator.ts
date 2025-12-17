/**
 * Генератор справки Управа района
 * Шаблон: 7. Управа района.docx
 */

import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import * as PizZip from 'pizzip';

const PLACEHOLDERS = {
  DATE: '20.07.2023',
  NUMBER_MIDDLE: '201',
  ADDRESS: 'ЗАО г.Москвы на территории районов Дорогомилово и Филевский парк',
  OBJECT_NAME: 'Путепровод через ж/д пути Смоленского направления МЖД, внеуличные пешеходные переходы, переустройство инженерных сетей и коммуникаций, в т.ч. железнодорожная инфраструктура, с реконструкцией ул.Барклая, Промышленного и Багратионовского проездов, обеспечивающей их функционирование',
};

const EXECUTOR_NAMES = [
  'Исполнитель: Штефанова Ульяна ',
  'Исполнитель: Бурнацкая Ирина ',
  'Исполнитель: Ермолов Томас',
];

const EXECUTOR_PHONES = [
  '+7 9165939341',
  '+7 495 225-7127, доб.114',
  '+7 968 640 7221',
];

export interface Executor {
  name: string;
  phone: string;
}

export interface UpravaGeneratorParams {
  date: string;
  numberMiddle: string;
  year: string;
  objectName: string;
  objectAddress: string;
  executors: Executor[];
}

export interface UpravaGeneratorResult {
  fileName: string;
  filePath: string;
  buffer: Buffer;
}

export async function generateUpravaInquiry(
  templatePath: string,
  outputDir: string,
  params: UpravaGeneratorParams,
): Promise<UpravaGeneratorResult> {
  const templateFileName = templatePath.split('/').pop() || '';
  const orderFromFileName = templateFileName.charAt(0);

  const templateContent = await readFile(templatePath);
  const zip = new PizZip(templateContent);

  let docXml = zip.file('word/document.xml')?.asText() || '';

  docXml = replaceExecutors(docXml, params.executors);
  docXml = replaceAddress(docXml, params.objectAddress);
  docXml = replaceObjectName(docXml, params.objectName);
  docXml = removeHighlights(docXml);
  docXml = removeUnderlines(docXml);
  docXml = replaceDate(docXml, params.date);
  docXml = replaceNumberMiddle(docXml, params.numberMiddle);
  docXml = addOrderToNumber(docXml, orderFromFileName);
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
  const fileName = `Управа_${safeObjectName}_${Date.now()}.docx`;
  const filePath = join(outputDir, fileName);

  await writeFile(filePath, buffer);

  return { fileName, filePath, buffer };
}

function removeHighlights(xml: string): string {
  xml = xml.replace(/<w:highlight w:val="green"\/>/g, '');
  xml = xml.replace(/<w:highlight w:val="green">[^<]*<\/w:highlight>/g, '');
  return xml;
}

function removeUnderlines(xml: string): string {
  xml = xml.replace(/<w:u w:val="single"\/>/g, '');
  xml = xml.replace(/<w:u w:val="wave"\/>/g, '');
  return xml;
}

function replaceDate(xml: string, newDate: string): string {
  return xml.replace(new RegExp(escapeRegex(PLACEHOLDERS.DATE), 'g'), escapeXml(newDate));
}

function replaceNumberMiddle(xml: string, newMiddle: string): string {
  return xml.replace(
    new RegExp(`(>)${escapeRegex(PLACEHOLDERS.NUMBER_MIDDLE)}(<)`, 'g'),
    `$1${escapeXml(newMiddle)}$2`,
  );
}

function addOrderToNumber(xml: string, order: string): string {
  const pattern = /(>2<\/w:t><\/w:r><w:r[^>]*><w:rPr>)(.*?)(<\/w:rPr><w:t>3<\/w:t><\/w:r>)(<\/w:p>)/gs;
  xml = xml.replace(pattern, (_, beforeRPr, rPrContent, afterRPr, endP) => {
    const newRun = `<w:r><w:rPr>${rPrContent}</w:rPr><w:t>-${order}</w:t></w:r>`;
    return `${beforeRPr}${rPrContent}${afterRPr}${newRun}${endP}`;
  });
  return xml;
}

function replaceAddress(xml: string, newAddress: string): string {
  return xml.replace(new RegExp(escapeRegex(PLACEHOLDERS.ADDRESS), 'g'), escapeXml(newAddress));
}

function replaceObjectName(xml: string, newObjectName: string): string {
  const formattedName = newObjectName.replace(/^«/, '').replace(/»$/, '');
  return xml.replace(new RegExp(escapeRegex(PLACEHOLDERS.OBJECT_NAME), 'g'), escapeXml(formattedName));
}

function replaceExecutors(xml: string, executors: Executor[]): string {
  const executor = executors[0];

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

  for (let i = 1; i < EXECUTOR_NAMES.length; i++) {
    xml = xml.replace(EXECUTOR_NAMES[i], '');
    xml = xml.replace(EXECUTOR_PHONES[i], '');
  }

  return xml;
}

function widenTextboxes(xml: string): string {
  return xml.replace(/cx="225\d{4}"/g, 'cx="2500000"');
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

