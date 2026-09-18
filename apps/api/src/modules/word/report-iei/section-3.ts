import {
  removeParagraphIncludingMedia,
  removeParagraphKeepCell,
  removeParagraphOnly,
  removeTableContainingParagraph,
  replaceParagraphTextKeepFormatting,
} from './xml-text';
import { SECTION_3 } from './ids';
import {
  MO_CLIMATE_TEXT,
  MO_FAUNA_TEXT,
  MO_SOILS_INTRO_TEXT,
  MO_VEGETATION_TEXT,
  MOSCOW_CLIMATE_TEXT,
  MOSCOW_FAUNA_TEXT,
  MOSCOW_SOILS_INTRO_TEXT,
  MOSCOW_SOILS_SHARE_TEXT,
  MOSCOW_VEGETATION_TEXT,
  NO_OOPT_HEADING,
  NO_OOPT_TEXT,
  buildWeatherStationSentence,
} from './text';
import type { ReportIeiClimateValues, ReportIeiFillData } from './types';

function replace(xml: string, paraId: string, text: string): string {
  if (!text) return xml;
  return replaceParagraphTextKeepFormatting(xml, paraId, text);
}

function clear(xml: string, paraId: string): string {
  return replaceParagraphTextKeepFormatting(xml, paraId, '');
}

function keepOne<T extends Record<string, string>>(
  xml: string,
  ids: T,
  keep: keyof T | '',
): string {
  let out = xml;
  for (const [key, paraId] of Object.entries(ids)) {
    if (keep && key === keep) continue;
    out = removeParagraphOnly(out, paraId);
  }
  return out;
}

export function fillReportIeiSection3(xml: string, data: ReportIeiFillData): string {
  let out = fillClimate31(xml, data);
  out = fillLandscapes(out, data);
  out = fillEconomic(out, data);
  out = fillIgiGeologyHydro(out, data);
  out = fillSoils(out, data);
  out = fillVegetation(out, data);
  out = fillFauna(out, data);
  out = fillOopt(out, data);
  out = fillPollution(out, data);
  return out;
}

function fillClimate31(xml: string, data: ReportIeiFillData): string {
  let out = xml;

  if (data.isMoscow) {
    out = replace(out, SECTION_3.moscowClimate, MOSCOW_CLIMATE_TEXT);
    out = removeParagraphOnly(out, SECTION_3.moClimate);
    for (const paraId of SECTION_3.moClimateFollow) {
      out = removeParagraphOnly(out, paraId);
    }
  } else {
    out = replace(out, SECTION_3.moClimate, MO_CLIMATE_TEXT);
    out = removeParagraphOnly(out, SECTION_3.moscowClimate);
    for (const paraId of SECTION_3.moscowClimateFollow) {
      out = removeParagraphOnly(out, paraId);
    }
  }

  const station = data.weatherStation.trim();
  if (data.hasCgmsCertificate && station) {
    out = replace(
      out,
      SECTION_3.weatherStationFromCertificate,
      buildWeatherStationSentence(station, data.weatherStationPeriod),
    );
    out = removeParagraphOnly(out, SECTION_3.weatherStationAnalytical);
  } else {
    out = removeParagraphOnly(out, SECTION_3.weatherStationFromCertificate);
    out = removeParagraphOnly(out, SECTION_3.weatherStationAnalytical);
  }

  out = fillClimateNumbers(out, data.hasCgmsCertificate ? data.climateValues : null);

  if (!data.hasCgmsCertificate) {
    out = removeParagraphOnly(out, SECTION_3.climateAppendixNote);
  }

  return out;
}

function fillClimateNumbers(xml: string, values: ReportIeiClimateValues | null): string {
  let out = xml;
  const setOrClear = (paraId: string, value?: string) => {
    const text = String(value || '').trim();
    out = text ? replace(out, paraId, text) : clear(out, paraId);
  };

  setOrClear(SECTION_3.climateA, values?.atmosphereA);
  setOrClear(SECTION_3.climateRelief, values?.reliefCoef);
  setOrClear(SECTION_3.climateMaxTemp, values?.maxTempHotMonth);
  setOrClear(SECTION_3.climateColdTemp, values?.meanTempColdMonth);
  setOrClear(SECTION_3.climateWindSpeed5, values?.windSpeed5);

  const rose = [
    values?.windN,
    values?.windNe,
    values?.windE,
    values?.windSe,
    values?.windS,
    values?.windSw,
    values?.windW,
    values?.windNw,
  ];
  SECTION_3.climateWindRose.forEach((paraId, i) => setOrClear(paraId, rose[i]));
  return out;
}

