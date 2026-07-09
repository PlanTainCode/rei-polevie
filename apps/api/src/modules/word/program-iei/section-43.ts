import type { ProgramIeiOrderFlags } from '../../ai/ai.service';
import { removeParagraphByParaId } from './docx-xml';

/**
 * Раздел 4.3: Применяемые приборы, оборудование, инструменты, программные продукты
 *
 * Логика:
 * - Ковш Ван Вина (paraId=6405C298) — только если есть донные отложения
 * - Самоходная буровая установка (paraId=02746569) — всегда удаляем
 * - Убираем highlight (желтый/красный/серый) у всех пунктов
 *
 * ПРИМ.: в актуальном шаблоне удалены приборы «дозиметр-радиометр МКС 05 «Терра»»,
 * «радиометр ДКС-96» и «альфа-радиометр РАА-20П2» — соответствующие paraId
 * (5EC63448/5A904236/163325C2) больше не используются.
 */
export function replaceProgramIeiSection43Block(params: {
  xml: string;
  orderFlags: ProgramIeiOrderFlags | null;
}): string {
  let xml = params.xml;

  const flags: ProgramIeiOrderFlags = {
    hasWaterSampling: Boolean(params.orderFlags?.hasWaterSampling),
    hasSedimentSampling: Boolean(params.orderFlags?.hasSedimentSampling),
    hasAirSampling: Boolean(params.orderFlags?.hasAirSampling),
    hasPhysicalImpacts: Boolean(params.orderFlags?.hasPhysicalImpacts),
    hasBuildingSurvey: Boolean(params.orderFlags?.hasBuildingSurvey),
    isCommunicationNetworksObject: Boolean(params.orderFlags?.isCommunicationNetworksObject),
    hasPPR: Boolean(params.orderFlags?.hasPPR),
    hasGasGeochemistry: Boolean(params.orderFlags?.hasGasGeochemistry),
    hasSurfaceWater: Boolean(params.orderFlags?.hasSurfaceWater),
    hasGroundwater: Boolean(params.orderFlags?.hasGroundwater),
  };

  // 1. Самоходная буровая установка — всегда удаляем
  xml = removeParagraphByParaId(xml, '02746569');

  // 2. Ковш Ван Вина — только если есть донные отложения
  if (!flags.hasSedimentSampling) {
    xml = removeParagraphByParaId(xml, '6405C298');
  }

  // 3. Убираем highlight у всех пунктов в секции 4.3
  // Список всех paraId пункта 4.3 (кроме уже удаленных)
  const section43ParaIds = [
    '0F79E9B2', // Полевые работы (заголовок)
    '1EFEBEAC', // GPS-приемник
    '762527BF', // фотоаппарат
    '391CA166', // комплект пробоотборников
    '6405C298', // Ковш Ван Вина (условно)
    '399E0F87', // автомобиль JAC
    '332D642B', // автомобиль Renault
    '17A6A743', // совки-лопатки
    '004576EC', // Камеральные (заголовок)
    '2DEAE965', // компьютер
    '496CA16B', // МФУ
    '56559001', // плоттер
    '5BD4F23F', // программное обеспечение
  ];

  // Убираем highlight и цветной текст
  for (const paraId of section43ParaIds) {
    // Ищем параграф и убираем highlight
    const paraPattern = new RegExp(
      `(<w:p\\b[^>]*w14:paraId="${paraId}"[^>]*>[\\s\\S]*?)</w:p>`,
      'g',
    );

    xml = xml.replace(paraPattern, (match) => {
      let cleaned = match;

      // Убираем highlight (yellow, red, lightGray, green, cyan и т.д.)
      cleaned = cleaned.replace(/<w:highlight[^/]*\/>/g, '');
      cleaned = cleaned.replace(/<w:highlight[^>]*>[\s\S]*?<\/w:highlight>/g, '');

      // Меняем красный цвет текста на черный
      cleaned = cleaned.replace(
        /<w:color w:val="FF0000"\/>/g,
        '<w:color w:val="000000"/>',
      );
      cleaned = cleaned.replace(
        /<w:color w:val="FF0000"[^>]*>/g,
        '<w:color w:val="000000"/>',
      );

      // Меняем другие цвета (фиолетовый, синий и т.д.) на черный
      cleaned = cleaned.replace(
        /<w:color w:val="[0-9A-F]{6}"\/>/g,
        '<w:color w:val="000000"/>',
      );

      return cleaned;
    });
  }

  return xml;
}
