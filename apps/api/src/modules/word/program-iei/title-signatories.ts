import type { TitleSignatory } from '../../ai/ai.service';
import { escapeXml } from './docx-xml';

const CELL_WIDTH = 4928;
const TABLE_WIDTH = CELL_WIDTH * 2; // 9856 dxa

// Вертикальные позиции таблиц на странице (twips)
const TABLE_Y_TOP = 3586;
const TABLE_Y_BOTTOM_BASE = 7066;
// Дополнительный отступ за каждую строку basis в верхней таблице (~1 абзац ≈ 350 twips)
const BASIS_LINE_OFFSET = 350;

function tblPr(tblpY: number | null): string {
  const floating =
    tblpY != null
      ? `<w:tblpPr w:leftFromText="180" w:rightFromText="180" w:vertAnchor="page" w:horzAnchor="margin" w:tblpY="${tblpY}"/>`
      : '';
  return (
    '<w:tblPr>' +
    '<w:tblStyle w:val="10"/>' +
    floating +
    `<w:tblW w:w="${TABLE_WIDTH}" w:type="dxa"/>` +
    '<w:tblInd w:w="0" w:type="dxa"/>' +
    '<w:tblLayout w:type="autofit"/>' +
    '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar>' +
    '</w:tblPr>'
  );
}

const tblGrid =
  `<w:tblGrid><w:gridCol w:w="${CELL_WIDTH}"/><w:gridCol w:w="${CELL_WIDTH}"/></w:tblGrid>`;

function tcPr(): string {
  return `<w:tcPr><w:tcW w:w="${CELL_WIDTH}" w:type="dxa"/><w:noWrap w:val="0"/><w:vAlign w:val="top"/></w:tcPr>`;
}

function emptyCell(): string {
  return `<w:tc>${tcPr()}<w:p><w:pPr><w:pStyle w:val="26"/><w:jc w:val="right"/><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr></w:p></w:tc>`;
}

function boldParagraph(text: string): string {
  const escaped = escapeXml(text);
  return (
    `<w:p><w:pPr><w:pStyle w:val="26"/><w:jc w:val="right"/>` +
    `<w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>` +
    `<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`
  );
}

function normalParagraph(text: string): string {
  const escaped = escapeXml(text);
  return (
    `<w:p><w:pPr><w:pStyle w:val="23"/><w:jc w:val="right"/>` +
    `<w:rPr><w:bCs/><w:sz w:val="24"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:bCs/><w:sz w:val="24"/></w:rPr>` +
    `<w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`
  );
}

function emptyParagraph(): string {
  return (
    '<w:p><w:pPr><w:pStyle w:val="23"/><w:jc w:val="right"/>' +
    '<w:rPr><w:bCs/><w:sz w:val="24"/></w:rPr></w:pPr></w:p>'
  );
}

