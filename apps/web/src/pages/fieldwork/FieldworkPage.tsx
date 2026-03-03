import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Camera,
  Upload,
  Check,
  CheckCircle,
  Crosshair,
  FolderOpen,
  Layers,
  Beaker,
  X,
  Navigation,
  Pencil,
  Loader2,
  Home,
  Mic,
  MicOff,
  SkipForward,
} from 'lucide-react';
import * as exifr from 'exifr';
import { projectsApi, type Photo } from '@/api/projects';
import { AuthImage } from '@/components/ui';

// ===================== ТИПЫ =====================

type NavState =
  | { view: 'projects' }
  | { view: 'project'; projectId: string }
  | { view: 'platforms'; projectId: string }
  | { view: 'platform'; projectId: string; platformId: string }
  | { view: 'samples'; projectId: string; platformId: string }
  | { view: 'sample'; projectId: string; platformId: string; sampleId: string }
  | { view: 'photos'; projectId: string };

// ===================== КОНСТАНТЫ =====================

const STORAGE_KEY = 'polevie-fieldwork';

const SOIL_DESCRIPTIONS = [
  'глина',
  'суглинок',
  'супесь',
  'песок',
  'торф',
  'ил',
  'гравий',
  'чернозём',
  'насыпной грунт',
  'строительный мусор',
];

// ===================== УТИЛИТЫ =====================

function loadNav(): NavState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { view: 'projects' };
}

function saveNav(state: NavState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatCoordinate(decimal: number): string {
  const degrees = Math.floor(Math.abs(decimal));
  const minutes = (Math.abs(decimal) - degrees) * 60;
  return `${degrees} ${minutes.toFixed(3)}`;
}

function parseCoordinate(coord: string): number | null {
  if (!coord) return null;
  const trimmed = coord.trim();
  const dmMatch = trimmed.match(/^(\d+)\s+(\d+\.?\d*)$/);
  if (dmMatch) {
    return parseFloat(dmMatch[1]) + parseFloat(dmMatch[2]) / 60;
  }
  const decimalMatch = trimmed.match(/^0*(\d+\.?\d*)$/);
  if (decimalMatch) return parseFloat(decimalMatch[1]);
  return null;
}

function getYandexMapsUrl(latitude: string, longitude: string): string | null {
  const lat = parseCoordinate(latitude);
  const lon = parseCoordinate(longitude);
  if (lat === null || lon === null) return null;
  return `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map`;
}

// ===================== ОБЩИЕ КОМПОНЕНТЫ =====================

function Header({
  title,
  onBack,
  rightAction,
}: {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-3 h-14 flex items-center gap-2 shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)]"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      <h1 className="text-base font-semibold truncate flex-1">{title}</h1>
      {rightAction}
    </div>
  );
}

