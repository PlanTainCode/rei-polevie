import { BadRequestException } from '@nestjs/common';
import type { MaedPoint } from './maed-parser';

export interface MaedCalculationSettings {
  mainErrorPercent: number;
  additionalErrorsPercent: number[];
}

export const ZYABLIK_SOURCE = 'https://www.doza.ru/files/zyablik-opisanie_2021.pdf';

export function defaultMaedSettings(instrumentName: string | null | undefined): MaedCalculationSettings | null {
  if (!instrumentName || !/зяблик/i.test(instrumentName) || !/БДКГ[-\s]*Р20Д/i.test(instrumentName)) return null;
  // Описание типа 75812-19, редакция 2021 г., таблица 2, лист 5.
  // Дополнительные влияния НЕ считаются установленными: это базовая оценка.
  return { mainErrorPercent: 13, additionalErrorsPercent: [] };
}

export function validateMaedSettings(settings: MaedCalculationSettings) {
  if (!settings || !Array.isArray(settings.additionalErrorsPercent) || settings.additionalErrorsPercent.length > 30 ||
    [settings.mainErrorPercent, ...settings.additionalErrorsPercent].some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000)) {
    throw new BadRequestException('Погрешности должны быть числами от 0 до 1000 %, не более 30 дополнительных составляющих');
  }
}

export function calculateMaedUncertainty(points: MaedPoint[], settings: MaedCalculationSettings | null) {
  const unavailable = (reason: string) => ({ uncertainty: null, typeA: null, typeBPercent: null, combinedPercent: null, reason });
  if (!settings) return unavailable('Не удалось определить параметры прибора. Укажите погрешности в настройках расчёта или введите готовую δ.');
  validateMaedSettings(settings);
  if (points.length < 2) return unavailable('Для расчёта по формулам многократных измерений нужны минимум две точки. Для одной точки введите готовую δ.');
  if (points.some((point) => !Number.isFinite(point.value) || point.value < 0)) throw new BadRequestException('Некорректные значения МАЭД');
  const mean = points.reduce((sum, point) => sum + point.value, 0) / points.length;
  if (mean <= 0) return unavailable('При нулевом среднем относительная неопределённость по этим формулам не определена.');
  // Формулы (8)–(14) из предоставленного пользователем раздела VII МР.
  // Точки условно рассматриваются как одна серия для оценки среднего по участку.
  const typeA = Math.sqrt(points.reduce((sum, point) => sum + (point.value - mean) ** 2, 0) / (points.length * (points.length - 1)));
  const typeBPercent = Math.sqrt([settings.mainErrorPercent, ...settings.additionalErrorsPercent].reduce((sum, value) => sum + value ** 2, 0) / 3);
  const combinedPercent = Math.hypot(typeA / mean * 100, typeBPercent);
  const uncertainty = 2 * combinedPercent * mean / 100;
  if (![typeA, typeBPercent, combinedPercent, uncertainty].every(Number.isFinite)) throw new BadRequestException('Значения слишком велики для расчёта');
  return { uncertainty, typeA, typeBPercent, combinedPercent, reason: null };
}
