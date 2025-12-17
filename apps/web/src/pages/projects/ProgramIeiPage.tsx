import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Upload,
  Trash2,
  Save,
  Download,
  MapPin,
  Image,
  Loader2,
} from 'lucide-react';
import { projectsApi } from '@/api/projects';
import { Button, Input, Card, CardContent } from '@/components/ui';

export function ProgramIeiPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Форма
  const [cadastralNumber, setCadastralNumber] = useState('');
  const [egrnDescription, setEgrnDescription] = useState('');
  const [nearbySouth, setNearbySouth] = useState('');
  const [nearbyEast, setNearbyEast] = useState('');
  const [nearbyWest, setNearbyWest] = useState('');
  const [nearbyNorth, setNearbyNorth] = useState('');
  const [section82Text, setSection82Text] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Текст по умолчанию для п.8.2
  const SECTION_82_DEFAULT = `Нет данных о наличии участков с ранее выявленным загрязнением окружающей среды.

Объектов культурного наследия федерального и регионального значения, объектов, обладающих признаками объектов культурного наследия, зон санитарной охраны источников водопользования, санитарно-защитных зон на обследуемой территории не имеется. ООПТ федерального, регионального значения и иные ограничения природопользования в районе расположения объекта отсутствуют.

Территория обследования расположена в водоохранной зоне и прибрежной защитной полосе р.Москвы (Кожуховский затон).`;

  // Состояния
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Запросы
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

  // Инициализация формы
  useEffect(() => {
    if (programIei) {
      setCadastralNumber(programIei.cadastralNumber || '');
      setEgrnDescription(programIei.egrnDescription || '');
      setNearbySouth(programIei.nearbySouth || '');
      setNearbyEast(programIei.nearbyEast || '');
      setNearbyWest(programIei.nearbyWest || '');
      setNearbyNorth(programIei.nearbyNorth || '');
      setSection82Text(programIei.section82Text || SECTION_82_DEFAULT);
      setHasChanges(false);
    }
  }, [programIei]);

  // Мутации
  const updateMutation = useMutation({
    mutationFn: (data: {
      cadastralNumber?: string;
      egrnDescription?: string;
      nearbySouth?: string;
      nearbyEast?: string;
      nearbyWest?: string;
      nearbyNorth?: string;
      section82Text?: string;
    }) =>
      projectsApi.updateProgramIei(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-iei', id] });
      setHasChanges(false);
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => projectsApi.uploadOverviewImage(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-iei', id] });
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: () => projectsApi.deleteOverviewImage(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-iei', id] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => projectsApi.generateProgramIei(id!),
    onSuccess: async (result) => {
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ['program-iei', id] });
      // Скачиваем файл
      await projectsApi.downloadWord(id!, result.fileName);
    },
    onError: () => {
      setIsGenerating(false);
    },
  });

  // Обработчики
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    uploadImageMutation.mutate(file);
    e.target.value = '';
  };

  const handleSave = () => {
    updateMutation.mutate({
      cadastralNumber: cadastralNumber || undefined,
      egrnDescription: egrnDescription || undefined,
      nearbySouth: nearbySouth || undefined,
      nearbyEast: nearbyEast || undefined,
      nearbyWest: nearbyWest || undefined,
      nearbyNorth: nearbyNorth || undefined,
      section82Text: section82Text || undefined,
    });
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation.mutate();
  };

  const handleCadastralChange = (value: string) => {
    setCadastralNumber(value);
    setHasChanges(true);
  };

  const handleDescriptionChange = (value: string) => {
    setEgrnDescription(value);
    setHasChanges(true);
  };

  const markChanged = () => setHasChanges(true);

  const yandexUrl = (() => {
    const lat = Number(String(programIei?.coordinatesLat || '').replace(',', '.'));
    const lon = Number(String(programIei?.coordinatesLon || '').replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    // ll и pt в формате lon,lat
    const ll = `${lon},${lat}`;
    return `https://yandex.ru/maps/?ll=${encodeURIComponent(ll)}&z=18&pt=${encodeURIComponent(ll)},pm2rdm`;
  })();

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

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/projects/${id}`}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Программа ИЭИ</h1>
            <p className="text-sm text-[var(--text-secondary)]">{project.objectName || project.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Button
              onClick={handleSave}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1.9.4 Обзорная схема */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Image className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">1.9.4 Обзорная схема размещения объекта</h2>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {programIei?.overviewImageUrl ? (
              <div className="space-y-4">
                <div className="relative aspect-video bg-[var(--bg-tertiary)] rounded-lg overflow-hidden">
                  <img
                    src={programIei.overviewImageUrl}
                    alt="Обзорная схема"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    variant="secondary"
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Заменить
                  </Button>
                  <Button
                    onClick={() => deleteImageMutation.mutate()}
                    disabled={deleteImageMutation.isPending}
                    variant="danger"
                    className="flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full aspect-video border-2 border-dashed border-[var(--border-color)] rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary-400 hover:bg-primary-500/10 transition-colors"
              >
                {isUploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-[var(--text-secondary)]" />
                    <span className="text-sm text-[var(--text-secondary)]">
                      Загрузить изображение схемы
                    </span>
                  </>
                )}
              </button>
            )}

            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              Загрузите скриншот карты с местоположением объекта. Рекомендуется использовать
              Яндекс.Карты или Google Maps с отмеченной точкой объекта.
            </p>
          </CardContent>
        </Card>

        {/* 1.10 Сведения ЕГРН */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">1.10 Сведения из ЕГРН</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Кадастровый номер участка
                </label>
                <Input
                  value={cadastralNumber}
                  onChange={(e) => handleCadastralChange(e.target.value)}
                  placeholder="77:06:0009005:10"
                />
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Формат: XX:XX:XXXXXXX:XXX
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Сведения о категории земель и разрешённом использовании
                </label>
                <textarea
                  value={egrnDescription}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder="Категория земель: Земли населённых пунктов.&#10;Разрешённое использование: Для индивидуального жилищного строительства.&#10;Площадь: 1500 кв.м."
                  rows={6}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Укажите данные из выписки ЕГРН: категорию земель, вид разрешённого использования,
                  площадь участка и другую релевантную информацию.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3.2 Окружение участка + координаты */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">3.2 Окружение участка и координаты</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Координаты (из ТЗ)
                </label>
                <div className="flex items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2">
                  <div className="text-sm text-[var(--text-primary)]">
                    {programIei?.coordinatesLat && programIei?.coordinatesLon
                      ? `${programIei.coordinatesLat}, ${programIei.coordinatesLon}`
                      : 'Не найдены в ТЗ'}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!yandexUrl}
                    onClick={() => yandexUrl && window.open(yandexUrl, '_blank', 'noopener,noreferrer')}
                    className="flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4" />
                    Яндекс.Карты
                  </Button>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Координаты автоматически извлекаются из ТЗ и используются только для удобной проверки окружения участка.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    К югу
                  </label>
                  <Input
                    value={nearbySouth}
                    onChange={(e) => {
                      setNearbySouth(e.target.value);
                      markChanged();
                    }}
                    placeholder="улица ..., автостоянка"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    К востоку
                  </label>
                  <Input
                    value={nearbyEast}
                    onChange={(e) => {
                      setNearbyEast(e.target.value);
                      markChanged();
                    }}
                    placeholder="улица ..., автосервис"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    К западу
                  </label>
                  <Input
                    value={nearbyWest}
                    onChange={(e) => {
                      setNearbyWest(e.target.value);
                      markChanged();
                    }}
                    placeholder="улица ..., объект"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    К северу
                  </label>
                  <Input
                    value={nearbyNorth}
                    onChange={(e) => {
                      setNearbyNorth(e.target.value);
                      markChanged();
                    }}
                    placeholder="объект ..."
                  />
                </div>
              </div>

              <p className="text-xs text-[var(--text-secondary)]">
                Эти поля используются для заполнения п.3.2 в программе ИЭИ (строки «К югу/востоку/западу/северу»).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 8.2 Предварительные сведения о загрязнении и экологических ограничениях */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">8.2 Сведения о загрязнении и экологических ограничениях</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Ссылка на ГИС ОГД
                </label>
                <div className="flex items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2">
                  <div className="text-sm text-[var(--text-primary)]">
                    {project?.objectAddress || 'Адрес не указан'}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!project?.objectAddress}
                    onClick={() => {
                      const addr = encodeURIComponent(project?.objectAddress || '');
                      window.open(`https://gisogd.mos.ru/ru?search=${addr}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4" />
                    ГИС ОГД
                  </Button>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Откройте ГИС ОГД для проверки ООПТ, СЗЗ и других ограничений в районе объекта.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Текст пункта 8.2
                </label>
                <textarea
                  value={section82Text}
                  onChange={(e) => {
                    setSection82Text(e.target.value);
                    markChanged();
                  }}
                  placeholder="Нет данных о наличии участков с ранее выявленным загрязнением..."
                  rows={8}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
                />
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Сведения о загрязнении, ООПТ, ОКН, СЗЗ и других экологических ограничениях. Текст будет вставлен в п.8.2 программы.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* История генераций */}
      {programIei?.generatedAt && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Последняя генерация</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-primary)]">
                  {programIei.generatedFileName}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {new Date(programIei.generatedAt).toLocaleString('ru-RU')}
                </p>
              </div>
              <Button
                onClick={() =>
                  programIei.generatedFileName &&
                  projectsApi.downloadWord(id!, programIei.generatedFileName)
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