function fillLandscapes(xml: string, data: ReportIeiFillData): string {
  let out = xml;

  if (data.isMoscow) {
    out = keepOne(out, SECTION_3.moscowNativeLandscapes, data.landscape);
    out = keepOne(out, SECTION_3.moLandscapes, '');
    out = keepOne(out, SECTION_3.urbanLandscapes, data.urbanLandscape);
    out = removeParagraphOnly(out, SECTION_3.moLandscapeFigureCaption);
  } else {
    out = keepOne(out, SECTION_3.moscowNativeLandscapes, '');
    out = keepOne(out, SECTION_3.moLandscapes, data.moLandscape);
    out = keepOne(out, SECTION_3.urbanLandscapes, '');
    out = removeParagraphOnly(out, SECTION_3.moscowLandscapeFigureCaption);
    out = removeParagraphOnly(out, SECTION_3.urbanLandscapeFigureCaption);
    if (data.moLandscape) {
      const kept = SECTION_3.moLandscapes[data.moLandscape];
      out = replace(
        out,
        kept,
        stripKeptMoLandscape(data.moLandscape),
      );
    }
  }

  return out;
}

function stripKeptMoLandscape(key: Exclude<ReportIeiFillData['moLandscape'], ''>): string {
  const labels: Record<Exclude<ReportIeiFillData['moLandscape'], ''>, string> = {
    APRELEVSKO_ODINTSOVSKAYA:
      'Участок изысканий относится к Апрелевско-Одинцовской равнине (см. Рисунок 3.2.1). Ландшафт представлен',
    PODOLSKO_KOLOMENSKOE:
      'Участок изысканий относится к Подольско-Коломенскому ополью (см. Рисунок 3.2.1). Ландшафт представлен',
    MOSKVORETSKO_PAKHRINSKAYA:
      'Участок изысканий относится к Москворецко-Пахринской равнине (см. Рисунок 3.2.1). Ландшафт представлен',
    PODMOSKOVNAYA_MESHCHERA:
      'Участок изысканий относится к Подмосковной Мещере (см. Рисунок 3.2.1). Ландшафт представлен',
    KLINSKO_DMITROVSKAYA:
      'Участок изысканий относится к Клинско-Дмитровской гряде (см. Рисунок 3.2.1). Ландшафт представлен',
  };
  return labels[key];
}

function fillEconomic(xml: string, data: ReportIeiFillData): string {
  const text = data.economicDevelopmentText.trim();
  if (text) return replace(xml, SECTION_3.economicDevelopment, text);
  return removeParagraphOnly(xml, SECTION_3.economicDevelopment);
}

function fillIgiGeologyHydro(xml: string, data: ReportIeiFillData): string {
  let out = xml;
  const geo = data.igiGeomorphologyText.trim();
  const geology = data.igiGeologyText.trim();
  const hydro = data.igiHydroText.trim();

  if (geo) {
    out = replace(out, SECTION_3.igiGeomorphology, geo);
  } else {
    out = removeParagraphOnly(out, SECTION_3.igiGeomorphology);
  }

  if (geology) {
    out = replace(out, SECTION_3.igiGeologyIntro, geology);
  } else {
    out = removeParagraphOnly(out, SECTION_3.igiGeologyIntro);
  }

  out = removeParagraphOnly(out, SECTION_3.igiComplexity);
  out = removeParagraphOnly(out, SECTION_3.igiSectionFigure);
  for (const paraId of SECTION_3.igiGeologyLayers) {
    out = removeParagraphOnly(out, paraId);
  }

  const surface = data.waterObjectText.trim();
  if (surface) {
    out = replace(out, SECTION_3.hydroSurfaceWater, surface);
  } else {
    out = removeParagraphOnly(out, SECTION_3.hydroSurfaceWater);
  }

  if (hydro) {
    out = replace(out, SECTION_3.igiGroundwaterLevel, hydro);
    out = removeParagraphOnly(out, SECTION_3.igiGroundwaterFollow);
  } else {
    out = removeParagraphOnly(out, SECTION_3.igiGroundwaterLevel);
    out = removeParagraphOnly(out, SECTION_3.igiGroundwaterFollow);
  }

  return out;
}

function fillSoils(xml: string, data: ReportIeiFillData): string {
  let out = xml;

  if (data.isMoscow) {
    out = replace(out, SECTION_3.moscowSoilsIntro, MOSCOW_SOILS_INTRO_TEXT);
    out = replace(out, SECTION_3.moscowSoilsShare, MOSCOW_SOILS_SHARE_TEXT);
    out = removeParagraphOnly(out, SECTION_3.moSoilsIntro);
    for (const paraId of SECTION_3.moSoilsFollow) {
      out = removeParagraphOnly(out, paraId);
    }
    out = removeParagraphKeepCell(out, SECTION_3.moSoilsFigureCaption);
  } else {
    out = replace(out, SECTION_3.moSoilsIntro, MO_SOILS_INTRO_TEXT);
    out = removeParagraphOnly(out, SECTION_3.moscowSoilsIntro);
    out = removeParagraphOnly(out, SECTION_3.moscowSoilsShare);
    out = removeParagraphKeepCell(out, SECTION_3.moscowSoilsFigureCaption);
  }

  const igiSoils = data.igiSoilsText.trim();
  if (igiSoils) {
    out = replace(out, SECTION_3.igiSoils, igiSoils);
  } else {
    out = removeParagraphOnly(out, SECTION_3.igiSoils);
  }

  const fertility = data.fertilityText.trim();
  if (data.hasFertilityAssessment && fertility) {
    out = replace(out, SECTION_3.fertilitySkip, fertility);
  } else {
    out = removeParagraphOnly(out, SECTION_3.fertilitySkip);
  }

  return out;
}

