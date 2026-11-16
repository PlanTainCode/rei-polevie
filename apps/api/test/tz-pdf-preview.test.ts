import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { renderTzHtml } from '../src/modules/technical-tasks/pdf-preview';
import { buildTzXml, createEmptyModel, emptyDocument, emptySurvey, getDocumentAuthors, textBlock, type TzXmlModel } from '../src/modules/technical-tasks/tz-xml';
import { buildSampleModel, SAMPLE_IMAGE_BASE64, SAMPLE_IMAGE_URL } from './fixtures/tz-xml-sample-model';

const xslPath = join(import.meta.dir, '../templates/тз/xml/EngineeringSurveysTask-01-00.xsl');
const xsltTest = Bun.which('xsltproc') ? test : test.skip;

async function previewText(model: TzXmlModel) {
  const dir = await mkdtemp(join(tmpdir(), 'tz-xsl-test-'));
  try {
    const xml = buildTzXml(model, { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 }, preview: true });
    const html = await renderTzHtml(xml, xslPath, dir);
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function approvalSheet(text: string): string {
  return text.split('лист согласования задания на проведение изысканий')[1].split('Состав задания на выполнение инженерных изысканий')[0];
}

xsltTest('старое ТЗ: утверждающий остаётся на титуле, пустой лист согласования содержит пояснение', async () => {
  const m = buildSampleModel();
  const before = JSON.stringify(m);
  const text = await previewText(m);
  expect(text.split('лист согласования задания на проведение изысканий')[0]).toContain('Иванов Иван Иванович');
  const sheet = approvalSheet(text);
  expect(sheet).toContain('Согласующие лица отсутствуют');
  expect(sheet).not.toContain('Иванов');
  expect(sheet).not.toContain('Горсвязьстрой');
  expect(JSON.stringify(m)).toBe(before);
});

xsltTest('лист согласования группирует согласующих по организациям и исключает только утверждающего', async () => {
  const m = buildSampleModel();
  m.approver.representatives.push({ surname: 'Сидоров', name: 'Сидор', position: 'Главный инженер', functionalRole: 'Согласовано' });
  m.authors = [...getDocumentAuthors(m), {
    kind: 'ORGANIZATION',
    organization: { ...m.approver.organization, fullName: 'ООО «Проектировщик»' },
    representatives: [{ surname: 'Петров', name: 'Пётр', position: 'Начальник бюро', functionalRole: 'Согласовано' }],
  }];
  const text = await previewText(m);
  const sheet = approvalSheet(text);
  expect(sheet).toContain('Горсвязьстрой');
  expect(sheet).toContain('Сидоров');
  expect(sheet).toContain('Проектировщик');
  expect(sheet).toContain('Петров');
  expect(sheet.indexOf('Горсвязьстрой')).toBeLessThan(sheet.indexOf('Сидоров'));
  expect(sheet.indexOf('Сидоров')).toBeLessThan(sheet.indexOf('Проектировщик'));
  expect(sheet.indexOf('Проектировщик')).toBeLessThan(sheet.indexOf('Петров'));
  expect(sheet).not.toContain('Иванов');
  expect(sheet).not.toContain('УТВЕРЖДЕНО');
  expect(sheet).not.toContain('Согласующие лица отсутствуют');
});

xsltTest('ИП выводится на титуле или в согласовании согласно роли', async () => {
  const m = buildSampleModel();
  const ip = {
    kind: 'ENTREPRENEUR' as const, functionalRole: 'Согласовано' as const,
    entrepreneur: { surname: 'Петров', name: 'Пётр', ogrnip: '315774600000001', noprizNumber: 'Не требуется', postAddress: { ...m.approver.organization.address } },
  };
  m.authors = [...getDocumentAuthors(m), ip];
  const sheet = approvalSheet(await previewText(m));
  expect(sheet).toContain('Петров');
  expect(sheet).not.toContain('Горсвязьстрой');
  expect(sheet).not.toContain('Иванов');
  m.authors = [{ ...ip, functionalRole: 'Утверждено' }];
  const text = await previewText(m);
  expect(text.split('лист согласования задания на проведение изысканий')[0]).toContain('Петров Пётр');
  expect(approvalSheet(text)).not.toContain('Петров');
  expect(approvalSheet(text)).toContain('Согласующие лица отсутствуют');
});

xsltTest('PDF-шаблон сохраняет заказчика, всех подписантов, адрес, цели, задачи и опасные процессы', async () => {
  const m = buildSampleModel();
  m.developer.organization.fullName = 'Заказчик-застройщик для проверки';
  m.approver.representatives.push({ surname: 'Сидоров', name: 'Сидор', patronymic: 'Сидорович', position: 'Главный инженер', functionalRole: 'Согласовано' });
  m.purposes = ['Общая цель тестового задания'];
  m.tasks = ['Общая задача тестового задания'];
  m.surveys[0].purposes = ['Цель отдельного вида изысканий'];
  m.surveys[0].tasks = ['Задача отдельного вида изысканий'];
  const other = emptySurvey('OTHER');
  other.otherNames = ['Первое иное исследование', 'Второе иное исследование'];
  m.surveys.push(other);
  m.boundaries.areaOutWorks = textBlock(['Особые работы за границей землеотвода']);
  m.object.placement.areas = [...m.boundaries.areas];
  m.initiationDocuments.note = 'Примечание к основанию';
  m.availableDocuments.note = 'Примечание к прилагаемым документам';
  m.enabled.archivalMaterials = true;
  m.requirements.archivalMaterials = { documents: [m.availableDocuments.documents[0]], note: 'Примечание к архивным материалам' };
  const text = await previewText(m);
  for (const value of [
    m.requisites.number, m.object.name, 'улица Юных Ленинцев', '77:04:0004008:1234',
    m.developer.organization.fullName, 'Иванов Иван Иванович', 'Сидоров', 'Сидор', 'Главный инженер', 'СОГЛАСОВАНО',
    ...m.purposes, ...m.tasks, ...m.surveys[0].purposes, ...m.surveys[0].tasks,
    ...other.otherNames,
    'Плитный', 'подтопление', 'Особые работы за границей землеотвода', 'МСК-77', 'Балтийская 1977',
    'Примечание к основанию', 'Примечание к прилагаемым документам', 'Примечание к архивным материалам', '01.09.2026',
  ]) expect(text).toContain(value);
  expect(text).not.toContain('.pdf.pdf');
  expect(text).not.toContain('ИвановИван');
});

xsltTest('PDF-шаблон показывает технического заказчика и линейный объект', async () => {
  const m = buildSampleModel();
  m.customerKind = 'TECHNICAL_CUSTOMER';
  m.technicalCustomer = { ...m.approver.organization, fullName: 'Технический заказчик для проверки' };
  m.object.kind = 'LINEAR_OKS';
  m.object.siteKind = 'LINEAR';
  m.object.linear.kind = 'LINE_POWER';
  m.object.linear.foundationMaterials = ['Сталь'];
  const text = await previewText(m);
  expect(text).toContain(m.technicalCustomer.fullName);
  expect(text).toContain(m.object.name);
  expect(text).toContain('улица Юных Ленинцев');
  expect(text).toContain('Материал Фундамента: Сталь');
});

xsltTest('PDF-шаблон сохраняет физлицо-застройщика', async () => {
  const m = buildSampleModel();
  m.developer.kind = 'PERSON';
  Object.assign(m.developer.person, { surname: 'Заказчиков', name: 'Алексей', patronymic: 'Петрович', email: 'customer@example.ru' });
  const text = await previewText(m);
  for (const value of ['Заказчиков', 'Алексей', 'Петрович', 'customer@example.ru']) expect(text).toContain(value);
});

xsltTest('PDF-шаблон показывает застройщика и технического заказчика одновременно', async () => {
  const m = buildSampleModel();
  m.customerKind = 'BOTH';
  m.developer.organization.fullName = 'Застройщик для одновременного просмотра';
  m.technicalCustomer = { ...m.researchers[0].organization, fullName: 'Технический заказчик для одновременного просмотра' };
  const text = await previewText(m);
  expect(text).toContain(m.developer.organization.fullName);
  expect(text).toContain(m.technicalCustomer.fullName);
  expect(text).not.toContain('Сведения о техническом заказчике отсутствуют');
});

xsltTest('неполный черновик можно просмотреть: документы без файлов, отдельные примечания и описание контроля не теряются', async () => {
  const m = createEmptyModel();
  m.object.name = 'Незавершённый объект';
  const doc = emptyDocument();
  doc.name = 'Документ без загруженного файла';
  m.initiationDocuments = { documents: [doc], note: 'Примечание к черновику' };
  m.availableDocuments = { documents: [], note: 'Только примечание к приложениям' };
  m.requirements.controlQuality.outside!.description = textBlock(['Описание ещё не заполненного внешнего контроля']);
  const text = await previewText(m);
  for (const value of [m.object.name, doc.name, m.initiationDocuments.note!, m.availableDocuments.note!, 'Описание ещё не заполненного внешнего контроля']) expect(text).toContain(value);
});
