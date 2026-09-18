import { CHAPTER_2, INTRO } from './ids';

/** Ширина поля секции Введение / §1: pgSz 11906 − left 970 − right 566. */
export const REPORT_IEI_BODY_CONTENT_WIDTH = 10370;

export function tableOccupiedWidth(tbl: string): number {
  const { indent, gridSum, tblW } = readTableMetrics(tbl);
  return indent + (gridSum || tblW);
}

export function fitTableToContentWidth(
  tbl: string,
  maxWidth = REPORT_IEI_BODY_CONTENT_WIDTH,
): string {
  const metrics = readTableMetrics(tbl);
  const occupied = metrics.indent + (metrics.gridSum || metrics.tblW);
  if (occupied <= maxWidth) return tbl;

  let overflow = occupied - maxWidth;
  let newIndent = metrics.indent;
  if (newIndent > 0) {
    const cut = Math.min(newIndent, overflow);
    newIndent -= cut;
    overflow -= cut;
  }

  let newCols = metrics.cols;
  if (overflow > 0 && metrics.cols.length) {
    const target = Math.max(metrics.cols.length, metrics.gridSum - overflow);
    newCols = scaleWidths(metrics.cols, target);
    overflow = 0;
  }

  const newGridSum = newCols.reduce((a, b) => a + b, 0);
  let out = replaceFirstAttr(tbl, /<w:tblInd\b[^>]*>/, 'w:w', String(newIndent));

  if (newCols !== metrics.cols && metrics.gridXml) {
    let i = 0;
    const newGrid = metrics.gridXml.replace(/<w:gridCol w:w="\d+"/g, () => {
      const w = newCols[i++] ?? 1;
      return `<w:gridCol w:w="${w}"`;
    });
    out = out.replace(metrics.gridXml, newGrid);
    if (metrics.tblWType === 'dxa') {
      out = replaceFirstAttr(out, /<w:tblW\b[^>]*>/, 'w:w', String(newGridSum));
    }
    if (metrics.gridSum > 0) {
      out = scaleTcW(out, metrics.gridSum, newGridSum);
    }
  } else if (metrics.tblWType === 'dxa' && metrics.tblW + newIndent > maxWidth) {
    out = replaceFirstAttr(out, /<w:tblW\b[^>]*>/, 'w:w', String(maxWidth - newIndent));
  }

  return out;
}

/** Таблицы от второго «Введение» до заголовка §2. Не трогает titул и sectPr. */
export function fitReportIeiIntroAndSection1Tables(xml: string): string {
  const range = introSection1Range(xml);
  if (!range) return xml;

  const tables = findTopLevelTables(xml).filter(
    (t) => t.start >= range.start && t.start < range.end,
  );
  let out = xml;
  for (let i = tables.length - 1; i >= 0; i--) {
    const table = tables[i];
    const fitted = fitTableToContentWidth(out.slice(table.start, table.end));
    out = out.slice(0, table.start) + fitted + out.slice(table.end);
  }
  return out;
}

export function introSection1Range(xml: string): { start: number; end: number } | null {
  const start = findParaStartById(xml, INTRO.heading) ?? findNthExactPara(xml, 'Введение', 2);
  if (start == null) return null;
  const end =
    findParaStartById(xml, CHAPTER_2.heading) ??
    findFirstExactParaAfter(xml, 'Инженерно-экологическая изученность территории', start + 1);
  return { start, end: end ?? xml.length };
}

export function findTopLevelTables(xml: string): { start: number; end: number }[] {
  const tables: { start: number; end: number }[] = [];
  let i = 0;
  while (i < xml.length) {
    const start = indexOfTblOpen(xml, i);
    if (start < 0) break;
    const end = findTblEnd(xml, start);
    if (end < 0) break;
    tables.push({ start, end });
    i = end;
  }
  return tables;
}

