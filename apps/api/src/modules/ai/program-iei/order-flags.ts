export interface ProgramIeiOrderFlags {
  hasWaterSampling: boolean; // поверхностные/подземные воды (общий флаг)
  hasSedimentSampling: boolean; // донные отложения
  hasAirSampling: boolean; // атмосферный воздух
  hasPhysicalImpacts: boolean; // шум/вибрация/ЭМП
  hasBuildingSurvey: boolean; // обследование здания/помещений
  isCommunicationNetworksObject: boolean; // объект = сети связи
  // Новые флаги для п.4.7:
  hasPPR: boolean; // ППР (плотность потока радона)
  hasGasGeochemistry: boolean; // газогеохимия (шпуровая газовая съемка)
  hasSurfaceWater: boolean; // поверхностные воды (отдельно)
  hasGroundwater: boolean; // подземные воды (отдельно)
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatFn = (messages: ChatMessage[]) => Promise<string>;

const isNetworksByName = (objectName: string): boolean => {
  const name = String(objectName || '').toLowerCase();
  return /(сети\s+связи|линии\s+связи|волс|кабель\s+связи)/i.test(name);
};

const boolFromUnknown = (v: unknown): boolean => {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === 'да' || s === '1') return true;
    if (s === 'false' || s === 'нет' || s === '0' || s === '') return false;
  }
  return false;
};

const heuristicFlagsFromText = (orderText: string): Omit<ProgramIeiOrderFlags, 'isCommunicationNetworksObject'> => {
  const t = String(orderText || '').toLowerCase();

  const hasSurfaceWater = /(поверхностн\w*\s+вод|проб\w*\s+вод\w*\s+поверхностн)/i.test(t);
  const hasGroundwater = /(подземн\w*\s+вод|грунтов\w*\s+вод)/i.test(t);
  const hasWaterSampling =
    hasSurfaceWater || hasGroundwater ||
    /(отбор\s+проб\s+вод|пробы\s+вод|исследован\w*\s+вод)/i.test(t);

  const hasSedimentSampling = /(донн\w*\s+отложен|проб\w*\s+донн\w*|отбор\s+проб\s+донн)/i.test(t);

  const hasAirSampling = /(атмосферн\w*\s+воздух|проб\w*\s+воздух|приземн\w*\s+атмосфер)/i.test(t);

  const hasPhysicalImpacts = /(шум|вибрац|электромагнит|\bэмп\b|магнитн\w*\s+пол|электрическ\w*\s+пол)/i.test(t);

  const hasBuildingSurvey = /(обследован\w*\s+здан|в\s+здании|радиометрическ\w*\s+обследован\w*\s+здан)/i.test(t);

  const hasPPR = /(ппр|плотност\w*\s+поток\w*\s+радон|потоков\s+радона)/i.test(t);

  const hasGasGeochemistry = /(газогеохим|шпуров\w*\s+газов|грунтов\w*\s+воздух|биогаз)/i.test(t);

  return {
    hasWaterSampling,
    hasSedimentSampling,
    hasAirSampling,
    hasPhysicalImpacts,
    hasBuildingSurvey,
    hasPPR,
    hasGasGeochemistry,
    hasSurfaceWater,
    hasGroundwater,
  };
};

export async function extractProgramIeiOrderFlagsViaAi(params: {
  chat: ChatFn;
  orderText: string;
  objectName: string;
}): Promise<ProgramIeiOrderFlags> {
  const { chat, orderText, objectName } = params;

  const nameIsNetworks = isNetworksByName(objectName);

  const baseHeuristic = heuristicFlagsFromText(orderText);

  const systemPrompt = `Ты эксперт по инженерно-экологическим изысканиям (ИЭИ).
Твоя задача - определить флаги состава работ по тексту поручения/поручения на ИЭИ.

КРИТИЧЕСКИ ВАЖНО:
- НЕ выдумывай. Если в тексте нет явного признака - ставь false.
- objectName используется только как дополнительный контекст для определения "сети связи".

Определи:
- hasWaterSampling: есть ли отбор/исследования поверхностных или подземных вод (общий)
- hasSedimentSampling: есть ли донные отложения (отбор/исследования)
- hasAirSampling: есть ли атмосферный воздух (отбор/исследования воздуха)
- hasPhysicalImpacts: есть ли измерения шума/вибрации/электромагнитных полей
- hasBuildingSurvey: есть ли обследование здания/помещений (в названии работы должно быть "в здании")
- isCommunicationNetworksObject: объект относится к сетям связи
- hasPPR: есть ли ППР (плотность потока радона, определение ППР)
- hasGasGeochemistry: есть ли газогеохимия (шпуровая газовая съемка, газохроматографические исследования)
- hasSurfaceWater: есть ли поверхностные воды (отдельно от подземных)
- hasGroundwater: есть ли подземные/грунтовые воды (отдельно от поверхностных)

ФОРМАТ ОТВЕТА - СТРОГО JSON:
{
  "hasWaterSampling": false,
  "hasSedimentSampling": false,
  "hasAirSampling": false,
  "hasPhysicalImpacts": false,
  "hasBuildingSurvey": false,
  "isCommunicationNetworksObject": false,
  "hasPPR": false,
  "hasGasGeochemistry": false,
  "hasSurfaceWater": false,
  "hasGroundwater": false
}`;

  const userPrompt = `Объект: ${String(objectName || '').trim()}

Поручение:
${String(orderText || '').trim()}`;

  try {
    const response = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        ...baseHeuristic,
        isCommunicationNetworksObject: nameIsNetworks,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ProgramIeiOrderFlags>;

    return {
      hasWaterSampling: boolFromUnknown(parsed.hasWaterSampling) || baseHeuristic.hasWaterSampling,
      hasSedimentSampling: boolFromUnknown(parsed.hasSedimentSampling) || baseHeuristic.hasSedimentSampling,
      hasAirSampling: boolFromUnknown(parsed.hasAirSampling) || baseHeuristic.hasAirSampling,
      hasPhysicalImpacts: boolFromUnknown(parsed.hasPhysicalImpacts) || baseHeuristic.hasPhysicalImpacts,
      hasBuildingSurvey: boolFromUnknown(parsed.hasBuildingSurvey) || baseHeuristic.hasBuildingSurvey,
      isCommunicationNetworksObject:
        boolFromUnknown(parsed.isCommunicationNetworksObject) || nameIsNetworks,
      hasPPR: boolFromUnknown(parsed.hasPPR) || baseHeuristic.hasPPR,
      hasGasGeochemistry: boolFromUnknown(parsed.hasGasGeochemistry) || baseHeuristic.hasGasGeochemistry,
      hasSurfaceWater: boolFromUnknown(parsed.hasSurfaceWater) || baseHeuristic.hasSurfaceWater,
      hasGroundwater: boolFromUnknown(parsed.hasGroundwater) || baseHeuristic.hasGroundwater,
    };
  } catch {
    // Фоллбэк: максимум стабильности, без выдумок
    return {
      ...baseHeuristic,
      isCommunicationNetworksObject: nameIsNetworks,
    };
  }
}
