import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const xml = readFileSync(join(process.cwd(), 'temp/report-iei-extract/word/document.xml'), 'utf8');

function paraText(p: string): string {
  return [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

const paragraphs = [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
const lines: string[] = [];
paragraphs.forEach((p, i) => {
  if (i > 400) return;
  const paraId = p.match(/w14:paraId="([^"]+)"/)?.[1] || '';
  const text = paraText(p);
  if (!text && !paraId) return;
  lines.push(`${String(i).padStart(4, '0')} ${paraId.padEnd(10)} ${text}`);
});
writeFileSync(join(process.cwd(), 'temp/report-iei-extract/analysis/paraids-0-400.txt'), lines.join('\n'));
console.log(lines.length);
