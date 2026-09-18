/**
 * Проверка модели задания перед сборкой XML.
 *
 * Повторяет обязательность и форматы из XSD (паттерны ИНН, ОГРН, кадастровых
 * номеров и т.д.), чтобы пользователь увидел проблемы в форме, а не после
 * отказа экспертизы. Строгая проверка по XSD 1.1 остаётся отдельным шагом.
 */

import {
  CONSTRUCTION_TYPES,
  DANGER_INDUSTRIAL_CLASSES,
  DANGEROUS_PROCESSES,
  DOCUMENT_TYPES,
  ENERGY_EFFICIENCY_CLASSES,
  FIRE_DANGER_CATEGORIES,
  FOUNDATION_MATERIALS,
  FOUNDATION_TYPES,
  OBJECT_STATUSES,
  REGION_CODES,
  RESPONSIBILITY_LEVELS,
  SCALES,
  SECTION_RELIEFS,
  SECURITY_LABELS,
  SPECIFIC_SOILS,
  SURVEY_STAGES,
  type DictItem,
} from './dictionaries';
import { isBlockEnabled } from './blocks';
import type {
  DocumentsInfo,
  Entrepreneur,
  Organization,
  Person,
  RussianAddress,
  TextBlock,
  TzXmlModel,
} from './model';

export interface ValidationIssue {
  blockId: string;
  path: string;
  message: string;
}

export const PATTERNS = {
  date: /^\d{4}-\d{2}-\d{2}$/,
  decimal: /^-?\d+([.,]\d+)?$/,
  integer: /^\d+$/,
  inn: /^\d{10}$/,
  innIp: /^\d{12}$/,
  kpp: /^\d{9}$/,
  ogrn: /^\d{13}$/,
  rafp: /^\d{11}$/,
  ogrnip: /^\d{15}$/,
  postIndex: /^\d{6}$/,
  oktmo: /^(\d{8}|\d{11})$/,
  noprizOrganization: /^((П|И)-[0-9]{3}-[0-9]{12}-[0-9]{4}|Не требуется)$/,
  cadastralDistrict: /^\d+:\d+:\d+$/,
  cadastralSite: /^\d+:\d+:\d+:\d+$/,
  functionsClassOks: /^[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,3}\.[0-9]{1,3}$/,
  cyrillicName: /^[а-яА-ЯёЁ\-\s]+$/,
  email: /^[a-zA-Zа-яА-Я0-9_.\-]+@[a-zA-Zа-яА-Я0-9_.\-]+\.[a-zA-Zа-яА-Я]{2,}$/,
  pilesCross: /^[0-9]{1,5}х[0-9]{1,5}$/,
  checksum: /^[0-9a-fA-F]{8}$/,
  fileFormat: /^\S{1,4}$/,
};

function filled(v: string | undefined | null): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

function inDict(dict: DictItem[], code: string | undefined): boolean {
  return !!code && dict.some((d) => d.code === code);
}

function textBlockFilled(tb: TextBlock | undefined): boolean {
  return !!tb && tb.paragraphs.some((p) => filled(p));
}

