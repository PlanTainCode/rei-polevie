import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
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
  AlertTriangle,
} from 'lucide-react';
import { projectsApi, type DistanceResult } from '@/api/projects';
import { Button, Input, Card, CardContent } from '@/components/ui';

// Утилиты для кадастрового номера
// Формат: XX:XX:XXXXXXX:XXX (регион:район:квартал:участок)
// Регион: 2 цифры, Район: 2 цифры, Квартал: 6-7 цифр, Участок: 1-5 цифр
const CADASTRAL_REGEX = /^\d{2}:\d{2}:\d{6,7}:\d{1,5}$/;

const formatCadastralNumber = (value: string, prevValue: string): string => {
  // Оставляем только цифры и двоеточия
  const cleaned = value.replace(/[^\d:]/g, '');
  
  // Считаем двоеточия
  const colonCount = (cleaned.match(/:/g) || []).length;
  const prevColonCount = (prevValue.match(/:/g) || []).length;
  
  // Проверяем, это вставка (сразу много символов или 3 двоеточия)
  const isPaste = colonCount >= 3 || (cleaned.replace(/:/g, '').length - prevValue.replace(/:/g, '').length > 3);
  
  if (isPaste && colonCount >= 3) {
    // Вставка полного номера — парсим части
    const parts = cleaned.split(':');
    const formatted = [
      parts[0]?.replace(/\D/g, '').slice(0, 2) || '',
      parts[1]?.replace(/\D/g, '').slice(0, 2) || '',
      parts[2]?.replace(/\D/g, '').slice(0, 7) || '',
      parts[3]?.replace(/\D/g, '').slice(0, 5) || '',
    ];
    
    let result = formatted[0];
    if (formatted[1]) result += ':' + formatted[1];
    if (formatted[2]) result += ':' + formatted[2];
    if (formatted[3]) result += ':' + formatted[3];
    return result;
  }
  
  // Пользователь вручную добавил двоеточие — сохраняем его
  if (colonCount > prevColonCount) {
    const parts = cleaned.split(':');
    const limits = [2, 2, 7, 5];
    const formatted = parts.slice(0, 4).map((p, i) => p.replace(/\D/g, '').slice(0, limits[i]));
    return formatted.filter(Boolean).join(':');
  }
  
  // Берём только цифры
  const digits = cleaned.replace(/:/g, '').slice(0, 16);
  
  // Разбиваем на части
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 4);
  const part3 = digits.slice(4, 11);
  const part4 = digits.slice(11, 16);
  
  // Собираем с автоматическими двоеточиями
  let result = part1;
  
  if (part2) {
    result += (part1.length === 2 ? ':' : '') + part2;
  }
  
  if (part3) {
    result += (part2.length === 2 ? ':' : '') + part3;
  }
  
  if (part4) {
    result += (part3.length === 7 ? ':' : '') + part4;
  }
  
  return result;
};

const validateCadastralNumber = (value: string): boolean => {
  if (!value) return true; // Пустое значение валидно
  return CADASTRAL_REGEX.test(value);
};