function isApprovalHeader(header: string): boolean {
  return header.toUpperCase().replace(/[«»"\s]/g, '').includes('УТВЕРЖДА');
}

/** В программе ИЭИ «УТВЕРЖДАЮ» всегда у АО «РЭИ-ЭКОАУДИТ», у остальных — «СОГЛАСОВАНО». */
export function applyProgramIeiApprovalHeaders(signatories: TitleSignatory[]): TitleSignatory[] {
  if (!signatories?.length) return signatories;

  const isRei = (sig: TitleSignatory) => {
    const org = sig.organization || '';
    if (/РЭИ/i.test(org)) return true;
    const label = (sig.label || '').toLowerCase();
    return label.includes('подрядчик') || label.includes('исполнитель');
  };

  let reiIdx = signatories.findIndex(isRei);
  // Нижний левый слот макета (2-я строка, 1-я колонка), если AI не нашёл РЭИ
  if (reiIdx < 0) {
    if (signatories.length >= 4) reiIdx = 2;
    else if (signatories.length === 3) reiIdx = 1;
    else if (signatories.length === 2) reiIdx = 0;
  }

  return signatories.map((sig, i) => ({
    ...sig,
    header: i === reiIdx ? 'УТВЕРЖДАЮ' : 'СОГЛАСОВАНО',
  }));
}

function signatoryCell(sig: TitleSignatory): string {
  const header = isApprovalHeader(sig.header) ? '«УТВЕРЖДАЮ»' : '«СОГЛАСОВАНО»';
  return (
    `<w:tc>${tcPr()}` +
    boldParagraph(header) +
    emptyParagraph() +
    emptyParagraph() +
    normalParagraph(sig.label) +
    normalParagraph(sig.position) +
    `</w:tc>`
  );
}

function orgCell(org: string): string {
  return `<w:tc>${tcPr()}${normalParagraph(org)}</w:tc>`;
}

function nameCell(name: string, basis?: string): string {
  return (
    `<w:tc>${tcPr()}` +
    emptyParagraph() +
    emptyParagraph() +
    normalParagraph(name) +
    (basis ? normalParagraph(basis) : '') +
    `</w:tc>`
  );
}

function signatureLineCell(): string {
  return (
    `<w:tc>${tcPr()}` +
    emptyParagraph() +
    normalParagraph('_______________') +
    `</w:tc>`
  );
}

function buildSignatoryTable(
  left: TitleSignatory | null,
  right: TitleSignatory | null,
  yPosition: number | null,
): string {
  const leftHeader = left ? signatoryCell(left) : emptyCell();
  const rightHeader = right ? signatoryCell(right) : emptyCell();

  const leftOrg = left ? orgCell(left.organization) : emptyCell();
  const rightOrg = right ? orgCell(right.organization) : emptyCell();

  const leftName = left ? nameCell(left.name, left.basis) : emptyCell();
  const rightName = right ? nameCell(right.name, right.basis) : emptyCell();

  const leftSig = left ? signatureLineCell() : emptyCell();
  const rightSig = right ? signatureLineCell() : emptyCell();

  return (
    `<w:tbl>${tblPr(yPosition)}${tblGrid}` +
    `<w:tr>${leftHeader}${rightHeader}</w:tr>` +
    `<w:tr>${leftOrg}${rightOrg}</w:tr>` +
    `<w:tr>${leftName}${rightName}</w:tr>` +
    `<w:tr>${leftSig}${rightSig}</w:tr>` +
    `</w:tbl>`
  );
}

function countExtraBasisLines(sigs: (TitleSignatory | null)[]): number {
  let max = 0;
  for (const s of sigs) {
    if (s?.basis) max = Math.max(max, 1);
  }
  return max;
}

function generateSignatoryTablesXml(
  signatories: TitleSignatory[],
  options?: { floating?: boolean },
): string {
  const n = signatories.length;
  if (n === 0) return '';

  const floating = options?.floating !== false;
  const yTop = floating ? TABLE_Y_TOP : null;
  const yBottom = floating ? TABLE_Y_BOTTOM_BASE : null;
  const spacer = '<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr></w:p>';

  if (n === 1) {
    return buildSignatoryTable(null, signatories[0], yBottom);
  }

  if (n === 2) {
    return buildSignatoryTable(signatories[0], signatories[1], yBottom);
  }

  if (n === 3) {
    const topSigs: (TitleSignatory | null)[] = [null, signatories[0]];
    const basisOffset = floating ? countExtraBasisLines(topSigs) * BASIS_LINE_OFFSET : 0;
    const topTable = buildSignatoryTable(null, signatories[0], yTop);
    const bottomTable = buildSignatoryTable(
      signatories[1],
      signatories[2],
      yBottom != null ? yBottom + basisOffset : null,
    );
    return topTable + spacer + bottomTable;
  }

  // 4 подписанта — две таблицы по 2
  const topSigs = [signatories[0], signatories[1]];
  const basisOffset = floating ? countExtraBasisLines(topSigs) * BASIS_LINE_OFFSET : 0;
  const topTable = buildSignatoryTable(signatories[0], signatories[1], yTop);
  const bottomTable = buildSignatoryTable(
    signatories[2],
    signatories[3],
    yBottom != null ? yBottom + basisOffset : null,
  );
  return topTable + spacer + bottomTable;
}

function extractParagraphPlainText(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function findParagraphStartBefore(xml: string, pos: number): number {
  const head = xml.slice(0, pos + 1);
  const re = /<w:p(?:\s|>)/g;
  let m: RegExpExecArray | null;
  let last = -1;
  while ((m = re.exec(head)) !== null) last = m.index;
  return last;
}

/** Находит начало абзаца «Программа» (по paraId или по тексту — для файлов подрядчиков). */
export function findProgrammaParagraphStart(xml: string, programmaParaId?: string): number {
  if (programmaParaId) {
    const byId = xml.indexOf(`w14:paraId="${programmaParaId}"`);
    if (byId >= 0) {
      const pStart = findParagraphStartBefore(xml, byId);
      if (pStart >= 0) return pStart;
    }
  }

  const re = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const text = extractParagraphPlainText(match[0]);
    if (/^Программа(\s+инженерно[- ]|$)/i.test(text) || /^Программа\s*$/i.test(text)) {
      return match.index;
    }
  }

  return -1;
}

/**
 * Заменяет блок подписантов на титульной странице программы ИЭИ/ИГМИ/ИГИ.
 *
 * Находит существующие таблицы подписантов (от первого «СОГЛАСОВАНО»
 * до заголовка «Программа»), удаляет их и вставляет новые на основе
 * массива подписантов из ТЗ.
 */
export function replaceTitleSignatories(params: {
  xml: string;
  signatories: TitleSignatory[];
  contractorRole: string;
  programmaParaId?: string;
  /**
   * Для чужих docx (ИГИ): floating-таблицы подписантов не занимают поток,
   * без большого before у «Программа» заголовок уезжает наверх страницы.
   * В twips (1/20 pt), напр. 9200.
   */
  programmaSpacingBefore?: number;
}): string {
  let { xml } = params;
  const signatories = params.signatories;
  const programmaParaId = params.programmaParaId || '4A7786BB';

  if (!signatories || signatories.length === 0) return xml;

  const firstSigText = xml.indexOf('СОГЛАСОВАНО');
  if (firstSigText < 0) return xml;

  // Важно: искать именно старт <w:tbl> / <w:tbl …>, а не <w:tblPr>/<w:tblGrid>
  // (иначе вырезаем середину таблицы → битый XML → пустой документ в Word/WPS).
  const head = xml.slice(0, firstSigText);
  let firstTblStart = -1;
  {
    const re = /<w:tbl(?:\s|>)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(head)) !== null) firstTblStart = m.index;
  }
  if (firstTblStart < 0) return xml;

  const programmaPStart = findProgrammaParagraphStart(xml, programmaParaId);
  if (programmaPStart < 0 || programmaPStart <= firstTblStart) return xml;

  // Вырезаем всё между началом первой таблицы и параграфом «Программа»
  const before = xml.slice(0, firstTblStart);
  const after = xml.slice(programmaPStart);

  // Генерируем XML подписантов + разделители перед «Программа»
  const spacers =
    params.programmaSpacingBefore && params.programmaSpacingBefore > 0
      ? `<w:p><w:pPr><w:spacing w:before="${params.programmaSpacingBefore}" w:after="120"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>`
      : '<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr></w:p>'.repeat(4);

  const newSignatories = generateSignatoryTablesXml(signatories);

  xml = before + newSignatories + spacers + after;

  return xml;
}

