import {
  removeParagraphKeepCell,
  removeParagraphOnly,
  removeParagraphOrContainingRow,
  replaceParagraphTextKeepFormatting,
} from './xml-text';
import {
  INTRO,
  SECTION_11,
  SECTION_12,
  SECTION_13,
  SECTION_15_MOSCOW_LAB,
  SECTION_17,
} from './ids';
import {
  buildContractSentence,
  buildDatesSentence,
  buildIntroObjectSentence,
  buildLocationSentence,
  buildOpenGroundText,
  buildRenameSentence,
  buildSiteAreaText,
  buildSurveyStageSentence,
  buildUrbanPlanningSentence,
  clean384Text,
} from './text';
import { normalizeExecutorNames, REPORT_IEI_STAFF } from './staff';
import { NO_SOCIAL_INFRA_TEXT, type ReportIeiFillData } from './types';

/** Уже в шаблонном абзаце B5064F27 вместе с забором — не выдумываем. */
const SITE_RELIEF_TEXT =
  'Рельеф участка выровненный, искусственно спланированный (см. Рисунок 1.4).';

function replace(xml: string, paraId: string, text: string): string {
  if (!text) return xml;
  return replaceParagraphTextKeepFormatting(xml, paraId, text);
}

export function fillReportIeiSection1(xml: string, data: ReportIeiFillData): string {
  let out = xml;

  out = replace(out, INTRO.objectSentence, buildIntroObjectSentence(data.objectName));
  if (data.hasObjectRename && data.previousObjectName) {
    out = replace(
      out,
      INTRO.renameSentence,
      buildRenameSentence(data.previousObjectName, data.objectName),
    );
  } else {
    out = removeParagraphOnly(out, INTRO.renameSentence);
  }
  out = replace(out, INTRO.urbanPlanning, buildUrbanPlanningSentence(data.urbanPlanningActivity));
  out = replace(out, INTRO.surveyStage, buildSurveyStageSentence(data.surveyStage));
  out = replace(out, INTRO.contract, buildContractSentence(data.clientName));

  out = replace(
    out,
    SECTION_11.dates,
    buildDatesSentence(data.fieldWorkPeriod, data.cameralWorkPeriod),
  );

  if (data.isLandscapingOnly) {
    out = removeParagraphOnly(out, SECTION_12.techReglament384);
  } else {
    out = replace(out, SECTION_12.techReglament384, clean384Text());
  }

  out = replace(out, SECTION_13.clientName, buildClientLine(data));
  if (data.clientAddress) {
    out = replace(out, SECTION_13.clientAddress, data.clientAddress);
  }
  if (data.clientInn) {
    out = replace(out, SECTION_13.clientInn, data.clientInn);
  } else {
    out = replaceParagraphTextKeepFormatting(out, SECTION_13.clientInn, '');
  }
  for (const paraId of SECTION_13.extraCustomerParaIds) {
    out = removeParagraphKeepCell(out, paraId);
  }

  if (!data.isMoscow || !data.hasWaterSamples) {
    out = removeParagraphOrContainingRow(out, SECTION_15_MOSCOW_LAB.name);
    out = removeParagraphOrContainingRow(out, SECTION_15_MOSCOW_LAB.number);
    out = removeParagraphOrContainingRow(out, SECTION_15_MOSCOW_LAB.url);
  }

  if (data.technicalCharacteristics) {
    out = replace(out, SECTION_17.technicalCharacteristics, data.technicalCharacteristics);
  } else {
    out = replaceParagraphTextKeepFormatting(out, SECTION_17.technicalCharacteristics, '');
  }
  out = replace(out, SECTION_17.siteArea, buildSiteAreaText(data.siteArea));
  if (data.excavationDepth) {
    out = replace(out, SECTION_17.excavationDepth, data.excavationDepth);
  }
  out = replace(out, SECTION_17.location, buildLocationSentence(data.locationText));

  if (data.nearbyText) {
    out = replace(out, SECTION_17.nearby, data.nearbyText);
  } else {
    out = removeParagraphOnly(out, SECTION_17.nearby);
  }

  const social = data.socialInfrastructureText.trim() || NO_SOCIAL_INFRA_TEXT;
  out = replace(out, SECTION_17.socialInfra, social);

  if (data.waterObjectText.trim()) {
    out = replace(out, SECTION_17.waterObject, data.waterObjectText.trim());
  } else {
    out = removeParagraphOnly(out, SECTION_17.waterObject);
  }

  if (data.landUseZone.trim()) {
    out = replace(
      out,
      SECTION_17.landUseZone,
      `Территория изысканий расположена в ${data.landUseZone.trim().replace(/^в\s+/i, '')}.`,
    );
  } else {
    out = removeParagraphOnly(out, SECTION_17.landUseZone);
  }

  if (data.hasBuildingSurvey && data.buildingDescription) {
    out = replace(out, SECTION_17.building, data.buildingDescription.trim());
  } else {
    out = removeParagraphOnly(out, SECTION_17.building);
  }

  out = replace(
    out,
    SECTION_17.openGround,
    buildOpenGroundText(data.openGroundPercent, data.hasBuildingSurvey),
  );

  const fence = data.siteFenceText?.trim() || '';
  if (fence) {
    out = replace(out, SECTION_17.fence, `${SITE_RELIEF_TEXT} ${fence}`);
  } else {
    out = replace(out, SECTION_17.fence, SITE_RELIEF_TEXT);
  }

  out = replace(
    out,
    SECTION_17.figure11,
    'Рисунок 1.1 − Схема расположения территории изысканий',
  );
  out = replace(out, SECTION_17.figure12, 'Рисунок 1.2 − Схема территории изысканий');

  if (data.hasFacadePhoto) {
    out = replace(out, SECTION_17.figure13, 'Рисунок 1.3 – Фасад обследуемого здания');
  } else {
    out = removeParagraphOnly(out, SECTION_17.figure13);
    out = removeParagraphOnly(out, SECTION_17.figure13Image);
  }

  out = fillReportIeiExecutors(out, data.executorNames);

  return out;
}

function fillReportIeiExecutors(xml: string, names: string[] | undefined): string {
  const selected = new Set(normalizeExecutorNames(names));
  let out = xml;
  for (const person of REPORT_IEI_STAFF) {
    if (!selected.has(person.name)) {
      out = removeParagraphOrContainingRow(out, person.nameId);
    }
  }
  return out;
}

function buildClientLine(data: ReportIeiFillData): string {
  const name = data.clientName.trim();
  const ogrn = data.clientOgrn.replace(/^\s*ОГРН\s*/i, '').trim();
  if (name && ogrn) return `${name}, ОГРН ${ogrn}`;
  return name;
}
