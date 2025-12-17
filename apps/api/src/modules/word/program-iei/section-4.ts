import type {
  ProgramIeiOrderFlags,
  ProgramIeiSection1Data,
  ProgramIeiSection31Data,
} from '../../ai/ai.service';

import {
  removeParagraphByParaId,
  replaceParagraphTextByParaId,
} from './docx-xml';

const isMoscowByAddress = (address: string): boolean => {
  const a = String(address || '').toLowerCase();
  if (!a) return false;
  if (a.includes('московская область') || a.includes('моск. обл') || a.includes('мо,')) return false;
  return a.includes('москва') || a.includes('г.москва') || a.includes('г. москва');
};

const buildIlcWorksSentence = (flags: {
  hasAirSampling: boolean;
  hasPhysicalImpacts: boolean;
}): string => {
  const parts: string[] = [];
  parts.push('Радиационное обследование');
  if (flags.hasAirSampling) parts.push('отбор проб атмосферного воздуха');
  if (flags.hasPhysicalImpacts) {
    parts.push('измерения параметров шума, вибрации и электромагнитных полей');
  }

  const verb = parts.length === 1 ? 'проводится' : 'проводятся';
  return `${parts.join(', ')} ${verb} специалистами ИЛЦ ООО «ГК РЭИ» в соответствии с нормативной документацией согласно области аккредитации.`;
};

const flagsFromProjectServices = (project: any): Partial<ProgramIeiOrderFlags> => {
  const services = Array.isArray(project?.services) ? project.services : [];

  const hasWaterSampling = services.some(
    (s: any) => s?.row === 28 || s?.row === 30 || String(s?.name || '').toLowerCase().includes('вод'),
  );

  const hasSedimentSampling = services.some(
    (s: any) => s?.row === 29 || String(s?.name || '').toLowerCase().includes('донн'),
  );

  const hasAirSampling = services.some(
    (s: any) => s?.row === 33 || String(s?.name || '').toLowerCase().includes('атмосфер') || String(s?.name || '').toLowerCase().includes('воздух'),
  );

  const hasPhysicalImpacts = services.some(
    (s: any) => String(s?.name || '').toLowerCase().includes('шум') || String(s?.name || '').toLowerCase().includes('вибрац') || String(s?.name || '').toLowerCase().includes('электромагнит') || String(s?.name || '').toLowerCase().includes('эмп'),
  );

  const hasBuildingSurvey = services.some(
    (s: any) => s?.row === 18 || String(s?.name || '').toLowerCase().includes('в здании'),
  );

  const objectName = String(project?.objectName || project?.name || '').toLowerCase();
  const isCommunicationNetworksObject = /(сети\s+связи|линии\s+связи|волс|кабель\s+связи)/i.test(objectName);

  // Новые флаги для п.4.7
  const hasPPR = services.some(
    (s: any) => String(s?.name || '').toLowerCase().includes('ппр') || String(s?.name || '').toLowerCase().includes('плотност') && String(s?.name || '').toLowerCase().includes('радон'),
  );

  const hasGasGeochemistry = services.some(
    (s: any) => String(s?.name || '').toLowerCase().includes('газогеохим') || String(s?.name || '').toLowerCase().includes('шпуров') || String(s?.name || '').toLowerCase().includes('грунтов') && String(s?.name || '').toLowerCase().includes('воздух'),
  );

  const hasSurfaceWater = services.some(
    (s: any) => s?.row === 28 || String(s?.name || '').toLowerCase().includes('поверхностн') && String(s?.name || '').toLowerCase().includes('вод'),
  );

  const hasGroundwater = services.some(
    (s: any) => s?.row === 30 || String(s?.name || '').toLowerCase().includes('подземн') || String(s?.name || '').toLowerCase().includes('грунтов') && String(s?.name || '').toLowerCase().includes('вод'),
  );

  return {
    hasWaterSampling,
    hasSedimentSampling,
    hasAirSampling,
    hasPhysicalImpacts,
    hasBuildingSurvey,
    isCommunicationNetworksObject,
    hasPPR,
    hasGasGeochemistry,
    hasSurfaceWater,
    hasGroundwater,
  };
};

/**
 * Раздел 4 (п.4.1/4.2): настраивает состав работ и методы по правилам,
 * используя флаги, извлечённые из поручения (или фоллбэк по services).
 */