function ListItem({
  icon,
  title,
  subtitle,
  rightText,
  statusColor,
  onClick,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  rightText?: string;
  statusColor?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)] transition-colors text-left"
    >
      {icon && (
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${statusColor || 'bg-primary-500/20 text-primary-400'}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{title}</div>
        {subtitle && (
          <div className="text-sm text-[var(--text-secondary)] truncate mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      {rightText && (
        <span className="text-sm text-[var(--text-secondary)] shrink-0">
          {rightText}
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-[var(--text-secondary)]">
      <FolderOpen className="w-12 h-12 mb-3 opacity-50" />
      <p>{text}</p>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'success' | 'primary';
  disabled?: boolean;
  loading?: boolean;
}) {
  const colors = {
    default: 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-[var(--text-primary)]',
    success: 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400',
    primary: 'bg-primary-500/20 hover:bg-primary-500/30 text-primary-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2.5 w-full p-3.5 rounded-xl transition-colors text-left ${colors[variant]} disabled:opacity-50`}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : <span className="shrink-0">{icon}</span>}
      <span className="font-medium">{label}</span>
    </button>
  );
}

// ===================== VOICE DESCRIBE OVERLAY =====================

function VoiceDescribeOverlay({
  projectId,
  photoIds,
  onClose,
}: {
  projectId: string;
  photoIds: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [index, setIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastText, setLastText] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: photos } = useQuery({
    queryKey: ['project-photos', projectId],
    queryFn: () => projectsApi.getPhotos(projectId),
  });

  const currentPhotoId = photoIds[index];
  const currentPhoto = photos?.find((p) => p.id === currentPhotoId);
  const total = photoIds.length;

  const advance = useCallback(() => {
    setLastText(null);
    const next = index + 1;
    if (next >= total) {
      onClose();
    } else {
      setIndex(next);
    }
  }, [index, total, onClose]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setIsTranscribing(true);
        setLastText(null);
        try {
          const result = await projectsApi.voiceDescribePhoto(projectId, currentPhotoId, blob);
          queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
          setLastText(result.transcription);
          setTimeout(advance, 1500);
        } catch {
          setToast('Ошибка распознавания');
          setTimeout(() => setToast(null), 3000);
        }
        setIsTranscribing(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setToast('Нет доступа к микрофону');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleClose = () => {
    if (isRecording) stopRecording();
    onClose();
  };

  if (!currentPhotoId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] flex flex-col max-w-lg mx-auto">
      <Header title={`Описание ${index + 1} из ${total}`} onBack={handleClose} />

      {toast && (
        <div className="fixed top-16 left-4 right-4 z-[60] p-3 rounded-xl bg-red-600/90 text-white text-center text-sm font-medium animate-fade-in max-w-lg mx-auto">
          {toast}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <AuthImage
          src={projectsApi.getPhotoThumbnailUrl(projectId, currentPhotoId)}
          alt=""
          className="max-w-full max-h-full object-contain rounded-xl"
        />
      </div>

      <div className="px-4 min-h-[3rem] flex items-center justify-center">
        {isTranscribing && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Распознаю...
          </div>
        )}
        {lastText && (
          <p className="text-sm text-emerald-400 text-center">{lastText}</p>
        )}
        {currentPhoto?.description && !lastText && !isTranscribing && (
          <p className="text-sm text-[var(--text-secondary)] text-center italic">
            {currentPhoto.description}
          </p>
        )}
      </div>

      <div className="p-4 pb-8 flex items-center justify-center gap-6">
        <button
          onClick={advance}
          disabled={isRecording || isTranscribing}
          className="p-3 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-40"
        >
          <SkipForward className="w-6 h-6" />
        </button>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${
            isRecording
              ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/30'
              : 'bg-primary-500 shadow-lg shadow-primary-500/30'
          }`}
        >
          {isRecording ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
        </button>
        <button
          onClick={handleClose}
          disabled={isRecording || isTranscribing}
          className="p-3 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-40"
        >
          <Check className="w-6 h-6" />
        </button>
      </div>

      <div className="text-center pb-4 text-xs text-[var(--text-secondary)]">
        {isRecording ? 'Говорите... Нажмите для остановки' : 'Нажмите микрофон и опишите фото'}
      </div>
    </div>
  );
}

// ===================== ЭКРАНЫ =====================

function ProjectsScreen({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  });

  if (isLoading) return <Spinner />;
  if (!projects?.length) return <EmptyState text="Нет объектов" />;

  return (
    <div className="space-y-2">
      {projects.map((p) => {
        const total = p._count?.samples ?? 0;
        return (
          <ListItem
            key={p.id}
            icon={<FolderOpen className="w-5 h-5" />}
            title={p.name}
            subtitle={p.objectAddress || 'Адрес не указан'}
            rightText={total > 0 ? `${total} проб` : undefined}
            onClick={() => onSelect(p.id)}
          />
        );
      })}
    </div>
  );
}

function ProjectScreen({
  projectId,
  onPlatforms,
  onPhotos,
  onBack,
}: {
  projectId: string;
  onPlatforms: () => void;
  onPhotos: () => void;
  onBack: () => void;
}) {
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(projectId),
  });
  const { data: samples } = useQuery({
    queryKey: ['project-samples', projectId],
    queryFn: () => projectsApi.getSamples(projectId),
  });
  const { data: photos } = useQuery({
    queryKey: ['project-photos', projectId],
    queryFn: () => projectsApi.getPhotos(projectId),
  });
  const { data: platforms } = useQuery({
    queryKey: ['project-platforms', projectId],
    queryFn: () => projectsApi.getPlatforms(projectId),
  });

  if (isLoading) return <><Header title="..." onBack={onBack} /><Spinner /></>;

  const collected = samples?.filter((s) => s.status === 'COLLECTED').length ?? 0;
  const total = samples?.length ?? 0;
  const progress = total > 0 ? Math.round((collected / total) * 100) : 0;
  const photosCount = photos?.length ?? 0;
  const platformsCount = platforms?.length ?? 0;

  return (
    <>
      <Header title={project?.name || 'Объект'} onBack={onBack} />
      <div className="p-4 space-y-4">
        {/* Info card */}
        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-[var(--text-secondary)] shrink-0" />
            <span className="text-sm text-[var(--text-secondary)]">
              {project?.objectAddress || 'Адрес не указан'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {collected}/{total}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <ActionButton
            icon={<Layers className="w-5 h-5" />}
            label={`Площадки (${platformsCount})`}
            onClick={onPlatforms}
            variant="primary"
          />
          <ActionButton
            icon={<Camera className="w-5 h-5" />}
            label={`Фотоальбом (${photosCount})`}
            onClick={onPhotos}
          />
        </div>
      </div>
    </>
  );
}

function PlatformsScreen({
  projectId,
  onSelect,
  onBack,
}: {
  projectId: string;
  onSelect: (platformId: string) => void;
  onBack: () => void;
}) {
  const { data: platforms, isLoading } = useQuery({
    queryKey: ['project-platforms', projectId],
    queryFn: () => projectsApi.getPlatforms(projectId),
  });

  if (isLoading) return <><Header title="Площадки" onBack={onBack} /><Spinner /></>;
  if (!platforms?.length) return <><Header title="Площадки" onBack={onBack} /><EmptyState text="Нет площадок" /></>;

  return (
    <>
      <Header title="Площадки" onBack={onBack} />
      <div className="p-4 space-y-2">
        {platforms.map((p) => {
          const collected = p.samples.filter((s) => s.status === 'COLLECTED').length;
          const total = p._count.samples;
          const done = collected === total && total > 0;
          return (
            <ListItem
              key={p.id}
              icon={done ? <CheckCircle className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
              title={p.label}
              subtitle={`${collected}/${total} собрано`}
              statusColor={done ? 'bg-emerald-500/20 text-emerald-400' : undefined}
              onClick={() => onSelect(p.id)}
            />
          );
        })}
      </div>
    </>
  );
}

function PlatformScreen({
  projectId,
  platformId,
  onSamples,
  onBack,
}: {
  projectId: string;
  platformId: string;
  onSamples: () => void;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [manualMode, setManualMode] = useState<'lat' | 'lon' | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [exifLoading, setExifLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [describePhotoIds, setDescribePhotoIds] = useState<string[] | null>(null);

  const { data: platforms } = useQuery({
    queryKey: ['project-platforms', projectId],
    queryFn: () => projectsApi.getPlatforms(projectId),
  });
  const platform = platforms?.find((p) => p.id === platformId);

  const { data: samples } = useQuery({
    queryKey: ['platform-samples', platformId],
    queryFn: async () => {
      const all = await projectsApi.getSamples(projectId);
      return all.filter((s) => s.platformId === platformId);
    },
  });

  const coordsMutation = useMutation({
    mutationFn: (data: { latitude?: string; longitude?: string }) =>
      projectsApi.updatePlatformCoordinates(projectId, platformId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-platforms', projectId] });
      queryClient.invalidateQueries({ queryKey: ['platform-samples', platformId] });
      queryClient.invalidateQueries({ queryKey: ['project-samples', projectId] });
      setManualMode(null);
      setManualValue('');
    },
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const firstSample = samples?.[0];
  const latitude = firstSample?.latitude || '—';
  const longitude = firstSample?.longitude || '—';
  const hasCoords = !!firstSample?.latitude && !!firstSample?.longitude;
  const collectedCount = samples?.filter((s) => s.status === 'COLLECTED').length ?? 0;
  const totalCount = samples?.length ?? 0;
  const mapsUrl = hasCoords ? getYandexMapsUrl(firstSample!.latitude!, firstSample!.longitude!) : null;

  const handleGeolocation = async () => {
    if (!navigator.geolocation) {
      showToast('Геолокация не поддерживается');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = formatCoordinate(pos.coords.latitude);
        const lon = formatCoordinate(pos.coords.longitude);
        await coordsMutation.mutateAsync({ latitude: lat, longitude: lon });
        showToast('Координаты сохранены');
        setGeoLoading(false);
      },
      () => {
        showToast('Не удалось получить геолокацию');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const handleExifPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExifLoading(true);
    try {
      const gps = await exifr.gps(file);
      if (!gps?.latitude || !gps?.longitude) {
        showToast('GPS-данные не найдены в фото');
        setExifLoading(false);
        return;
      }
      const lat = formatCoordinate(gps.latitude);
      const lon = formatCoordinate(gps.longitude);
      await coordsMutation.mutateAsync({ latitude: lat, longitude: lon });
      showToast('Координаты из EXIF сохранены');
    } catch {
      showToast('Ошибка чтения EXIF');
    }
    setExifLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualSave = () => {
    if (!manualValue.trim()) return;
    if (manualMode === 'lat') {
      coordsMutation.mutate({ latitude: manualValue.trim() });
      showToast('Широта сохранена');
    } else if (manualMode === 'lon') {
      coordsMutation.mutate({ longitude: manualValue.trim() });
      showToast('Долгота сохранена');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsUploadingPhotos(true);
    try {
      const results = await projectsApi.uploadPhotos(projectId, Array.from(files));
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      const uploaded = results.filter((r) => r.success && r.photo);
      const ids = uploaded.map((r) => r.photo!.id);
      const withGps = uploaded.filter((r) => r.photo!.latitude && r.photo!.longitude).length;
      const gpsInfo = withGps > 0 ? ` (${withGps} с GPS)` : '';
      showToast(`${ids.length} фото загружено${gpsInfo}`);
      if (ids.length > 0) {
        setDescribePhotoIds(ids);
      }
    } catch {
      showToast('Ошибка загрузки');
    }
    setIsUploadingPhotos(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  if (describePhotoIds) {
    return (
      <VoiceDescribeOverlay
        projectId={projectId}
        photoIds={describePhotoIds}
        onClose={() => setDescribePhotoIds(null)}
      />
    );
  }

  return (
    <>
      <Header title={platform?.label || 'Площадка'} onBack={onBack} />
      <div className="p-4 space-y-4">
        {/* Toast */}
        {toast && (
          <div className="fixed top-16 left-4 right-4 z-50 p-3 rounded-xl bg-emerald-600/90 text-white text-center text-sm font-medium animate-fade-in max-w-lg mx-auto">
            {toast}
          </div>
        )}

        {/* Coordinates */}
        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2.5 h-2.5 rounded-full ${hasCoords ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-sm font-medium">Координаты</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-[var(--text-secondary)]">Широта</div>
              <div className="font-mono">{latitude}</div>
            </div>
            <div>
              <div className="text-[var(--text-secondary)]">Долгота</div>
              <div className="font-mono">{longitude}</div>
            </div>
          </div>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary-400 mt-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              Открыть на карте
            </a>
          )}
        </div>

        {/* Manual input */}
        {manualMode && (
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3">
            <div className="text-sm font-medium">
              {manualMode === 'lat' ? 'Широта' : 'Долгота'}
              <span className="text-[var(--text-secondary)] ml-2">формат: 55 50.792</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder={manualMode === 'lat' ? '55 50.792' : '37 39.277'}
                className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm"
                autoFocus
              />
              <button
                onClick={handleManualSave}
                className="px-4 py-2.5 rounded-lg bg-primary-500 text-white text-sm font-medium"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setManualMode(null); setManualValue(''); }}
                className="px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Coordinate actions */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold px-1">
            Ввод координат
          </div>
          <ActionButton
            icon={<Crosshair className="w-5 h-5" />}
            label="Моя геолокация"
            onClick={handleGeolocation}
            loading={geoLoading}
            variant="primary"
          />
          <ActionButton
            icon={<Camera className="w-5 h-5" />}
            label="Определить по фото (EXIF)"
            onClick={() => fileInputRef.current?.click()}
            loading={exifLoading}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleExifPhoto}
          />
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              icon={<Pencil className="w-4 h-4" />}
              label="Широта"
              onClick={() => { setManualMode('lat'); setManualValue(''); }}
            />
            <ActionButton
              icon={<Pencil className="w-4 h-4" />}
              label="Долгота"
              onClick={() => { setManualMode('lon'); setManualValue(''); }}
            />
          </div>
        </div>

        {/* Photo upload */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold px-1">
            Фотоальбом
          </div>
          <ActionButton
            icon={<Camera className="w-5 h-5" />}
            label="Загрузить фото"
            onClick={() => photoInputRef.current?.click()}
            loading={isUploadingPhotos}
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>

        {/* Samples link */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold px-1">
            Пробы
          </div>
          <ActionButton
            icon={<Beaker className="w-5 h-5" />}
            label={`Пробы (${collectedCount}/${totalCount} собрано)`}
            onClick={onSamples}
            variant={collectedCount === totalCount && totalCount > 0 ? 'success' : 'default'}
          />
        </div>
      </div>
    </>
  );
}

function SamplesScreen({
  projectId,
  platformId,
  onSelect,
  onBack,
}: {
  projectId: string;
  platformId: string;
  onSelect: (sampleId: string) => void;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [showDescPicker, setShowDescPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: platforms } = useQuery({
    queryKey: ['project-platforms', projectId],
    queryFn: () => projectsApi.getPlatforms(projectId),
  });
  const platform = platforms?.find((p) => p.id === platformId);
  const isPP = platform?.type === 'PP';

  const { data: samples, isLoading } = useQuery({
    queryKey: ['platform-samples', platformId],
    queryFn: async () => {
      const all = await projectsApi.getSamples(projectId);
      return all.filter((s) => s.platformId === platformId);
    },
  });

  const collectAllMutation = useMutation({
    mutationFn: () => projectsApi.collectPlatformSamples(projectId, platformId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-samples', platformId] });
      queryClient.invalidateQueries({ queryKey: ['project-platforms', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-samples', projectId] });
      setToast('Все пробы отмечены');
      setTimeout(() => setToast(null), 3000);
    },
  });

  const descMutation = useMutation({
    mutationFn: (description: string) =>
      projectsApi.setPlatformDescription(projectId, platformId, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-samples', platformId] });
      setShowDescPicker(false);
      setToast('Характеристика сохранена');
      setTimeout(() => setToast(null), 3000);
    },
  });

  const allCollected = samples?.every((s) => s.status === 'COLLECTED') && (samples?.length ?? 0) > 0;

  if (isLoading) return <><Header title="Пробы" onBack={onBack} /><Spinner /></>;
  if (!samples?.length) return <><Header title="Пробы" onBack={onBack} /><EmptyState text="Нет проб" /></>;

  return (
    <>
      <Header title={`${platform?.label || ''} — пробы`} onBack={onBack} />
      <div className="p-4 space-y-3">
        {toast && (
          <div className="fixed top-16 left-4 right-4 z-50 p-3 rounded-xl bg-emerald-600/90 text-white text-center text-sm font-medium animate-fade-in max-w-lg mx-auto">
            {toast}
          </div>
        )}

        {/* Batch actions for PP */}
        {isPP && (
          <div className="space-y-2">
            {!allCollected && (
              <ActionButton
                icon={<CheckCircle className="w-5 h-5" />}
                label="Отметить все пробы отобранными"
                onClick={() => collectAllMutation.mutate()}
                loading={collectAllMutation.isPending}
                variant="success"
              />
            )}
            <ActionButton
              icon={<Pencil className="w-5 h-5" />}
              label={`Характеристика: ${samples[0]?.description || 'не указана'}`}
              onClick={() => setShowDescPicker(true)}
              variant="primary"
            />
          </div>
        )}

        {/* Description picker modal */}
        {showDescPicker && (
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-2">
            <div className="text-sm font-medium mb-2">Выберите характеристику:</div>
            <div className="grid grid-cols-2 gap-2">
              {SOIL_DESCRIPTIONS.map((desc) => (
                <button
                  key={desc}
                  onClick={() => descMutation.mutate(desc)}
                  disabled={descMutation.isPending}
                  className={`p-2.5 rounded-lg text-sm text-left transition-colors ${
                    samples[0]?.description === desc
                      ? 'bg-primary-500/30 text-primary-300 border border-primary-500/50'
                      : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]'
                  }`}
                >
                  {desc}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDescPicker(false)}
              className="w-full mt-2 p-2.5 rounded-lg bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]"
            >
              Отмена
            </button>
          </div>
        )}

        {/* Samples list */}
        {samples.map((s) => {
          const isCollected = s.status === 'COLLECTED';
          return (
            <ListItem
              key={s.id}
              icon={isCollected ? <Check className="w-5 h-5" /> : <Beaker className="w-5 h-5" />}
              title={s.cipher}
              subtitle={`${s.depthLabel}${s.description ? ` • ${s.description}` : ''}`}
              statusColor={isCollected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}
              onClick={() => onSelect(s.id)}
            />
          );
        })}
      </div>
    </>
  );
}

function SampleScreen({
  projectId,
  platformId,
  sampleId,
  onBack,
}: {
  projectId: string;
  platformId: string;
  sampleId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [showDescPicker, setShowDescPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: platforms } = useQuery({
    queryKey: ['project-platforms', projectId],
    queryFn: () => projectsApi.getPlatforms(projectId),
  });
  const platform = platforms?.find((p) => p.id === platformId);
  const isPP = platform?.type === 'PP';

  const { data: samples } = useQuery({
    queryKey: ['platform-samples', platformId],
    queryFn: async () => {
      const all = await projectsApi.getSamples(projectId);
      return all.filter((s) => s.platformId === platformId);
    },
  });

  const sample = samples?.find((s) => s.id === sampleId);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-samples', platformId] });
    queryClient.invalidateQueries({ queryKey: ['project-platforms', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-samples', projectId] });
  };

  const collectMutation = useMutation({
    mutationFn: async () => {
      if (isPP) await projectsApi.collectPlatformSamples(projectId, platformId);
      else await projectsApi.collectSample(projectId, sampleId);
    },
    onSuccess: () => {
      invalidateAll();
      setToast(isPP ? 'Все пробы площадки отмечены' : 'Проба отмечена');
      setTimeout(() => setToast(null), 3000);
    },
  });

  const descMutation = useMutation({
    mutationFn: async (description: string) => {
      if (isPP) await projectsApi.setPlatformDescription(projectId, platformId, description);
      else await projectsApi.updateSample(projectId, sampleId, { description });
    },
    onSuccess: () => {
      invalidateAll();
      setShowDescPicker(false);
      setToast(isPP ? 'Характеристика для всей площадки сохранена' : 'Характеристика сохранена');
      setTimeout(() => setToast(null), 3000);
    },
  });

  if (!sample) return <><Header title="Проба" onBack={onBack} /><Spinner /></>;

  const isCollected = sample.status === 'COLLECTED';
  const allCollected = isPP
    ? samples?.every((s) => s.status === 'COLLECTED')
    : isCollected;

  return (
    <>
      <Header title={sample.cipher} onBack={onBack} />
      <div className="p-4 space-y-4">
        {toast && (
          <div className="fixed top-16 left-4 right-4 z-50 p-3 rounded-xl bg-emerald-600/90 text-white text-center text-sm font-medium animate-fade-in max-w-lg mx-auto">
            {toast}
          </div>
        )}

        {/* Sample info */}
        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3">
          <InfoRow label="Площадка" value={sample.platform.label} />
          <InfoRow label="Глубина" value={sample.depthLabel} />
          <InfoRow label="Масса" value={sample.mass} />
          <InfoRow label="Характеристика" value={sample.description || '—'} />
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isCollected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-sm">{isCollected ? 'Отобрана' : 'Ожидает'}</span>
          </div>
          {isPP && (
            <div className="text-xs text-amber-400/80 bg-amber-500/10 px-2.5 py-1.5 rounded-lg">
              ПП — действия применяются ко всем пробам площадки
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <ActionButton
            icon={<Pencil className="w-5 h-5" />}
            label="Характеристика"
            onClick={() => setShowDescPicker(true)}
            variant="primary"
          />
          {!allCollected && (
            <ActionButton
              icon={<CheckCircle className="w-5 h-5" />}
              label={isPP ? 'Отметить всю площадку отобранной' : 'Отметить отобранной'}
              onClick={() => collectMutation.mutate()}
              loading={collectMutation.isPending}
              variant="success"
            />
          )}
        </div>

        {/* Description picker */}
        {showDescPicker && (
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-2">
            <div className="text-sm font-medium mb-2">
              Выберите характеристику{isPP ? ' (для всей площадки)' : ''}:
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SOIL_DESCRIPTIONS.map((desc) => (
                <button
                  key={desc}
                  onClick={() => descMutation.mutate(desc)}
                  disabled={descMutation.isPending}
                  className={`p-2.5 rounded-lg text-sm text-left transition-colors ${
                    sample.description === desc
                      ? 'bg-primary-500/30 text-primary-300 border border-primary-500/50'
                      : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]'
                  }`}
                >
                  {desc}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDescPicker(false)}
              className="w-full mt-2 p-2.5 rounded-lg bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]"
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PhotosScreen({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [descValue, setDescValue] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [describePhotoIds, setDescribePhotoIds] = useState<string[] | null>(null);

  const { data: photos, isLoading } = useQuery({
    queryKey: ['project-photos', projectId],
    queryFn: () => projectsApi.getPhotos(projectId),
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => projectsApi.uploadPhotos(projectId, files),
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      setIsUploading(false);
      const uploaded = results.filter((r) => r.success && r.photo);
      const ids = uploaded.map((r) => r.photo!.id);
      const withGps = uploaded.filter((r) => r.photo!.latitude && r.photo!.longitude).length;
      const gpsInfo = withGps > 0 ? ` (${withGps} с GPS)` : '';
      showToast(`${ids.length} фото загружено${gpsInfo}`);
      if (ids.length > 0) {
        setDescribePhotoIds(ids);
      }
    },
    onError: () => setIsUploading(false),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { photoId: string; description: string }) =>
      projectsApi.updatePhoto(projectId, data.photoId, { description: data.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] });
      setEditingPhotoId(null);
      setDescValue('');
    },
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsUploading(true);
    uploadMutation.mutate(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (describePhotoIds) {
    return (
      <VoiceDescribeOverlay
        projectId={projectId}
        photoIds={describePhotoIds}
        onClose={() => setDescribePhotoIds(null)}
      />
    );
  }

  return (
    <>
      <Header
        title={`Фотоальбом (${photos?.length ?? 0})`}
        onBack={onBack}
        rightAction={
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 rounded-lg bg-primary-500/20 text-primary-400"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          </button>
        }
      />
      <div className="p-4 space-y-3">
        {toast && (
          <div className="fixed top-16 left-4 right-4 z-50 p-3 rounded-xl bg-emerald-600/90 text-white text-center text-sm font-medium animate-fade-in max-w-lg mx-auto">
            {toast}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />

        <ActionButton
          icon={<Camera className="w-5 h-5" />}
          label="Загрузить фото"
          onClick={() => fileInputRef.current?.click()}
          loading={isUploading}
          variant="primary"
        />

        {photos && photos.filter((p) => !p.description).length > 0 && (
          <ActionButton
            icon={<Mic className="w-5 h-5" />}
            label={`Описать голосом (${photos.filter((p) => !p.description).length} без описания)`}
            onClick={() => {
              setDescribePhotoIds(photos.filter((p) => !p.description).map((p) => p.id));
            }}
          />
        )}

        {isLoading && <Spinner />}

        {!isLoading && !photos?.length && <EmptyState text="Нет фото" />}

        {photos && photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative">
                <button
                  onClick={() => setViewPhoto(photo)}
                  className="w-full aspect-square rounded-lg overflow-hidden bg-[var(--bg-tertiary)]"
                >
                  <AuthImage
                    src={projectsApi.getPhotoThumbnailUrl(projectId, photo.id)}
                    alt={photo.description || ''}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
                {photo.latitude && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500/80 flex items-center justify-center">
                    <MapPin className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                {!photo.description && (
                  <div className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-amber-500/80 flex items-center justify-center">
                    <Mic className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo viewer */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between p-3">
            <button onClick={() => setViewPhoto(null)} className="p-2 text-white">
              <X className="w-6 h-6" />
            </button>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const id = viewPhoto.id;
                  setViewPhoto(null);
                  setDescribePhotoIds([id]);
                }}
                className="p-2 text-white"
              >
                <Mic className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setEditingPhotoId(viewPhoto.id);
                  setDescValue(viewPhoto.description || '');
                }}
                className="p-2 text-white"
              >
                <Pencil className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <AuthImage
              src={projectsApi.getPhotoOriginalUrl(projectId, viewPhoto.id)}
              alt={viewPhoto.description || ''}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
          <div className="p-4 space-y-2">
            {editingPhotoId === viewPhoto.id ? (
              <div className="flex gap-2">
                <input
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  placeholder="Описание фото..."
                  className="flex-1 px-3 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm"
                  autoFocus
                />
                <button
                  onClick={() => updateMutation.mutate({ photoId: viewPhoto.id, description: descValue })}
                  className="px-4 py-2.5 rounded-lg bg-primary-500 text-white text-sm"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {viewPhoto.description && (
                  <p className="text-white/80 text-sm">{viewPhoto.description}</p>
                )}
                {viewPhoto.latitude && viewPhoto.longitude && (
                  <div className="flex items-center gap-1.5 text-white/60 text-xs">
                    <MapPin className="w-3 h-3" />
                    <span>{viewPhoto.latitude}, {viewPhoto.longitude}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ===================== ГЛАВНЫЙ КОМПОНЕНТ =====================

export function FieldworkPage() {
  const navigate = useNavigate();
  const [nav, setNav] = useState<NavState>(loadNav);

  useEffect(() => {
    saveNav(nav);
  }, [nav]);

  const go = useCallback((newNav: NavState) => setNav(newNav), []);

  const renderScreen = () => {
    switch (nav.view) {
      case 'projects':
        return (
          <>
            <Header
              title="Полевые работы"
              rightAction={
                <button
                  onClick={() => navigate('/dashboard')}
                  className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]"
                >
                  <Home className="w-5 h-5 text-[var(--text-secondary)]" />
                </button>
              }
            />
            <div className="p-4">
              <ProjectsScreen onSelect={(id) => go({ view: 'project', projectId: id })} />
            </div>
          </>
        );

      case 'project':
        return (
          <ProjectScreen
            projectId={nav.projectId}
            onPlatforms={() => go({ view: 'platforms', projectId: nav.projectId })}
            onPhotos={() => go({ view: 'photos', projectId: nav.projectId })}
            onBack={() => go({ view: 'projects' })}
          />
        );

      case 'platforms':
        return (
          <PlatformsScreen
            projectId={nav.projectId}
            onSelect={(platformId) =>
              go({ view: 'platform', projectId: nav.projectId, platformId })
            }
            onBack={() => go({ view: 'project', projectId: nav.projectId })}
          />
        );

      case 'platform':
        return (
          <PlatformScreen
            projectId={nav.projectId}
            platformId={nav.platformId}
            onSamples={() =>
              go({
                view: 'samples',
                projectId: nav.projectId,
                platformId: nav.platformId,
              })
            }
            onBack={() => go({ view: 'platforms', projectId: nav.projectId })}
          />
        );

      case 'samples':
        return (
          <SamplesScreen
            projectId={nav.projectId}
            platformId={nav.platformId}
            onSelect={(sampleId) =>
              go({
                view: 'sample',
                projectId: nav.projectId,
                platformId: nav.platformId,
                sampleId,
              })
            }
            onBack={() =>
              go({
                view: 'platform',
                projectId: nav.projectId,
                platformId: nav.platformId,
              })
            }
          />
        );

      case 'sample':
        return (
          <SampleScreen
            projectId={nav.projectId}
            platformId={nav.platformId}
            sampleId={nav.sampleId}
            onBack={() =>
              go({
                view: 'samples',
                projectId: nav.projectId,
                platformId: nav.platformId,
              })
            }
          />
        );

      case 'photos':
        return (
          <PhotosScreen
            projectId={nav.projectId}
            onBack={() => go({ view: 'project', projectId: nav.projectId })}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col max-w-lg mx-auto">
      {renderScreen()}
    </div>
  );
}
