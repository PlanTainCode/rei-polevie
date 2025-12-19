import * as mammoth from 'mammoth';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

async function testExtraction() {
  // Читаем ТЗ
  const file = 'templates/тз/ТЗ ИЭИ. Корпус 3 Синдика.docx';
  const buffer = await readFile(join(process.cwd(), file));
  const { value: text } = await mammoth.extractRawText({ buffer });
  
  console.log('=== ТЕКСТ ТЗ (первые 2000 символов) ===\n');
  console.log(text.substring(0, 2000));
  
  // Отправляем в AI
  console.log('\n\n=== ЗАПРОС К AI ===\n');
  
  const systemPrompt = `Ты — эксперт по инженерным изысканиям в России. Твоя задача — извлечь данные из технического задания (ТЗ) заказчика для заполнения шаблона ТЗ исполнителя.

ВАЖНЕЙШИЕ ПРАВИЛА:
1. Наименование объекта (objectName) копируй ПОЛНОСТЬЮ и ДОСЛОВНО как есть в документе, включая ВСЕ части: "по объекту:", "по адресу:", кадастровые номера, описания зон и т.д. НЕ СОКРАЩАЙ и НЕ УБИРАЙ никакие части!
2. Местоположение (objectLocation) — только город/район/область (кратко)
3. Все текстовые поля извлекай ТОЧНО как написано в документе

Извлеки данные и верни ТОЛЬКО валидный JSON:

{
  "objectName": "ПОЛНОЕ наименование объекта ДОСЛОВНО как в документе, со всеми частями включая 'по адресу', кадастровые номера и т.д.",
  "objectLocation": "Город/район кратко, например: Московская область, городской округ Красногорск",
  "cadastralNumber": "кадастровый номер если указан",
  "areaSize": "площадь участка с единицами, например: 2,5 га или 15000 кв.м",
  
  "territoryDescription": "Описание расположения территории.",
  
  "surveyTypes": {
    "hydrometeorology": true/false,
    "geology": true/false, 
    "ecology": true/false
  },
  
  "customer": {
    "name": "Полное наименование организации с формой собственности",
    "ogrn": "ОГРН если указан",
    "address": "Юридический адрес заказчика полностью",
    "contactName": "ФИО контактного лица",
    "contactPhone": "телефон",
    "contactEmail": "email"
  },
  
  "objectInfo": {
    "purpose": "Назначение объекта.",
    "responsibilityLevel": "Нормальный или Повышенный",
    "permanentPresence": "Предусмотрено или Отсутствуют"
  },
  
  "technicalCharacteristics": {
    "description": "Краткое описание: этажность, площадь, тип конструкций",
    "excavationDepth": "Глубина земляных работ",
    "foundationType": "Тип фундамента",
    "foundationDepth": "Глубина заложения фундамента",
    "foundationLoad": "Нагрузка на фундамент",
    "settlementInfo": "Допустимые осадки"
  },
  
  "ecologySurveyWorks": {
    "gammaTerrain": true/false,
    "gammaBuilding": true/false,
    "gammaSpectrometerySoil": true/false,
    "gammaSpectrometryOss": true/false,
    "radonTerrain": true/false,
    "radonBuilding": true/false,
    "heavyMetalsSoil": true/false,
    "heavyMetalsOss": true/false,
    "benzpyrene": true/false,
    "oilProducts": true/false,
    "microbiologySoil": true/false,
    "airAnalysis": true/false,
    "waterChemistry": true/false,
    "waterMicrobiology": true/false,
    "gasGeochemistry": true/false,
    "noiseLevel": true/false,
    "vibration": true/false,
    "emf": true/false
  }
}

Верни ТОЛЬКО JSON без пояснений.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://polevie.app',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Извлеки данные из технического задания:\n\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('=== ОТВЕТ AI ===\n');
  console.log(content);
  
  // Сохраняем результат
  await writeFile('scripts/extraction-result.json', content);
  console.log('\n\nРезультат сохранён в scripts/extraction-result.json');
}

testExtraction().catch(console.error);
