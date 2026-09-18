import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  FileText,
  Info,
  Loader2,
  Save,
} from 'lucide-react';
import { projectsApi, type ReportIeiClimateValues, type ReportIeiData } from '@/api/projects';
import { Button, Input, Card, CardContent, Select } from '@/components/ui';

const REPORT_IEI_STAFF_NAMES = [
  'Матвеева Т.С.',
  'Штефанова У.Н.',
  'Бурнацкая И.М.',
  'Ермолов Т.А.',
  'Шкода Д.Д.',
  'Френкель А.В.',
  'Корякова И.В.',
  'Маякова Т.А.',
  'Гасилин П.В.',
];

const DEFAULT_VOLUME = 'Том 1.3.1';

const TEXTAREA_CLASS =
  'w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] resize-y';

const NO_CGMS_CLIMATE_HINT =
  'Климатическая характеристика района изысканий приведена согласно аналитическому отчету «Расчет метеорологических характеристик и коэффициентов, определяющих условия рассеивания загрязняющих веществ», Москва - 2025 г.';

const EMPTY_CLIMATE_VALUES: ReportIeiClimateValues = {
  atmosphereA: '',
  reliefCoef: '',
  maxTempHotMonth: '',
  meanTempColdMonth: '',
  windN: '',
  windNe: '',
  windE: '',
  windSe: '',
  windS: '',
  windSw: '',
  windW: '',
  windNw: '',
  windSpeed5: '',
};

const WIND_ROSE_FIELDS: { key: keyof ReportIeiClimateValues; label: string }[] = [
  { key: 'windN', label: 'С' },
  { key: 'windNe', label: 'СВ' },
  { key: 'windE', label: 'В' },
  { key: 'windSe', label: 'ЮВ' },
  { key: 'windS', label: 'Ю' },
  { key: 'windSw', label: 'ЮЗ' },
  { key: 'windW', label: 'З' },
  { key: 'windNw', label: 'СЗ' },
];

function collectClimateValues(values: ReportIeiClimateValues): ReportIeiClimateValues | undefined {
  const next: ReportIeiClimateValues = {};
  (Object.keys(EMPTY_CLIMATE_VALUES) as (keyof ReportIeiClimateValues)[]).forEach((key) => {
    const trimmed = String(values[key] || '').trim();
    if (trimmed) next[key] = trimmed;
  });
  return Object.keys(next).length ? next : undefined;
}

const MONTHS_PREPOSITIONAL = [
  'январе',
  'феврале',
  'марте',
  'апреле',
  'мае',
  'июне',
  'июле',
  'августе',
  'сентябре',
  'октябре',
  'ноябре',
  'декабре',
];

function formatInMonthYear(date: Date, withG = true): string {
  const month = MONTHS_PREPOSITIONAL[date.getMonth()] || 'январе';
  return withG ? `в ${month} ${date.getFullYear()} г.` : `в ${month} ${date.getFullYear()}`;
}

function parseProjectDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function defaultCipher(documentNumber?: string | null): string {
  const num = String(documentNumber || '').trim();
  if (!num) return '';
  return /иэи/i.test(num) ? num : `${num}-ИЭИ`;
}

