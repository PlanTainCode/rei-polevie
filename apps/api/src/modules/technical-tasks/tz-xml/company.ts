/**
 * Подстановка реквизитов компании-исполнителя в модель задания.
 * Компания (РЭИ) в задании — исполнитель (Researchers) и автор отчётной
 * документации по каждому виду изысканий, а не утверждающая сторона.
 */

import { emptyResearcher } from './defaults';
import type { CompanyRequisites, Organization, RussianAddress, TzXmlModel } from './model';

const filled = (value: string | undefined): boolean => Boolean(value?.trim());

export function fillEmptyAddressFields(current: RussianAddress, source: RussianAddress): RussianAddress {
  const result = { ...current };
  const addressFields: (keyof RussianAddress)[] = ['regionCode', 'postIndex', 'oktmoCode', 'oktmoName'];
  const structured = ['district', 'city', 'settlement', 'street', 'building', 'room'] as const;
  // Неформализованный и структурный адрес — альтернативы в XSD.
  if (!filled(current.note)) {
    addressFields.push(...structured);
    if (!structured.some((key) => filled(current[key]) || filled(source?.[key]))) addressFields.push('note');
  }
  for (const key of addressFields) {
    if (!filled(current[key]) && filled(source?.[key])) result[key] = source[key]!;
  }
  return result;
}

/** Дополняет только пустые реквизиты. Не изменяет исходные объекты и ветви xs:choice. */
export function fillEmptyOrganizationFields(current: Organization, source: Organization): Organization {
  const result = { ...current, address: fillEmptyAddressFields(current.address, source.address) };
  const fields = ['fullName', 'abbreviatedName', 'inn', 'kpp', 'email', 'noprizNumber'] as const;
  for (const key of fields) {
    if (!filled(current[key]) && filled(source[key])) result[key] = source[key]!;
  }
  if (!filled(current.ogrn) && !filled(current.rafp)) {
    if (filled(source.ogrn)) result.ogrn = source.ogrn;
    else if (filled(source.rafp)) result.rafp = source.rafp;
  }
  return result;
}

/** Не смешиваем реквизиты с различающимися идентификаторами организаций/филиалов. */
export function organizationIdentifiersConflict(current: Organization, source: Organization): boolean {
  return (['inn', 'kpp', 'ogrn', 'rafp'] as const).some(
    (key) => filled(current[key]) && filled(source[key]) && current[key]!.trim() !== source[key]!.trim(),
  );
}

export function applyCompanyRequisites(model: TzXmlModel, requisites: CompanyRequisites | null | undefined): TzXmlModel {
  if (!requisites?.organization?.fullName) return model;
  const org = { ...requisites.organization, address: { ...requisites.organization.address } };
  const prov = model.provenance ?? (model.provenance = {});

  if (model.researchers.length === 0) model.researchers.push(emptyResearcher());
  const first = model.researchers[0];
  if (first.kind === 'ORGANIZATION' && !first.organization.fullName) {
    first.organization = org;
    prov['researchers[0].organization'] = 'company';
  }
  model.enabled.researchers = true;

  model.surveys.forEach((s, i) => {
    if (s.authors.length === 0) {
      s.authors.push({ kind: 'ORGANIZATION', organization: { ...org, address: { ...org.address } }, entrepreneur: emptyResearcher().entrepreneur });
      prov[`surveys[${i}].authors`] = 'company';
    }
  });
  return model;
}
