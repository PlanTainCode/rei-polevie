import {
  removeParagraphOnly,
  replaceParagraphTextKeepFormatting,
} from './xml-text';
import { SECTION_2 } from './ids';
import {
  MO_CLIMATE_TEXT,
  MO_SOURCES_TEXT,
  MOSCOW_CLIMATE_TEXT,
  MOSCOW_SOURCES_NO_CERT_TEXT,
  MOSCOW_SOURCES_WITH_CERT_TEXT,
  NO_CGMS_CLIMATE_TEXT,
  NO_PREVIOUS_IEI_TEXT,
  buildWeatherStationSentence,
  formatCgmsLetterNumber,
} from './text';
import type { ReportIeiClimateValues, ReportIeiFillData } from './types';

function replace(xml: string, paraId: string, text: string): string {
  if (!text) return xml;
  return replaceParagraphTextKeepFormatting(xml, paraId, text);
}

function clear(xml: string, paraId: string): string {
  return replaceParagraphTextKeepFormatting(xml, paraId, '');
}

export function fillReportIeiSection2(xml: string, data: ReportIeiFillData): string {
  let out = xml;

  const previous = data.previousSurveyReport.trim();
  if (previous) {
    out = replace(
      out,
      SECTION_2.previousIeiIntro,
      'На обследуемой территории выполнялись инженерно-экологические изыскания:',
    );
    out = replace(out, SECTION_2.previousIeiReport, previous);
    out = removeParagraphOnly(out, SECTION_2.noPreviousIei);
  } else {
    out = removeParagraphOnly(out, SECTION_2.previousIeiIntro);
    out = removeParagraphOnly(out, SECTION_2.previousIeiReport);
    out = removeParagraphOnly(out, SECTION_2.previousIeiExpired);
    out = replace(out, SECTION_2.noPreviousIei, NO_PREVIOUS_IEI_TEXT);
  }

  if (data.hasCgmsCertificate) {
    out = removeParagraphOnly(out, SECTION_2.noCgmsClimate);
    const number = formatCgmsLetterNumber(data.cgmsCertificateNumber);
    if (number) {
      out = replace(out, SECTION_2.cgmsLetterNumber, number);
    } else {
      out = clear(out, SECTION_2.cgmsLetterNumber);
    }
    if (data.cgmsCertificateDate.trim()) {
      out = replace(out, SECTION_2.cgmsLetterDate, data.cgmsCertificateDate.trim());
    } else {
      out = clear(out, SECTION_2.cgmsLetterDate);
    }
  } else {
    out = replace(out, SECTION_2.noCgmsClimate, NO_CGMS_CLIMATE_TEXT);
    out = clear(out, SECTION_2.cgmsLetterNumber);
    out = clear(out, SECTION_2.cgmsLetterDate);
  }

  if (data.isMoscow) {
    out = replace(
      out,
      SECTION_2.moscowSources,
      data.hasCgmsCertificate ? MOSCOW_SOURCES_WITH_CERT_TEXT : MOSCOW_SOURCES_NO_CERT_TEXT,
    );
    out = removeParagraphOnly(out, SECTION_2.moSources);
    out = replace(out, SECTION_2.moscowClimate, MOSCOW_CLIMATE_TEXT);
    out = removeParagraphOnly(out, SECTION_2.moClimate);
    for (const paraId of SECTION_2.moClimateFollow) {
      out = removeParagraphOnly(out, paraId);
    }
  } else {
    out = removeParagraphOnly(out, SECTION_2.moscowSources);
    out = replace(out, SECTION_2.moSources, MO_SOURCES_TEXT);
    out = replace(out, SECTION_2.moClimate, MO_CLIMATE_TEXT);
    out = removeParagraphOnly(out, SECTION_2.moscowClimate);
    for (const paraId of SECTION_2.moscowClimateFollow) {
      out = removeParagraphOnly(out, paraId);
    }
  }

  const station = data.weatherStation.trim();
  if (data.hasCgmsCertificate && station) {
    out = replace(
      out,
      SECTION_2.weatherStationFromCertificate,
      buildWeatherStationSentence(station, data.weatherStationPeriod),
    );
    out = removeParagraphOnly(out, SECTION_2.weatherStationAnalytical);
  } else {
    out = removeParagraphOnly(out, SECTION_2.weatherStationFromCertificate);
    out = removeParagraphOnly(out, SECTION_2.weatherStationAnalytical);
  }

  out = fillClimateNumbers(out, data.hasCgmsCertificate ? data.climateValues : null);

  if (!data.hasCgmsCertificate) {
    out = removeParagraphOnly(out, SECTION_2.climateAppendixNote);
  }

  return out;
}

function fillClimateNumbers(xml: string, values: ReportIeiClimateValues | null): string {
  let out = xml;
  const setOrClear = (paraId: string, value?: string) => {
    const text = String(value || '').trim();
    out = text ? replace(out, paraId, text) : clear(out, paraId);
  };

  setOrClear(SECTION_2.climateA, values?.atmosphereA);
  setOrClear(SECTION_2.climateRelief, values?.reliefCoef);
  setOrClear(SECTION_2.climateMaxTemp, values?.maxTempHotMonth);
  setOrClear(SECTION_2.climateColdTemp, values?.meanTempColdMonth);
  setOrClear(SECTION_2.climateWindSpeed5, values?.windSpeed5);

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
  SECTION_2.climateWindRose.forEach((paraId, i) => setOrClear(paraId, rose[i]));
  return out;
}
