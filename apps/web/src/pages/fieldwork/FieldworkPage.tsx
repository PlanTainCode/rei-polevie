import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
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
  FileText,
  Activity,
  Download,
  Smartphone,
} from 'lucide-react';
import * as exifr from 'exifr';
import { projectsApi, type Photo } from '@/api/projects';
import { monitoringsApi, type MonitoringPhoto } from '@/api/monitorings';
import {
  gtsMonitoringsApi,
  type GtsPhoto as GtsElementPhoto,
  type GtsLegacyMedia,
} from '@/api/gts-monitorings';
import { AuthImage } from '@/components/ui';

// ===================== ТИПЫ =====================

type NavState =
  | { view: 'mode-select' }
  | { view: 'projects' }
  | { view: 'project'; projectId: string }
  | { view: 'platforms'; projectId: string }
  | { view: 'platform'; projectId: string; platformId: string }
  | { view: 'samples'; projectId: string; platformId: string }
  | { view: 'sample'; projectId: string; platformId: string; sampleId: string }
  | { view: 'photos'; projectId: string }
  | { view: 'monitoring-list' }
  | { view: 'monitoring'; monitoringId: string }
  | { view: 'monitoring-points'; monitoringId: string }
  | { view: 'monitoring-point'; monitoringId: string; pointName: string }
  | { view: 'gts-monitoring-list' }
  | { view: 'gts-monitoring'; gtsMonitoringId: string }
  | { view: 'gts-district'; gtsMonitoringId: string; districtId: string }
  | { view: 'gts-object'; gtsMonitoringId: string; objectId: string };

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

const WATER_DESCRIPTIONS = [
  'прозрачная', 'слабо мутная', 'мутная', 'с осадком',
  'с запахом', 'окрашенная', 'с плёнкой на поверхности', 'с водорослями',
];

const SEDIMENT_DESCRIPTIONS = [
  'ил', 'песок', 'глина', 'суглинок', 'торф',
  'гравий', 'ракушечник', 'смешанный грунт',
];

const WATER_VOLUME_OPTIONS = [
  '2 л/Ст.; 1,5 л/ПЭТ',
  '1,5 л/ПЭТ',
  '1 л/Ст.',
  '0,5 л/Ст.',
];

const WATER_CONTAINER_COUNT_OPTIONS = ['1', '2', '3', '4', '5'];

const SEDIMENT_MASS_OPTIONS = [
  '1 кг/ПЭ',
  '0,5 кг/ПЭ',
  '2 кг/ПЭ',
];

// ===================== УТИЛИТЫ =====================

function loadNav(): NavState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { view: 'mode-select' };
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function FieldBtn({ label, value, onClick }: { label: string; value?: string | null; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex justify-between items-center w-full text-sm py-1">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className={`font-medium ${value ? '' : 'text-primary-400'}`}>{value || 'Указать'}</span>
    </button>
  );
}

