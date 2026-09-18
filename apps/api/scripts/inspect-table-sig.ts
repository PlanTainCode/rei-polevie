const PizZip = require('pizzip');
const { readFileSync } = require('fs');

const xml = new PizZip(readFileSync('templates/Программа ИЭИ актуальная.docx', 'binary'))
  .file('word/document.xml')!
  .asText();

const headerIdx = xml.indexOf('Предварительные сведения о наличии участков');
const trStart = xml.lastIndexOf('<w:tr', headerIdx);
const trEnd = headerIdx + xml.slice(headerIdx).indexOf('</w:tr>') + 7;
const row = xml.slice(trStart, trEnd);
console.log('8.2 row length', row.length);
console.log('8.2 row paras:', [...row.matchAll(/w14:paraId="([A-F0-9]+)"/g)].map((m) => m[1]));
console.log(
  '8.2 texts:',
  [...row.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(' | ').slice(0, 300),
);

// Find table that contains 8.2 and see if signatures are in same table
const tblStart = xml.lastIndexOf('<w:tbl>', headerIdx);
const after = xml.slice(tblStart);
// find matching end - naive count
let depth = 0;
let i = 0;
let tblEnd = -1;
while (i < after.length) {
  if (after.startsWith('<w:tbl>', i) || after.startsWith('<w:tbl ', i)) {
    depth++;
    i += 5;
    continue;
  }
  if (after.startsWith('</w:tbl>', i)) {
    depth--;
    if (depth === 0) {
      tblEnd = i + 8;
      break;
    }
  }
  i++;
}
const table = after.slice(0, tblEnd);
console.log('\nTable length', table.length);
console.log('Has Матвеева?', table.includes('Матвеева'));
console.log('Has Приложение?', table.includes('Приложение'));
console.log('Has 8.3?', table.includes('Обоснование предполагаемых границ'));
console.log('Has 8.4?', table.includes('Обоснование границ изучаемой'));

// Where is signature relative to table end
const sigIdx = xml.indexOf('Матвеева');
console.log('\nМатвеева at', sigIdx, 'table', tblStart, '-', tblStart + tblEnd);
console.log('signature after table?', sigIdx > tblStart + tblEnd);

// Check header2 for signature-looking content
const h2 = new PizZip(readFileSync('templates/Программа ИЭИ актуальная.docx', 'binary'))
  .file('word/header2.xml')!
  .asText();
console.log('\nheader2 snippet around pict/drawing:');
const d = h2.indexOf('drawing');
console.log(h2.slice(Math.max(0, d - 100), d + 500));
