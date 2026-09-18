/**
 * Разбор XML задания на проектирование (схема Минстроя DesignAssignment-01-01)
 * в модель задания на инженерные изыскания.
 *
 * Берём только то, что однозначно переносится: объект и его адрес, кадастр,
 * характеристики ОКС, застройщика и техзаказчика, документы-основания и
 * приложения, требования к изысканиям. Всё остальное пользователь дополняет
 * в форме. Разбор детерминированный, без ИИ.
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  BASIC_SURVEY_TYPES,
  SCALES,
  SPECIAL_SURVEY_TYPES,
  createEmptyModel,
  emptyDocument,
  emptyOrganization,
  emptySurvey,
  textBlock,
  type DocumentInfo,
  type DocumentsInfo,
  type Organization,
  type RussianAddress,
  type Survey,
  type TextBlock,
  type TzXmlModel,
} from './tz-xml';

type Node = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') {
    const t = (v as Node)['#text'];
    return t === undefined ? '' : String(t).trim();
  }
  return String(v).trim();
}

function attr(node: unknown, name: string): string {
  if (!node || typeof node !== 'object') return '';
  return str((node as Node)[`@${name}`]);
}

function child(node: unknown, name: string): unknown {
  if (!node || typeof node !== 'object') return undefined;
  return (node as Node)[name];
}

function parseTextBlock(node: unknown): TextBlock | undefined {
  if (!node) return undefined;
  if (typeof node === 'string') return textBlock([node.trim()]);
  const n = node as Node;
  const paragraphs: string[] = [];
  for (const s of asArray(n.SubTitle)) {
    const t = str(s);
    if (t) paragraphs.push(t);
  }
  for (const t of asArray(n.Text)) {
    const s = str(t);
    if (s) paragraphs.push(s);
  }
  if (paragraphs.length === 0) return undefined;
  const title = attr(node, 'Title');
  return textBlock(paragraphs, title || undefined);
}

function parseAddress(node: unknown): RussianAddress | undefined {
  const ru = child(node, 'RussianAddress');
  if (!ru) return undefined;
  const landmark = str(child(ru, 'Landmark'));
  const note = str(child(ru, 'Note'));
  const a: RussianAddress = {
    regionCode: str(child(ru, 'RegionCode')),
    postIndex: str(child(ru, 'PostIndex')) || undefined,
    oktmoCode: str(child(ru, 'OKTMOCode')),
    oktmoName: str(child(ru, 'OKTMOName')),
    district: str(child(ru, 'District')) || undefined,
    city: str(child(ru, 'City')) || undefined,
    settlement: str(child(ru, 'Settlement')) || undefined,
    street: str(child(ru, 'Street')) || undefined,
    building: str(child(ru, 'Building')) || undefined,
    room: str(child(ru, 'Room')) || undefined,
    note: note || landmark || undefined,
  };
  return a;
}

function parseOrganization(node: unknown): Organization | undefined {
  if (!node) return undefined;
  const o = emptyOrganization();
  o.fullName = str(child(node, 'FullName'));
  o.abbreviatedName = str(child(node, 'AbbreviatedName')) || undefined;
  o.ogrn = str(child(node, 'OGRN')) || undefined;
  o.rafp = str(child(node, 'RAFP')) || undefined;
  o.inn = str(child(node, 'INN'));
  o.kpp = str(child(node, 'KPP'));
  o.email = str(child(node, 'Email')) || undefined;
  const addr = parseAddress(child(node, 'Address'));
  if (addr) o.address = addr;
  const nopriz = attr(node, 'NOPRIZNumber');
  if (nopriz) o.noprizNumber = nopriz;
  return o.fullName ? o : undefined;
}

function authorNoteFrom(node: unknown): string {
  const note = str(child(node, 'AuthorNote'));
  if (note) return note;
  const author = child(node, 'Author');
  if (!author) return '';
  const org = child(author, 'Organization');
  if (org) return str(child(org, 'FullName'));
  const ip = child(author, 'IndividualEntrepreneur');
  const person = child(author, 'Person');
  const p = ip ?? person;
  if (p) {
    const fio = [str(child(p, 'Surname')), str(child(p, 'Name')), str(child(p, 'Patronymic'))].filter(Boolean).join(' ');
    return ip ? `ИП ${fio}` : fio;
  }
  return '';
}

function parseDocuments(node: unknown): DocumentsInfo | undefined {
  if (!node) return undefined;
  const documents: DocumentInfo[] = [];
  for (const d of asArray(child(node, 'DocumentInfo'))) {
    const doc = emptyDocument(attr(d, 'Type'));
    const id = attr(d, 'Id');
    if (id) doc.id = id;
    doc.name = str(child(d, 'Name'));
    doc.number = str(child(d, 'Number'));
    doc.date = str(child(d, 'Date'));
    doc.authorNote = authorNoteFrom(d);
    doc.changes = str(child(d, 'Changes')) || undefined;
    const files = asArray(child(d, 'File'));
    const webLink = str(child(d, 'WebLink'));
    const ref = str(child(d, 'ReferenceToDocumentId'));
    if (files.length) {
      doc.source = 'FILE';
      doc.files = files.map((f) => ({
        fileUrl: '',
        name: str(child(f, 'Name')),
        format: str(child(f, 'Format')),
        checksum: str(child(f, 'Checksum')),
      }));
    } else if (webLink) {
      doc.source = 'WEBLINK';
      doc.webLink = webLink;
    } else if (ref) {
      doc.source = 'REFERENCE';
      doc.referenceToDocumentId = ref;
    }
    documents.push(doc);
  }
  if (documents.length === 0) return undefined;
  const note = str(child(node, 'Note'));
  return { documents, note: note || undefined };
}

/** Вид работ задания на проектирование → вид градостроительной деятельности ТЗ. */
const CONSTRUCTION_TYPE_MAP: Record<string, string> = {
  '1': 'архитектурно-строительное проектирование', // строительство → изыскания под проектирование
  '2': 'реконструкция',
  '3': 'капитальный ремонт',
  '4': 'снос объектов капитального строительства',
  '5': 'реконструкция', // сохранение ОКН
};

