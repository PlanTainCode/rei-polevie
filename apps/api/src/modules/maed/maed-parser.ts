import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface MaedPoint {
  number: string;
  value: number;
  uncertainty: number | null;
  // Для «менее L» value содержит L по согласованному правилу подстановки.
  belowLimit?: boolean;
  sourceValue?: string;
}

const text = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

function number(value: unknown, uncertainty = false): number | null {
  let input = text(value).replace(',', '.');
  if (uncertainty) input = input.replace(/^±\s*/, '');
  if (!/^\d+(?:\.\d+)?$/.test(input)) return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseMaed(buffer: Buffer) {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new BadRequestException('Не удалось прочитать Excel-файл');
  }
  const points: MaedPoint[] = [];
  let protocolNumber: string | null = null;
  let measurementDate: string | null = null;
  let instrumentName: string | null = null;
  let foundMaed = false;
  let validUnits = false;
  let pointColumn = -1;
  let valueColumn = -1;
  let uncertaintyColumn = -1;
  const seen = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });
    let active = false;
    for (const row of rows) {
      const cells = row.map(text);
      const line = cells.join(' ');
      protocolNumber ??= line.match(/Протокол\s*№\s*([^\s]+)/i)?.[1] ?? null;
      measurementDate ??= line.match(/Дата проведения измерений:\s*(\d{2}\.\d{2}\.\d{4})/i)?.[1] ?? null;
      instrumentName ??= cells.find((cell) => /дозиметр|радиометр/i.test(cell) && /зяблик|БДКГ[-\s]*Р20Д/i.test(cell)) ?? null;
      if (/мощност[ьи]\s+амбиентного\s+эквивалента\s+дозы/i.test(line)) foundMaed = true;
      if (/конец протокола/i.test(line)) { active = false; continue; }
      if (!foundMaed) continue;
      const pointHeader = cells.findIndex((cell) => /№\s*точки\s*измерения/i.test(cell));
      if (pointHeader >= 0) {
        pointColumn = pointHeader;
        validUnits = /мкЗв\s*\/\s*ч/i.test(line);
      }
      const valueHeader = cells.findIndex((cell) => /результат\s+измерения/i.test(cell));
      const uncertaintyHeader = cells.findIndex((cell) => /расширенная\s+неопредел[её]нность/i.test(cell));
      if (valueHeader >= 0 && uncertaintyHeader >= 0) {
        if (!validUnits) throw new BadRequestException('Ожидаются результаты МАЭД в мкЗв/ч в заголовке таблицы');
        if (!/k\s*=\s*2\b/i.test(cells[uncertaintyHeader])) {
          throw new BadRequestException('Ожидается расширенная неопределённость при k=2');
        }
        valueColumn = valueHeader;
        uncertaintyColumn = uncertaintyHeader;
        active = true;
        continue;
      }
      if (!active || pointColumn < 0) continue;
      // Нумерация граф таблицы — не измерение.
      if (cells.filter(Boolean).join('|') === '1|2|3|4') continue;
      const sequence = cells.find(Boolean) ?? '';
      if (!/^\d+$/.test(sequence)) continue;
      const point = cells[pointColumn];
      const sourceValue = text(row[valueColumn]);
      const belowLimitMatch = sourceValue.match(/^(?:менее\s*|<\s*)(\d+(?:[.,]\d+)?)$/i);
      const value = number(belowLimitMatch ? belowLimitMatch[1] : row[valueColumn]);
      const rawUncertainty = text(row[uncertaintyColumn]);
      const missingUncertainty = rawUncertainty === '' || /^[-–—−]+$/.test(rawUncertainty);
      const uncertainty = missingUncertainty ? null : number(rawUncertainty, true);
      if (!point || value === null || (belowLimitMatch && value === 0) || (!missingUncertainty && uncertainty === null)) {
        throw new BadRequestException(`Некорректное измерение в строке № ${sequence} (лист «${sheetName}»)`);
      }
      if (seen.has(point)) throw new BadRequestException(`Точка ${point} повторяется в протоколе`);
      seen.add(point);
      points.push({ number: point, value, uncertainty,
        ...(belowLimitMatch ? { belowLimit: true, sourceValue } : {}),
      });
    }
  }
  if (!points.length) throw new BadRequestException('В файле не найдена таблица результатов МАЭД');
  return { protocolNumber, measurementDate, instrumentName, points };
}

export function summarizeMaed(points: MaedPoint[], uncertainty: number | null) {
  if (!points.length) throw new BadRequestException('В протоколе нет измерений');
  const values = points.map((point) => point.value);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    mean, uncertainty,
    meanWithUncertainty: uncertainty === null ? null : mean + uncertainty,
    min: values.reduce((min, value) => Math.min(min, value), Infinity),
    max: values.reduce((max, value) => Math.max(max, value), -Infinity),
  };
}
