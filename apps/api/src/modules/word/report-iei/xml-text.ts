/** Видимый текст docx XML без mammoth — шаблон отчёта слишком тяжёлый и с вложенными textbox. */
export function extractVisibleTextFromDocxXml(xml: string): string {
  return String(xml)
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, (_, text: string) => decodeXmlText(text))
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Замена только внутри настоящего <w:t>.
 * Нельзя писать `<w:t([^>]*)>` — это ловит <w:tbl>/<w:tc>/<w:tr> и сносит штампы ГОСТ.
 */
export function replaceExactTextInWordTextNodes(
  xml: string,
  search: string,
  replacement: string,
): string {
  if (!search || !xml.includes(search)) return xml;
  return String(xml).replace(/<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (full, attrs: string | undefined, text: string) => {
    if (!text.includes(search)) return full;
    return `<w:t${attrs || ''}>${text.split(search).join(escapeXmlText(replacement))}</w:t>`;
  });
}

function lastOpenTag(xml: string, tag: string, pos: number): number {
  return Math.max(xml.lastIndexOf(`<${tag} `, pos), xml.lastIndexOf(`<${tag}>`, pos));
}

function isRealParagraphOpen(xml: string, pos: number): boolean {
  const ch = xml[pos + 4];
  return ch === ' ' || ch === '>' || ch === '/';
}

function indexOfRealParagraphOpen(xml: string, from: number): number {
  let i = from;
  while (i < xml.length) {
    const pos = xml.indexOf('<w:p', i);
    if (pos < 0) return -1;
    if (isRealParagraphOpen(xml, pos)) return pos;
    i = pos + 4;
  }
  return -1;
}

/** Полный <w:p>…</w:p>, включая вложенные w:p в textbox/drawing. */
function findParagraphRange(xml: string, paraId: string): { start: number; end: number } | null {
  const token = `w14:paraId="${paraId}"`;
  const paraIdPos = xml.indexOf(token);
  if (paraIdPos < 0) return null;
  const start = lastOpenTag(xml, 'w:p', paraIdPos);
  if (start < 0) return null;

  let depth = 0;
  let i = start;
  while (i < xml.length) {
    const open = indexOfRealParagraphOpen(xml, i);
    const close = xml.indexOf('</w:p>', i);
    if (close < 0) return null;
    if (open >= 0 && open < close) {
      depth += 1;
      i = open + 4;
    } else {
      depth -= 1;
      i = close + 6;
      if (depth === 0) return { start, end: i };
    }
  }
  return null;
}

function stripHighlightKeepSize(rPr: string): string {
  return rPr
    .replace(/<w:highlight\b[^/]*\/>/g, '')
    .replace(/<w:highlight\b[^>]*>[\s\S]*?<\/w:highlight>/g, '')
    .replace(/<w:shd\b[^/]*\/>/g, '')
    .replace(/<w:shd\b[^>]*>[\s\S]*?<\/w:shd>/g, '');
}

const MEDIA_BLOCK_RE =
  /<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>|<w:drawing\b[\s\S]*?<\/w:drawing>|<w:pict\b[\s\S]*?<\/w:pict>|<w:object\b[\s\S]*?<\/w:object>/g;

function hasAnchoredMedia(para: string): boolean {
  return /<w:drawing\b|<w:pict\b|<w:object\b|<wp:anchor\b|<v:textbox\b/.test(para);
}

function replaceTopLevelWordText(para: string, newText: string): string {
  const blocks: string[] = [];
  const masked = para.replace(MEDIA_BLOCK_RE, (block) => {
    blocks.push(block);
    return `\0MEDIA${blocks.length - 1}\0`;
  });

  let replaced = 0;
  let next = masked.replace(/<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g, (_full, attrs: string | undefined) => {
    if (replaced === 0) {
      replaced += 1;
      return `<w:t xml:space="preserve">${escapeXmlText(newText)}</w:t>`;
    }
    replaced += 1;
    return `<w:t${attrs || ''}></w:t>`;
  });

  if (replaced === 0) {
    const open = next.match(/^<w:p\b[^>]*>/)?.[0];
    if (!open) return para;
    const pPr = next.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] || '';
    const insertAt = open.length + pPr.length;
    next =
      next.slice(0, insertAt) +
      `<w:r><w:t xml:space="preserve">${escapeXmlText(newText)}</w:t></w:r>` +
      next.slice(insertAt);
  }

  let stripped = false;
  next = next.replace(/<w:r(\s[^>]*)?>([\s\S]*?)<\/w:r>/g, (full, attrs: string | undefined, body: string) => {
    if (stripped || !/<w:t\b/.test(body) || /\0MEDIA/.test(body)) return full;
    stripped = true;
    const rPr = body.match(/<w:rPr[\s\S]*?<\/w:rPr>/)?.[0];
    if (!rPr) return full;
    return `<w:r${attrs || ''}>${body.replace(rPr, stripHighlightKeepSize(rPr))}</w:r>`;
  });

  return next.replace(/\0MEDIA(\d+)\0/g, (_, index: string) => blocks[Number(index)] || '');
}

/** Меняет текст абзаца, оставляя pPr, rPr и drawing/pict/object/textbox. Не подставляет Times 12pt. */
export function replaceParagraphTextKeepFormatting(
  xml: string,
  paraId: string,
  newText: string,
): string {
  const range = findParagraphRange(xml, paraId);
  if (!range) return xml;
  const para = xml.slice(range.start, range.end);
  if (para.includes('<w:sectPr')) return xml;
  return xml.slice(0, range.start) + replaceTopLevelWordText(para, newText) + xml.slice(range.end);
}