function teiNumber(node: unknown): string {
  const v = str(child(node, 'Value')) || str(child(node, 'MaxValue'));
  const m = v.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? m[0] : '';
}

export interface DesignParseResult {
  model: TzXmlModel;
  /** Что удалось перенести — для сообщения пользователю. */
  imported: string[];
  /** Замечания: что не перенесено или требует внимания. */
  notes: string[];
}

export function parseDesignAssignment(xml: string): DesignParseResult {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    throw new Error(`Файл не является корректным XML: ${valid.err.msg}`);
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    textNodeName: '#text',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    removeNSPrefix: true,
  });
  const root = parser.parse(xml) as Node;
  const doc = root.Document as Node | undefined;
  if (!doc) throw new Error('В файле нет корневого элемента Document');
  const typeCode = attr(doc, 'TypeCode');
  if (typeCode && typeCode !== '05.03') {
    throw new Error(`Код вида документа ${typeCode} не соответствует заданию на проектирование (05.03)`);
  }
  const content = doc.Content as Node | undefined;
  if (!content) throw new Error('В файле нет раздела Content — это не задание на проектирование по схеме Минстроя');

  const model = createEmptyModel();
  const prov = model.provenance!;
  const imported: string[] = [];
  const notes: string[] = [];
  const mark = (path: string) => {
    prov[path] = 'document';
  };

  // --- Объект --------------------------------------------------------------
  const obj = content.Object as Node | undefined;
  if (obj) {
    const name = str(obj.Name);
    if (name) {
      model.object.name = name;
      mark('object.name');
      imported.push('наименование объекта');
    }
    const objectType = str(obj.ObjectType);
    const isLinear = objectType === '3';
    model.object.kind = isLinear ? 'LINEAR_OKS' : 'AREAL_OKS';
    model.object.siteKind = isLinear ? 'LINEAR' : 'AREAL';
    mark('object.kind');

    const address = parseAddress(obj.Address) ?? parseAddress(obj.BeginAddress);
    if (address) {
      model.object.placement.address = address;
      mark('object.placement.address');
      imported.push('адрес объекта');
      if (isLinear && obj.FinalAddress) {
        const fin = parseAddress(obj.FinalAddress);
        if (fin) notes.push(`Конечный пункт трассы: ${[fin.city, fin.settlement, fin.street, fin.building, fin.note].filter(Boolean).join(', ')}`);
      }
    }

    const ct = str(obj.ConstructionType);
    if (CONSTRUCTION_TYPE_MAP[ct]) {
      model.constructionType = CONSTRUCTION_TYPE_MAP[ct];
      mark('constructionType');
      imported.push('вид градостроительной деятельности');
    }

    const target = isLinear ? model.object.linear : model.object.areal;
    const fc = str(obj.FunctionsClass);
    if (/^\d{1,2}\.\d{1,2}\.\d{1,3}\.\d{1,3}$/.test(fc)) {
      target.functionsClass = fc;
      mark(isLinear ? 'object.linear.functionsClass' : 'object.areal.functionsClass');
      imported.push('код классификатора назначения ОКС');
    } else if (fc) {
      notes.push(`Код классификатора «${fc}» указан для группы объектов, для ОКС нужен код вида xx.xx.xxx.xxx`);
    }

    const resp = attr(obj, 'ResponsibilityLevel');
    if (resp) {
      target.responsibilityLevel = resp;
      mark(isLinear ? 'object.linear.responsibilityLevel' : 'object.areal.responsibilityLevel');
    }
    if (!isLinear) {
      const dio = attr(obj, 'DangerousIndustrialObject');
      if (dio) {
        model.object.areal.dangerousIndustrialObject = dio;
        mark('object.areal.dangerousIndustrialObject');
      }
      const fire = attr(obj, 'FireDangerCategory');
      if (fire) {
        model.object.areal.fireDangerCategory = fire;
        mark('object.areal.fireDangerCategory');
      }
      const people = attr(obj, 'PeoplePermanentStay');
      if (people) {
        model.object.areal.peoplePermanentStay = people === 'true' || people === '1' ? 'Предусмотрено' : 'Отсутствуют';
        mark('object.areal.peoplePermanentStay');
      }
      const sec = attr(obj, 'SecurityInfluence');
      if (sec) {
        model.object.areal.functionsFeatures =
          sec === 'true' || sec === '1'
            ? 'Относится к объектам транспортной инфраструктуры и к другим объектам, функционально-технологические особенности которых влияют на их безопасность'
            : 'Не относится к объектам транспортной инфраструктуры и к другим объектам, функционально-технологические особенности которых влияют на их безопасность';
        mark('object.areal.functionsFeatures');
      }
      // Технико-экономические показатели: этажность, высота
      for (const tei of [...asArray(obj.TEI), ...asArray(obj.POI)]) {
        const n = str(child(tei, 'Name')).toLowerCase();
        const v = teiNumber(tei);
        if (!v) continue;
        if (n.includes('этаж') && /^\d+$/.test(v) && !model.object.areal.numberFloors) {
          model.object.areal.numberFloors = v;
          mark('object.areal.numberFloors');
        } else if (n.includes('высот') && !model.object.areal.overallHeight) {
          model.object.areal.overallHeight = v;
          mark('object.areal.overallHeight');
        }
      }
    } else {
      for (const tei of [...asArray(obj.TEI), ...asArray(obj.POI)]) {
        const n = str(child(tei, 'Name')).toLowerCase();
        const v = teiNumber(tei);
        if (v && (n.includes('протяж') || n.includes('длина')) && !model.object.linear.length) {
          model.object.linear.length = v;
          mark('object.linear.length');
        }
      }
    }
    if (obj.ObjectParts) {
      notes.push('Объект составной (несколько ОКС); перенесены сведения только об основном объекте');
    }
  }

  // --- Земельные участки ------------------------------------------------------
  const land = content.Land as Node | undefined;
  if (land) {
    const seizure = child(land, 'SeizureLandAreasInfo');
    const cadastral = asArray(child(seizure, 'SeizureLandAreaInfo'))
      .map((s) => str(child(s, 'CadastralNumber')))
      .filter(Boolean);
    if (cadastral.length) {
      model.object.placement.cadastralSites = Array.from(new Set(cadastral));
      mark('object.placement.cadastralSites');
      imported.push('кадастровые номера участков');
    }
  }

  // --- Застройщик / технический заказчик ---------------------------------------
  const devOrg = parseOrganization(child(content.Developers, 'Organization'));
  const devPerson = child(content.Developers, 'Person');
  const tcOrgs = asArray(child(content.TechnicalCustomers, 'TechnicalCustomer'))
    .map((tc) => parseOrganization(child(tc, 'Organization')))
    .filter((o): o is Organization => !!o);

  if (devOrg) {
    model.customerKind = 'DEVELOPER';
    model.developer.kind = 'ORGANIZATION';
    model.developer.organization = devOrg;
    mark('developer.organization');
    imported.push('застройщик');
  } else if (devPerson) {
    model.customerKind = 'DEVELOPER';
    model.developer.kind = 'PERSON';
    model.developer.person.surname = str(child(devPerson, 'Surname'));
    model.developer.person.name = str(child(devPerson, 'Name'));
    model.developer.person.patronymic = str(child(devPerson, 'Patronymic')) || undefined;
    model.developer.person.email = str(child(devPerson, 'Email')) || undefined;
    const pa = parseAddress({ RussianAddress: child(child(devPerson, 'PostAddress'), 'RussianPostAddress') });
    if (pa) model.developer.person.postAddress = pa;
    mark('developer.person');
    imported.push('застройщик (физическое лицо)');
  }
  if (tcOrgs.length) {
    model.technicalCustomer = tcOrgs[0];
    mark('technicalCustomer');
    if (!devOrg && !devPerson) model.customerKind = 'TECHNICAL_CUSTOMER';
    imported.push('технический заказчик');
    if (tcOrgs.length > 1) notes.push('В задании на проектирование несколько технических заказчиков; перенесён первый');
  }
  // Утверждает задание на изыскания заказчик: подставляем его организацию
  const approverOrg = model.customerKind === 'TECHNICAL_CUSTOMER' ? tcOrgs[0] : devOrg;
  if (approverOrg) {
    model.approver.organization = { ...approverOrg, noprizNumber: approverOrg.noprizNumber || 'Не требуется' };
    mark('approver.organization');
  }

  // --- Документы -------------------------------------------------------------------
  const decision = parseDocuments(content.DecisionDocuments);
  if (decision) {
    model.initiationDocuments = decision;
    mark('initiationDocuments');
    imported.push(`документы-основания (${decision.documents.length})`);
  }
  const initial = parseDocuments(content.InitialDocuments);
  if (initial) {
    model.availableDocuments = initial;
    mark('availableDocuments');
    imported.push(`исходные материалы (${initial.documents.length})`);
  }
  const hasFilesWithoutData = [...(decision?.documents ?? []), ...(initial?.documents ?? [])].some(
    (d) => d.source === 'FILE' && d.files.some((f) => !f.fileUrl),
  );
  if (hasFilesWithoutData) {
    notes.push('Файлы документов перенесены только как описания (имя, формат, контрольная сумма) — сами файлы нужно приложить заново');
  }

  // --- Сроки -------------------------------------------------------------------------
  const stages = content.Stages as Node | undefined;
  if (stages) {
    const common = parseTextBlock(stages.Common);
    const stageLines = asArray(stages.Stage).map((s) => {
      const parts = [str(child(s, 'Name'))];
      const b = str(child(s, 'BeginDate'));
      const e = str(child(s, 'EndDate'));
      if (b || e) parts.push(`${b || '…'} – ${e || '…'}`);
      return parts.filter(Boolean).join(': ');
    });
    const text = [...(common?.paragraphs ?? []), ...stageLines].filter(Boolean).join(' ');
    if (text) {
      model.timePeriod = text;
      model.enabled.timePeriod = true;
      mark('timePeriod');
    }
  }

  // --- Климат / опасные процессы -------------------------------------------------------
  const climate = content.ClimateConditions as Node | undefined;
  if (climate) {
    const dnp = parseTextBlock(climate.DangerousNatureProcesses);
    if (dnp) {
      model.dangerous.processesAdditional = dnp;
      mark('dangerous.processesAdditional');
      notes.push('Описание опасных процессов перенесено текстом; коды процессов нужно выбрать из справочника');
    }
  }

  // --- Инженерные изыскания --------------------------------------------------------------
  const es = content.EngineeringSurvey as Node | undefined;
  if (es) {
    const common = parseTextBlock(es.Common);
    if (common) {
      model.technogenicImpacts = undefined;
      model.requirements.compositionOrderTransfer = {
        paragraphs: [...common.paragraphs, ...model.requirements.compositionOrderTransfer.paragraphs],
      };
      mark('requirements.compositionOrderTransfer');
    }
    const surveys: Survey[] = [];
    for (const s of asArray(child(es.SurveysRequirements, 'Survey'))) {
      const basic = str(child(s, 'BasicEngineeringSurvey'));
      const special = str(child(s, 'SpecialEngineeringSurvey'));
      const other = str(child(s, 'OtherEngineeringSurvey'));
      let survey: Survey | undefined;
      if (basic && BASIC_SURVEY_TYPES.some((d) => d.code === basic)) survey = emptySurvey('BASIC', basic);
      else if (special && SPECIAL_SURVEY_TYPES.some((d) => d.code === special)) survey = emptySurvey('SPECIAL', special);
      else if (other) {
        survey = emptySurvey('OTHER');
        survey.otherNames = [other];
      }
      if (!survey) continue;
      const req = parseTextBlock(child(s, 'Requirements'));
      const bounds = str(child(s, 'Bounds'));
      if (req || bounds) {
        survey.additionalRequirements = textBlock([...(bounds ? [`Границы изысканий: ${bounds}`] : []), ...(req?.paragraphs ?? [])]);
      }
      const scale = str(child(s, 'Scale')) || str(child(s, 'MaxScale'));
      if (scale && SCALES.some((d) => d.code === scale)) {
        model.object.arealSite.shootingScale = scale;
        model.object.linearSite.shootingScale = scale;
        mark('object.arealSite.shootingScale');
      }
      surveys.push(survey);
    }
    if (surveys.length) {
      model.surveys = surveys;
      mark('surveys');
      imported.push(`виды изысканий (${surveys.length})`);
    }
    const norms = asArray(child(es.Norms, 'Norm')).map(str).filter(Boolean);
    if (norms.length) {
      model.requirements.usedNorms = norms;
      model.enabled.usedNorms = true;
      mark('requirements.usedNorms');
      imported.push('перечень нормативных документов');
    }
    const addresses = asArray(es.Address);
    const first = addresses[0];
    if (first) {
      const cs = str(child(first, 'CoordinateSystem'));
      const hs = str(child(first, 'HeightSystem'));
      if (cs || hs) notes.push(`Система координат по заданию на проектирование: ${[cs, hs].filter(Boolean).join(', ')}`);
      if (!model.object.placement.address.regionCode) {
        model.object.placement.address.regionCode = str(child(first, 'RegionCode'));
        model.object.placement.address.note = str(child(first, 'District')) || undefined;
      }
    }
    const reuse = asArray(child(child(es, 'ReuseDocuments') ?? child(es, 'SurveyDocuments'), 'ReferenceToDocumentId')).map(str).filter(Boolean);
    if (reuse.length && initial) {
      const docs = initial.documents.filter((d) => reuse.includes(d.id));
      if (docs.length) {
        model.requirements.archivalMaterials = { documents: docs.map((d) => ({ ...d, id: `${d.id}-arch` })) };
        model.enabled.archivalMaterials = true;
        mark('requirements.archivalMaterials');
        imported.push('материалы изысканий прошлых лет');
      }
    }
  }

  return { model, imported, notes };
}
