import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PizZip from 'pizzip';
import { replaceProgramIeiSection81Block } from '../src/modules/word/program-iei/section-81';

function section81ContentParas(xml: string): { text: string; hasBullet: boolean }[] {
  const header = 'Краткая природно-хозяйственная характеристика территории';
  const idx = xml.indexOf(header);
  const before = xml.slice(0, idx);
  const trStart = before.lastIndexOf('<w:tr');
  const after = xml.slice(idx);
  const trEnd = idx + after.indexOf('</w:tr>') + 7;
  const row = xml.slice(trStart, trEnd);
  const cells = [...row.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
  const cell = cells[2][0];
  return [...cell.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map((p) => ({
    text: [...p[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''),
    hasBullet: p[1].includes('<w:numPr>'),
  }));
}

test('п.8.1 сохраняет тире-маркеры у период строительства/эксплуатации', () => {
  const xml = new PizZip(
    readFileSync(join(process.cwd(), 'templates', 'Программа ИЭИ актуальная.docx'), 'binary'),
  )
    .file('word/document.xml')!
    .asText();

  const result = replaceProgramIeiSection81Block({
    xml,
    section81Data: {
      pollutionSourcesText: [
        'Существующие источники воздействия:',
        'проезжая часть автомобильных дорог – выбросы.',
        'Проектируемые источники воздействия:',
        'период строительства: строительная техника - выбросы.',
        'период эксплуатации: не оказывает негативного воздействия.',
      ].join('\n'),
    },
  });

  const paras = section81ContentParas(result);
  expect(paras.map((p) => p.text)).toEqual([
    'Существующие источники воздействия:',
    'проезжая часть автомобильных дорог – выбросы.',
    'Проектируемые источники воздействия:',
    'период строительства: строительная техника - выбросы.',
    'период эксплуатации: не оказывает негативного воздействия.',
  ]);
  expect(paras[1].hasBullet).toBe(true);
  expect(paras[3].hasBullet).toBe(true);
  expect(paras[4].hasBullet).toBe(true);
  expect(paras[0].hasBullet).toBe(false);
  expect(paras[2].hasBullet).toBe(false);
});
