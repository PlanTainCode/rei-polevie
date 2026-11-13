import { emptyAddress, emptyEntrepreneur, emptyOrganization, emptyPerson } from './defaults';
import { fillEmptyAddressFields, fillEmptyOrganizationFields, organizationIdentifiersConflict } from './company';
import type { Entrepreneur, Organization, Person, TzXmlModel } from './model';
import type { ValidationIssue } from './validate';

export const COUNTERPARTY_KINDS = ['ORGANIZATION', 'ENTREPRENEUR', 'PERSON'] as const;
export type CounterpartyKind = typeof COUNTERPARTY_KINDS[number];
export type CounterpartyDetails = { ORGANIZATION: Organization; ENTREPRENEUR: Entrepreneur; PERSON: Person };
export type CounterpartyDraft = { [K in CounterpartyKind]: { kind: K; details: CounterpartyDetails[K] } }[CounterpartyKind];
export type CounterpartyRecord = CounterpartyDraft & { id: string; name: string; createdAt: string; updatedAt: string };

export const COUNTERPARTY_LABELS: Record<CounterpartyKind, string> = {
  ORGANIZATION: 'Юридическое лицо', ENTREPRENEUR: 'Индивидуальный предприниматель', PERSON: 'Физическое лицо',
};

export function emptyCounterparty(kind: CounterpartyKind): CounterpartyDraft {
  if (kind === 'ORGANIZATION') return { kind, details: emptyOrganization() };
  if (kind === 'ENTREPRENEUR') return { kind, details: emptyEntrepreneur() };
  return { kind, details: emptyPerson() };
}

const addressKeys = ['regionCode', 'postIndex', 'oktmoCode', 'oktmoName', 'district', 'city', 'settlement', 'street', 'building', 'room', 'note'] as const;
const organizationKeys = ['fullName', 'abbreviatedName', 'ogrn', 'rafp', 'inn', 'kpp', 'email', 'noprizNumber'] as const;
const personKeys = ['surname', 'name', 'patronymic', 'email'] as const;
const normalize = (v: string | undefined) => (v ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Реквизиты должны быть объектом');
  return value as Record<string, unknown>;
}

/** Из JSON берём только поля карточки. Служебные поля ТЗ в реестр не переносятся. */
function strings(value: unknown, keys: readonly string[]): Record<string, string> {
  const input = object(value);
  const result: Record<string, string> = {};
  for (const key of keys) {
    const v = input[key];
    if (v === null || v === undefined) continue;
    if (typeof v !== 'string' || v.length > 4000) throw new Error(`Некорректное поле «${key}»`);
    result[key] = v.trim();
  }
  return result;
}

export function parseCounterparty(kind: string, value: unknown): CounterpartyDraft {
  const input = object(value);
  if (kind === 'ORGANIZATION') {
    return { kind, details: { ...emptyOrganization(), ...strings(input, organizationKeys), address: { ...emptyAddress(), ...strings(input.address ?? {}, addressKeys) } } };
  }
  const postAddress = { ...emptyAddress(), ...strings(input.postAddress ?? {}, addressKeys) };
  if (kind === 'ENTREPRENEUR') {
    return { kind, details: { ...emptyEntrepreneur(), ...strings(input, [...personKeys, 'ogrnip', 'inn', 'noprizNumber']), postAddress } };
  }
  if (kind === 'PERSON') return { kind, details: { ...emptyPerson(), ...strings(input, personKeys), postAddress } };
  throw new Error('Неизвестная форма контрагента');
}

/** Минимум для сохранения в реестре. Полная проверка по требованиям XML остаётся в ТЗ. */
export function counterpartyIssues(draft: CounterpartyDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, message: string) => issues.push({ blockId: 'counterparty', path: `details.${path}`, message });
  if (draft.kind === 'ORGANIZATION') {
    if (!normalize(draft.details.fullName)) add('fullName', 'Укажите полное наименование');
    if (!/^\d{10}$/.test(draft.details.inn)) add('inn', 'ИНН юрлица: 10 цифр');
    if (!/^\d{9}$/.test(draft.details.kpp)) add('kpp', 'КПП: 9 цифр (нужен для различения филиалов)');
  } else {
    if (!normalize(draft.details.surname)) add('surname', 'Укажите фамилию');
    if (!normalize(draft.details.name)) add('name', 'Укажите имя');
    if (draft.kind === 'ENTREPRENEUR') {
      if (!/^\d{15}$/.test(draft.details.ogrnip)) add('ogrnip', 'ОГРНИП: 15 цифр');
    } else {
      const a = draft.details.postAddress;
      if (!normalize(a.regionCode)) add('postAddress.regionCode', 'Укажите субъект РФ');
      const structured = [a.district, a.city, a.settlement, a.street, a.building, a.room].some((v) => normalize(v));
      if (structured ? !(normalize(a.city || a.settlement) && normalize(a.building)) : !normalize(a.note)) {
        add('postAddress.note', 'Для различения однофамильцев укажите почтовый адрес: населённый пункт и дом либо неформализованное описание');
      }
    }
  }
  return issues;
}

