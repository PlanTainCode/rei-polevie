import { expect, test } from 'bun:test';
import { buildTzXml, emptyOrganization, fillEmptyOrganizationFields, organizationIdentifiersConflict } from '../src/modules/technical-tasks/tz-xml';
import { buildSampleModel, SAMPLE_IMAGE_BASE64, SAMPLE_IMAGE_URL } from './fixtures/tz-xml-sample-model';

const companyOrganization = () => buildSampleModel().researchers[0].organization;

test('подстановка дополняет пустую карточку и не связывает адрес с исходными реквизитами', () => {
  const source = companyOrganization();
  const current = emptyOrganization();
  const filled = fillEmptyOrganizationFields(current, source);
  expect(filled).toEqual(source);
  expect(current).toEqual(emptyOrganization());
  filled.address.oktmoName = 'Изменено только в ТЗ';
  expect(source.address.oktmoName).not.toBe(filled.address.oktmoName);
});

test('ручные значения сохраняются, даже если уже заполнено название организации', () => {
  const current = { ...emptyOrganization(), fullName: 'Название, введённое вручную', email: 'manual@example.ru' };
  current.address.city = 'Город, введённый вручную';
  const source = companyOrganization();
  const filled = fillEmptyOrganizationFields(current, source);
  expect(filled.fullName).toBe(current.fullName);
  expect(filled.email).toBe(current.email);
  expect(filled.address.city).toBe(current.address.city);
  expect(filled.inn).toBe(source.inn);
  expect(filled.address.regionCode).toBe(source.address.regionCode);
});

test('ручной неформализованный адрес и РАФП сохраняют выбранную ветвь XML', () => {
  const current = emptyOrganization();
  current.rafp = '12345678901';
  current.address.note = 'Адрес, введённый вручную';
  const source = companyOrganization();
  source.address.street = 'Улица из компании';
  const filled = fillEmptyOrganizationFields(current, source);
  expect(filled.rafp).toBe(current.rafp);
  expect(filled.ogrn).toBeUndefined();
  expect(filled.address.note).toBe(current.address.note);
  expect(filled.address.street).toBeUndefined();
  expect(filled.address.regionCode).toBe(source.address.regionCode);
});

test('различающиеся ИНН и КПП распознаются как конфликт, пустые идентификаторы допустимы', () => {
  const source = companyOrganization();
  expect(organizationIdentifiersConflict(emptyOrganization(), source)).toBe(false);
  expect(organizationIdentifiersConflict({ ...source }, source)).toBe(false);
  expect(organizationIdentifiersConflict({ ...source, inn: '0000000000' }, source)).toBe(true);
  expect(organizationIdentifiersConflict({ ...source, kpp: '000000000' }, source)).toBe(true);
});

test('заполненное ТЗ и его XML не меняются после дополнения реквизитов компании', () => {
  const model = buildSampleModel();
  const snapshot = structuredClone(model);
  const options = { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } };
  const before = buildTzXml(model, options);
  const otherSource = companyOrganization();
  otherSource.fullName = 'Новое название в карточке компании';
  otherSource.address.oktmoName = 'Новое муниципальное образование';
  model.researchers[0].organization = fillEmptyOrganizationFields(model.researchers[0].organization, otherSource);
  expect(model).toEqual(snapshot);
  expect(buildTzXml(model, options)).toBe(before);
});
