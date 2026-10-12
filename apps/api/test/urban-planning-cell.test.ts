import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PizZip from 'pizzip';
import { replaceUrbanPlanningActivityCell } from '../src/modules/word/program-iei/urban-planning';
import { replaceParagraphTextByParaIdPreserveRunProps } from '../src/modules/word/program-iei/docx-xml';

for (const file of ['игми/Программа ИГМИ (1).docx', 'Программа ИЭИ актуальная.docx']) {
  test(`вид деятельности меняется только в своей ячейке: ${file}`, () => {
    const zip = new PizZip(readFileSync(join(import.meta.dir, '../templates', file)));
    let xml = zip.file('word/document.xml')!.asText();
    for (const [id, name] of [['22CE0801', 'Реконструкция сетей связи'], ['1B932D72', 'Строительство здания']]) {
      xml = replaceParagraphTextByParaIdPreserveRunProps(xml, id, name);
    }
    const value = 'Реконструкция, капитальный ремонт';
    const updated = replaceUrbanPlanningActivityCell(xml, value);
    const rows = (s: string) => [...s.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map(m => m[0]);
    const before = rows(xml), after = rows(updated);
    expect(after.length).toBe(before.length);
    const changed = before.flatMap((row, i) => row === after[i] ? [] : [i]);
    expect(changed).toHaveLength(1);
    expect(after[changed[0]]).toContain(value);
    expect(after[changed[0]]).not.toContain('Архитектурно-строительное проектирование');
    expect(replaceUrbanPlanningActivityCell(updated, value)).toBe(updated);
    expect(replaceUrbanPlanningActivityCell(xml, '')).toBe(xml);
  });
}
