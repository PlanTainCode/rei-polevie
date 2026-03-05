import { useState, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  FolderDown,
  MapPin,
  Mic,
  MicOff,
  Pencil,
  Presentation,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { monitoringsApi, type MonitoringProbe, type MonitoringPhoto } from '@/api/monitorings';
import { Button, Input, Card, CardContent, AuthImage } from '@/components/ui';

interface ObservationPoint {
  name: string;
  probes: MonitoringProbe[];
  probeIds: string[];
  photoCount: number;
  firstPhoto: MonitoringPhoto | null;
}

function getYandexMapsUrl(lat: string | null, lon: string | null): string | null {
  if (!lat || !lon || lat === 'null' || lon === 'null') return null;
  return `https://yandex.ru/maps/?pt=${lon},${lat}&z=16&l=map`;
}

interface EditablePhotoFieldProps {
  value: string | null;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function EditablePhotoField({
  value,
  onSave,
  placeholder = '—',
  className = '',
}: EditablePhotoFieldProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? '');

  const handleBlur = useCallback(() => {
    setEditing(false);
    const trimmed = String(inputValue).trim();
    if (trimmed !== (value ?? '')) {
      onSave(trimmed || '');
    }
  }, [inputValue, value, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  if (editing) {
    return (
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`min-w-0 w-full px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-primary-500/50 text-[var(--text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 ${className}`}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => {
        setInputValue(value ?? '');
        setEditing(true);
      }}
      onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
      className={`cursor-pointer hover:bg-[var(--bg-tertiary)] rounded px-1 -mx-1 ${className}`}
    >
      {value?.trim() || placeholder}
    </span>
  );
}

interface PointCardProps {
  point: ObservationPoint;
  monitoringId: string;
  onSelect: () => void;
}

function PointCard({ point, monitoringId, onSelect }: PointCardProps) {
  const thumbnailUrl = point.firstPhoto
    ? monitoringsApi.getPhotoThumbnailUrl(monitoringId, point.firstPhoto.id)
    : null;

  const typeLabels = point.probes.map((p) =>
    p.type === 'WATER' ? 'Вода' : 'ДО',
  );
  const uniqueTypes = [...new Set(typeLabels)].join(' + ');

  return (
    <Card
      className="border-[var(--border-color)] cursor-pointer hover:border-primary-500/50 transition-colors"
      onClick={onSelect}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-20 h-20 rounded-lg bg-[var(--bg-tertiary)] overflow-hidden shrink-0">
          {thumbnailUrl ? (
            <AuthImage
              src={thumbnailUrl}
              alt={point.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-8 h-8 text-[var(--text-secondary)]" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold truncate">{point.name}</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-1">{uniqueTypes}</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {point.photoCount} фото
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface PhotoCardProps {
  photo: MonitoringPhoto;
  index: number;
  total: number;
  monitoringId: string;
  onUpdate: (photoId: string, data: { description?: string; photoDate?: string; latitude?: string; longitude?: string }) => void;
  onDelete: (photoId: string) => void;
  onReorder: (photo: MonitoringPhoto, direction: 'up' | 'down') => void;
  onVoiceDescribe: (photoId: string) => void;
  onView: (photo: MonitoringPhoto) => void;
  editingPhotoId: string | null;
  editData: { description: string; photoDate: string; latitude: string; longitude: string };
  setEditData: (d: { description: string; photoDate: string; latitude: string; longitude: string }) => void;
  onStartEditing: (photo: MonitoringPhoto) => void;
  saveEditing: () => void;
  cancelEditing: () => void;
  isRecording: boolean;
}

function PhotoCard({
  photo,
  index,
  total,
  monitoringId,
  onUpdate,
  onDelete,
  onReorder,
  onVoiceDescribe,
  onView,
  editingPhotoId,
  editData,
  setEditData,
  onStartEditing,
  saveEditing,
  cancelEditing,
  isRecording,
}: PhotoCardProps) {
  const thumbnailUrl = monitoringsApi.getPhotoThumbnailUrl(monitoringId, photo.id);
  const mapsUrl = getYandexMapsUrl(photo.latitude, photo.longitude);

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl overflow-hidden border border-[var(--border-color)]">
      <div
        className="relative aspect-[4/3] bg-[var(--bg-tertiary)] cursor-pointer overflow-hidden"
        onClick={() => onView(photo)}
      >
        <AuthImage
          src={thumbnailUrl}
          alt={photo.description || photo.originalName}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs">
          #{index + 1}
        </div>
        {photo.latitude && photo.longitude && (
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-green-500/90">
            <MapPin className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        {editingPhotoId === photo.id ? (
          <div className="space-y-2">
            <Input
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              placeholder="Описание"
              className="text-sm"
            />
            <input
              type="date"
              value={editData.photoDate}
              onChange={(e) => setEditData({ ...editData, photoDate: e.target.value })}
              className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)]"
            />
            <div className="flex gap-1">
              <Input
                value={editData.latitude}
                onChange={(e) => setEditData({ ...editData, latitude: e.target.value })}
                placeholder="Широта"
                className="text-sm flex-1"
              />
              <Input
                value={editData.longitude}
                onChange={(e) => setEditData({ ...editData, longitude: e.target.value })}
                placeholder="Долгота"
                className="text-sm flex-1"
              />
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={cancelEditing}>Отмена</Button>
              <Button size="sm" onClick={saveEditing}>Сохранить</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-[2rem]">
              <EditablePhotoField
                value={photo.description}
                onSave={(v) => onUpdate(photo.id, { description: v })}
                placeholder="Без описания"
                className="text-sm"
              />
            </div>
            {photo.photoDate && (
              <p className="text-xs text-[var(--text-secondary)]">
                {new Date(photo.photoDate).toLocaleDateString('ru')}
              </p>
            )}
            {photo.latitude && photo.longitude && (
              <a
                href={mapsUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" />
                {photo.latitude}, {photo.longitude}
              </a>
            )}
            <div className="flex items-center gap-1 pt-2 border-t border-[var(--border-color)]">
              <button
                className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
                onClick={(e) => { e.stopPropagation(); onReorder(photo, 'up'); }}
                disabled={index === 0}
                title="Вверх"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
                onClick={(e) => { e.stopPropagation(); onReorder(photo, 'down'); }}
                disabled={index === total - 1}
                title="Вниз"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]"
                onClick={(e) => { e.stopPropagation(); onStartEditing(photo); }}
                title="Редактировать"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                className={`p-1.5 rounded ${isRecording ? 'bg-red-500/20 text-red-400' : 'hover:bg-[var(--bg-tertiary)]'}`}
                onClick={(e) => { e.stopPropagation(); onVoiceDescribe(photo.id); }}
                title="Голосовое описание"
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <div className="flex-1" />
              <button
                className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                onClick={(e) => { e.stopPropagation(); if (window.confirm('Удалить?')) onDelete(photo.id); }}
                title="Удалить"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function MonitoringPhotosPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPointName, setSelectedPointName] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<MonitoringPhoto | null>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ description: '', photoDate: '', latitude: '', longitude: '' });
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [crewMembers, setCrewMembers] = useState('');
  const [recordingPhotoId, setRecordingPhotoId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const { data: monitoring, isLoading: loadingMonitoring } = useQuery({
    queryKey: ['monitorings', id],
    queryFn: () => monitoringsApi.getById(id!),
    enabled: !!id,
  });

  const { data: probes, isLoading: loadingProbes } = useQuery({
    queryKey: ['monitorings', id, 'probes'],
    queryFn: () => monitoringsApi.getProbes(id!),
    enabled: !!id,
  });

  const { data: allPhotos, isLoading: loadingAllPhotos } = useQuery({
    queryKey: ['monitorings', id, 'photos'],
    queryFn: () => monitoringsApi.getAllPhotos(id!),
    enabled: !!id && !selectedPointName,
  });

  const { data: pointPhotos, isLoading: loadingPointPhotos } = useQuery({
    queryKey: ['monitorings', id, 'points', selectedPointName, 'photos'],
    queryFn: () => monitoringsApi.getPointPhotos(id!, selectedPointName!),
    enabled: !!id && !!selectedPointName,
  });

  const observationPoints = useMemo<ObservationPoint[]>(() => {
    if (!probes) return [];
    const pointMap = new Map<string, MonitoringProbe[]>();
    for (const probe of probes) {
      const existing = pointMap.get(probe.name) || [];
      existing.push(probe);
      pointMap.set(probe.name, existing);
    }

    const photosByProbe = (allPhotos ?? []).reduce<Record<string, MonitoringPhoto[]>>((acc, p) => {
      (acc[p.probeId] ??= []).push(p);
      return acc;
    }, {});

    return [...pointMap.entries()].map(([name, pointProbes]) => {
      const probeIds = pointProbes.map((p) => p.id);
      let photoCount = 0;
      let firstPhoto: MonitoringPhoto | null = null;
      for (const pid of probeIds) {
        const photos = photosByProbe[pid] || [];
        photoCount += photos.length;
        if (!firstPhoto && photos.length > 0) firstPhoto = photos[0];
      }
      return { name, probes: pointProbes, probeIds, photoCount, firstPhoto };
    });
  }, [probes, allPhotos]);

  const selectedPoint = observationPoints.find((p) => p.name === selectedPointName);
  const uploadProbeId = selectedPoint?.probeIds[0];

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => monitoringsApi.uploadPhotos(id!, uploadProbeId!, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitorings', id, 'points', selectedPointName, 'photos'] });
      queryClient.invalidateQueries({ queryKey: ['monitorings', id, 'photos'] });
    },
  });

  const updatePhotoMutation = useMutation({
    mutationFn: ({ photoId, data }: { photoId: string; data: Parameters<typeof monitoringsApi.updatePhoto>[2] }) =>
      monitoringsApi.updatePhoto(id!, photoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitorings', id, 'points', selectedPointName, 'photos'] });
      queryClient.invalidateQueries({ queryKey: ['monitorings', id, 'photos'] });
      setEditingPhotoId(null);
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => monitoringsApi.deletePhoto(id!, photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitorings', id, 'points', selectedPointName, 'photos'] });
      queryClient.invalidateQueries({ queryKey: ['monitorings', id, 'photos'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orders: { id: string; sortOrder: number }[]) =>
      monitoringsApi.reorderPointPhotos(id!, selectedPointName!, orders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitorings', id, 'points', selectedPointName, 'photos'] });
      queryClient.invalidateQueries({ queryKey: ['monitorings', id, 'photos'] });
    },
  });

  const voiceDescribeMutation = useMutation({
    mutationFn: ({ photoId, blob }: { photoId: string; blob: Blob }) =>
      monitoringsApi.voiceDescribePhoto(id!, photoId, blob),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['monitorings', id, 'points', selectedPointName, 'photos'] });
      queryClient.invalidateQueries({ queryKey: ['monitorings', id, 'photos'] });
      if (data.photo.description) {
        setEditData((d) => ({ ...d, description: data.photo.description || '' }));
      }
    },
  });

  const handleDownloadAll = useCallback(async () => {
    if (!id) return;
    await monitoringsApi.downloadAllPhotos(id);
  }, [id]);

  const handleDownloadPoint = useCallback(async () => {
    if (!id || !selectedPointName) return;
    await monitoringsApi.downloadPointPhotos(id, selectedPointName);
  }, [id, selectedPointName]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) uploadMutation.mutate(files);
    e.target.value = '';
  }, [uploadMutation]);

  const handleGenerateAlbum = useCallback(async () => {
    if (!id || !selectedPointName) return;
    await monitoringsApi.generatePointAlbum(id, selectedPointName, crewMembers.trim() || undefined);
    setAlbumModalOpen(false);
    setCrewMembers('');
  }, [id, selectedPointName, crewMembers]);

  const startEditing = (photo: MonitoringPhoto) => {
    setEditingPhotoId(photo.id);
    setEditData({
      description: photo.description || '',
      photoDate: photo.photoDate ? photo.photoDate.slice(0, 10) : '',
      latitude: photo.latitude || '',
      longitude: photo.longitude || '',
    });
  };

  const saveEditing = () => {
    if (editingPhotoId) {
      updatePhotoMutation.mutate({
        photoId: editingPhotoId,
        data: {
          description: editData.description,
          photoDate: editData.photoDate || undefined,
          latitude: editData.latitude || undefined,
          longitude: editData.longitude || undefined,
        },
      });
    }
  };

  const cancelEditing = () => setEditingPhotoId(null);

  const movePhoto = (photo: MonitoringPhoto, direction: 'up' | 'down') => {
    const photos = pointPhotos ?? [];
    const idx = photos.findIndex((p) => p.id === photo.id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= photos.length) return;
    const reordered = [...photos];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    reorderMutation.mutate(reordered.map((p, i) => ({ id: p.id, sortOrder: i })));
  };

  const handleVoiceDescribe = useCallback(async (photoId: string) => {
    if (recordingPhotoId === photoId) {
      mediaRecorderRef.current?.stop();
      setRecordingPhotoId(null);
      return;
    }
    if (recordingPhotoId) {
      mediaRecorderRef.current?.stop();
      setRecordingPhotoId(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        voiceDescribeMutation.mutate({ photoId, blob });
        setRecordingPhotoId(null);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingPhotoId(photoId);
    } catch {
      setRecordingPhotoId(null);
    }
  }, [recordingPhotoId, voiceDescribeMutation]);

  const isLoading = loadingMonitoring || loadingProbes || (selectedPointName ? loadingPointPhotos : loadingAllPhotos);

  if (isLoading || !id) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!monitoring) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Мониторинг не найден</p>
        <Link to="/monitorings" className="text-primary-500 hover:text-primary-400 mt-2 inline-block">
          ← К списку мониторингов
        </Link>
      </div>
    );
  }

  if (selectedPointName && selectedPoint) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setSelectedPointName(null)}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{selectedPoint.name}</h1>
            <p className="text-[var(--text-secondary)] text-sm">Фотоматериалы точки наблюдения</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} isLoading={uploadMutation.isPending}>
            <Upload className="w-4 h-4" />
            Загрузить фото
          </Button>
          <Button variant="secondary" onClick={handleDownloadPoint}>
            <Download className="w-4 h-4" />
            Скачать ZIP
          </Button>
          <Button variant="secondary" onClick={() => setAlbumModalOpen(true)}>
            <Presentation className="w-4 h-4" />
            Генерировать альбом
          </Button>
        </div>

        {(!pointPhotos || pointPhotos.length === 0) ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center">
              <Camera className="w-16 h-16 mx-auto mb-4 text-[var(--text-secondary)]" />
              <p className="text-lg font-medium mb-2">Фото пока нет</p>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Загрузите фотографии для этой точки</p>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" />
                Загрузить фото
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pointPhotos.map((photo, idx) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                index={idx}
                total={pointPhotos.length}
                monitoringId={id}
                onUpdate={(photoId, data) => updatePhotoMutation.mutate({ photoId, data })}
                onDelete={(photoId) => deletePhotoMutation.mutate(photoId)}
                onReorder={movePhoto}
                onVoiceDescribe={handleVoiceDescribe}
                onView={setViewingPhoto}
                editingPhotoId={editingPhotoId}
                editData={editData}
                setEditData={setEditData}
                onStartEditing={startEditing}
                saveEditing={saveEditing}
                cancelEditing={cancelEditing}
                isRecording={recordingPhotoId === photo.id}
              />
            ))}
          </div>
        )}

        {viewingPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setViewingPhoto(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              onClick={() => setViewingPhoto(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
              <AuthImage
                src={monitoringsApi.getPhotoOriginalUrl(id, viewingPhoto.id)}
                alt={viewingPhoto.description || viewingPhoto.originalName}
                className="max-w-full max-h-[90vh] object-contain"
              />
            </div>
          </div>
        )}

        {albumModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setAlbumModalOpen(false)}
          >
            <Card className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Генерировать альбом</h3>
                <div className="mb-4">
                  <label className="block text-sm text-[var(--text-secondary)] mb-2">Состав ПБ</label>
                  <Input
                    value={crewMembers}
                    onChange={(e) => setCrewMembers(e.target.value)}
                    placeholder="Иванов И.И., Петров П.П."
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={() => setAlbumModalOpen(false)}>
                    Отмена
                  </Button>
                  <Button className="flex-1" onClick={handleGenerateAlbum}>
                    <Presentation className="w-4 h-4" />
                    Сгенерировать
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to={`/monitorings/${id}`}
          className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{monitoring.name}</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            Фотоматериалы по точкам наблюдения ({observationPoints.length})
          </p>
        </div>
        {(allPhotos?.length ?? 0) > 0 && (
          <Button variant="secondary" onClick={handleDownloadAll} className="ml-auto">
            <FolderDown className="w-4 h-4" />
            Скачать все
          </Button>
        )}
      </div>

      {observationPoints.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Camera className="w-16 h-16 mx-auto mb-4 text-[var(--text-secondary)]" />
            <h2 className="text-lg font-semibold mb-2">Точек наблюдения пока нет</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              Добавьте пробы в разделе «Пробы», после чего здесь появятся карточки точек наблюдения.
            </p>
            <Link to={`/monitorings/${id}/probes`}>
              <Button variant="secondary">Перейти к пробам</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {observationPoints.map((point) => (
            <PointCard
              key={point.name}
              point={point}
              monitoringId={id}
              onSelect={() => setSelectedPointName(point.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
