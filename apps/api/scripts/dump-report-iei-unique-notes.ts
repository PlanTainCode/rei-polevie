import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import PizZip from 'pizzip';

const xml = new PizZip(readFileSync(join(process.cwd(), 'templates/отчет-иэи/Шаблон отчета по ИЭИ.docx')))
  .file('word/document.xml')!
  .asText();

function paraText(p: string): string {
  return [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOTE_RE =
  /\((?:если|при |для |москва|дорога|ггх|агрох|не |из п\.|из программы)[^)]{0,80}\)|если [^.…]{5,160}|не использовать|обязательно |берем из|берём из|пишем:|нужно |удалить|пример таблицы|инфо из/i;

const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
const hits: { i: number; id: string; text: string }[] = [];
paragraphs.forEach((p, i) => {
  const text = paraText(p);
  if (!text) return;
  if (NOTE_RE.test(text) || /\[[^\]]{3,80}\]/.test(text)) {
    hits.push({ i, id: p.match(/w14:paraId="([^"]+)"/)?.[1] || '', text });
  }
});

writeFileSync(
  join(process.cwd(), 'temp/report-iei-extract/analysis/all-instruction-phrases.txt'),
  hits.map((h) => `[${h.i}|${h.id}] ${h.text}`).join('\n\n'),
);
console.log('instruction-like paras', hits.length);
hits.forEach((h) => console.log(`\n[${h.i}] ${h.text.slice(0, 280)}`));
