/**
 * Сборка XML задания по схеме EngineeringSurveysTask-01-00 из модели.
 *
 * Порядок элементов строго повторяет xs:sequence схемы. Пустые значения
 * не выводятся (схема запрещает пустые теги). Изображения и файлы вложений
 * передаются уже подготовленными (base64 / контрольные суммы), сборщик
 * файловую систему не трогает.
 */

import { DOCUMENT_TYPE_CODE } from './defaults';
import type {
  Area,
  AttachedFile,
  ControlPerson,
  CoordinateSystem,
  DocumentInfo,
  DocumentsInfo,
  Entrepreneur,
  LinearRoute,
  Organization,
  Person,
  Point,
  Representative,
  RussianAddress,
  TextBlock,
  TzXmlModel,
} from './model';

export interface BuildOptions {
  /** base64-данные изображений границ по fileUrl. */
  images: Record<string, string>;
  /** Идентификатор объекта (xs:ID). */
  objectId?: string;
  /** Сохраняем заполненные части незавершённых блоков для просмотра PDF. */
  preview?: boolean;
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function filled(v: string | undefined | null): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** xs:decimal: точка как разделитель, без пробелов. */
function dec(v: string | undefined): string {
  return (v ?? '').trim().replace(',', '.').replace(/\s+/g, '');
}

class Xml {
  private parts: string[] = [];
  private depth = 0;

  open(tag: string, attrs: Record<string, string | undefined> = {}): void {
    this.parts.push(`${'  '.repeat(this.depth)}<${tag}${this.attrs(attrs)}>`);
    this.depth += 1;
  }

  close(tag: string): void {
    this.depth -= 1;
    this.parts.push(`${'  '.repeat(this.depth)}</${tag}>`);
  }

  /** Простой элемент; пропускается, если значение пустое. */
  el(tag: string, value: string | undefined | null, attrs: Record<string, string | undefined> = {}): void {
    if (!filled(value)) return;
    this.parts.push(`${'  '.repeat(this.depth)}<${tag}${this.attrs(attrs)}>${esc(value.trim())}</${tag}>`);
  }

  /** Элемент только с атрибутами (пустое содержимое). */
  empty(tag: string, attrs: Record<string, string | undefined>): void {
    this.parts.push(`${'  '.repeat(this.depth)}<${tag}${this.attrs(attrs)}/>`);
  }

  raw(line: string): void {
    this.parts.push(`${'  '.repeat(this.depth)}${line}`);
  }

  private attrs(a: Record<string, string | undefined>): string {
    return Object.entries(a)
      .filter(([, v]) => filled(v))
      .map(([k, v]) => ` ${k}="${esc(v!.trim())}"`)
      .join('');
  }

