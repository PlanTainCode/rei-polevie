import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PizZip from 'pizzip';
import { SECTION_82_DEFAULT_TEXT, replaceProgramIeiSection82Block } from '../src/modules/word/program-iei/section-82';
import { WordService } from '../src/modules/word/word.service';
const xml = new PizZip(readFileSync(join(import.meta.dir, '../templates/Программа ИЭИ актуальная.docx'))).file('word/document.xml')!.asText();
const text = (s: string) => [...s.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');
test('generation preserves updated climate, landscape and images', () => {
  const service = new WordService({} as any, {} as any, {} as any);
  const updated = (service as any).replaceProgramIeiSection31Block(xml,
    { regionType: 'MOSCOW_CITY', moscowDistrict: 'Соколиная Гора' },
    { objectLocation: 'г. Москва', siteDescription: '' }, {});
  expect(text(updated)).toContain('среднегодовая температура воздуха – +5,5ºС');
  expect(text(updated)).toContain('январе – -7,9ºС');
  expect(text(updated)).toContain('июле +18,8 ºС');
  expect(text(updated)).toContain('суммарное количество осадков за год – 713 мм.');
  expect(text(updated)).toContain('Мещёрской озёрно-ледниковой низменной равнине');
  expect(updated.match(/<w:drawing\b/g)?.length).toBe(xml.match(/<w:drawing\b/g)?.length);
});
test('default section82 keeps exact formatting, user text still overrides', () => {
  expect(replaceProgramIeiSection82Block({ xml, section82Text: SECTION_82_DEFAULT_TEXT })).toBe(xml);
  expect(replaceProgramIeiSection82Block({ xml, section82Text: null })).toBe(xml);
  const custom = replaceProgramIeiSection82Block({ xml, section82Text: 'Мой сохранённый текст\nВторая строка' });
  expect(text(custom)).toContain('Мой сохранённый текстВторая строка');
  expect(text(custom)).not.toContain('Лес на реке Самородинке');
});
test('web default agrees with the new Word section82', () => {
  const web = readFileSync(join(import.meta.dir, '../../web/src/pages/projects/ProgramIeiPage.tsx'), 'utf8');
  const defaultText = web.match(/const SECTION_82_DEFAULT = `([\s\S]*?)`;/)![1];
  expect(defaultText).toBe(SECTION_82_DEFAULT_TEXT);
  const bodyText = text(xml);
  for (const paragraph of defaultText.split('\n\n')) expect(bodyText).toContain(paragraph);
  expect(bodyText).not.toContain('Кожуховский затон');
});
