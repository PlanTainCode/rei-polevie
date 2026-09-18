import { readFileSync } from 'fs';
import PizZip from 'pizzip';

const xml = new PizZip(readFileSync('templates/отчет-иэи/Шаблон отчета по ИЭИ.docx'))
  .file('word/document.xml')!
  .asText();

const c = xml.indexOf('w14:paraId="9B2F0E3D"');
console.log('customer in tbl?', xml.lastIndexOf('<w:tbl', c) > xml.lastIndexOf('</w:tbl>', c));
const tblStart = xml.lastIndexOf('<w:tbl', c);
const tblEnd = xml.indexOf('</w:tbl>', c);
console.log('tbl span', tblEnd - tblStart);
const tbl = xml.slice(tblStart, tblEnd + 8);
const rows = [...tbl.matchAll(/<w:tr[\s\S]*?<\/w:tr>/g)];
console.log('rows', rows.length);
rows.forEach((r, i) => {
  const t = [...r[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(' ');
  const id = r[0].match(/w14:paraId="([^"]+)"/)?.[1];
  console.log(i, id, JSON.stringify(t).slice(0, 120));
});
