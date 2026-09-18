/**
 * Извлечение данных из ТЗ заказчика (Word/PDF) в модель XML-задания.
 *
 * ИИ возвращает плоский JSON с тем, что реально есть в документе; всё, чего
 * в документе нет, остаётся пустым (или типовым значением) и заполняется в
 * форме. Поля, взятые из документа, помечаются в provenance как 'document'.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { parseJsonObjectFromAi } from '../ai/parse-json';
import {
  CONSTRUCTION_TYPES,
  DANGEROUS_PROCESSES,
  FOUNDATION_MATERIALS,
  FOUNDATION_TYPES,
  REGION_CODES,
  SPECIFIC_SOILS,
  createEmptyModel,
  emptyDocument,
  emptySurvey,
  textBlock,
  type Survey,
  type TzXmlModel,
} from './tz-xml';

// pdf-parse v2 использует класс PDFParse
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');

const API_ROOT = process.cwd();

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Плоский ответ модели. Все поля необязательны. */
interface ExtractedTz {
  taskNumber?: string;
  contractNumber?: string;
  contractDate?: string;
  objectName?: string;
  objectKind?: 'AREAL' | 'LINEAR';
  address?: {
    regionCode?: string;
    postIndex?: string;
    city?: string;
    district?: string;
    settlement?: string;
    street?: string;
    building?: string;
    note?: string;
  };
  cadastralNumbers?: string[];
  constructionType?: string;
  customer?: {
    fullName?: string;
    abbreviatedName?: string;
    inn?: string;
    kpp?: string;
    ogrn?: string;
    address?: string;
    email?: string;
    signatoryPosition?: string;
    signatorySurname?: string;
    signatoryName?: string;
    signatoryPatronymic?: string;
  };
  surveyTypes?: string[];
  object?: {
    responsibilityLevel?: string;
    peoplePermanentStay?: string;
    dangerousIndustrialObject?: string;
    fireDangerCategory?: string;
    transportInfrastructure?: boolean;
    numberFloors?: string;
    overallHeight?: string;
    designFeatures?: string;
    foundationTypes?: string[];
    foundationMaterials?: string[];
    foundationDepth?: string;
    earthworksDepth?: string;
    loads?: string;
    permissibleDraft?: string;
    length?: string;
  };
  technogenicImpacts?: string;
  dangerousProcesses?: string[];
  dangerousProcessesText?: string;
  specificSoils?: string[];
  boundariesText?: string;
  additionalRequirements?: string[];
  pollutionSources?: string;
  normativeDocuments?: string[];
  providedDocuments?: string[];
  reportRequirements?: string;
}

