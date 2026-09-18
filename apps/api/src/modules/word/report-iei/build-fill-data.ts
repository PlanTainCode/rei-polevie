import type { ProgramIeiOrderFlags, ProgramIeiSection1Data } from '../../ai/ai.service';
import type { ReportIeiSection1AiData } from '../../ai/report-iei/section-1';
import { resolveProgramIeiLocation12 } from '../program-iei/precise-location';
import {
  buildEconomicDevelopmentText,
  buildNearbyText,
  buildReportCipher,
  formatInMonthYear,
  hasAgrochemistryInOrder,
  hasMedBuildingAndEroa,
  isLandscapingOnly,
  isMoscowAddress,
  isTemplateCgmsCertificateRef,
  isTemplatePreviousSurveyReport,
  mapProgramIeiLandscapeToReport,
  parseCgmsCertificateRef,
  shortenExcavationDepth,
} from './text';
import { normalizeExecutorNames } from './staff';
import {
  DEFAULT_REPORT_VOLUME,
  emptyReportIeiSection3Fields,
  NO_SOCIAL_INFRA_TEXT,
  type ReportIeiClimateValues,
  type ReportIeiFillData,
  type ReportIeiMoLandscape,
  type ReportIeiNativeLandscape,
  type ReportIeiOperatorData,
  type ReportIeiUrbanLandscape,
} from './types';

export function buildReportIeiFillData(params: {
  objectName: string;
  documentNumber?: string | null;
  objectAddress?: string | null;
  clientName?: string | null;
  clientAddress?: string | null;
  samplingDate?: Date | null;
  nearby?: {
    nearbyText?: string | null;
    nearbyNorth?: string | null;
    nearbyEast?: string | null;
    nearbySouth?: string | null;
    nearbyWest?: string | null;
  };
  openGroundPercent?: number | null;
  section1: ProgramIeiSection1Data | null;
  extras: ReportIeiSection1AiData | null;
  operator: ReportIeiOperatorData;
  orderFlags: ProgramIeiOrderFlags | null;
  /** Явный флаг из проб проекта (analysisCode ВХ / type WATER). */
  hasWaterSamples?: boolean;
  tzLandUseZone?: string;
  /** Текст поручения: МЭДзд + ЭРОА → абзац здания. */
  orderText?: string | null;
  hasFacadePhoto?: boolean;
  /** Для тестов: «сейчас» при авто камеральных / запасных полевых. */
  now?: Date;
  landscape?: string | null;
  urbanLandscape?: ReportIeiUrbanLandscape;
  moLandscape?: ReportIeiMoLandscape;
  hasIgiReport?: boolean;
  pollutionSourcesText?: string;
  hasVegetationPhoto?: boolean;
}): ReportIeiFillData {
  const { section1, extras, operator, orderFlags } = params;
  const objectName = String(params.objectName || '').trim();
  const urban = String(section1?.urbanPlanningActivity || '').trim();
  const surveyStage =
    String(section1?.surveyStage || '').trim() ||
    'Инженерные изыскания для подготовки проектной документации';

  const locationFromTz = resolveProgramIeiLocation12({
    objectName,
    objectLocation: section1?.objectLocation,
    projectAddress: params.objectAddress,
  });
  const nearbyText = buildNearbyText(params.nearby || {});

  const now = params.now ? new Date(params.now) : new Date();
  const samplingDate = params.samplingDate ? new Date(params.samplingDate) : null;
  const fieldWorkPeriod =
    String(operator.fieldWorkPeriod || '').trim() ||
    formatInMonthYear(samplingDate || now, true);
  const cameralWorkPeriod =
    String(operator.cameralWorkPeriod || '').trim() || formatInMonthYear(now, false);

  const hasBuildingSurvey =
    operator.hasBuildingSurvey === true ||
    hasMedBuildingAndEroa(params.orderText) ||
    orderFlags?.hasBuildingSurvey === true ||
    extras?.hasBuildingSurvey === true;

  const socialFromOperator = String(operator.socialInfrastructureText || '').trim();
  const socialFromAi = String(extras?.socialInfrastructureText || '').trim();
  let social = NO_SOCIAL_INFRA_TEXT;
  if (operator.noSocialInfrastructureNearby === true) {
    social = NO_SOCIAL_INFRA_TEXT;
  } else if (socialFromOperator) {
    social = socialFromOperator;
  } else if (socialFromAi) {
    social = socialFromAi;
  }

  return {
    objectName,
    surveyStage,
    urbanPlanningActivity: urban,
    clientName: String(section1?.clientName || params.clientName || '').trim(),
    clientOgrn: String(section1?.clientOgrn || '').trim(),
    clientAddress: String(section1?.clientAddress || params.clientAddress || '').trim(),
    clientInn: extras?.clientInn || undefined,
    fieldWorkPeriod,
    cameralWorkPeriod,
    previousObjectName: operator.previousObjectName,
    hasObjectRename: operator.hasObjectRename === true && !!operator.previousObjectName,
    isLandscapingOnly:
      operator.isLandscapingOnly === true ||
      extras?.isLandscapingOnly === true ||
      isLandscapingOnly(urban),
    isMoscow: isMoscowAddress(objectName, locationFromTz, params.objectAddress),
    hasWaterSamples: params.hasWaterSamples ?? hasWaterFromOrderFlags(orderFlags),
    hasBuildingSurvey,
    buildingDescription:
      operator.buildingDescription || extras?.buildingDescription || undefined,
    locationText: extras?.locationText || locationFromTz,
    nearbyText,
    socialInfrastructureText: social,
    waterObjectText: String(operator.waterObjectText || extras?.waterObjectText || '').trim(),
    landUseZone: String(
      operator.landUseZone || params.tzLandUseZone || extras?.landUseZone || '',
    ).trim(),
    openGroundPercent: params.openGroundPercent ?? null,
    technicalCharacteristics: String(section1?.technicalCharacteristics || '').trim(),
    siteArea: String(section1?.siteArea || '').trim(),
    excavationDepth: shortenExcavationDepth(section1?.excavationDepth || ''),
    siteFenceText: operator.siteFenceText || extras?.siteFenceText || undefined,
    volume: String(operator.volume || DEFAULT_REPORT_VOLUME).trim(),
    reportCipher: buildReportCipher(params.documentNumber || '', operator.reportCipher),
    year: String(new Date().getFullYear()),
    executorNames: normalizeExecutorNames(operator.executorNames),
    inventoryNumber: String(operator.inventoryNumber || '').trim(),
    hasFacadePhoto: params.hasFacadePhoto === true && hasBuildingSurvey,
    ...resolveSection2Certificate(operator, section1),
    ...resolveSection3Fields(params, nearbyText),
  };
}

