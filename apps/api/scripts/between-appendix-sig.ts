const PizZip = require('pizzip');
const { readFileSync, writeFileSync } = require('fs');

const xml = new PizZip(readFileSync('templates/Программа ИЭИ актуальная.docx', 'binary'))
  .file('word/document.xml')!
  .asText();

const start = xml.indexOf('План организации производства работ');
const end = xml.indexOf('Матвеева', start);
const mid = xml.slice(start, end + 200);
writeFileSync('/tmp/between-appendix-sig.xml', mid);
console.log('between length', mid.length);
console.log('drawings', (mid.match(/w:drawing/g) || []).length);
console.log('pict', (mid.match(/w:pict/g) || []).length);
console.log('br page', (mid.match(/w:br w:type="page"/g) || []).length);
console.log('lastRenderedPageBreak', (mid.match(/lastRenderedPageBreak/g) || []).length);
console.log(
  'paras',
  [...mid.matchAll(/w14:paraId="([A-F0-9]+)"/g)].map((m) => m[1]),
);

// Also check title area for signature images near first Маренный / Мавеева
const titleEnd = xml.indexOf('Программа');
const title = xml.slice(0, Math.min(titleEnd + 5000, 80000));
console.log('\ntitle drawings', (title.match(/w:drawing/g) || []).length);
console.log('title pict', (title.match(/w:pict/g) || []).length);
console.log(
  'title embeds',
  [...title.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]),
);

// Look for "Маренный" signature image on title
console.log('Маренный count', (xml.match(/Маренный/g) || []).length);
console.log('_______________ count tpl', (xml.match(/_{5,}/g) || []).length);