export function replaceProgramIeiSection41Block(params: {
  xml: string;
  orderFlags: ProgramIeiOrderFlags | null;
  section1Data: ProgramIeiSection1Data | null;
  section31Data: ProgramIeiSection31Data | null;
  project: any;
}): string {
  let xml = params.xml;

  const fallback = flagsFromProjectServices(params.project);

  const flags: ProgramIeiOrderFlags = {
    hasWaterSampling: Boolean(params.orderFlags?.hasWaterSampling ?? fallback.hasWaterSampling),
    hasSedimentSampling: Boolean(params.orderFlags?.hasSedimentSampling ?? fallback.hasSedimentSampling),
    hasAirSampling: Boolean(params.orderFlags?.hasAirSampling ?? fallback.hasAirSampling),
    hasPhysicalImpacts: Boolean(params.orderFlags?.hasPhysicalImpacts ?? fallback.hasPhysicalImpacts),
    hasBuildingSurvey: Boolean(params.orderFlags?.hasBuildingSurvey ?? fallback.hasBuildingSurvey),
    isCommunicationNetworksObject: Boolean(
      params.orderFlags?.isCommunicationNetworksObject ?? fallback.isCommunicationNetworksObject,
    ),
    hasPPR: Boolean(params.orderFlags?.hasPPR ?? fallback.hasPPR),
    hasGasGeochemistry: Boolean(params.orderFlags?.hasGasGeochemistry ?? fallback.hasGasGeochemistry),
    hasSurfaceWater: Boolean(params.orderFlags?.hasSurfaceWater ?? fallback.hasSurfaceWater),
    hasGroundwater: Boolean(params.orderFlags?.hasGroundwater ?? fallback.hasGroundwater),
  };

  // Москва-биотестирование: условие по адресу/региону
  const addressForMoscow = String(params.section1Data?.objectLocation || params.project?.objectAddress || '').trim();
  const isMoscow =
    params.section31Data?.regionType === 'MOSCOW_CITY' || isMoscowByAddress(addressForMoscow);

  // 1) Временно удаляемые пункты
  for (const id of [
    '678F0EFD', // биологические исследования
    '5372C8F8', // социально-экономические исследования
    '4ACECF48', // поверхностная газовая съемка
    '2D3B0AEC', // газохроматография
    '6A351B95', // прогноз
    '03A4BD67', // предложения и рекомендации
  ]) {
    xml = removeParagraphByParaId(xml, id);
  }

  // 2) Рекогносцировка: воды добавляем только если есть в поручении
  if (!flags.hasWaterSampling) {
    xml = replaceParagraphTextByParaId(
      xml,
      '10466191',
      'рекогносцировочное обследование территории с опробованием почв для установления фоновых характеристик состояния окружающей среды;',
    );
    // Оценка существующего экологического состояния (с водами) — убираем
    xml = removeParagraphByParaId(xml, '6F447173');
  }

  // 3) Физические воздействия — только если есть в поручении
  if (!flags.hasPhysicalImpacts) {
    xml = removeParagraphByParaId(xml, '4163AFCC');
  }

  // 4) Москва-биотестирование: два абзаца только для Москвы
  if (!isMoscow) {
    xml = removeParagraphByParaId(xml, '573F6AC7');
    xml = removeParagraphByParaId(xml, '358E2949');
  }

  // 5) Удаляем оценку воздуха по ранее выполненным ИЭИ
  xml = removeParagraphByParaId(xml, '7BE82047');

  // 6) Газогеохимия: удаляем для сетей связи; если оставляем — приводим текст без пометок
  if (flags.isCommunicationNetworksObject) {
    xml = removeParagraphByParaId(xml, '0404C4A0');
  } else {
    xml = replaceParagraphTextByParaId(
      xml,
      '0404C4A0',
      'В результате выполнения ИЭИ, с учетом материалов ИГИ, при подготовке Технического отчета будут выданы рекомендации о необходимости выполнения газогеохимических исследований. В этом случае в соответствии с п.4.22 СП 47.13330.2016 в установленном порядке должно быть оформлено дополнение к Договору и настоящей Программе в части изменения объемов, видов и методов работ, увеличения продолжительности и стоимости ИЭИ.',
    );
  }

  // 7) Радиационное обследование: "и здания" + отдельный пункт по зданию
  if (!flags.hasBuildingSurvey) {
    xml = replaceParagraphTextByParaId(
      xml,
      '640087C1',
      'Радиационное обследование территории осуществляется в соответствии с:',
    );
    xml = removeParagraphByParaId(xml, '2155BE0F');
  }

  // 8) Вода: блок 4) только если есть в поручении
  if (!flags.hasWaterSampling) {
    for (const id of ['3F060870', '7906AF1B', '6C2F641C']) {
      xml = removeParagraphByParaId(xml, id);
    }
  }

  // 9) Донные отложения: пункт 5) только если есть в поручении
  if (!flags.hasSedimentSampling) {
    xml = removeParagraphByParaId(xml, '7EBF2B78');
  }

  // 10) Пункт 6): динамический текст до "проводится/проводятся"
  xml = replaceParagraphTextByParaId(
    xml,
    '6EB92425',
    buildIlcWorksSentence({
      hasAirSampling: flags.hasAirSampling,
      hasPhysicalImpacts: flags.hasPhysicalImpacts,
    }),
  );

  return xml;
}
