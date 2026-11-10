import { expect, test } from 'bun:test';
import { maedClipboard, maedRows } from '../src/pages/indicators/maed-results';
import { parseMaedInput, parseMaedSettings } from '../src/pages/indicators/maed-settings';

const summary = { mean: 0.132, uncertainty: 0.014, meanWithUncertainty: 0.146, max: 0.15, min: 0.12 };

test('МАЭД: столбец из пяти значений в порядке отчёта, округление только на выводе', () => {
  expect(maedClipboard(summary, true).text).toBe('0.13\n0.01\n0.15\n0.15\n0.12');
  expect(maedClipboard(summary, true).html.match(/<tr>/g)).toHaveLength(5);
  const table = maedClipboard(summary, false);
  expect(table.text.split('\n')).toHaveLength(6);
  expect(table.text).toContain('Максимальное значение МАЭД ГИ, Hmax\t0.15');
  expect(table.html).toContain('<thead>');
  expect(maedRows({ ...summary, mean: 0.145 })[0].value).toBe('0.15');
});

test('МАЭД: неизвестная δ не копируется как ноль; нулевая δ допустима', () => {
  const unknown = { ...summary, uncertainty: null, meanWithUncertainty: null };
  expect(maedRows(unknown)[1].value).toBeNull();
  expect(() => maedClipboard(unknown, true)).toThrow('необходимо указать');
  expect(maedRows({ ...summary, uncertainty: 0 })[1].value).toBe('0.00');
});

test('МАЭД: параметры принимают десятичные запятые, пустое значение не становится нулём', () => {
  expect(parseMaedSettings('13', '3; 5,5')).toEqual({ mainErrorPercent: 13, additionalErrorsPercent: [3, 5.5] });
  expect(parseMaedSettings('13', '')).toEqual({ mainErrorPercent: 13, additionalErrorsPercent: [] });
  expect(parseMaedInput('0,02')).toBe(.02);
  expect(parseMaedInput('0')).toBe(0);
  for (const text of ['', '   ', '-1', '1abc', 'Infinity']) expect(() => parseMaedInput(text)).toThrow();
  expect(() => parseMaedSettings('1001', '')).toThrow();
  expect(() => parseMaedSettings('13', '3;')).toThrow();
});

test('МАЭД: пять значений для базовой оценки с θ=13 % копируются без предварительного округления', () => {
  const uncertainty = 0.022991755043928253;
  const result = { mean: .132, uncertainty, meanWithUncertainty: .132 + uncertainty, max: .15, min: .12 };
  expect(maedClipboard(result, true).text).toBe('0.13\n0.02\n0.15\n0.15\n0.12');
});

test('МАЭД: минимум «менее 0.1» одинаково отображается и копируется, включая равный числовой результат', () => {
  const result = { ...summary, min: .1 };
  const points = [
    { number: '1', value: .1, uncertainty: .04 },
    { number: '2', value: .1, uncertainty: null, belowLimit: true, sourceValue: 'менее 0.1' },
  ];
  expect(maedRows(result, points)[4].value).toBe('менее 0.1');
  expect(maedClipboard(result, true, points).text.split('\n')[4]).toBe('менее 0.1');
  expect(maedClipboard(result, false, points).html).toContain('>менее 0.1</td>');
  expect(maedRows(result, points).slice(0, 4)).toEqual(maedRows(result).slice(0, 4));
  expect(maedRows(result, points.slice(0, 1))[4].value).toBe('0.10');
});