export function ProgramIeiPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Форма
  const [cadastralNumber, setCadastralNumber] = useState('');
  const [cadastralError, setCadastralError] = useState('');
  const [egrnDescription, setEgrnDescription] = useState('');
  const [nearbySouth, setNearbySouth] = useState('');
  const [nearbyEast, setNearbyEast] = useState('');
  const [nearbyWest, setNearbyWest] = useState('');
  const [nearbyNorth, setNearbyNorth] = useState('');
  const [openGroundPercent, setOpenGroundPercent] = useState<number | null>(null);
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

  // Запрос расстояния от офиса
  const { data: distanceData, isLoading: distanceLoading } = useQuery({
    queryKey: ['distance', id],
    queryFn: () => projectsApi.getDistanceToObject(id!),
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
      setOpenGroundPercent(programIei.openGroundPercent ?? null);
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
      openGroundPercent?: number | null;
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
      // Звук уведомления
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQIvkvPnpFULLHzs7axhFSZo4fO0cCEdVNLxwoMxGUS97MuLPh87q+jXmkkgLZnl4qFZGyWG4u6sZhkld9/ztnAbI2va8sFzHSJd0vHKhTIZS8Dsy4w7HT2v6NmZTyAtmeTioVobJYbi7qxmGSV33/O2cBsja9rywXMdIl3S8cqFMhlLwOzLjDsdPa/o2ZlPIC2Z5OKhWhslhuLurGYZJXff87ZwGyNr2vLBcx0iXdLxykU1GUvA7MuMOx09sOjZmE8gLZnk4qFaGyWG4u6sZhkld9/ztnAbI2va8sFzHiJd0vHKhTIZS8Dsy4w7HT2v6NmZTyAtmeTioVobJYbi7qxmGCV33/O2cBsja9rywXMeIl3S8cqFMhlLwOzLjDsdPa/o2ZlPIC2Z5OKhWhslhuLurGYYJXff87ZwGyNr2vLBcx4iXdLxyoUyGUvA7MuMOx09r+jZmU8gLZnk4qFaGyWG4u6sZhgld9/ztnAbI2va8sFzHiJd0vHKhTIZS8Dsy4w7HT2v6NmZUA==');
        audio.volume = 0.5;
        audio.play();
      } catch {}
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
    // Проверяем валидность кадастрового номера перед сохранением
    if (cadastralNumber && !validateCadastralNumber(cadastralNumber)) {
      setCadastralError('Исправьте кадастровый номер перед сохранением');
      return;
    }
    
    updateMutation.mutate({
      cadastralNumber: cadastralNumber || undefined,
      egrnDescription: egrnDescription || undefined,
      nearbySouth: nearbySouth || undefined,
      nearbyEast: nearbyEast || undefined,
      nearbyWest: nearbyWest || undefined,
      nearbyNorth: nearbyNorth || undefined,
      openGroundPercent: openGroundPercent,
      section82Text: section82Text || undefined,
    });
  };

  const handleGenerate = () => {
    // Проверяем валидность кадастрового номера перед генерацией
    if (cadastralNumber && !validateCadastralNumber(cadastralNumber)) {
      setCadastralError('Исправьте кадастровый номер перед генерацией');
      return;
    }
    
    setIsGenerating(true);
    generateMutation.mutate();
  };

  const handleCadastralChange = (value: string) => {
    const formatted = formatCadastralNumber(value, cadastralNumber);
    setCadastralNumber(formatted);
    setHasChanges(true);
    
    // Валидация (показываем ошибку только если что-то введено и формат неправильный)
    if (formatted && !validateCadastralNumber(formatted)) {
      setCadastralError('Неверный формат. Пример: 77:06:0009005:10');
    } else {
      setCadastralError('');
    }
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

      {/* Предупреждение */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-200">
          <p className="font-medium mb-1">Внимание! После генерации проверьте:</p>
          <ul className="list-disc list-inside space-y-1 text-amber-300/80">
            <li><strong>Пункт 3.1</strong> — коренной ландшафт и физико-географическая характеристика</li>
            <li><strong>Раздел 8</strong> — пока заполняется вручную</li>
          </ul>
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
                  className={cadastralError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
                />
                {cadastralError ? (
                  <p className="mt-1 text-xs text-red-400">{cadastralError}</p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Формат: XX:XX:XXXXXXX:XXX (регион:район:квартал:участок)
                  </p>
                )}
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

        {/* 4.2 Расстояние от офиса */}
        <DistanceSection
          projectId={id!}
          objectAddress={project?.objectAddress || null}
          distanceData={distanceData}
          distanceLoading={distanceLoading}
          queryClient={queryClient}
        />

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

              {/* Площадь открытого грунта */}
              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Площадь поверхности открытого грунта: <span className="text-cyan-400 font-semibold">{openGroundPercent !== null ? `${openGroundPercent}%` : 'не указано'}</span>
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    {/* Шкала под слайдером */}
                    <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-xs text-[var(--text-secondary)]">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={openGroundPercent ?? 50}
                      onChange={(e) => {
                        setOpenGroundPercent(Number(e.target.value));
                        markChanged();
                      }}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${openGroundPercent ?? 50}%, var(--bg-tertiary, #374151) ${openGroundPercent ?? 50}%, var(--bg-tertiary, #374151) 100%)`,
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={openGroundPercent ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Math.min(100, Math.max(0, Number(e.target.value))) : null;
                        setOpenGroundPercent(val);
                        markChanged();
                      }}
                      className="w-20"
                      placeholder="—"
                    />
                    <span className="text-sm text-[var(--text-secondary)]">%</span>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-6">
                  Используется для текста: «Степень запечатанности и захламленности территории – площадь поверхности открытого грунта на участке составляет около XX %.»
                </p>
              </div>

              <p className="text-xs text-[var(--text-secondary)] mt-4">
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

function DistanceSection({
  projectId,
  objectAddress,
  distanceData,
  distanceLoading,
  queryClient,
}: {
  projectId: string;
  objectAddress: string | null;
  distanceData: DistanceResult | undefined;
  distanceLoading: boolean;
  queryClient: QueryClient;
}) {
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Синхронизируем инпут при загрузке данных
  useEffect(() => {
    if (distanceData?.distanceKm != null) {
      setEditValue(String(distanceData.distanceKm));
    }
  }, [distanceData?.distanceKm]);

  const saveMutation = useMutation({
    mutationFn: (km: number) => projectsApi.updateDistance(projectId, km),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distance', projectId] });
      setIsEditing(false);
    },
  });

  const recalcMutation = useMutation({
    mutationFn: () => projectsApi.recalculateDistance(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distance', projectId] });
    },
  });

  const handleSave = () => {
    const num = parseFloat(editValue.replace(',', '.'));
    if (!isNaN(num) && num > 0) {
      saveMutation.mutate(num);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">4.2 Расстояние от офиса до объекта</h2>
        </div>

        <div className="space-y-3">
          {/* Маршрут + расстояние */}
          <div className="flex items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-3">
            <div className="flex-1">
              <div className="text-sm text-[var(--text-secondary)] mb-1">
                От: <span className="text-[var(--text-primary)]">ул. Островитянова, д.6, Москва</span>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                До: <span className="text-[var(--text-primary)]">{objectAddress || 'Адрес не указан'}</span>
              </div>
            </div>
            <div className="text-right">
              {distanceLoading || recalcMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">Расчёт...</span>
                </div>
              ) : isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-20 h-9 px-2 text-right text-lg font-bold rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-none focus:border-primary-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                      if (e.key === 'Escape') setIsEditing(false);
                    }}
                    autoFocus
                  />
                  <span className="text-sm text-[var(--text-secondary)]">км</span>
                </div>
              ) : distanceData?.distanceKm != null ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="group cursor-pointer"
                  title="Нажмите для редактирования"
                >
                  <div className="text-2xl font-bold text-green-400 group-hover:text-green-300 transition-colors">
                    {distanceData.distanceKm} км
                  </div>
                </button>
              ) : (
                <div className="text-sm text-[var(--text-secondary)]">
                  {distanceData?.error || 'Не удалось рассчитать'}
                </div>
              )}
            </div>
          </div>

          {/* Карта */}
          {objectAddress && (
            <div className="rounded-lg overflow-hidden border border-[var(--border-color)] aspect-[16/9]">
              <iframe
                src={`https://yandex.ru/map-widget/v1/?rtext=55.6443432,37.4906093~${encodeURIComponent(objectAddress)}&rtt=auto&z=11`}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                style={{ display: 'block' }}
              />
            </div>
          )}

          {/* Кнопки */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  isLoading={saveMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Сохранить
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    if (distanceData?.distanceKm != null) {
                      setEditValue(String(distanceData.distanceKm));
                    }
                  }}
                >
                  Отмена
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Указать вручную
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => recalcMutation.mutate()}
                  disabled={distanceLoading || recalcMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {recalcMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  Пересчитать
                </Button>
                {distanceData?.yandexMapsUrl && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => window.open(distanceData.yandexMapsUrl!, '_blank', 'noopener,noreferrer')}
                    className="flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4" />
                    Яндекс.Карты
                  </Button>
                )}
              </>
            )}
          </div>

          <p className="text-xs text-[var(--text-secondary)]">
            Расстояние используется в таблице 4.2 программы ИЭИ. Можно отредактировать вручную или пересчитать по маршруту.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
