import { describe, expect, test } from 'bun:test';
import { replaceTextAcrossWordRuns } from '../src/modules/word/program-iei/docx-xml';

function visibleText(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('');
}

describe('replaceTextAcrossWordRuns', () => {
  test('заменяет номер ИГМИ, разбитый Word на несколько runs', () => {
    const xml =
      '<w:p>' +
      '<w:r><w:t>№ </w:t></w:r>' +
      '<w:r><w:t>801-</w:t></w:r>' +
      '<w:r><w:t>…</w:t></w:r>' +
      '<w:r><w:t>-2</w:t></w:r>' +
      '<w:r><w:t>6</w:t></w:r>' +
      '<w:r><w:t>-П</w:t></w:r>' +
      '<w:r><w:t>ГМ-1</w:t></w:r>' +
      '<w:r><w:t xml:space="preserve"> стр. </w:t></w:r>' +
      '<w:fldSimple w:instr="PAGE"><w:r><w:t>2</w:t></w:r></w:fldSimple>' +
      '</w:p>';

    const result = replaceTextAcrossWordRuns(
      xml,
      /№\s*801-[^-]*-\d{2}-ПГМ(?:-1)?/,
      '№ 801-145-25-ПГМ-1',
    );

    expect(visibleText(result)).toBe('№ 801-145-25-ПГМ-1 стр. 2');
    expect(result).toContain('w:instr="PAGE"');
  });

  test('не меняет XML, если видимый текст не совпал', () => {
    const xml = '<w:p><w:r><w:t>Без номера документа</w:t></w:r></w:p>';
    expect(replaceTextAcrossWordRuns(xml, /№ 801-/, 'замена')).toBe(xml);
  });
});
