import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Upload,
  Trash2,
  Save,
  Download,
  MapPin,
  Image,
  Loader2,
  Info,
} from 'lucide-react';
import { projectsApi, type DistanceResult } from '@/api/projects';
import { Button, Input, Card, CardContent } from '@/components/ui';

const CADASTRAL_REGEX = /^\d{2}:\d{2}:\d{6,7}:\d{1,5}$/;

const formatCadastralNumber = (value: string, prevValue: string): string => {
  const cleaned = value.replace(/[^\d:]/g, '');
  const colonCount = (cleaned.match(/:/g) || []).length;
  const prevColonCount = (prevValue.match(/:/g) || []).length;
  const isPaste =
    colonCount >= 3 ||
    cleaned.replace(/:/g, '').length - prevValue.replace(/:/g, '').length > 3;

  if (isPaste && colonCount >= 3) {
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

  if (colonCount > prevColonCount) {
    const parts = cleaned.split(':');
    const limits = [2, 2, 7, 5];
    const formatted = parts
      .slice(0, 4)
      .map((p, i) => p.replace(/\D/g, '').slice(0, limits[i]));
    return formatted.filter(Boolean).join(':');
  }

  const digits = cleaned.replace(/:/g, '').slice(0, 16);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 4);
  const part3 = digits.slice(4, 11);
  const part4 = digits.slice(11, 16);

  let result = part1;
  if (part2) result += (part1.length === 2 ? ':' : '') + part2;
  if (part3) result += (part2.length === 2 ? ':' : '') + part3;
  if (part4) result += (part3.length === 7 ? ':' : '') + part4;

  return result;
};

const validateCadastralNumber = (value: string): boolean => {
  if (!value) return true;
  return CADASTRAL_REGEX.test(value);
};

