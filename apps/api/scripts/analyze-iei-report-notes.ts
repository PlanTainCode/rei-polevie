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

type Note = { color: string; text: string };
function notesOf(p: string): Note[] {
  const out: Note[] = [];
  for (const r of p.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)) {
    const run = r[0];
    const color = run.match(/<w:color w:val="([^"]+)"/)?.[1];
    const highlight = run.match(/<w:highlight w:val="([^"]+)"/)?.[1];
    const text = [...run.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((m) => m[1])
      .join('');
    if (!text.trim()) continue;
    const auto = !color || /^(000000|AUTO|1A1A1A)$/i.test(color);
    if (color && !auto) out.push({ color: color.toUpperCase(), text });
    if (highlight) out.push({ color: `hl:${highlight}`, text });
  }
  return out;
}

const INSTRUCTION_RE =
  /как в|из п\.|из программы|программ|заполн|если |удал|оставить|по аналогии|также|то же|из тз|из поручен|не использовать|при наличии|при обследован|обязательно|берем|берём|пишем|нужно|пример|удалить|не справка|не делаем|москва|благоустрой/i;

const instructionNotes: string[] = [];
const allRedYellow: string[] = [];

paragraphs.forEach((p, i) => {
  const text = paraText(p);
  const notes = notesOf(p);
  if (!notes.length) return;
  const interesting = notes.filter((n) =>
    /FF0000|C00000|FFFF00|FFC000|00B050|E96E09|E36C0A|31849B|0070C0|00B0F0|FF00FF|hl:yellow|hl:green|hl:cyan|hl:magenta|hl:red|hl:darkYellow/.test(
      n.color,
    ),
  );
  if (!interesting.length) return;
  const joinedNotes = interesting.map((n) => `[${n.color}] ${n.text}`).join(' | ');
  allRedYellow.push(`[${i}] ${text.slice(0, 220)}\n  ${joinedNotes}`);
  if (INSTRUCTION_RE.test(text) || INSTRUCTION_RE.test(joinedNotes)) {
    instructionNotes.push(`[${i}] ${text}\n  ${joinedNotes}`);
  }
});

writeFileSync(
  join(process.cwd(), 'temp/report-iei-extract/analysis/instruction-notes.txt'),
  instructionNotes.join('\n\n'),
);
writeFileSync(
  join(process.cwd(), 'temp/report-iei-extract/analysis/red-yellow.txt'),
  allRedYellow.join('\n\n'),
);

// Body start: second "Введение" after TOC
const introIdxs = paragraphs
  .map((p, i) => ({ i, t: paraText(p) }))
  .filter((x) => x.t === 'Введение')
  .map((x) => x.i);
const bodyStart = introIdxs[1] ?? introIdxs[0] ?? 0;

const chapter2 = paragraphs.findIndex(
  (p, i) => i > bodyStart && paraText(p) === 'Инженерно-экологическая изученность территории',
);
const section1Body = paragraphs.slice(bodyStart, chapter2 > 0 ? chapter2 : bodyStart + 200);

writeFileSync(
  join(process.cwd(), 'temp/report-iei-extract/analysis/section-1-body.txt'),
  section1Body
    .map((p, j) => {
      const i = bodyStart + j;
      const text = paraText(p);
      const notes = notesOf(p);
      const paraId = p.match(/w14:paraId="([^"]+)"/)?.[1] || '';
      const note = notes.length
        ? `\n  NOTES: ${notes.map((n) => `[${n.color}] ${n.text}`).join(' | ')}`
        : '';
      return `[${i}|${paraId}] ${text}${note}`;
    })
    .join('\n'),
);

console.log('intro idxs', introIdxs);
console.log('bodyStart', bodyStart, 'chapter2', chapter2);
console.log('instruction notes', instructionNotes.length);
console.log('red/yellow paras', allRedYellow.length);
console.log('section1 body paras', section1Body.length);
