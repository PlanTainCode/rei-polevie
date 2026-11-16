import { emptyEntrepreneur, emptyOrganization, emptyRepresentative } from './defaults';
import type { DocumentAuthor, Representative, TzXmlModel } from './model';

/** Старые сохранённые ТЗ читаем без миграции и без изменения исходной модели. */
export function getDocumentAuthors(model: TzXmlModel): DocumentAuthor[] {
  return model.authors ?? [{ kind: 'ORGANIZATION', ...model.approver }];
}

export function documentAuthorPath(model: TzXmlModel, index: number): string {
  return model.authors == null ? 'approver' : `authors[${index}]`;
}

/** Новый список становится основным только при явном редактировании/импорте. */
export function withDocumentAuthors(model: TzXmlModel, authors: DocumentAuthor[]): TzXmlModel {
  const organizations = authors.filter((a) => a.kind === 'ORGANIZATION');
  const primary = organizations.find((a) => a.representatives.some((r) => r.functionalRole === 'Утверждено')) ?? organizations[0];
  return {
    ...model,
    authors,
    // Сохраняем совместимое представление для старых потребителей модели.
    approver: primary ? { organization: primary.organization, representatives: primary.representatives } : model.approver,
  };
}

export function emptyDocumentAuthor(kind: DocumentAuthor['kind'], role: Representative['functionalRole'] = 'Согласовано'): DocumentAuthor {
  return kind === 'ORGANIZATION'
    ? { kind, organization: emptyOrganization(), representatives: [emptyRepresentative(role)] }
    : { kind, entrepreneur: emptyEntrepreneur(), functionalRole: role };
}
