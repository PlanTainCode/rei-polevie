import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDesignAssignment } from '../src/modules/technical-tasks/design-assignment-parser';
import { getDocumentAuthors, validateModel } from '../src/modules/technical-tasks/tz-xml';

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
  // Состав заказчиков не подменяет явно заданного автора утверждения.
  expect(technicalCustomerOnly.approver.organization.fullName).toContain('Горсвязьстрой');
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

const sourceAuthor = xml.match(/<Author>[\s\S]*?<\/Author>/)![0];
const withAuthors = (authors: string) => xml.replace(/<Authors>[\s\S]*?<\/Authors>/, `<Authors>${authors}</Authors>`);

test('импортирует несколько организаций с их собственными подписантами, должностями и ролями', () => {
  const agreeing = sourceAuthor.replace('Горсвязьстрой', 'Проектировщик').replace('Утверждено', 'Согласовано')
    .replace('<Surname>Иванов</Surname>', '<Surname>Сидоров</Surname>')
    .replace('</Representatives>', '<Representative FunctionalRole="Согласовано"><Surname>Петров</Surname><Name>Пётр</Name><Patronymic>Петрович</Patronymic><Position>Инженер</Position><Email>p@example.ru</Email></Representative></Representatives>');
  const { model, imported } = parseDesignAssignment(withAuthors(agreeing + sourceAuthor));
  const authors = getDocumentAuthors(model);
  expect(authors).toHaveLength(2);
  if (authors[0].kind !== 'ORGANIZATION' || authors[1].kind !== 'ORGANIZATION') throw new Error('Ожидались организации');
  expect(authors[0].organization.fullName).toContain('Проектировщик');
  expect(authors[0].representatives.map((r) => r.surname)).toEqual(['Сидоров', 'Петров']);
  expect(authors[0].representatives[1]).toMatchObject({ position: 'Инженер', email: 'p@example.ru', patronymic: 'Петрович', functionalRole: 'Согласовано' });
  expect(authors[1].representatives[0].functionalRole).toBe('Утверждено');
  expect(model.approver.organization.fullName).toContain('Горсвязьстрой');
  expect(model.provenance?.['authors[0].organization']).toBe('document');
  expect(imported.some((i) => i.includes('подписанты'))).toBe(true);
});

test('импорт ИП сохраняет почтовый адрес, реквизиты и роль', () => {
  const ip = '<Author><IndividualEntrepreneur FunctionalRole="Согласовано" NOPRIZNumber="Не требуется"><Surname>Петров</Surname><Name>Пётр</Name><OGRNIP>315774600000001</OGRNIP><INN>770123456789</INN><PostAddress><RussianPostAddress><PostIndex>121059</PostIndex><RegionCode>77</RegionCode><OKTMOCode>45318000</OKTMOCode><OKTMOName>Дорогомилово</OKTMOName><City>Москва</City></RussianPostAddress></PostAddress><Email>ip@example.ru</Email></IndividualEntrepreneur></Author>';
  const { model } = parseDesignAssignment(withAuthors(sourceAuthor + ip));
  const author = model.authors![1];
  expect(author.kind).toBe('ENTREPRENEUR');
  if (author.kind !== 'ENTREPRENEUR') throw new Error('Ожидался ИП');
  expect(author.functionalRole).toBe('Согласовано');
  expect(author.entrepreneur).toMatchObject({ surname: 'Петров', ogrnip: '315774600000001', inn: '770123456789', email: 'ip@example.ru', postAddress: { postIndex: '121059', city: 'Москва' } });
});

test('не переопределяет несколько утверждающих и не выдумывает отсутствующую роль', () => {
  const { model, notes } = parseDesignAssignment(withAuthors(sourceAuthor + sourceAuthor));
  expect(model.authors).toHaveLength(2);
  expect(validateModel(model).some((i) => i.path === 'authors')).toBe(true);
  expect(notes.some((n) => n.includes('утверждающих: 2'))).toBe(true);
  const missingRole = parseDesignAssignment(withAuthors(sourceAuthor.replace(' FunctionalRole="Утверждено"', '')));
  expect(validateModel(missingRole.model).some((i) => i.path === 'authors[0].representatives[0].functionalRole')).toBe(true);
  expect(missingRole.notes.some((n) => n.includes('не указана допустимая роль'))).toBe(true);
});

test('физлицо вне организации сопровождается замечанием и не заменяется выдуманным подписантом', () => {
  const { model, notes } = parseDesignAssignment(withAuthors('<Author><Person FunctionalRole="Утверждено"><Surname>Петров</Surname><Name>Пётр</Name></Person></Author>'));
  expect(model.authors).toEqual([]);
  expect(notes.some((n) => n.includes('Петров Пётр') && n.includes('не перенесён'))).toBe(true);
  expect(validateModel(model).some((i) => i.path === 'authors')).toBe(true);
});

test('XML без Authors сохраняет прежнюю подстановку организации заказчика', () => {
  const { model } = parseDesignAssignment(xml.replace(/<Authors>[\s\S]*?<\/Authors>/, '').replace(/<Developers>[\s\S]*?<\/Developers>/, ''));
  expect(model.authors).toBeUndefined();
  expect(model.approver.organization.fullName).toBe(model.technicalCustomer.fullName);
});