function cleanFillText(value?: string | null): string {
  return String(value || '').trim();
}

function resolveSection3Fields(
  params: {
    operator: ReportIeiOperatorData;
    extras: ReportIeiSection1AiData | null;
    tzLandUseZone?: string;
    landscape?: string | null;
    urbanLandscape?: ReportIeiUrbanLandscape;
    moLandscape?: ReportIeiMoLandscape;
    hasIgiReport?: boolean;
    pollutionSourcesText?: string;
    hasVegetationPhoto?: boolean;
    orderText?: string | null;
  },
  nearbyText: string,
): ReturnType<typeof emptyReportIeiSection3Fields> {
  const { operator } = params;
  const landUseZone = cleanFillText(
    operator.landUseZone || params.tzLandUseZone || params.extras?.landUseZone,
  );
  const landscape =
    mapProgramIeiLandscapeToReport(operator.landscape) ||
    mapProgramIeiLandscapeToReport(params.landscape);
  const urbanLandscape = (operator.urbanLandscape || params.urbanLandscape || '') as ReportIeiUrbanLandscape;
  const moLandscape = (operator.moLandscape || params.moLandscape || '') as ReportIeiMoLandscape;
  const igiGeomorphologyText = cleanFillText(operator.igiGeomorphologyText);
  const igiGeologyText = cleanFillText(operator.igiGeologyText);
  const igiHydroText = cleanFillText(operator.igiHydroText);
  const igiSoilsText = cleanFillText(operator.igiSoilsText);

  return {
    ...emptyReportIeiSection3Fields(),
    landscape,
    urbanLandscape,
    moLandscape,
    economicDevelopmentText: buildEconomicDevelopmentText({
      nearbyText,
      landUseZone,
      override: operator.economicDevelopmentText,
    }),
    igiGeomorphologyText,
    igiGeologyText,
    igiHydroText,
    igiSoilsText,
    hasIgiReport:
      params.hasIgiReport === true ||
      Boolean(igiGeomorphologyText || igiGeologyText || igiHydroText || igiSoilsText),
    hasFertilityAssessment:
      operator.hasFertilityAssessment === true || hasAgrochemistryInOrder(params.orderText),
    fertilityText: cleanFillText(operator.fertilityText),
    geobotanyFromAct: cleanFillText(operator.geobotanyFromAct),
    woodyPlantingsText: cleanFillText(operator.woodyPlantingsText),
    hasVegetationPhoto: params.hasVegetationPhoto === true,
    faunaFromAct: cleanFillText(operator.faunaFromAct),
    moEcologyLetterText: cleanFillText(operator.moEcologyLetterText),
    hasOopt: operator.hasOopt === true,
    ooptName: cleanFillText(operator.ooptName),
    ooptText: cleanFillText(operator.ooptText),
    pollutionSourcesText: cleanFillText(
      operator.pollutionSourcesText || params.pollutionSourcesText,
    ),
  };
}

