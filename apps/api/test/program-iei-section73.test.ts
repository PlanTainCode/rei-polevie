import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PizZip from 'pizzip';
import { fixMissingSpacesInDocxXml } from '../src/modules/word/program-iei/docx-xml';
import {
  extractProgramIeiSection73Paragraphs,
  restoreProgramIeiSection73Paragraphs,
} from '../src/modules/word/program-iei/section-73';

function paraText(xml: string, paraId: string): string {
  const match = xml.match(
    new RegExp(`<w:p[^>]*w14:paraId="${paraId}"[^>]*>([\\s\\S]*?)</w:p>`),
  );
  if (!match) return '';
  return [...match[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

test('п.7.3 восстанавливается дословно после fixMissingSpaces', () => {
  const templatePath = join(
    process.cwd(),
    'templates',
    'Программа ИЭИ актуальная.docx',
  );
  const xml = new PizZip(readFileSync(templatePath, 'binary'))
    .file('word/document.xml')!
    .asText();

  const snapshot = extractProgramIeiSection73Paragraphs(xml);
  expect(snapshot.size).toBe(4);

  const before = paraText(xml, '6FCF8BEF');
  expect(before).toContain('docx,odt');

  let mutated = fixMissingSpacesInDocxXml(xml);
  // пост-обработка может вставить пробел в перечень форматов
  const afterFix = paraText(mutated, '6FCF8BEF');
  expect(afterFix === before || afterFix.includes('docx, odt')).toBe(true);

  mutated = restoreProgramIeiSection73Paragraphs(mutated, snapshot);
  expect(paraText(mutated, '6FCF8BEF')).toBe(before);
  expect(paraText(mutated, '6E2000C2')).toBe(paraText(xml, '6E2000C2'));
  expect(paraText(mutated, '6E2000C3')).toBe(paraText(xml, '6E2000C3'));
  expect(paraText(mutated, '763BD95A')).toBe(paraText(xml, '763BD95A'));
});