/** Только абзац — даже если он в ячейке с соседними абзацами титула. Якорь фигуры не сносим. */
export function removeParagraphOnly(xml: string, paraId: string): string {
  const range = findParagraphRange(xml, paraId);
  if (!range) return xml;
  const para = xml.slice(range.start, range.end);
  if (para.includes('<w:sectPr') || hasAnchoredMedia(para)) return xml;
  return xml.slice(0, range.start) + xml.slice(range.end);
}

/** Удаляет абзац вместе с drawing/pict — для шаблонной картинки-примера, не для рамки/sectPr. */
export function removeParagraphIncludingMedia(xml: string, paraId: string): string {
  const range = findParagraphRange(xml, paraId);
  if (!range) return xml;
  const para = xml.slice(range.start, range.end);
  if (para.includes('<w:sectPr')) return xml;
  return xml.slice(0, range.start) + xml.slice(range.end);
}

/** Вставляет drawing в абзац, не трогая pPr и sectPr. */
export function insertDrawingIntoParagraph(xml: string, paraId: string, drawingXml: string): string {
  if (!drawingXml) return xml;
  const range = findParagraphRange(xml, paraId);
  if (!range) return xml;
  const para = xml.slice(range.start, range.end);
  if (para.includes('<w:sectPr')) return xml;
  const close = para.lastIndexOf('</w:p>');
  if (close < 0) return xml;
  return xml.slice(0, range.start) + para.slice(0, close) + drawingXml + para.slice(close) + xml.slice(range.end);
}

/** Удаляет абзац, но оставляет пустой <w:p> если это единственный абзац ячейки. */
export function removeParagraphKeepCell(xml: string, paraId: string): string {
  const range = findParagraphRange(xml, paraId);
  if (!range) return xml;
  const para = xml.slice(range.start, range.end);
  if (para.includes('<w:sectPr') || hasAnchoredMedia(para)) return xml;

  const tcStart = lastOpenTag(xml, 'w:tc', range.start);
  const inCell = tcStart >= 0 && tcStart > lastCloseTag(xml, 'w:tc', range.start);
  if (inCell) {
    const tcEnd = xml.indexOf('</w:tc>', range.start);
    const cell = tcEnd > tcStart ? xml.slice(tcStart, tcEnd) : '';
    const pCount = (cell.match(/<w:p[\s>]/g) || []).length;
    if (pCount <= 1) {
      const open = para.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>';
      return xml.slice(0, range.start) + `${open}</w:p>` + xml.slice(range.end);
    }
  }
  return xml.slice(0, range.start) + xml.slice(range.end);
}

function lastCloseTag(xml: string, tag: string, pos: number): number {
  return xml.lastIndexOf(`</${tag}>`, pos);
}

/** Если абзац в таблице — убираем строку (и пустую таблицу), иначе только абзац. Не трогаем sectPr. */
export function removeParagraphOrContainingRow(xml: string, paraId: string): string {
  const range = findParagraphRange(xml, paraId);
  if (!range) return xml;
  const para = xml.slice(range.start, range.end);
  if (para.includes('<w:sectPr') || hasAnchoredMedia(para)) return xml;

  const pStart = range.start;
  const trStart = lastOpenTag(xml, 'w:tr', pStart);
  const tblStart = lastOpenTag(xml, 'w:tbl', pStart);
  const insideRow =
    trStart >= 0 &&
    trStart < pStart &&
    trStart > lastCloseTag(xml, 'w:tr', pStart);
  const insideTable =
    tblStart >= 0 &&
    tblStart < pStart &&
    tblStart > lastCloseTag(xml, 'w:tbl', pStart);

  if (insideRow && insideTable) {
    const trEnd = xml.indexOf('</w:tr>', range.end - 1);
    if (trEnd < 0) return xml;
    const withoutRow = xml.slice(0, trStart) + xml.slice(trEnd + 7);
    const tableEnd = withoutRow.indexOf('</w:tbl>', tblStart);
    if (tableEnd < 0) return withoutRow;
    const table = withoutRow.slice(tblStart, tableEnd + 8);
    if (!/<w:tr[\s>]/.test(table)) {
      return withoutRow.slice(0, tblStart) + withoutRow.slice(tableEnd + 8);
    }
    return withoutRow;
  }

  return xml.slice(0, range.start) + xml.slice(range.end);
}

/** Удаляет всю таблицу, в которой лежит абзац. Не трогает sectPr. */
export function removeTableContainingParagraph(xml: string, paraId: string): string {
  const range = findParagraphRange(xml, paraId);
  if (!range) return xml;
  const tblStart = lastOpenTag(xml, 'w:tbl', range.start);
  if (tblStart < 0 || tblStart < lastCloseTag(xml, 'w:tbl', range.start)) return xml;
  const tblEnd = xml.indexOf('</w:tbl>', range.start);
  if (tblEnd < 0) return xml;
  const table = xml.slice(tblStart, tblEnd + 8);
  if (table.includes('<w:sectPr')) return xml;
  return xml.slice(0, tblStart) + xml.slice(tblEnd + 8);
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#xa0;/gi, '\u00a0');
}

function escapeXmlText(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
