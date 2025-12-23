/**
 * Генератор справки МинПрироды РФ (Московская область)
 * Шаблон: 9. МинПрироды РФ.docx (запросы мо)
 */

import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import * as PizZip from 'pizzip';

const PLACEHOLDERS = {
  DATE: '22.05.2025',
  // Номер в шаблоне: ЭА-1-124-25-900 и ЭА-1-124-25-930
  NUMBER_PREFIX: 'ЭА-1-124-25',
  // Адрес в шаблоне
  ADDRESS: 'г.Куровское, Орехово-Зуевского г.о., Московской области',
  // Объект - длинный текст
  OBJECT_FULL:
    'Реконструкция (снос и восстановление) сетей связи ПАО МГТС по объекту: «Технологическая часть ТПУ на станции метро «Селигерская ул.». Этап 1.3: «Технологическая часть транспортно-пересадочного узла на станции метро «Селигерская улица». Уширение Коровинского шоссе и Селигерской улицы. Пешеходный переход»',
};

export interface Executor {
  name: string;
  phone: string;
}

export interface MinprirodaMoGeneratorParams {
  date: string;
  numberMiddle: string;
  year: string;
  objectName: string;
  objectAddress: string;
  executors: Executor[];
}

export interface MinprirodaMoGeneratorResult {
  fileName: string;
  filePath: string;
  buffer: Buffer;
}

export async function generateMinprirodaMoInquiry(
  templatePath: string,
  outputDir: string,
  params: MinprirodaMoGeneratorParams,
): Promise<MinprirodaMoGeneratorResult> {
  const templateFileName = templatePath.split('/').pop() || '';
  const orderFromFileName = templateFileName.charAt(0);

  const templateContent = await readFile(templatePath);
  const zip = new PizZip(templateContent);

  let docXml = zip.file('word/document.xml')?.asText() || '';

  // 1. Заменяем номер (средняя часть)
  const newNumberPrefix = `ЭА-1-${params.numberMiddle}-${params.year}`;
  docXml = docXml.replace(new RegExp(escapeRegex(PLACEHOLDERS.NUMBER_PREFIX), 'g'), newNumberPrefix);

  // 2. Заменяем дату
  docXml = docXml.replace(new RegExp(escapeRegex(PLACEHOLDERS.DATE), 'g'), escapeXml(params.date));

  // 3. Заменяем адрес
  docXml = replaceAddress(docXml, params.objectAddress);

  // 4. Заменяем объект
  docXml = replaceObjectName(docXml, params.objectName);

  // 5. Заменяем исполнителя
  docXml = replaceExecutor(docXml, params.executors);

  // 6. Убираем красный цвет
  docXml = removeRedColor(docXml);

  // 7. Расширяем textbox
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
  const fileName = `МинПриродыМО_${safeObjectName}_${Date.now()}.docx`;
  const filePath = join(outputDir, fileName);

  await writeFile(filePath, buffer);

  return { fileName, filePath, buffer };
}

function replaceAddress(xml: string, newAddress: string): string {
  // Адрес может быть разбит на теги, ищем паттерн
  const addressPattern =
    /г\.Куровское,\s*Орехово-Зуевского\s*г\.о\.,\s*Московской\s*области/g;

  // Сначала пробуем простую замену
  let result = xml.replace(addressPattern, escapeXml(newAddress));

  // Если не сработало, пробуем по частям
  if (result === xml) {
    // Заменяем начало адреса
    result = result.replace(/>г\.Куровское</g, `>${escapeXml(newAddress)}<`);
    // Очищаем остальные части
    result = result.replace(/>, Орехово-Зуевского г\.о\., Московской области</g, '><');
  }

  return result;
}

function replaceObjectName(xml: string, newObjectName: string): string {
  // Объект длинный, пробуем заменить его целиком или по частям
  const objectPattern =
    /Реконструкция\s*\(снос\s*и\s*восстановление\)\s*сетей\s*связи\s*ПАО\s*МГТС\s*по\s*объекту:\s*«Технологическая\s*часть\s*ТПУ\s*на\s*станции\s*метро\s*«Селигерская\s*ул\.»\.\s*Этап\s*1\.3:\s*«Технологическая\s*часть\s*транспортно-пересадочного\s*узла\s*на\s*станции\s*метро\s*«Селигерская\s*улица»\.\s*Уширение\s*Коровинского\s*шоссе\s*и\s*Селигерской\s*улицы\.\s*Пешеходный\s*переход»/g;

  let result = xml.replace(objectPattern, escapeXml(newObjectName));

  // Если полная замена не сработала, пробуем по первой части
  if (result === xml) {
    // Заменяем начало названия объекта
    result = result.replace(
      />Реконструкция \(снос и восстановление\) сетей связи ПАО МГТС по объекту: «Технологическая часть ТПУ на станции метро «</g,
      `>${escapeXml(newObjectName)}<`,
    );
    // Очищаем продолжения
    result = result.replace(/>Селигерская</g, '><');
    result = result.replace(/> ул\.»\. Этап 1\.3: «Технологическая часть транспортно-пересадочного узла на станции метро «</g, '><');
    result = result.replace(/> улица»\. Уширение </g, '><');
    result = result.replace(/>Коровинского</g, '><');
    result = result.replace(/> шоссе и </g, '><');
    result = result.replace(/>Селигерской</g, '><');
    result = result.replace(/> улицы\. Пешеходный переход»</g, '><');
  }

  return result;
}

function replaceExecutor(xml: string, executors: Executor[]): string {
  if (!executors || executors.length === 0) return xml;

  const executor = executors[0];
  let result = xml;

  // Исполнитель в шаблоне: Бурнацкая Ирина
  if (executor.name) {
    result = result.replace(/>Бурнацкая</g, `>${escapeXml(executor.name.split(' ')[0])}<`);
    result = result.replace(/> Ирина </g, ` ${executor.name.split(' ').slice(1).join(' ') || ''} `);
    // Простая замена если имя цельное
    result = result.replace(/Бурнацкая Ирина/g, escapeXml(executor.name));
  }

  // Заменяем телефон исполнителя (обрезанный в шаблоне: "+7 495 225-712" + "7" в отдельных тегах)
  // НЕ трогаем полный телефон в таблице реквизитов!
  if (executor.phone) {
    // Заменяем обрезанный телефон (с пробелами перед ним в xml:space="preserve")
    result = result.replace(
      />\s*\+7 495 225-712</g,
      `>${escapeXml(executor.phone)}<`,
    );
    // Удаляем последнюю цифру "7" которая в отдельном теге после обрезанного телефона
    result = result.replace(/>7<\/w:t><\/w:r><\/w:p>/g, '></w:t></w:r></w:p>');
    
    // Удаляем добавочный номер (разбит на части)
    result = result.replace(/>, доб\.1</g, '><');
    result = result.replace(/>14</g, '><');
  }

  return result;
}

function removeRedColor(xml: string): string {
  return xml.replace(/<w:color\s+w:val="FF0000"\s*\/>/g, '');
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

