import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Building2,
  FileText,
  FlaskConical,
  ClipboardList,
  Camera,
  FileSpreadsheet,
  Map,
  Mail,
  Users,
  Plus,
  Upload,
  Download,
  MousePointer,
  ArrowRight,
} from 'lucide-react';

function Section({
  title,
  icon: Icon,
  step,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  step: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 hover:bg-[var(--bg-tertiary)]/30 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center shrink-0">
          <span className="text-primary-400 font-bold">{step}</span>
        </div>
        <Icon className="w-5 h-5 text-primary-400 shrink-0" />
        <span className="text-lg font-medium flex-1 text-left">{title}</span>
        {open ? (
          <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-[var(--border-color)] pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

function Step({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
      </div>
      <div className="text-[var(--text-secondary)] leading-relaxed">{children}</div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 text-sm text-amber-300">
      <span className="font-medium">Важно:</span> {children}
    </div>
  );
}

export function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="w-8 h-8 text-primary-400" />
        <div>
          <h1 className="text-2xl font-bold">Инструкция по работе с системой</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Пошаговое руководство для сотрудников
          </p>
        </div>
      </div>

      <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-5">
        <h2 className="font-medium text-primary-400 mb-2">Общий порядок работы</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span className="px-2.5 py-1 bg-[var(--bg-tertiary)] rounded-lg">Компания</span>
          <ArrowRight className="w-4 h-4" />
          <span className="px-2.5 py-1 bg-[var(--bg-tertiary)] rounded-lg">Создание объекта</span>
          <ArrowRight className="w-4 h-4" />
          <span className="px-2.5 py-1 bg-[var(--bg-tertiary)] rounded-lg">Работа с пробами</span>
          <ArrowRight className="w-4 h-4" />
          <span className="px-2.5 py-1 bg-[var(--bg-tertiary)] rounded-lg">Фотоальбом</span>
          <ArrowRight className="w-4 h-4" />
          <span className="px-2.5 py-1 bg-[var(--bg-tertiary)] rounded-lg">Генерация документов</span>
          <ArrowRight className="w-4 h-4" />
          <span className="px-2.5 py-1 bg-[var(--bg-tertiary)] rounded-lg">Показатели</span>
        </div>
      </div>

      <Section title="Регистрация и компания" icon={Building2} step={1} defaultOpen>
        <Step icon={Users}>
          <strong>Регистрация.</strong> Перейдите на страницу регистрации, укажите имя, фамилию, email и пароль. После регистрации вы попадёте на главную страницу.
        </Step>
        <Step icon={Building2}>
          <strong>Создание компании.</strong> Перейдите в раздел <strong>Компания</strong> в левом меню. Нажмите «Создать компанию», укажите название и ИНН.
        </Step>
        <Step icon={Mail}>
          <strong>Приглашение сотрудников.</strong> На странице компании нажмите «Пригласить сотрудника». Укажите email и выберите роль (Администратор, Менеджер или Работник). Сотрудник получит ссылку-приглашение на email.
        </Step>
        <Tip>
          Только владелец и администратор могут приглашать новых сотрудников.
        </Tip>
      </Section>

      <Section title="Создание объекта" icon={FileText} step={2}>
        <Step icon={Plus}>
          Перейдите в раздел <strong>Объекты</strong> → нажмите <strong>«Новый объект»</strong>.
        </Step>
        <Step icon={Upload}>
          <strong>Загрузите два документа:</strong>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li><strong>ТЗ (техническое задание)</strong> — внутренний файл Word, подготовленный вашей компанией</li>
            <li><strong>Поручение</strong> — файл Word с поручением на выполнение работ</li>
          </ul>
        </Step>
        <Step icon={MousePointer}>
          <strong>Автоматическая обработка.</strong> После загрузки система автоматически:
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Извлечёт данные из документов (название, адрес, заказчик, услуги и т.д.)</li>
            <li>Сгенерирует пробы на основе поручения</li>
          </ul>
          Дождитесь окончания обработки (статус обновляется автоматически).
        </Step>
      </Section>

      <Section title="Работа с пробами" icon={FileSpreadsheet} step={3}>
        <Step icon={MousePointer}>
          На странице объекта нажмите <strong>«Пробы»</strong>. Пробы сгруппированы по площадкам (ПП1, ПП2, СК1, СК2 и т.д.).
        </Step>
        <Step icon={FileText}>
          <strong>Для каждой пробы можно указать:</strong>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li><strong>Характеристику грунта</strong> — например: супесь, суглинок, глина, песок</li>
            <li><strong>Координаты</strong> — широта и долгота (можно открыть точку на Яндекс.Картах)</li>
          </ul>
        </Step>
        <Step icon={MousePointer}>
          <strong>Отметка об отборе.</strong> После отбора пробы в поле — отметьте её как отобранную. Это обновит статистику: сколько проб отобрано, сколько осталось.
        </Step>
      </Section>

      <Section title="Фотоальбом" icon={Camera} step={4}>
        <Step icon={MousePointer}>
          На странице объекта нажмите <strong>«Фотоальбом»</strong>.
        </Step>
        <Step icon={Upload}>
          <strong>Загрузите фотографии</strong> — можно выбрать сразу несколько файлов.
        </Step>
        <Step icon={FileText}>
          <strong>Для каждого фото заполните:</strong>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Описание (что на фото)</li>
            <li>Дату съёмки</li>
            <li>GPS-координаты (опционально)</li>
          </ul>
          Фотографии можно переставлять местами кнопками вверх/вниз.
        </Step>
        <Step icon={Download}>
          <strong>Генерация фотоальбома.</strong> Нажмите кнопку генерации, укажите состав ПБ (исполнители). Система создаст презентацию PPTX.
        </Step>
      </Section>

      <Section title="Генерация документов" icon={Download} step={5}>
        <Step icon={MousePointer}>
          На странице объекта в разделе <strong>«Генерация документов»</strong> при необходимости укажите даты (опционально):
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Дата заявки ИЛЦ</li>
            <li>Дата заявки ФМБА</li>
            <li>Дата отбора проб</li>
          </ul>
        </Step>
        <Step icon={FileSpreadsheet}>
          <strong>Выберите режим генерации Excel:</strong>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li><strong>Полное задание</strong> — все документы в одном файле</li>
            <li><strong>Только акты</strong> — акты отбора проб</li>
            <li><strong>Только заявки</strong> — заявки в лабораторию</li>
            <li><strong>Только бирки</strong> — бирки на пробы</li>
            <li><strong>Таблички в поле</strong> — полевые таблички</li>
          </ul>
        </Step>
        <Step icon={Download}>
          Нажмите кнопку генерации — файл скачается автоматически.
        </Step>
      </Section>

      <Section title="Программа ИЭИ" icon={Map} step={6}>
        <Step icon={MousePointer}>
          На странице объекта нажмите <strong>«Программа ИЭИ»</strong> (доступна только для корневых объектов, не допотборов).
        </Step>
        <Step icon={FileText}>
          <strong>Заполните разделы:</strong>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li><strong>1.9.4 Обзорная схема</strong> — загрузите скриншот карты с местоположением объекта</li>
            <li><strong>1.10 Сведения ЕГРН</strong> — кадастровый номер, категория земель</li>
            <li><strong>4.2 Расстояние от офиса</strong> — рассчитается автоматически или введите вручную</li>
            <li><strong>3.2 Окружение участка</strong> — координаты, что находится к югу/востоку/западу/северу, площадь открытого грунта (%)</li>
            <li><strong>8.2 Сведения о загрязнении</strong> — проверьте ГИС ОГД по ссылке и опишите результат</li>
          </ul>
        </Step>
        <Step icon={Download}>
          Нажмите <strong>«Сгенерировать программу ИЭИ»</strong> — система создаст документ Word. Если автоматическое скачивание не сработало, в самом низу страницы появится кнопка <strong>«Скачать»</strong>.
        </Step>
      </Section>

      <Section title="Запросы справок" icon={Mail} step={7}>
        <Step icon={MousePointer}>
          На странице объекта нажмите <strong>«Запросы справок»</strong> (только для корневых объектов).
        </Step>
        <Step icon={FileText}>
          <strong>Выберите нужные справки</strong> (галочками), затем заполните:
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Номер запроса (средняя часть)</li>
            <li>Дату запроса</li>
            <li>Исполнителя (ФИО и телефон)</li>
            <li>Дополнительные поля: химические вещества (для ЦГМС), кадастровые кварталы (для МО), название администрации</li>
            <li>PDF приложение (опционально — добавится к каждой справке)</li>
          </ul>
        </Step>
        <Step icon={Download}>
          Нажмите <strong>«Сгенерировать»</strong>. Справки можно просмотреть в браузере или отправить на email.
        </Step>
      </Section>

      <Section title="Показатели (расчёты)" icon={FlaskConical} step={8}>
        <Step icon={Plus}>
          Перейдите в раздел <strong>Показатели</strong> в левом меню → <strong>«Загрузить протокол»</strong>.
        </Step>
        <Step icon={Upload}>
          Выберите объект и загрузите <strong>Excel-файл протокола</strong> лабораторных исследований. Загружается один протокол, содержащий данные по <strong>химии и ЕРН</strong> (естественные радионуклиды).
          Система автоматически извлечёт данные по каждой пробе и сопоставит с пробами объекта.
        </Step>
        <Step icon={MousePointer}>
          <strong>На странице показателей доступны таблицы:</strong>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li><strong>Химические показатели</strong> — pH, тяжёлые металлы (Cd, Cu, As, Ni, Hg, Pb, Zn), грунт</li>
            <li><strong>Бенз(а)пирен</strong> — концентрация, превышения ПДК, категория</li>
            <li><strong>Нефтепродукты</strong> — концентрация, превышения ПДК, категория</li>
            <li><strong>Тяжёлые металлы</strong> — два режима: «Превышения ПДК» и «K (фон)», расчёт Zc, категория загрязнения</li>
            <li><strong>Общая оценка загрязнения</strong> — сводная таблица: ТМ, Б/п, Общая, Н/п, Класс</li>
            <li><strong>Радиационные показатели (ЕРН)</strong> — Ra-226, Th-232, K-40, Cs-137, Аэфф (со статистикой)</li>
          </ul>
        </Step>
        <Step icon={Upload}>
          <strong>Биотестирование (опционально).</strong> Нажмите <strong>«Загрузить биотест»</strong> в правом верхнем углу и загрузите Excel-файл протокола биотестирования. Система извлечёт БКР и ТКР для каждой пробы и рассчитает класс опасности (IV или V) в таблице «Общая оценка загрязнения».
        </Step>
        <Tip>
          Все таблицы с расчётами можно скопировать в буфер обмена (кнопка копирования в заголовке секции) и вставить в Excel.
        </Tip>
      </Section>

      <Section title="Допотборы" icon={Plus} step={9}>
        <Step icon={MousePointer}>
          На странице <strong>корневого объекта</strong> в разделе <strong>«Допотборы»</strong> нажмите «Создать допотбор».
        </Step>
        <Step icon={Upload}>
          Укажите название и загрузите <strong>поручение</strong> (Word). Дочерний объект унаследует ТЗ от родителя.
        </Step>
        <Tip>
          Допотборы — это дополнительные этапы полевых работ по тому же объекту. Каждый допотбор работает как отдельный объект со своими пробами и документами.
        </Tip>
      </Section>

      <Section title="Обработка ТЗ" icon={ClipboardList} step={10}>
        <Step icon={Plus}>
          Перейдите в раздел <strong>ТЗ</strong> в левом меню → <strong>«Создать ТЗ»</strong>.
        </Step>
        <Step icon={Upload}>
          Укажите название и загрузите <strong>ТЗ заказчика</strong> (Word или PDF).
        </Step>
        <Step icon={MousePointer}>
          Система автоматически преобразует документ в корпоративный формат:
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>Извлечёт данные: объект, заказчик, технические характеристики, виды изысканий</li>
            <li>Сгенерирует Word-документ ТЗ в формате компании</li>
          </ul>
          Дождитесь обработки (статус: Черновик → Обработка → Готово).
        </Step>
        <Step icon={Download}>
          Результат можно <strong>скачать</strong>, <strong>просмотреть</strong> и <strong>отредактировать</strong> прямо в системе.
        </Step>
        <Tip>
          Функционал обработки ТЗ находится на ранней стадии разработки и может работать нестабильно. Результат рекомендуется внимательно проверять и корректировать вручную.
        </Tip>
      </Section>
    </div>
  );
}
