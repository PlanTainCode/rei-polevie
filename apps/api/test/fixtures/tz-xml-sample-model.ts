/**
 * Полностью заполненная модель задания для тестов сборки XML.
 * Данные условные, но соответствуют форматам схемы.
 */

import {
  createEmptyModel,
  emptyDocument,
  emptyResearcher,
  emptySurvey,
  regionalCoordinateSystem,
  textBlock,
  type Organization,
  type RussianAddress,
  type TzXmlModel,
} from '../../src/modules/technical-tasks/tz-xml';

export const SAMPLE_IMAGE_URL = 'technical-tasks/attachments/sample-boundary.png';

function moscowAddress(street: string, building: string): RussianAddress {
  return {
    regionCode: '77',
    postIndex: '121059',
    oktmoCode: '45318000',
    oktmoName: 'Муниципальный округ Дорогомилово',
    city: 'Москва',
    street,
    building,
  };
}

function organization(fullName: string, inn: string, kpp: string, ogrn: string, nopriz?: string): Organization {
  return {
    fullName,
    abbreviatedName: fullName.replace('Общество с ограниченной ответственностью', 'ООО'),
    inn,
    kpp,
    ogrn,
    address: moscowAddress('Бережковская набережная', '20'),
    email: 'info@example.ru',
    noprizNumber: nopriz,
  };
}

export function buildSampleModel(): TzXmlModel {
  const m = createEmptyModel();

  m.requisites.number = '801-69-26-ЗИИ-1';
  m.requisites.date = '2026-09-16';

  m.approver.organization = organization('Общество с ограниченной ответственностью «Горсвязьстрой»', '7730001111', '773001001', '1097746501269', 'Не требуется');
  m.approver.representatives = [
    { surname: 'Иванов', name: 'Иван', patronymic: 'Иванович', position: 'Генеральный директор', functionalRole: 'Утверждено', email: 'ivanov@example.ru' },
  ];

  m.object.name = 'Жилой дом с подземной автостоянкой по адресу: г. Москва, ул. Юных Ленинцев, з/у 44/3';
  m.object.status = 'Проектируемый';
  m.object.placement.address = {
    regionCode: '77',
    oktmoCode: '45390000',
    oktmoName: 'Муниципальный округ Кузьминки',
    city: 'Москва',
    street: 'улица Юных Ленинцев',
    building: 'земельный участок 44/3',
  };
  m.object.placement.cadastralSites = ['77:04:0004008:1234'];
  m.object.kind = 'AREAL_OKS';
  Object.assign(m.object.areal, {
    functionsClass: '19.7.1.5',
    peoplePermanentStay: 'Предусмотрено',
    designFeatures: textBlock(['Монолитный железобетонный каркас, 17 этажей, подземная автостоянка.']),
    planSize: { width: '24', length: '60', height: '54' },
    overallHeight: '54.5',
    numberFloors: '17',
    approximateWeight: '42000',
  });
  m.object.areal.foundation = {
    types: ['Плитный'],
    materials: ['Железобетон'],
    size: '1.2',
    depth: '6.5',
    load: { soilLoad: '350' },
  };
  m.object.areal.earthworksDepth = '7';
  m.object.siteKind = 'AREAL';
  m.object.arealSite.planSize = { width: '120', length: '180' };

  const contract = emptyDocument('05.99');
  contract.name = 'Договор на выполнение инженерных изысканий';
  contract.number = '801-69-26';
  contract.date = '2026-09-01';
  contract.authorNote = 'ООО «Горсвязьстрой», АО «РЭИ-ЭКОАУДИТ»';
  contract.source = 'FILE';
  contract.files = [{ fileUrl: 'technical-tasks/attachments/contract.pdf', name: 'Договор 801-69-26.pdf', format: 'pdf', checksum: 'A1B2C3D4' }];
  m.initiationDocuments = { documents: [contract] };

  m.customerKind = 'DEVELOPER';
  m.developer.kind = 'ORGANIZATION';
  m.developer.organization = organization('Общество с ограниченной ответственностью «Горсвязьстрой»', '7730001111', '773001001', '1097746501269');

  const researcher = emptyResearcher();
  researcher.organization = organization('Акционерное общество «РЭИ-ЭКОАУДИТ»', '7730002222', '773001002', '1027700000000', 'И-001-000000000001-2020');
  researcher.contract = { number: '801-69-26', date: '2026-09-01', files: [...contract.files] };
  m.researchers = [researcher];

  m.surveys = [emptySurvey('BASIC', '4'), emptySurvey('BASIC', '2')];

  m.boundaries.images = [{ fileUrl: SAMPLE_IMAGE_URL, name: 'boundary.png', type: 'png', comment: 'Границы участка изысканий' }];
  m.enabled.areas = true;
  m.boundaries.areas = [
    {
      name: 'Участок 1',
      coordinateSystem: regionalCoordinateSystem('МСК-77'),
      points: [
        { x: '10000.12', y: '20000.34' },
        { x: '10100.00', y: '20000.34' },
        { x: '10100.00', y: '20150.00' },
      ],
    },
  ];

  m.dangerous.processes = ['подтопление'];
  m.dangerous.permafrost = 'нет';

  m.requirements.controlQuality.outside!.representatives = [{ surname: 'Петров', name: 'Пётр', patronymic: 'Петрович' }];

  const plan = emptyDocument('99.99');
  plan.name = 'Ситуационный план участка';
  plan.number = 'б/н';
  plan.date = '2026-09-10';
  plan.authorNote = 'ООО «Горсвязьстрой»';
  plan.source = 'WEBLINK';
  plan.webLink = 'https://example.ru/plan.pdf';
  m.availableDocuments = { documents: [plan] };

  return m;
}

/** Однопиксельный PNG в base64 — для изображения границ. */
export const SAMPLE_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
