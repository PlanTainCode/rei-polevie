/** Стабильные paraId после stamp-report-iei-paraids.ts */

export const TITLE = {
  objectName: 'CBFCA1EA',
  stageSubtitle: '9C2963CE',
  program71Note: '876F45A8',
  cipher: 'F88700FD',
  volume: 'F19B62BC',
  /** Пустой абзац под подписями титула — поле инв. номера, не sectPr. */
  inventoryNumber: '1C4B62FE',
} as const;

export const INTRO = {
  heading: '9721CFD4',
  objectSentence: '5430D606',
  renameSentence: '3588E8FA',
  urbanPlanning: '687DAEE8',
  surveyStage: '001DAB56',
  contract: 'B29F02BF',
} as const;

export const SECTION_11 = {
  dates: '9E028BF9',
} as const;

export const SECTION_12 = {
  techReglament384: '0D929590',
} as const;

export const SECTION_13 = {
  clientName: '9B2F0E3D',
  clientAddress: '10CE458C',
  clientInn: '7FC63B76',
  extraCustomerParaIds: [
    '85704353', '85083896', '44449F76', 'B381C756', 'F104042D',
    '1A12E9A0', '44971DCC', '55E35B55', '51A958D4', '74D5A80A',
    'BA30EA78', '85E4B0A1', 'D1CC4736', 'DF0EE10C', 'D29134C7',
    '1DF2E24A', 'AF337399', 'F988D969', '3DADDCB8', '309EC293',
    'AA9042CD', '8B06E33F', '71038D23', '1E01A5A0', '0262619F',
    '6CE54E71', '27DD4EFF', 'AB7B3111', '40C4C783', '7309999D',
    'CF97B129', 'B22AB3B9', '0598AB5A', '45C998CB', '2AF20FA1',
    '67E8B030', '92D5EE23', '09030313', 'E567E44C', '5037ED28',
    'EDE9F198', '501A32DA', 'FD1152B1', '822366E3', '9F1DA3EB',
  ],
} as const;

export const SECTION_16 = {
  heading: 'E3884D86',
  headerFio: 'AD6D80FC',
} as const;

export const CHAPTER_2 = {
  heading: '821A2864',
} as const;

/** §2 изученность + климат-ссылки (не §3.1 полевая погода). */
export const SECTION_2 = {
  previousIeiIntro: '9243C394',
  previousIeiReport: 'DBD8ABBE',
  previousIeiExpired: 'A1CC0DBA',
  igiMaterials: '1FF5394E',
  noPreviousIei: '4A75D61F',
  /** [88] нет справки ЦГМС */
  noCgmsClimate: '4C1703EC',
  certificatesIntro: 'AA5AF7CE',
  cgmsOrg: '9F3996AD',
  /** [89] номер письма ЦГМС */
  cgmsLetterNumber: '48808EC5',
  /** [89] дата письма ЦГМС */
  cgmsLetterDate: 'BD8B937A',
  /** [95] фондовые/климат-ссылки Москвы */
  moscowSources: '196CD4D1',
  /** [91] фондовые материалы МО */
  moSources: '5D610689',
  /** [95] климат Москвы */
  moscowClimate: '25CB87DB',
  moscowClimateFollow: ['B851C2A3', '8895C748', 'EAFABDA9', '304F37A9', 'A8404FE6'] as const,
  /** [96] климат МО */
  moClimate: 'AFBEB692',
  moClimateFollow: ['9320AA5A', '6DD5D349', 'CA7AA8FE', 'E33140D8'] as const,
  /** [97] метеостанция из справки фон-климат */
  weatherStationFromCertificate: '9B6A7969',
  weatherStationAnalytical: 'DDE705A5',
  climateAppendixNote: '403C9F6F',
  /** [98] числа климата из той же справки */
  climateA: '31896F5F',
  climateRelief: '7A19906A',
  climateMaxTemp: 'E7210B73',
  climateColdTemp: 'EE248B27',
  climateWindRose: [
    'F9FFC980',
    '71AA0B9A',
    'DB507887',
    '22A5460D',
    'B2CBC500',
    'C5E963F8',
    '902F5F54',
    '936D4EBC',
  ] as const,
  climateWindSpeed5: 'C521C975',
} as const;

export const SECTION_15_MOSCOW_LAB = {
  name: 'F159845D',
  number: 'DEBFD144',
  url: '3858C0DE',
} as const;

export const SECTION_17 = {
  technicalCharacteristics: 'F40698D2',
  siteArea: '41D3F8E5',
  excavationDepth: 'C7C1CB7A',
  location: 'F650F596',
  nearby: '0913ED37',
  socialInfra: 'C45D1800',
  waterObject: 'D5E84D14',
  landUseZone: '4404896E',
  building: 'A226C686',
  openGround: '07D5F40F',
  fence: 'B5064F27',
  figure11: 'FCF69D89',
  figure12: '9774380E',
  figure13: 'FD627B8D',
  figure13Image: 'CC2C6422',
} as const;

