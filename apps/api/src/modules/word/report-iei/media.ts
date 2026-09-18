import type PizZip from 'pizzip';
import { insertDrawingIntoParagraph } from './xml-text';

const MAX_WIDTH_EMU = 5760000;
const DEFAULT_HEIGHT_EMU = 4050000;

export function buildInlineImageDrawing(params: {
  relId: string;
  docPrId: number;
  widthEmu: number;
  heightEmu: number;
  name: string;
}): string {
  const { relId, docPrId, widthEmu, heightEmu, name } = params;
  return (
    `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/>` +
    `<wp:docPr id="${docPrId}" name="${name}"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

export function imageSizeEmu(buffer: Buffer, ext: string): { width: number; height: number } {
  if ((ext === 'png' || ext === 'PNG') && buffer.length > 24) {
    const w = buffer.readUInt32BE(16);
    const h = buffer.readUInt32BE(20);
    if (w > 0 && h > 0) {
      return { width: MAX_WIDTH_EMU, height: Math.round(MAX_WIDTH_EMU * (h / w)) };
    }
  }
  return { width: MAX_WIDTH_EMU, height: DEFAULT_HEIGHT_EMU };
}

export function addImageToDocxZip(
  zip: PizZip,
  image: { buffer: Buffer; ext: string },
  mediaName: string,
): string {
  zip.file(`word/media/${mediaName}`, image.buffer);

  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) return '';
  let relsXml = relsFile.asText();
  const used = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const relId = `rId${Math.max(0, ...used) + 1}`;
  relsXml = relsXml.replace(
    '</Relationships>',
    `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`,
  );
  zip.file('word/_rels/document.xml.rels', relsXml);

  const ext = image.ext.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') {
    const ctFile = zip.file('[Content_Types].xml');
    if (ctFile) {
      let ctXml = ctFile.asText();
      if (!ctXml.includes('Extension="jpg"') && !ctXml.includes('Extension="jpeg"')) {
        ctXml = ctXml.replace(
          '</Types>',
          '<Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/></Types>',
        );
        zip.file('[Content_Types].xml', ctXml);
      }
    }
  }

  return relId;
}

export function insertFacadePhoto(xml: string, zip: PizZip, image: { buffer: Buffer; ext: string }, paraId: string): string {
  const ext = (image.ext || 'jpg').replace(/^\./, '').toLowerCase();
  const mediaName = `report-iei-facade.${ext}`;
  const relId = addImageToDocxZip(zip, { buffer: image.buffer, ext }, mediaName);
  if (!relId) return xml;

  const usedDocPr = [...xml.matchAll(/<wp:docPr[^>]*\bid="(\d+)"/g)].map((m) => Number(m[1]));
  const size = imageSizeEmu(image.buffer, ext);
  const drawing = buildInlineImageDrawing({
    relId,
    docPrId: Math.max(0, ...usedDocPr) + 1,
    widthEmu: size.width,
    heightEmu: size.height,
    name: mediaName,
  });
  return insertDrawingIntoParagraph(xml, paraId, drawing);
}