  toString(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${this.parts.join('\n')}\n`;
  }
}

// ---------------------------------------------------------------------------
// Общие фрагменты
// ---------------------------------------------------------------------------

function writeTextBlock(x: Xml, tag: string, tb: TextBlock | undefined): void {
  if (!tb) return;
  const paragraphs = tb.paragraphs.filter(filled);
  if (paragraphs.length === 0) return;
  x.open(tag, { Title: tb.title });
  for (const p of paragraphs) x.el('Text', p);
  x.close(tag);
}

function writeRussianAddress(x: Xml, tag: string, a: RussianAddress, postal: boolean): void {
  x.open(tag);
  x.el('RegionCode', a.regionCode);
  x.el('PostIndex', a.postIndex);
  x.el('OKTMOCode', a.oktmoCode);
  x.el('OKTMOName', a.oktmoName);
  const structured = [a.district, a.city, a.settlement, a.street, a.building, a.room].some(filled);
  if (structured) {
    x.el('District', a.district);
    x.el('City', a.city);
    x.el('Settlement', a.settlement);
    x.el('Street', a.street);
    x.el('Building', a.building);
    x.el('Room', a.room);
  } else {
    x.el('Note', a.note);
  }
  x.close(tag);
  void postal;
}

/** tAddress → Address/RussianAddress */
function writeAddress(x: Xml, tag: string, a: RussianAddress): void {
  x.open(tag);
  writeRussianAddress(x, 'RussianAddress', a, false);
  x.close(tag);
}

/** tPostAddress → PostAddress/RussianPostAddress */
function writePostAddress(x: Xml, a: RussianAddress): void {
  x.open('PostAddress');
  writeRussianAddress(x, 'RussianPostAddress', a, true);
  x.close('PostAddress');
}

function writeOrganization(x: Xml, tag: string, o: Organization, nopriz: boolean): void {
  x.open(tag, nopriz ? { NOPRIZNumber: o.noprizNumber || 'Не требуется' } : {});
  x.el('FullName', o.fullName);
  x.el('AbbreviatedName', o.abbreviatedName);
  if (filled(o.ogrn)) x.el('OGRN', o.ogrn);
  else x.el('RAFP', o.rafp);
  x.el('INN', o.inn);
  x.el('KPP', o.kpp);
  writeAddress(x, 'Address', o.address);
  x.el('Email', o.email);
  x.close(tag);
}

function writeFio(x: Xml, p: { surname: string; name: string; patronymic?: string }): void {
  x.el('Surname', p.surname);
  x.el('Name', p.name);
  x.el('Patronymic', p.patronymic);
}

function writePerson(x: Xml, tag: string, p: Person): void {
  x.open(tag);
  writeFio(x, p);
  writePostAddress(x, p.postAddress);
  x.el('Email', p.email);
  x.close(tag);
}

function writeEntrepreneur(x: Xml, tag: string, e: Entrepreneur, nopriz: boolean): void {
  x.open(tag, nopriz ? { NOPRIZNumber: e.noprizNumber || 'Не требуется' } : {});
  writeFio(x, e);
  x.el('OGRNIP', e.ogrnip);
  x.el('INN', e.inn);
  writePostAddress(x, e.postAddress);
  x.el('Email', e.email);
  x.close(tag);
}

function writeRepresentative(x: Xml, r: Representative): void {
  x.open('Representative', { FunctionalRole: r.functionalRole });
  writeFio(x, r);
  x.el('Position', r.position);
  x.el('Email', r.email);
  x.close('Representative');
}

function writeControlPerson(x: Xml, p: ControlPerson): void {
  x.open('Representative');
  writeFio(x, p);
  x.el('Email', p.email);
  x.close('Representative');
}

function writeFile(x: Xml, f: AttachedFile): void {
  x.open('File');
  x.el('Name', f.name);
  x.el('Format', f.format);
  x.el('Checksum', f.checksum);
  x.close('File');
}

function writeDocument(x: Xml, d: DocumentInfo): void {
  x.open('DocumentInfo', { Id: d.id, Type: d.typeCode });
  x.el('Name', d.name);
  x.el('Number', d.number);
  x.el('Date', d.date);
  x.el('AuthorNote', d.authorNote);
  x.el('Changes', d.changes);
  if (d.source === 'FILE') {
    for (const f of d.files) writeFile(x, f);
  } else if (d.source === 'REFERENCE') {
    x.el('ReferenceToDocumentId', d.referenceToDocumentId);
  } else {
    x.el('WebLink', d.webLink);
  }
  x.close('DocumentInfo');
}

function writeDocuments(x: Xml, tag: string, d: DocumentsInfo | undefined, preview = false): void {
  if (!d || (d.documents.length === 0 && !(preview && filled(d.note)))) return;
  x.open(tag);
  for (const doc of d.documents) writeDocument(x, doc);
  x.el('Note', d.note);
  x.close(tag);
}

function writeStringList(x: Xml, tag: string, itemTag: string, items: string[]): void {
  const list = items.filter(filled);
  if (list.length === 0) return;
  x.open(tag);
  for (const it of list) x.el(itemTag, it);
  x.close(tag);
}

function writeCoordinateSystem(x: Xml, cs: CoordinateSystem): void {
  const tag = { STATE: 'State', REGIONAL: 'Regional', LOCAL: 'Local', INTERNATIONAL: 'International' }[cs.kind];
  x.open('CoordinateAndHeightSystem');
  x.empty(tag, { Name: cs.name, HeightSystem: cs.heightSystem });
  x.close('CoordinateAndHeightSystem');
}

function writePoint(x: Xml, tag: string, p: Point): void {
  x.empty(tag, { CoordinateX: dec(p.x), CoordinateY: dec(p.y) });
}

function writeArea(x: Xml, a: Area): void {
  x.open('Area', { Name: a.name });
  writeCoordinateSystem(x, a.coordinateSystem);
  for (const p of a.points) writePoint(x, 'Point', p);
  x.close('Area');
}

function writeLinearRoute(x: Xml, r: LinearRoute): void {
  x.open('LinearRoute', { Name: r.name });
  writeCoordinateSystem(x, r.coordinateSystem);
  writePoint(x, 'StartPoint', r.startPoint);
  for (const p of r.middlePoints) writePoint(x, 'MiddlePoint', p);
  writePoint(x, 'FinishPoint', r.finishPoint);
  x.close('LinearRoute');
}

function writeFoundationMaterials(x: Xml, singleTag: string, combinedTag: string, materials: string[]): void {
  const list = materials.filter(filled);
  if (list.length === 1) {
    x.el(singleTag, list[0]);
  } else if (list.length > 1) {
    x.open(combinedTag);
    for (const m of list) x.el('Material', m);
    x.close(combinedTag);
  }
}

// ---------------------------------------------------------------------------
// Разделы документа
// ---------------------------------------------------------------------------

function writeRequisites(x: Xml, m: TzXmlModel): void {
  x.open('Requisites');
  x.el('Date', m.requisites.date);
  x.el('Number', m.requisites.number);
  x.open('Authors');
  x.open('Author');
  writeOrganization(x, 'Organization', m.approver.organization, true);
  x.open('Representatives');
  for (const r of m.approver.representatives) writeRepresentative(x, r);
  x.close('Representatives');
  x.close('Author');
  x.close('Authors');
  x.el('SecurityLabel', m.requisites.securityLabel);
  x.close('Requisites');
}

function writePlacement(x: Xml, m: TzXmlModel): void {
  const p = m.object.placement;
  x.open('Placement');
  x.open('Address');
  writeRussianAddress(x, 'RussianAddress', p.address, false);
  x.close('Address');
  const districts = p.cadastralDistricts.filter(filled);
  const sites = p.cadastralSites.filter(filled);
  if (districts.length || sites.length) {
    x.open('CadastralAreas');
    for (const d of districts) x.el('CadastralDistrict', d);
    for (const s of sites) x.el('CadastralSite', s);
    x.close('CadastralAreas');
  }
  if (p.areas.length) {
    x.open('Areas');
    for (const a of p.areas) writeArea(x, a);
    x.close('Areas');
  }
  x.close('Placement');
}

function writeObjectInfo(x: Xml, m: TzXmlModel, objectId: string): void {
  const o = m.object;
  x.open('ObjectInfo');
  x.open('OKS', { ObjectID: objectId, ObjectStatus: o.status });
  if (o.kind === 'AREAL_OKS') {
    const a = o.areal;
    x.open('ArealOKS');
    x.el('Name', o.name);
    writePlacement(x, m);
    x.el('ResponsibilityLevel', a.responsibilityLevel);
    x.el('FunctionsClass', a.functionsClass);
    x.el('FunctionsFeatures', a.functionsFeatures);
    x.el('EnergyEfficiency', a.energyEfficiency);
    x.el('DangerousIndustrialObject', a.dangerousIndustrialObject);
    x.el('FireDangerCategory', a.fireDangerCategory);
    x.el('PeoplePermanentStay', a.peoplePermanentStay);
    writeTextBlock(x, 'DesignFeatures', a.designFeatures);
    x.open('PlanSize');
    x.el('Width', dec(a.planSize.width));
    x.el('Length', dec(a.planSize.length));
    x.el('Height', dec(a.planSize.height));
    x.close('PlanSize');
    x.el('OverallHeight', dec(a.overallHeight));
    x.el('NumberFloors', a.numberFloors);
    x.el('ApproximateWeight', dec(a.approximateWeight));
    const f = a.foundation;
    x.open('Foundation');
    for (const t of f.types.filter(filled)) x.el('Type', t);
    writeFoundationMaterials(x, 'SingleMaterial', 'CombinedMaterial', f.materials);
    x.el('Size', dec(f.size));
    x.el('PilesCross', f.pilesCross);
    x.el('Depth', dec(f.depth));
    x.open('Load');
    x.el('PileLoad', dec(f.load.pileLoad));
    x.el('StripLoad', dec(f.load.stripLoad));
    x.el('SoilLoad', dec(f.load.soilLoad));
    x.close('Load');
    x.close('Foundation');
    if (a.foundationPit && (filled(a.foundationPit.depth) || filled(a.foundationPit.fence))) {
      x.open('FoundationPit');
      x.el('Depth', dec(a.foundationPit.depth));
      x.el('Fence', a.foundationPit.fence);
      x.close('FoundationPit');
    }
    x.el('EarthworksDepth', dec(a.earthworksDepth));
    x.el('CompressibleSoilThickness', dec(a.compressibleSoilThickness));
    x.el('Basement', dec(a.basement));
    writeTextBlock(x, 'StructuresBelowFoundation', a.structuresBelowFoundation);
    writeTextBlock(x, 'Loads', a.loads);
    x.el('PermissibleDraft', dec(a.permissibleDraft));
    x.close('ArealOKS');
  } else {
    const l = o.linear;
    x.open('LinearOKS');
    x.el('Name', o.name);
    writePlacement(x, m);
    x.el('Length', dec(l.length));
    x.el('ResponsibilityLevel', l.responsibilityLevel);
    x.el('FunctionsClass', l.functionsClass);
    switch (l.kind) {
      case 'LINE_POWER':
      case 'BRIDGE': {
        const tag = l.kind === 'LINE_POWER' ? 'LinePower' : 'Bridge';
        x.open(tag);
        for (const t of l.foundationTypes.filter(filled)) x.el('FoundationType', t);
        writeFoundationMaterials(x, 'FoundationMaterial', 'CombinedFoundationMaterial', l.foundationMaterials);
        x.el('FoundationDepth', dec(l.foundationDepth));
        x.close(tag);
        break;
      }
      case 'LINE_COMMUNICATION':
        x.open('LineCommunication');
        x.el('LayingMethod', l.layingMethod);
        x.el('MaterialCable', l.cableMaterial);
        for (const t of l.foundationTypes.filter(filled)) x.el('FoundationType', t);
        writeFoundationMaterials(x, 'FoundationMaterial', 'CombinedFoundationMaterial', l.foundationMaterials);
        x.el('FoundationDepth', dec(l.foundationDepth));
        x.el('CableDepth', dec(l.cableDepth));
        x.close('LineCommunication');
        break;
      case 'PIPELINE':
        x.open('Pipeline');
        x.el('LayingMethod', l.layingMethod);
        x.el('MaterialPipe', l.pipeMaterial);
        x.el('PipeDepth', dec(l.pipeDepth));
        x.el('PipeDiameter', dec(l.pipeDiameter));
        x.el('Pressure', dec(l.pressure));
        x.close('Pipeline');
        break;
      case 'AUTOMOBILE_ROAD':
        x.open('AutomobileRoad');
        x.el('EmbankmentHeight', dec(l.embankmentHeight));
        x.close('AutomobileRoad');
        break;
      case 'LINE_RAILWAY':
        x.open('LineRailway');
        x.el('EmbankmentHeight', dec(l.embankmentHeight));
        x.el('SleepersMaterial', l.sleepersMaterial);
        x.close('LineRailway');
        break;
    }
    x.close('LinearOKS');
  }
  x.close('OKS');

  if (o.siteKind === 'AREAL') {
    const s = o.arealSite;
    x.open('ArealObject');
    x.open('PlanSize');
    x.el('Width', dec(s.planSize.width));
    x.el('Length', dec(s.planSize.length));
    x.close('PlanSize');
    x.el('ShootingScale', s.shootingScale);
    x.el('SectionRelief', s.sectionRelief);
    writeTextBlock(x, 'AdditionalRequirements', s.additionalRequirements);
    x.close('ArealObject');
  } else {
    const s = o.linearSite;
    x.open('LinearObject');
    x.el('Length', dec(s.length));
    x.el('ShootingWidth', dec(s.shootingWidth));
    x.el('ShootingScale', s.shootingScale);
    x.el('ScalePlanProfile', s.scalePlanProfile);
    x.el('SectionRelief', s.sectionRelief);
    writeTextBlock(x, 'AdditionalRequirements', s.additionalRequirements);
    x.close('LinearObject');
  }
  x.close('ObjectInfo');
}

function writeCustomer(x: Xml, m: TzXmlModel): void {
  if (m.customerKind === 'DEVELOPER' || m.customerKind === 'BOTH') {
    x.open('Developer');
    if (m.developer.kind === 'ORGANIZATION') writeOrganization(x, 'Organization', m.developer.organization, false);
    else writePerson(x, 'Person', m.developer.person);
    x.close('Developer');
  }
  if (m.customerKind === 'TECHNICAL_CUSTOMER' || m.customerKind === 'BOTH') {
    x.open('TechnicalCustomer');
    writeOrganization(x, 'Organization', m.technicalCustomer, true);
    x.close('TechnicalCustomer');
  }
}

function writeResearchers(x: Xml, m: TzXmlModel): void {
  if (!m.enabled.researchers || m.researchers.length === 0) return;
  x.open('Researchers');
  for (const r of m.researchers) {
    x.open('Researcher');
    if (r.kind === 'ORGANIZATION') writeOrganization(x, 'Organization', r.organization, true);
    else writeEntrepreneur(x, 'IndividualEntrepreneur', r.entrepreneur, true);
    x.open('Contract');
    x.el('Number', r.contract.number);
    x.el('Date', r.contract.date);
    for (const f of r.contract.files) writeFile(x, f);
    x.close('Contract');
    x.close('Researcher');
  }
  x.close('Researchers');
}

function writeSurveys(x: Xml, m: TzXmlModel): void {
  x.open('EngineeringSurveyTypes');
  const ordered = [
    ...m.surveys.filter((s) => s.kind === 'BASIC').sort((a, b) => Number(a.typeCode) - Number(b.typeCode)),
    ...m.surveys.filter((s) => s.kind === 'SPECIAL').sort((a, b) => Number(a.typeCode) - Number(b.typeCode)),
    ...m.surveys.filter((s) => s.kind === 'OTHER'),
  ];
  for (const s of ordered) {
    const tag = { BASIC: 'BasicEngineeringSurvey', SPECIAL: 'SpecialEngineeringSurvey', OTHER: 'OtherEngineeringSurvey' }[s.kind];
    x.open(tag);
    if (s.kind === 'BASIC') x.el('BasicEngineeringSurveyType', s.typeCode);
    else if (s.kind === 'SPECIAL') x.el('SpecialEngineeringSurveyType', s.typeCode);
    else for (const n of s.otherNames.filter(filled)) x.el('OtherEngineeringSurveyType', n);
    writeStringList(x, 'Purposes', 'Purpose', s.purposes);
    writeStringList(x, 'Tasks', 'Task', s.tasks);
    writeTextBlock(x, 'AdditionalRequirements', s.additionalRequirements);
    const author = s.authors[0];
    if (author) {
      x.open('EngineeringSurveyAuthors');
      x.open('Author');
      if (author.kind === 'ORGANIZATION') writeOrganization(x, 'Organization', author.organization, true);
      else writeEntrepreneur(x, 'IndividualEntrepreneur', author.entrepreneur, true);
      x.close('Author');
      x.close('EngineeringSurveyAuthors');
    }
    x.close(tag);
  }
  x.close('EngineeringSurveyTypes');
}

function writeEcology(x: Xml, m: TzXmlModel): void {
  if (!m.enabled.ecology) return;
  const e = m.ecology;
  const any = [e.existingPollutionSources, e.plannedPollutionSources, e.possibleAccident, e.landWithdraw, e.waterSource, e.waterRelease].some(
    (tb) => tb && tb.paragraphs.some(filled),
  );
  if (!any) return;
  x.open('Ecology');
  writeTextBlock(x, 'ExistingPollutionSources', e.existingPollutionSources);
  writeTextBlock(x, 'PlannedPollutionSources', e.plannedPollutionSources);
  writeTextBlock(x, 'PossibleAccident', e.possibleAccident);
  writeTextBlock(x, 'LandWithdraw', e.landWithdraw);
  writeTextBlock(x, 'WaterSource', e.waterSource);
  writeTextBlock(x, 'WaterRelease', e.waterRelease);
  x.close('Ecology');
}

function writeBoundaries(x: Xml, m: TzXmlModel, images: Record<string, string>): void {
  const b = m.boundaries;
  x.open('BoundariesArealLinear');
  x.open('AreasImages');
  b.images.forEach((img, i) => {
    const data = images[img.fileUrl];
    if (!data) return;
    x.open('Image', { Type: img.type, Name: `image-${i + 1}` });
    x.el('ImageData', data);
    x.el('Comment', img.comment);
    x.close('Image');
  });
  x.close('AreasImages');
  if (m.enabled.areas && b.areas.length) {
    x.open('Areas');
    for (const a of b.areas) writeArea(x, a);
    x.close('Areas');
  }
  if (m.enabled.linearRoutes && b.linearRoutes.length) {
    x.open('LinearRoutes');
    for (const r of b.linearRoutes) writeLinearRoute(x, r);
    x.close('LinearRoutes');
  }
  writeTextBlock(x, 'ProjectedPlanningMarks', b.projectedPlanningMarks);
  writeTextBlock(x, 'AreaOutWorks', b.areaOutWorks);
  x.close('BoundariesArealLinear');
}

function writeDangerous(x: Xml, m: TzXmlModel): void {
  const d = m.dangerous;
  x.open('DangerousNaturalProcesses');
  x.open('DangerousNaturalProcesses');
  for (const p of d.processes.filter(filled)) x.el('Process', p);
  x.close('DangerousNaturalProcesses');
  writeTextBlock(x, 'DangerousNaturalProcessesAdditional', d.processesAdditional);
  x.el('PermafrostSoils', d.permafrost);
  writeTextBlock(x, 'PermafrostSoilsAdditional', d.permafrostAdditional);
  const soils = d.soils.filter(filled);
  if (soils.length) {
    x.open('SpecificSoils');
    for (const s of soils) x.el('Soil', s);
    x.close('SpecificSoils');
  }
  writeTextBlock(x, 'SpecificSoilsAdditional', d.soilsAdditional);
  x.close('DangerousNaturalProcesses');
}

function writeRequirements(x: Xml, m: TzXmlModel, preview = false): void {
  const q = m.requirements;
  x.open('Requirements');
  writeTextBlock(x, 'ScientificSupport', q.scientificSupport);
  writeTextBlock(x, 'AccuracySecurity', q.accuracySecurity);
  writeTextBlock(x, 'ForecastChangesNaturalConditions', q.forecastChangesNaturalConditions);
  if (m.enabled.suggestionsRecommendation) writeTextBlock(x, 'SuggestionsRecommendation', q.suggestionsRecommendation);

  x.open('ControlQuality');
  writeTextBlock(x, 'InsideControlQuality', q.controlQuality.inside);
  const out = q.controlQuality.outside;
  if (out) {
    const hasPeople = out.by === 'ORGANIZATION' ? out.organizations.length > 0 : out.representatives.length > 0;
    if (hasPeople || (preview && out.description?.paragraphs.some(filled))) {
      x.open('OutsideControlQuality');
      writeTextBlock(x, 'Description', out.description);
      if (out.by === 'ORGANIZATION') {
        for (const og of out.organizations) {
          x.open('OutsideOrganizationControl');
          if (og.kind === 'ORGANIZATION') writeOrganization(x, 'Organization', og.organization, false);
          else writeEntrepreneur(x, 'IndividualEntrepreneur', og.entrepreneur, false);
          for (const p of og.representatives) writeControlPerson(x, p);
          x.close('OutsideOrganizationControl');
        }
      } else {
        const tag = out.by === 'DEVELOPER' ? 'DeveloperControl' : 'TechnicalCustomerControl';
        x.open(tag);
        for (const p of out.representatives) writeControlPerson(x, p);
        x.close(tag);
      }
      x.close('OutsideControlQuality');
    }
  }
  x.close('ControlQuality');

  writeTextBlock(x, 'CompositionOrderTransfer', q.compositionOrderTransfer);
  if (m.enabled.archivalMaterials) writeDocuments(x, 'ArchivalMaterials', q.archivalMaterials, preview);
  if (m.enabled.modelFormat) writeTextBlock(x, 'ModelFormat', q.modelFormat);
  if (m.enabled.usedNorms) writeStringList(x, 'UsedNorms', 'UsedNorm', q.usedNorms);
  x.close('Requirements');
}

// ---------------------------------------------------------------------------
// Документ
// ---------------------------------------------------------------------------

export function buildTzXml(m: TzXmlModel, options: BuildOptions): string {
  const x = new Xml();
  const objectId = options.objectId ?? 'object-1';

  x.open('Document', {
    Id: m.requisites.id,
    TypeCode: DOCUMENT_TYPE_CODE,
    VersionNumber: String(m.requisites.versionNumber || 1),
  });
  writeRequisites(x, m);

  x.open('Content', { SchemaVersion: m.schemaVersion });
  writeObjectInfo(x, m, objectId);
  writeDocuments(x, 'SurveysInitiationDocuments', m.initiationDocuments, options.preview);
  x.el('ConstructionType', m.constructionType);
  if (m.enabled.timePeriod) x.el('EngineeringSurveyTimePeriod', m.timePeriod);
  writeCustomer(x, m);
  writeResearchers(x, m);
  writeStringList(x, 'Purposes', 'Purpose', m.purposes);
  writeStringList(x, 'Tasks', 'Task', m.tasks);
  x.el('EngineeringSurveyStage', m.stage);
  writeSurveys(x, m);
  if (m.enabled.technogenicImpacts) writeTextBlock(x, 'TechnogenicImpacts', m.technogenicImpacts);
  writeEcology(x, m);
  writeBoundaries(x, m, options.images);
  writeDangerous(x, m);
  writeRequirements(x, m, options.preview);
  writeDocuments(x, 'AvailableDocuments', m.availableDocuments, options.preview);
  x.close('Content');
  x.close('Document');

  return x.toString();
}
