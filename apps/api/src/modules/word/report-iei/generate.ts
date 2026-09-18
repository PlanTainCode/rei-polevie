import PizZip from 'pizzip';
import { SECTION_17, TEMPLATE_CIPHER } from './ids';
import { fitReportIeiIntroAndSection1Tables } from './fit-tables';
import { insertFacadePhoto } from './media';
import { fillReportIeiSection1 } from './section-1';
import { fillReportIeiSection2 } from './section-2';
import { fillReportIeiSection3 } from './section-3';
import { fillReportIeiTitle } from './title';
import type { ReportIeiFillData } from './types';
import { replaceExactTextInWordTextNodes } from './xml-text';

export type ReportIeiMedia = {
  facadePhoto?: { buffer: Buffer; ext: string };
};

/** Шифр в колонтитуле — только для тестов. Генерация колонтитулы не меняет. */
export function fillReportIeiHeaderFooter(xml: string, data: ReportIeiFillData): string {
  let out = xml;
  if (data.reportCipher && data.reportCipher !== TEMPLATE_CIPHER) {
    out = replaceExactTextInWordTextNodes(out, TEMPLATE_CIPHER, data.reportCipher);
  }
  if (data.year && data.year !== '2026') {
    out = out.replace(/>2026</g, `>${data.year}<`);
  }
  return out;
}

export function generateReportIeiDocx(
  templateBuffer: Buffer,
  data: ReportIeiFillData,
  media?: ReportIeiMedia,
): Buffer {
  const zip = new PizZip(templateBuffer);

  const document = zip.file('word/document.xml');
  if (!document) {
    throw new Error('В шаблоне отчёта ИЭИ нет word/document.xml');
  }

  let docXml = document.asText();
  docXml = fillReportIeiTitle(docXml, data);
  docXml = fillReportIeiSection1(docXml, data);
  docXml = fillReportIeiSection2(docXml, data);
  docXml = fillReportIeiSection3(docXml, data);
  if (data.hasFacadePhoto && media?.facadePhoto) {
    docXml = insertFacadePhoto(docXml, zip, media.facadePhoto, SECTION_17.figure13Image);
  }
  docXml = fitReportIeiIntroAndSection1Tables(docXml);
  zip.file('word/document.xml', docXml);

  // Колонтитулы не трогаем: рамка и штамп ГОСТ — якоря relativeFrom=column.
  // Любая замена текста сдвигает колонку и фигуры уезжают за край страницы.

  const settings = zip.file('word/settings.xml');
  if (settings) {
    zip.file('word/settings.xml', ensureDisplayBackgroundShapes(settings.asText()));
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}

function ensureDisplayBackgroundShapes(xml: string): string {
  if (xml.includes('displayBackgroundShape')) return xml;
  return xml.replace(/<w:settings\b[^>]*>/, (open) => `${open}<w:displayBackgroundShape/>`);
}
