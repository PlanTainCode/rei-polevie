import type { TitleSignatory } from '../../ai/ai.service';
import { escapeXml } from './docx-xml';

const CELL_WIDTH = 4928;
const TABLE_WIDTH = CELL_WIDTH * 2; // 9856 dxa

// Вертикальные позиции таблиц на странице (twips)
const TABLE_Y_TOP = 3586;
const TABLE_Y_BOTTOM_BASE = 7066;
// Дополнительный отступ за каждую строку basis в верхней таблице (~1 абзац ≈ 350 twips)
const BASIS_LINE_OFFSET = 350;

function tblPr(tblpY: number): string {
  return (
    '<w:tblPr>' +
    '<w:tblStyle w:val="10"/>' +
    `<w:tblpPr w:leftFromText="180" w:rightFromText="180" w:vertAnchor="page" w:horzAnchor="margin" w:tblpY="${tblpY}"/>` +
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
  yPosition: number,
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

function generateSignatoryTablesXml(signatories: TitleSignatory[]): string {
  const n = signatories.length;
  if (n === 0) return '';

  const spacer = '<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr></w:p>';

  if (n === 1) {
    return buildSignatoryTable(null, signatories[0], TABLE_Y_BOTTOM_BASE);
  }

  if (n === 2) {
    return buildSignatoryTable(signatories[0], signatories[1], TABLE_Y_BOTTOM_BASE);
  }

  if (n === 3) {
    const topSigs: (TitleSignatory | null)[] = [null, signatories[0]];
    const basisOffset = countExtraBasisLines(topSigs) * BASIS_LINE_OFFSET;
    const topTable = buildSignatoryTable(null, signatories[0], TABLE_Y_TOP);
    const bottomTable = buildSignatoryTable(signatories[1], signatories[2], TABLE_Y_BOTTOM_BASE + basisOffset);
    return topTable + spacer + bottomTable;
  }

  // 4 подписанта — две таблицы по 2
  const topSigs = [signatories[0], signatories[1]];
  const basisOffset = countExtraBasisLines(topSigs) * BASIS_LINE_OFFSET;
  const topTable = buildSignatoryTable(signatories[0], signatories[1], TABLE_Y_TOP);
  const bottomTable = buildSignatoryTable(signatories[2], signatories[3], TABLE_Y_BOTTOM_BASE + basisOffset);
  return topTable + spacer + bottomTable;
}

/**
 * Заменяет блок подписантов на титульной странице программы ИЭИ.
 *
 * Находит существующие таблицы подписантов (между шапкой АО «РЭИ-ЭКОАУДИТ»
 * и заголовком «Программа»), удаляет их и вставляет новые на основе
 * массива подписантов из ТЗ.
 */
export function replaceTitleSignatories(params: {
  xml: string;
  signatories: TitleSignatory[];
  contractorRole: string;
  programmaParaId?: string;
}): string {
  let { xml } = params;
  const signatories = params.signatories;
  const programmaParaId = params.programmaParaId || '4A7786BB';

  if (!signatories || signatories.length === 0) return xml;

  const firstSigText = xml.indexOf('СОГЛАСОВАНО');
  if (firstSigText < 0) return xml;

  const firstTblStart = xml.lastIndexOf('<w:tbl>', firstSigText);
  if (firstTblStart < 0) return xml;

  const programmaIdx = xml.indexOf(`w14:paraId="${programmaParaId}"`);
  if (programmaIdx < 0) return xml;

  // Находим начало параграфа «Программа»
  const programmaPStart = xml.lastIndexOf('<w:p ', programmaIdx);
  if (programmaPStart < 0) return xml;

  // Вырезаем всё между началом первой таблицы и параграфом «Программа»
  const before = xml.slice(0, firstTblStart);
  const after = xml.slice(programmaPStart);

  // Генерируем XML подписантов + 4 пустых абзаца-разделителя перед «Программа»
  const spacers =
    '<w:p><w:pPr><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr></w:p>'.repeat(4);

  const newSignatories = generateSignatoryTablesXml(signatories);

  xml = before + newSignatories + spacers + after;

  return xml;
}