function resolveSection2Certificate(
  operator: ReportIeiOperatorData,
  section1: ProgramIeiSection1Data | null,
): Pick<
  ReportIeiFillData,
  | 'hasCgmsCertificate'
  | 'cgmsCertificateNumber'
  | 'cgmsCertificateDate'
  | 'weatherStation'
  | 'weatherStationPeriod'
  | 'climateValues'
  | 'previousSurveyReport'
> {
  const previousRaw = String(
    operator.previousSurveyReport || section1?.previousSurveyReport || '',
  ).trim();
  const previousSurveyReport = isTemplatePreviousSurveyReport(previousRaw) ? '' : previousRaw;

  if (operator.hasCgmsCertificate === false) {
    return {
      hasCgmsCertificate: false,
      cgmsCertificateNumber: '',
      cgmsCertificateDate: '',
      weatherStation: '',
      weatherStationPeriod: '',
      climateValues: null,
      previousSurveyReport,
    };
  }

  const operatorNumber = String(operator.cgmsCertificateNumber || '').trim();
  const operatorDate = String(operator.cgmsCertificateDate || '').trim();
  const fromOperatorRef = parseCgmsCertificateRef(operator.cgmsCertificateRef || '');
  const tzRefRaw = String(section1?.backgroundConcentrationsRef || '').trim();
  const fromTz = isTemplateCgmsCertificateRef(tzRefRaw)
    ? { number: '', date: '' }
    : parseCgmsCertificateRef(tzRefRaw);

  const number = operatorNumber || fromOperatorRef.number || fromTz.number;
  const date = operatorDate || fromOperatorRef.date || fromTz.date;
  const hasCgmsCertificate = Boolean(number || date);

  return {
    hasCgmsCertificate,
    cgmsCertificateNumber: number,
    cgmsCertificateDate: date,
    weatherStation: String(operator.weatherStation || '').trim(),
    weatherStationPeriod: String(operator.weatherStationPeriod || '').trim(),
    climateValues: normalizeClimateValues(operator.climateValues),
    previousSurveyReport,
  };
}

function normalizeClimateValues(
  raw?: ReportIeiClimateValues | null,
): ReportIeiClimateValues | null {
  if (!raw || typeof raw !== 'object') return null;
  const clean = (value?: string) => String(value || '').trim();
  const next: ReportIeiClimateValues = {
    atmosphereA: clean(raw.atmosphereA),
    reliefCoef: clean(raw.reliefCoef),
    maxTempHotMonth: clean(raw.maxTempHotMonth),
    meanTempColdMonth: clean(raw.meanTempColdMonth),
    windN: clean(raw.windN),
    windNe: clean(raw.windNe),
    windE: clean(raw.windE),
    windSe: clean(raw.windSe),
    windS: clean(raw.windS),
    windSw: clean(raw.windSw),
    windW: clean(raw.windW),
    windNw: clean(raw.windNw),
    windSpeed5: clean(raw.windSpeed5),
  };
  return Object.values(next).some(Boolean) ? next : null;
}

/** Те же признаки воды, что в программе ИЭИ §7.1 / §4. */
function hasWaterFromOrderFlags(orderFlags: ProgramIeiOrderFlags | null): boolean {
  return Boolean(
    orderFlags?.hasWaterSampling ||
      orderFlags?.hasSurfaceWater ||
      orderFlags?.hasGroundwater,
  );
}

