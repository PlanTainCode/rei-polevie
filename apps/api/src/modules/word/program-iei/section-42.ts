import { removeParagraphByParaId } from './docx-xml';

export interface ProgramIeiSection42RowMeta {
  title: string;
  trIndex: number;
  trParaId: string;
  unit: string;
  qtyParaId: string;
  qtyText: string;
  isHeaderLike: boolean;
}

export interface ProgramIeiSection42Extracted {
  tableXml: string;
  tableStart: number;
  tableEnd: number;
  /** Часть между <w:tbl> и первой строкой <w:tr> (tblPr/tblGrid), сохраняем для стиля */
  tableInnerPrefix: string;
  /** Хвост после последней строки <w:tr> до </w:tbl> (обычно пусто) */
  tableInnerSuffix: string;
  /** workRows — только строки-работы (без заголовков разделов), в том же порядке */
  workRows: Array<{ title: string; trIndex: number; trParaId: string; unit: string; qtyParaId: string; qtyText: string }>;
  /** индексы строк таблицы `<w:tr>` которые являются заголовками ("Полевые работы" и т.п.) */
  headerTrIndexes: Array<{ trIndex: number; label: string }>;
  /** индексы строк таблицы `<w:tr>` которые нужно сохранять всегда */
  alwaysKeepTrIndexes: number[];
  /** все строки `<w:tr>` в таблице, в исходном порядке */
  trBlocks: string[];
  /** метаданные по всем строкам таблицы (в исходном порядке) */
  rows: ProgramIeiSection42RowMeta[];
}

const extractTexts = (xml: string): string[] => {
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const t = String(m[1] || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (t) out.push(t);
  }
  return out;
};

const extractCellTexts = (trXml: string): string[] => {
  const cells: string[] = [];
  const tcRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
  const tcs = trXml.match(tcRe) || [];
  for (const tc of tcs) {
    const texts = extractTexts(tc);
    const s = texts.join(' ').replace(/\s+/g, ' ').trim();
    cells.push(s);
  }
  return cells;
};

const normalizeTitle = (s: string): string => {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim();
};

const isHeaderRow = (title: string): string | null => {
  const t = title.toLowerCase();
  if (t === 'полевые работы') return 'Полевые работы';
  if (t === 'лабораторные работы') return 'Лабораторные работы';
  if (t === 'камеральные работы') return 'Камеральные работы';
  return null;
};

const isAlwaysKeepRow = (title: string): boolean => {
  const t = title.toLowerCase();
  if (t.includes('подготовка технического отчета')) return true;
  return false;
};

/**
 * Находит таблицу раздела 4.2 как таблицу, стоящую ПЕРЕД абзацем со звёздочкой (*Перечень...).
 * Это позволяет не зависеть от заголовков/номеров.
 */
