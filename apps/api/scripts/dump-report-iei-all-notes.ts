import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import PizZip from 'pizzip';

const zip = new PizZip(readFileSync(join(process.cwd(), 'templates/отчет-иэи/Шаблон отчета по ИЭИ.docx')));

function texts(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

const comments = zip.file('word/comments.xml')?.asText() || '';
const footnotes = zip.file('word/footnotes.xml')?.asText() || '';
const endnotes = zip.file('word/endnotes.xml')?.asText() || '';
const doc = zip.file('word/document.xml')!.asText();

console.log('comment refs', (doc.match(/w:commentReference/g) || []).length);
console.log('comment range', (doc.match(/w:commentRangeStart/g) || []).length);
console.log('footnote refs', (doc.match(/w:footnoteReference/g) || []).length);
console.log('endnote refs', (doc.match(/w:endnoteReference/g) || []).length);
console.log('txbx', (doc.match(/w:txbxContent|wps:txbx/g) || []).length);
console.log('comments file bytes', comments.length);

const fns = [...footnotes.matchAll(/<w:footnote\b[^>]*w:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:footnote>/g)];
console.log('footnotes', fns.length);
const fnLines = fns
  .map((m) => `[${m[1]}] ${texts(m[2])}`)
  .filter((s) => s.replace(/\[[^\]]+\]\s*/, '').length > 2);
writeFileSync(join(process.cwd(), 'temp/report-iei-extract/analysis/footnotes.txt'), fnLines.join('\n\n'));
console.log('footnote texts', fnLines.length);
fnLines.slice(0, 30).forEach((l) => console.log(l.slice(0, 200)));

const boxes = [...doc.matchAll(/<w:txbxContent[\s\S]*?<\/w:txbxContent>/g)].map((m) => texts(m[0]));
console.log('\ntextboxes', boxes.length);
boxes.slice(0, 40).forEach((t, i) => console.log(i, t.slice(0, 220)));
writeFileSync(
  join(process.cwd(), 'temp/report-iei-extract/analysis/textboxes.txt'),
  boxes.map((t, i) => `[${i}] ${t}`).join('\n\n'),
);