export function ProgramIgmiPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cadastralNumber, setCadastralNumber] = useState('');
  const [cadastralError, setCadastralError] = useState('');
  const [egrnDescription, setEgrnDescription] = useState('');
  const [nearbyText, setNearbyText] = useState('');
  const [openGroundPercent, setOpenGroundPercent] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });

  const { data: programIgmi, isLoading: programLoading } = useQuery({
    queryKey: ['program-igmi', id],
    queryFn: () => projectsApi.getProgramIgmi(id!),
    enabled: !!id,
  });

  const { data: distanceData, isLoading: distanceLoading } = useQuery({
    queryKey: ['distance', id],
    queryFn: () => projectsApi.getDistanceToObject(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (programIgmi) {
      setCadastralNumber(programIgmi.cadastralNumber || '');
      setEgrnDescription(programIgmi.egrnDescription || '');
      const parts = [
        programIgmi.nearbySouth ? `К югу: ${programIgmi.nearbySouth}` : 'К югу: ',
        programIgmi.nearbyEast ? `К востоку: ${programIgmi.nearbyEast}` : 'К востоку: ',
        programIgmi.nearbyWest ? `К западу: ${programIgmi.nearbyWest}` : 'К западу: ',
        programIgmi.nearbyNorth ? `К северу: ${programIgmi.nearbyNorth}` : 'К северу: ',
      ];
      setNearbyText(parts.join('\n'));
      setOpenGroundPercent(programIgmi.openGroundPercent ?? null);
      setHasChanges(false);
    }
  }, [programIgmi]);

  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const parseNearbyText = (text: string) => {
    const markers = [
      { key: 'nearbySouth', prefix: /к\s*югу\s*:\s*/i },
      { key: 'nearbyEast', prefix: /к\s*востоку\s*:\s*/i },
      { key: 'nearbyWest', prefix: /к\s*западу\s*:\s*/i },
      { key: 'nearbyNorth', prefix: /к\s*северу\s*:\s*/i },
    ];
    const result: Record<string, string> = {};
    const positions: { key: string; start: number; prefixEnd: number }[] = [];

    for (const m of markers) {
      const match = text.match(m.prefix);
      if (match && match.index !== undefined) {
        positions.push({
          key: m.key,
          start: match.index,
          prefixEnd: match.index + match[0].length,
        });
      }
    }
    positions.sort((a, b) => a.start - b.start);

    for (let i = 0; i < positions.length; i++) {
      const from = positions[i].prefixEnd;
      const to = i + 1 < positions.length ? positions[i + 1].start : text.length;
      result[positions[i].key] = text.slice(from, to).trim();
    }
    return result;
  };

  const updateMutation = useMutation({
    mutationFn: (data: {
      cadastralNumber?: string;
      egrnDescription?: string;
      nearbySouth?: string;
      nearbyEast?: string;
      nearbyWest?: string;
      nearbyNorth?: string;
      openGroundPercent?: number | null;
    }) => projectsApi.updateProgramIgmi(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-igmi', id] });
      queryClient.invalidateQueries({ queryKey: ['program-iei', id] });
      setHasChanges(false);
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => projectsApi.uploadProgramIgmiOverviewImage(id!, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-igmi', id] });
      queryClient.invalidateQueries({ queryKey: ['program-iei', id] });
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: () => projectsApi.deleteProgramIgmiOverviewImage(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-igmi', id] });
      queryClient.invalidateQueries({ queryKey: ['program-iei', id] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => projectsApi.generateProgramIgmi(id!),
    onSuccess: async (result) => {
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ['program-igmi', id] });
      await projectsApi.downloadWord(id!, result.fileName);
    },
    onError: () => {
      setIsGenerating(false);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    uploadImageMutation.mutate(file);
    e.target.value = '';
  };

  const handleSave = () => {
    if (cadastralNumber && !validateCadastralNumber(cadastralNumber)) {
      setCadastralError('Исправьте кадастровый номер перед сохранением');
      return;
    }

    const parsed = parseNearbyText(nearbyText);
    updateMutation.mutate({
      cadastralNumber: cadastralNumber || undefined,
      egrnDescription: egrnDescription || undefined,
      nearbySouth: parsed.nearbySouth || undefined,
      nearbyEast: parsed.nearbyEast || undefined,
      nearbyWest: parsed.nearbyWest || undefined,
      nearbyNorth: parsed.nearbyNorth || undefined,
      openGroundPercent,
    });
  };

  const handleGenerate = () => {
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

    if (formatted && !validateCadastralNumber(formatted)) {
      setCadastralError('Неверный формат. Пример: 77:06:0009005:10');
    } else {
      setCadastralError('');
    }
  };

  const markChanged = () => setHasChanges(true);

  const yandexUrl = (() => {
    const lat = Number(String(programIgmi?.coordinatesLat || '').replace(',', '.'));
    const lon = Number(String(programIgmi?.coordinatesLon || '').replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
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
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Программа ИГМИ</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {project.objectName || project.name}
              </p>
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

      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-cyan-100">
          На этой странице используются те же исходные поля, что и в программе ИЭИ. Если они
          уже заполнены в ИЭИ, данные подтянутся автоматически.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Image className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                1.9.4 Обзорная схема размещения объекта
              </h2>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {programIgmi?.overviewImageUrl ? (
              <div className="space-y-4">
                <div className="relative aspect-video bg-[var(--bg-tertiary)] rounded-lg overflow-hidden">
                  <img
                    src={programIgmi.overviewImageUrl}
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                1.10 Сведения из ЕГРН
              </h2>
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
                  className={
                    cadastralError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
                  }
                />
                {cadastralError && <p className="mt-1 text-xs text-red-400">{cadastralError}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Сведения о категории земель и разрешенном использовании
                </label>
                <textarea
                  value={egrnDescription}
                  onChange={(e) => {
                    setEgrnDescription(e.target.value);
                    markChanged();
                  }}
                  rows={6}
                  className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <DistanceSection
          projectId={id!}
          objectAddress={project?.objectAddress || null}
          distanceData={distanceData}
          distanceLoading={distanceLoading}
          queryClient={queryClient}
        />

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                3.2 Окружение участка и координаты
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Координаты (из ТЗ)
                </label>
                <div className="flex items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2">
                  <div className="text-sm text-[var(--text-primary)]">
                    {programIgmi?.coordinatesLat && programIgmi?.coordinatesLon
                      ? `${programIgmi.coordinatesLat}, ${programIgmi.coordinatesLon}`
                      : 'Не найдены в ТЗ'}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!yandexUrl}
                    onClick={() =>
                      yandexUrl && window.open(yandexUrl, '_blank', 'noopener,noreferrer')
                    }
                    className="flex items-center gap-2"
                  >
                    <MapPin className="w-4 h-4" />
                    Яндекс.Карты
                  </Button>
                </div>
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
                  rows={10}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-y transition-colors font-mono text-sm leading-relaxed"
                />
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Площадь поверхности открытого грунта:{' '}
                  <span className="text-cyan-400 font-semibold">
                    {openGroundPercent !== null ? `${openGroundPercent}%` : 'не указано'}
                  </span>
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
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
                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${
                          openGroundPercent ?? 50
                        }%, var(--bg-tertiary, #374151) ${
                          openGroundPercent ?? 50
                        }%, var(--bg-tertiary, #374151) 100%)`,
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
                        const val = e.target.value
                          ? Math.min(100, Math.max(0, Number(e.target.value)))
                          : null;
                        setOpenGroundPercent(val);
                        markChanged();
                      }}
                      className="w-20"
                      placeholder="—"
                    />
                    <span className="text-sm text-[var(--text-secondary)]">%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {programIgmi?.igmiGeneratedAt && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Download className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Последняя генерация
              </h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-primary)]">
                  {programIgmi.igmiGeneratedFileName}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {new Date(programIgmi.igmiGeneratedAt).toLocaleString('ru-RU')}
                </p>
              </div>
              <Button
                onClick={() =>
                  programIgmi.igmiGeneratedFileName &&
                  projectsApi.downloadWord(id!, programIgmi.igmiGeneratedFileName)
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
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            4.2 Расстояние от офиса до объекта
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-3">
            <div className="flex-1">
              <div className="text-sm text-[var(--text-secondary)] mb-1">
                От:{' '}
                <span className="text-[var(--text-primary)]">
                  ул. Островитянова, д.6, Москва
                </span>
              </div>
              <div className="text-sm text-[var(--text-secondary)]">
                До:{' '}
                <span className="text-[var(--text-primary)]">
                  {objectAddress || 'Адрес не указан'}
                </span>
              </div>
            </div>
            <div className="text-right">
              {distanceLoading || recalcMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">Расчет...</span>
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
                <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
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
                  {recalcMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  Пересчитать
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