export function extractProgramIeiSection42Table(xml: string): ProgramIeiSection42Extracted | null {
  const anchor = 'w14:paraId="0196987F"'; // строка со звездочкой про донные
  const anchorIdx = String(xml).indexOf(anchor);
  if (anchorIdx < 0) return null;

  const closeIdx = String(xml).lastIndexOf('</w:tbl>', anchorIdx);
  if (closeIdx < 0) return null;

  // Находим соответствующий <w:tbl> с учётом вложенности
  const closeToken = '</w:tbl>';
  const openToken = '<w:tbl>';

  let depth = 1;
  // начинаем поиск ДО найденного закрывающего тега, чтобы не посчитать его дважды
  let searchPos = closeIdx - 1;
  let openIdx = -1;

  while (depth > 0) {
    const prevClose = String(xml).lastIndexOf(closeToken, searchPos);
    const prevOpen = String(xml).lastIndexOf(openToken, searchPos);

    if (prevOpen < 0) return null;

    if (prevClose > prevOpen) {
      // нашли закрывающий раньше, увеличиваем вложенность
      depth += 1;
      searchPos = prevClose - 1;
    } else {
      depth -= 1;
      searchPos = prevOpen - 1;
      if (depth === 0) {
        openIdx = prevOpen;
        break;
      }
    }
  }

  if (openIdx < 0) return null;

  const tableStart = openIdx;
  const tableEnd = closeIdx + closeToken.length;
  const tableXml = String(xml).slice(tableStart, tableEnd);

  const trRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  const trBlocks = tableXml.match(trRe) || [];

  // Сохраняем свойства таблицы (tblPr/tblGrid) и возможный хвост, чтобы не ломать стили
  const firstTr = trBlocks.length > 0 ? trBlocks[0] : undefined;
  const lastTr = trBlocks.length > 0 ? trBlocks[trBlocks.length - 1] : undefined;
  const firstTrOffset = firstTr ? tableXml.indexOf(firstTr) : -1;
  const lastTrOffset = lastTr ? tableXml.lastIndexOf(lastTr) : -1;
  const tableInnerPrefix =
    firstTrOffset >= 0
      ? tableXml.slice('<w:tbl>'.length, firstTrOffset)
      : tableXml.slice('<w:tbl>'.length, tableXml.length - '</w:tbl>'.length);
  const tableInnerSuffix =
    lastTrOffset >= 0
      ? tableXml.slice(
          lastTrOffset + (lastTr ? lastTr.length : 0),
          tableXml.length - '</w:tbl>'.length,
        )
      : '';

  const workRows: Array<{
    title: string;
    trIndex: number;
    trParaId: string;
    unit: string;
    qtyParaId: string;
    qtyText: string;
  }> = [];
  const headerTrIndexes: Array<{ trIndex: number; label: string }> = [];
  const alwaysKeepTrIndexes: number[] = [];
  const rows: ProgramIeiSection42RowMeta[] = [];

  trBlocks.forEach((tr, trIndex) => {
    const tcRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
    const tcs = tr.match(tcRe) || [];
    const cells = extractCellTexts(tr);
    const nonEmpty = cells.filter(Boolean);
    if (nonEmpty.length === 0) return;

    // обычно название работы — самая длинная ячейка
    const title = normalizeTitle(
      nonEmpty.reduce((a, b) => (String(b).length > String(a).length ? b : a), nonEmpty[0]),
    );

    const trParaId = tr.match(/w14:paraId="([0-9A-F]{8})"/)?.[1] || '';
    const unit = tcs.length >= 2 ? normalizeTitle(cells[cells.length - 2] || '') : '';
    const qtyTc = tcs.length >= 1 ? tcs[tcs.length - 1] : '';
    const qtyParaId = qtyTc.match(/<w:p w14:paraId="([0-9A-F]{8})"/)?.[1] || '';
    const qtyText = tcs.length >= 1 ? normalizeTitle(cells[cells.length - 1] || '') : '';

    // строка-заголовок таблицы 1/2/3/4 — сохраняем всегда
    if (title === '1' && cells.some((c) => c === '2') && cells.some((c) => c === '3') && cells.some((c) => c === '4')) {
      alwaysKeepTrIndexes.push(trIndex);
      rows.push({ title, trIndex, trParaId, unit, qtyParaId, qtyText, isHeaderLike: true });
      return;
    }

    const headerLabel = isHeaderRow(title);
    if (headerLabel) {
      headerTrIndexes.push({ trIndex, label: headerLabel });
      alwaysKeepTrIndexes.push(trIndex);
      rows.push({ title, trIndex, trParaId, unit, qtyParaId, qtyText, isHeaderLike: true });
      return;
    }

    // внутренние подзаголовки (у них, как правило, unit пустой)
    if (!unit) {
      // НЕ оставляем принудительно: будем добавлять их только если под ними остались пункты
      rows.push({ title, trIndex, trParaId, unit, qtyParaId, qtyText, isHeaderLike: true });
      return;
    }

    if (isAlwaysKeepRow(title)) {
      alwaysKeepTrIndexes.push(trIndex);
      rows.push({ title, trIndex, trParaId, unit, qtyParaId, qtyText, isHeaderLike: false });
      return;
    }

    // строки-работы
    workRows.push({ title, trIndex, trParaId, unit, qtyParaId, qtyText });
    rows.push({ title, trIndex, trParaId, unit, qtyParaId, qtyText, isHeaderLike: false });
  });

  return {
    tableXml,
    tableStart,
    tableEnd,
    tableInnerPrefix,
    tableInnerSuffix,
    workRows,
    headerTrIndexes,
    alwaysKeepTrIndexes,
    trBlocks,
    rows,
  };
}

/**
 * Фильтрует строки таблицы 4.2: оставляет заголовки, alwaysKeep и выбранные workRows.
 * Пустые разделы (заголовки без последующих работ) удаляются.
 */
