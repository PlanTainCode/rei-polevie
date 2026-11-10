import type { MaedCalculationSettings } from '@/api/maed';

export function parseMaedInput(input: string, max = Infinity): number {
  const text = input.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Введите неотрицательное число. Десятичный разделитель — точка или запятая.');
  const value = Number(text);
  if (!Number.isFinite(value) || value > max) throw new Error(`Значение слишком велико${max === Infinity ? '' : `: максимум ${max} %`}`);
  return value;
}

export function parseMaedSettings(main: string, additional: string): MaedCalculationSettings {
  const additionalErrorsPercent = additional.trim() === '' ? [] : additional.split(';').map((part) => parseMaedInput(part, 1000));
  if (additionalErrorsPercent.length > 30) throw new Error('Допускается не более 30 дополнительных погрешностей');
  return { mainErrorPercent: parseMaedInput(main, 1000), additionalErrorsPercent };
}
