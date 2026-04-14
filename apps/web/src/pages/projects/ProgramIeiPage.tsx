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
  Plus,
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
  if (!value) return true;
  return CADASTRAL_REGEX.test(value);
};

const parseCadastralNumbers = (raw: string | null): string[] => {
  if (!raw) return [''];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return raw ? [raw] : [''];
};

const serializeCadastralNumbers = (numbers: string[]): string => {
  const filtered = numbers.filter((n) => n.trim());
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  return JSON.stringify(filtered);
};

export function ProgramIeiPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Форма
  const [cadastralNumbers, setCadastralNumbers] = useState<string[]>(['']);
  const [cadastralErrors, setCadastralErrors] = useState<string[]>(['']);
  const [egrnDescription, setEgrnDescription] = useState('');
  const [coordLat, setCoordLat] = useState('');
  const [coordLon, setCoordLon] = useState('');
  const [nearbyText, setNearbyText] = useState('');
  const [openGroundPercent, setOpenGroundPercent] = useState<number | null>(null);
  const [radiometryHa, setRadiometryHa] = useState<number | null>(null);
  const [section82Text, setSection82Text] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);

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
      const nums = parseCadastralNumbers(programIei.cadastralNumber);
      setCadastralNumbers(nums);
      setCadastralErrors(nums.map(() => ''));
      setEgrnDescription(programIei.egrnDescription || '');
      setCoordLat(programIei.coordinatesLat || '');
      setCoordLon(programIei.coordinatesLon || '');
      if (programIei.nearbyText) {
        setNearbyText(programIei.nearbyText);
      } else {
        const parts: string[] = [];
        if (programIei.nearbySouth) parts.push(`К югу: ${programIei.nearbySouth}`);
        if (programIei.nearbyEast) parts.push(`К востоку: ${programIei.nearbyEast}`);
        if (programIei.nearbyWest) parts.push(`К западу: ${programIei.nearbyWest}`);
        if (programIei.nearbyNorth) parts.push(`К северу: ${programIei.nearbyNorth}`);
        setNearbyText(parts.join('\n'));
      }
      setOpenGroundPercent(programIei.openGroundPercent ?? null);
      setRadiometryHa(programIei.radiometryAreaHa ?? null);
      setSection82Text(programIei.section82Text || SECTION_82_DEFAULT);
      setHasChanges(false);
    }
  }, [programIei]);

  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


  const updateMutation = useMutation({
    mutationFn: (data: {
      cadastralNumber?: string;
      egrnDescription?: string;
      coordinatesLat?: string;
      coordinatesLon?: string;
      nearbyText?: string | null;
      openGroundPercent?: number | null;
      customObjectAddress?: string;
      radiometryAreaHa?: number | null;
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
    const errors = cadastralNumbers.map((n) =>
      n.trim() && !validateCadastralNumber(n.trim()) ? 'Неверный формат' : '',
    );
    if (errors.some((e) => e)) {
      setCadastralErrors(errors);
      return;
    }

    const serialized = serializeCadastralNumbers(cadastralNumbers);
    updateMutation.mutate({
      cadastralNumber: serialized || undefined,
      egrnDescription: egrnDescription || undefined,
      coordinatesLat: coordLat || undefined,
      coordinatesLon: coordLon || undefined,
      nearbyText: nearbyText || null,
      openGroundPercent: openGroundPercent,
      radiometryAreaHa: radiometryHa,
      section82Text: section82Text || undefined,
    });
  };

  const handleGenerate = () => {
    const errors = cadastralNumbers.map((n) =>
      n.trim() && !validateCadastralNumber(n.trim()) ? 'Неверный формат' : '',
    );
    if (errors.some((e) => e)) {
      setCadastralErrors(errors);
      return;
    }
    
    setIsGenerating(true);
    generateMutation.mutate();
  };

  const handleCadastralChange = (index: number, value: string) => {
    const formatted = formatCadastralNumber(value, cadastralNumbers[index] || '');
    setCadastralNumbers((prev) => {
      const next = [...prev];
      next[index] = formatted;
      return next;
    });
    setHasChanges(true);

    setCadastralErrors((prev) => {
      const next = [...prev];
      next[index] = formatted && !validateCadastralNumber(formatted)
        ? 'Неверный формат. Пример: 77:06:0009005:10'
        : '';
      return next;
    });
  };

  const addCadastralNumber = () => {
    setCadastralNumbers((prev) => [...prev, '']);
    setCadastralErrors((prev) => [...prev, '']);
    setHasChanges(true);
  };

  const removeCadastralNumber = (index: number) => {
    if (cadastralNumbers.length <= 1) return;
    setCadastralNumbers((prev) => prev.filter((_, i) => i !== index));
    setCadastralErrors((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleDescriptionChange = (value: string) => {
    setEgrnDescription(value);
    setHasChanges(true);
  };

  const markChanged = () => setHasChanges(true);

  const yandexUrl = (() => {
    const lat = Number(String(coordLat || '').replace(',', '.'));
    const lon = Number(String(coordLon || '').replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) return null;
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
      <div className={`sticky top-0 z-30 rounded-xl py-4 transition-all ${isHeaderScrolled ? 'bg-[var(--bg-tertiary)] px-4' : 'bg-[var(--bg-primary)]'}`}>
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
                  Кадастровые номера участков
                </label>
                <div className="space-y-2">
                  {cadastralNumbers.map((num, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={num}
                        onChange={(e) => handleCadastralChange(i, e.target.value)}
                        placeholder="77:06:0009005:10"
                        className={`flex-1 ${cadastralErrors[i] ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                      />
                      {cadastralNumbers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCadastralNumber(i)}
                          className="p-2 text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {cadastralErrors[i] && (
                        <p className="text-xs text-red-400 shrink-0">{cadastralErrors[i]}</p>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addCadastralNumber}
                  className="mt-2 flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Добавить участок
                </button>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Формат: XX:XX:XXXXXXX:XXX (регион:район:квартал:участок)
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

        {/* 4.2 Расстояние от офиса */}
        <DistanceSection
          projectId={id!}
          objectAddress={project?.objectAddress || null}
          customObjectAddress={programIei?.customObjectAddress || null}
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
                  Координаты
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={coordLat}
                      onChange={(e) => {
                        setCoordLat(e.target.value);
                        markChanged();
                      }}
                      placeholder="55.64433 (широта)"
                      className="flex-1"
                    />
                    <Input
                      value={coordLon}
                      onChange={(e) => {
                        setCoordLon(e.target.value);
                        markChanged();
                      }}
                      placeholder="37.49028 (долгота)"
                      className="flex-1"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!yandexUrl}
                    onClick={() => yandexUrl && window.open(yandexUrl, '_blank', 'noopener,noreferrer')}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <MapPin className="w-4 h-4" />
                    Яндекс.Карты
                  </Button>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Координаты извлекаются из ТЗ автоматически. Если они неверные — впишите вручную. Используются для проверки окружения участка.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Окружение участка
                </label>
                <textarea
                  value={nearbyText}
                  onChange={(e) => {
                    setNearbyText(e.target.value);
                    markChanged();
                  }}
                  placeholder={'К югу: улица ..., автостоянка\nК востоку: улица ..., автосервис\nК западу: улица ..., объект\nК северу: объект ...'}
                  rows={10}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-y transition-colors font-mono text-sm leading-relaxed"
                />
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Каждое направление начинайте с «К югу:», «К востоку:», «К западу:», «К северу:». Переносы строк сохраняются при генерации документа.
                </p>
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

              {/* Площадь радиометрии территории */}
              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Площадь радиометрии территории (га)
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={radiometryHa ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setRadiometryHa(val);
                      markChanged();
                    }}
                    placeholder="Авто из поручения"
                    className="w-40"
                  />
                  {radiometryHa !== null && (
                    <button
                      type="button"
                      onClick={() => { setRadiometryHa(null); markChanged(); }}
                      className="text-xs text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Если указано — используется вместо значения из поручения. Если пусто — берётся автоматически.
                </p>
              </div>

              <p className="text-xs text-[var(--text-secondary)] mt-4">
                Данные используются для заполнения п.3.2 и п.4.2 в программе ИЭИ.
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
  customObjectAddress,
  distanceData,
  distanceLoading,
  queryClient,
}: {
  projectId: string;
  objectAddress: string | null;
  customObjectAddress: string | null;
  distanceData: DistanceResult | undefined;
  distanceLoading: boolean;
  queryClient: QueryClient;
}) {
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [addressValue, setAddressValue] = useState('');
  const [addressSaved, setAddressSaved] = useState(false);

  useEffect(() => {
    if (distanceData?.distanceKm != null) {
      setEditValue(String(distanceData.distanceKm));
    }
  }, [distanceData?.distanceKm]);

  useEffect(() => {
    setAddressValue(customObjectAddress || '');
  }, [customObjectAddress]);

  const effectiveAddress = addressValue.trim() || objectAddress;

  const saveMutation = useMutation({
    mutationFn: (km: number) => projectsApi.updateDistance(projectId, km),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distance', projectId] });
      setIsEditing(false);
    },
  });

  const saveAddressMutation = useMutation({
    mutationFn: (addr: string) =>
      projectsApi.updateProgramIei(projectId, { customObjectAddress: addr || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-iei', projectId] });
      queryClient.invalidateQueries({ queryKey: ['distance', projectId] });
      setAddressSaved(true);
      setTimeout(() => setAddressSaved(false), 2000);
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

  const handleSaveAddress = () => {
    saveAddressMutation.mutate(addressValue.trim());
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">4.2 Расстояние от офиса до объекта</h2>
        </div>

        <div className="space-y-3">
          {/* Адрес объекта */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Адрес объекта
            </label>
            <div className="flex gap-2">
              <Input
                value={addressValue}
                onChange={(e) => setAddressValue(e.target.value)}
                placeholder={objectAddress || 'Введите адрес объекта...'}
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveAddress();
                }}
              />
              <Button
                type="button"
                onClick={handleSaveAddress}
                disabled={saveAddressMutation.isPending || addressValue.trim() === (customObjectAddress || '')}
                isLoading={saveAddressMutation.isPending}
                className="flex items-center gap-2 shrink-0"
              >
                <Save className="w-4 h-4" />
                {addressSaved ? 'Сохранено' : 'Сохранить'}
              </Button>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {objectAddress
                ? `Адрес из ТЗ: ${objectAddress}. Впишите свой адрес, чтобы использовать его для расчёта расстояния и карты.`
                : 'Впишите адрес объекта для расчёта расстояния и отображения маршрута на карте.'}
            </p>
          </div>

          {/* Маршрут + расстояние */}
          <div className="flex items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-3">
            <div className="flex-1">
              <div className="text-sm text-[var(--text-secondary)] mb-1">
                От: <span className="text-[var(--text-primary)]">ул. Островитянова, д.6, Москва</span>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                До: <span className="text-[var(--text-primary)]">{effectiveAddress || 'Адрес не указан'}</span>
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
          {effectiveAddress && (
            <div className="rounded-lg overflow-hidden border border-[var(--border-color)] aspect-[16/9]">
              <iframe
                key={effectiveAddress}
                src={`https://yandex.ru/map-widget/v1/?rtext=55.6443432,37.4906093~${encodeURIComponent(effectiveAddress)}&rtt=auto&z=11`}
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
