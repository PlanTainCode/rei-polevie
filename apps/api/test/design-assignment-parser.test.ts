import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDesignAssignment } from '../src/modules/technical-tasks/design-assignment-parser';

const xml = readFileSync(join(import.meta.dir, 'fixtures/design-assignment-sample.xml'), 'utf8');

test('переносит объект, адрес, характеристики и кадастр', () => {
  const { model } = parseDesignAssignment(xml);
  expect(model.object.name).toContain('Жилой дом с подземной автостоянкой');
  expect(model.object.kind).toBe('AREAL_OKS');
  expect(model.object.siteKind).toBe('AREAL');
  expect(model.object.placement.address.street).toBe('улица Юных Ленинцев');
  expect(model.object.placement.address.oktmoCode).toBe('45390000');
  expect(model.object.placement.cadastralSites).toEqual(['77:04:0004008:1234']);
  expect(model.object.areal.functionsClass).toBe('19.7.1.5');
  expect(model.object.areal.responsibilityLevel).toBe('нормальный');
  expect(model.object.areal.peoplePermanentStay).toBe('Предусмотрено');
  expect(model.object.areal.numberFloors).toBe('17');
  expect(model.object.areal.overallHeight).toBe('54.5');
  expect(model.constructionType).toBe('архитектурно-строительное проектирование');
  expect(model.provenance?.['object.name']).toBe('document');
});

test('переносит застройщика, техзаказчика и утверждающую организацию', () => {
  const { model } = parseDesignAssignment(xml);
  expect(model.customerKind).toBe('BOTH');
  expect(model.developer.organization.inn).toBe('7730001111');
  expect(model.developer.organization.address.postIndex).toBe('121059');
  expect(model.technicalCustomer.noprizNumber).toBe('П-001-000000000002-2021');
  expect(model.approver.organization.fullName).toBe(model.developer.organization.fullName);
  expect(model.approver.organization.noprizNumber).toBe('Не требуется');
});

test('импорт задания с одной стороной оставляет выбранной только эту сторону', () => {
  const developerOnly = parseDesignAssignment(xml.replace(/<TechnicalCustomers>[\s\S]*?<\/TechnicalCustomers>/, '')).model;
  expect(developerOnly.customerKind).toBe('DEVELOPER');
  const technicalCustomerOnly = parseDesignAssignment(xml.replace(/<Developers>[\s\S]*?<\/Developers>/, '')).model;
  expect(technicalCustomerOnly.customerKind).toBe('TECHNICAL_CUSTOMER');
  expect(technicalCustomerOnly.approver.organization.fullName).toBe(technicalCustomerOnly.technicalCustomer.fullName);
});

test('переносит документы, изыскания, нормы и материалы прошлых лет', () => {
  const { model, imported, notes } = parseDesignAssignment(xml);
  expect(model.initiationDocuments.documents).toHaveLength(1);
  expect(model.initiationDocuments.documents[0].typeCode).toBe('15.08');
  expect(model.initiationDocuments.documents[0].files[0].checksum).toBe('0A1B2C3D');
  expect(model.availableDocuments.documents.map((d) => d.source)).toEqual(['WEBLINK', 'FILE']);
  expect(model.surveys.map((s) => s.typeCode)).toEqual(['4', '2']);
  expect(model.surveys[0].additionalRequirements?.paragraphs).toEqual(['Границы изысканий: В границах ГПЗУ', 'Оценить радиационную обстановку.']);
  expect(model.surveys[0].purposes.length).toBeGreaterThan(0);
  expect(model.object.arealSite.shootingScale).toBe('1:500');
  expect(model.requirements.usedNorms).toEqual(['СП 47.13330.2016', 'СП 502.1325800.2021']);
  expect(model.enabled.archivalMaterials).toBe(true);
  expect(model.requirements.archivalMaterials?.documents[0].name).toBe('Технический отчёт ИЭИ 2020 г.');
  expect(model.dangerous.processesAdditional?.paragraphs[0]).toContain('подтопление');
  expect(model.enabled.timePeriod).toBe(true);
  expect(model.timePeriod).toContain('Этап 1');
  expect(imported).toContain('наименование объекта');
  expect(notes.some((n) => n.includes('Файлы документов'))).toBe(true);
});

test('отвергает чужой XML', () => {
  expect(() => parseDesignAssignment('<Document TypeCode="05.01"><Content/></Document>')).toThrow(/05.03/);
  expect(() => parseDesignAssignment('<foo/>')).toThrow(/Document/);
  expect(() => parseDesignAssignment('not xml <')).toThrow(/XML/);
});
