import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PizZip from 'pizzip';
import {
  fixMissingSpacesInDocxXml,
  needsSpaceBetweenTextParts,
} from '../src/modules/word/program-iei/docx-xml';

test('не вставляет пробел в морфологические хвосты и короткие слоги', () => {
  expect(needsSpaceBetweenTextParts('подготовка сотруднико', 'м(-ами)')).toBe(false);
  expect(needsSpaceBetweenTextParts('устранение исполнителе', 'м(-ями)')).toBe(false);
  expect(needsSpaceBetweenTextParts('бумажном ви', 'де в соответствии')).toBe(false);
  expect(needsSpaceBetweenTextParts('замечаний по', 'результатам')).toBe(true);
  expect(needsSpaceBetweenTextParts('формате', '.pdf')).toBe(false);
});

test('ИГМИ п.4.6: после fixMissingSpaces нет «сотруднико м» / «ви де»', () => {
  const xml = new PizZip(
    readFileSync(join(process.cwd(), 'templates', 'игми', 'Программа ИГМИ (1).docx'), 'binary'),
  )
    .file('word/document.xml')!
    .asText();

  const fixed = fixMissingSpacesInDocxXml(xml);
  const text = [...fixed.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');

  expect(text).toContain('сотрудником(-ами)');
  expect(text).not.toContain('сотруднико м');
  expect(text).toContain('исполнителем(-ями)');
  expect(text).not.toContain('исполнителе м');
  expect(text).toContain('бумажном виде в соответствии');
  expect(text).not.toContain('ви де');
});
