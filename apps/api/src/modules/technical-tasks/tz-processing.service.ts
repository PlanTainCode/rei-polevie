import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mammoth from 'mammoth';
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
  
  "territoryDescription": "Описание расположения территории. Например: Территория обследования расположена в городском округе Красногорск Московской области. Проектируемый объект расположен по адресу...",
  
  "surveyTypes": {
    "hydrometeorology": true/false,
    "geology": true/false, 
    "ecology": true/false
  },
  
  "urbanPlanningActivities": {
    "architecturalDesign": true если архитектурно-строительное проектирование,
    "capitalRepair": true если капитальный ремонт,
    "reconstruction": true если реконструкция,
    "territoryDevelopment": true если комплексное развитие территории,
    "territorialPlanning": true если территориальное планирование,
    "urbanZoning": true если градостроительное зонирование,
    "territoryPlanning": true если планировка территории,
    "construction": true если строительство,
    "demolition": true если снос,
    "buildingOperation": true если эксплуатация
  },
  
  "customer": {
    "name": "Полное наименование организации с формой собственности, например: ООО «ПКБ Петракомплект»",
    "ogrn": "ОГРН если указан",
    "address": "Юридический адрес заказчика полностью",
    "contactName": "ФИО контактного лица",
    "contactPhone": "телефон",
    "contactEmail": "email"
  },
  
  "objectInfo": {
    "purpose": "Назначение объекта. Варианты: Многоквартирный жилой дом / Объект улично-дорожной сети / Объект производственного назначения / Административное здание / и т.д.",
    "transportInfrastructure": true если относится к транспортной инфраструктуре (дороги, мосты),
    "dangerousProduction": true если опасный производственный объект,
    "fireHazard": "класс пожарной опасности или Нет данных",
    "responsibilityLevel": "Нормальный или Повышенный (по умолчанию Нормальный)",
    "permanentPresence": "Предусмотрено если жилье/офисы, Отсутствуют если дороги/сети",
    "technogenicImpact": "описание воздействий или Нет данных"
  },
  
  "technicalCharacteristics": {
    "description": "Краткое описание: этажность, площадь застройки, тип конструкций. Например: 24-этажный жилой дом, монолитный ж/б каркас, фундамент плитный",
    "excavationDepth": "Глубина земляных работ, например: до 7,5 м",
    "foundationType": "Тип фундамента: плитный/свайный/ленточный",
    "foundationDepth": "Глубина заложения фундамента, например: -7,1 м (абс. отм. 144,38 м)",
    "foundationLoad": "Нагрузка на фундамент, например: 40 т/м2",
    "basementInfo": "Информация о подземных частях: подземный паркинг 2 уровня, технический этаж",
    "settlementInfo": "Допустимые осадки, например: 15 см"
  },
  
  "ecologySurveyWorks": {
    "gammaTerrain": true если измерение МЭД гамма на территории,
    "gammaBuilding": true если измерение МЭД гамма в здании,
    "gammaSpectrometerySoil": true если гамма-спектрометрия грунта,
    "gammaSpectrometryOss": true если гамма-спектрометрия ОСС,
    "radonTerrain": true если измерение ППР на территории,
    "radonBuilding": true если измерение ЭРОА радона в здании,
    "heavyMetalsSoil": true если тяжелые металлы в грунте,
    "heavyMetalsOss": true если тяжелые металлы в ОСС,
    "benzpyrene": true если бенз(а)пирен,
    "oilProducts": true если нефтепродукты,
    "microbiologySoil": true если микробиология грунта,
    "airAnalysis": true если анализ воздуха,
    "waterChemistry": true если химия воды,
    "waterMicrobiology": true если микробиология воды,
    "gasGeochemistry": true если газогеохимия,
    "noiseLevel": true если шум,
    "vibration": true если вибрация,
    "emf": true если ЭМП
  },
  
  "pollutionSources": "Существующие источники воздействия: ...\nПроектируемые источники воздействия: ...",
  "previousSurveys": "Информация о ранее выполненных изысканиях или Не представлено",
  "projectSolutions": "Способ строительства: открытый котлован / ГНБ / траншейный и т.д.",
  "reportRequirements": "Требования к отчетам: количество экземпляров, форматы"
}

ПРАВИЛА ИЗВЛЕЧЕНИЯ:
- objectName: копируй ВСЁ включая "по объекту:", "по адресу:", кадастровые номера!
- Если данные не указаны — ставь null или false
- surveyTypes определяй по упоминанию видов изысканий в тексте
- urbanPlanningActivities определяй по контексту (строительство нового = construction, снос старого = demolition и т.д.)
- ecologySurveyWorks определяй по таблице состава работ если есть

Верни ТОЛЬКО JSON без пояснений.`;

    const userPrompt = `Извлеки данные из технического задания:\n\n${documentText}`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      // Парсим JSON ответ
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI response does not contain valid JSON');
      }

      const data = JSON.parse(jsonMatch[0]);
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

    const defaultUrbanPlanningActivities: UrbanPlanningActivities = {
      architecturalDesign: false,
      capitalRepair: false,
      reconstruction: false,
      territoryDevelopment: false,
      territorialPlanning: false,
      urbanZoning: false,
      territoryPlanning: false,
      construction: true,
      demolition: false,
      buildingOperation: false,
    };

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

      surveyTypes: {
        ...defaultSurveyTypes,
        ...(data.surveyTypes || {}),
      },
      urbanPlanningActivities: {
        ...defaultUrbanPlanningActivities,
        ...(data.urbanPlanningActivities || {}),
      },
      ecologySurveyWorks: {
        ...defaultEcologyWorks,
        ...(data.ecologySurveyWorks || {}),
      },

      customer: {
        name: data.customer?.name || 'Заказчик не указан',
        ogrn: data.customer?.ogrn || undefined,
        address: data.customer?.address || 'Адрес не указан',
        contactName: data.customer?.contactName || undefined,
        contactPhone: data.customer?.contactPhone || undefined,
        contactEmail: data.customer?.contactEmail || undefined,
      },

      objectInfo: {
        purpose: data.objectInfo?.purpose || undefined,
        transportInfrastructure: data.objectInfo?.transportInfrastructure || false,
        dangerousProduction: data.objectInfo?.dangerousProduction || false,
        fireHazard: data.objectInfo?.fireHazard || 'Нет данных',
        responsibilityLevel: data.objectInfo?.responsibilityLevel || 'Нормальный',
        permanentPresence: data.objectInfo?.permanentPresence || 'Нет данных',
        technogenicImpact: data.objectInfo?.technogenicImpact || 'Нет данных',
      },

      technicalCharacteristics: {
        description: data.technicalCharacteristics?.description || undefined,
        excavationDepth: data.technicalCharacteristics?.excavationDepth || undefined,
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
    };
  }

  /**
   * Вызов AI через OpenRouter
   */
  private async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
