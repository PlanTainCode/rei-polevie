import { Injectable, Logger } from '@nestjs/common';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import PizZip from 'pizzip';
import { TechnicalTaskData } from './tz-fields';

// process.cwd() уже указывает на apps/api при запуске через bun workspaces
const API_ROOT = process.cwd();

@Injectable()
export class TzGeneratorService {
  private readonly logger = new Logger(TzGeneratorService.name);
  private readonly templatePath = join(
    API_ROOT,
    'templates/тз/Задание ИИ_шаблон.docx',
  );

  /**
   * Генерация документа ТЗ на основе шаблона
   */
  async generateDocument(data: TechnicalTaskData, outputFileName: string): Promise<string> {
    this.logger.log(`Generating TZ document: ${outputFileName}`);

    const outputDir = join(API_ROOT, 'uploads', 'technical-tasks', 'generated');
    await mkdir(outputDir, { recursive: true });

    try {
      const templateBuffer = await readFile(this.templatePath);
      const zip = new PizZip(templateBuffer);

      const documentXml = zip.file('word/document.xml');
      if (!documentXml) {
        throw new Error('document.xml not found in template');
      }

      let content = documentXml.asText();

      // Выполняем все замены
      content = this.performReplacements(content, data);

      zip.file('word/document.xml', content);

      const outputBuffer = zip.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });

      const outputPath = join(outputDir, outputFileName);
      await writeFile(outputPath, outputBuffer);