export function ReportIeiPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [fieldWorkPeriod, setFieldWorkPeriod] = useState('');
  const [cameralWorkPeriod, setCameralWorkPeriod] = useState('');
  const [hasObjectRename, setHasObjectRename] = useState(false);
  const [previousObjectName, setPreviousObjectName] = useState('');
  const [isLandscapingOnly, setIsLandscapingOnly] = useState(false);
  const [hasBuildingSurvey, setHasBuildingSurvey] = useState(false);
  const [buildingDescription, setBuildingDescription] = useState('');
  const [noSocialInfrastructureNearby, setNoSocialInfrastructureNearby] = useState(true);
  const [socialInfrastructureText, setSocialInfrastructureText] = useState('');
  const [waterObjectText, setWaterObjectText] = useState('');
  const [landUseZone, setLandUseZone] = useState('');
  const [siteFenceText, setSiteFenceText] = useState('');
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [reportCipher, setReportCipher] = useState('');
  const [inventoryNumber, setInventoryNumber] = useState('');
  const [executorNames, setExecutorNames] = useState<string[]>([]);
  const [noCgmsCertificate, setNoCgmsCertificate] = useState(false);
  const [cgmsCertificateNumber, setCgmsCertificateNumber] = useState('');
  const [cgmsCertificateDate, setCgmsCertificateDate] = useState('');
  const [weatherStation, setWeatherStation] = useState('');
  const [climateValues, setClimateValues] = useState<ReportIeiClimateValues>(EMPTY_CLIMATE_VALUES);
  const [woodyPlantingsText, setWoodyPlantingsText] = useState('');
  const [pollutionSourcesText, setPollutionSourcesText] = useState('');
  const [hasOopt, setHasOopt] = useState(false);
  const [ooptName, setOoptName] = useState('');
  const [ooptText, setOoptText] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });

  const { data: programIei, isLoading: programLoading } = useQuery({
    queryKey: ['program-iei', id],
    queryFn: () => projectsApi.getProgramIei(id!),
    enabled: !!id,
  });

  useEffect(() => {
    const data = programIei?.reportIeiData;
    setFieldWorkPeriod(data?.fieldWorkPeriod || '');
    setCameralWorkPeriod(data?.cameralWorkPeriod || '');
    setHasObjectRename(data?.hasObjectRename === true);
    setPreviousObjectName(data?.previousObjectName || '');
    setIsLandscapingOnly(data?.isLandscapingOnly === true);
    setHasBuildingSurvey(data?.hasBuildingSurvey === true);
    setBuildingDescription(data?.buildingDescription || '');
    setNoSocialInfrastructureNearby(data?.noSocialInfrastructureNearby === true);
    setSocialInfrastructureText(data?.socialInfrastructureText || '');
    setWaterObjectText(data?.waterObjectText || '');
    setLandUseZone(data?.landUseZone || '');
    setSiteFenceText(data?.siteFenceText || '');
    setVolume(data?.volume || DEFAULT_VOLUME);
    setReportCipher(data?.reportCipher || defaultCipher(project?.documentNumber));
    setInventoryNumber(data?.inventoryNumber || '');
    setExecutorNames(
      (data?.executorNames || []).filter((name) => REPORT_IEI_STAFF_NAMES.includes(name)),
    );
    setNoCgmsCertificate(data?.hasCgmsCertificate === false);
    setCgmsCertificateNumber(data?.cgmsCertificateNumber || '');
    setCgmsCertificateDate(data?.cgmsCertificateDate || '');
    setWeatherStation(data?.weatherStation || '');
    setClimateValues({ ...EMPTY_CLIMATE_VALUES, ...data?.climateValues });
    setWoodyPlantingsText(data?.woodyPlantingsText || '');
    setPollutionSourcesText(data?.pollutionSourcesText || '');
    setHasOopt(data?.hasOopt === true);
    setOoptName(data?.ooptName || '');
    setOoptText(data?.ooptText || '');
    setHasChanges(false);
  }, [programIei, project?.documentNumber]);

  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const markChanged = () => setHasChanges(true);

  const setClimateField = (key: keyof ReportIeiClimateValues, value: string) => {
    setClimateValues((prev) => ({ ...prev, [key]: value }));
    markChanged();
  };

  const collectData = (): ReportIeiData => ({
    fieldWorkPeriod: fieldWorkPeriod.trim() || undefined,
    cameralWorkPeriod: cameralWorkPeriod.trim() || undefined,
    hasObjectRename,
    previousObjectName: previousObjectName.trim() || undefined,
    isLandscapingOnly,
    hasBuildingSurvey,
    buildingDescription: buildingDescription.trim() || undefined,
    noSocialInfrastructureNearby,
    socialInfrastructureText: socialInfrastructureText.trim() || undefined,
    waterObjectText: waterObjectText.trim() || undefined,
    landUseZone: landUseZone.trim() || undefined,
    siteFenceText: siteFenceText.trim() || undefined,
    volume: volume.trim() || DEFAULT_VOLUME,
    reportCipher: reportCipher.trim() || undefined,
    inventoryNumber: inventoryNumber.trim() || undefined,
    executorNames,
    hasCgmsCertificate: noCgmsCertificate ? false : undefined,
    cgmsCertificateNumber: cgmsCertificateNumber.trim() || undefined,
    cgmsCertificateDate: cgmsCertificateDate.trim() || undefined,
    weatherStation: weatherStation.trim() || undefined,
    climateValues: collectClimateValues(climateValues),
    woodyPlantingsText: woodyPlantingsText.trim() || undefined,
    hasOopt,
    ooptName: ooptName.trim() || undefined,
    ooptText: ooptText.trim() || undefined,
    pollutionSourcesText: pollutionSourcesText.trim() || undefined,
  });

  const updateMutation = useMutation({
    mutationFn: () => projectsApi.updateProgramIei(id!, { reportIeiData: collectData() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-iei', id] });
      setHasChanges(false);
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => projectsApi.generateReportIei(id!),
    onSuccess: async (result) => {
      setIsGenerating(false);
      await queryClient.invalidateQueries({ queryKey: ['program-iei', id] });
      if (result.fileName) {
        try {
          await projectsApi.downloadWord(id!, result.fileName);
        } catch {
          alert('Отчёт сгенерирован, но скачивание не удалось — скачайте из блока «Последняя генерация»');
        }
      }
    },
    onError: (error: unknown) => {
      setIsGenerating(false);
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'Ошибка генерации отчёта ИЭИ';
      alert(Array.isArray(message) ? message.join('\n') : message);
    },
  });

  const handleGenerate = async () => {
    if (hasChanges) {
      await updateMutation.mutateAsync();
    }
    setIsGenerating(true);
    generateMutation.mutate();
  };

  if (projectLoading || programLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Проект не найден</p>
      </div>
    );
  }

  const nearbyPreview =
    programIei?.nearbyText ||
    [
      programIei?.nearbyNorth && `К северу: ${programIei.nearbyNorth}`,
      programIei?.nearbyEast && `К востоку: ${programIei.nearbyEast}`,
      programIei?.nearbySouth && `К югу: ${programIei.nearbySouth}`,
      programIei?.nearbyWest && `К западу: ${programIei.nearbyWest}`,
    ]
      .filter(Boolean)
      .join('\n');

  const fieldWorkPlaceholder = formatInMonthYear(
    parseProjectDate(project.samplingDate) || new Date(),
    true,
  );
  const cameralWorkPlaceholder = formatInMonthYear(new Date(), false);

  return (
    <div className="space-y-6">
      <div
        className={`sticky top-0 z-30 rounded-xl py-4 transition-all ${
          isHeaderScrolled ? 'bg-[var(--bg-tertiary)] px-4' : 'bg-[var(--bg-primary)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/projects/${id}`}
              className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Отчёт ИЭИ</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {project.objectName || project.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </Button>
            )}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              variant="primary"
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Сгенерировать
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-200">
          <p className="font-medium mb-1">Ручной ввод — то, чего нет в программе и ТЗ</p>
          <p className="text-amber-300/80">
            Титул и §1: ТЗ прогоняется через ту же нейросеть, что и программа ИЭИ, плюс отдельный
            прогон по шаблону отчёта. Поля ниже перекрывают ИИ. Пустое = авто или ветка «нет».
            Стадия на титуле — из п.7.1 / этапа ТЗ.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Титул</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Шифр отчёта</label>
              <Input
                value={reportCipher}
                onChange={(e) => {
                  setReportCipher(e.target.value);
                  markChanged();
                }}
                placeholder={defaultCipher(project.documentNumber) || '801-000-25-ИЭИ'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Том</label>
              <Input
                value={volume}
                onChange={(e) => {
                  setVolume(e.target.value);
                  markChanged();
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Инв. номер</label>
              <Input
                value={inventoryNumber}
                onChange={(e) => {
                  setInventoryNumber(e.target.value);
                  markChanged();
                }}
                placeholder="Не оставлять пример шаблона, если пусто"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Полевые работы</label>
              <Input
                value={fieldWorkPeriod}
                onChange={(e) => {
                  setFieldWorkPeriod(e.target.value);
                  markChanged();
                }}
                placeholder={fieldWorkPlaceholder}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Камеральные работы</label>
              <Input
                value={cameralWorkPeriod}
                onChange={(e) => {
                  setCameralWorkPeriod(e.target.value);
                  markChanged();
                }}
                placeholder={cameralWorkPlaceholder}
              />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isLandscapingOnly}
                onChange={(e) => {
                  setIsLandscapingOnly(e.target.checked);
                  markChanged();
                }}
                className="mt-1 h-4 w-4 rounded accent-primary-500"
              />
              <span className="text-sm">
                Только благоустройство
                <span className="block text-xs text-[var(--text-secondary)]">
                  Уберём 384-ФЗ из п.1.2
                </span>
              </span>
            </label>
            <div>
              <Select
                label="П.1.6 Состав исполнителей"
                value=""
                options={[
                  { value: '', label: 'Добавить исполнителя' },
                  ...REPORT_IEI_STAFF_NAMES.filter((name) => !executorNames.includes(name)).map(
                    (name) => ({ value: name, label: name }),
                  ),
                ]}
                onChange={(e) => {
                  const name = e.target.value;
                  if (!name || executorNames.includes(name)) return;
                  setExecutorNames([...executorNames, name]);
                  markChanged();
                }}
              />
              {executorNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {executorNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setExecutorNames(executorNames.filter((item) => item !== name));
                        markChanged();
                      }}
                      className="text-sm px-2 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-red-400"
                    >
                      {name} ×
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Только сотрудники из списка. Пустой выбор уберёт шаблонные ФИО из п.1.6.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">П.1.7 Территория</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasObjectRename}
                onChange={(e) => {
                  setHasObjectRename(e.target.checked);
                  markChanged();
                }}
                className="mt-1 h-4 w-4 rounded accent-primary-500"
              />
              <span className="text-sm">Название объекта менялось в ходе работ</span>
            </label>
            {hasObjectRename && (
              <div>
                <label className="block text-sm font-medium mb-1">Старое название</label>
                <Input
                  value={previousObjectName}
                  onChange={(e) => {
                    setPreviousObjectName(e.target.value);
                    markChanged();
                  }}
                />
              </div>
            )}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasBuildingSurvey}
                onChange={(e) => {
                  setHasBuildingSurvey(e.target.checked);
                  markChanged();
                }}
                className="mt-1 h-4 w-4 rounded accent-primary-500"
              />
              <span className="text-sm">Есть обследование здания</span>
            </label>
            {hasBuildingSurvey && (
              <textarea
                value={buildingDescription}
                onChange={(e) => {
                  setBuildingDescription(e.target.value);
                  markChanged();
                }}
                rows={4}
                placeholder="На участке изысканий расположено…"
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] resize-y"
              />
            )}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={noSocialInfrastructureNearby}
                onChange={(e) => {
                  setNoSocialInfrastructureNearby(e.target.checked);
                  markChanged();
                }}
                className="mt-1 h-4 w-4 rounded accent-primary-500"
              />
              <span className="text-sm">
                В 150 м нет жилой застройки, школы, детского сада, больницы
              </span>
            </label>
            {!noSocialInfrastructureNearby && (
              <textarea
                value={socialInfrastructureText}
                onChange={(e) => {
                  setSocialInfrastructureText(e.target.value);
                  markChanged();
                }}
                rows={3}
                placeholder="Ближайшая жилая застройка расположена на расстоянии около 50 м к востоку."
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] resize-y"
              />
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Поверхностный водный объект</label>
              <textarea
                value={waterObjectText}
                onChange={(e) => {
                  setWaterObjectText(e.target.value);
                  markChanged();
                }}
                rows={3}
                placeholder="Ближайшим поверхностным водным объектом является р. Москва, расположенная на расстоянии 1,0 км к югу от участка изысканий."
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] resize-y"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Зона использования территории</label>
              <Input
                value={landUseZone}
                onChange={(e) => {
                  setLandUseZone(e.target.value);
                  markChanged();
                }}
                placeholder="как в ТЗ, без слова «в»: зоне жилой застройки"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ограждение / охрана участка</label>
              <Input
                value={siteFenceText}
                onChange={(e) => {
                  setSiteFenceText(e.target.value);
                  markChanged();
                }}
                placeholder="Участок изысканий обнесён забором, охраняется."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">§2 Справка ЦГМС</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={noCgmsCertificate}
                onChange={(e) => {
                  setNoCgmsCertificate(e.target.checked);
                  markChanged();
                }}
                className="mt-1 h-4 w-4 rounded accent-primary-500"
              />
              <span className="text-sm">
                Справки ЦГМС нет
                <span className="block text-xs text-[var(--text-secondary)]">
                  Ветка без письма: аналитический отчёт вместо номера и даты
                </span>
              </span>
            </label>
            {noCgmsCertificate ? (
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                {NO_CGMS_CLIMATE_HINT}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Номер справки</label>
                    <Input
                      value={cgmsCertificateNumber}
                      onChange={(e) => {
                        setCgmsCertificateNumber(e.target.value);
                        markChanged();
                      }}
                      placeholder="100/5/Э-12"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Дата справки</label>
                    <Input
                      value={cgmsCertificateDate}
                      onChange={(e) => {
                        setCgmsCertificateDate(e.target.value);
                        markChanged();
                      }}
                      placeholder="01.03.2025"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Метеостанция</label>
                  <Input
                    value={weatherStation}
                    onChange={(e) => {
                      setWeatherStation(e.target.value);
                      markChanged();
                    }}
                    placeholder="как в справке, без кавычек"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Числа климата из справки</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Коэффициент А"
                      value={climateValues.atmosphereA || ''}
                      onChange={(e) => setClimateField('atmosphereA', e.target.value)}
                      placeholder="140,0"
                    />
                    <Input
                      label="Коэффициент рельефа"
                      value={climateValues.reliefCoef || ''}
                      onChange={(e) => setClimateField('reliefCoef', e.target.value)}
                      placeholder="1,0"
                    />
                    <Input
                      label="t° жаркого месяца"
                      value={climateValues.maxTempHotMonth || ''}
                      onChange={(e) => setClimateField('maxTempHotMonth', e.target.value)}
                      placeholder="+24,8"
                    />
                    <Input
                      label="t° холодного месяца"
                      value={climateValues.meanTempColdMonth || ''}
                      onChange={(e) => setClimateField('meanTempColdMonth', e.target.value)}
                      placeholder="-14,0"
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-3 mb-1">
                    Среднегодовая роза ветров, %
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {WIND_ROSE_FIELDS.map(({ key, label }) => (
                      <Input
                        key={key}
                        label={label}
                        value={climateValues[key] || ''}
                        onChange={(e) => setClimateField(key, e.target.value)}
                      />
                    ))}
                  </div>
                  <div className="mt-3">
                    <Input
                      label="Скорость ветра 5%, м/с"
                      value={climateValues.windSpeed5 || ''}
                      onChange={(e) => setClimateField('windSpeed5', e.target.value)}
                      placeholder="5,0"
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">
                    Пустые поля не подставляют числа из шаблона.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              §3 Насаждения, ООПТ, источники
            </h2>
            <div>
              <label className="block text-sm font-medium mb-1">Древесные насаждения</label>
              <textarea
                value={woodyPlantingsText}
                onChange={(e) => {
                  setWoodyPlantingsText(e.target.value);
                  markChanged();
                }}
                rows={4}
                placeholder="Породы и характер посадок с участка. Пустое — абзац уберём."
                className={TEXTAREA_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Источники загрязнения</label>
              <textarea
                value={pollutionSourcesText}
                onChange={(e) => {
                  setPollutionSourcesText(e.target.value);
                  markChanged();
                }}
                rows={4}
                placeholder="Что видно на участке. Пустое — примеры шаблона не останутся."
                className={TEXTAREA_CLASS}
              />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasOopt}
                onChange={(e) => {
                  setHasOopt(e.target.checked);
                  markChanged();
                }}
                className="mt-1 h-4 w-4 rounded accent-primary-500"
              />
              <span className="text-sm">
                Есть ООПТ
                <span className="block text-xs text-[var(--text-secondary)]">
                  Только ручной ввод. Не отмечено — формулировка отсутствия.
                </span>
              </span>
            </label>
            {hasOopt && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Название ООПТ</label>
                  <Input
                    value={ooptName}
                    onChange={(e) => {
                      setOoptName(e.target.value);
                      markChanged();
                    }}
                    placeholder="Особо охраняемая природная территория регионального значения «…»"
                  />
                </div>
                <textarea
                  value={ooptText}
                  onChange={(e) => {
                    setOoptText(e.target.value);
                    markChanged();
                  }}
                  rows={3}
                  placeholder="Как участок соотносится с границами ООПТ"
                  className={TEXTAREA_CLASS}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Данные из программы ИЭИ
            </h2>
            <Link
              to={`/projects/${id}/program-iei`}
              className="text-sm text-primary-400 hover:text-primary-300"
            >
              Открыть программу ИЭИ
            </Link>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Открытый грунт: {programIei?.openGroundPercent ?? 'не задан'}
            {programIei?.openGroundPercent != null ? '%' : ''}
          </p>
          <div className="text-sm whitespace-pre-wrap bg-[var(--bg-secondary)] rounded-lg p-3">
            {nearbyPreview || 'Окружение по сторонам света не заполнено — будет пропущено в п.1.7.'}
          </div>
        </CardContent>
      </Card>

      {programIei?.reportGeneratedAt && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-rose-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Последняя генерация</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">{programIei.reportGeneratedFileName}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {new Date(programIei.reportGeneratedAt).toLocaleString('ru-RU')}
                </p>
              </div>
              <Button
                onClick={() =>
                  programIei.reportGeneratedFileName &&
                  projectsApi.downloadWord(id!, programIei.reportGeneratedFileName)
                }
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Скачать
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
