/**
 * Генератор справки МинПрироды РФ
 * Шаблон: 8. МинПрироды РФ.docx
 */

import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import * as PizZip from 'pizzip';

const PLACEHOLDERS = {
  DATE: '22.05.2025',
  // Номер целиком: ЭА-1-93-25-5
  NUMBER_FULL: 'ЭА-1-93-25-5',
  // Адрес разбит на части, собираем полный текст
  ADDRESS_PARTS: ['САО г', '.М', 'осквы на территории районов ', 'Бескудниковский', ' и ', 'Дегунино', ' Западное'],
  // Объект тоже разбит
  OBJECT_PARTS: [
    'Реконструкция (снос и восстановление) сетей связи ПАО МГТС по объекту: «Технологическая часть ТПУ на станции метро «',
    'Селигерская',
    ' ул.». Этап 1.3: «Технологическая часть транспортно-пересадочного узла на станции метро «',
    'Селигерская',
    ' улица». Уширение ',
    'Коровинского',
    ' шоссе и ',
    'Селигерской',
    ' улицы. Пешеходный переход»',
  ],
};

// Исполнители в шаблоне (фамилия и имя в разных тегах + пустые "Исполнитель:")
const EXECUTOR_TO_REMOVE = [
  '>Штефанова<',
  '> Ульяна <',
  '>Бурнацкая<',
  '> Ирина <',
  '>Исполнитель: <',  // пустые строки "Исполнитель:" (их две)
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

export interface MinprirodaGeneratorParams {
  date: string;
  numberMiddle: string;
  year: string;
  objectName: string;
  objectAddress: string;
  executors: Executor[];
}

export interface MinprirodaGeneratorResult {
  fileName: string;
  filePath: string;
  buffer: Buffer;
}

export async function generateMinprirodaInquiry(
  templatePath: string,
  outputDir: string,
  params: MinprirodaGeneratorParams,
): Promise<MinprirodaGeneratorResult> {
  const templateFileName = templatePath.split('/').pop() || '';
  const orderFromFileName = templateFileName.charAt(0);

  const templateContent = await readFile(templatePath);
  const zip = new PizZip(templateContent);

  let docXml = zip.file('word/document.xml')?.asText() || '';

  // 1. Заменяем номер целиком (он в одном теге)
  const newNumber = `ЭА-1-${params.numberMiddle}-${params.year}-${orderFromFileName}`;
  docXml = docXml.replace(PLACEHOLDERS.NUMBER_FULL, newNumber);

  // 2. Заменяем дату
  docXml = replaceDate(docXml, params.date);

  // 3. Заменяем адрес (первую часть на новый адрес, остальные очищаем)
  docXml = replaceAddress(docXml, params.objectAddress);

  // 4. Заменяем объект (первую часть на новое название, остальные очищаем)
  docXml = replaceObjectName(docXml, params.objectName);

  // 5. Заменяем исполнителей
  docXml = replaceExecutors(docXml, params.executors);

  // 6. Убираем зелёную подсветку
  docXml = removeHighlights(docXml);

  // 7. Убираем подчёркивание
  docXml = removeUnderlines(docXml);

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
  const fileName = `МинПрироды_${safeObjectName}_${Date.now()}.docx`;
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

function replaceAddress(xml: string, newAddress: string): string {
  // Заменяем первую часть адреса на новый, остальные очищаем
  const parts = PLACEHOLDERS.ADDRESS_PARTS;
  
  // Первая часть — заменяем на новый адрес
  xml = xml.replace(new RegExp(`(>)${escapeRegex(parts[0])}(<)`, 'g'), `$1${escapeXml(newAddress)}$2`);
  
  // Остальные части — очищаем
  for (let i = 1; i < parts.length; i++) {
    xml = xml.replace(new RegExp(`(>)${escapeRegex(parts[i])}(<)`, 'g'), '$1$2');
  }
  
  return xml;
}

function replaceObjectName(xml: string, newObjectName: string): string {
  const parts = PLACEHOLDERS.OBJECT_PARTS;
  const formattedName = newObjectName.replace(/^«/, '').replace(/»$/, '');
  
  // Первая часть — заменяем на новое название с открывающей кавычкой
  xml = xml.replace(
    new RegExp(`(>)${escapeRegex(parts[0])}(<)`, 'g'),
    `$1«${escapeXml(formattedName)}»$2`,
  );
  
  // Остальные части — очищаем
  for (let i = 1; i < parts.length; i++) {
    xml = xml.replace(new RegExp(`(>)${escapeRegex(parts[i])}(<)`, 'g'), '$1$2');
  }
  
  return xml;
}

function replaceExecutors(xml: string, executors: Executor[]): string {
  const executor = executors[0];

  // Удаляем целые параграфы со Штефановой и Бурнацкой
  // Параграф: <w:p ...>...</w:p>
  xml = xml.replace(/<w:p [^>]*>(?:[^<]|<(?!\/w:p>))*Штефанова(?:[^<]|<(?!\/w:p>))*<\/w:p>/g, '');
  xml = xml.replace(/<w:p [^>]*>(?:[^<]|<(?!\/w:p>))*Бурнацкая(?:[^<]|<(?!\/w:p>))*<\/w:p>/g, '');

  // Ермолов — заменяем на нового исполнителя
  if (executor && executor.name.trim()) {
    xml = xml.replace(
      '>Исполнитель: Ермолов Томас<',
      `>Исполнитель: ${escapeXml(executor.name)}<`,
    );
    if (executor.phone) {
      xml = xml.replace(EXECUTOR_PHONES[2], escapeXml(executor.phone));
    } else {
      xml = xml.replace(EXECUTOR_PHONES[2], '');
    }
  } else {
    xml = xml.replace('>Исполнитель: Ермолов Томас<', '><');
    xml = xml.replace(EXECUTOR_PHONES[2], '');
  }

  // Удаляем телефоны первых двух (если остались)
  xml = xml.replace(EXECUTOR_PHONES[0], '');
  xml = xml.replace(EXECUTOR_PHONES[1], '');

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

