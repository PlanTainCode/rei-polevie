import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Flame,
  Droplets,
  Radiation,
  Atom,
  Activity,
  Copy,
  Check,
  Upload,
  Beaker,
} from 'lucide-react';

type ActiveTab = 'chemistry' | 'radiology';

// ПДК тяжёлых металлов (мг/кг) в зависимости от типа грунта и pH
const METALS_PDK = {
  Cd: { PS: 0.5, acid: 1, neutral: 2 },
  Cu: { PS: 33, acid: 66, neutral: 132 },
  As: { PS: 2, acid: 5, neutral: 10 },
  Ni: { PS: 20, acid: 40, neutral: 80 },
  Pb: { PS: 32, acid: 65, neutral: 130 },
  Zn: { PS: 55, acid: 110, neutral: 220 },
  Hg: { universal: 2.1 }, // Единый ПДК для ртути
};

// Фоновые значения для расчёта Zc
const BACKGROUND_VALUES = {
  moscow: { Cd: 0.3, Cu: 27, Hg: 0.1, As: 6.6, Ni: 20, Pb: 26, Zn: 52 },
  mo_ps: { Cd: 0.05, Cu: 8, Hg: 0.05, As: 1.5, Ni: 6, Pb: 6, Zn: 28 },
  mo_sg: { Cd: 0.12, Cu: 15, Hg: 0.1, As: 2.2, Ni: 30, Pb: 15, Zn: 45 },
};

type RegionType = 'moscow' | 'mo';
type MetalsViewType = 'excess' | 'k';

function detectRegionFromAddress(address: string | null | undefined): RegionType {
  if (!address) return 'moscow';
  const lower = address.toLowerCase();
  if (
    lower.includes('московская область') ||
    lower.includes('московская обл') ||
    lower.includes('моск. обл') ||
    /\bмо\b/.test(lower)
  ) {
    return 'mo';
  }
  return 'moscow';
}

import { indicatorsApi, IndicatorDetail, IndicatorSample, BiotestEntry } from '@/api/indicators';