/** §3 природные и антропогенные условия. Климат 3.1 — те же paraId, что SECTION_2 [95]–[98]. */
export const SECTION_3 = {
  heading: 'FA0450AA',
  climateHeading: '964B2809',
  moscowClimate: SECTION_2.moscowClimate,
  moscowClimateFollow: SECTION_2.moscowClimateFollow,
  moClimate: SECTION_2.moClimate,
  moClimateFollow: SECTION_2.moClimateFollow,
  weatherStationFromCertificate: SECTION_2.weatherStationFromCertificate,
  weatherStationAnalytical: SECTION_2.weatherStationAnalytical,
  climateAppendixNote: SECTION_2.climateAppendixNote,
  climateA: SECTION_2.climateA,
  climateRelief: SECTION_2.climateRelief,
  climateMaxTemp: SECTION_2.climateMaxTemp,
  climateColdTemp: SECTION_2.climateColdTemp,
  climateWindRose: SECTION_2.climateWindRose,
  climateWindSpeed5: SECTION_2.climateWindSpeed5,
  landscapeHeading: 'C54C12FE',
  /** [105] коренные ландшафты Москвы — список как в программе ИЭИ */
  moscowNativeLandscapes: {
    HIMKI: '28C56376',
    MOSKVORETSKO_GRAYVORONSKIY: '020B03C7',
    MOSKVORETSKO_SKHODNENSKIY: 'F4E740AB',
    TSARITSYNSKIY: 'C18148A2',
    KUNTSEVSKIY: '7CBA9F4B',
  } as const,
  /** [106] ландшафты МО */
  moLandscapes: {
    APRELEVSKO_ODINTSOVSKAYA: '65134930',
    PODOLSKO_KOLOMENSKOE: '66BFB243',
    MOSKVORETSKO_PAKHRINSKAYA: '171A5177',
    PODMOSKOVNAYA_MESHCHERA: '6564E7C2',
    KLINSKO_DMITROVSKAYA: '7FBB3DAF',
  } as const,
  moscowLandscapeFigureCaption: '90CECB50',
  moLandscapeFigureCaption: 'D57786BC',
  economicHeading: 'D13F4584',
  /** 3.3 хозосвоение */
  economicDevelopment: 'F4910D6E',
  /** [109] городские ландшафты */
  urbanLandscapes: {
    RIGHT_BANK_ELEVATED: '7030D2D8',
    LEFT_BANK_PLAIN: 'E017E7BD',
    VALLEY_SANDR: 'BB83C1F7',
    CENTRAL: '2DDBD468',
  } as const,
  urbanLandscapeFigureCaption: '0F8272E9',
  geomorphologyHeading: '56BD0F56',
  /** [111] геоморфология / геология из отчёта ИГИ */
  igiGeomorphology: '4300D64B',
  igiComplexity: 'A28EF9C6',
  igiSectionFigure: '8069CF3D',
  igiGeologyIntro: 'C046027A',
  igiGeologyLayers: [
    '1D711CFC',
    '9F904873',
    '88985D64',
    '6DF65F60',
    '1C265542',
    'FFAAC970',
    '7448B540',
  ] as const,
  hydroHeading: 'ED04B645',
  hydroSurfaceWater: '50CDAE19',
  igiGroundwaterLevel: 'B68F14D9',
  igiGroundwaterFollow: '0B8E78EF',
  soilsHeading: 'F99C3B07',
  /** [114] почвы Москвы */
  moscowSoilsIntro: 'B249E992',
  moscowSoilsShare: '861BEB34',
  moscowSoilsFigureCaption: '86AF5006',
  /** [117] почвы/насыпные из ИГИ */
  igiSoils: '908776D2',
  /** [116] плодородие — убрать, если не делаем */
  fertilitySkip: '0EB08FF5',
  /** [118] почвы МО */
  moSoilsIntro: '1544FEE0',
  moSoilsFollow: ['0AA250B1', 'C8935453', '33649DE6', '26B3A172', 'A29A5040'] as const,
  moSoilsFigureCaption: '0C551EE5',
  vegetationHeading: '9BC2D389',
  /** [122] геоботаника из акта */
  geobotanyFromAct: '75FE2C7E',
  vegetationPhotoInstruction: 'E6D4A327',
  /** [123] поле — древесные насаждения */
  woodyPlantings: '82F36C38',
  vegetationTemplateExtra: ['2EAAFB12', '4FCCC5AC', 'FCA25AAD', '07D3C42F'] as const,
  vegetationTableCaption: '2C0FD8BD',
  /** [126] якорь таблицы фото растительности */
  vegetationPhotoTable: '7E0DBDFC',
  /** [124] растительность Москвы */
  moscowVegetation: '49516C11',
  /** [125] растительность МО */
  moVegetation: 'A2AB4C34',
  faunaHeading: '1E2809AA',
  /** [129] фауна из акта */
  faunaFromAct: 'D99B2023',
  /** [128] фауна Москвы */
  moscowFauna: '2DB7CAB7',
  faunaFigureImage: 'E4AC6C3D',
  faunaFigureCaption: 'D1FCAE21',
  /** [131] письмо Минэкологии МО */
  moEcologyLetter: 'BA7C38BC',
  moFauna: 'E3C0CF5F',
  /** [134] ООПТ */
  ooptHeading: '839B52DD',
  ooptBody: [
    '73C2BEB6',
    'FAACAA21',
    '7C946AC7',
    'B15B8319',
    '0914A0B9',
    'C403911E',
    '0F639AA9',
    '2ABC696C',
    'C858360A',
    '48246265',
    '88345600',
    '92D4C0BB',
  ] as const,
  pollutionHeading: '47915742',
  /** [137] источники загрязнения — поле */
  pollutionExamples: ['E15A8F2F', '21278DDE', '81A2AF88', 'C4B5D54E'] as const,
  pollutionLead: 'E15A8F2F',
} as const;

export const TOC_CIPHER = '760700AC';

export const TEMPLATE_CIPHER = '52015-20-01-77-ИЭИ';
