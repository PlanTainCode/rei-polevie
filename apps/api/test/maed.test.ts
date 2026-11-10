import { expect, test } from 'bun:test';
import * as XLSX from 'xlsx';
import { parseMaed, summarizeMaed } from '../src/modules/maed/maed-parser';
import { MaedService } from '../src/modules/maed/maed.service';
import { calculateMaedUncertainty, defaultMaedSettings, type MaedCalculationSettings } from '../src/modules/maed/maed-calculation';

function workbook(rows: unknown[][], extraRows?: unknown[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Страница 1');
  if (extraRows) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(extraRows), 'Страница 2');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const heading = [
  ['Протокол № 452П-26'],
  ['Дата проведения измерений: 17.03.2026.'],
  ['Таблица 1. Результаты измерений мощности амбиентного эквивалента дозы гамма-излучения.'],
  ['№ п/п', '', '№ точки измерения', '', '', 'Мощность амбиентного эквивалента дозы гамма-излучения, мкЗв/ч'],
  ['', '', '', '', '', 'Результат измерения', '', '', '', 'Расширенная неопределенность при k=2'],
  [1, '', 2, '', '', 3, '', '', '', 4],
];
const pointRow = (id: number, value: unknown, uncertainty: unknown = '± 0.05') => [id, '', id, '', '', value, '', '', '', uncertainty];

test('МАЭД: пять точек, метаданные, минимум/максимум и среднее без раннего округления', () => {
  const parsed = parseMaed(workbook([...heading, ...[0.15, 0.13, 0.12, 0.12, 0.14].map((value, index) => pointRow(index + 1, value))]));
  expect(parsed.protocolNumber).toBe('452П-26');
  expect(parsed.measurementDate).toBe('17.03.2026');
  expect(parsed.points).toHaveLength(5);
  const summary = summarizeMaed(parsed.points, 0.014);
  expect(summary.mean).toBeCloseTo(0.132, 10);
  expect(summary.meanWithUncertainty).toBeCloseTo(0.146, 10);
  expect(summary.min).toBe(0.12);
  expect(summary.max).toBe(0.15);
});

test('МАЭД: десятичная запятая, пробелы у ±, нули и пустая неопределённость', () => {
  const parsed = parseMaed(workbook([...heading, pointRow(1, '0,12', '±\u00a00,04'), pointRow(2, 0, 0), pointRow(3, 0.1, '')]));
  expect(parsed.points).toEqual([
    { number: '1', value: 0.12, uncertainty: 0.04 },
    { number: '2', value: 0, uncertainty: 0 },
    { number: '3', value: 0.1, uncertainty: null },
  ]);
  expect(summarizeMaed(parsed.points, null).meanWithUncertainty).toBeNull();
  expect(summarizeMaed(parsed.points, 0).meanWithUncertainty).toBeCloseTo(0.22 / 3);
});

test('МАЭД: сдвиги строк/колонок и повторные заголовки на следующем листе', () => {
  const first = [[], ...heading, pointRow(1, 0.15)].map((row) => ['', ...row]);
  const next = [...heading.slice(2), pointRow(2, 0.12)].map((row) => ['', ...row]);
  expect(parseMaed(workbook(first, next)).points).toHaveLength(2);
});

test('МАЭД: не включает поисковую гамма-съёмку, метеоданные и строки после конца протокола', () => {
  const parsed = parseMaed(workbook([
    ['Температура воздуха', 20], ['Диапазон показаний поисковой гамма-съемки составляет 0.10-0.30 мкЗв/ч.'],
    ...heading, pointRow(1, 0.12), ['Конец протокола'], pointRow(2, 99),
  ]));
  expect(parsed.points).toHaveLength(1);
  expect(summarizeMaed(parsed.points, null).max).toBe(0.12);
});

test('МАЭД: некорректные результаты не пропускаются и не превращаются в нули', () => {
  for (const value of ['', 'менее 0.1', '0.12 ошибка', -0.1]) {
    expect(() => parseMaed(workbook([...heading, pointRow(1, value)]))).toThrow('Некорректное измерение');
  }
  expect(() => parseMaed(workbook([...heading, pointRow(1, 0.1, '± ошибка')]))).toThrow();
  expect(() => parseMaed(workbook([...heading, pointRow(1, 0.1), pointRow(1, 0.2)]))).toThrow('повторяется');
  expect(() => parseMaed(workbook([['Химические исследования'], ['pH', 7]]))).toThrow('не найдена');
  expect(() => parseMaed(workbook([...heading, pointRow(1, 0.1)].map((row) => row.map((cell) => typeof cell === 'string' ? cell.replace('мкЗв/ч', 'мЗв/ч') : cell))))).toThrow('мкЗв/ч');
  expect(() => parseMaed(workbook([...heading, pointRow(1, 0.1)].map((row) => row.map((cell) => typeof cell === 'string' ? cell.replace('k=2', 'k=3') : cell))))).toThrow('k=2');
});

function serviceFixture({ access = true, role = 'OWNER', createdById = 'someone' } = {}) {
  let writes = 0;
  let record = { id: 'protocol', projectId: 'project', fileName: 'test.xlsx', storedFileName: 'internal.xlsx', points: [{ number: '1', value: 0.12, uncertainty: 0.04 }, { number: '2', value: 0.12, uncertainty: 0.04 }], uncertainty: null as number | null, calculationSettings: null as MaedCalculationSettings | null, instrumentName: null as string | null };
  const service = Object.assign(Object.create(MaedService.prototype), {
    prisma: {
      project: { findFirst: async ({ where }: { where: { company: { members: { some: { userId: string } } } } }) => access && where.company.members.some.userId === 'user' ? { companyId: 'company', createdById } : null },
      companyMember: { findFirst: async () => ({ role }) },
      maedProtocol: {
        findMany: async () => [record],
        findFirst: async ({ where }: { where: { id: string; projectId: string } }) => where.id === record.id && where.projectId === record.projectId ? record : null,
        update: async ({ data }: { data: Partial<typeof record> }) => { writes++; record = { ...record, ...data }; return record; },
      },
    },
  }) as MaedService;
  return { service, writes: () => writes };
}

test('МАЭД: чужой объект недоступен, участник без права редактирования не изменяет δ', async () => {
  const denied = serviceFixture({ access: false });
  await expect(denied.service.list('project', 'user')).rejects.toThrow('Объект не найден');
  const reader = serviceFixture({ role: 'WORKER' });
  expect(await reader.service.list('project', 'user')).toHaveLength(1);
  await expect(reader.service.updateUncertainty('project', 'protocol', 'user', 0.01)).rejects.toThrow('Нет прав');
  expect(reader.writes()).toBe(0);
});

test('МАЭД: сохранённая δ участвует в расчёте, чужой протокол не изменяется', async () => {
  const { service, writes } = serviceFixture();
  const saved = await service.updateUncertainty('project', 'protocol', 'user', 0.02);
  expect(saved.summary.meanWithUncertainty).toBeCloseTo(0.14);
  expect(saved).not.toHaveProperty('storedFileName');
  await expect(service.updateUncertainty('other-project', 'protocol', 'user', 0.01)).rejects.toThrow('Протокол не найден');
  for (const value of [-1, NaN, Infinity, undefined]) {
    await expect(service.updateUncertainty('project', 'protocol', 'user', value as number)).rejects.toThrow();
  }
  expect(writes()).toBe(1);
});

const examplePoints = [0.15, 0.13, 0.12, 0.12, 0.14].map((value, index) => ({ number: String(index + 1), value, uncertainty: 0.05 }));
const defaultSettings = { mainErrorPercent: 13, additionalErrorsPercent: [] };

test('МАЭД: формулы (8)–(14) включают тип A, тип B и k=2', () => {
  const result = calculateMaedUncertainty(examplePoints, defaultSettings);
  expect(result.typeA).toBeCloseTo(0.0058309518948453, 12);
  expect(result.typeBPercent).toBeCloseTo(7.505553499465, 10);
  expect(result.uncertainty).toBeCloseTo(0.022991755043928, 12);
  expect(result.uncertainty).toBeGreaterThan(2 * result.typeA!);
  // U_i уже рассчитаны лабораторией и не должны повторно входить в бюджет.
  expect(calculateMaedUncertainty(examplePoints.map((point) => ({ ...point, uncertainty: 999 })), defaultSettings)).toEqual(result);
});

test('МАЭД: дополнительные погрешности учитываются квадратично, систематическая часть не делится на √n', () => {
  const points = [0.1, 0.1, 0.1].map((value, index) => ({ number: String(index), value, uncertainty: null }));
  const settings = { mainErrorPercent: 12, additionalErrorsPercent: [3, 4] };
  const result = calculateMaedUncertainty(points, settings);
  expect(result.typeBPercent).toBeCloseTo(13 / Math.sqrt(3), 10);
  expect(result.uncertainty).toBeCloseTo(2 * 0.1 * 13 / 100 / Math.sqrt(3), 10);
  expect(calculateMaedUncertainty([...points, ...points], settings).uncertainty).toBeCloseTo(result.uncertainty!, 10);
});

test('МАЭД: одна точка, нулевое среднее и неизвестный прибор не дают ложную δ', () => {
  expect(calculateMaedUncertainty(examplePoints.slice(0, 1), defaultSettings).uncertainty).toBeNull();
  expect(calculateMaedUncertainty(examplePoints.map((point) => ({ ...point, value: 0 })), defaultSettings).uncertainty).toBeNull();
  expect(calculateMaedUncertainty(examplePoints, null).uncertainty).toBeNull();
  expect(defaultMaedSettings('Дозиметр другого типа')).toBeNull();
  expect(defaultMaedSettings('Зяблик, блок БДЗБ-Р5Д')).toBeNull();
  const parsed = parseMaed(workbook([['Дозиметр-радиометр МКС "Зяблик" с блоком БДКГ-Р20Д № 261'], ...heading, pointRow(1, .12)]));
  expect(defaultMaedSettings(parsed.instrumentName)).toEqual(defaultSettings);
});

test('МАЭД: неверные параметры не сохраняются, ручное значение и автоматический расчёт переключаются', async () => {
  const { service, writes } = serviceFixture();
  for (const main of [-1, NaN, Infinity, 1001]) {
    await expect(service.updateCalculation('project', 'protocol', 'user', { mainErrorPercent: main, additionalErrorsPercent: [] })).rejects.toThrow();
  }
  await expect(service.updateCalculation('project', 'protocol', 'user', { mainErrorPercent: 13, additionalErrorsPercent: [-2] })).rejects.toThrow();
  expect(writes()).toBe(0);
  await service.updateUncertainty('project', 'protocol', 'user', 0);
  expect((await service.list('project', 'user'))[0].calculation.method).toBe('manual');
  const calculated = await service.updateCalculation('project', 'protocol', 'user', defaultSettings);
  expect(calculated.uncertainty).toBeNull();
  expect(calculated.calculation.method).toBe('mr');
  expect(calculated.summary.uncertainty).toBeCloseTo(2 * .12 * .13 / Math.sqrt(3));
  const reloaded = (await service.list('project', 'user'))[0];
  expect(reloaded.summary).toEqual(calculated.summary);
  expect(reloaded.calculation.settings).toEqual(defaultSettings);
  await expect(service.updateCalculation('other-project', 'protocol', 'user', defaultSettings)).rejects.toThrow('Протокол не найден');
  const reader = serviceFixture({ role: 'WORKER' });
  await expect(reader.service.updateCalculation('project', 'protocol', 'user', defaultSettings)).rejects.toThrow('Нет прав');
});