export function applyProgramIeiSection42TableFiltering(params: {
  xml: string;
  extracted: ProgramIeiSection42Extracted;
  keepWorkRowIndexes: number[];
  filterEnabled: boolean;
}): string {
  const { extracted, keepWorkRowIndexes, filterEnabled } = params;
  if (!filterEnabled) return params.xml;

  const keepTr = new Set<number>(extracted.alwaysKeepTrIndexes);

  for (const workIdx of keepWorkRowIndexes || []) {
    const row = extracted.workRows[workIdx];
    if (!row) continue;
    keepTr.add(row.trIndex);
  }

  // --- Подзаголовки групп (например: "Исследование загрязнения атмосферного воздуха")
  // Добавляем их только если под ними остались реальные пункты (не заголовки).
  const majorHeaderSet = new Set<number>(extracted.headerTrIndexes.map((h) => h.trIndex));
  const headerLikeSet = new Set<number>(extracted.rows.filter((r) => r.isHeaderLike).map((r) => r.trIndex));
  const subHeaders = extracted.rows
    .filter((r) => r.isHeaderLike && !majorHeaderSet.has(r.trIndex) && !r.unit)
    .map((r) => ({ trIndex: r.trIndex, title: r.title }))
    .sort((a, b) => a.trIndex - b.trIndex);
  const majorHeadersSorted = [...majorHeaderSet].sort((a, b) => a - b);

  const nextGreater = (arr: number[], x: number): number | null => {
    for (const v of arr) {
      if (v > x) return v;
    }
    return null;
  };

  for (const h of subHeaders) {
    const nextSub = nextGreater(subHeaders.map((s) => s.trIndex), h.trIndex);
    const nextMajor = nextGreater(majorHeadersSorted, h.trIndex);
    const next = Math.min(
      nextSub ?? extracted.trBlocks.length,
      nextMajor ?? extracted.trBlocks.length,
    );

    const hasKeptNonHeaderRow = Array.from(keepTr).some(
      (idx) => idx > h.trIndex && idx < next && !headerLikeSet.has(idx),
    );

    if (hasKeptNonHeaderRow) {
      keepTr.add(h.trIndex);
    }
  }

  // Удаляем заголовки разделов, если под ними ничего не осталось
  const headerIndicesSorted = [...extracted.headerTrIndexes]
    .sort((a, b) => a.trIndex - b.trIndex)
    .map((h) => h.trIndex);

  for (let i = 0; i < headerIndicesSorted.length; i += 1) {
    const h = headerIndicesSorted[i];
    const next = i + 1 < headerIndicesSorted.length ? headerIndicesSorted[i + 1] : extracted.trBlocks.length;

    // Если под заголовком остались какие-либо строки (включая alwaysKeep, напр. "Подготовка отчета"),
    // заголовок НЕ удаляем.
    const hasAnythingKeptUnderHeader = Array.from(keepTr).some((idx) => idx > h && idx < next);

    if (!hasAnythingKeptUnderHeader) {
      keepTr.delete(h);
    }
  }

  const newTrBlocks: string[] = [];
  extracted.trBlocks.forEach((tr, idx) => {
    if (keepTr.has(idx)) newTrBlocks.push(tr);
  });

  const newTableXml =
    '<w:tbl>' +
    extracted.tableInnerPrefix +
    newTrBlocks.join('') +
    extracted.tableInnerSuffix +
    '</w:tbl>';

  return String(params.xml).slice(0, extracted.tableStart) + newTableXml + String(params.xml).slice(extracted.tableEnd);
}

/**
 * После таблицы 4.2: строки со звёздочками включаются только если соответствующие работы есть.
 */
export function applyProgramIeiSection42Footnotes(params: {
  xml: string;
  hasSediment: boolean;
  hasSurfaceWater: boolean;
  hasGroundWater: boolean;
}): string {
  let xml = params.xml;

  if (!params.hasSediment) {
    xml = removeParagraphByParaId(xml, '0196987F');
  }

  if (!params.hasSurfaceWater) {
    xml = removeParagraphByParaId(xml, '01D7E115');
  }

  if (!params.hasGroundWater) {
    xml = removeParagraphByParaId(xml, '07ED30CA');
  }

  return xml;
}