function PickerList({ options, current, onSelect, onClose }: { options: string[]; current?: string | null; onSelect: (v: string) => void; onClose: () => void }) {
  return (
    <div className="space-y-1 py-2 border-t border-b border-[var(--border-color)]">
      {options.map((o) => (
        <button key={o} onClick={() => onSelect(o)} className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${current === o ? 'bg-primary-500/20 text-primary-400 font-medium' : 'hover:bg-[var(--bg-tertiary)]'}`}>
          {o}
        </button>
      ))}
      <button onClick={onClose} className="w-full mt-1 p-2 rounded-lg bg-[var(--bg-tertiary)] text-sm text-[var(--text-secondary)]">Отмена</button>
    </div>
  );
}

function FieldInput({ value, onChange, placeholder, onSave, onClose }: { value: string; onChange: (v: string) => void; placeholder: string; onSave: () => void; onClose: () => void }) {
  return (
    <div className="flex gap-2 py-2 border-t border-b border-[var(--border-color)]">
      <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm" autoFocus />
      <button onClick={onSave} className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium"><Check className="w-4 h-4" /></button>
      <button onClick={onClose} className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] text-sm"><X className="w-4 h-4" /></button>
    </div>
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

// ===================== MONITORING VOICE DESCRIBE OVERLAY =====================

function MonitoringVoiceDescribeOverlay({
  monitoringId,
  photos,
  photoIds,
  onClose,
}: {
  monitoringId: string;
  photos: MonitoringPhoto[];
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

  const currentPhotoId = photoIds[index];
  const currentPhoto = photos.find((p) => p.id === currentPhotoId);
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
          const result = await monitoringsApi.voiceDescribePhoto(monitoringId, currentPhotoId, blob);
          queryClient.invalidateQueries({ queryKey: ['monitoring-point-photos'] });
          queryClient.invalidateQueries({ queryKey: ['monitoring-photos'] });
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

  const thumbnailUrl = `${monitoringsApi.getPhotoThumbnailUrl(monitoringId, currentPhotoId)}`;

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
          src={thumbnailUrl}
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

// ===================== ЭКРАНЫ: ОБЪЕКТЫ =====================

const APK_POPUP_KEY = 'polevie-apk-popup-dismissed';

function ModeSelectScreen({
  onObjects,
  onMonitorings,
  onGts,
}: {
  onObjects: () => void;
  onMonitorings: () => void;
  onGts: () => void;
}) {
  const [showApkPopup, setShowApkPopup] = useState(() => {
    return !localStorage.getItem(APK_POPUP_KEY);
  });

  const dismissPopup = () => {
    setShowApkPopup(false);
    localStorage.setItem(APK_POPUP_KEY, '1');
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 gap-4">
      <h1 className="text-xl font-bold mb-4">Полевые работы</h1>
      <button
        onClick={onObjects}
        className="w-full p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)] transition-colors flex flex-col items-center gap-3"
      >
        <div className="w-14 h-14 rounded-xl bg-primary-500/20 text-primary-400 flex items-center justify-center">
          <FileText className="w-7 h-7" />
        </div>
        <span className="text-lg font-semibold">Объекты</span>
        <span className="text-sm text-[var(--text-secondary)]">Площадки и пробы грунта</span>
      </button>
      <button
        onClick={onMonitorings}
        className="w-full p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)] transition-colors flex flex-col items-center gap-3"
      >
        <div className="w-14 h-14 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
          <Activity className="w-7 h-7" />
        </div>
        <span className="text-lg font-semibold">Мониторинги</span>
        <span className="text-sm text-[var(--text-secondary)]">Пробы воды и донных отложений</span>
      </button>
      <button
        onClick={onGts}
        className="w-full p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)] transition-colors flex flex-col items-center gap-3"
      >
        <div className="w-14 h-14 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
          <Layers className="w-7 h-7" />
        </div>
        <span className="text-lg font-semibold">Мониторинг ГТС</span>
        <span className="text-sm text-[var(--text-secondary)]">Гидротехнические сооружения</span>
      </button>

      <a
        href="/polevie.apk"
        download
        className="w-full mt-2 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-emerald-500/30 hover:bg-emerald-500/10 active:bg-emerald-500/10 transition-colors flex items-center gap-4"
      >
        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <Smartphone className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-base font-semibold block">Скачать Android-приложение</span>
          <span className="text-xs text-[var(--text-secondary)]">Работает без интернета, быстрее и удобнее</span>
        </div>
        <Download className="w-5 h-5 text-emerald-400 shrink-0" />
      </a>

      {showApkPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-6 space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Приложение для Android</h3>
                <p className="text-sm text-[var(--text-secondary)]">Работает офлайн и синхронизируется автоматически</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={dismissPopup}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                Позже
              </button>
              <a
                href="/polevie.apk"
                download
                onClick={dismissPopup}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium text-center transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Скачать
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      showToast('Геолокация не поддерживается браузером');
      return;
    }
    setGeoLoading(true);

    const requestPosition = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = formatCoordinate(pos.coords.latitude);
          const lon = formatCoordinate(pos.coords.longitude);
          coordsMutation.mutate(
            { latitude: lat, longitude: lon },
            {
              onSuccess: () => {
                showToast(`Координаты сохранены (±${Math.round(pos.coords.accuracy)}м)`);
                setGeoLoading(false);
              },
              onError: () => {
                showToast('Ошибка сохранения координат');
                setGeoLoading(false);
              },
            },
          );
        },
        (err) => {
          if (highAccuracy && err.code === 2) {
            requestPosition(false);
            return;
          }
          const messages: Record<number, string> = {
            1: 'Доступ запрещён. Проверьте: Настройки → Конфиденциальность → Службы геолокации → Safari',
            2: 'Не удалось определить местоположение',
            3: 'Таймаут — попробуйте выйти на открытое место',
          };
          showToast(messages[err.code] || `Ошибка: ${err.message}`);
          setGeoLoading(false);
        },
        { enableHighAccuracy: highAccuracy, timeout: 30000, maximumAge: 0 },
      );
    };

    requestPosition(true);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Ошибка загрузки: ${msg}`);
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
        {toast && (
          <div className="fixed top-16 left-4 right-4 z-50 p-3 rounded-xl bg-emerald-600/90 text-white text-center text-sm font-medium animate-fade-in max-w-lg mx-auto">
            {toast}
          </div>
        )}

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
            className="absolute w-0 h-0 opacity-0 overflow-hidden"
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
            className="absolute w-0 h-0 opacity-0 overflow-hidden"
            onChange={handlePhotoUpload}
          />
        </div>

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
    onError: (err) => {
      setIsUploading(false);
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Ошибка загрузки: ${msg}`);
    },
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
          className="absolute w-0 h-0 opacity-0 overflow-hidden"
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

// ===================== ЭКРАНЫ: МОНИТОРИНГИ =====================

function MonitoringListScreen({
  onSelect,
  onBack,
}: {
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const { data: monitorings, isLoading } = useQuery({
    queryKey: ['monitorings'],
    queryFn: monitoringsApi.getAll,
  });

  if (isLoading) return <><Header title="Мониторинги" onBack={onBack} /><Spinner /></>;
  if (!monitorings?.length) return <><Header title="Мониторинги" onBack={onBack} /><EmptyState text="Нет мониторингов" /></>;

  return (
    <>
      <Header title="Мониторинги" onBack={onBack} />
      <div className="p-4 space-y-2">
        {monitorings.map((m) => {
          const probeCount = m._count?.probes ?? 0;
          const statusLabel = m.status === 'COMPLETED' ? 'Завершён' : m.status === 'IN_PROGRESS' ? 'В работе' : 'Новый';
          const statusColor = m.status === 'COMPLETED'
            ? 'bg-emerald-500/20 text-emerald-400'
            : m.status === 'IN_PROGRESS'
              ? 'bg-cyan-500/20 text-cyan-400'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]';
          return (
            <ListItem
              key={m.id}
              icon={<Activity className="w-5 h-5" />}
              title={m.name}
              subtitle={`${m.objectName || 'Объект не указан'} • ${statusLabel}`}
              rightText={probeCount > 0 ? `${probeCount} проб` : undefined}
              statusColor={statusColor}
              onClick={() => onSelect(m.id)}
            />
          );
        })}
      </div>
    </>
  );
}

function MonitoringScreen({
  monitoringId,
  onProbes,
  onBack,
}: {
  monitoringId: string;
  onProbes: () => void;
  onBack: () => void;
}) {
  const { data: monitoring, isLoading } = useQuery({
    queryKey: ['monitoring', monitoringId],
    queryFn: () => monitoringsApi.getById(monitoringId),
  });

  const { data: probes } = useQuery({
    queryKey: ['monitoring-probes', monitoringId],
    queryFn: () => monitoringsApi.getProbes(monitoringId),
  });

  if (isLoading) return <><Header title="..." onBack={onBack} /><Spinner /></>;

  const collected = probes?.filter((p) => p.status === 'COLLECTED').length ?? 0;
  const total = probes?.length ?? 0;
  const progress = total > 0 ? Math.round((collected / total) * 100) : 0;

  return (
    <>
      <Header title={monitoring?.name || 'Мониторинг'} onBack={onBack} />
      <div className="p-4 space-y-4">
        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3">
          {monitoring?.objectName && (
            <InfoRow label="Объект" value={monitoring.objectName} />
          )}
          {monitoring?.objectAddress && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 text-[var(--text-secondary)] shrink-0" />
              <span className="text-sm text-[var(--text-secondary)]">{monitoring.objectAddress}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {collected}/{total}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <ActionButton
            icon={<Beaker className="w-5 h-5" />}
            label={`Точки наблюдения (${collected}/${total} отобрано)`}
            onClick={onProbes}
            variant={collected === total && total > 0 ? 'success' : 'primary'}
          />
        </div>
      </div>
    </>
  );
}

function MonitoringPointsScreen({
  monitoringId,
  onSelect,
  onBack,
}: {
  monitoringId: string;
  onSelect: (pointName: string) => void;
  onBack: () => void;
}) {
  const { data: probes, isLoading } = useQuery({
    queryKey: ['monitoring-probes', monitoringId],
    queryFn: () => monitoringsApi.getProbes(monitoringId),
  });

  if (isLoading) return <><Header title="Точки" onBack={onBack} /><Spinner /></>;
  if (!probes?.length) return <><Header title="Точки" onBack={onBack} /><EmptyState text="Нет точек наблюдения" /></>;

  const pointMap = new Map<string, typeof probes>();
  for (const p of probes) {
    const arr = pointMap.get(p.name) || [];
    arr.push(p);
    pointMap.set(p.name, arr);
  }

  return (
    <>
      <Header title="Точки наблюдения" onBack={onBack} />
      <div className="p-4 space-y-2">
        {[...pointMap.entries()].map(([name, pointProbes]) => {
          const allCollected = pointProbes.every((p) => p.status === 'COLLECTED');
          const anyCollected = pointProbes.some((p) => p.status === 'COLLECTED');
          const types = pointProbes.map((p) => p.type === 'WATER' ? 'Вода' : 'ДО').join(' + ');
          const totalPhotos = pointProbes.reduce((s, p) => s + (p._count?.photos ?? 0), 0);
          return (
            <ListItem
              key={name}
              icon={allCollected
                ? <CheckCircle className="w-5 h-5" />
                : <MapPin className="w-5 h-5" />
              }
              title={name}
              subtitle={`${types}${totalPhotos > 0 ? ` • ${totalPhotos} фото` : ''}${anyCollected && !allCollected ? ' • частично отобрана' : ''}`}
              statusColor={allCollected
                ? 'bg-emerald-500/20 text-emerald-400'
                : anyCollected
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-cyan-500/20 text-cyan-400'
              }
              onClick={() => onSelect(name)}
            />
          );
        })}
      </div>
    </>
  );
}

function MonitoringPointScreen({
  monitoringId,
  pointName,
  onBack,
}: {
  monitoringId: string;
  pointName: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const exifInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [manualMode, setManualMode] = useState<'lat' | 'lon' | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [exifLoading, setExifLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [showDescPicker, setShowDescPicker] = useState<string | null>(null);
  const [showFieldPicker, setShowFieldPicker] = useState<{ probeId: string; field: string } | null>(null);
  const [fieldInputValue, setFieldInputValue] = useState('');
  const [viewPhoto, setViewPhoto] = useState<MonitoringPhoto | null>(null);
  const [describeOverlay, setDescribeOverlay] = useState<{ photos: MonitoringPhoto[]; ids: string[] } | null>(null);

  const { data: probes } = useQuery({
    queryKey: ['monitoring-probes', monitoringId],
    queryFn: () => monitoringsApi.getProbes(monitoringId),
  });
  const pointProbes = (probes ?? []).filter((p) => p.name === pointName);
  const primaryProbe = pointProbes[0];
  const uploadProbeId = primaryProbe?.id;

  const { data: photos } = useQuery({
    queryKey: ['monitoring-point-photos', monitoringId, pointName],
    queryFn: () => monitoringsApi.getPointPhotos(monitoringId, pointName),
    enabled: !!pointName,
  });

  const coordsMutation = useMutation({
    mutationFn: async (data: { latitude?: string; longitude?: string }) => {
      await Promise.all(pointProbes.map((p) => monitoringsApi.updateProbe(monitoringId, p.id, data)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-probes', monitoringId] });
      setManualMode(null);
      setManualValue('');
    },
  });

  const collectMutation = useMutation({
    mutationFn: (probeId: string) => monitoringsApi.collectProbe(monitoringId, probeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-probes', monitoringId] });
      showToastMsg('Проба отмечена как отобранная');
    },
  });

  const descMutation = useMutation({
    mutationFn: ({ probeId, description }: { probeId: string; description: string }) =>
      monitoringsApi.updateProbe(monitoringId, probeId, { description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-probes', monitoringId] });
      setShowDescPicker(null);
      showToastMsg('Характеристика сохранена');
    },
  });

  const fieldMutation = useMutation({
    mutationFn: ({ probeId, data }: { probeId: string; data: Record<string, any> }) =>
      monitoringsApi.updateProbe(monitoringId, probeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-probes', monitoringId] });
      setShowFieldPicker(null);
      setFieldInputValue('');
      showToastMsg('Сохранено');
    },
  });

  const showToastMsg = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const latitude = primaryProbe?.latitude || '—';
  const longitude = primaryProbe?.longitude || '—';
  const hasCoords = !!primaryProbe?.latitude && !!primaryProbe?.longitude;
  const mapsUrl = hasCoords ? getYandexMapsUrl(primaryProbe!.latitude!, primaryProbe!.longitude!) : null;

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      showToastMsg('Геолокация не поддерживается браузером');
      return;
    }
    setGeoLoading(true);

    const requestPosition = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = formatCoordinate(pos.coords.latitude);
          const lon = formatCoordinate(pos.coords.longitude);
          coordsMutation.mutate(
            { latitude: lat, longitude: lon },
            {
              onSuccess: () => {
                showToastMsg(`Координаты сохранены (±${Math.round(pos.coords.accuracy)}м)`);
                setGeoLoading(false);
              },
              onError: () => {
                showToastMsg('Ошибка сохранения координат');
                setGeoLoading(false);
              },
            },
          );
        },
        (err) => {
          if (highAccuracy && err.code === 2) {
            requestPosition(false);
            return;
          }
          const messages: Record<number, string> = {
            1: 'Доступ запрещён. Проверьте: Настройки → Конфиденциальность → Службы геолокации → Safari',
            2: 'Не удалось определить местоположение',
            3: 'Таймаут — попробуйте выйти на открытое место',
          };
          showToastMsg(messages[err.code] || `Ошибка: ${err.message}`);
          setGeoLoading(false);
        },
        { enableHighAccuracy: highAccuracy, timeout: 30000, maximumAge: 0 },
      );
    };

    requestPosition(true);
  };

  const handleExifPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExifLoading(true);
    try {
      const gps = await exifr.gps(file);
      if (!gps?.latitude || !gps?.longitude) {
        showToastMsg('GPS-данные не найдены в фото');
        setExifLoading(false);
        return;
      }
      const lat = formatCoordinate(gps.latitude);
      const lon = formatCoordinate(gps.longitude);
      await coordsMutation.mutateAsync({ latitude: lat, longitude: lon });
      showToastMsg('Координаты из EXIF сохранены');
    } catch {
      showToastMsg('Ошибка чтения EXIF');
    }
    setExifLoading(false);
    if (exifInputRef.current) exifInputRef.current.value = '';
  };

  const handleManualSave = () => {
    if (!manualValue.trim()) return;
    if (manualMode === 'lat') {
      coordsMutation.mutate({ latitude: manualValue.trim() });
      showToastMsg('Широта сохранена');
    } else if (manualMode === 'lon') {
      coordsMutation.mutate({ longitude: manualValue.trim() });
      showToastMsg('Долгота сохранена');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !uploadProbeId) return;
    setIsUploadingPhotos(true);
    try {
      const results = await monitoringsApi.uploadPhotos(monitoringId, uploadProbeId, Array.from(files));
      queryClient.invalidateQueries({ queryKey: ['monitoring-point-photos', monitoringId, pointName] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-probes', monitoringId] });
      const uploaded = results.filter((r) => r.success && r.photo);
      const ids = uploaded.map((r) => r.photo!.id);
      showToastMsg(`${ids.length} фото загружено`);
      if (ids.length > 0) {
        const freshPhotos = await monitoringsApi.getPointPhotos(monitoringId, pointName);
        setDescribeOverlay({ photos: freshPhotos, ids });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToastMsg(`Ошибка загрузки: ${msg}`);
    }
    setIsUploadingPhotos(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  if (describeOverlay) {
    return (
      <MonitoringVoiceDescribeOverlay
        monitoringId={monitoringId}
        photos={describeOverlay.photos}
        photoIds={describeOverlay.ids}
        onClose={() => {
          setDescribeOverlay(null);
          queryClient.invalidateQueries({ queryKey: ['monitoring-point-photos', monitoringId, pointName] });
        }}
      />
    );
  }

  if (!primaryProbe) return <><Header title="Точка" onBack={onBack} /><Spinner /></>;

  return (
    <>
      <Header title={pointName} onBack={onBack} />
      <div className="p-4 space-y-4">
        {toast && (
          <div className="fixed top-16 left-4 right-4 z-50 p-3 rounded-xl bg-emerald-600/90 text-white text-center text-sm font-medium animate-fade-in max-w-lg mx-auto">
            {toast}
          </div>
        )}

        {pointProbes.map((probe) => {
          const isCollected = probe.status === 'COLLECTED';
          const typeLabel = probe.type === 'WATER' ? 'Вода' : 'Донные отложения';
          const descriptions = probe.type === 'WATER' ? WATER_DESCRIPTIONS : SEDIMENT_DESCRIPTIONS;
          const isWater = probe.type === 'WATER';
          const isSediment = probe.type === 'SEDIMENT';
          const fp = showFieldPicker;
          const isThisProbe = (field: string) => fp?.probeId === probe.id && fp?.field === field;

          return (
            <div key={probe.id} className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{typeLabel}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isCollected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="text-xs">{isCollected ? 'Отобрана' : 'Ожидает'}</span>
                </div>
              </div>

              {isWater && (
                <>
                  <FieldBtn label="Объём/тара" value={probe.containerVolume} onClick={() => setShowFieldPicker({ probeId: probe.id, field: 'containerVolume' })} />
                  {isThisProbe('containerVolume') && (
                    <PickerList options={WATER_VOLUME_OPTIONS} current={probe.containerVolume} onSelect={(v) => fieldMutation.mutate({ probeId: probe.id, data: { containerVolume: v } })} onClose={() => setShowFieldPicker(null)} />
                  )}
                  <FieldBtn label="Кол-во ёмкостей" value={probe.containerCount ? String(probe.containerCount) : undefined} onClick={() => setShowFieldPicker({ probeId: probe.id, field: 'containerCount' })} />
                  {isThisProbe('containerCount') && (
                    <PickerList options={WATER_CONTAINER_COUNT_OPTIONS} current={probe.containerCount ? String(probe.containerCount) : undefined} onSelect={(v) => fieldMutation.mutate({ probeId: probe.id, data: { containerCount: parseInt(v) } })} onClose={() => setShowFieldPicker(null)} />
                  )}
                  <FieldBtn label="Глубина, м" value={probe.depth} onClick={() => { setShowFieldPicker({ probeId: probe.id, field: 'depth' }); setFieldInputValue(probe.depth || ''); }} />
                  {isThisProbe('depth') && (
                    <FieldInput value={fieldInputValue} onChange={setFieldInputValue} placeholder="0.3" onSave={() => fieldMutation.mutate({ probeId: probe.id, data: { depth: fieldInputValue } })} onClose={() => setShowFieldPicker(null)} />
                  )}
                  <FieldBtn label="Температура, °С" value={probe.temperature} onClick={() => { setShowFieldPicker({ probeId: probe.id, field: 'temperature' }); setFieldInputValue(probe.temperature || ''); }} />
                  {isThisProbe('temperature') && (
                    <FieldInput value={fieldInputValue} onChange={setFieldInputValue} placeholder="15" onSave={() => fieldMutation.mutate({ probeId: probe.id, data: { temperature: fieldInputValue } })} onClose={() => setShowFieldPicker(null)} />
                  )}
                </>
              )}

              {isSediment && (
                <>
                  <FieldBtn label="Масса/тара" value={probe.mass} onClick={() => setShowFieldPicker({ probeId: probe.id, field: 'mass' })} />
                  {isThisProbe('mass') && (
                    <PickerList options={SEDIMENT_MASS_OPTIONS} current={probe.mass} onSelect={(v) => fieldMutation.mutate({ probeId: probe.id, data: { mass: v } })} onClose={() => setShowFieldPicker(null)} />
                  )}
                  <FieldBtn label="Глубина, м" value={probe.depth} onClick={() => { setShowFieldPicker({ probeId: probe.id, field: 'depth' }); setFieldInputValue(probe.depth || ''); }} />
                  {isThisProbe('depth') && (
                    <FieldInput value={fieldInputValue} onChange={setFieldInputValue} placeholder="0.1" onSave={() => fieldMutation.mutate({ probeId: probe.id, data: { depth: fieldInputValue } })} onClose={() => setShowFieldPicker(null)} />
                  )}
                  <FieldBtn label="Примечание" value={probe.note} onClick={() => { setShowFieldPicker({ probeId: probe.id, field: 'note' }); setFieldInputValue(probe.note || ''); }} />
                  {isThisProbe('note') && (
                    <FieldInput value={fieldInputValue} onChange={setFieldInputValue} placeholder="участок 1" onSave={() => fieldMutation.mutate({ probeId: probe.id, data: { note: fieldInputValue } })} onClose={() => setShowFieldPicker(null)} />
                  )}
                </>
              )}

              <InfoRow label="Характеристика" value={probe.description || '—'} />
              <div className="flex gap-2">
                {!isCollected && (
                  <button
                    onClick={() => collectMutation.mutate(probe.id)}
                    className="flex-1 py-2 rounded-lg bg-emerald-600/90 text-white text-sm font-medium"
                  >
                    Отобрать
                  </button>
                )}
                <button
                  onClick={() => setShowDescPicker(probe.id)}
                  className="flex-1 py-2 rounded-lg bg-[var(--bg-tertiary)] text-sm font-medium border border-[var(--border-color)]"
                >
                  Характеристика
                </button>
              </div>
              {showDescPicker === probe.id && (
                <div className="space-y-1 pt-2 border-t border-[var(--border-color)]">
                  {descriptions.map((d) => (
                    <button
                      key={d}
                      onClick={() => descMutation.mutate({ probeId: probe.id, description: d })}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                        probe.description === d
                          ? 'bg-primary-500/20 text-primary-400 font-medium'
                          : 'hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

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
            onClick={() => exifInputRef.current?.click()}
            loading={exifLoading}
          />
          <input
            ref={exifInputRef}
            type="file"
            accept="image/*"
            className="absolute w-0 h-0 opacity-0 overflow-hidden"
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

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold px-1">
            Фото точки ({photos?.length ?? 0})
          </div>
          <ActionButton
            icon={<Camera className="w-5 h-5" />}
            label="Загрузить фото"
            onClick={() => photoInputRef.current?.click()}
            loading={isUploadingPhotos}
            variant="primary"
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="absolute w-0 h-0 opacity-0 overflow-hidden"
            onChange={handlePhotoUpload}
          />
          {photos && photos.filter((p) => !p.description).length > 0 && (
            <ActionButton
              icon={<Mic className="w-5 h-5" />}
              label={`Описать голосом (${photos.filter((p) => !p.description).length} без описания)`}
              onClick={() => {
                const undescribed = photos.filter((p) => !p.description);
                setDescribeOverlay({ photos, ids: undescribed.map((p) => p.id) });
              }}
            />
          )}
          {photos && photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => {
                const thumbnailUrl = `${monitoringsApi.getPhotoThumbnailUrl(monitoringId, photo.id)}`;
                return (
                  <div key={photo.id} className="relative">
                    <button
                      onClick={() => setViewPhoto(photo)}
                      className="w-full aspect-square rounded-lg overflow-hidden bg-[var(--bg-tertiary)]"
                    >
                      <AuthImage
                        src={thumbnailUrl}
                        alt={photo.description || ''}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    {!photo.description && (
                      <div className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-amber-500/80 flex items-center justify-center">
                        <Mic className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between p-3">
            <button onClick={() => setViewPhoto(null)} className="p-2 text-white">
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={() => {
                const id = viewPhoto.id;
                setViewPhoto(null);
                setDescribeOverlay({ photos: photos || [], ids: [id] });
              }}
              className="p-2 text-white"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-2 min-h-0">
            <AuthImage
              src={`${monitoringsApi.getPhotoOriginalUrl(monitoringId, viewPhoto.id)}`}
              alt={viewPhoto.description || ''}
              className="max-w-full max-h-[calc(100vh-10rem)] object-contain rounded-lg"
            />
          </div>
          <div className="shrink-0 px-4 pb-4 pt-1 space-y-1">
            {viewPhoto.description && (
              <p className="text-white/80 text-sm">{viewPhoto.description}</p>
            )}
            {viewPhoto.latitude && viewPhoto.longitude && (
              <div className="flex items-center gap-1.5 text-white/60 text-xs">
                <MapPin className="w-3 h-3" />
                <span>{viewPhoto.latitude}, {viewPhoto.longitude}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ===================== ГЛАВНЫЙ КОМПОНЕНТ =====================

// ===================== ГТС ЭКРАНЫ =====================

function GtsMonitoringListScreen({ onSelect, onBack }: { onSelect: (id: string) => void; onBack: () => void }) {
  const navigate = useNavigate();
  const { data: monitorings, isLoading } = useQuery({
    queryKey: ['gts-monitorings'],
    queryFn: gtsMonitoringsApi.getAll,
  });

  return (
    <>
      <Header
        title="Мониторинг ГТС"
        onBack={onBack}
        rightAction={<button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]"><Home className="w-5 h-5 text-[var(--text-secondary)]" /></button>}
      />
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
        ) : !monitorings?.length ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">Нет мониторингов ГТС</div>
        ) : monitorings.map((m) => (
          <button key={m.id} onClick={() => onSelect(m.id)} className="w-full p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] text-left">
            <div className="font-semibold">{m.name}</div>
            <div className="text-sm text-[var(--text-secondary)] mt-1">{m.year} · {m._count?.districts || 0} районов · {m._count?.objects || 0} ГТС</div>
          </button>
        ))}
      </div>
    </>
  );
}

function GtsMonitoringDistrictsScreen({ gtsMonitoringId, onSelect, onBack }: { gtsMonitoringId: string; onSelect: (districtId: string) => void; onBack: () => void }) {
  const { data: monitoring } = useQuery({ queryKey: ['gts-monitorings', gtsMonitoringId], queryFn: () => gtsMonitoringsApi.getById(gtsMonitoringId) });
  const { data: districts, isLoading } = useQuery({ queryKey: ['gts-monitorings', gtsMonitoringId, 'districts'], queryFn: () => gtsMonitoringsApi.getDistricts(gtsMonitoringId) });

  return (
    <>
      <Header title={monitoring?.name || 'Районы'} onBack={onBack} />
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
        ) : !districts?.length ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">Нет районов</div>
        ) : districts.map((d) => (
          <button key={d.id} onClick={() => onSelect(d.id)} className="w-full p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] text-left flex items-center justify-between">
            <div>
              <div className="font-semibold">{d.name}</div>
              <div className="text-sm text-[var(--text-secondary)] mt-0.5">{d._count?.objects || 0} ГТС</div>
            </div>
            <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        ))}
      </div>
    </>
  );
}

function GtsDistrictObjectsScreen({ gtsMonitoringId, districtId, onSelect, onBack }: { gtsMonitoringId: string; districtId: string; onSelect: (objectId: string) => void; onBack: () => void }) {
  const { data: objects, isLoading } = useQuery({ queryKey: ['gts-monitorings', gtsMonitoringId, 'objects', districtId], queryFn: () => gtsMonitoringsApi.getObjects(gtsMonitoringId, districtId) });

  return (
    <>
      <Header title="Объекты ГТС" onBack={onBack} />
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
        ) : !objects?.length ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">Нет объектов</div>
        ) : objects.map((obj) => (
          <button key={obj.id} onClick={() => onSelect(obj.id)} className="w-full p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] text-left">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-primary-500/10 flex items-center justify-center text-xs font-bold text-primary-400 shrink-0">#{obj.number}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{obj.watercourseName} — {obj.settlement}</div>
                <div className="text-sm text-[var(--text-secondary)] mt-0.5">{obj._count?.photos || 0} фото · {obj._count?.elements || 0} элементов</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function GtsObjectFieldScreen({ gtsMonitoringId, objectId, onBack }: { gtsMonitoringId: string; objectId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data: object } = useQuery({ queryKey: ['gts-object', objectId], queryFn: () => gtsMonitoringsApi.getObject(gtsMonitoringId, objectId) });

  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['gts-object', objectId] }); };

  const updateElementMut = useMutation({
    mutationFn: ({ elementId, data }: { elementId: string; data: Record<string, any> }) =>
      gtsMonitoringsApi.proposeElementEdit(gtsMonitoringId, objectId, elementId, data),
  });
  const updateObjMut = useMutation({ mutationFn: (data: Record<string, any>) => gtsMonitoringsApi.updateObject(gtsMonitoringId, objectId, data), onSuccess: invalidate });

  if (!object) return (<><Header title="..." onBack={onBack} /><div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div></>);

  return (
    <>
      <Header title={`#${object.number} ${object.settlement}`} onBack={onBack} />
      <div className="p-4 space-y-4 pb-24">
        {/* Основные данные */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] space-y-3">
          <div className="text-sm"><span className="text-[var(--text-secondary)]">Водоток:</span> {object.watercourseName}</div>
          <div className="text-sm"><span className="text-[var(--text-secondary)]">Нас. пункт:</span> {object.settlement}</div>
          {object.ownerName && <div className="text-sm"><span className="text-[var(--text-secondary)]">Собственник:</span> {object.ownerName}</div>}
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Дата обследования</label>
            <input type="date" value={object.inspectionDate ? object.inspectionDate.slice(0, 10) : ''} onChange={(e) => updateObjMut.mutate({ inspectionDate: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)]" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">ФИО обследователя</label>
            <input type="text" value={object.inspectorName || ''} onBlur={(e) => updateObjMut.mutate({ inspectorName: e.target.value })} onChange={() => {}} className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)]" placeholder="Макеева М.С." />
          </div>
        </div>

        <GtsLegacyMediaFieldBlock gtsMonitoringId={gtsMonitoringId} objectId={objectId} />

        {/* Элементы */}
        <div>
          <h3 className="font-semibold mb-2">Элементы ГТС</h3>
          <div className="space-y-3">
            {(object.elements || []).map((el) => (
              <div key={el.id} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                <div className="font-medium text-sm mb-2">{el.name}</div>
                <div className="space-y-2">
                  <GtsVoiceTextarea
                    label="Характеристика"
                    initialValue={el.proposedCharacteristics ?? el.characteristics ?? ''}
                    placeholder="Описание конструкции..."
                    onSave={(value) => updateElementMut.mutate({ elementId: el.id, data: { characteristics: value } })}
                  />
                  <GtsVoiceTextarea
                    label="Дефекты"
                    initialValue={el.proposedDefects ?? el.defects ?? ''}
                    placeholder="Выявленные дефекты..."
                    onSave={(value) => updateElementMut.mutate({ elementId: el.id, data: { defects: value } })}
                  />
                  <GtsVoiceTextarea
                    label="Рекомендации"
                    initialValue={el.proposedRecommendations ?? el.recommendations ?? ''}
                    placeholder="Рекомендации..."
                    onSave={(value) => updateElementMut.mutate({ elementId: el.id, data: { recommendations: value } })}
                  />
                  <div className="text-[11px] text-amber-300/90">
                    Изменения сохраняются как предложенные и применяются после подтверждения в админке.
                  </div>
                </div>

                <GtsElementFieldPhotos
                  gtsMonitoringId={gtsMonitoringId}
                  objectId={objectId}
                  elementId={el.id}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function GtsLegacyMediaFieldBlock({
  gtsMonitoringId,
  objectId,
}: {
  gtsMonitoringId: string;
  objectId: string;
}) {
  const [showGallery, setShowGallery] = useState(false);
  const [viewingImage, setViewingImage] = useState<GtsLegacyMedia | null>(null);

  const { data: media } = useQuery({
    queryKey: ['gts-legacy-media', objectId],
    queryFn: () => gtsMonitoringsApi.getLegacyMedia(gtsMonitoringId, objectId),
  });

  const isImage = (item: GtsLegacyMedia) => item.mimeType.startsWith('image/');

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowGallery(true)}
          disabled={!media?.length}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs font-medium disabled:opacity-50"
        >
          Просмотреть
        </button>
      </div>
      <div className="mt-2 text-xs text-[var(--text-secondary)]">
        Загружено файлов: {media?.length || 0}
      </div>

      {showGallery && createPortal(
        <div className="fixed inset-0 z-[80] bg-black/80 p-4 overflow-y-auto" onClick={() => setShowGallery(false)}>
          <div
            className="max-w-5xl mx-auto bg-[var(--bg-secondary)] rounded-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Галерея прошлых материалов</h3>
              <button type="button" className="p-2 rounded hover:bg-[var(--bg-tertiary)]" onClick={() => setShowGallery(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {!media?.length ? (
              <div className="text-sm text-[var(--text-secondary)] py-6 text-center">Файлы не загружены</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {media.map((item) => (
                  <div key={item.id} className="border border-[var(--border-color)] rounded-lg overflow-hidden">
                    {isImage(item) ? (
                      <button type="button" className="w-full" onClick={() => setViewingImage(item)}>
                        <AuthImage
                          src={gtsMonitoringsApi.getLegacyMediaOriginalUrl(gtsMonitoringId, item.id)}
                          alt={item.originalName}
                          className="w-full aspect-square object-cover"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="w-full aspect-square flex flex-col items-center justify-center bg-[var(--bg-tertiary)]"
                        onClick={() => gtsMonitoringsApi.openLegacyMedia(gtsMonitoringId, item.id, item.originalName)}
                      >
                        <FileText className="w-8 h-8 text-red-400" />
                        <span className="text-xs mt-2 text-[var(--text-secondary)]">PDF</span>
                      </button>
                    )}
                    <div className="p-2 text-[11px] text-[var(--text-secondary)] truncate">{item.originalName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {viewingImage && (
        <FieldworkZoomableImageModal
          src={gtsMonitoringsApi.getLegacyMediaOriginalUrl(gtsMonitoringId, viewingImage.id)}
          alt={viewingImage.originalName}
          onClose={() => setViewingImage(null)}
        />
      )}
    </div>
  );
}

function FieldworkZoomableImageModal({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const clampScale = (next: number) => Math.max(1, Math.min(5, Number(next.toFixed(2))));

  const zoomAtPoint = (nextScaleRaw: number, clientX: number, clientY: number) => {
    setScale((prevScale) => {
      const nextScale = clampScale(nextScaleRaw);
      if (nextScale === prevScale) return prevScale;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return nextScale;
      const cx = clientX - (rect.left + rect.width / 2);
      const cy = clientY - (rect.top + rect.height / 2);
      setTranslate((prevTranslate) => {
        if (nextScale === 1) return { x: 0, y: 0 };
        return {
          x: cx - ((cx - prevTranslate.x) / prevScale) * nextScale,
          y: cy - ((cy - prevTranslate.y) / prevScale) * nextScale,
        };
      });
      return nextScale;
    });
  };

  const centerZoom = (delta: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    zoomAtPoint(scale + delta, x, y);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    zoomAtPoint(scale + delta, e.clientX, e.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    setDragging(true);
    dragStartRef.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging || scale <= 1) return;
    setTranslate({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
  };
  const handleMouseUp = () => setDragging(false);

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-black/95" onClick={onClose}>
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-black/45 backdrop-blur rounded-full px-2 py-1 border border-white/15">
          <button type="button" onClick={() => centerZoom(-0.25)} disabled={scale <= 1} className="px-2 py-1 rounded bg-white/10 text-white disabled:opacity-40">-</button>
          <button type="button" className="px-2 py-1 text-xs text-white/90 hover:text-white" onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }}>
            {Math.round(scale * 100)}%
          </button>
          <button type="button" onClick={() => centerZoom(0.25)} className="px-2 py-1 rounded bg-white/10 text-white">+</button>
          <button type="button" className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 120ms ease',
            cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
          }}
        >
          <AuthImage src={src} alt={alt} className="max-w-full max-h-[90vh] object-contain select-none" />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GtsVoiceTextarea({
  label,
  initialValue,
  placeholder,
  onSave,
}: {
  label: string;
  initialValue: string;
  placeholder: string;
  onSave: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialValue);
  const [value, setValue] = useState(initialValue);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    setValue(initialValue);
    lastSavedRef.current = initialValue;
  }, [initialValue]);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 100);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 100 ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  const commitSave = useCallback((nextValue: string, force = false) => {
    if (!force && nextValue === lastSavedRef.current) return;
    lastSavedRef.current = nextValue;
    onSave(nextValue);
  }, [onSave]);

  const scheduleSave = useCallback((nextValue: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      commitSave(nextValue);
      saveTimeoutRef.current = null;
    }, 500);
  }, [commitSave]);

  const handleBlur = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    commitSave(value);
  };

  const toggleRecording = () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      window.alert('Голосовой ввод не поддерживается в этом браузере');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!transcript) return;
      setValue(transcript);
      scheduleSave(transcript);
    };
    recognition.onerror = () => {
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs text-[var(--text-secondary)]">{label}</label>
        <button
          type="button"
          onClick={toggleRecording}
          className={`p-1.5 rounded-md ${isRecording ? 'bg-red-500/20 text-red-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}
          title={isRecording ? 'Остановить запись' : 'Голосовой ввод'}
        >
          {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          const nextValue = e.target.value;
          setValue(nextValue);
          scheduleSave(nextValue);
        }}
        onBlur={handleBlur}
        rows={1}
        className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] resize-none"
        placeholder={placeholder}
      />
    </div>
  );
}

function GtsElementFieldPhotos({
  gtsMonitoringId,
  objectId,
  elementId,
}: {
  gtsMonitoringId: string;
  objectId: string;
  elementId: string;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingPhoto, setViewingPhoto] = useState<GtsElementPhoto | null>(null);
  const { data: photos } = useQuery({
    queryKey: ['gts-element-photos', elementId],
    queryFn: () => gtsMonitoringsApi.getElementPhotos(gtsMonitoringId, objectId, elementId),
  });

  const uploadMut = useMutation({
    mutationFn: (files: File[]) => gtsMonitoringsApi.uploadElementPhotos(gtsMonitoringId, objectId, elementId, files),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gts-element-photos', elementId] }),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if ((photos?.length || 0) + files.length > 4) {
      window.alert('Для одного элемента можно загрузить максимум 4 фото');
      return;
    }
    uploadMut.mutate(files);
  };

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium">Фото элемента ({photos?.length || 0}/4)</h4>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={(photos?.length || 0) >= 4 || uploadMut.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium disabled:opacity-50"
        >
          <Camera className="w-3.5 h-3.5" /> Добавить
        </button>
      </div>

      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p) => (
            <button
              type="button"
              key={p.id}
              className="aspect-square rounded-lg overflow-hidden bg-[var(--bg-tertiary)]"
              onClick={() => setViewingPhoto(p)}
            >
              <AuthImage src={gtsMonitoringsApi.getPhotoThumbnailUrl(gtsMonitoringId, p.id)} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-[var(--text-secondary)]">Фото пока не загружены</div>
      )}

      {viewingPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setViewingPhoto(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <AuthImage
              src={gtsMonitoringsApi.getPhotoOriginalUrl(gtsMonitoringId, viewingPhoto.id)}
              alt={viewingPhoto.description || ''}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function FieldworkPage() {
  const navigate = useNavigate();
  const [nav, setNav] = useState<NavState>(loadNav);

  useEffect(() => {
    saveNav(nav);
  }, [nav]);

  const go = useCallback((newNav: NavState) => setNav(newNav), []);

  const renderScreen = () => {
    switch (nav.view) {
      case 'mode-select':
        return (
          <ModeSelectScreen
            onObjects={() => go({ view: 'projects' })}
            onMonitorings={() => go({ view: 'monitoring-list' })}
            onGts={() => go({ view: 'gts-monitoring-list' })}
          />
        );

      case 'projects':
        return (
          <>
            <Header
              title="Объекты"
              onBack={() => go({ view: 'mode-select' })}
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

      case 'monitoring-list':
        return (
          <MonitoringListScreen
            onSelect={(id) => go({ view: 'monitoring', monitoringId: id })}
            onBack={() => go({ view: 'mode-select' })}
          />
        );

      case 'monitoring':
        return (
          <MonitoringScreen
            monitoringId={nav.monitoringId}
            onProbes={() => go({ view: 'monitoring-points', monitoringId: nav.monitoringId })}
            onBack={() => go({ view: 'monitoring-list' })}
          />
        );

      case 'monitoring-points':
        return (
          <MonitoringPointsScreen
            monitoringId={nav.monitoringId}
            onSelect={(pointName) => go({ view: 'monitoring-point', monitoringId: nav.monitoringId, pointName })}
            onBack={() => go({ view: 'monitoring', monitoringId: nav.monitoringId })}
          />
        );

      case 'monitoring-point':
        return (
          <MonitoringPointScreen
            monitoringId={nav.monitoringId}
            pointName={nav.pointName}
            onBack={() => go({ view: 'monitoring-points', monitoringId: nav.monitoringId })}
          />
        );

      case 'gts-monitoring-list':
        return (
          <GtsMonitoringListScreen
            onSelect={(id) => go({ view: 'gts-monitoring', gtsMonitoringId: id })}
            onBack={() => go({ view: 'mode-select' })}
          />
        );

      case 'gts-monitoring':
        return (
          <GtsMonitoringDistrictsScreen
            gtsMonitoringId={nav.gtsMonitoringId}
            onSelect={(districtId) => go({ view: 'gts-district', gtsMonitoringId: nav.gtsMonitoringId, districtId })}
            onBack={() => go({ view: 'gts-monitoring-list' })}
          />
        );

      case 'gts-district':
        return (
          <GtsDistrictObjectsScreen
            gtsMonitoringId={nav.gtsMonitoringId}
            districtId={nav.districtId}
            onSelect={(objectId) => go({ view: 'gts-object', gtsMonitoringId: nav.gtsMonitoringId, objectId })}
            onBack={() => go({ view: 'gts-monitoring', gtsMonitoringId: nav.gtsMonitoringId })}
          />
        );

      case 'gts-object':
        return (
          <GtsObjectFieldScreen
            gtsMonitoringId={nav.gtsMonitoringId}
            objectId={nav.objectId}
            onBack={() => go({ view: 'gts-monitoring', gtsMonitoringId: nav.gtsMonitoringId })}
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
