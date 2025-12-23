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
      this.logger.log(`Reading template from: ${this.templatePath}`);
      const templateBuffer = await readFile(this.templatePath);
      this.logger.log(`Template size: ${templateBuffer.length} bytes`);
      
      const zip = new PizZip(templateBuffer);

      const documentXml = zip.file('word/document.xml');
      if (!documentXml) {
        throw new Error('document.xml not found in template');
      }

      let content = documentXml.asText();
      this.logger.log(`Original content length: ${content.length}`);

      // Выполняем все замены
      content = this.performReplacements(content, data);
      this.logger.log(`Modified content length: ${content.length}`);

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
    // === ПУНКТ 1. НАИМЕНОВАНИЕ ОБЪЕКТА ===
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

    // === ПУНКТ 2. МЕСТОПОЛОЖЕНИЕ ===
    if (data.objectLocation) {
      content = this.replaceExact(content, '>Москва<', `>${this.escapeXml(data.objectLocation)}<`);
    }

    // === ПУНКТ 3. ОСНОВАНИЕ ДЛЯ ВЫПОЛНЕНИЯ РАБОТ ===
    // НЕ ТРОГАЕМ - заполняется вручную

    // === ПУНКТ 4. ВИД ГРАДОСТРОИТЕЛЬНОЙ ДЕЯТЕЛЬНОСТИ ===
    // Оставляем только один вид из списка
    content = this.processUrbanPlanningActivities(content, data.urbanPlanningActivities);

    // === ПУНКТЫ 5.1, 5.2. ЗАКАЗЧИК ===
    this.logger.log(`Customer data: name=${data.customer.name}, ogrn=${data.customer.ogrn}, contact=${data.customer.contactName}, phone=${data.customer.contactPhone}, email=${data.customer.contactEmail}`);

    // Название заказчика
    if (data.customer.name && data.customer.name !== 'Заказчик не указан') {
      content = this.replace(content, 'ООО "ГОРСВЯЗЬСТРОЙ"', data.customer.name);
      content = this.replace(content, 'ООО «ГОРСВЯЗЬСТРОЙ»', data.customer.name);
    } else {
      content = this.replace(content, 'ООО "ГОРСВЯЗЬСТРОЙ"', 'Не указан');
      content = this.replace(content, 'ООО «ГОРСВЯЗЬСТРОЙ»', 'Не указан');
    }

    // ОГРН заказчика
    if (data.customer.ogrn) {
      content = this.replace(content, '1097746501269', data.customer.ogrn);
    } else {
      // Убираем шаблонный ОГРН вместе с ", ОГРН "
      content = this.replace(content, ', ОГРН 1097746501269', '');
      content = this.replace(content, 'ОГРН 1097746501269', '');
      content = this.replace(content, '1097746501269', '');
    }

    // Адрес заказчика
    if (data.customer.address && data.customer.address !== 'Адрес не указан') {
      content = this.replace(
        content,
        '121059, Город Москва, вн.тер. г. Муниципальный Округ Дорогомилово, наб Бережковская, дом 20, строение 19',
        data.customer.address,
      );
    } else {
      content = this.replace(
        content,
        '121059, Город Москва, вн.тер. г. Муниципальный Округ Дорогомилово, наб Бережковская, дом 20, строение 19',
        'Адрес не указан',
      );
    }

    // ФИО контактного лица
    if (data.customer.contactName) {
      content = this.replace(content, 'Бордуков Александр Николаевич', data.customer.contactName);
    } else {
      content = this.replace(content, 'Бордуков Александр Николаевич', 'Не указан');
    }

    // Телефон
    if (data.customer.contactPhone) {
      content = this.replace(content, '+74997133710', data.customer.contactPhone);
    } else {
      content = this.replace(content, '+74997133710', 'Не указан');
    }

    // Email
    if (data.customer.contactEmail) {
      content = this.replace(content, 'gorsviaz@mail.ru', data.customer.contactEmail);
    } else {
      content = this.replace(content, 'gorsviaz@mail.ru', 'Не указан');
    }

    // === ПУНКТ 9. ВИДЫ ИНЖЕНЕРНЫХ ИЗЫСКАНИЙ ===
    content = this.processSurveyTypes(content, data.surveyTypes);

    // === ПУНКТ 10.1. НАЗНАЧЕНИЕ ОБЪЕКТА ===
    if (data.objectInfo.purpose) {
      content = this.replace(
        content,
        'Объект улично-дорожной сети, объект образовательного учреждения, объект производственного назначения, административное здание',
        data.objectInfo.purpose,
      );
    }

    // === ПУНКТ 10.2. ПРИНАДЛЕЖНОСТЬ К ТРАНСПОРТНОЙ ИНФРАСТРУКТУРЕ ===
    if (data.objectInfo.transportInfrastructure) {
      // Заменяем "Нет" на "Да" для транспортной инфраструктуры
      // Ищем конкретную строку в контексте
      content = this.replaceInContext(content, 'транспортной инфраструктуры', 'Нет', 'Да');
    }

    // === ПУНКТ 10.3. ПРИНАДЛЕЖНОСТЬ К ОПАСНЫМ ПРОИЗВОДСТВЕННЫМ ОБЪЕКТАМ ===
    if (data.objectInfo.dangerousProduction) {
      content = this.replaceInContext(content, 'опасным', 'Нет', 'Да');
    }

    // === ПУНКТ 10.4. ПОЖАРНАЯ ОПАСНОСТЬ ===
    if (data.objectInfo.fireHazard && data.objectInfo.fireHazard !== 'Нет данных') {
      content = this.replaceInContext(content, 'Пожарная', 'Нет данных', data.objectInfo.fireHazard);
    }

    // === ПУНКТ 10.5. УРОВЕНЬ ОТВЕТСТВЕННОСТИ ===
    this.logger.log(`Responsibility level: ${data.objectInfo.responsibilityLevel}`);
    if (data.objectInfo.responsibilityLevel === 'Повышенный') {
      content = this.replaceExact(content, '>Нормальный</w:t>', '>Повышенный</w:t>');
    }
    // Убираем "Не применимо" для уровня ответственности
    content = this.replaceExact(content, '<w:highlight w:val="lightGray"/></w:rPr><w:t>Не применимо</w:t>', '<w:highlight w:val="lightGray"/></w:rPr><w:t></w:t>');

    // === ПУНКТ 10.6. НАЛИЧИЕ ПОМЕЩЕНИЙ С ПОСТОЯННЫМ НАХОЖДЕНИЕМ ЛЮДЕЙ ===
    const presence = data.objectInfo.permanentPresence;
    this.logger.log(`Permanent presence: ${presence}`);
    // Определяем нужное значение
    let presenceValue = 'Предусмотрено'; // по умолчанию
    if (presence === 'Отсутствуют' || (presence && presence.toLowerCase().includes('отсутств'))) {
      presenceValue = 'Отсутствуют';
    } else if (presence === 'Не применимо' || (presence && presence.toLowerCase().includes('не примен'))) {
      presenceValue = 'Не применимо';
    }
    // Заменяем всю третью ячейку на выбранное значение
    content = this.replaceThirdCellContent(content, 'постоянным нахождением людей', presenceValue);

    // === ПУНКТ 11. ПРЕДПОЛАГАЕМЫЕ ТЕХНОГЕННЫЕ ВОЗДЕЙСТВИЯ ===
    this.logger.log(`Technogenic impact: ${data.objectInfo.technogenicImpact}`);
    // Убираем "Отсутствует" в любом случае
    content = this.replaceExact(content, '>Отсутствует</w:t>', '></w:t>');

    // === ПУНКТ 12. ДАННЫЕ О ГРАНИЦАХ ПЛОЩАДКИ ===
    // Заменяем всё содержимое третьей ячейки на boundaryDescription (генерируется нейронкой)
    if (data.boundaryDescription) {
      content = this.replaceThirdCellContent(
        content,
        'Данные о границах площадки',
        data.boundaryDescription,
      );
    }

    // === ПУНКТ 13. ТЕХНИЧЕСКИЕ ХАРАКТЕРИСТИКИ ===
    // Заменяем точку "." на описание
    if (data.technicalCharacteristics.description) {
      content = this.replaceExact(
        content,
        '><w:t>.</w:t>',
        `><w:t>${this.escapeXml(data.technicalCharacteristics.description)}</w:t>`,
      );
      // Также пробуем другой вариант
      content = this.replaceExact(content, '>. </w:t>', `>${this.escapeXml(data.technicalCharacteristics.description)} </w:t>`);
      content = this.replaceExact(content, '>.</w:t>', `>${this.escapeXml(data.technicalCharacteristics.description)}</w:t>`);
    }

    // Глубина земляных работ
    if (data.technicalCharacteristics.excavationDepth) {
      content = this.replaceExact(
        content,
        '>Глубина ведения земляных работ (</w:t>',
        `>Глубина ведения земляных работ: ${this.escapeXml(data.technicalCharacteristics.excavationDepth)} (</w:t>`,
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

    // === ПУНКТ 7. ЦЕЛИ И ЗАДАЧИ ===
    // Обрабатываем условные части текста
    content = this.processGoalsFlags(content, data.goalsFlags);

    // === ПУНКТ 14. ДОПОЛНИТЕЛЬНЫЕ ТРЕБОВАНИЯ (подтопляемость) ===
    // Если нет ИГМИ - убираем параграф про подтопляемость
    if (!data.surveyTypes.hydrometeorology) {
      content = this.removeParagraphContaining(content, 'Дать оценку потенциальной');
    }

    // === ПУНКТ 15. ОПАСНЫЕ ПРИРОДНЫЕ ПРОЦЕССЫ ===
    // Заменяем содержимое ячейки на извлечённые данные
    if (data.dangerousProcesses) {
      content = this.replaceThirdCellContent(
        content,
        'опасных природных процессов',
        data.dangerousProcesses,
      );
    }

    // === ПУНКТ 18. ТРЕБОВАНИЯ К СОСТАВЛЕНИЮ ПРОГНОЗА ===
    // Если нет ИГМИ - заменяем на "Не требуется"
    if (!data.surveyTypes.hydrometeorology) {
      content = this.replaceThirdCellContent(
        content,
        'составлению прогноза',
        'Не требуется',
      );
    }

    return content;
  }

  /**
   * Обработка пункта 9 - Виды инженерных изысканий
   * Оставляем только нужные виды
   */
  private processSurveyTypes(content: string, surveyTypes: TechnicalTaskData['surveyTypes']): string {
    this.logger.log(`Survey types: ИГМИ=${surveyTypes.hydrometeorology}, ИГИ=${surveyTypes.geology}, ИЭИ=${surveyTypes.ecology}`);

    // Удаляем ненужные виды изысканий
    if (!surveyTypes.hydrometeorology) {
      content = this.replaceText(content, 'Инженерно-гидрометеорологические изыскания', '');
    }
    if (!surveyTypes.geology) {
      content = this.replaceText(content, 'Инженерно-геологические изыскания', '');
    }
    if (!surveyTypes.ecology) {
      content = this.replaceText(content, 'Инженерно-экологические изыскания', '');
    }

    return content;
  }

  /**
   * Замена значения в контексте (рядом с определенным текстом)
   */
  private replaceInContext(content: string, context: string, oldValue: string, newValue: string): string {
    // Простая замена - ищем oldValue рядом с context
    // Для сложных случаев можно усложнить логику
    const contextIndex = content.indexOf(context);
    if (contextIndex === -1) return content;

    // Ищем oldValue в пределах 500 символов после контекста
    const searchStart = contextIndex;
    const searchEnd = Math.min(contextIndex + 500, content.length);
    const searchArea = content.substring(searchStart, searchEnd);
    
    if (searchArea.includes(oldValue)) {
      const valueIndex = content.indexOf(oldValue, searchStart);
      if (valueIndex !== -1 && valueIndex < searchEnd) {
        content = content.substring(0, valueIndex) + this.escapeXml(newValue) + content.substring(valueIndex + oldValue.length);
      }
    }

    return content;
  }

  /**
   * Обработка пункта 4 - Вид градостроительной деятельности
   * Оставляем только один вид
   */
  private processUrbanPlanningActivities(content: string, activities: TechnicalTaskData['urbanPlanningActivities']): string {
    // Находим выбранный вид
    let selectedActivity = 'Строительство'; // по умолчанию
    
    if (activities.architecturalDesign) selectedActivity = 'Архитектурно-строительное проектирование';
    else if (activities.capitalRepair) selectedActivity = 'Капитальный ремонт';
    else if (activities.reconstruction) selectedActivity = 'Реконструкция';
    else if (activities.territoryDevelopment) selectedActivity = 'Комплексное развитие территории и их благоустройство';
    else if (activities.territorialPlanning) selectedActivity = 'Территориальное планирование';
    else if (activities.urbanZoning) selectedActivity = 'Градостроительное зонирование';
    else if (activities.territoryPlanning) selectedActivity = 'Планировка территории';
    else if (activities.construction) selectedActivity = 'Строительство';
    else if (activities.demolition) selectedActivity = 'Снос объектов капитального строительства';
    else if (activities.buildingOperation) selectedActivity = 'Эксплуатация зданий, сооружений';

    this.logger.log(`Выбранный вид градостроительной деятельности: ${selectedActivity}`);

    // Удаляем ненужные виды (заменяем на пустую строку)
    const allActivities = [
      'Архитектурно-строительное проектирование',
      'Капитальный ремонт',
      'Реконструкция',
      'Комплексное развитие территории и их благоустройство',
      'Территориальное планирование',
      'Градостроительное зонирование, ',
      'Градостроительное зонирование',
      'Планировка территории',
      'Строительство, ',
      'Снос объектов капитального строительства',
      'Эксплуатация зданий, сооружений',
    ];

    for (const activity of allActivities) {
      // Пропускаем выбранный вид
      if (activity === selectedActivity || activity === selectedActivity + ', ' || activity === selectedActivity + ',') {
        continue;
      }
      // Удаляем текст этого вида
      content = this.replaceText(content, activity, '');
    }

    // Отдельно обрабатываем "Строительство" vs "Строительство, "
    if (selectedActivity !== 'Строительство') {
      content = this.replaceText(content, 'Строительство', '');
    }

    return content;
  }

  /**
   * Замена текста внутри XML (ищет в <w:t> тегах)
   */
  private replaceText(content: string, search: string, replace: string): string {
    // Ищем текст внутри тегов <w:t>...</w:t> и заменяем
    const escaped = this.escapeXml(search);
    if (content.includes(escaped)) {
      return content.split(escaped).join(this.escapeXml(replace));
    }
    // Также пробуем без экранирования (для простых строк)
    if (content.includes(search)) {
      return content.split(search).join(replace);
    }
    return content;
  }

  /**
   * Обработка пункта 7 - Цели и задачи
   * Удаляем условные части если флаги false
   */
  private processGoalsFlags(content: string, flags: TechnicalTaskData['goalsFlags']): string {
    if (!flags) return content;

    this.logger.log(`Флаги п.7: reconstruction=${flags.includeReconstruction}, agricultural=${flags.includeAgriculturalLand}, industrial=${flags.includeIndustrialLand}`);

    // Если нет реконструкции - убираем "и реконструкции"
    if (!flags.includeReconstruction) {
      content = this.replaceText(content, ' и реконструкции', '');
      content = this.replaceText(content, 'и реконструкции ', '');
      content = this.replaceText(content, 'и реконструкции', '');
    }

    // Если нет земель с/х - убираем эту часть
    if (!flags.includeAgriculturalLand) {
      content = this.replaceText(content, 'бывшие земли с/х назначения складывающаяся городская среда ', '');
      content = this.replaceText(content, 'бывшие земли с/х назначения складывающаяся городская среда', '');
    }

    // Если нет производственных земель - убираем эту часть
    if (!flags.includeIndustrialLand) {
      content = this.replaceText(content, 'земли объекта производственного назначения.', '');
      content = this.replaceText(content, 'земли объекта производственного назначения', '');
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
   * Замена содержимого третьей ячейки таблицы по маркеру во второй ячейке
   * @param content - XML контент
   * @param marker - текст для поиска строки таблицы
   * @param newCellContent - новый текст для третьей ячейки
   */
  private replaceThirdCellContent(content: string, marker: string, newCellContent: string): string {
    const markerIdx = content.indexOf(marker);
    if (markerIdx === -1) {
      this.logger.warn(`Маркер не найден: ${marker}`);
      return content;
    }

    // Находим строку таблицы <w:tr>...</w:tr>
    const rowStart = content.lastIndexOf('<w:tr', markerIdx);
    const rowEnd = content.indexOf('</w:tr>', markerIdx);
    if (rowStart === -1 || rowEnd === -1) {
      this.logger.warn(`Строка таблицы не найдена для маркера: ${marker}`);
      return content;
    }

    const row = content.substring(rowStart, rowEnd + 7);

    // Находим третью ячейку в строке (третью <w:tc>)
    let cellCount = 0;
    let thirdCellStart = -1;
    let thirdCellEnd = -1;
    let searchPos = 0;

    while (cellCount < 3) {
      const cellStart = row.indexOf('<w:tc>', searchPos);
      const cellStartAlt = row.indexOf('<w:tc ', searchPos);
      const actualStart = cellStart === -1 ? cellStartAlt : (cellStartAlt === -1 ? cellStart : Math.min(cellStart, cellStartAlt));

      if (actualStart === -1) break;

      cellCount++;
      if (cellCount === 3) {
        thirdCellStart = actualStart;
        // Находим конец этой ячейки
        thirdCellEnd = row.indexOf('</w:tc>', thirdCellStart);
      }
      searchPos = actualStart + 5;
    }

    if (thirdCellStart === -1 || thirdCellEnd === -1) {
      this.logger.warn(`Третья ячейка не найдена для маркера: ${marker}`);
      return content;
    }

    // Извлекаем третью ячейку
    const thirdCell = row.substring(thirdCellStart, thirdCellEnd + 7);

    // Находим конец <w:tcPr>...</w:tcPr> или начало контента
    const tcPrEnd = thirdCell.indexOf('</w:tcPr>');
    if (tcPrEnd === -1) {
      this.logger.warn(`tcPr не найден в третьей ячейке для маркера: ${marker}`);
      return content;
    }

    // Создаем новую ячейку с тем же tcPr но новым контентом
    const tcPrPart = thirdCell.substring(0, tcPrEnd + 9); // включая </w:tcPr>
    const newCell = `${tcPrPart}<w:p><w:pPr><w:spacing w:before="60" w:after="60"/><w:rPr><w:i/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:i/><w:szCs w:val="24"/></w:rPr><w:t>${this.escapeXml(newCellContent)}</w:t></w:r></w:p></w:tc>`;

    // Создаем новую строку
    const newRow = row.substring(0, thirdCellStart) + newCell + row.substring(thirdCellEnd + 7);

    // Заменяем строку в контенте
    return content.replace(row, newRow);
  }

  /**
   * Удаление параграфа содержащего указанный текст
   */
  private removeParagraphContaining(content: string, marker: string): string {
    const idx = content.indexOf(marker);
    if (idx === -1) {
      this.logger.warn(`Маркер не найден для удаления параграфа: ${marker}`);
      return content;
    }

    // Найдём начало и конец параграфа
    const pStart = content.lastIndexOf('<w:p ', idx);
    const pEnd = content.indexOf('</w:p>', idx);
    
    if (pStart === -1 || pEnd === -1) {
      this.logger.warn(`Параграф не найден для маркера: ${marker}`);
      return content;
    }

    // Удаляем параграф целиком
    return content.substring(0, pStart) + content.substring(pEnd + 6);
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
