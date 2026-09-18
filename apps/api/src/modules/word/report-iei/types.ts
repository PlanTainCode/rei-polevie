export interface ReportIeiOperatorData {
  fieldWorkPeriod?: string;
  cameralWorkPeriod?: string;
  previousObjectName?: string;
  hasObjectRename?: boolean;
  isLandscapingOnly?: boolean;
  hasBuildingSurvey?: boolean;
  buildingDescription?: string;
  socialInfrastructureText?: string;
  noSocialInfrastructureNearby?: boolean;
  waterObjectText?: string;
  landUseZone?: string;
  volume?: string;
  reportCipher?: string;
  siteFenceText?: string;
  /** ФИО из списка шаблона §1.6. Пустой массив — убрать шаблонные строки. */
  executorNames?: string[];
  inventoryNumber?: string;
  /** false — принудительно нет справки ЦГМС [88]. undefined — авто из номера/даты/ТЗ. */
  hasCgmsCertificate?: boolean;
  /** Справка ЦГМС фон-климат: «№ … от …» или по частям. */
  cgmsCertificateRef?: string;
  cgmsCertificateNumber?: string;
  cgmsCertificateDate?: string;
  weatherStation?: string;
  weatherStationPeriod?: string;
  climateValues?: ReportIeiClimateValues;
  previousSurveyReport?: string;
  landscape?: ReportIeiNativeLandscape;
  urbanLandscape?: ReportIeiUrbanLandscape;
  moLandscape?: ReportIeiMoLandscape;
  economicDevelopmentText?: string;
  igiGeomorphologyText?: string;
  igiGeologyText?: string;
  igiHydroText?: string;
  igiSoilsText?: string;
  hasFertilityAssessment?: boolean;
  fertilityText?: string;
  geobotanyFromAct?: string;
  woodyPlantingsText?: string;
  faunaFromAct?: string;
  moEcologyLetterText?: string;
  hasOopt?: boolean;
  ooptName?: string;
  ooptText?: string;
  pollutionSourcesText?: string;
}

export interface ReportIeiClimateValues {
  atmosphereA?: string;
  reliefCoef?: string;
  maxTempHotMonth?: string;
  meanTempColdMonth?: string;
  windN?: string;
  windNe?: string;
  windE?: string;
  windSe?: string;
  windS?: string;
  windSw?: string;
  windW?: string;
  windNw?: string;
  windSpeed5?: string;
}

export interface ReportIeiFillData {
  objectName: string;
  surveyStage: string;
  urbanPlanningActivity: string;
  clientName: string;
  clientOgrn: string;
  clientAddress: string;
  clientInn?: string;
  fieldWorkPeriod: string;
  cameralWorkPeriod: string;
  previousObjectName?: string;
  hasObjectRename: boolean;
  isLandscapingOnly: boolean;
  isMoscow: boolean;
  /** Пробы воды (ВХ) или вода в поручении — как в программе ИЭИ. */
  hasWaterSamples: boolean;
  hasBuildingSurvey: boolean;
  buildingDescription?: string;
  locationText: string;
  nearbyText: string;
  socialInfrastructureText: string;
  waterObjectText: string;
  landUseZone: string;
  openGroundPercent: number | null;
  technicalCharacteristics: string;
  siteArea: string;
  excavationDepth: string;
  siteFenceText?: string;
  volume: string;
  reportCipher: string;
  year: string;
  executorNames: string[];
  inventoryNumber: string;
  hasFacadePhoto: boolean;
  hasCgmsCertificate: boolean;
  cgmsCertificateNumber: string;
  cgmsCertificateDate: string;
  weatherStation: string;
  weatherStationPeriod: string;
  climateValues: ReportIeiClimateValues | null;
  previousSurveyReport: string;
  landscape: ReportIeiNativeLandscape;
  urbanLandscape: ReportIeiUrbanLandscape;
  moLandscape: ReportIeiMoLandscape;
  economicDevelopmentText: string;
  igiGeomorphologyText: string;
  igiGeologyText: string;
  igiHydroText: string;
  igiSoilsText: string;
  hasIgiReport: boolean;
  hasFertilityAssessment: boolean;
  fertilityText: string;
  geobotanyFromAct: string;
  woodyPlantingsText: string;
  hasVegetationPhoto: boolean;
  faunaFromAct: string;
  moEcologyLetterText: string;
  hasOopt: boolean;
  ooptName: string;
  ooptText: string;
  pollutionSourcesText: string;
}

export type ReportIeiNativeLandscape =
  | 'HIMKI'
  | 'MOSKVORETSKO_GRAYVORONSKIY'
  | 'MOSKVORETSKO_SKHODNENSKIY'
  | 'TSARITSYNSKIY'
  | 'KUNTSEVSKIY'
  | '';

export type ReportIeiMoLandscape =
  | 'APRELEVSKO_ODINTSOVSKAYA'
  | 'PODOLSKO_KOLOMENSKOE'
  | 'MOSKVORETSKO_PAKHRINSKAYA'
  | 'PODMOSKOVNAYA_MESHCHERA'
  | 'KLINSKO_DMITROVSKAYA'
  | '';

export type ReportIeiUrbanLandscape =
  | 'RIGHT_BANK_ELEVATED'
  | 'LEFT_BANK_PLAIN'
  | 'VALLEY_SANDR'
  | 'CENTRAL'
  | '';

export function emptyReportIeiSection3Fields(): Pick<
  ReportIeiFillData,
  | 'landscape'
  | 'urbanLandscape'
  | 'moLandscape'
  | 'economicDevelopmentText'
  | 'igiGeomorphologyText'
  | 'igiGeologyText'
  | 'igiHydroText'
  | 'igiSoilsText'
  | 'hasIgiReport'
  | 'hasFertilityAssessment'
  | 'fertilityText'
  | 'geobotanyFromAct'
  | 'woodyPlantingsText'
  | 'hasVegetationPhoto'
  | 'faunaFromAct'
  | 'moEcologyLetterText'
  | 'hasOopt'
  | 'ooptName'
  | 'ooptText'
  | 'pollutionSourcesText'
> {
  return {
    landscape: '',
    urbanLandscape: '',
    moLandscape: '',
    economicDevelopmentText: '',
    igiGeomorphologyText: '',
    igiGeologyText: '',
    igiHydroText: '',
    igiSoilsText: '',
    hasIgiReport: false,
    hasFertilityAssessment: false,
    fertilityText: '',
    geobotanyFromAct: '',
    woodyPlantingsText: '',
    hasVegetationPhoto: false,
    faunaFromAct: '',
    moEcologyLetterText: '',
    hasOopt: false,
    ooptName: '',
    ooptText: '',
    pollutionSourcesText: '',
  };
}

export const NO_SOCIAL_INFRA_TEXT =
  'Детские сады, поликлиники, больницы и площадки отдыха в непосредственной близости от границ проектируемого объекта отсутствуют.';

export const DEFAULT_REPORT_VOLUME = 'Том 1.3.1';
