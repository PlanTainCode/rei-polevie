import { expect, test } from 'bun:test';
import { XMLParser } from 'fast-xml-parser';
import {
  buildTzXml, collectCounterparties, documentAuthorPath, emptyEntrepreneur,
  getDocumentAuthors, validateModel, withDocumentAuthors, type DocumentAuthor,
} from '../src/modules/technical-tasks/tz-xml';
import { buildSampleModel, SAMPLE_IMAGE_BASE64, SAMPLE_IMAGE_URL } from './fixtures/tz-xml-sample-model';

const options = { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } };
const parse = (xml: string) => new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false }).parse(xml);

function agreement(): DocumentAuthor & { kind: 'ORGANIZATION' } {
  const m = buildSampleModel();
  return {
    kind: 'ORGANIZATION',
    organization: { ...m.approver.organization, fullName: 'ООО «Согласующая организация»', inn: '7701234567', kpp: '770101001' },
    representatives: [{ surname: 'Сидоров', name: 'Сидор', position: 'Главный инженер', functionalRole: 'Согласовано' }],
  };
}

function entrepreneur(role: 'Утверждено' | 'Согласовано'): DocumentAuthor & { kind: 'ENTREPRENEUR' } {
  return {
    kind: 'ENTREPRENEUR', functionalRole: role,
    entrepreneur: {
      ...emptyEntrepreneur(), surname: 'Петров', name: 'Пётр', ogrnip: '315774600000001',
      inn: '770123456789', noprizNumber: 'Не требуется',
      postAddress: { ...buildSampleModel().approver.organization.address },
    },
  };
}

test('старое ТЗ читается без миграции; открытие, проверка, сборка и реестр не меняют его данные', () => {
  const legacy = JSON.parse(JSON.stringify(buildSampleModel()));
  const before = JSON.stringify(legacy);
  const xml = buildTzXml(legacy, options);
  expect(getDocumentAuthors(legacy)).toEqual([{ kind: 'ORGANIZATION', ...legacy.approver }]);
  expect(documentAuthorPath(legacy, 0)).toBe('approver');
  expect(validateModel(legacy)).toEqual([]);
  collectCounterparties(legacy);
  expect(JSON.stringify(legacy)).toBe(before);
  expect(legacy.authors).toBeUndefined();
  const normalized = withDocumentAuthors(legacy, getDocumentAuthors(legacy));
  expect(buildTzXml(normalized, options)).toBe(xml);
  expect(validateModel(normalized)).toEqual([]);
});

test('несколько организаций сохраняют собственных подписантов и переживают сохранение JSON', () => {
  const legacy = buildSampleModel();
  const before = JSON.stringify(legacy);
  const model = withDocumentAuthors(legacy, [agreement(), ...getDocumentAuthors(legacy)]);
  const restored = JSON.parse(JSON.stringify(model));
  expect(validateModel(restored)).toEqual([]);
  const authors = parse(buildTzXml(restored, options)).Document.Requisites.Authors.Author;
  expect(authors).toHaveLength(2);
  expect(authors[0].Organization.FullName).toBe(agreement().organization.fullName);
  expect(authors[0].Representatives.Representative.Surname).toBe('Сидоров');
  expect(authors[1].Representatives.Representative.Surname).toBe('Иванов');
  expect(restored.approver.organization).toEqual(legacy.approver.organization);
  expect(JSON.stringify(legacy)).toBe(before);
  expect(collectCounterparties(restored).some((c) => c.kind === 'ORGANIZATION' && c.details.inn === '7701234567')).toBe(true);
});

test('явный список участников имеет приоритет над старым approver, включая пустой список', () => {
  const model = buildSampleModel();
  model.authors = [entrepreneur('Утверждено')];
  expect(validateModel(model)).toEqual([]);
  const authors = parse(buildTzXml(model, options)).Document.Requisites.Authors.Author;
  expect(authors.Organization).toBeUndefined();
  expect(authors.IndividualEntrepreneur['@FunctionalRole']).toBe('Утверждено');
  expect(authors.IndividualEntrepreneur['@NOPRIZNumber']).toBe('Не требуется');
  expect(authors.IndividualEntrepreneur.OGRNIP).toBe('315774600000001');
  expect(authors.IndividualEntrepreneur.PostAddress.RussianPostAddress.PostIndex).toBe('121059');
  expect(collectCounterparties(model).some((c) => c.kind === 'ENTREPRENEUR' && c.details.ogrnip === '315774600000001')).toBe(true);
  model.authors = [];
  expect(validateModel(model).some((i) => i.path === 'authors')).toBe(true);
  expect(parse(buildTzXml(model, options)).Document.Requisites.Authors.Author).toBeUndefined();
});

test('ровно один утверждающий проверяется во всём задании, включая ИП', () => {
  const m = buildSampleModel();
  m.authors = [...getDocumentAuthors(m), agreement(), entrepreneur('Согласовано')];
  expect(validateModel(m)).toEqual([]);
  m.authors.push(entrepreneur('Утверждено'));
  expect(validateModel(m).filter((i) => i.blockId === 'requisites').map((i) => i.path)).toEqual(['authors']);
  m.authors = [agreement(), entrepreneur('Согласовано')];
  expect(validateModel(m).some((i) => i.path === 'authors' && i.message.includes('ровно один'))).toBe(true);
});

test('ошибки привязаны к конкретной организации и подписанту; старые пути сохраняются', () => {
  const m = buildSampleModel();
  m.approver.representatives[0].position = '';
  expect(validateModel(m).map((i) => i.path)).toEqual(['approver.representatives[0].position']);
  const other = agreement();
  other.organization.inn = '';
  other.representatives[0].functionalRole = '';
  m.authors = [...getDocumentAuthors(m), other];
  const paths = validateModel(m).map((i) => i.path);
  expect(paths).toContain('authors[0].representatives[0].position');
  expect(paths).toContain('authors[1].organization.inn');
  expect(paths).toContain('authors[1].representatives[0].functionalRole');
  other.representatives = [];
  expect(validateModel(m).some((i) => i.path === 'authors[1].representatives')).toBe(true);
});