      this.logger.log(`Document generated: ${outputPath}`);
      return `technical-tasks/generated/${outputFileName}`;
    } catch (error) {
      this.logger.error('Error generating document:', error);
      throw error;
    }
  }

  /**
   * Выполнение всех замен в документе
   */
  private performReplacements(content: string, data: TechnicalTaskData): string {
    // === 1. НАИМЕНОВАНИЕ ОБЪЕКТА ===
    // Элемент [47] - полное наименование в таблице
    content = this.replace(
      content,
      'Реконструкция (снос и восстановление) сетей связи ПАО МГТС по объекту: "Жилой дом с подземной автостоянкой, инженерными сетями и благоустройством территории (со сносом жилых домов по адресам: ул.Юных Ленинцев, д.44, корпус 2, ул.Юных Ленинцев, д.44, корпус 3) по адресу: г.Москва, внутригородское муниципальное образование Кузьминки, улица Юных Ленинцев, земельный участок 44/3 (зоны 2.5 и 2.7) (Юго-Восточный административный округ города Москвы) (ППТ микрорайонов 113, 113а, 114 района Кузьминки города Москвы)"',
      data.objectName,
    );

    // Элемент [35] - начало наименования на титульной странице
    content = this.replace(
      content,
      'Реконструкция (снос и восстановление) сетей связи ПАО МГТС по объекту: ',
      data.objectName + ' ',
    );

    // Элементы [36] и [37] - продолжение на титульной странице (очищаем)
    content = this.replace(
      content,
      '"Жилой дом с подземной автостоянкой, инженерными сетями и благоустройством территории (со сносом жилых домов по адресам: ул.Юных Ленинцев, д.44, корпус 2, ул.Юных Ленинцев, д.44, корпус 3) по адресу: г.Москва, внутригородское муниципальное образование Кузьминки, улица Юных Ленинцев, земельный участок 44/3 (зоны 2.5 и 2.7) (Юго-Восточный административный округ города Москвы) (ППТ микрорайонов 113, 113а, 114 района',
      '',
    );
    content = this.replace(content, 'Кузьминки города Москвы)"', '');

    // === 2. МЕСТОПОЛОЖЕНИЕ ===
    // Элемент [49]
    if (data.objectLocation) {
      content = this.replaceExact(content, '>Москва<', `>${this.escapeXml(data.objectLocation)}<`);
    }

    // === 3. ЗАКАЗЧИК ===
    // Элемент [68] - название
    content = this.replace(content, 'ООО "ГОРСВЯЗЬСТРОЙ"', data.customer.name);

    // Элемент [70] - ОГРН  
    if (data.customer.ogrn) {
      content = this.replace(content, '1097746501269', data.customer.ogrn);
    }

    // Элемент [71] - адрес заказчика
    content = this.replace(
      content,
      '121059, Город Москва, вн.тер. г. Муниципальный Округ Дорогомилово, наб Бережковская, дом 20, строение 19',
      data.customer.address,
    );

    // Элемент [73] - ФИО контакта
    if (data.customer.contactName) {
      content = this.replace(content, 'Бордуков Александр Николаевич', data.customer.contactName);
    }

    // Элемент [74] - телефон
    if (data.customer.contactPhone) {
      content = this.replace(content, '+74997133710', data.customer.contactPhone);
    }

    // Элемент [75] - email
    if (data.customer.contactEmail) {
      content = this.replace(content, 'gorsviaz@mail.ru', data.customer.contactEmail);
    }

    // === 4. НАЗНАЧЕНИЕ ОБЪЕКТА ===
    // Элемент [113]
    if (data.objectInfo.purpose) {
      content = this.replace(
        content,
        'Объект улично-дорожной сети, объект образовательного учреждения, объект производственного назначения, административное здание',
        data.objectInfo.purpose,
      );
    }

    // === 5. ТЕРРИТОРИЯ И ОПИСАНИЕ ===
    // Элементы [136-154] - описание территории
    if (data.territoryDescription) {
      // Заменяем начало описания
      content = this.replace(
        content,
        'Территория обследования расположена в поселении ',
        data.territoryDescription + ' ',
      );
      // Очищаем остальные части
      content = this.replace(content, 'Кокошкино', '');
      content = this.replace(content, 'Новомосковского', '');
      content = this.replace(content, ' административного округа ', '');
      content = this.replace(content, '.Москвы', '');
      content = this.replace(content, 'осквы', '');
      content = this.replace(content, '. Проектируемая трасса начинается от пересечения ', '');
      content = this.replace(content, '.Железнодорожной', '');
      content = this.replace(content, 'елезнодорожной', '');
      content = this.replace(content, ' с ', '');
      content = this.replace(content, 'ул.Дачной', '');
      content = this.replace(content, ' и следует вдоль ', '');
      content = this.replace(content, ' до пересечения с ', '');
      content = this.replace(content, 'ул.Школьной', '');
      content = this.replace(content, ', далее трасса проходит вдоль застройки на северо-восток ', '');
      content = this.replace(content, 'до границы с Московской областью.', '');
    }

    // === 6. ПЛОЩАДЬ ===
    // Элементы [155-157]
    if (data.areaSize) {
      content = this.replace(
        content,
        'Площадь обследуемого участка – около ',
        `Площадь обследуемого участка – ${data.areaSize} `,
      );
      // Убираем старые "га."
      content = this.replaceExact(content, '>га<', '><');
    }

    // === 7. ТЕХНИЧЕСКИЕ ХАРАКТЕРИСТИКИ ===
    // Элементы [158-163] - описание и глубина работ
    if (data.technicalCharacteristics.description) {
      content = this.replace(
        content,
        'Краткая техническая характеристика объекта, включая размеры ',
        `${data.technicalCharacteristics.description}. Краткая техническая характеристика объекта, включая размеры `,
      );
    }

    if (data.technicalCharacteristics.excavationDepth) {
      content = this.replace(
        content,
        'Глубина ведения земляных работ (',
        `Глубина ведения земляных работ: ${data.technicalCharacteristics.excavationDepth} (`,
      );
    }

    // === 8. ГЛУБИНА ЗАЛОЖЕНИЯ ФУНДАМЕНТОВ ===
    // Элементы [484-486]
    if (data.technicalCharacteristics.foundationDepth) {
      content = this.replace(
        content,
        'Глубина заложения: телефонной сети (открытым способом) – ',
        `Глубина заложения: ${data.technicalCharacteristics.foundationDepth}. Глубина заложения: телефонной сети (открытым способом) – `,
      );
    }

    // === 9. СПОСОБ СТРОИТЕЛЬСТВА ===
    // Элементы [479-480]
    if (data.projectSolutions) {
      content = this.replace(
        content,
        'Способ прокладки коммуникаций: траншейный, ГНБ ',
        `${data.projectSolutions}. Способ прокладки коммуникаций: траншейный, ГНБ `,
      );
    }

    // === 10. ДОПУСТИМЫЕ ОСАДКИ ===
    // Элемент [482]
    if (data.technicalCharacteristics.settlementInfo && data.technicalCharacteristics.settlementInfo !== 'Нет данных') {
      content = this.replaceExact(content, '>Нет данных<', `>${this.escapeXml(data.technicalCharacteristics.settlementInfo)}<`);
    }

    // === 11. ИСТОЧНИКИ ЗАГРЯЗНЕНИЯ ===
    // Элементы [498-508]
    if (data.pollutionSources) {
      content = this.replace(
        content,
        'Существующие источники воздействия:',
        data.pollutionSources + '\n\nСуществующие источники воздействия:',
      );
    }

    // === 12. РАНЕЕ ВЫПОЛНЕННЫЕ ИЗЫСКАНИЯ ===
    // Элемент [300]
    if (data.previousSurveys && data.previousSurveys !== 'Не представлено') {
      content = this.replace(
        content,
        'Технический отчет по результатам инженерно-экологических изысканий для подготовки проектной документации № 736-00046-52018-19 для объекта: ',
        `${data.previousSurveys}\n\nТехнический отчет по результатам инженерно-экологических изысканий для подготовки проектной документации № 736-00046-52018-19 для объекта: `,
      );
    }

    // === 13. УРОВЕНЬ ОТВЕТСТВЕННОСТИ ===
    if (data.objectInfo.responsibilityLevel && data.objectInfo.responsibilityLevel !== 'Нормальный') {
      content = this.replaceExact(content, '>Нормальный<', `>${this.escapeXml(data.objectInfo.responsibilityLevel)}<`);
    }

    // === 14. НАЛИЧИЕ ПОМЕЩЕНИЙ С ПОСТОЯННЫМ НАХОЖДЕНИЕМ ===
    if (data.objectInfo.permanentPresence) {
      if (data.objectInfo.permanentPresence.toLowerCase().includes('предусмотрено')) {
        // Оставляем как есть
      } else if (data.objectInfo.permanentPresence.toLowerCase().includes('отсутств')) {
        content = this.replaceExact(content, '>Предусмотрено<', '>Отсутствуют<');
      }
    }

    return content;
  }

  /**
   * Простая замена строки
   */
  private replace(content: string, search: string, replace: string): string {
    if (content.includes(search)) {
      return content.split(search).join(this.escapeXml(replace));
    }
    return content;
  }

  /**
   * Точная замена (для XML тегов)
   */
  private replaceExact(content: string, search: string, replace: string): string {
    if (content.includes(search)) {
      return content.split(search).join(replace);
    }
    return content;
  }

  /**
   * Экранирование спецсимволов XML
   */
  private escapeXml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
