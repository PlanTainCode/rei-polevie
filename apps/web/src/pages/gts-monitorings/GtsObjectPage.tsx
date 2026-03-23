import { useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Camera, ChevronDown, ChevronUp,
  FileText, MapPin, Pencil, Presentation, Trash2, Upload, X,
} from 'lucide-react';
import {
  gtsMonitoringsApi,
  type GtsElement,
  type GtsPhoto,
} from '@/api/gts-monitorings';
import { Button, Input, Card, CardContent, AuthImage } from '@/components/ui';

export function GtsObjectPage() {
  const { id, objectId } = useParams<{ id: string; objectId: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ description: '', photoDate: '', latitude: '', longitude: '' });
  const [viewingPhoto, setViewingPhoto] = useState<GtsPhoto | null>(null);
  const [generatingDV, setGeneratingDV] = useState(false);
  const [generatingAlbum, setGeneratingAlbum] = useState(false);

  const { data: object, isLoading: loadingObject } = useQuery({
    queryKey: ['gts-object', objectId],
    queryFn: () => gtsMonitoringsApi.getObject(id!, objectId!),
    enabled: !!id && !!objectId,
  });

  const { data: photos, isLoading: loadingPhotos } = useQuery({
    queryKey: ['gts-object-photos', objectId],
    queryFn: () => gtsMonitoringsApi.getObjectPhotos(id!, objectId!),
    enabled: !!id && !!objectId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['gts-object', objectId] });
    queryClient.invalidateQueries({ queryKey: ['gts-object-photos', objectId] });
  };

  const updateObjectMutation = useMutation({
    mutationFn: (data: Record<string, any>) => gtsMonitoringsApi.updateObject(id!, objectId!, data),
    onSuccess: invalidate,
  });

  const updateElementMutation = useMutation({
    mutationFn: ({ elementId, data }: { elementId: string; data: Record<string, any> }) =>
      gtsMonitoringsApi.updateElement(id!, objectId!, elementId, data),
    onSuccess: invalidate,
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => gtsMonitoringsApi.uploadPhotos(id!, objectId!, files),
    onSuccess: invalidate,
  });

  const updatePhotoMutation = useMutation({
    mutationFn: ({ photoId, data }: { photoId: string; data: Record<string, any> }) =>
      gtsMonitoringsApi.updatePhoto(id!, photoId, data),
    onSuccess: () => { invalidate(); setEditingPhotoId(null); },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => gtsMonitoringsApi.deletePhoto(id!, photoId),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (orders: { id: string; sortOrder: number }[]) =>
      gtsMonitoringsApi.reorderPhotos(id!, objectId!, orders),
    onSuccess: invalidate,
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) uploadMutation.mutate(files);
    e.target.value = '';
  }, [uploadMutation]);

  const movePhoto = (photo: GtsPhoto, direction: 'up' | 'down') => {
    if (!photos) return;
    const idx = photos.findIndex((p) => p.id === photo.id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= photos.length) return;
    const reordered = [...photos];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    reorderMutation.mutate(reordered.map((p, i) => ({ id: p.id, sortOrder: i })));
  };

  const startEditing = (photo: GtsPhoto) => {
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

  const handleGenerateDV = async () => {
    if (!id || !objectId) return;
    setGeneratingDV(true);
    try { await gtsMonitoringsApi.generateObjectDefectStatement(id, objectId); }
    catch (err) { console.error(err); }
    finally { setGeneratingDV(false); }
  };

  const handleGenerateAlbum = async () => {
    if (!id || !objectId) return;
    setGeneratingAlbum(true);
    try { await gtsMonitoringsApi.generateObjectAlbum(id, objectId); }
    catch (err) { console.error(err); }
    finally { setGeneratingAlbum(false); }
  };

  if (loadingObject || !id || !objectId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!object) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Объект ГТС не найден</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Шапка */}
      <div className="flex items-center gap-4">
        <Link
          to={`/gts-monitorings/${id}`}
          className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            #{object.number} {object.watercourseName} — {object.settlement}
          </h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {object.district?.name}
            {object.latitude && object.longitude && ` · ${object.latitude}, ${object.longitude}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleGenerateDV} isLoading={generatingDV}>
            <FileText className="w-4 h-4" /> ДВ
          </Button>
          <Button variant="secondary" size="sm" onClick={handleGenerateAlbum} isLoading={generatingAlbum}>
            <Presentation className="w-4 h-4" /> Альбом
          </Button>
        </div>
      </div>

      {/* Данные объекта */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <InfoItem label="Водоток" value={object.watercourseName} />
            <InfoItem label="Нас. пункт" value={object.settlement} />
            <InfoItem label="Год ввода" value={object.yearBuilt ? String(object.yearBuilt) : '—'} />
            <InfoItem label="Объём, тыс.м³" value={object.volume || '—'} />
            <InfoItem label="Площадь, га" value={object.area || '—'} />
            <InfoItem label="Уровень безопасности" value={object.safetyLevel || '—'} />
            <InfoItem label="Собственник" value={object.ownerName || '—'} />
            <InfoItem
              label="Техническая документация"
              value={object.hasTechnicalDoc ? 'Есть' : 'Нет'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[var(--border-color)]">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Дата обследования</label>
              <input
                type="date"
                value={object.inspectionDate ? object.inspectionDate.slice(0, 10) : ''}
                onChange={(e) => updateObjectMutation.mutate({ inspectionDate: e.target.value })}
                className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">ФИО обследователя</label>
              <EditableField
                value={object.inspectorName}
                onSave={(v) => updateObjectMutation.mutate({ inspectorName: v })}
                placeholder="Макеева М.С."
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
            <label className="block text-xs text-[var(--text-secondary)] mb-1">Общее техническое состояние объекта</label>
            <EditableField
              value={object.overallCondition}
              onSave={(v) => updateObjectMutation.mutate({ overallCondition: v })}
              placeholder="нормальный уровень безопасности"
            />
          </div>
        </CardContent>
      </Card>

      {/* Элементы ГТС */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Элементы ГТС</h2>
        {object.elements && object.elements.length > 0 ? (
          <div className="space-y-3">
            {object.elements.map((el, idx) => (
              <ElementCard
                key={el.id}
                element={el}
                index={idx}
                onUpdate={(data) => updateElementMutation.mutate({ elementId: el.id, data })}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-[var(--text-secondary)]">
              Элементы ГТС не определены
            </CardContent>
          </Card>
        )}
      </div>

      {/* Фотоальбом */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Фотоматериалы ({photos?.length || 0})
          </h2>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button size="sm" onClick={() => fileInputRef.current?.click()} isLoading={uploadMutation.isPending}>
              <Upload className="w-4 h-4" />
              Загрузить фото
            </Button>
          </div>
        </div>

        {loadingPhotos ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : !photos || photos.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <Camera className="w-12 h-12 mx-auto mb-3 text-[var(--text-secondary)]" />
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Загрузите не менее 5 фотографий
              </p>
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" />
                Загрузить фото
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((photo, idx) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                index={idx}
                total={photos.length}
                monitoringId={id!}
                editingPhotoId={editingPhotoId}
                editData={editData}
                setEditData={setEditData}
                onStartEditing={startEditing}
                saveEditing={saveEditing}
                cancelEditing={() => setEditingPhotoId(null)}
                onDelete={(photoId) => { if (window.confirm('Удалить?')) deletePhotoMutation.mutate(photoId); }}
                onReorder={movePhoto}
                onView={setViewingPhoto}
              />
            ))}
          </div>
        )}
      </div>

      {/* Полноэкранный просмотр */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewingPhoto(null)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => setViewingPhoto(null)}>
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <AuthImage
              src={gtsMonitoringsApi.getPhotoOriginalUrl(id!, viewingPhoto.id)}
              alt={viewingPhoto.description || viewingPhoto.originalName}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  );
}

function EditableField({
  value,
  onSave,
  placeholder = '—',
}: {
  value: string | null;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? '');

  const handleBlur = () => {
    setEditing(false);
    const trimmed = inputValue.trim();
    if (trimmed !== (value ?? '')) onSave(trimmed);
  };

  if (editing) {
    return (
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        autoFocus
        className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg-tertiary)] border border-primary-500/50 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => { setInputValue(value ?? ''); setEditing(true); }}
      onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
      className="cursor-pointer hover:bg-[var(--bg-tertiary)] rounded px-2 py-1.5 block text-sm"
    >
      {value?.trim() || <span className="text-[var(--text-secondary)]">{placeholder}</span>}
    </span>
  );
}

function ElementCard({
  element,
  index,
  onUpdate,
}: {
  element: GtsElement;
  index: number;
  onUpdate: (data: Record<string, any>) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-7 h-7 rounded-full bg-primary-500/10 flex items-center justify-center text-xs font-bold text-primary-400">
            {index + 1}
          </span>
          <h3 className="font-semibold">{element.name}</h3>
        </div>
        <div className="grid gap-3 text-sm">
          <EditableTextArea
            label="Характеристика"
            value={element.characteristics}
            onSave={(v) => onUpdate({ characteristics: v })}
            placeholder="Описание конструкции..."
          />
          <EditableTextArea
            label="Техническое состояние, выявленные дефекты"
            value={[element.technicalCondition, element.defects].filter(Boolean).join('\n')}
            onSave={(v) => onUpdate({ technicalCondition: v, defects: '' })}
            placeholder="Техническое состояние..."
          />
          <EditableTextArea
            label="Рекомендации"
            value={element.recommendations}
            onSave={(v) => onUpdate({ recommendations: v })}
            placeholder="Рекомендации..."
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EditableTextArea({
  label,
  value,
  onSave,
  placeholder,
}: {
  label: string;
  value: string | null;
  onSave: (v: string) => void;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? '');

  const handleBlur = () => {
    setEditing(false);
    const trimmed = inputValue.trim();
    if (trimmed !== (value ?? '')) onSave(trimmed);
  };

  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1">{label}</label>
      {editing ? (
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          rows={3}
          className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg-tertiary)] border border-primary-500/50 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y"
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setInputValue(value ?? ''); setEditing(true); }}
          onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
          className="cursor-pointer hover:bg-[var(--bg-tertiary)] rounded px-2 py-1.5 text-sm min-h-[2rem] whitespace-pre-wrap"
        >
          {value?.trim() || <span className="text-[var(--text-secondary)]">{placeholder}</span>}
        </div>
      )}
    </div>
  );
}

function PhotoCard({
  photo, index, total, monitoringId,
  editingPhotoId, editData, setEditData,
  onStartEditing, saveEditing, cancelEditing,
  onDelete, onReorder, onView,
}: {
  photo: GtsPhoto;
  index: number;
  total: number;
  monitoringId: string;
  editingPhotoId: string | null;
  editData: { description: string; photoDate: string; latitude: string; longitude: string };
  setEditData: (d: any) => void;
  onStartEditing: (p: GtsPhoto) => void;
  saveEditing: () => void;
  cancelEditing: () => void;
  onDelete: (photoId: string) => void;
  onReorder: (photo: GtsPhoto, dir: 'up' | 'down') => void;
  onView: (photo: GtsPhoto) => void;
}) {
  const thumbnailUrl = gtsMonitoringsApi.getPhotoThumbnailUrl(monitoringId, photo.id);

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl overflow-hidden border border-[var(--border-color)]">
      <div
        className="relative aspect-[4/3] bg-[var(--bg-tertiary)] cursor-pointer overflow-hidden"
        onClick={() => onView(photo)}
      >
        <AuthImage src={thumbnailUrl} alt={photo.description || photo.originalName} className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs">#{index + 1}</div>
        {photo.latitude && photo.longitude && (
          <div className="absolute top-2 right-2 p-1.5 rounded-full bg-green-500/90">
            <MapPin className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        {editingPhotoId === photo.id ? (
          <div className="space-y-2">
            <Input value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} placeholder="Описание" className="text-sm" />
            <input
              type="date"
              value={editData.photoDate}
              onChange={(e) => setEditData({ ...editData, photoDate: e.target.value })}
              className="w-full px-2 py-1.5 text-sm rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)]"
            />
            <div className="flex gap-1">
              <Input value={editData.latitude} onChange={(e) => setEditData({ ...editData, latitude: e.target.value })} placeholder="Широта" className="text-sm flex-1" />
              <Input value={editData.longitude} onChange={(e) => setEditData({ ...editData, longitude: e.target.value })} placeholder="Долгота" className="text-sm flex-1" />
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={cancelEditing}>Отмена</Button>
              <Button size="sm" onClick={saveEditing}>Сохранить</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-[1.5rem] text-sm">{photo.description || <span className="text-[var(--text-secondary)]">Без описания</span>}</div>
            {photo.photoDate && <p className="text-xs text-[var(--text-secondary)]">{new Date(photo.photoDate).toLocaleDateString('ru')}</p>}
            <div className="flex items-center gap-1 pt-2 border-t border-[var(--border-color)]">
              <button className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30" onClick={() => onReorder(photo, 'up')} disabled={index === 0}><ChevronUp className="w-4 h-4" /></button>
              <button className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30" onClick={() => onReorder(photo, 'down')} disabled={index === total - 1}><ChevronDown className="w-4 h-4" /></button>
              <button className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]" onClick={() => onStartEditing(photo)}><Pencil className="w-4 h-4" /></button>
              <div className="flex-1" />
              <button className="p-1.5 rounded hover:bg-red-500/10 text-red-400" onClick={() => onDelete(photo.id)}><Trash2 className="w-4 h-4" /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
