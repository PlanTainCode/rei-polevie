import type PizZip from 'pizzip';
import { PDFDocument } from 'pdf-lib';
import { addImageToDocxZip, buildInlineImageDrawing } from '../report-iei/media';
import { insertDrawingIntoParagraph } from '../report-iei/xml-text';

export async function insertIgmiOverview(xml: string, zip: PizZip, buffer: Buffer, fileName: string): Promise<string> {
  const paraId = '3180C077';
  if (!xml.includes(`w14:paraId="${paraId}"`)) throw new Error('Не найдена ячейка обзорной схемы');
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext || !['png', 'jpg', 'jpeg'].includes(ext)) throw new Error('Нужна схема PNG или JPEG');
  const pdf = await PDFDocument.create();
  const image = ext === 'png' ? await pdf.embedPng(buffer) : await pdf.embedJpg(buffer);
  // Вписываем в ячейку шириной 6379 twip, сохраняя пропорции и ограничивая высоту.
  const scale = Math.min(3900000 / image.width, 4500000 / image.height);
  const relId = addImageToDocxZip(zip, { buffer, ext }, `igmi-overview.${ext}`);
  if (!relId) throw new Error('Не найдены связи изображений DOCX');
  const ct = zip.file('[Content_Types].xml')?.asText();
  if (!ct) throw new Error('Не найдены типы содержимого DOCX');
  if (!ct.includes(`Extension="${ext}"`)) {
    zip.file('[Content_Types].xml', ct.replace('</Types>', `<Default Extension="${ext}" ContentType="image/${ext === 'png' ? 'png' : 'jpeg'}"/></Types>`));
  }
  const ids = [...xml.matchAll(/<wp:docPr[^>]*\bid="(\d+)"/g)].map(m => Number(m[1]));
  return insertDrawingIntoParagraph(xml, paraId, buildInlineImageDrawing({
    relId, docPrId: Math.max(0, ...ids) + 1,
    widthEmu: Math.round(image.width * scale), heightEmu: Math.round(image.height * scale),
    name: 'igmi-overview',
  }));
}
