const PizZip = require('pizzip');
const { readFileSync, writeFileSync } = require('fs');

const xml = new PizZip(readFileSync('templates/Программа ИЭИ актуальная.docx', 'binary'))
  .file('word/document.xml')!
  .asText();

for (const id of [
  '24E9F5C8',
  '24D5F1A8',
  '1F97E2B0',
  '2EE89B11',
  '2DB7DF77',
  '7D7FB64E',
  '7BBAFD56',
  '4D132C03',
  '4EF49113',
]) {
  const m = xml.match(new RegExp(`<w:p[^>]*w14:paraId="${id}"[^>]*>[\\s\\S]*?</w:p>`));
  console.log('\n', id, m?.[0]);
}

const h2 = new PizZip(readFileSync('templates/Программа ИЭИ актуальная.docx', 'binary'))
  .file('word/header2.xml')!
  .asText();
writeFileSync('/tmp/header2-full.xml', h2);

// Extract shape/image parts from header2
const shapes = [...h2.matchAll(/<v:shape[\s\S]*?<\/v:shape>/g)];
console.log('\nheader2 shapes', shapes.length);
for (const s of shapes) {
  console.log(s[0].slice(0, 400));
  console.log('---');
}
const bins = [...h2.matchAll(/<w:binData[\s\S]*?<\/w:binData>/g)];
console.log('binData', bins.length, bins.map((b) => b[0].slice(0, 100)));