function keepOrFill(current?: string, next?: string): string | undefined {
  const cur = String(current || '').trim();
  if (cur) return cur;
  const value = String(next || '').trim();
  return value || undefined;
}

/** После генерации дописываем пустые поля страницы значениями из ТЗ/AI. */
export function mergeReportIeiOperatorFromFill(
  operator: ReportIeiOperatorData,
  fill: ReportIeiFillData,
): ReportIeiOperatorData {
  return {
    ...operator,
    fieldWorkPeriod: keepOrFill(operator.fieldWorkPeriod, fill.fieldWorkPeriod),
    cameralWorkPeriod: keepOrFill(operator.cameralWorkPeriod, fill.cameralWorkPeriod),
    landUseZone: keepOrFill(operator.landUseZone, fill.landUseZone),
    waterObjectText: keepOrFill(operator.waterObjectText, fill.waterObjectText),
    siteFenceText: keepOrFill(operator.siteFenceText, fill.siteFenceText),
    buildingDescription: keepOrFill(operator.buildingDescription, fill.buildingDescription || ''),
    volume: keepOrFill(operator.volume, fill.volume),
    reportCipher: keepOrFill(operator.reportCipher, fill.reportCipher),
    inventoryNumber: keepOrFill(operator.inventoryNumber, fill.inventoryNumber),
    executorNames: normalizeExecutorNames(operator.executorNames ?? fill.executorNames),
    cgmsCertificateNumber:
      operator.hasCgmsCertificate === false
        ? keepOrFill(operator.cgmsCertificateNumber)
        : keepOrFill(operator.cgmsCertificateNumber, fill.cgmsCertificateNumber),
    cgmsCertificateDate:
      operator.hasCgmsCertificate === false
        ? keepOrFill(operator.cgmsCertificateDate)
        : keepOrFill(operator.cgmsCertificateDate, fill.cgmsCertificateDate),
    weatherStation:
      operator.hasCgmsCertificate === false
        ? keepOrFill(operator.weatherStation)
        : keepOrFill(operator.weatherStation, fill.weatherStation),
    weatherStationPeriod:
      operator.hasCgmsCertificate === false
        ? keepOrFill(operator.weatherStationPeriod)
        : keepOrFill(operator.weatherStationPeriod, fill.weatherStationPeriod),
    previousSurveyReport: keepOrFill(operator.previousSurveyReport, fill.previousSurveyReport),
    climateValues:
      operator.hasCgmsCertificate === false
        ? operator.climateValues
        : operator.climateValues || fill.climateValues || undefined,
    hasCgmsCertificate: operator.hasCgmsCertificate === false ? false : operator.hasCgmsCertificate,
    landscape: (operator.landscape || fill.landscape || undefined) as ReportIeiNativeLandscape | undefined,
    urbanLandscape: operator.urbanLandscape || fill.urbanLandscape || undefined,
    moLandscape: operator.moLandscape || fill.moLandscape || undefined,
    economicDevelopmentText: keepOrFill(
      operator.economicDevelopmentText,
      fill.economicDevelopmentText,
    ),
    igiGeomorphologyText: keepOrFill(operator.igiGeomorphologyText, fill.igiGeomorphologyText),
    igiGeologyText: keepOrFill(operator.igiGeologyText, fill.igiGeologyText),
    igiHydroText: keepOrFill(operator.igiHydroText, fill.igiHydroText),
    igiSoilsText: keepOrFill(operator.igiSoilsText, fill.igiSoilsText),
    fertilityText: keepOrFill(operator.fertilityText, fill.fertilityText),
    geobotanyFromAct: keepOrFill(operator.geobotanyFromAct, fill.geobotanyFromAct),
    woodyPlantingsText: keepOrFill(operator.woodyPlantingsText, fill.woodyPlantingsText),
    faunaFromAct: keepOrFill(operator.faunaFromAct, fill.faunaFromAct),
    moEcologyLetterText: keepOrFill(operator.moEcologyLetterText, fill.moEcologyLetterText),
    ooptName: keepOrFill(operator.ooptName, fill.ooptName),
    ooptText: keepOrFill(operator.ooptText, fill.ooptText),
    pollutionSourcesText: keepOrFill(operator.pollutionSourcesText, fill.pollutionSourcesText),
    hasFertilityAssessment: operator.hasFertilityAssessment ?? fill.hasFertilityAssessment,
    hasOopt: operator.hasOopt ?? fill.hasOopt,
  };
}
