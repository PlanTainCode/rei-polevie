/** Состав исполнителей из шаблона отчёта — не выдумываем ФИО. */
export const REPORT_IEI_STAFF = [
  { name: 'Матвеева Т.С.', nameId: '07446319' },
  { name: 'Штефанова У.Н.', nameId: '6EA215B3' },
  { name: 'Бурнацкая И.М.', nameId: 'DFEB0EDF' },
  { name: 'Ермолов Т.А.', nameId: 'BDB2AFDC' },
  { name: 'Шкода Д.Д.', nameId: '4FEBAEDE' },
  { name: 'Френкель А.В.', nameId: '56C89771' },
  { name: 'Корякова И.В.', nameId: 'FE05A004' },
  { name: 'Маякова Т.А.', nameId: 'CE3E41A2' },
  { name: 'Гасилин П.В.', nameId: '16ECCF38' },
] as const;

export const REPORT_IEI_STAFF_NAMES = REPORT_IEI_STAFF.map((p) => p.name);

export function normalizeExecutorNames(raw: unknown): string[] {
  const allowed = new Set<string>(REPORT_IEI_STAFF_NAMES);
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const item of list) {
    const name = String(item || '').trim();
    if (!allowed.has(name) || out.includes(name)) continue;
    out.push(name);
  }
  return out;
}
