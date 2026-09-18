import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import PizZip from 'pizzip';

const SRC = join(process.cwd(), 'templates/отчет-иэи/Шаблон отчета по ИЭИ.dotm');
const OUT = join(process.cwd(), 'templates/отчет-иэи/Шаблон отчета по ИЭИ.docx');
const MAP = join(process.cwd(), 'temp/report-iei-extract/analysis/paraid-map.json');

function paraText(p: string): string {
  return [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function stampXml(xml: string, prefix: string): { xml: string; map: { id: string; text: string }[] } {
  const used = new Set<string>();
  const map: { id: string; text: string }[] = [];
  let n = 0;
  const stamped = xml.replace(/<w:p(?=[\s>])([^>]*)>/g, (full, attrs: string) => {
    const existing = attrs.match(/w14:paraId="([^"]+)"/)?.[1];
    if (existing) {
      used.add(existing.toUpperCase());
      return full;
    }
    n += 1;
    let id = '';
    for (let salt = 0; salt < 20; salt++) {
      id = createHash('md5')
        .update(`${prefix}:${n}:${salt}`)
        .digest('hex')
        .slice(0, 8)
        .toUpperCase();
      if (!used.has(id)) break;
    }
    used.add(id);
    const trimmed = attrs.trim();
    return trimmed ? `<w:p ${trimmed} w14:paraId="${id}">` : `<w:p w14:paraId="${id}">`;
  });

  const paragraphs = [...stamped.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
  for (const p of paragraphs) {
    const id = p.match(/w14:paraId="([^"]+)"/)?.[1];
    if (!id) continue;
    const text = paraText(p);
    if (text) map.push({ id, text });
  }
  return { xml: stamped, map };
}

const zip = new PizZip(readFileSync(SRC));
const files = [
  'word/document.xml',
  'word/header1.xml',
  'word/header2.xml',
  'word/header3.xml',
  'word/header4.xml',
  'word/header5.xml',
  'word/header6.xml',
  'word/header7.xml',
  'word/footer1.xml',
  'word/footer2.xml',
  'word/footer3.xml',
  'word/footer4.xml',
  'word/footer5.xml',
  'word/footer6.xml',
  'word/footer7.xml',
  'word/footer8.xml',
];

const allMaps: Record<string, { id: string; text: string }[]> = {};
for (const file of files) {
  const entry = zip.file(file);
  if (!entry) continue;
  const { xml, map } = stampXml(entry.asText(), file);
  zip.file(file, xml);
  allMaps[file] = map;
  console.log(file, 'paras with text', map.length);
}

mkdirSync(join(process.cwd(), 'temp/report-iei-extract/analysis'), { recursive: true });
writeFileSync(MAP, JSON.stringify(allMaps, null, 2));

const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(OUT, buf);
console.log('wrote', OUT, buf.length);

const doc = allMaps['word/document.xml'] || [];
const interesting = doc.filter((p) =>
  /Название объекта|ТЕХНИЧЕСКИЙ|Том 1\.3|Введение|Цели, задачи|Законодательная|Сведения о заказчике|Сведения об изыскательской|аккредитован|Состав исполнителей|Краткая характеристика|Инженерно-экологическая изученность|Название объекта|ГВИН-ПИН|май 2026|мае 2026|384-ФЗ|сторонам света|Рисунок 1\.|Директор|Матвеева|52015|для подготовки/i.test(
    p.text,
  ),
);
writeFileSync(
  join(process.cwd(), 'temp/report-iei-extract/analysis/key-paraids.txt'),
  interesting.map((p) => `${p.id}\t${p.text.slice(0, 180)}`).join('\n'),
);
console.log('key paras', interesting.length);