function copyTableFromContainer(container: HTMLDivElement) {
  const tables = container.querySelectorAll('table');
  if (tables.length === 0) return;

  const allRows: string[] = [];
  tables.forEach((table) => {
    table.querySelectorAll('tbody tr, tfoot tr').forEach((row) => {
      const cells: string[] = [];
      row.querySelectorAll('td').forEach((cell) => {
        cells.push((cell as HTMLElement).innerText.trim());
      });
      if (cells.some((c) => c !== '')) {
        allRows.push(cells.join('\t'));
      }
    });
  });

  return allRows.join('\n');
}

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  copyable = false,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  copyable?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!contentRef.current) return;
    const text = copyTableFromContainer(contentRef.current);
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary-400" />
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {copyable && isOpen && (
            <button
              onClick={handleCopy}
              className={`p-1.5 rounded-lg transition-colors ${
                copied
                  ? 'text-green-400 bg-green-500/10'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
              title={copied ? 'Скопировано' : 'Копировать таблицу'}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-[var(--text-secondary)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
          )}
        </div>
      </div>
      {isOpen && (
        <div ref={contentRef} className="border-t border-[var(--border-color)]">{children}</div>
      )}
    </div>
  );
}

// Форматирование числа: максимум 3 знака после запятой, без незначащих нулей
function formatNumber(num: number): string {
  // Округляем до 3 знаков и убираем незначащие нули
  return parseFloat(num.toFixed(3)).toString();
}

// Форматирование значения показателя
function formatValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') {
    // Убираем суффиксы "(н)", "(n)" из значений
    const cleaned = value.replace(/\s*\([нnНN]\)\s*/g, '').trim();
    // Обработка "менее X" значений
    if (cleaned.toLowerCase().includes('менее')) {
      const num = cleaned.match(/[\d.,]+/);
      return num ? `<${num[0]}` : cleaned;
    }
    // Попробуем преобразовать в число для форматирования
    const parsed = parseFloat(cleaned.replace(',', '.'));
    if (!isNaN(parsed)) {
      return formatNumber(parsed);
    }
    return cleaned;
  }
  return formatNumber(value);
}

// Сортировка проб по слоям (номер после точки), затем по площадкам
// Например: 01АХ.01, 02АХ.01, 03АХ.01, 01АХ.02, 02АХ.02, 03АХ.02, ...
function sortSamplesByLayer(samples: IndicatorSample[]): IndicatorSample[] {
  return [...samples].sort((a, b) => {
    // Парсим шифр: "01АХ.01" -> площадка "01АХ", слой "01"
    const parseСipher = (cipher: string) => {
      const parts = cipher.split('.');
      const layer = parts[parts.length - 1] || '00'; // номер слоя (после последней точки)
      const site = parts.slice(0, -1).join('.') || cipher; // номер площадки (до точки)
      return { layer, site };
    };

    const aParsed = parseСipher(a.sampleCipher);
    const bParsed = parseСipher(b.sampleCipher);

    // Сначала сортируем по слою
    const layerCompare = aParsed.layer.localeCompare(bParsed.layer, undefined, { numeric: true });
    if (layerCompare !== 0) return layerCompare;

    // Затем по площадке
    return aParsed.site.localeCompare(bParsed.site, undefined, { numeric: true });
  });
}

export function IndicatorDetailPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [indicator, setIndicator] = useState<IndicatorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [region, setRegion] = useState<RegionType>('moscow');
  const [metalsView, setMetalsView] = useState<MetalsViewType>('excess');
  const [activeTab, setActiveTab] = useState<ActiveTab>('chemistry');
  const [uploadingBiotest, setUploadingBiotest] = useState(false);
  const biotestFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (projectId) {
      loadIndicator();
    }
  }, [projectId]);

  const loadIndicator = async () => {
    try {
      setLoading(true);
      const data = await indicatorsApi.getByProjectId(projectId!);
      setIndicator(data);
      setRegion(detectRegionFromAddress(data.project.objectAddress));
    } catch (err) {
      setError('Ошибка загрузки данных');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        'Вы уверены, что хотите удалить показатели? Это действие нельзя отменить.',
      )
    ) {
      return;
    }

    try {
      setDeleting(true);
      await indicatorsApi.delete(projectId!);
      navigate(`/projects/${projectId}`);
    } catch (err) {
      setError('Ошибка при удалении');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleBiotestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    try {
      setUploadingBiotest(true);
      await indicatorsApi.uploadBiotest(projectId, file);
      await loadIndicator();
    } catch (err) {
      setError('Ошибка загрузки файла биотестирования');
      console.error(err);
    } finally {
      setUploadingBiotest(false);
      if (biotestFileRef.current) biotestFileRef.current.value = '';
    }
  };

  const getBiotestClass = (cipher: string): string | null => {
    if (!indicator?.biotestData) return null;
    const entry = indicator.biotestData[cipher] as BiotestEntry | undefined;
    if (!entry) return null;
    if (entry.bkr === 1 && entry.tkr === 1) return 'V';
    if (entry.bkr > 1 || entry.tkr > 1) return 'IV';
    return null;
  };

  const getIndicatorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      SOIL_CHEMISTRY: 'Грунты (химия + ЕРН)',
      WATER_CHEMISTRY: 'Вода',
      SEDIMENT_CHEMISTRY: 'Донные отложения',
    };
    return labels[type] || type;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('ru-RU');
  };

  const getSoilTypeDisplay = (soilTypeCode: string | null) => {
    if (!soilTypeCode)
      return { label: '—', className: 'text-[var(--text-secondary)]' };
    if (soilTypeCode === 'ПС') return { label: 'ПС', className: 'text-amber-400' };
    if (soilTypeCode === 'СГ') return { label: 'СГ', className: 'text-blue-400' };
    return { label: soilTypeCode, className: '' };
  };

  // Получение значения химии из данных пробы
  const getChemValue = (
    sample: IndicatorSample,
    key: string,
  ): string | number | null => {
    const data = sample.chemistryData as Record<
      string,
      { value: string | number }
    > | null;
    return data?.[key]?.value ?? null;
  };

  // Получение значения радиации из данных пробы
  const getRadValue = (
    sample: IndicatorSample,
    key: string,
  ): string | number | null => {
    const data = sample.radiationData as Record<
      string,
      { value: string | number }
    > | null;
    const direct = data?.[key]?.value ?? null;
    if (direct !== null) return direct;

    // Расчёт Аэфф если отсутствует: Аэфф = Ra226 + 1.31*Th232 + 0.085*K40
    if (key === 'Aeff' && data) {
      const toNum = (v: string | number | undefined): number | null => {
        if (v === undefined || v === null) return null;
        if (typeof v === 'number') return v;
        const n = parseFloat(String(v).replace(',', '.'));
        return isNaN(n) ? null : n;
      };
      const ra = toNum(data.Ra226?.value);
      const th = toNum(data.Th232?.value);
      const k = toNum(data.K40?.value);
      if (ra !== null && th !== null && k !== null) {
        return Math.round(ra + 1.31 * th + 0.085 * k);
      }
    }
    return null;
  };

  // Проверка наличия радиационных данных хотя бы у одной пробы
  const hasRadiationData = indicator?.samples.some(
    (s) => s.radiationData && Object.keys(s.radiationData as object).length > 0,
  ) ?? false;


  // ПДК бензапирена = 0.02 мг/кг
  const BENZOPYRENE_PDK = 0.02;

  // Расчёт превышения бензапирена
  const calcBenzopyreneExcess = (
    value: string | number | null,
  ): string | number => {
    if (value === null || value === undefined) return 'нет';
    
    // Обработка строковых значений
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      // "более 2.0" -> 100
      if (lower.includes('более')) return 100;
      // "менее 0.005" -> нет превышения
      if (lower.includes('менее')) return 'нет';
      // Пробуем парсить число
      const num = parseFloat(value.replace(',', '.'));
      if (isNaN(num)) return 'нет';
      value = num;
    }

    // Расчёт превышения
    const excess = value / BENZOPYRENE_PDK;
    if (excess <= 1) return 'нет';
    return excess;
  };

  // Определение категории бензапирена
  const getBenzopyreneCategory = (
    concentration: string | number | null,
    excess: string | number,
  ): { label: string; className: string } => {
    // Если превышения нет — чистый
    if (excess === 'нет') {
      return { label: 'Ч', className: 'bg-green-600 text-white font-bold' };
    }

    // Если концентрация <0.005 -> Д
    if (typeof concentration === 'string' && concentration.toLowerCase().includes('менее')) {
      return { label: 'Д', className: 'bg-white/10 text-white' };
    }

    const excessNum = typeof excess === 'number' ? excess : parseFloat(String(excess));
    
    // превышение < 2 -> Д
    if (excessNum < 2) {
      return { label: 'Д', className: 'bg-white/10 text-white' };
    }
    
    // превышение <= 5 -> О (опасный/средний) - оранжевый
    if (excessNum <= 5) {
      return { label: 'О', className: 'bg-orange-500 text-white font-bold' };
    }
    
    // превышение > 5 -> ЧО (чрезвычайно опасный) - красный
    return { label: 'ЧО', className: 'bg-red-500 text-white font-bold' };
  };

  // ПДК нефтепродуктов = 1000 мг/кг
  const OIL_PRODUCTS_PDK = 1000;

  // Расчёт превышения нефтепродуктов
  const calcOilProductsExcess = (
    value: string | number | null,
  ): string | number => {
    if (value === null || value === undefined) return 'нет';
    
    // Обработка строковых значений
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      // "менее 50" -> нет превышения
      if (lower.includes('менее')) return 'нет';
      // Пробуем парсить число
      const num = parseFloat(value.replace(',', '.'));
      if (isNaN(num)) return 'нет';
      value = num;
    }

    // Расчёт превышения
    const excess = value / OIL_PRODUCTS_PDK;
    if (excess <= 1) return 'нет';
    return excess;
  };

  // Определение категории нефтепродуктов
  const getOilProductsCategory = (
    excess: string | number,
  ): { label: string; className: string } => {
    // Если превышения нет
    if (excess === 'нет') {
      return { label: 'Допустимый', className: 'bg-white/10 text-white' };
    }

    const excessNum = typeof excess === 'number' ? excess : parseFloat(String(excess));
    
    // превышение < 1 -> Допустимый
    if (excessNum < 1) {
      return { label: 'Допустимый', className: 'bg-white/10 text-white' };
    }
    
    // превышение <= 2 -> Низкий (серый)
    if (excessNum <= 2) {
      return { label: 'Низкий', className: 'bg-gray-500 text-white' };
    }
    
    // превышение <= 3 -> Средний (серый темнее)
    if (excessNum <= 3) {
      return { label: 'Средний', className: 'bg-gray-600 text-white' };
    }
    
    // превышение <= 5 -> Высокий (оранжевый)
    if (excessNum <= 5) {
      return { label: 'Высокий', className: 'bg-orange-500 text-white font-bold' };
    }
    
    // превышение > 5 -> Очень высокий (красный)
    return { label: 'Очень высокий', className: 'bg-red-500 text-white font-bold' };
  };

  // Расчёт превышения ПДК для металла
  const calcMetalExcess = (
    metal: keyof typeof METALS_PDK,
    value: string | number | null,
    soilType: string | null,
    pH: number | null,
  ): string | number => {
    if (value === null || value === undefined) return 'нет';
    
    let numValue: number;
    if (typeof value === 'string') {
      if (value.toLowerCase().includes('менее')) return 'нет';
      numValue = parseFloat(value.replace(',', '.'));
      if (isNaN(numValue)) return 'нет';
    } else {
      numValue = value;
    }

    // Для ртути - единый ПДК
    if (metal === 'Hg') {
      const pdk = METALS_PDK.Hg.universal;
      const excess = numValue / pdk;
      return excess <= 1 ? 'нет' : excess;
    }

    // Для остальных металлов - зависит от типа грунта и pH
    const metalPdk = METALS_PDK[metal] as { PS: number; acid: number; neutral: number };
    let pdk: number;
    
    if (soilType === 'ПС') {
      pdk = metalPdk.PS;
    } else if (pH !== null && pH < 5.5) {
      pdk = metalPdk.acid;
    } else {
      pdk = metalPdk.neutral;
    }

    const excess = numValue / pdk;
    return excess <= 1 ? 'нет' : excess;
  };

  // Расчёт коэффициента K = концентрация / фон
  const calcMetalK = (
    metal: keyof typeof BACKGROUND_VALUES.moscow,
    value: string | number | null,
    soilType: string | null,
    regionType: 'moscow' | 'mo',
  ): number => {
    if (value === null || value === undefined) return 0;
    
    let numValue: number;
    if (typeof value === 'string') {
      if (value.toLowerCase().includes('менее')) return 0;
      numValue = parseFloat(value.replace(',', '.'));
      if (isNaN(numValue)) return 0;
    } else {
      numValue = value;
    }

    // Выбираем фоновое значение
    let background: number;
    if (regionType === 'moscow') {
      background = BACKGROUND_VALUES.moscow[metal];
    } else {
      background = soilType === 'ПС' 
        ? BACKGROUND_VALUES.mo_ps[metal] 
        : BACKGROUND_VALUES.mo_sg[metal];
    }

    return numValue / background;
  };

  // Расчёт Zc (суммарный показатель загрязнения)
  const calcZc = (
    sample: IndicatorSample,
    regionType: RegionType,
  ): number => {
    const soilType = sample.soilTypeCode;
    
    // Выбираем фоновые значения
    let background: typeof BACKGROUND_VALUES.moscow;
    if (regionType === 'moscow') {
      background = BACKGROUND_VALUES.moscow;
    } else {
      background = soilType === 'ПС' ? BACKGROUND_VALUES.mo_ps : BACKGROUND_VALUES.mo_sg;
    }

    const metals: (keyof typeof background)[] = ['Cd', 'Cu', 'As', 'Ni', 'Hg', 'Pb', 'Zn'];
    let sum = 0;

    for (const metal of metals) {
      const value = getChemValue(sample, metal);
      if (value === null) continue;

      let numValue: number;
      if (typeof value === 'string') {
        if (value.toLowerCase().includes('менее')) continue;
        numValue = parseFloat(value.replace(',', '.'));
        if (isNaN(numValue)) continue;
      } else {
        numValue = value;
      }

      const Kc = numValue / background[metal];
      if (Kc >= 1) {
        sum += Kc - 1;
      }
    }

    return sum + 1;
  };

  // Проверка наличия хотя бы одного превышения ПДК у пробы
  const hasAnyMetalExcess = (sample: IndicatorSample): boolean => {
    const soilType = sample.soilTypeCode;
    const pH = getChemValue(sample, 'pH');
    const pHNum = typeof pH === 'number' ? pH : (typeof pH === 'string' ? parseFloat(pH.replace(',', '.')) : null);
    const metals: (keyof typeof METALS_PDK)[] = ['Cd', 'Cu', 'As', 'Ni', 'Hg', 'Pb', 'Zn'];
    return metals.some(metal => {
      const excess = calcMetalExcess(metal, getChemValue(sample, metal), soilType, pHNum);
      return typeof excess === 'number';
    });
  };

  // Категория по Zc с учётом наличия превышений ПДК
  const getZcCategory = (zc: number, hasExcess: boolean): { label: string; className: string } => {
    if (zc < 16) {
      if (!hasExcess) return { label: 'Ч', className: 'bg-green-600 text-white font-bold' };
      return { label: 'Д', className: 'bg-white/10 text-white' };
    }
    if (zc <= 32) return { label: 'УО', className: 'bg-yellow-500 text-white font-bold' };
    if (zc <= 128) return { label: 'О', className: 'bg-orange-500 text-white font-bold' };
    return { label: 'ЧО', className: 'bg-red-500 text-white font-bold' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !indicator) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            to={`/projects/${projectId}`}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Показатели</h1>
        </div>
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error || 'Показатели не найдены'}
        </div>
      </div>
    );
  }

  const matchedCount = indicator.samples.filter((s) => s.isMatched).length;
  const totalCount = indicator.samples.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/projects/${projectId}`}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{indicator.project.name}</h1>
              {indicator.project.documentNumber && (
                <span className="px-2 py-0.5 text-sm bg-[var(--bg-tertiary)] rounded">
                  {indicator.project.documentNumber}
                </span>
              )}
            </div>
            {indicator.project.objectAddress && (
              <p className="text-[var(--text-secondary)] mt-1">
                {indicator.project.objectAddress}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={biotestFileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleBiotestUpload}
          />
          <button
            onClick={() => biotestFileRef.current?.click()}
            disabled={uploadingBiotest}
            className="flex items-center gap-2 px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            {uploadingBiotest ? (
              <div className="animate-spin w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            <span>{indicator.biotestFileName ? 'Обновить' : 'Загрузить'} биотест</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            {deleting ? (
              <div className="animate-spin w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
            <span>Удалить</span>
          </button>
        </div>
      </div>

      {/* Protocol info */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-6 h-6 text-primary-400" />
          <h2 className="text-lg font-medium">Информация о протоколе</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-[var(--text-secondary)]">Тип</div>
            <div className="font-medium">
              {getIndicatorTypeLabel(indicator.type)}
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--text-secondary)]">
              Номер протокола
            </div>
            <div className="font-medium">
              {indicator.protocolNumber || '—'}
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--text-secondary)]">
              Дата отбора
            </div>
            <div className="font-medium">
              {formatDate(indicator.samplingDate)}
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--text-secondary)]">
              Период испытаний
            </div>
            <div className="font-medium">
              {indicator.testingDateFrom
                ? `${formatDate(indicator.testingDateFrom)} — ${formatDate(indicator.testingDateTo)}`
                : '—'}
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex items-center gap-4">
          <div className="flex items-center gap-2">
            {matchedCount === totalCount ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400" />
            )}
            <span>
              {matchedCount}/{totalCount} проб сопоставлено с объектом
            </span>
          </div>
          {indicator.biotestFileName && (
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              <Beaker className="w-4 h-4" />
              <span>Биотестирование: {indicator.biotestFileName}</span>
              <span className="text-xs">
                ({Object.keys(indicator.biotestData || {}).length} проб)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <span className="text-[var(--text-secondary)]">Тип грунта:</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-amber-400">ПС</span>
            <span className="text-[var(--text-secondary)]">— песок/супесь</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-400">СГ</span>
            <span className="text-[var(--text-secondary)]">
              — суглинок/глина
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--text-secondary)]">—</span>
            <span className="text-[var(--text-secondary)]">
              — нет характеристики
            </span>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('chemistry')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'chemistry'
              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          Химия
        </button>
        <button
          onClick={() => setActiveTab('radiology')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'radiology'
              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'
          }`}
          disabled={!hasRadiationData}
          title={!hasRadiationData ? 'Нет данных радиологии в протоколе' : undefined}
        >
          <Atom className="w-4 h-4" />
          Радиология
          {!hasRadiationData && (
            <span className="text-xs opacity-50">(нет данных)</span>
          )}
        </button>
      </div>

      {/* Samples table (collapsible) */}
      <CollapsibleSection
        title="Сопоставление проб"
        icon={HelpCircle}
        defaultOpen={true}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">
                  Шифр пробы
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">
                  Тип грунта
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">
                  Глубина
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">
                  Характеристика
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-secondary)]">
                  Сопоставлено
                </th>
              </tr>
            </thead>
            <tbody>
              {sortSamplesByLayer(indicator.samples).map((sample) => {
                const soilType = getSoilTypeDisplay(sample.soilTypeCode);
                return (
                  <tr
                    key={sample.id}
                    className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-tertiary)]/50"
                  >
                    <td className="px-4 py-3 font-medium">
                      {sample.sampleCipher}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${soilType.className}`}
                    >
                      {soilType.label}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {sample.matchedSample?.depthLabel || '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {sample.matchedSample?.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sample.isMatched ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto" />
                      ) : (
                        <HelpCircle className="w-5 h-5 text-amber-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* === CHEMISTRY TAB === */}
      {activeTab === 'chemistry' && (
      <>

      {/* Chemistry table (collapsible) */}
      <CollapsibleSection
        title="Химические показатели (тяжёлые металлы)"
        icon={FlaskConical}
        defaultOpen={true}
        copyable
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Номер пробы
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Слой
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Грунт
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  pH
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Cd
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Cu
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  As
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Ni
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Hg
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Pb
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Zn
                </th>
              </tr>
            </thead>
            <tbody>
              {sortSamplesByLayer(indicator.samples).map((sample) => {
                const soilType = getSoilTypeDisplay(sample.soilTypeCode);
                const pH = getChemValue(sample, 'pH');
                return (
                  <tr
                    key={sample.id}
                    className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-tertiary)]/50"
                  >
                    <td className="px-3 py-2 font-medium">
                      {sample.sampleCipher}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {sample.matchedSample?.depthLabel || '—'}
                    </td>
                    <td
                      className={`px-3 py-2 text-center font-medium ${soilType.className}`}
                    >
                      {soilType.label}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {formatValue(pH)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {formatValue(getChemValue(sample, 'Cd'))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {formatValue(getChemValue(sample, 'Cu'))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {formatValue(getChemValue(sample, 'As'))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {formatValue(getChemValue(sample, 'Ni'))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {formatValue(getChemValue(sample, 'Hg'))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {formatValue(getChemValue(sample, 'Pb'))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {formatValue(getChemValue(sample, 'Zn'))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
          Единицы измерения: Cd, Cu, As, Ni, Hg, Pb, Zn — мг/кг; pH — ед. pH
        </div>
      </CollapsibleSection>

      {/* Benzopyrene table (collapsible) */}
      <CollapsibleSection
        title="Бенз(а)пирен"
        icon={Flame}
        defaultOpen={true}
        copyable
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Номер пробы
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Слой
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Концентрация бенз(а)пирена
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Превышения
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Категория
                </th>
              </tr>
            </thead>
            <tbody>
              {sortSamplesByLayer(indicator.samples).map((sample) => {
                const benzValue = getChemValue(sample, 'benzapyrene');
                const benzUncertainty = (sample.chemistryData as Record<string, { uncertainty?: string }> | null)?.benzapyrene?.uncertainty;
                const excess = calcBenzopyreneExcess(benzValue);
                const category = getBenzopyreneCategory(benzValue, excess);
                
                // Форматирование концентрации с погрешностью
                let concentrationDisplay = '—';
                if (benzValue !== null) {
                  const formattedValue = formatValue(benzValue);
                  if (benzUncertainty) {
                    concentrationDisplay = `${formattedValue} ± ${benzUncertainty}`;
                  } else {
                    concentrationDisplay = formattedValue;
                  }
                }

                // Форматирование превышения
                const excessDisplay = typeof excess === 'number' 
                  ? formatValue(excess) 
                  : excess;

                return (
                  <tr
                    key={sample.id}
                    className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-tertiary)]/50"
                  >
                    <td className="px-3 py-2 font-medium">
                      {sample.sampleCipher}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {sample.matchedSample?.depthLabel || '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {concentrationDisplay}
                    </td>
                    <td className="px-3 py-2 text-center font-medium">
                      {excessDisplay}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-3 py-1 rounded ${category.className}`}>
                        {category.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-[var(--border-color)]">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-[var(--text-secondary)]">Категории:</span>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-green-600 text-white font-bold">Ч</span>
              <span className="text-[var(--text-secondary)]">— чистый</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-white/10 text-white">Д</span>
              <span className="text-[var(--text-secondary)]">— допустимый</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-orange-500 text-white font-bold">О</span>
              <span className="text-[var(--text-secondary)]">— опасный (средний)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-red-500 text-white font-bold">ЧО</span>
              <span className="text-[var(--text-secondary)]">— чрезвычайно опасный (высокий)</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            ПДК бенз(а)пирена = 0,02 мг/кг. Единицы измерения: мг/кг
          </div>
        </div>
      </CollapsibleSection>

      {/* Oil products table (collapsible) */}
      <CollapsibleSection
        title="Нефтепродукты"
        icon={Droplets}
        defaultOpen={true}
        copyable
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Номер пробы
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Слой
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Концентрация нефтепродуктов
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Превышения
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Категория
                </th>
              </tr>
            </thead>
            <tbody>
              {sortSamplesByLayer(indicator.samples).map((sample) => {
                const oilValue = getChemValue(sample, 'oilProducts');
                const oilUncertainty = (sample.chemistryData as Record<string, { uncertainty?: string }> | null)?.oilProducts?.uncertainty;
                const excess = calcOilProductsExcess(oilValue);
                const category = getOilProductsCategory(excess);
                
                // Форматирование концентрации с погрешностью
                let concentrationDisplay = '—';
                if (oilValue !== null) {
                  const formattedValue = formatValue(oilValue);
                  if (oilUncertainty) {
                    concentrationDisplay = `${formattedValue} ± ${oilUncertainty}`;
                  } else {
                    concentrationDisplay = formattedValue;
                  }
                }

                // Форматирование превышения
                const excessDisplay = typeof excess === 'number' 
                  ? formatValue(excess) 
                  : excess;

                return (
                  <tr
                    key={sample.id}
                    className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-tertiary)]/50"
                  >
                    <td className="px-3 py-2 font-medium">
                      {sample.sampleCipher}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {sample.matchedSample?.depthLabel || '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {concentrationDisplay}
                    </td>
                    <td className="px-3 py-2 text-center font-medium">
                      {excessDisplay}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-3 py-1 rounded ${category.className}`}>
                        {category.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-[var(--border-color)]">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-[var(--text-secondary)]">Категории:</span>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-white/10 text-white">Допустимый</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-gray-500 text-white">Низкий</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-gray-600 text-white">Средний</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-orange-500 text-white font-bold">Высокий</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-red-500 text-white font-bold">Очень высокий</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            ПДК нефтепродуктов = 1000 мг/кг. Единицы измерения: мг/кг
          </div>
        </div>
      </CollapsibleSection>

      {/* Heavy metals table with view switcher */}
      <CollapsibleSection
        title="Тяжёлые металлы"
        icon={Radiation}
        defaultOpen={true}
        copyable
      >
        {/* View selector */}
        <div className="p-4 border-b border-[var(--border-color)] flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMetalsView('excess')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                metalsView === 'excess'
                  ? 'bg-primary-500 text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/80'
              }`}
            >
              Превышения ПДК
            </button>
            <button
              onClick={() => setMetalsView('k')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                metalsView === 'k'
                  ? 'bg-primary-500 text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/80'
              }`}
            >
              K (фон {region === 'moscow' ? 'Москва' : 'МО'})
            </button>
          </div>
          <div className="ml-auto text-xs text-[var(--text-secondary)]">
            Регион: <span className="font-medium text-[var(--text-primary)]">{region === 'moscow' ? 'Москва' : 'Московская область'}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Номер пробы
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Слой
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Cd
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Cu
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  As
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Ni
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Hg
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Pb
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Zn
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap bg-primary-500/20">
                  Zc
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Категория
                </th>
              </tr>
            </thead>
            <tbody>
              {sortSamplesByLayer(indicator.samples).map((sample) => {
                const soilType = sample.soilTypeCode;
                const pH = getChemValue(sample, 'pH');
                const pHNum = typeof pH === 'number' ? pH : (typeof pH === 'string' ? parseFloat(pH.replace(',', '.')) : null);
                
                // Значения в зависимости от выбранного режима
                const getValueForView = (metal: keyof typeof BACKGROUND_VALUES.moscow) => {
                  if (metalsView === 'excess') {
                    return calcMetalExcess(metal, getChemValue(sample, metal), soilType, pHNum);
                  }
                  return calcMetalK(metal, getChemValue(sample, metal), soilType, region);
                };

                const cdVal = getValueForView('Cd');
                const cuVal = getValueForView('Cu');
                const asVal = getValueForView('As');
                const niVal = getValueForView('Ni');
                const hgVal = getValueForView('Hg');
                const pbVal = getValueForView('Pb');
                const znVal = getValueForView('Zn');
                
                const zc = calcZc(sample, region);
                const zcCategory = getZcCategory(zc, hasAnyMetalExcess(sample));

                const formatCellValue = (v: string | number) => {
                  if (typeof v === 'string') return v;
                  return parseFloat(v.toFixed(1)).toString();
                };

                // Подсветка для таблицы превышений
                const getExcessClass = (v: string | number) => {
                  if (metalsView !== 'excess') return '';
                  if (v === 'нет') return '';
                  const num = typeof v === 'number' ? v : parseFloat(String(v));
                  if (num > 2) return 'text-red-400 font-medium';
                  if (num > 1) return 'text-yellow-400 font-medium';
                  return '';
                };

                // Подсветка для K-таблиц (K >= 1 значит выше фона)
                const getKClass = (v: string | number) => {
                  if (metalsView === 'excess') return '';
                  const num = typeof v === 'number' ? v : 0;
                  if (num >= 2) return 'text-red-400 font-medium';
                  if (num >= 1) return 'text-yellow-400 font-medium';
                  return '';
                };

                return (
                  <tr
                    key={sample.id}
                    className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-tertiary)]/50"
                  >
                    <td className="px-3 py-2 font-medium">
                      {sample.sampleCipher}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {sample.matchedSample?.depthLabel || '—'}
                    </td>
                    <td className={`px-3 py-2 text-center ${getExcessClass(cdVal)} ${getKClass(cdVal)}`}>
                      {formatCellValue(cdVal)}
                    </td>
                    <td className={`px-3 py-2 text-center ${getExcessClass(cuVal)} ${getKClass(cuVal)}`}>
                      {formatCellValue(cuVal)}
                    </td>
                    <td className={`px-3 py-2 text-center ${getExcessClass(asVal)} ${getKClass(asVal)}`}>
                      {formatCellValue(asVal)}
                    </td>
                    <td className={`px-3 py-2 text-center ${getExcessClass(niVal)} ${getKClass(niVal)}`}>
                      {formatCellValue(niVal)}
                    </td>
                    <td className={`px-3 py-2 text-center ${getExcessClass(hgVal)} ${getKClass(hgVal)}`}>
                      {formatCellValue(hgVal)}
                    </td>
                    <td className={`px-3 py-2 text-center ${getExcessClass(pbVal)} ${getKClass(pbVal)}`}>
                      {formatCellValue(pbVal)}
                    </td>
                    <td className={`px-3 py-2 text-center ${getExcessClass(znVal)} ${getKClass(znVal)}`}>
                      {formatCellValue(znVal)}
                    </td>
                    <td className="px-3 py-2 text-center bg-primary-500/10 font-medium">
                      {parseFloat(zc.toFixed(1)).toString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-3 py-1 rounded ${zcCategory.className}`}>
                        {zcCategory.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-[var(--border-color)]">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-[var(--text-secondary)]">Категории по Zc:</span>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-green-600 text-white font-bold">Ч</span>
              <span className="text-[var(--text-secondary)]">— чистый (Zc&lt;16, нет превышений ПДК)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-white/10 text-white">Д</span>
              <span className="text-[var(--text-secondary)]">— допустимый (Zc&lt;16, есть превышения)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-yellow-500 text-white font-bold">УО</span>
              <span className="text-[var(--text-secondary)]">— умеренно опасный (16-32)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-orange-500 text-white font-bold">О</span>
              <span className="text-[var(--text-secondary)]">— опасный (32-128)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-red-500 text-white font-bold">ЧО</span>
              <span className="text-[var(--text-secondary)]">— чрезвычайно опасный (&gt;128)</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            {metalsView === 'excess' && 'Превышения ПДК с учётом типа грунта и pH.'}
            {metalsView === 'k' && region === 'moscow' && 'K = концентрация / фон (Москва). Фон: Cd=0.3, Cu=27, As=6.6, Ni=20, Hg=0.1, Pb=26, Zn=52'}
            {metalsView === 'k' && region === 'mo' && 'K = концентрация / фон (МО). Фон зависит от типа грунта: ПС или СГ'}
            {' '}Zc рассчитан по фону: {region === 'moscow' ? 'Москва' : 'МО'}.
          </div>
        </div>
      </CollapsibleSection>

      {/* General assessment table */}
      <CollapsibleSection
        title="Общая оценка загрязнения"
        icon={AlertCircle}
        defaultOpen={true}
        copyable
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Номер пробы
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  ПП/СК
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Слой
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  ТМ
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Б/п
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap bg-primary-500/20">
                  Общая
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Н/п
                </th>
                <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  Класс
                </th>
              </tr>
            </thead>
            <tbody>
              {sortSamplesByLayer(indicator.samples).map((sample) => {
                // Категория ТМ (по Zc)
                const zc = calcZc(sample, region);
                const tmCategory = getZcCategory(zc, hasAnyMetalExcess(sample));

                // Категория бензапирена
                const benzapyreneConc = getChemValue(sample, 'benzapyrene');
                const benzapyreneExcess = calcBenzopyreneExcess(benzapyreneConc);
                const benzapyreneCategory = getBenzopyreneCategory(benzapyreneConc, benzapyreneExcess);

                // Категория нефтепродуктов
                const oilConc = getChemValue(sample, 'oilProducts');
                const oilExcess = calcOilProductsExcess(oilConc);
                const oilCategory = getOilProductsCategory(oilExcess);

                // Общая категория = максимум из ТМ и Б/п
                const categoryOrder = ['Ч', 'Д', 'УО', 'О', 'ЧО'];
                const tmIdx = categoryOrder.indexOf(tmCategory.label);
                const bpIdx = categoryOrder.indexOf(benzapyreneCategory.label);
                const maxIdx = Math.max(tmIdx, bpIdx);
                const overallLabel = categoryOrder[maxIdx] || 'Д';
                
                const getCategoryClass = (label: string) => {
                  switch (label) {
                    case 'ЧО': return 'bg-red-500 text-white font-bold';
                    case 'О': return 'bg-orange-500 text-white font-bold';
                    case 'УО': return 'bg-yellow-500 text-white font-bold';
                    case 'Ч': return 'bg-green-600 text-white font-bold';
                    default: return 'bg-white/10 text-white';
                  }
                };

                return (
                  <tr
                    key={sample.id}
                    className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-tertiary)]/50"
                  >
                    <td className="px-3 py-2 font-medium">
                      {sample.sampleCipher}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {sample.matchedSample?.platform?.label || '—'}
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">
                      {sample.matchedSample?.depthLabel || '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded ${tmCategory.className}`}>
                        {tmCategory.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded ${benzapyreneCategory.className}`}>
                        {benzapyreneCategory.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center bg-primary-500/10">
                      <span className={`inline-block px-3 py-1 rounded ${getCategoryClass(overallLabel)}`}>
                        {overallLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {oilCategory.label}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {(() => {
                        const hasChO = tmCategory.label === 'ЧО' || benzapyreneCategory.label === 'ЧО' || overallLabel === 'ЧО';
                        if (!hasChO) return <span className="text-[var(--text-secondary)]">—</span>;
                        const cls = getBiotestClass(sample.sampleCipher);
                        if (!cls) return <span className="text-[var(--text-secondary)]">—</span>;
                        return (
                          <span className={`inline-block px-2 py-0.5 rounded font-bold ${cls === 'V' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                            {cls}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-[var(--border-color)]">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-[var(--text-secondary)]">Категории:</span>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-green-600 text-white font-bold">Ч</span>
              <span className="text-[var(--text-secondary)]">— чистый</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-white/10 text-white">Д</span>
              <span className="text-[var(--text-secondary)]">— допустимый</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-yellow-500 text-white font-bold">УО</span>
              <span className="text-[var(--text-secondary)]">— умеренно опасный</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-orange-500 text-white font-bold">О</span>
              <span className="text-[var(--text-secondary)]">— опасный</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block px-2 py-0.5 rounded bg-red-500 text-white font-bold">ЧО</span>
              <span className="text-[var(--text-secondary)]">— чрезвычайно опасный</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-[var(--text-secondary)]">
            ТМ = тяжёлые металлы (по Zc), Б/п = бензапирен, Н/п = нефтепродукты. 
            Общая = максимальная категория из ТМ и Б/п. Класс V = по биотестированию.
          </div>
        </div>
      </CollapsibleSection>

      </>
      )}

      {/* === RADIOLOGY TAB === */}
      {activeTab === 'radiology' && hasRadiationData && (
      <>

      {/* ERN data table with summary statistics */}
      <CollapsibleSection
        title="Радиационные показатели (ЕРН)"
        icon={Atom}
        defaultOpen={true}
        copyable
      >
        {(() => {
          // Собираем числовые значения для статистики (как в Excel: AVERAGE, MIN, MAX)
          const nuclideKeys = ['Ra226', 'Th232', 'K40', 'Cs137', 'Aeff'] as const;
          const stats: Record<string, { values: number[]; avg: number; min: number; max: number; stdev: number }> = {};
          
          for (const key of nuclideKeys) {
            const nums: number[] = [];
            for (const s of indicator.samples) {
              const v = getRadValue(s, key);
              if (v === null) continue;
              let n: number;
              if (typeof v === 'string') {
                if (v.toLowerCase().includes('менее')) continue;
                n = parseFloat(v.replace(',', '.'));
                if (isNaN(n)) continue;
              } else {
                n = v;
              }
              nums.push(n);
            }
            const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
            const min = nums.length > 0 ? Math.min(...nums) : 0;
            const max = nums.length > 0 ? Math.max(...nums) : 0;
            const variance = nums.length > 1 
              ? nums.reduce((sum, x) => sum + (x - avg) ** 2, 0) / (nums.length - 1) 
              : 0;
            const stdev = Math.sqrt(variance);
            stats[key] = { values: nums, avg, min, max, stdev };
          }

          return (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                      <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                        Номер пробы
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                        ПП/СК
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">
                        Слой
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                        Ra-226
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                        Th-232
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                        K-40
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap bg-primary-500/20">
                        Аэфф
                      </th>
                      <th className="px-3 py-2 text-center font-medium text-[var(--text-secondary)] whitespace-nowrap">
                        Cs-137
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortSamplesByLayer(indicator.samples).map((sample) => {
                      const ra226 = getRadValue(sample, 'Ra226');
                      const th232 = getRadValue(sample, 'Th232');
                      const k40 = getRadValue(sample, 'K40');
                      const cs137 = getRadValue(sample, 'Cs137');
                      const aeff = getRadValue(sample, 'Aeff');

                      return (
                        <tr
                          key={sample.id}
                          className="border-b border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]/50"
                        >
                          <td className="px-3 py-2 font-medium">
                            {sample.sampleCipher}
                          </td>
                          <td className="px-3 py-2 text-[var(--text-secondary)]">
                            {sample.matchedSample?.platform?.label || '—'}
                          </td>
                          <td className="px-3 py-2 text-[var(--text-secondary)]">
                            {sample.matchedSample?.depthLabel || '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {formatValue(ra226)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {formatValue(th232)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {formatValue(k40)}
                          </td>
                          <td className="px-3 py-2 text-center bg-primary-500/10 font-medium">
                            {formatValue(aeff)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {formatValue(cs137)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Summary statistics like Excel: AVERAGE, MIN, MAX, STDEV */}
                  <tfoot>
                    {[
                      { label: 'Среднее', fn: 'avg' as const },
                      { label: 'Мин', fn: 'min' as const },
                      { label: 'Макс', fn: 'max' as const },
                      { label: 'δ (ст.откл.)', fn: 'stdev' as const },
                    ].map((row) => (
                      <tr
                        key={row.label}
                        className="border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/50"
                      >
                        <td className="px-3 py-2 font-medium text-[var(--text-secondary)]" colSpan={3}>
                          {row.label}
                        </td>
                        <td className="px-3 py-2 text-center font-medium">
                          {stats.Ra226.values.length > 0 ? formatValue(stats.Ra226[row.fn]) : '—'}
                        </td>
                        <td className="px-3 py-2 text-center font-medium">
                          {stats.Th232.values.length > 0 ? formatValue(stats.Th232[row.fn]) : '—'}
                        </td>
                        <td className="px-3 py-2 text-center font-medium">
                          {stats.K40.values.length > 0 ? formatValue(stats.K40[row.fn]) : '—'}
                        </td>
                        <td className="px-3 py-2 text-center bg-primary-500/10 font-medium">
                          {stats.Aeff.values.length > 0 ? formatValue(stats.Aeff[row.fn]) : '—'}
                        </td>
                        <td className="px-3 py-2 text-center font-medium">
                          {stats.Cs137.values.length > 0 ? formatValue(stats.Cs137[row.fn]) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tfoot>
                </table>
              </div>
              <div className="p-3 border-t border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
                Единицы измерения: Ra-226, Th-232, K-40, Cs-137, Аэфф — Бк/кг. 
                ЕРН — естественные радионуклиды. δ — стандартное отклонение (как STDEV в Excel).
              </div>
            </>
          );
        })()}
      </CollapsibleSection>

      {/* МЭД ГИ section — placeholder, field measurements */}
      <CollapsibleSection
        title="МЭД ГИ (мощность дозы гамма-излучения)"
        icon={Radiation}
        defaultOpen={false}
      >
        <div className="p-6 text-center">
          <Radiation className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-40" />
          <p className="text-[var(--text-secondary)] mb-2">
            Данные МЭД ГИ — результаты полевых измерений дозиметром
          </p>
          <p className="text-xs text-[var(--text-secondary)] opacity-70">
            Формулы из расчёта: H+d(H) = значение + погрешность, среднее = AVERAGE, δ = STDEV, макс = MAX, мин = MIN.
            <br />
            Критерий: среднее + δ сравнивается с фоновым значением МЭД ГИ.
          </p>
        </div>
      </CollapsibleSection>

      {/* ППР section — placeholder, field measurements */}
      <CollapsibleSection
        title="ППР (плотность потока радона)"
        icon={Activity}
        defaultOpen={false}
      >
        <div className="p-6 text-center">
          <Activity className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-40" />
          <p className="text-[var(--text-secondary)] mb-2">
            Данные ППР — результаты полевых измерений радонометром
          </p>
          <p className="text-xs text-[var(--text-secondary)] opacity-70 max-w-xl mx-auto">
            Формулы из расчёта: R+d(R) = значение + погрешность, среднее = AVERAGE, δ = STDEV, 
            среднее+δ = SUM(среднее, δ).
            <br />
            Пороги: R+d(R) &gt; 80 мБк/(м²·с) — повышенный уровень, R+d(R) &gt; 250 мБк/(м²·с) — опасный уровень.
          </p>
        </div>
      </CollapsibleSection>

      </>
      )}

    </div>
  );
}