function readTableMetrics(tbl: string): {
  indent: number;
  cols: number[];
  gridSum: number;
  gridXml: string;
  tblW: number;
  tblWType: string;
} {
  const openEnd = tbl.indexOf('>') + 1;
  const prStart = tbl.indexOf('<w:tblPr>', openEnd);
  const prEnd = prStart >= 0 ? tbl.indexOf('</w:tblPr>', prStart) + 10 : -1;
  const pr = prStart >= 0 && prEnd > prStart ? tbl.slice(prStart, prEnd) : '';
  const gridStart = tbl.indexOf('<w:tblGrid>', prEnd >= 0 ? prEnd : openEnd);
  const gridEnd = gridStart >= 0 ? tbl.indexOf('</w:tblGrid>', gridStart) + 12 : -1;
  const gridXml = gridStart >= 0 && gridEnd > gridStart ? tbl.slice(gridStart, gridEnd) : '';
  const cols = [...gridXml.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => Number(m[1]));
  const indent = Number(pr.match(/<w:tblInd\b[^>]*w:w="(-?\d+)"/)?.[1] || 0);
  const tblW = Number(pr.match(/<w:tblW\b[^>]*w:w="(-?\d+)"/)?.[1] || 0);
  const tblWType = pr.match(/<w:tblW\b[^>]*w:type="([^"]+)"/)?.[1] || '';
  return {
    indent,
    cols,
    gridSum: cols.reduce((a, b) => a + b, 0),
    gridXml,
    tblW,
    tblWType,
  };
}

function scaleWidths(widths: number[], target: number): number[] {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= 0 || target === sum) return widths;
  const next = widths.map((w) => Math.max(1, Math.round((w * target) / sum)));
  let diff = target - next.reduce((a, b) => a + b, 0);
  let i = next.length - 1;
  let guard = next.length * 4;
  while (diff !== 0 && guard-- > 0) {
    const step = diff > 0 ? 1 : -1;
    const value = next[i] + step;
    if (value >= 1) {
      next[i] = value;
      diff -= step;
    }
    i = (i - 1 + next.length) % next.length;
  }
  return next;
}

function scaleTcW(tbl: string, oldSum: number, newSum: number): string {
  if (oldSum <= 0 || oldSum === newSum) return tbl;
  return tbl.replace(/<w:tcW w:w="(\d+)"/g, (_, raw: string) => {
    const next = Math.max(1, Math.round((Number(raw) * newSum) / oldSum));
    return `<w:tcW w:w="${next}"`;
  });
}

function replaceFirstAttr(xml: string, tagRe: RegExp, attr: string, value: string): string {
  const match = xml.match(tagRe);
  if (!match || match.index == null) return xml;
  const next = match[0].includes(`${attr}="`)
    ? match[0].replace(new RegExp(`${attr}="[^"]*"`), `${attr}="${value}"`)
    : match[0].replace(/\/?>$/, ` ${attr}="${value}"$&`);
  return xml.slice(0, match.index) + next + xml.slice(match.index + match[0].length);
}

function indexOfTblOpen(xml: string, from: number): number {
  let i = from;
  while (i < xml.length) {
    const pos = xml.indexOf('<w:tbl', i);
    if (pos < 0) return -1;
    const ch = xml[pos + 6];
    if (ch === ' ' || ch === '>') return pos;
    i = pos + 6;
  }
  return -1;
}

function findTblEnd(xml: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < xml.length) {
    const open = indexOfTblOpen(xml, i);
    const close = xml.indexOf('</w:tbl>', i);
    if (close < 0) return -1;
    if (open >= 0 && open < close) {
      depth += 1;
      i = open + 6;
    } else {
      depth -= 1;
      i = close + 8;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findParaStartById(xml: string, paraId: string): number | null {
  const token = `w14:paraId="${paraId}"`;
  const pos = xml.indexOf(token);
  if (pos < 0) return null;
  return Math.max(xml.lastIndexOf('<w:p ', pos), xml.lastIndexOf('<w:p>', pos));
}

function paraText(p: string): string {
  return [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function findNthExactPara(xml: string, text: string, n: number): number | null {
  let found = 0;
  const re = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    if (paraText(match[0]) !== text) continue;
    found += 1;
    if (found === n) return match.index;
  }
  return null;
}

function findFirstExactParaAfter(xml: string, text: string, from: number): number | null {
  const re = /<w:p\b[\s\S]*?<\/w:p>/g;
  re.lastIndex = from;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    if (paraText(match[0]) === text) return match.index;
  }
  return null;
}
