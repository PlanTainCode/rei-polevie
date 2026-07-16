import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import PizZip from 'pizzip';

const templatePath = join(
  import.meta.dir,
  '..',
  'templates',
  'игми',
  'Программа ИГМИ (1).docx',
);

function visibleText(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('');
}

describe('актуальный шаблон ИГМИ', () => {
  test('сохраняет якоря генератора и очищенное содержимое нового шаблона', async () => {
    const zip = new PizZip(await readFile(templatePath));
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    const documentText = visibleText(documentXml);

    for (const paraId of [
      '22CE0801',
      '1B932D72',
      '45F9CC84',
      '332D0BAC',
      '6A4D9E21',
      '3180C077',
    ]) {
      expect(documentXml).toContain(`w14:paraId="${paraId}"`);
    }

    expect(documentXml).not.toContain('<w:strike');
    expect(documentXml).not.toContain('<w:dstrike');
    expect(documentText).not.toContain('Впиши ближайшую реку');
    expect(documentText).toContain('СП 131.13330.2025');
    expect(documentText).toContain('ГОСТ Р 21.101-2026');
    expect(documentText).toContain('СДС.ТП.СМ.22265-26');
  });

  test('содержит новые подписи, карту и код ПГМ-1', async () => {
    const zip = new PizZip(await readFile(templatePath));
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    const relationshipsXml = zip.file('word/_rels/document.xml.rels')?.asText() ?? '';
    const footerXml = [
      zip.file('word/footer1.xml')?.asText() ?? '',
      zip.file('word/footer2.xml')?.asText() ?? '',
    ].join('');

    expect(documentXml).toContain('Т.С.Матвеева');
    expect(documentXml).toContain('У.Н.Штефанова');
    expect(documentXml).toContain('И.М.Бурнацкая');
    expect(relationshipsXml).toContain('igmi-signature-matveeva.png');
    expect(relationshipsXml).toContain('igmi-signature-shtefanova.png');
    expect(relationshipsXml).toContain('igmi-signature-burnatskaya.png');
    expect(relationshipsXml).toContain('igmi-appendix-2-map.png');
    expect(footerXml).toContain('ГМ-1');
  });
});