@Injectable()
export class TzXmlExtractorService {
  private readonly logger = new Logger(TzXmlExtractorService.name);
  private readonly apiKey: string;
  private readonly model = 'deepseek-v4-pro';
  private readonly baseUrl = 'https://api.deepseek.com';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DEEPSEEK_API_KEY') || '';
  }

  async extractTextFromDocument(fileUrl: string): Promise<string> {
    const fullPath = join(API_ROOT, 'uploads', fileUrl);
    const ext = extname(fileUrl).toLowerCase();
    const buffer = await readFile(fullPath);
    if (ext === '.pdf') {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    }
    if (ext === '.docx' || ext === '.doc') {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    throw new Error(`Неподдерживаемый формат файла: ${ext}`);
  }

  /** Полный цикл: текст документа → JSON от ИИ → модель задания. */
  async extractModel(fileUrl: string): Promise<{ model: TzXmlModel; imported: string[] }> {
    const text = await this.extractTextFromDocument(fileUrl);
    this.logger.log(`Извлечено ${text.length} символов из ${fileUrl}`);
    const extracted = await this.askAi(text);
    return this.toModel(extracted);
  }

  private async askAi(documentText: string): Promise<ExtractedTz> {
    const regions = REGION_CODES.map((r) => `${r.code} — ${r.label}`).join('; ');
    const systemPrompt = `Ты — эксперт по инженерным изысканиям в России. Извлеки данные из технического задания (ТЗ) заказчика для XML-задания на инженерные изыскания по схеме Минстроя.

Правила:
- Извлекай ТОЛЬКО то, что есть в документе. Если данных нет — не включай поле (или null). Ничего не выдумывай.
- Наименование объекта копируй ДОСЛОВНО, со всеми частями («по объекту:», «по адресу:», кадастровые номера и т.д.).
- Адрес разбей на части. regionCode — двузначный код субъекта РФ из списка: ${regions}.
- constructionType — ОДНО значение из списка: ${CONSTRUCTION_TYPES.map((c) => `«${c.label}»`).join(', ')}. Бери 1:1 из ТЗ, если указано.
- surveyTypes — коды видов изысканий, которые требуются по ТЗ: 1 — инженерно-геодезические, 2 — инженерно-геологические, 3 — инженерно-гидрометеорологические, 4 — инженерно-экологические, 5 — инженерно-геотехнические.
- objectKind: «LINEAR» для трасс, сетей, дорог, трубопроводов, ЛЭП, мостов; иначе «AREAL».
- object.responsibilityLevel: «нормальный», «повышенный» или «пониженный» (в нижнем регистре).
- object.dangerousIndustrialObject: «Не относится к опасным производственным объектам» или класс «I», «II», «III», «IV».
- object.fireDangerCategory: «Категория не устанавливается» или буква «А», «Б», «В», «Г», «Д».
- object.foundationTypes — из списка: ${FOUNDATION_TYPES.map((c) => c.code).join(', ')}. object.foundationMaterials — из списка: ${FOUNDATION_MATERIALS.map((c) => c.code).join(', ')}.
- dangerousProcesses — только коды из списка: ${DANGEROUS_PROCESSES.map((c) => c.code).join(', ')}. Если в ТЗ написано «отсутствуют» или «нет данных» — пустой массив, а текст положи в dangerousProcessesText.
- specificSoils — только из списка: ${SPECIFIC_SOILS.map((c) => c.code).join(', ')}.
- Числа (этажность, высота, глубины) — только число без единиц, десятичный разделитель точка.
- Даты в формате ГГГГ-ММ-ДД.
- ИНН заказчика 10 цифр, КПП 9, ОГРН 13 — только если есть в документе.
- Подписант заказчика (утверждающий): должность и ФИО раздельно, если указаны.

Верни ТОЛЬКО JSON такой формы (поля без данных пропускай):
{
  "taskNumber": "шифр задания",
  "contractNumber": "номер договора", "contractDate": "ГГГГ-ММ-ДД",
  "objectName": "полное наименование объекта дословно",
  "objectKind": "AREAL|LINEAR",
  "address": {"regionCode":"77","postIndex":"","city":"Москва","district":"","settlement":"","street":"","building":"","note":"адрес одной строкой, если не разбивается"},
  "cadastralNumbers": ["77:04:0004008:1234"],
  "constructionType": "архитектурно-строительное проектирование",
  "customer": {"fullName":"","abbreviatedName":"","inn":"","kpp":"","ogrn":"","address":"адрес одной строкой","email":"","signatoryPosition":"","signatorySurname":"","signatoryName":"","signatoryPatronymic":""},
  "surveyTypes": ["4"],
  "object": {"responsibilityLevel":"нормальный","peoplePermanentStay":"Предусмотрено|Отсутствуют","dangerousIndustrialObject":"","fireDangerCategory":"","transportInfrastructure":false,"numberFloors":"","overallHeight":"","designFeatures":"краткая техническая характеристика","foundationTypes":[],"foundationMaterials":[],"foundationDepth":"","earthworksDepth":"","loads":"","permissibleDraft":"","length":"протяжённость линейного объекта, км"},
  "technogenicImpacts": "текст",
  "dangerousProcesses": [], "dangerousProcessesText": "", "specificSoils": [],
  "boundariesText": "описание границ площадки/трассы",
  "additionalRequirements": ["дополнительные требования к отдельным видам работ"],
  "pollutionSources": "сведения об источниках загрязнения",
  "normativeDocuments": ["перечень НД"],
  "providedDocuments": ["перечень предоставляемых заказчиком материалов"],
  "reportRequirements": "требования к отчётной документации"
}`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Извлеки данные из технического задания:\n\n${documentText}` },
    ]);
    const parsed = parseJsonObjectFromAi(response);
    if (!parsed || typeof parsed !== 'object') {
      this.logger.error(`Ответ ИИ не содержит JSON: ${response.slice(0, 500)}`);
      throw new Error('Не удалось разобрать ответ ИИ');
    }
    return parsed as ExtractedTz;
  }

  private toModel(e: ExtractedTz): { model: TzXmlModel; imported: string[] } {
    const model = createEmptyModel();
    const prov = model.provenance!;
    const imported: string[] = [];
    const mark = (path: string, label?: string) => {
      prov[path] = 'document';
      if (label) imported.push(label);
    };
    const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
    const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);

    if (s(e.taskNumber)) {
      model.requisites.number = s(e.taskNumber);
      mark('requisites.number', 'шифр задания');
    }
    if (s(e.objectName)) {
      model.object.name = s(e.objectName);
      mark('object.name', 'наименование объекта');
    }
    const isLinear = e.objectKind === 'LINEAR';
    model.object.kind = isLinear ? 'LINEAR_OKS' : 'AREAL_OKS';
    model.object.siteKind = isLinear ? 'LINEAR' : 'AREAL';

    const a = e.address;
    if (a && (s(a.city) || s(a.street) || s(a.note) || s(a.regionCode))) {
      const addr = model.object.placement.address;
      if (REGION_CODES.some((r) => r.code === s(a.regionCode))) addr.regionCode = s(a.regionCode);
      addr.postIndex = s(a.postIndex) || undefined;
      addr.city = s(a.city) || undefined;
      addr.district = s(a.district) || undefined;
      addr.settlement = s(a.settlement) || undefined;
      addr.street = s(a.street) || undefined;
      addr.building = s(a.building) || undefined;
      const structured = [addr.district, addr.city, addr.settlement, addr.street, addr.building].some(Boolean);
      if (!structured) addr.note = s(a.note) || undefined;
      mark('object.placement.address', 'адрес объекта');
    }
    const cad = list(e.cadastralNumbers);
    if (cad.length) {
      model.object.placement.cadastralSites = cad.filter((c) => /^\d+:\d+:\d+:\d+$/.test(c));
      model.object.placement.cadastralDistricts = cad.filter((c) => /^\d+:\d+:\d+$/.test(c));
      mark('object.placement.cadastralSites', 'кадастровые номера');
    }
    const ct = s(e.constructionType).toLowerCase();
    const ctMatch = CONSTRUCTION_TYPES.find((c) => c.code === ct) ?? CONSTRUCTION_TYPES.find((c) => ct && c.code.startsWith(ct.split(' ')[0]));
    if (ctMatch) {
      model.constructionType = ctMatch.code;
      mark('constructionType', 'вид градостроительной деятельности');
    }

    const c = e.customer;
    if (c && s(c.fullName)) {
      const org = model.developer.organization;
      org.fullName = s(c.fullName);
      org.abbreviatedName = s(c.abbreviatedName) || undefined;
      org.inn = s(c.inn);
      org.kpp = s(c.kpp);
      org.ogrn = s(c.ogrn) || undefined;
      org.email = s(c.email) || undefined;
      if (s(c.address)) org.address.note = s(c.address);
      model.customerKind = 'DEVELOPER';
      model.developer.kind = 'ORGANIZATION';
      mark('developer.organization', 'заказчик');
      model.approver.organization = { ...org, address: { ...org.address }, noprizNumber: 'Не требуется' };
      mark('approver.organization');
      const rep = model.approver.representatives[0];
      if (s(c.signatorySurname)) {
        rep.surname = s(c.signatorySurname);
        rep.name = s(c.signatoryName);
        rep.patronymic = s(c.signatoryPatronymic) || undefined;
        rep.position = s(c.signatoryPosition);
        mark('approver.representatives', 'подписант заказчика');
      }
    }

    if (s(e.contractNumber)) {
      const doc = emptyDocument('05.99');
      doc.name = 'Договор на выполнение инженерных изысканий';
      doc.number = s(e.contractNumber);
      doc.date = s(e.contractDate);
      doc.authorNote = s(c?.fullName) || 'Заказчик';
      model.initiationDocuments = { documents: [doc] };
      mark('initiationDocuments', 'договор');
    }

    const types = list(e.surveyTypes).filter((t) => ['1', '2', '3', '4', '5'].includes(t));
    if (types.length) {
      const surveys: Survey[] = types.sort().map((t) => emptySurvey('BASIC', t));
      const addReq = list(e.additionalRequirements);
      if (addReq.length) {
        const eco = surveys.find((x) => x.typeCode === '4') ?? surveys[0];
        eco.additionalRequirements = textBlock(addReq);
      }
      model.surveys = surveys;
      mark('surveys', 'виды изысканий');
    }

    const o = e.object ?? {};
    const areal = model.object.areal;
    const linear = model.object.linear;
    if (s(o.responsibilityLevel)) {
      const lvl = s(o.responsibilityLevel).toLowerCase();
      if (['нормальный', 'повышенный', 'пониженный'].includes(lvl)) {
        areal.responsibilityLevel = lvl;
        linear.responsibilityLevel = lvl;
        mark(isLinear ? 'object.linear.responsibilityLevel' : 'object.areal.responsibilityLevel');
      }
    }
    if (s(o.peoplePermanentStay)) {
      areal.peoplePermanentStay = s(o.peoplePermanentStay);
      mark('object.areal.peoplePermanentStay');
    }
    if (s(o.dangerousIndustrialObject)) {
      areal.dangerousIndustrialObject = s(o.dangerousIndustrialObject);
      mark('object.areal.dangerousIndustrialObject');
    }
    if (s(o.fireDangerCategory)) {
      areal.fireDangerCategory = s(o.fireDangerCategory);
      mark('object.areal.fireDangerCategory');
    }
    if (typeof o.transportInfrastructure === 'boolean') {
      areal.functionsFeatures = o.transportInfrastructure
        ? 'Относится к объектам транспортной инфраструктуры и к другим объектам, функционально-технологические особенности которых влияют на их безопасность'
        : 'Не относится к объектам транспортной инфраструктуры и к другим объектам, функционально-технологические особенности которых влияют на их безопасность';
      mark('object.areal.functionsFeatures');
    }
    if (/^\d+$/.test(s(o.numberFloors))) {
      areal.numberFloors = s(o.numberFloors);
      mark('object.areal.numberFloors');
    }
    if (s(o.overallHeight)) {
      areal.overallHeight = s(o.overallHeight);
      areal.planSize.height = s(o.overallHeight);
      mark('object.areal.overallHeight');
    }
    if (s(o.designFeatures)) {
      areal.designFeatures = textBlock([s(o.designFeatures)]);
      mark('object.areal.designFeatures', 'техническая характеристика');
    }
    const ft = list(o.foundationTypes).filter((t) => FOUNDATION_TYPES.some((d) => d.code === t));
    const fm = list(o.foundationMaterials).filter((t) => FOUNDATION_MATERIALS.some((d) => d.code === t));
    if (ft.length) {
      areal.foundation.types = ft;
      linear.foundationTypes = ft;
      mark('object.areal.foundation.types');
    }
    if (fm.length) {
      areal.foundation.materials = fm;
      linear.foundationMaterials = fm;
      mark('object.areal.foundation.materials');
    }
    if (s(o.foundationDepth)) {
      areal.foundation.depth = s(o.foundationDepth);
      linear.foundationDepth = s(o.foundationDepth);
      mark('object.areal.foundation.depth');
    }
    if (s(o.earthworksDepth)) {
      areal.earthworksDepth = s(o.earthworksDepth);
      mark('object.areal.earthworksDepth');
    }
    if (s(o.loads)) {
      areal.loads = textBlock([s(o.loads)]);
      mark('object.areal.loads');
    }
    if (s(o.permissibleDraft)) {
      areal.permissibleDraft = s(o.permissibleDraft);
      mark('object.areal.permissibleDraft');
    }
    if (s(o.length)) {
      linear.length = s(o.length);
      model.object.linearSite.length = s(o.length);
      mark('object.linear.length');
    }

    if (s(e.technogenicImpacts)) {
      model.technogenicImpacts = textBlock([s(e.technogenicImpacts)]);
      model.enabled.technogenicImpacts = true;
      mark('technogenicImpacts', 'техногенные воздействия');
    }
    const dp = list(e.dangerousProcesses).filter((p) => DANGEROUS_PROCESSES.some((d) => d.code === p));
    if (dp.length) {
      model.dangerous.processes = dp;
      mark('dangerous.processes', 'опасные природные процессы');
    }
    if (s(e.dangerousProcessesText)) {
      model.dangerous.processesAdditional = textBlock([s(e.dangerousProcessesText)]);
      mark('dangerous.processesAdditional');
    }
    const soils = list(e.specificSoils).filter((p) => SPECIFIC_SOILS.some((d) => d.code === p));
    if (soils.length) {
      model.dangerous.soils = soils;
      mark('dangerous.soils');
    }
    if (s(e.boundariesText)) {
      model.boundaries.areaOutWorks = textBlock([s(e.boundariesText)]);
      mark('boundaries.areaOutWorks', 'описание границ');
    }
    if (s(e.pollutionSources)) {
      model.ecology.existingPollutionSources = textBlock([s(e.pollutionSources)]);
      model.enabled.ecology = true;
      mark('ecology.existingPollutionSources', 'источники загрязнения');
    }
    const norms = list(e.normativeDocuments);
    if (norms.length) {
      model.requirements.usedNorms = norms;
      model.enabled.usedNorms = true;
      mark('requirements.usedNorms', 'нормативные документы');
    }
    if (s(e.reportRequirements)) {
      model.requirements.compositionOrderTransfer = textBlock([s(e.reportRequirements)]);
      mark('requirements.compositionOrderTransfer', 'требования к отчётности');
    }
    const provided = list(e.providedDocuments);
    if (provided.length) {
      model.availableDocuments = {
        documents: provided.map((name) => {
          const d = emptyDocument('99.99');
          d.name = name;
          d.authorNote = s(c?.fullName) || 'Заказчик';
          return d;
        }),
      };
      mark('availableDocuments', 'перечень прилагаемых документов');
    }

    return { model, imported };
  }

  private async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) throw new Error('Не задан DEEPSEEK_API_KEY');
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      // Модель рассуждает перед ответом (reasoning_content), рассуждения входят в лимит —
      // на длинных ТЗ 8000 токенов не хватало и content приходил пустым.
      body: JSON.stringify({ model: this.model, messages, temperature: 0.1, max_tokens: 32000 }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }
    const data = await response.json();
    const choice = data.choices?.[0];
    const content: string = choice?.message?.content || '';
    this.logger.log(
      `DeepSeek: finish=${choice?.finish_reason}, content=${content.length} симв., reasoning=${data.usage?.completion_tokens_details?.reasoning_tokens ?? '?'} ток., completion=${data.usage?.completion_tokens ?? '?'} ток.`,
    );
    if (!content && choice?.finish_reason === 'length') {
      throw new Error('Ответ модели оборван по лимиту токенов — документ слишком длинный');
    }
    return content;
  }
}