export function validateModel(model: TzXmlModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (blockId: string, path: string, message: string) => issues.push({ blockId, path, message });

  const checkAddress = (blockId: string, path: string, a: RussianAddress | undefined, postal = false) => {
    if (!a) return add(blockId, path, 'Адрес не заполнен');
    if (!inDict(REGION_CODES, a.regionCode)) add(blockId, `${path}.regionCode`, 'Укажите субъект РФ');
    if (postal) {
      if (!PATTERNS.postIndex.test(a.postIndex ?? '')) add(blockId, `${path}.postIndex`, 'Почтовый индекс: 6 цифр');
    } else if (filled(a.postIndex) && !PATTERNS.postIndex.test(a.postIndex!)) {
      add(blockId, `${path}.postIndex`, 'Почтовый индекс: 6 цифр');
    }
    if (!PATTERNS.oktmo.test(a.oktmoCode ?? '')) add(blockId, `${path}.oktmoCode`, 'Код ОКТМО: 8 или 11 цифр');
    if (!filled(a.oktmoName)) add(blockId, `${path}.oktmoName`, 'Укажите наименование муниципального образования');
    const structured = [a.district, a.city, a.settlement, a.street, a.building, a.room].some(filled);
    if (!structured && !filled(a.note)) {
      add(blockId, `${path}.note`, 'Адрес должен содержать хотя бы улицу/дом или неформализованное описание');
    }
  };

  const checkOrganization = (blockId: string, path: string, o: Organization | undefined, noprizRequired: boolean) => {
    if (!o) return add(blockId, path, 'Организация не заполнена');
    if (!filled(o.fullName)) add(blockId, `${path}.fullName`, 'Укажите полное наименование');
    const hasOgrn = filled(o.ogrn);
    const hasRafp = filled(o.rafp);
    if (!hasOgrn && !hasRafp) add(blockId, `${path}.ogrn`, 'Укажите ОГРН (13 цифр)');
    if (hasOgrn && !PATTERNS.ogrn.test(o.ogrn!)) add(blockId, `${path}.ogrn`, 'ОГРН: ровно 13 цифр');
    if (hasRafp && !PATTERNS.rafp.test(o.rafp!)) add(blockId, `${path}.rafp`, 'РАФП: ровно 11 цифр');
    if (!PATTERNS.inn.test(o.inn ?? '')) add(blockId, `${path}.inn`, 'ИНН юрлица: ровно 10 цифр');
    if (!PATTERNS.kpp.test(o.kpp ?? '')) add(blockId, `${path}.kpp`, 'КПП: ровно 9 цифр');
    if (filled(o.email) && !PATTERNS.email.test(o.email!)) add(blockId, `${path}.email`, 'Некорректный e-mail');
    if (noprizRequired) {
      if (!PATTERNS.noprizOrganization.test(o.noprizNumber ?? '')) {
        add(blockId, `${path}.noprizNumber`, 'Номер НОПРИЗ вида И-XXX-XXXXXXXXXXXX-XXXX или «Не требуется»');
      }
    } else if (filled(o.noprizNumber) && !PATTERNS.noprizOrganization.test(o.noprizNumber!)) {
      add(blockId, `${path}.noprizNumber`, 'Номер НОПРИЗ вида И-XXX-XXXXXXXXXXXX-XXXX или «Не требуется»');
    }
    checkAddress(blockId, `${path}.address`, o.address);
  };

  const checkFio = (blockId: string, path: string, p: { surname: string; name: string; patronymic?: string }) => {
    if (!filled(p.surname) || !PATTERNS.cyrillicName.test(p.surname)) add(blockId, `${path}.surname`, 'Фамилия кириллицей');
    if (!filled(p.name) || !PATTERNS.cyrillicName.test(p.name)) add(blockId, `${path}.name`, 'Имя кириллицей');
    if (filled(p.patronymic) && !PATTERNS.cyrillicName.test(p.patronymic!)) add(blockId, `${path}.patronymic`, 'Отчество кириллицей');
  };

  const checkPerson = (blockId: string, path: string, p: Person) => {
    checkFio(blockId, path, p);
    checkAddress(blockId, `${path}.postAddress`, p.postAddress, true);
    if (filled(p.email) && !PATTERNS.email.test(p.email!)) add(blockId, `${path}.email`, 'Некорректный e-mail');
  };

  const checkEntrepreneur = (blockId: string, path: string, e: Entrepreneur, noprizRequired: boolean) => {
    checkFio(blockId, path, e);
    if (!PATTERNS.ogrnip.test(e.ogrnip ?? '')) add(blockId, `${path}.ogrnip`, 'ОГРНИП: ровно 15 цифр');
    if (filled(e.inn) && !PATTERNS.innIp.test(e.inn!)) add(blockId, `${path}.inn`, 'ИНН ИП: ровно 12 цифр');
    checkAddress(blockId, `${path}.postAddress`, e.postAddress, true);
    if (noprizRequired && !PATTERNS.noprizOrganization.test(e.noprizNumber ?? '')) {
      add(blockId, `${path}.noprizNumber`, 'Номер НОПРИЗ вида И-XXX-XXXXXXXXXXXX-XXXX или «Не требуется»');
    }
  };

  const checkDocuments = (blockId: string, path: string, d: DocumentsInfo | undefined, required: boolean) => {
    if (!d || d.documents.length === 0) {
      if (required) add(blockId, path, 'Добавьте хотя бы один документ');
      return;
    }
    d.documents.forEach((doc, i) => {
      const p = `${path}.documents[${i}]`;
      if (!inDict(DOCUMENT_TYPES, doc.typeCode)) add(blockId, `${p}.typeCode`, 'Выберите вид документа');
      if (!filled(doc.name)) add(blockId, `${p}.name`, 'Укажите наименование документа');
      if (!filled(doc.number)) add(blockId, `${p}.number`, 'Укажите номер документа');
      if (!PATTERNS.date.test(doc.date ?? '')) add(blockId, `${p}.date`, 'Укажите дату документа');
      if (!filled(doc.authorNote)) add(blockId, `${p}.authorNote`, 'Укажите автора документа');
      if (doc.source === 'FILE') {
        if (doc.files.length === 0) add(blockId, `${p}.files`, 'Прикрепите файл документа');
        doc.files.forEach((f, j) => {
          if (!PATTERNS.checksum.test(f.checksum ?? '')) add(blockId, `${p}.files[${j}]`, 'У файла нет контрольной суммы');
          if (!PATTERNS.fileFormat.test(f.format ?? '')) add(blockId, `${p}.files[${j}]`, 'Формат файла: до 4 символов');
        });
      } else if (doc.source === 'WEBLINK') {
        if (!filled(doc.webLink)) add(blockId, `${p}.webLink`, 'Укажите ссылку на документ');
      } else if (!filled(doc.referenceToDocumentId)) {
        add(blockId, `${p}.referenceToDocumentId`, 'Укажите документ, в составе которого находится данный');
      }
    });
  };

  const checkTextBlock = (blockId: string, path: string, tb: TextBlock | undefined, label: string) => {
    if (!textBlockFilled(tb)) add(blockId, path, `Заполните «${label}»`);
  };

  const checkDecimal = (blockId: string, path: string, v: string | undefined, label: string, required = true) => {
    if (!filled(v)) {
      if (required) add(blockId, path, `Укажите «${label}»`);
      return;
    }
    if (!PATTERNS.decimal.test(v!.trim())) add(blockId, path, `«${label}»: число`);
  };

  // --- Реквизиты и утверждение ---------------------------------------------
  const r = model.requisites;
  if (!filled(r.number)) add('requisites', 'requisites.number', 'Укажите шифр задания');
  if (!PATTERNS.date.test(r.date ?? '')) add('requisites', 'requisites.date', 'Укажите дату составления');
  if (!inDict(SECURITY_LABELS, r.securityLabel)) add('requisites', 'requisites.securityLabel', 'Выберите гриф доступа');
  if (!r.versionNumber || r.versionNumber < 1) add('requisites', 'requisites.versionNumber', 'Номер версии от 1');

  checkOrganization('requisites', 'approver.organization', model.approver.organization, true);
  const reps = model.approver.representatives ?? [];
  if (reps.length === 0) add('requisites', 'approver.representatives', 'Добавьте подписанта');
  const approvers = reps.filter((x) => x.functionalRole === 'Утверждено').length;
  if (approvers !== 1) add('requisites', 'approver.representatives', 'Должен быть ровно один подписант с ролью «Утверждено»');
  reps.forEach((rep, i) => {
    const p = `approver.representatives[${i}]`;
    checkFio('requisites', p, rep);
    if (!filled(rep.position)) add('requisites', `${p}.position`, 'Укажите должность');
    if (filled(rep.email) && !PATTERNS.email.test(rep.email!)) add('requisites', `${p}.email`, 'Некорректный e-mail');
  });

  // --- Объект ---------------------------------------------------------------
  const o = model.object;
  if (!filled(o.name)) add('object', 'object.name', 'Укажите наименование объекта');
  if (!inDict(OBJECT_STATUSES, o.status)) add('object', 'object.status', 'Выберите статус объекта');
  checkAddress('object', 'object.placement.address', o.placement.address);
  o.placement.cadastralDistricts.forEach((c, i) => {
    if (!PATTERNS.cadastralDistrict.test(c)) add('object', `object.placement.cadastralDistricts[${i}]`, 'Кадастровый квартал вида XX:XX:XXXXXXX');
  });
  o.placement.cadastralSites.forEach((c, i) => {
    if (!PATTERNS.cadastralSite.test(c)) add('object', `object.placement.cadastralSites[${i}]`, 'Кадастровый номер вида XX:XX:XXXXXXX:XXX');
  });
  o.placement.areas.forEach((a, i) => {
    if (a.points.length < 3) add('object', `object.placement.areas[${i}]`, 'У участка должно быть не меньше трёх точек');
  });
  if (o.kind === 'AREAL_OKS') {
    const a = o.areal;
    const p = 'object.areal';
    if (!inDict(RESPONSIBILITY_LEVELS, a.responsibilityLevel)) add('object', `${p}.responsibilityLevel`, 'Выберите уровень ответственности');
    if (!PATTERNS.functionsClassOks.test(a.functionsClass ?? '')) add('object', `${p}.functionsClass`, 'Код классификатора ОКС вида xx.xx.xxx.xxx');
    if (!filled(a.functionsFeatures)) add('object', `${p}.functionsFeatures`, 'Укажите принадлежность к объектам транспортной инфраструктуры');
    if (filled(a.energyEfficiency) && !inDict(ENERGY_EFFICIENCY_CLASSES, a.energyEfficiency)) add('object', `${p}.energyEfficiency`, 'Выберите класс энергоэффективности');
    if (!inDict(DANGER_INDUSTRIAL_CLASSES, a.dangerousIndustrialObject)) add('object', `${p}.dangerousIndustrialObject`, 'Выберите класс опасности ОПО');
    if (!inDict(FIRE_DANGER_CATEGORIES, a.fireDangerCategory)) add('object', `${p}.fireDangerCategory`, 'Выберите категорию пожарной опасности');
    if (!filled(a.peoplePermanentStay)) add('object', `${p}.peoplePermanentStay`, 'Укажите наличие помещений с постоянным пребыванием людей');
    checkTextBlock('object', `${p}.designFeatures`, a.designFeatures, 'Конструктивные особенности');
    checkDecimal('object', `${p}.planSize.width`, a.planSize.width, 'Ширина в плане');
    checkDecimal('object', `${p}.planSize.length`, a.planSize.length, 'Длина в плане');
    checkDecimal('object', `${p}.planSize.height`, a.planSize.height, 'Высота в плане');
    checkDecimal('object', `${p}.overallHeight`, a.overallHeight, 'Общая высота');
    if (!PATTERNS.integer.test(a.numberFloors ?? '')) add('object', `${p}.numberFloors`, 'Количество этажей: целое число');
    checkDecimal('object', `${p}.approximateWeight`, a.approximateWeight, 'Ориентировочная масса');
    const f = a.foundation;
    if (f.types.length === 0 || !f.types.every((t) => inDict(FOUNDATION_TYPES, t))) add('object', `${p}.foundation.types`, 'Выберите тип фундамента');
    if (f.materials.length === 0 || !f.materials.every((m) => inDict(FOUNDATION_MATERIALS, m))) add('object', `${p}.foundation.materials`, 'Выберите материал фундамента');
    checkDecimal('object', `${p}.foundation.size`, f.size, 'Размер фундамента');
    checkDecimal('object', `${p}.foundation.depth`, f.depth, 'Глубина заложения фундамента');
    if (filled(f.pilesCross) && !PATTERNS.pilesCross.test(f.pilesCross!)) add('object', `${p}.foundation.pilesCross`, 'Сечение свай вида 300х300 (русская «х»)');
    checkDecimal('object', `${p}.foundation.load.pileLoad`, f.load.pileLoad, 'Нагрузка на сваю', false);
    checkDecimal('object', `${p}.foundation.load.stripLoad`, f.load.stripLoad, 'Нагрузка на ленту', false);
    checkDecimal('object', `${p}.foundation.load.soilLoad`, f.load.soilLoad, 'Нагрузка на грунты', false);
    if (a.foundationPit) {
      checkDecimal('object', `${p}.foundationPit.depth`, a.foundationPit.depth, 'Глубина котлована');
      if (!filled(a.foundationPit.fence)) add('object', `${p}.foundationPit.fence`, 'Укажите ограждение котлована');
    }
    checkDecimal('object', `${p}.earthworksDepth`, a.earthworksDepth, 'Глубина земляных работ', false);
    checkDecimal('object', `${p}.compressibleSoilThickness`, a.compressibleSoilThickness, 'Глубина сжимаемой толщи', false);
    checkDecimal('object', `${p}.basement`, a.basement, 'Глубина подвала', false);
    checkDecimal('object', `${p}.permissibleDraft`, a.permissibleDraft, 'Допустимая осадка', false);
  } else {
    const l = o.linear;
    const p = 'object.linear';
    checkDecimal('object', `${p}.length`, l.length, 'Протяжённость');
    if (!inDict(RESPONSIBILITY_LEVELS, l.responsibilityLevel)) add('object', `${p}.responsibilityLevel`, 'Выберите уровень ответственности');
    if (!PATTERNS.functionsClassOks.test(l.functionsClass ?? '')) add('object', `${p}.functionsClass`, 'Код классификатора ОКС вида xx.xx.xxx.xxx');
    const needFoundation = l.kind === 'LINE_POWER' || l.kind === 'BRIDGE';
    if (needFoundation) {
      if (l.foundationTypes.length === 0) add('object', `${p}.foundationTypes`, 'Выберите тип фундамента');
      if (l.foundationMaterials.length === 0) add('object', `${p}.foundationMaterials`, 'Выберите материал фундамента');
      checkDecimal('object', `${p}.foundationDepth`, l.foundationDepth, 'Глубина заложения фундамента');
    }
    if (l.kind === 'LINE_COMMUNICATION') {
      if (!filled(l.layingMethod)) add('object', `${p}.layingMethod`, 'Выберите способ прокладки');
      if (!filled(l.cableMaterial)) add('object', `${p}.cableMaterial`, 'Выберите материал кабеля');
      checkDecimal('object', `${p}.foundationDepth`, l.foundationDepth, 'Глубина заложения фундамента', false);
      checkDecimal('object', `${p}.cableDepth`, l.cableDepth, 'Глубина заложения кабеля', false);
    }
    if (l.kind === 'PIPELINE') {
      if (!filled(l.layingMethod)) add('object', `${p}.layingMethod`, 'Выберите способ прокладки');
      if (!filled(l.pipeMaterial)) add('object', `${p}.pipeMaterial`, 'Выберите материал трубы');
      checkDecimal('object', `${p}.pipeDepth`, l.pipeDepth, 'Глубина заложения трубы', false);
      checkDecimal('object', `${p}.pipeDiameter`, l.pipeDiameter, 'Диаметр труб', false);
      checkDecimal('object', `${p}.pressure`, l.pressure, 'Давление', false);
    }
    if (l.kind === 'AUTOMOBILE_ROAD' || l.kind === 'LINE_RAILWAY') {
      checkDecimal('object', `${p}.embankmentHeight`, l.embankmentHeight, 'Высота насыпи');
    }
    if (l.kind === 'LINE_RAILWAY' && !filled(l.sleepersMaterial)) add('object', `${p}.sleepersMaterial`, 'Выберите материал шпал');
  }
  if (o.siteKind === 'AREAL') {
    const s = o.arealSite;
    checkDecimal('object', 'object.arealSite.planSize.width', s.planSize.width, 'Ширина площадки');
    checkDecimal('object', 'object.arealSite.planSize.length', s.planSize.length, 'Длина площадки');
    if (!inDict(SCALES, s.shootingScale)) add('object', 'object.arealSite.shootingScale', 'Выберите масштаб съёмки');
    if (!inDict(SECTION_RELIEFS, s.sectionRelief)) add('object', 'object.arealSite.sectionRelief', 'Выберите сечение рельефа');
  } else {
    const s = o.linearSite;
    checkDecimal('object', 'object.linearSite.length', s.length, 'Протяжённость трассы');
    checkDecimal('object', 'object.linearSite.shootingWidth', s.shootingWidth, 'Ширина полосы съёмки');
    if (!inDict(SCALES, s.shootingScale)) add('object', 'object.linearSite.shootingScale', 'Выберите масштаб съёмки');
    if (!inDict(SCALES, s.scalePlanProfile)) add('object', 'object.linearSite.scalePlanProfile', 'Выберите масштаб плана профиля');
    if (!inDict(SECTION_RELIEFS, s.sectionRelief)) add('object', 'object.linearSite.sectionRelief', 'Выберите сечение рельефа');
  }

  // --- Основание, вид деятельности, этап -----------------------------------
  checkDocuments('initiationDocuments', 'initiationDocuments', model.initiationDocuments, true);
  if (!inDict(CONSTRUCTION_TYPES, model.constructionType)) add('construction', 'constructionType', 'Выберите вид градостроительной деятельности');
  if (!inDict(SURVEY_STAGES, model.stage)) add('construction', 'stage', 'Выберите этап выполнения изысканий');

  // --- Заказчик --------------------------------------------------------------
  if (model.customerKind === 'DEVELOPER') {
    if (model.developer.kind === 'ORGANIZATION') checkOrganization('customer', 'developer.organization', model.developer.organization, false);
    else checkPerson('customer', 'developer.person', model.developer.person);
  } else {
    checkOrganization('customer', 'technicalCustomer', model.technicalCustomer, true);
  }

  // --- Исполнители -------------------------------------------------------------
  if (isBlockEnabled('researchers', model.enabled)) {
    if (model.researchers.length === 0) add('researchers', 'researchers', 'Добавьте исполнителя или отключите блок');
    model.researchers.forEach((rs, i) => {
      const p = `researchers[${i}]`;
      if (rs.kind === 'ORGANIZATION') checkOrganization('researchers', `${p}.organization`, rs.organization, true);
      else checkEntrepreneur('researchers', `${p}.entrepreneur`, rs.entrepreneur, true);
      if (!filled(rs.contract.number)) add('researchers', `${p}.contract.number`, 'Укажите номер договора');
      if (!PATTERNS.date.test(rs.contract.date ?? '')) add('researchers', `${p}.contract.date`, 'Укажите дату договора');
      if (rs.contract.files.length === 0) add('researchers', `${p}.contract.files`, 'Прикрепите файл договора');
    });
  }

  // --- Цели и задачи -----------------------------------------------------------
  if (!model.purposes.some(filled)) add('purposes', 'purposes', 'Укажите хотя бы одну цель');
  if (!model.tasks.some(filled)) add('purposes', 'tasks', 'Укажите хотя бы одну задачу');

  // --- Виды изысканий ------------------------------------------------------------
  if (model.surveys.length === 0) add('surveys', 'surveys', 'Добавьте хотя бы один вид изысканий');
  model.surveys.forEach((s, i) => {
    const p = `surveys[${i}]`;
    if (s.kind === 'BASIC' && !['1', '2', '3', '4', '5'].includes(s.typeCode)) add('surveys', `${p}.typeCode`, 'Выберите основной вид изысканий');
    if (s.kind === 'SPECIAL' && !['6', '7', '8', '9', '10', '11'].includes(s.typeCode)) add('surveys', `${p}.typeCode`, 'Выберите специальный вид изысканий');
    if (s.kind === 'OTHER' && !s.otherNames.some(filled)) add('surveys', `${p}.otherNames`, 'Укажите наименование иного исследования');
    if (!s.purposes.some(filled)) add('surveys', `${p}.purposes`, 'Укажите цели вида изысканий');
    if (!s.tasks.some(filled)) add('surveys', `${p}.tasks`, 'Укажите задачи вида изысканий');
    s.authors.forEach((au, j) => {
      const ap = `${p}.authors[${j}]`;
      if (au.kind === 'ORGANIZATION') checkOrganization('surveys', `${ap}.organization`, au.organization, true);
      else checkEntrepreneur('surveys', `${ap}.entrepreneur`, au.entrepreneur, true);
    });
  });
  const seen = new Set<string>();
  model.surveys.forEach((s, i) => {
    if (s.kind === 'OTHER') return;
    const key = `${s.kind}:${s.typeCode}`;
    if (seen.has(key)) add('surveys', `surveys[${i}]`, 'Этот вид изысканий уже добавлен');
    seen.add(key);
  });

  // --- Техногенные воздействия, экология ------------------------------------------
  if (isBlockEnabled('technogenicImpacts', model.enabled)) {
    checkTextBlock('technogenicImpacts', 'technogenicImpacts', model.technogenicImpacts, 'Предполагаемые техногенные воздействия');
  }
  if (isBlockEnabled('ecology', model.enabled)) {
    const e = model.ecology;
    const any = [e.existingPollutionSources, e.plannedPollutionSources, e.possibleAccident, e.landWithdraw, e.waterSource, e.waterRelease].some(textBlockFilled);
    if (!any) add('ecology', 'ecology', 'Заполните хотя бы один подраздел или отключите блок');
  }

  // --- Границы -----------------------------------------------------------------
  const b = model.boundaries;
  if (b.images.length === 0) add('boundaries', 'boundaries.images', 'Добавьте изображение площадки или трассы');
  if (model.enabled.areas) {
    if (b.areas.length === 0) add('boundaries', 'boundaries.areas', 'Добавьте участок с координатами или отключите координаты');
    b.areas.forEach((a, i) => {
      if (a.points.length < 3) add('boundaries', `boundaries.areas[${i}]`, 'У участка должно быть не меньше трёх точек');
      a.points.forEach((pt, j) => {
        if (!PATTERNS.decimal.test(pt.x ?? '') || !PATTERNS.decimal.test(pt.y ?? '')) add('boundaries', `boundaries.areas[${i}].points[${j}]`, 'Координаты X и Y: числа');
      });
      if (!filled(a.coordinateSystem.name) || !filled(a.coordinateSystem.heightSystem)) add('boundaries', `boundaries.areas[${i}].coordinateSystem`, 'Укажите систему координат и высот');
    });
  }
  if (model.enabled.linearRoutes) {
    if (b.linearRoutes.length === 0) add('boundaries', 'boundaries.linearRoutes', 'Добавьте трассу или отключите маршруты');
    b.linearRoutes.forEach((rt, i) => {
      for (const [k, pt] of [['startPoint', rt.startPoint], ['finishPoint', rt.finishPoint]] as const) {
        if (!PATTERNS.decimal.test(pt.x ?? '') || !PATTERNS.decimal.test(pt.y ?? '')) add('boundaries', `boundaries.linearRoutes[${i}].${k}`, 'Координаты точки: числа');
      }
    });
  }

  // --- Опасные процессы ---------------------------------------------------------
  const d = model.dangerous;
  if (d.processes.length === 0 || !d.processes.every((c) => inDict(DANGEROUS_PROCESSES, c))) add('dangerous', 'dangerous.processes', 'Выберите хотя бы один опасный природный процесс');
  if (d.permafrost !== 'да' && d.permafrost !== 'нет') add('dangerous', 'dangerous.permafrost', 'Укажите наличие многолетнемёрзлых грунтов');
  if (!d.soils.every((c) => inDict(SPECIFIC_SOILS, c))) add('dangerous', 'dangerous.soils', 'Неверный код специфического грунта');

  // --- Требования ---------------------------------------------------------------
  const q = model.requirements;
  checkTextBlock('requirements', 'requirements.scientificSupport', q.scientificSupport, 'Научное сопровождение');
  checkTextBlock('requirements', 'requirements.accuracySecurity', q.accuracySecurity, 'Требования к точности');
  checkTextBlock('requirements', 'requirements.forecastChangesNaturalConditions', q.forecastChangesNaturalConditions, 'Прогноз изменения природных условий');
  if (isBlockEnabled('suggestionsRecommendation', model.enabled)) {
    checkTextBlock('requirements', 'requirements.suggestionsRecommendation', q.suggestionsRecommendation, 'Предложения и рекомендации по инженерной защите');
  }
  const cq = q.controlQuality;
  const hasInside = textBlockFilled(cq.inside);
  const outside = cq.outside;
  if (!hasInside && !outside) add('requirements', 'requirements.controlQuality', 'Опишите внутренний или внешний контроль качества');
  if (outside) {
    if (outside.by === 'ORGANIZATION') {
      if (outside.organizations.length === 0) add('requirements', 'requirements.controlQuality.outside.organizations', 'Добавьте организацию внешнего контроля');
      outside.organizations.forEach((og, i) => {
        const p = `requirements.controlQuality.outside.organizations[${i}]`;
        if (og.kind === 'ORGANIZATION') checkOrganization('requirements', `${p}.organization`, og.organization, false);
        else checkEntrepreneur('requirements', `${p}.entrepreneur`, og.entrepreneur, false);
        if (og.representatives.length === 0) add('requirements', `${p}.representatives`, 'Добавьте представителя');
        og.representatives.forEach((rp, j) => checkFio('requirements', `${p}.representatives[${j}]`, rp));
      });
    } else {
      if (outside.representatives.length === 0) add('requirements', 'requirements.controlQuality.outside.representatives', 'Добавьте представителя, обеспечивающего внешний контроль');
      outside.representatives.forEach((rp, j) => checkFio('requirements', `requirements.controlQuality.outside.representatives[${j}]`, rp));
    }
  }
  checkTextBlock('requirements', 'requirements.compositionOrderTransfer', q.compositionOrderTransfer, 'Состав и порядок передачи результатов');
  if (isBlockEnabled('archivalMaterials', model.enabled)) checkDocuments('requirements', 'requirements.archivalMaterials', q.archivalMaterials, true);
  if (isBlockEnabled('modelFormat', model.enabled)) checkTextBlock('requirements', 'requirements.modelFormat', q.modelFormat, 'Требования к информационной модели');
  if (isBlockEnabled('usedNorms', model.enabled) && !q.usedNorms.some(filled)) add('requirements', 'requirements.usedNorms', 'Укажите нормативные документы или отключите блок');

  // --- Прилагаемые документы --------------------------------------------------------
  checkDocuments('availableDocuments', 'availableDocuments', model.availableDocuments, true);

  return issues;
}

/** Количество проблем по блокам — для подсветки в списке блоков. */
export function issuesByBlock(issues: ValidationIssue[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of issues) out[i.blockId] = (out[i.blockId] ?? 0) + 1;
  return out;
}