export function counterpartyName(draft: CounterpartyDraft): string {
  return draft.kind === 'ORGANIZATION' ? draft.details.fullName : [draft.details.surname, draft.details.name, draft.details.patronymic].filter(Boolean).join(' ');
}

export function counterpartyIdentity(draft: CounterpartyDraft): string | null {
  if (counterpartyIssues(draft).length) return null;
  if (draft.kind === 'ORGANIZATION') return `org:${draft.details.inn}:${draft.details.kpp}`;
  if (draft.kind === 'ENTREPRENEUR') return `ip:${draft.details.ogrnip}`;
  const d = draft.details;
  const a = d.postAddress;
  const structured = ['district', 'city', 'settlement', 'street', 'building', 'room'] as const;
  const location = structured.some((key) => normalize(a[key])) ? structured.map((key) => normalize(a[key])) : [normalize(a.note)];
  // Не включаем e-mail и индекс: их уточнение не создаёт нового человека.
  return JSON.stringify(['person', normalize(d.surname), normalize(d.name), normalize(d.patronymic), normalize(a.regionCode), ...location]);
}

export function fillEmptyCounterpartyFields<K extends CounterpartyKind>(kind: K, current: CounterpartyDetails[K], source: CounterpartyDetails[K]): CounterpartyDetails[K] {
  if (kind === 'ORGANIZATION') {
    return fillEmptyOrganizationFields(current as Organization, source as Organization) as CounterpartyDetails[K];
  }
  const result = { ...current } as Person & Partial<Entrepreneur>;
  const from = source as Person & Partial<Entrepreneur>;
  for (const key of [...personKeys, 'ogrnip', 'inn', 'noprizNumber'] as const) {
    if (!normalize(result[key]) && normalize(from[key])) result[key] = from[key]!;
  }
  result.postAddress = fillEmptyAddressFields(result.postAddress, from.postAddress);
  return result as CounterpartyDetails[K];
}

export function counterpartyConflicts<K extends CounterpartyKind>(kind: K, current: CounterpartyDetails[K], source: CounterpartyDetails[K]): boolean {
  if (kind === 'ORGANIZATION') return organizationIdentifiersConflict(current as Organization, source as Organization);
  const a = current as Person & Partial<Entrepreneur>;
  const b = source as Person & Partial<Entrepreneur>;
  const keys = kind === 'ENTREPRENEUR' ? ['ogrnip', 'inn'] as const : ['surname', 'name', 'patronymic'] as const;
  return keys.some((key) => normalize(a[key]) && normalize(b[key]) && normalize(a[key]) !== normalize(b[key]));
}

/** Только участники включённых разделов. ТЗ не изменяем, старые документы не переписываем. */
export function collectCounterparties(model: TzXmlModel): CounterpartyDraft[] {
  const candidates: CounterpartyDraft[] = [];
  const organization = (details: Organization) => candidates.push({ kind: 'ORGANIZATION', details });
  const contractor = (entry: { kind: 'ORGANIZATION' | 'ENTREPRENEUR'; organization: Organization; entrepreneur: Entrepreneur }) => {
    if (entry.kind === 'ORGANIZATION') organization(entry.organization);
    else candidates.push({ kind: 'ENTREPRENEUR', details: entry.entrepreneur });
  };
  organization(model.approver.organization);
  if (model.customerKind === 'DEVELOPER' || model.customerKind === 'BOTH') {
    if (model.developer.kind === 'ORGANIZATION') organization(model.developer.organization);
    else candidates.push({ kind: 'PERSON', details: model.developer.person });
  }
  if (model.customerKind === 'TECHNICAL_CUSTOMER' || model.customerKind === 'BOTH') organization(model.technicalCustomer);
  if (model.enabled.researchers) model.researchers.forEach(contractor);
  model.surveys.forEach((survey) => survey.authors.slice(0, 1).forEach(contractor));
  const outside = model.requirements.controlQuality.outside;
  if (outside?.by === 'ORGANIZATION') outside.organizations.forEach(contractor);

  const unique = new Map<string, CounterpartyDraft>();
  for (const candidate of candidates) {
    const parsed = parseCounterparty(candidate.kind, candidate.details);
    const identity = counterpartyIdentity(parsed);
    if (identity && !unique.has(identity)) unique.set(identity, parsed);
  }
  return [...unique.values()];
}
