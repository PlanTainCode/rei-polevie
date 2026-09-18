import { parseJsonObjectFromAi } from '../parse-json';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ChatFn = (messages: ChatMessage[]) => Promise<string>;

export interface ReportIeiSection1AiData {
  clientInn: string;
  landUseZone: string;
  waterObjectText: string;
  socialInfrastructureText: string;
  noSocialInfrastructureNearby: boolean;
  hasBuildingSurvey: boolean;
  buildingDescription: string;
  siteFenceText: string;
  isLandscapingOnly: boolean;
  locationText: string;
}

export function emptyReportIeiSection1AiData(): ReportIeiSection1AiData {
  return {
    clientInn: '',
    landUseZone: '',
    waterObjectText: '',
    socialInfrastructureText: '',
    noSocialInfrastructureNearby: true,
    hasBuildingSurvey: false,
    buildingDescription: '',
    siteFenceText: '',
    isLandscapingOnly: false,
    locationText: '',
  };
}

export function normalizeReportIeiSection1AiData(
  raw: Partial<ReportIeiSection1AiData> | null | undefined,
): ReportIeiSection1AiData {
  const empty = emptyReportIeiSection1AiData();
  if (!raw || typeof raw !== 'object') return empty;
  return {
    clientInn: String(raw.clientInn || '').replace(/\D/g, '').slice(0, 12),
    landUseZone: String(raw.landUseZone || '')
      .trim()
      .replace(/^в\s+/i, '')
      .replace(/[.;]+$/u, ''),
    waterObjectText: String(raw.waterObjectText || '').trim(),
    socialInfrastructureText: String(raw.socialInfrastructureText || '').trim(),
    noSocialInfrastructureNearby: raw.noSocialInfrastructureNearby !== false,
    hasBuildingSurvey: raw.hasBuildingSurvey === true,
    buildingDescription: String(raw.buildingDescription || '')
      .replace(/^\(\s*При обследовании здания\s*\)\s*/i, '')
      .trim(),
    siteFenceText: String(raw.siteFenceText || '').trim(),
    isLandscapingOnly: raw.isLandscapingOnly === true,
    locationText: String(raw.locationText || '').trim(),
  };
}

export async function extractReportIeiSection1ViaAi(params: {
  chat: ChatFn;
  tzText: string;
  reportTemplateSection1: string;
  nearbyText?: string;
  objectName?: string;
}): Promise<ReportIeiSection1AiData> {
  const systemPrompt = `Ты заполняешь §1 технического отчёта ИЭИ по шаблону отчёта (не программы).
Бери факты ТОЛЬКО из ТЗ и блока «окружение из программы». Не выдумывай школы, воду, здания, ИНН, зону.

Правила из пометок шаблона отчёта:
- locationText: одно предложение «Территория изысканий расположена …» по адресу/наименованию. Без «см. Рисунок».
- waterObjectText: готовое предложение про ближайший водный объект, только если он ЯВНО есть в ТЗ/окружении. Если пруд — укажи, на какой реке. Если данных нет — "".
- socialInfrastructureText: если в ТЗ/окружении есть жилая застройка/школа/сад/больница и расстояние — напиши как в шаблоне. Иначе "".
- noSocialInfrastructureNearby: true, если в 150 м ничего из этого нет или данных нет.
- buildingDescription: только если в ТЗ есть существующее здание (снос/реконструкция/обследование). Без скобок «(При обследовании здания)».
- hasBuildingSurvey: true только если здание реально обследуется/сносится/реконструируется по ТЗ.
- landUseZone: скопируй 1:1 формулировку зоны из ТЗ (без слова «в» в начале). НЕ подставляй шаблонную «многофункциональной общественной зоне», если её нет в ТЗ. Если зоны нет — "".
- siteFenceText: ограждение/охрана, только если сказано в ТЗ. Иначе "".
- clientInn: только цифры ИНН заказчика, если есть в ТЗ.
- isLandscapingOnly: true только если вид деятельности — исключительно благоустройство.

Верни СТРОГО JSON:
{
  "clientInn": "",
  "landUseZone": "",
  "waterObjectText": "",
  "socialInfrastructureText": "",
  "noSocialInfrastructureNearby": true,
  "hasBuildingSurvey": false,
  "buildingDescription": "",
  "siteFenceText": "",
  "isLandscapingOnly": false,
  "locationText": ""
}`;

  const userPrompt = `Наименование объекта: ${params.objectName || ''}

Окружение из п.3.2 программы ИЭИ:
${params.nearbyText || 'нет'}

Фрагмент шаблона отчёта (§1 с пометками):
${params.reportTemplateSection1.slice(0, 6000)}

ТЗ:
${params.tzText.slice(0, 14000)}`;

  try {
    const response = await params.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    const parsed = parseJsonObjectFromAi(response);
    if (!parsed || typeof parsed !== 'object') {
      console.error(
        '[ReportIeiSection1] Нет JSON в ответе AI:',
        String(response || '').slice(0, 400),
      );
      return emptyReportIeiSection1AiData();
    }
    return normalizeReportIeiSection1AiData(parsed as Partial<ReportIeiSection1AiData>);
  } catch (error) {
    console.error('[ReportIeiSection1] Ошибка AI:', error);
    return emptyReportIeiSection1AiData();
  }
}