function fillVegetation(xml: string, data: ReportIeiFillData): string {
  let out = xml;
  out = removeParagraphOnly(out, SECTION_3.vegetationPhotoInstruction);

  const geobotany = data.geobotanyFromAct.trim();
  if (geobotany) {
    out = replace(out, SECTION_3.geobotanyFromAct, geobotany);
  } else {
    out = removeParagraphOnly(out, SECTION_3.geobotanyFromAct);
  }

  const woody = data.woodyPlantingsText.trim();
  if (woody) {
    out = replace(out, SECTION_3.woodyPlantings, woody);
  } else {
    out = removeParagraphOnly(out, SECTION_3.woodyPlantings);
  }

  for (const paraId of SECTION_3.vegetationTemplateExtra) {
    out = removeParagraphOnly(out, paraId);
  }

  if (data.hasVegetationPhoto) {
    out = replace(
      out,
      SECTION_3.vegetationTableCaption,
      'Таблица 3.1 – Характерная растительность участка обследования',
    );
  } else {
    out = removeParagraphOnly(out, SECTION_3.vegetationTableCaption);
    out = removeTableContainingParagraph(out, SECTION_3.vegetationPhotoTable);
  }

  if (data.isMoscow) {
    out = replace(out, SECTION_3.moscowVegetation, MOSCOW_VEGETATION_TEXT);
    out = removeParagraphOnly(out, SECTION_3.moVegetation);
  } else {
    out = replace(out, SECTION_3.moVegetation, MO_VEGETATION_TEXT);
    out = removeParagraphOnly(out, SECTION_3.moscowVegetation);
  }

  return out;
}

function fillFauna(xml: string, data: ReportIeiFillData): string {
  let out = xml;

  const fromAct = data.faunaFromAct.trim();
  if (fromAct) {
    out = replace(out, SECTION_3.faunaFromAct, fromAct);
  } else {
    out = removeParagraphOnly(out, SECTION_3.faunaFromAct);
  }

  if (data.isMoscow) {
    out = replace(out, SECTION_3.moscowFauna, MOSCOW_FAUNA_TEXT);
    out = removeParagraphOnly(out, SECTION_3.moEcologyLetter);
    out = removeParagraphOnly(out, SECTION_3.moFauna);
  } else {
    out = removeParagraphOnly(out, SECTION_3.moscowFauna);
    out = removeParagraphIncludingMedia(out, SECTION_3.faunaFigureImage);
    out = removeParagraphOnly(out, SECTION_3.faunaFigureCaption);
    const letter = data.moEcologyLetterText.trim();
    if (letter) {
      out = replace(out, SECTION_3.moEcologyLetter, letter);
    } else {
      out = removeParagraphOnly(out, SECTION_3.moEcologyLetter);
    }
    out = replace(out, SECTION_3.moFauna, MO_FAUNA_TEXT);
  }

  return out;
}

function fillOopt(xml: string, data: ReportIeiFillData): string {
  let out = xml;

  if (data.hasOopt) {
    const name = data.ooptName.trim();
    const heading = name
      ? (/^3\.8\b/.test(name) ? name : `3.8 ${name}`)
      : '3.8 Особо охраняемые природные территории';
    out = replace(out, SECTION_3.ooptHeading, heading);
    const body = data.ooptText.trim();
    if (body) {
      out = replace(out, SECTION_3.ooptBody[0], body);
      for (const paraId of SECTION_3.ooptBody.slice(1)) {
        out = removeParagraphOnly(out, paraId);
      }
    } else {
      for (const paraId of SECTION_3.ooptBody) {
        out = removeParagraphOnly(out, paraId);
      }
    }
    return out;
  }

  out = replace(out, SECTION_3.ooptHeading, NO_OOPT_HEADING);
  out = replace(out, SECTION_3.ooptBody[0], NO_OOPT_TEXT);
  for (const paraId of SECTION_3.ooptBody.slice(1)) {
    out = removeParagraphOnly(out, paraId);
  }
  return out;
}

function fillPollution(xml: string, data: ReportIeiFillData): string {
  let out = xml;
  const text = data.pollutionSourcesText.trim();
  if (text) {
    out = replace(out, SECTION_3.pollutionLead, text);
    for (const paraId of SECTION_3.pollutionExamples.slice(1)) {
      out = removeParagraphOnly(out, paraId);
    }
    return out;
  }
  for (const paraId of SECTION_3.pollutionExamples) {
    out = removeParagraphOnly(out, paraId);
  }
  return out;
}