function findTableBoundsBefore(xml: string, endPos: number): Array<{ start: number; end: number }> {
  const tables: Array<{ start: number; end: number }> = [];
  const re = /<w:tbl(?:\s|>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m.index >= endPos) break;
    let depth = 0;
    let i = m.index;
    let end = -1;
    while (i < xml.length) {
      const openRe = /<w:tbl(?:\s|>)/g;
      openRe.lastIndex = i + 1;
      const openMatch = openRe.exec(xml);
      const openIdx = openMatch ? openMatch.index : -1;
      const closeIdx = xml.indexOf('</w:tbl>', i + 1);
      if (closeIdx < 0) break;
      if (openIdx >= 0 && openIdx < closeIdx) {
        depth += 1;
        i = openIdx;
      } else {
        if (depth === 0) {
          end = closeIdx + '</w:tbl>'.length;
          break;
        }
        depth -= 1;
        i = closeIdx + 1;
      }
    }
    if (end > 0 && end <= endPos) {
      tables.push({ start: m.index, end });
      re.lastIndex = end;
    }
  }
  return tables;
}

function isTitleShapkaTable(tblXml: string): boolean {
  const hasLogo = tblXml.includes('a:blip') || tblXml.includes('w:drawing');
  const text = [...tblXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('');
  const hasRei = /РЭИ/i.test(text);
  const hasSro = /СРО|Ассоциация|Центризыскан|саморегулируем/i.test(text);
  // Шапка: логотип + блок АО «РЭИ-ЭКОАУДИТ» / СРО (не сетка СОГЛАСОВАНО/УТВЕРЖДАЮ)
  return hasLogo || (hasRei && hasSro && !/СОГЛАСОВАНО|УТВЕРЖДАЮ/i.test(text));
}

/**
 * ИГИ: пересобирает подписантов из ТЗ (как ИЭИ/ИГМИ), но сохраняет шапку подрядчика
 * (логотип ГК РЭИ + АО «РЭИ-ЭКОАУДИТ» + текст СРО).
 */
export function replaceProgramIgiTitleSignatories(params: {
  xml: string;
  signatories: TitleSignatory[];
  contractorRole: string;
}): string {
  const signatories = params.signatories;
  if (!signatories?.length) return params.xml;

  let { xml } = params;
  const programmaPStart = findProgrammaParagraphStart(xml);
  if (programmaPStart < 0) return xml;

  const tables = findTableBoundsBefore(xml, programmaPStart);
  if (!tables.length) return xml;

  const shapkaXml = tables
    .filter((t) => isTitleShapkaTable(xml.slice(t.start, t.end)))
    .map((t) => xml.slice(t.start, t.end))
    .join(
      '<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr></w:p>',
    );

  const firstTblStart = tables[0].start;
  const before = xml.slice(0, firstTblStart);
  const after = xml.slice(programmaPStart);

  // Floating как в ИЭИ — шапка остаётся на своём tblpY, подписанты на канонических Y
  const newSignatories = generateSignatoryTablesXml(signatories, { floating: true });
  const spacers =
    '<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr></w:p>'.repeat(4);

  // Сначала шапка (верх страницы), затем сетка подписантов из ТЗ
  return before + shapkaXml + newSignatories + spacers + after;
}
