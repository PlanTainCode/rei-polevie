/**
 * Подстановка реквизитов компании-исполнителя в модель задания.
 * Компания (РЭИ) в задании — исполнитель (Researchers) и автор отчётной
 * документации по каждому виду изысканий, а не утверждающая сторона.
 */

import { emptyResearcher } from './defaults';
import type { CompanyRequisites, TzXmlModel } from './model';

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
