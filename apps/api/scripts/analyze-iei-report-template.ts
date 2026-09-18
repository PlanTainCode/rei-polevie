import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const xmlPath = join(process.cwd(), 'temp/report-iei-extract/word/document.xml');
const xml = readFileSync(xmlPath, 'utf8');

function stripTags(s: string): string {
  return s
    .replace(/<w:tab[^/]*\/>/g, '\t')
    .replace(/<w:br[^/]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function paraText(p: string): string {
  const parts = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);
  return parts.join('');
}

function paraColorNotes(p: string): { color: string; text: string }[] {
  const notes: { color: string; text: string }[] = [];
  const runs = [...p.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)].map((m) => m[0]);
  for (const r of runs) {
    const color = r.match(/<w:color w:val="([^"]+)"/)?.[1];
    const highlight = r.match(/<w:highlight w:val="([^"]+)"/)?.[1];
    const shading = r.match(/<w:shd[^>]*w:fill="([^"]+)"/)?.[1];
    const text = [...r.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((m) => m[1])
      .join('');
    if (!text.trim()) continue;
    const auto = !color || color.toUpperCase() === '000000' || color.toUpperCase() === 'AUTO';
    if (color && !auto) notes.push({ color, text });
    if (highlight) notes.push({ color: `hl:${highlight}`, text });
    if (shading && shading.toUpperCase() !== 'AUTO' && shading.toUpperCase() !== 'FFFFFF') {
      notes.push({ color: `shd:${shading}`, text });
    }
  }
  return notes;
}

const paragraphs = [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
const rows: {
  i: number;
  paraId: string;
  style: string;
  text: string;
  notes: { color: string; text: string }[];
}[] = [];

paragraphs.forEach((p, i) => {
  const paraId = p.match(/w14:paraId="([^"]+)"/)?.[1] || '';
  const style = p.match(/<w:pStyle w:val="([^"]+)"/)?.[1] || '';
  const text = paraText(p).replace(/\s+/g, ' ').trim();
  const notes = paraColorNotes(p);
  rows.push({ i, paraId, style, text, notes });
});

const outDir = join(process.cwd(), 'temp/report-iei-extract/analysis');
mkdirSync(outDir, { recursive: true });

const headingLike = rows.filter((r) => {
  if (!r.text) return false;
  if (/^heading/i.test(r.style) || /^1$|^2$|^3$|^4$|^10$/.test(r.style)) return true;
  if (/^\d+(\.\d+)*(\s|$)/.test(r.text) && r.text.length < 180) return true;
  if (/^(ВВЕДЕНИЕ|Введение|СОДЕРЖАНИЕ|Содержание|СПИСОК|ПРИЛОЖЕНИЕ|Приложение)/.test(r.text))
    return true;
  return false;
});

writeFileSync(
  join(outDir, 'headings.txt'),
  headingLike.map((r) => `[${r.i}] style=${r.style} id=${r.paraId}\n${r.text}`).join('\n\n'),
);

const colored: string[] = [];
for (const r of rows) {
  if (!r.notes.length) continue;
  const uniq = r.notes
    .filter((n) => {
      const t = n.text.trim();
      if (t.length < 2) return false;
      // skip typical black-ish theme colors that are just headings
      return true;
    })
    .map((n) => `  [${n.color}] ${n.text}`);
  if (!uniq.length) continue;
  colored.push(`[${r.i}] id=${r.paraId} ${r.text.slice(0, 160)}\n${uniq.join('\n')}`);
}
writeFileSync(join(outDir, 'colored.txt'), colored.join('\n\n'));

const colorCounts: Record<string, number> = {};
for (const r of rows) {
  for (const n of r.notes) {
    colorCounts[n.color] = (colorCounts[n.color] || 0) + 1;
  }
}

const fullText = rows
  .map((r) => r.text)
  .filter(Boolean)
  .join('\n');
writeFileSync(join(outDir, 'full-text.txt'), fullText);

// Section 1: from first "1 " / "1." heading until next top-level "2 "
let start = rows.findIndex((r) => /^1(\.|\s)/.test(r.text) && r.text.length < 120);
if (start < 0) start = rows.findIndex((r) => /ВВЕДЕНИЕ|Введение/.test(r.text));
let end = rows.findIndex(
  (r, idx) => idx > start && /^2(\.|\s)/.test(r.text) && r.text.length < 120,
);
if (end < 0) end = Math.min(rows.length, start + 400);
const section1 = rows.slice(Math.max(0, start), end);
writeFileSync(
  join(outDir, 'section-1.txt'),
  section1
    .map((r) => {
      const note = r.notes.length
        ? `\n  NOTES: ${r.notes.map((n) => `[${n.color}] ${n.text}`).join(' | ')}`
        : '';
      return `[${r.i}|${r.paraId}|${r.style}] ${r.text}${note}`;
    })
    .join('\n'),
);

// Title page = first N non-empty paras
const title = rows.filter((r) => r.text).slice(0, 80);
writeFileSync(
  join(outDir, 'title.txt'),
  title
    .map((r) => {
      const note = r.notes.length
        ? `\n  NOTES: ${r.notes.map((n) => `[${n.color}] ${n.text}`).join(' | ')}`
        : '';
      return `[${r.i}|${r.paraId}|${r.style}] ${r.text}${note}`;
    })
    .join('\n'),
);

console.log('paragraphs', rows.length);
console.log('headings', headingLike.length);
console.log('colored paras', colored.length);
console.log('color counts', colorCounts);
console.log('section1 range', start, end, 'paras', end - start);
console.log('full text chars', fullText.length);
