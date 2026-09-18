const PizZip = require('pizzip');
const { readFileSync, readdirSync } = require('fs');
const { join } = require('path');

function paraText(body: string) {
  return [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('');
}

function hasEndSigs(xml: string) {
  return {
    matveeva: xml.includes('Матвеева'),
    shtefanova: xml.includes('Штефанова'),
    burnatskaya: xml.includes('Бурнацкая'),
    nrs: xml.includes('НРС'),
    para7D: xml.includes('w14:paraId="7D6F6FC9"'),
    appendix: xml.includes('Приложение 1'),
  };
}

const files = readdirSync('generated')
  .filter((f) => f.includes('ПЭ') && f.endsWith('.docx'))
  .map((f) => ({ f, m: require('fs').statSync(join('generated', f)).mtimeMs }))
  .sort((a, b) => b.m - a.m);

for (const file of files.slice(0, 8)) {
  const xml = new PizZip(readFileSync(join('generated', file.f), 'binary'))
    .file('word/document.xml')!
    .asText();
  console.log(file.f, hasEndSigs(xml));
}

// Dump structure around end signatures in template - full runs of name lines
const tpl = new PizZip(readFileSync('templates/Программа ИЭИ актуальная.docx', 'binary'))
  .file('word/document.xml')!
  .asText();

console.log('\n=== Template signature block structure ===');
const start = tpl.indexOf('w14:paraId="7D6F6FC9"');
const end = tpl.indexOf('</w:sectPr>', start);
const block = tpl.slice(tpl.lastIndexOf('<w:p ', start), end);
console.log('block length', block.length);
// Check for tabs in name lines (signature spacing)
for (const id of ['7D6F6FC9', '7C2AF9B3', '78A40877']) {
  const m = block.match(new RegExp(`<w:p[^>]*w14:paraId="${id}"[^>]*>[\\s\\S]*?</w:p>`));
  if (!m) continue;
  const hasTab = m[0].includes('<w:tab');
  const texts = [...m[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((x) =>
    JSON.stringify(x[1]),
  );
  console.log(id, 'tabs=', hasTab, 'texts=', texts);
}
