import type { MaedSummary } from '@/api/maed';

export const maedLabels = [
  'Среднее значение МАЭД ГИ, H̄',
  'Неопределённость, δ',
  'Среднее значение МАЭД ГИ с учётом неопределённости, H̄ + δ',
  'Максимальное значение МАЭД ГИ, Hmax',
  'Минимальное значение МАЭД ГИ, Hmin',
];

const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false,
});

export function maedRows(summary: MaedSummary) {
  return [summary.mean, summary.uncertainty, summary.meanWithUncertainty, summary.max, summary.min]
    .map((value, index) => ({ label: maedLabels[index], value: value === null ? null : numberFormat.format(value) }));
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

export function maedClipboard(summary: MaedSummary, valuesOnly: boolean) {
  const rows = maedRows(summary);
  if (rows.some((row) => row.value === null)) throw new Error('Для копирования всех результатов необходимо указать общую неопределённость δ');
  const cells = rows.map((row, index) => valuesOnly ? [row.value!] : [String(index + 1), row.label, row.value!]);
  const headers = ['№ п/п', 'Наименование показателя', 'Значение, мкЗв/ч'];
  return {
    text: (valuesOnly ? cells : [headers, ...cells]).map((row) => row.join('\t')).join('\n'),
    html: `<table style="border-collapse:collapse;font-family:'Times New Roman';font-size:12pt">${valuesOnly ? '' : `<thead><tr>${headers.map((cell) => `<th style="border:1px solid black;padding:4px">${escapeHtml(cell)}</th>`).join('')}</tr></thead>`}<tbody>${cells.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid black;padding:4px">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
  };
}

export async function copyMaedResults(summary: MaedSummary, valuesOnly: boolean) {
  const content = maedClipboard(summary, valuesOnly);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([content.html], { type: 'text/html' }),
        'text/plain': new Blob([content.text], { type: 'text/plain' }),
      })]);
      return;
    } catch {
      // В браузерах без HTML-буфера остаётся вставка строк и колонок текстом.
    }
  }
  await navigator.clipboard.writeText(content.text);
}
