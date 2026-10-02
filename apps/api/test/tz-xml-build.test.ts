import { expect, test } from 'bun:test';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { buildTzXml, createEmptyModel, validateModel, crc32Hex } from '../src/modules/technical-tasks/tz-xml';
import { buildSampleModel, SAMPLE_IMAGE_BASE64, SAMPLE_IMAGE_URL } from './fixtures/tz-xml-sample-model';

test('пустая модель не проходит проверку и называет обязательные блоки', () => {
  const issues = validateModel(createEmptyModel());
  const blocks = new Set(issues.map((i) => i.blockId));
  expect(blocks.has('requisites')).toBe(true);
  expect(blocks.has('object')).toBe(true);
  expect(blocks.has('boundaries')).toBe(true);
  expect(blocks.has('dangerous')).toBe(true);
  expect(blocks.has('initiationDocuments')).toBe(true);
  expect(blocks.has('availableDocuments')).toBe(true);
});

test('заполненная модель проходит проверку', () => {
  const issues = validateModel(buildSampleModel());
  expect(issues).toEqual([]);
});

test('XML собирается, корректен и содержит ключевые разделы в порядке схемы', () => {
  const xml = buildTzXml(buildSampleModel(), { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } });
  expect(XMLValidator.validate(xml)).toBe(true);

  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' }).parse(xml);
  expect(doc.Document['@TypeCode']).toBe('05.01');
  expect(doc.Document['@VersionNumber']).toBe('1');
  expect(doc.Document.Content['@SchemaVersion']).toBe('01.00');
  expect(doc.Document.Requisites.Number).toBe('801-69-26-ЗИИ-1');
  expect(doc.Document.Requisites.Authors.Author.Representatives.Representative['@FunctionalRole']).toBe('Утверждено');
  expect(doc.Document.Content.ObjectInfo.OKS['@ObjectStatus']).toBe('Проектируемый');
  expect(doc.Document.Content.ObjectInfo.OKS.ArealOKS.Foundation.SingleMaterial).toBe('Железобетон');
  expect(doc.Document.Content.ObjectInfo.ArealObject.ShootingScale).toBe('1:500');
  expect(doc.Document.Content.BoundariesArealLinear.AreasImages.Image.ImageData).toBe(SAMPLE_IMAGE_BASE64);
  expect(doc.Document.Content.DangerousNaturalProcesses.PermafrostSoils).toBe('нет');

  // порядок разделов Content
  const order = Object.keys(doc.Document.Content).filter((k) => !k.startsWith('@'));
  expect(order).toEqual([
    'ObjectInfo',
    'SurveysInitiationDocuments',
    'ConstructionType',
    'Developer',
    'Researchers',
    'Purposes',
    'Tasks',
    'EngineeringSurveyStage',
    'EngineeringSurveyTypes',
    'BoundariesArealLinear',
    'DangerousNaturalProcesses',
    'Requirements',
    'AvailableDocuments',
  ]);
});

test('пустые значения не попадают в XML, числа с запятой нормализуются', () => {
  const m = buildSampleModel();
  m.object.areal.energyEfficiency = '';
  m.object.areal.foundation.load.soilLoad = '350,5';
  const xml = buildTzXml(m, { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } });
  expect(xml).not.toContain('<EnergyEfficiency');
  expect(xml).toContain('<SoilLoad>350.5</SoilLoad>');
});

test('застройщик и технический заказчик одновременно попадают в XML перед исполнителями', () => {
  const m = buildSampleModel();
  m.customerKind = 'BOTH';
  m.technicalCustomer = { ...m.researchers[0].organization, fullName: 'ООО «Технический заказчик»' };
  expect(validateModel(m)).toEqual([]);
  const xml = buildTzXml(m, { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } });
  expect(XMLValidator.validate(xml)).toBe(true);
  const content = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' }).parse(xml).Document.Content;
  expect(content.Developer.Organization.FullName).toBe(m.developer.organization.fullName);
  expect(content.TechnicalCustomer.Organization.FullName).toBe(m.technicalCustomer.fullName);
  expect(content.TechnicalCustomer.Organization['@NOPRIZNumber']).toBe(m.technicalCustomer.noprizNumber);
  const keys = Object.keys(content);
  expect(keys.indexOf('TechnicalCustomer')).toBe(keys.indexOf('Developer') + 1);
  expect(keys.indexOf('Researchers')).toBe(keys.indexOf('TechnicalCustomer') + 1);
});

test('при выборе обеих сторон проверяются обе карточки, при выборе одной — только выбранная', () => {
  const m = buildSampleModel();
  m.customerKind = 'BOTH';
  m.developer.organization.inn = 'ошибка';
  m.technicalCustomer = { ...m.researchers[0].organization, noprizNumber: '' };
  const customerPaths = () => validateModel(m).filter(i => i.blockId === 'customer').map(i => i.path);
  expect(customerPaths()).toEqual(['developer.organization.inn', 'technicalCustomer.noprizNumber']);
  m.customerKind = 'DEVELOPER';
  expect(customerPaths()).toEqual(['developer.organization.inn']);
  let content = new XMLParser().parse(buildTzXml(m, { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } })).Document.Content;
  expect(content.Developer).toBeDefined();
  expect(content.TechnicalCustomer).toBeUndefined();
  m.customerKind = 'TECHNICAL_CUSTOMER';
  expect(customerPaths()).toEqual(['technicalCustomer.noprizNumber']);
  content = new XMLParser().parse(buildTzXml(m, { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } })).Document.Content;
  expect(content.Developer).toBeUndefined();
  expect(content.TechnicalCustomer).toBeDefined();
});

test('застройщик-физлицо может быть указан вместе с техническим заказчиком', () => {
  const m = buildSampleModel();
  m.customerKind = 'BOTH';
  m.developer.kind = 'PERSON';
  m.developer.person = { surname: 'Заказчиков', name: 'Алексей', postAddress: { ...m.developer.organization.address } };
  m.technicalCustomer = { ...m.researchers[0].organization };
  expect(validateModel(m)).toEqual([]);
  const content = new XMLParser().parse(buildTzXml(m, { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } })).Document.Content;
  expect(content.Developer.Person.Surname).toBe('Заказчиков');
  expect(content.Developer.Organization).toBeUndefined();
  expect(content.TechnicalCustomer.Organization.FullName).toBe(m.technicalCustomer.fullName);
});

test('crc32 совпадает с эталоном', () => {
  expect(crc32Hex(new TextEncoder().encode('123456789'))).toBe('CBF43926');
});
