const PizZip = require('pizzip');
const { readFileSync, readdirSync, writeFileSync } = require('fs');
const { join } = require('path');

const ids = [
  '24E9F5C8',
  '24D5F1A8',
  '1F97E2B0',
  '2EE89B11',
  '2DB7DF77',
  '7D7FB64E',
  '7BBAFD56',
  '4D132C03',
  '4EF49113',
  '7D6F6FC9',
  '7C2AF9B3',
  '78A40877',
];

function dump(label: string, xml: string) {
  console.log('\n====', label);
  for (const id of ids) {
    const re = new RegExp(`<w:p[^>]*w14:paraId="${id}"[^>]*>([\\s\\S]*?)</w:p>`);
    const m = xml.match(re);
    if (!m) {
      console.log(id, 'MISSING');
      continue;
    }
    const body = m[1];
    const text = [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((x) => x[1])
      .join('');
    const hasDrawing = /w:drawing|w:pict|v:imagedata|w:object|mc:AlternateContent|w:binData/.test(
      body,
    );
    console.log(
      id,
      'len=' + body.length,
      'media=' + hasDrawing,
      'text=' + JSON.stringify(text.slice(0, 80)),
    );
    if (hasDrawing || body.length > 800) {
      writeFileSync(`/tmp/para-${label}-${id}.xml`, body);
      console.log('  wrote /tmp/para-' + label + '-' + id + '.xml');
    }
  }
}

const tplZip = new PizZip(readFileSync('templates/Программа ИЭИ актуальная.docx', 'binary'));
const tpl = tplZip.file('word/document.xml')!.asText();
dump('TEMPLATE', tpl);

const rels = tplZip.file('word/_rels/document.xml.rels')!.asText();
console.log('\n=== TEMPLATE RELS images ===');
for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="media\/([^"]+)"/g)) {
  console.log(m[1], '->', m[2]);
}

// Find which image is referenced near the end of document
const end = tpl.slice(tpl.indexOf('7D6F6FC9'));
console.log('\nembed refs near signatures:', [...end.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]));
console.log('r:id refs near signatures:', [...end.matchAll(/r:id="([^"]+)"/g)].map((m) => m[1]));
console.log('v:imagedata near signatures:', [...end.matchAll(/v:imagedata[^>]*>/g)].map((m) => m[0]));

const files = readdirSync('generated')
  .filter((f) => f.includes('ПЭ') && f.endsWith('.docx'))
  .map((f) => ({ f, m: require('fs').statSync(join('generated', f)).mtimeMs }))
  .sort((a, b) => b.m - a.m);
const gZip = new PizZip(readFileSync(join('generated', files[0].f), 'binary'));
dump('GENERATED', gZip.file('word/document.xml')!.asText());
const gRels = gZip.file('word/_rels/document.xml.rels')!.asText();
console.log('\n=== GENERATED RELS images ===');
for (const m of gRels.matchAll(/Id="([^"]+)"[^>]*Target="media\/([^"]+)"/g)) {
  console.log(m[1], '->', m[2]);
}
