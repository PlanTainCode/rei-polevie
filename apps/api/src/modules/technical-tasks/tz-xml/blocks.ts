/**
 * Реестр блоков задания для интерфейса конструктора.
 *
 * Порядок блоков совпадает с порядком разделов в XML-схеме и в официальной
 * печатной форме (XSL). Обязательные блоки нельзя отключить; необязательные
 * включаются флагом в TzXmlModel.enabled.
 */

import type { EnabledBlocks } from './model';

export interface TzBlock {
  id: string;
  title: string;
  /** Короткое пояснение для списка блоков. */
  hint?: string;
  required: boolean;
  /** Для необязательных — ключ в EnabledBlocks. */
  enabledKey?: keyof EnabledBlocks;
}

export const TZ_BLOCKS: TzBlock[] = [
  { id: 'requisites', title: 'Реквизиты и утверждение', hint: 'Шифр, дата, гриф, утверждающая организация и подписанты', required: true },
  { id: 'object', title: 'Сведения об объекте', hint: 'Наименование, адрес, кадастр, характеристики объекта', required: true },
  { id: 'initiationDocuments', title: 'Основание для выполнения работ', hint: 'Договор и другие документы-основания', required: true },
  { id: 'construction', title: 'Вид деятельности и этап', hint: 'Вид градостроительной деятельности, этап изысканий, сроки', required: true },
  { id: 'customer', title: 'Заказчик', hint: 'Застройщик, технический заказчик или оба', required: true },
  { id: 'researchers', title: 'Исполнители', hint: 'Лица, заключившие договоры на изыскания', required: false, enabledKey: 'researchers' },
  { id: 'purposes', title: 'Цели и задачи', hint: 'Общие цели и задачи инженерных изысканий', required: true },
  { id: 'surveys', title: 'Виды изысканий', hint: 'Основные, специальные и иные исследования с целями и задачами', required: true },
  { id: 'technogenicImpacts', title: 'Техногенные воздействия', hint: 'Предполагаемые воздействия объекта на окружающую среду', required: false, enabledKey: 'technogenicImpacts' },
  { id: 'ecology', title: 'Экологическая обстановка', hint: 'Источники загрязнения, изъятие земель, водозабор и сброс', required: false, enabledKey: 'ecology' },
  { id: 'boundaries', title: 'Границы площадки / трассы', hint: 'Изображение границ, координаты участков и трасс', required: true },
  { id: 'dangerous', title: 'Опасные процессы и грунты', hint: 'Опасные природные процессы, мерзлота, специфические грунты', required: true },
  { id: 'requirements', title: 'Требования к изысканиям', hint: 'Научное сопровождение, точность, прогноз, контроль качества, передача результатов', required: true },
  { id: 'availableDocuments', title: 'Прилагаемые документы', hint: 'Документы, прилагаемые к заданию', required: true },
];

export function isBlockEnabled(blockId: string, enabled: EnabledBlocks): boolean {
  const block = TZ_BLOCKS.find((b) => b.id === blockId);
  if (!block) return false;
  if (block.required || !block.enabledKey) return true;
  return Boolean(enabled[block.enabledKey]);
}
