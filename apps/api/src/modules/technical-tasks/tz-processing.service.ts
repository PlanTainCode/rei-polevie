import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mammoth from 'mammoth';
import { proxyFetch } from '../ai/proxy-fetch';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { TechnicalTaskData, SurveyTypes, UrbanPlanningActivities, EcologySurveyWorks } from './tz-fields';

// pdf-parse v2 использует класс PDFParse
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');

// process.cwd() уже указывает на apps/api при запуске через bun workspaces
const API_ROOT = process.cwd();

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class TzProcessingService {
  private readonly logger = new Logger(TzProcessingService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY') || '';
    this.model = this.configService.get<string>('AI_MODEL') || 'anthropic/claude-sonnet-4';
  }

  /**
   * Извлечь текст из документа (Word или PDF)
   */
  async extractTextFromDocument(filePath: string): Promise<string> {
    const fullPath = join(API_ROOT, 'uploads', filePath);
    const ext = extname(filePath).toLowerCase();

    try {
      const buffer = await readFile(fullPath);

      if (ext === '.pdf') {
        // pdf-parse v2 API
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        await parser.destroy();
        return result.text;
      } else if (ext === '.docx' || ext === '.doc') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } else {
        throw new Error(`Unsupported file format: ${ext}`);
      }
    } catch (error) {
      this.logger.error(`Error extracting text from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Извлечь структурированные данные из текста ТЗ через AI
   */
  async extractTechnicalTaskData(documentText: string): Promise<TechnicalTaskData> {
    const systemPrompt = `Ты — эксперт по инженерным изысканиям в России. Твоя задача — извлечь данные из технического задания (ТЗ) заказчика для заполнения шаблона ТЗ исполнителя.

Шаблон ТЗ состоит из 27 пронумерованных пунктов. Ниже описание пунктов 1-7 и что нужно извлечь:

=== ПУНКТ 1. Наименование объекта ===
Копируй ПОЛНОСТЬЮ и ДОСЛОВНО как есть в документе!
Включая ВСЕ части: "по объекту:", "расположенный по адресу:", названия улиц, кадастровые номера, описания зон.
НЕ СОКРАЩАЙ и НЕ УБИРАЙ ничего!
Пример: "Реконструкция (снос и восстановление) сетей связи ПАО МГТС по объекту: \"Жилой дом с подземной автостоянкой... по адресу: г.Москва...\""

=== ПУНКТ 2. Местоположение объекта ===
Ищи отдельный пункт "Местоположение" или "Адрес объекта" в исходном ТЗ.
Если адрес содержит "кадастровый номер участка XXX" — УБЕРИ эту часть вместе с текстом "кадастровый номер участка".
Пример: "г. Москва, ул. Юных Ленинцев, земельный участок 44/3"

=== ПУНКТ 3. Основание для выполнения работ ===
НЕ ИЗВЛЕКАЕМ — заполняется вручную

=== ПУНКТ 4. Вид градостроительной деятельности ===
Определи по контексту ТЗ ОДИН наиболее подходящий вид из списка:
- "Архитектурно-строительное проектирование"
- "Капитальный ремонт"  
- "Реконструкция"
- "Комплексное развитие территории и их благоустройство"
- "Территориальное планирование"
- "Градостроительное зонирование"
- "Планировка территории"
- "Строительство"
- "Снос объектов капитального строительства"
- "Эксплуатация зданий, сооружений"

Верни ТОЛЬКО ОДНУ строку из списка выше!

=== ПУНКТ 5. Идентификационные сведения о заказчике ===
Заголовок группы — не извлекаем

=== ПУНКТ 5.1. Наименование и местонахождение заказчика ===
ОБЯЗАТЕЛЬНО найди и извлеки ВСЕ данные заказчика:
- name: Полное наименование организации (ООО, АО, ПАО и т.д.)
- ogrn: ОГРН — 13-значный номер, ищи после "ОГРН" или "ОГРН:"
- address: Полный юридический адрес — ищи после "адрес", "юр. адрес", "место нахождения", или индекс (6 цифр) с адресом

ВАЖНО: Эти данные обычно в начале документа, в шапке, или в разделе "Заказчик"/"Застройщик"

=== ПУНКТ 5.2. Контакты представителя заказчика ===
ОБЯЗАТЕЛЬНО найди ВСЕ контактные данные:
- name: ФИО контактного лица
- phone: Телефон в любом формате (+7, 8, с пробелами и скобками)
- email: Email адрес

Ищи после слов "контакт", "представитель", "ответственный", "тел.", "телефон", "e-mail", "@"

=== ПУНКТЫ 6, 6.1, 6.2 — Сведения об исполнителе ===
НЕ ИЗВЛЕКАЕМ — это данные вашей компании (АО "РЭИ-ЭКОАУДИТ")

=== ПУНКТ 7. Цели и задачи инженерных изысканий ===
Текст шаблонный, но определи флаги для условных частей:
- includeReconstruction: true если в ТЗ есть реконструкция объекта
- includeAgriculturalLand: true если упоминаются бывшие земли с/х назначения или складывающаяся городская среда
- includeIndustrialLand: true если упоминается объект производственного назначения

=== ПУНКТ 8. Этап выполнения инженерных изысканий ===
НЕ ИЗВЛЕКАЕМ — шаблонный текст

=== ПУНКТ 9. Виды инженерных изысканий ===
Определи какие виды изысканий нужны по ТЗ:
- hydrometeorology: true если нужны инженерно-гидрометеорологические изыскания (ИГМИ)
- geology: true если нужны инженерно-геологические изыскания (ИГИ)
- ecology: true если нужны инженерно-экологические изыскания (ИЭИ)
Ищи в названии документа, в тексте "на выполнение ИЭИ", "инженерно-экологические" и т.д.

=== ПУНКТ 10. Идентификационные сведения об объекте ===
Группа подпунктов:

10.1 Назначение объекта — определи тип объекта:
"Многоквартирный жилой дом", "Объект улично-дорожной сети", "Объект производственного назначения", 
"Административное здание", "Объект образовательного учреждения", "Инженерные сети" и т.д.

10.2 Принадлежность к транспортной инфраструктуре — true если дорога, мост, путепровод, ж/д

10.3 Принадлежность к опасным производственным объектам — true если ОПО (обычно false)

10.4 Пожарная и взрывопожарная опасность — ищи класс пожарной опасности или "Нет данных"

10.5 Уровень ответственности — "Нормальный" или "Повышенный" (ищи в ТЗ)

10.6 Наличие помещений с постоянным нахождением людей:
- "Предусмотрено" если жильё, офисы, школы
- "Отсутствуют" если дороги, инженерные сети
- "Не применимо" если линейный объект

=== ПУНКТ 11. Предполагаемые техногенные воздействия ===
Определи по тексту ТЗ: источники загрязнения, выбросы, воздействия на среду. Или "Нет данных"

=== ПУНКТ 12. Данные о границах площадки ===
СГЕНЕРИРУЙ полный текст для этого пункта на основе данных из ТЗ.
Формат: "Территория обследования расположена в [район/округ/город]. [Описание расположения объекта]. Площадь обследуемого участка – [площадь] га."
Если это здание — опиши где оно расположено.
Если это трасса — опиши начало, конец, направление.
Верни в поле boundaryDescription.

=== ПУНКТ 13. Краткая техническая характеристика объекта ===
Извлеки:
- technicalDescription: Описание объекта (этажность, площадь, тип конструкций)
- excavationDepth: Глубина ведения земляных работ (max)

=== ПУНКТ 15. Наличие опасных природных процессов ===
Ищи в ТЗ информацию об опасных природных процессах: оползни, подтопление, карст, просадочные грунты, сейсмика и т.д.
- Если есть информация — извлеки её
- Если написано "отсутствуют" — верни "Отсутствуют"  
- Если ничего нет — верни "Нет данных"

=== ПУНКТ 18. Требования к составлению прогноза ===
Этот пункт зависит от наличия ИГМИ (гидрометеорология) в surveyTypes.

Верни JSON:

{
  "objectName": "ПОЛНОЕ наименование объекта ДОСЛОВНО",
  "objectLocation": "адрес БЕЗ кадастрового номера участка",
  "urbanPlanningActivity": "ОДНА строка из списка видов градостроительной деятельности",
  
  "customer": {
    "name": "Полное наименование организации или null",
    "ogrn": "ОГРН или null",
    "address": "Юридический адрес или null"
  },
  "customerContact": {
    "name": "ФИО контактного лица или null",
    "phone": "телефон или null",
    "email": "email или null"
  },
  
  "goalsFlags": {
    "includeReconstruction": true/false,
    "includeAgriculturalLand": true/false,
    "includeIndustrialLand": true/false
  },
  
  "surveyTypes": {
    "hydrometeorology": true/false,
    "geology": true/false, 
    "ecology": true/false
  },
  
  "objectInfo": {
    "purpose": "Назначение объекта",
    "transportInfrastructure": true/false,
    "dangerousProduction": true/false,
    "fireHazard": "Класс пожарной опасности или Нет данных",
    "responsibilityLevel": "Нормальный или Повышенный",
    "permanentPresence": "Предусмотрено или Отсутствуют или Не применимо"
  },
  
  "technogenicImpact": "Описание воздействий или Нет данных",
  "boundaryDescription": "Полный текст для п.12: Территория обследования расположена в ... Площадь обследуемого участка – X га.",
  
  "technicalDescription": "Описание объекта",
  "excavationDepth": "Глубина земляных работ, например: до 5 м",
  
  "dangerousProcesses": "Описание опасных процессов или Отсутствуют или Нет данных"
}

ВАЖНО:
- objectName: копируй ДОСЛОВНО со всеми "по объекту:", "по адресу:" и т.д.!
- objectLocation: убери "кадастровый номер участка XXX" если есть
- urbanPlanningActivity: верни ОДНУ строку, не массив!
- Если данные не найдены — ставь null

Верни ТОЛЬКО JSON без пояснений.`;

    const userPrompt = `Извлеки данные из технического задания:\n\n${documentText}`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      // Парсим JSON ответ
      this.logger.log(`AI response length: ${response.length}`);
      this.logger.log(`AI response preview: ${response.substring(0, 500)}...`);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.error(`AI response does not contain valid JSON: ${response.substring(0, 1000)}`);
        throw new Error('AI response does not contain valid JSON');
      }

      const data = JSON.parse(jsonMatch[0]);
      this.logger.log(`Parsed data: objectName=${data.objectName?.substring(0, 100)}, urbanPlanningActivity=${data.urbanPlanningActivity}`);
      
      return this.validateAndNormalize(data);
    } catch (error) {
      this.logger.error('Error extracting TZ data via AI:', error);
      throw error;
    }
  }

  /**
   * Полный процесс обработки ТЗ
   */
  async processTechnicalTask(filePath: string): Promise<TechnicalTaskData> {
    this.logger.log(`Processing technical task: ${filePath}`);

    // 1. Извлекаем текст
    const documentText = await this.extractTextFromDocument(filePath);
    this.logger.log(`Extracted ${documentText.length} characters from document`);

    // 2. Извлекаем структурированные данные через AI
    const extractedData = await this.extractTechnicalTaskData(documentText);
    this.logger.log(`Extracted data for object: ${extractedData.objectName?.substring(0, 100)}...`);

    return extractedData;
  }

  /**
   * Валидация и нормализация извлечённых данных
   */
  private validateAndNormalize(data: any): TechnicalTaskData {
    const defaultSurveyTypes: SurveyTypes = {
      hydrometeorology: false,
      geology: false,
      ecology: true,
    };

    // Преобразуем строку urbanPlanningActivity в объект urbanPlanningActivities
    const urbanPlanningActivities = this.parseUrbanPlanningActivity(data.urbanPlanningActivity);

    const defaultEcologyWorks: EcologySurveyWorks = {
      gammaTerrain: false,
      gammaBuilding: false,
      gammaSpectrometerySoil: false,
      gammaSpectrometryOss: false,
      radonTerrain: false,
      radonBuilding: false,
      heavyMetalsSoil: false,
      heavyMetalsOss: false,
      benzpyrene: false,
      oilProducts: false,
      microbiologySoil: false,
      airAnalysis: false,
      waterChemistry: false,
      waterMicrobiology: false,
      gasGeochemistry: false,
      noiseLevel: false,
      vibration: false,
      emf: false,
    };

    // Объединяем customer и customerContact
    const customer = {
      name: data.customer?.name || 'Заказчик не указан',
      ogrn: data.customer?.ogrn || undefined,
      address: data.customer?.address || 'Адрес не указан',
      contactName: data.customerContact?.name || data.customer?.contactName || undefined,
      contactPhone: data.customerContact?.phone || data.customer?.contactPhone || undefined,
      contactEmail: data.customerContact?.email || data.customer?.contactEmail || undefined,
    };

    return {
      contractNumber: data.contractNumber || undefined,
      contractDate: data.contractDate || undefined,
      taskNumber: data.taskNumber || undefined,
      year: data.year || new Date().getFullYear().toString(),

      objectName: data.objectName || 'Объект не указан',
      objectLocation: data.objectLocation || 'Адрес не указан',
      cadastralNumber: data.cadastralNumber || undefined,
      territoryDescription: data.territoryDescription || undefined,
      areaSize: data.areaSize || undefined,
      boundaryDescription: data.boundaryDescription || undefined,

      surveyTypes: {
        ...defaultSurveyTypes,
        ...(data.surveyTypes || {}),
      },
      urbanPlanningActivities,
      ecologySurveyWorks: {
        ...defaultEcologyWorks,
        ...(data.ecologySurveyWorks || {}),
      },

      customer,

      objectInfo: {
        purpose: data.objectInfo?.purpose || undefined,
        transportInfrastructure: data.objectInfo?.transportInfrastructure || false,
        dangerousProduction: data.objectInfo?.dangerousProduction || false,
        fireHazard: data.objectInfo?.fireHazard || 'Нет данных',
        responsibilityLevel: data.objectInfo?.responsibilityLevel || 'Нормальный',
        permanentPresence: data.objectInfo?.permanentPresence || 'Нет данных',
        technogenicImpact: data.technogenicImpact || data.objectInfo?.technogenicImpact || 'Нет данных',
      },

      technicalCharacteristics: {
        description: data.technicalDescription || data.technicalCharacteristics?.description || undefined,
        excavationDepth: data.excavationDepth || data.technicalCharacteristics?.excavationDepth || undefined,
        foundationType: data.technicalCharacteristics?.foundationType || undefined,
        foundationDepth: data.technicalCharacteristics?.foundationDepth || undefined,
        foundationLoad: data.technicalCharacteristics?.foundationLoad || undefined,
        basementInfo: data.technicalCharacteristics?.basementInfo || undefined,
        settlementInfo: data.technicalCharacteristics?.settlementInfo || 'Нет данных',
      },

      additionalRequirements: data.additionalRequirements || [],
      pollutionSources: data.pollutionSources || undefined,
      previousSurveys: data.previousSurveys || 'Не представлено',
      providedDocuments: data.providedDocuments || [],
      normativeDocuments: data.normativeDocuments || [],
      projectSolutions: data.projectSolutions || undefined,
      hydrometeoCharacteristics: data.hydrometeoCharacteristics || [],
      reportRequirements: data.reportRequirements || undefined,
      
      // Флаги для пункта 7
      goalsFlags: data.goalsFlags || {
        includeReconstruction: false,
        includeAgriculturalLand: false,
        includeIndustrialLand: false,
      },
      
      // П.15 - опасные природные процессы
      dangerousProcesses: data.dangerousProcesses || 'Нет данных',
    };
  }

  /**
   * Преобразовать строку вида градостроительной деятельности в объект
   */
  private parseUrbanPlanningActivity(activity: string | undefined): UrbanPlanningActivities {
    const result: UrbanPlanningActivities = {
      architecturalDesign: false,
      capitalRepair: false,
      reconstruction: false,
      territoryDevelopment: false,
      territorialPlanning: false,
      urbanZoning: false,
      territoryPlanning: false,
      construction: false,
      demolition: false,
      buildingOperation: false,
    };

    if (!activity) {
      result.construction = true; // по умолчанию
      return result;
    }

    const activityLower = activity.toLowerCase();
    
    if (activityLower.includes('архитектурно-строительное')) {
      result.architecturalDesign = true;
    } else if (activityLower.includes('капитальный ремонт')) {
      result.capitalRepair = true;
    } else if (activityLower.includes('реконструкция')) {
      result.reconstruction = true;
    } else if (activityLower.includes('комплексное развитие')) {
      result.territoryDevelopment = true;
    } else if (activityLower.includes('территориальное планирование')) {
      result.territorialPlanning = true;
    } else if (activityLower.includes('градостроительное зонирование')) {
      result.urbanZoning = true;
    } else if (activityLower.includes('планировка территории')) {
      result.territoryPlanning = true;
    } else if (activityLower.includes('строительство')) {
      result.construction = true;
    } else if (activityLower.includes('снос')) {
      result.demolition = true;
    } else if (activityLower.includes('эксплуатация')) {
      result.buildingOperation = true;
    } else {
      result.construction = true; // по умолчанию
    }

    return result;
  }

  /**
   * Вызов AI через OpenRouter
   */
  private async chat(messages: ChatMessage[]): Promise<string> {
    const response = await proxyFetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://polevie.app',
        'X-Title': 'Polevie TZ Processing',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}
