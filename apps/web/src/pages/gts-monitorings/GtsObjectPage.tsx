import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Camera, ChevronDown, ChevronUp,
  Download, FileText, Image as ImageIcon, Presentation, Trash2, Upload, X,
} from 'lucide-react';
import {
  gtsMonitoringsApi,
  type GtsElement,
  type GtsLegacyMedia,
  type GtsPhoto,
} from '@/api/gts-monitorings';
import { Button, Card, CardContent, AuthImage } from '@/components/ui';

function normalizeDisplayedFilename(name: string | null): string | null {
  if (!name) return null;
  if (!/[ÐÑ]/.test(name)) return name;
  try {
    const decoded = decodeURIComponent(escape(name));
    return /[А-Яа-яЁё]/.test(decoded) ? decoded : name;
  } catch {
    return name;
  }
}

export function GtsObjectPage() {
  const { id, objectId } = useParams<{ id: string; objectId: string }>();
  const queryClient = useQueryClient();
  const sourceDvInputRef = useRef<HTMLInputElement>(null);
  const legacyInputRef = useRef<HTMLInputElement>(null);

  const [generatingDV, setGeneratingDV] = useState(false);
  const [generatingAlbum, setGeneratingAlbum] = useState(false);
  const [uploadingSourceDv, setUploadingSourceDv] = useState(false);
  const [showLegacyGallery, setShowLegacyGallery] = useState(false);

  const { data: object, isLoading: loadingObject } = useQuery({
    queryKey: ['gts-object', objectId],
    queryFn: () => gtsMonitoringsApi.getObject(id!, objectId!),
    enabled: !!id && !!objectId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['gts-object', objectId] });
    queryClient.invalidateQueries({ queryKey: ['gts-legacy-media', objectId] });
  };

  const { data: legacyMedia } = useQuery({
    queryKey: ['gts-legacy-media', objectId],
    queryFn: () => gtsMonitoringsApi.getLegacyMedia(id!, objectId!),
    enabled: !!id && !!objectId,
  });

  const updateObjectMutation = useMutation({
    mutationFn: (data: Record<string, any>) => gtsMonitoringsApi.updateObject(id!, objectId!, data),
    onSuccess: invalidate,
  });

  const updateElementMutation = useMutation({
    mutationFn: ({ elementId, data }: { elementId: string; data: Record<string, any> }) =>
      gtsMonitoringsApi.updateElement(id!, objectId!, elementId, data),
    onSuccess: invalidate,
  });

  const acceptElementMutation = useMutation({
    mutationFn: ({ elementId, field }: {
      elementId: string;
      field: 'characteristics' | 'defects' | 'recommendations';
    }) => gtsMonitoringsApi.acceptElementEdit(id!, objectId!, elementId, field),
    onSuccess: invalidate,
  });

  const rejectElementMutation = useMutation({
    mutationFn: ({ elementId, field }: {
      elementId: string;
      field: 'characteristics' | 'defects' | 'recommendations';
    }) => gtsMonitoringsApi.rejectElementEdit(id!, objectId!, elementId, field),
    onSuccess: invalidate,
  });

  const uploadSourceDvMutation = useMutation({
    mutationFn: (file: File) => gtsMonitoringsApi.uploadSourceDefectStatement(id!, objectId!, file),
    onSuccess: invalidate,
  });

  const uploadLegacyMutation = useMutation({
    mutationFn: (files: File[]) => gtsMonitoringsApi.uploadLegacyMedia(id!, objectId!, files),
    onSuccess: invalidate,
  });

  const handleGenerateDV = async () => {
    if (!id || !objectId) return;
    setGeneratingDV(true);
    try {
      await gtsMonitoringsApi.generateObjectDefectStatement(id, objectId);
      invalidate();
    }
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

  const handleSourceDvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !id || !objectId) return;

    setUploadingSourceDv(true);
    try {
      await uploadSourceDvMutation.mutateAsync(file);
    } catch (err) {
      console.error(err);
      window.alert('Не удалось загрузить старую ДВ. Разрешен только формат .docx');
    } finally {
      setUploadingSourceDv(false);
    }
  };

  const handleLegacySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    uploadLegacyMutation.mutate(files);
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
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={legacyInputRef}
              type="file"
              accept=".pdf,image/*"
              multiple
              onChange={handleLegacySelect}
              className="hidden"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => legacyInputRef.current?.click()}
              isLoading={uploadLegacyMutation.isPending}
            >
              <Upload className="w-4 h-4" />
              Загрузить прошлые фото/PDF
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!legacyMedia?.length}
              onClick={() => setShowLegacyGallery(true)}
            >
              <ImageIcon className="w-4 h-4" />
              Просмотреть
            </Button>
          </div>
          <div className="mt-3 text-xs text-[var(--text-secondary)]">
            Загружено файлов: {legacyMedia?.length || 0}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={sourceDvInputRef}
              type="file"
              accept=".docx"
              onChange={handleSourceDvSelect}
              className="hidden"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => sourceDvInputRef.current?.click()}
              isLoading={uploadingSourceDv || uploadSourceDvMutation.isPending}
            >
              <Upload className="w-4 h-4" />
              Загрузить старую ДВ
            </Button>

            <Button
              size="sm"
              variant="secondary"
              disabled={!object.sourceDvStoredName}
              onClick={() => gtsMonitoringsApi.downloadSourceDefectStatement(id!, objectId!)}
            >
              <Download className="w-4 h-4" />
              Скачать старую ДВ
            </Button>

            <Button
              size="sm"
              variant="secondary"
              disabled={!object.generatedDvStoredName}
              onClick={() => gtsMonitoringsApi.downloadGeneratedDefectStatement(id!, objectId!)}
            >
              <Download className="w-4 h-4" />
              Скачать сгенерированную ДВ
            </Button>
          </div>

          <div className="mt-3 text-xs text-[var(--text-secondary)] space-y-1">
            <div>
              Старая ДВ: {normalizeDisplayedFilename(object.sourceDvOriginalName) || 'не загружена'}
            </div>
            <div>
              Сгенерированная ДВ: {normalizeDisplayedFilename(object.generatedDvOriginalName) || 'пока не сформирована'}
            </div>
          </div>
        </CardContent>
      </Card>

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
                monitoringId={id}
                objectId={objectId}
                element={el}
                index={idx}
                onUpdate={(data) => updateElementMutation.mutate({ elementId: el.id, data })}
                onAcceptField={(field) => acceptElementMutation.mutate({ elementId: el.id, field })}
                onRejectField={(field) => rejectElementMutation.mutate({ elementId: el.id, field })}
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

      {showLegacyGallery && (
        <LegacyMediaGallery
          monitoringId={id}
          media={legacyMedia || []}
          onClose={() => setShowLegacyGallery(false)}
        />
      )}

    </div>
  );
}

function LegacyMediaGallery({
  monitoringId,
  media,
  onClose,
}: {
  monitoringId: string;
  media: GtsLegacyMedia[];
  onClose: () => void;
}) {
  const [viewingImage, setViewingImage] = useState<GtsLegacyMedia | null>(null);

  const isImage = (item: GtsLegacyMedia) => item.mimeType.startsWith('image/');

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/80 p-4 overflow-y-auto" onClick={onClose}>
        <div className="max-w-5xl mx-auto bg-[var(--bg-secondary)] rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Галерея прошлых материалов</h3>
            <button type="button" className="p-2 rounded hover:bg-[var(--bg-tertiary)]" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
          {!media.length ? (
            <div className="text-sm text-[var(--text-secondary)] py-6 text-center">Файлы не загружены</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {media.map((item) => (
                <div key={item.id} className="border border-[var(--border-color)] rounded-lg overflow-hidden">
                  {isImage(item) ? (
                    <button type="button" className="w-full" onClick={() => setViewingImage(item)}>
                      <AuthImage
                        src={gtsMonitoringsApi.getLegacyMediaOriginalUrl(monitoringId, item.id)}
                        alt={item.originalName}
                        className="w-full aspect-square object-cover"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => gtsMonitoringsApi.openLegacyMedia(monitoringId, item.id, item.originalName)}
                      className="w-full aspect-square flex flex-col items-center justify-center bg-[var(--bg-tertiary)]"
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
      </div>

      {viewingImage && (
        <ZoomableImageModal
          src={gtsMonitoringsApi.getLegacyMediaOriginalUrl(monitoringId, viewingImage.id)}
          alt={viewingImage.originalName}
          onClose={() => setViewingImage(null)}
        />
      )}
    </>,
    document.body,
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
  monitoringId,
  objectId,
  element,
  index,
  onUpdate,
  onAcceptField,
  onRejectField,
}: {
  monitoringId: string;
  objectId: string;
  element: GtsElement;
  index: number;
  onUpdate: (data: Record<string, any>) => void;
  onAcceptField: (field: 'characteristics' | 'defects' | 'recommendations') => void;
  onRejectField: (field: 'characteristics' | 'defects' | 'recommendations') => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingPhoto, setViewingPhoto] = useState<GtsPhoto | null>(null);

  const { data: photos } = useQuery({
    queryKey: ['gts-element-photos', element.id],
    queryFn: () => gtsMonitoringsApi.getElementPhotos(monitoringId, objectId, element.id),
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => gtsMonitoringsApi.uploadElementPhotos(monitoringId, objectId, element.id, files),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gts-element-photos', element.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => gtsMonitoringsApi.deletePhoto(monitoringId, photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gts-element-photos', element.id] }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orders: { id: string; sortOrder: number }[]) =>
      gtsMonitoringsApi.reorderElementPhotos(monitoringId, objectId, element.id, orders),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gts-element-photos', element.id] }),
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if ((photos?.length || 0) + files.length > 4) {
      window.alert('Для одного элемента можно загрузить максимум 4 фото');
      return;
    }
    uploadMutation.mutate(files);
  };

  const movePhoto = (photoId: string, direction: 'up' | 'down') => {
    if (!photos || photos.length < 2) return;
    const current = [...photos];
    const idx = current.findIndex((p) => p.id === photoId);
    if (idx < 0) return;
    const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= current.length) return;
    [current[idx], current[nextIdx]] = [current[nextIdx], current[idx]];
    reorderMutation.mutate(current.map((p, i) => ({ id: p.id, sortOrder: i })));
  };

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
          <ProposedDiffBlock
            oldValue={element.characteristics}
            proposedValue={element.proposedCharacteristics}
            onAccept={() => onAcceptField('characteristics')}
            onReject={() => onRejectField('characteristics')}
          />
          <EditableTextArea
            label="Выявленные дефекты"
            value={element.defects}
            onSave={(v) => onUpdate({ defects: v })}
            placeholder="Выявленные дефекты..."
          />
          <ProposedDiffBlock
            oldValue={element.defects}
            proposedValue={element.proposedDefects}
            onAccept={() => onAcceptField('defects')}
            onReject={() => onRejectField('defects')}
          />
          <EditableTextArea
            label="Рекомендации"
            value={element.recommendations}
            onSave={(v) => onUpdate({ recommendations: v })}
            placeholder="Рекомендации..."
          />
          <ProposedDiffBlock
            oldValue={element.recommendations}
            proposedValue={element.proposedRecommendations}
            onAccept={() => onAcceptField('recommendations')}
            onReject={() => onRejectField('recommendations')}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">
              Фото элемента ({photos?.length || 0}/4)
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={(photos?.length || 0) >= 4}
              isLoading={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-4 h-4" />
              Добавить
            </Button>
          </div>

          {photos && photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {photos.map((photo, idx) => (
                <div key={photo.id} className="rounded-lg border border-[var(--border-color)] overflow-hidden">
                  <button
                    type="button"
                    className="w-full"
                    onClick={() => setViewingPhoto(photo)}
                  >
                    <AuthImage
                      src={gtsMonitoringsApi.getPhotoThumbnailUrl(monitoringId, photo.id)}
                      alt={photo.originalName}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                  </button>
                  <div className="flex items-center justify-between p-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
                        onClick={() => movePhoto(photo.id, 'up')}
                        disabled={idx === 0}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
                        onClick={() => movePhoto(photo.id, 'down')}
                        disabled={idx === photos.length - 1}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      className="p-1 rounded hover:bg-red-500/10 text-red-400"
                      onClick={() => {
                        if (window.confirm('Удалить фото?')) deleteMutation.mutate(photo.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[var(--text-secondary)]">
              Фото пока не загружены
            </div>
          )}
        </div>

        {viewingPhoto && (
          <ZoomableImageModal
            src={gtsMonitoringsApi.getPhotoOriginalUrl(monitoringId, viewingPhoto.id)}
            alt={viewingPhoto.description || viewingPhoto.originalName}
            onClose={() => setViewingPhoto(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ZoomableImageModal({
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

  const getContainerCenter = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 };
    return {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };
  };

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
        const nextX = cx - ((cx - prevTranslate.x) / prevScale) * nextScale;
        const nextY = cy - ((cy - prevTranslate.y) / prevScale) * nextScale;
        return { x: nextX, y: nextY };
      });
      return nextScale;
    });
  };

  const zoomIn = () => {
    const center = getContainerCenter();
    zoomAtPoint(scale + 0.25, center.clientX, center.clientY);
  };

  const zoomOut = () => {
    const center = getContainerCenter();
    zoomAtPoint(scale - 0.25, center.clientX, center.clientY);
  };
  const reset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
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
    setTranslate({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setDragging(false);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-black/95"
      onClick={onClose}
    >
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
          <Button size="sm" variant="secondary" onClick={zoomOut} disabled={scale <= 1}>
            -
          </Button>
          <button
            type="button"
            className="px-2 py-1 text-xs text-white/90 hover:text-white"
            onClick={reset}
          >
            {Math.round(scale * 100)}%
          </button>
          <Button size="sm" variant="secondary" onClick={zoomIn}>
            +
          </Button>
          <button
            type="button"
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={onClose}
          >
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
          <AuthImage
            src={src}
            alt={alt}
            className="max-w-full max-h-[90vh] object-contain select-none"
          />
        </div>
      </div>
    </div>,
    document.body,
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

function ProposedDiffBlock({
  oldValue,
  proposedValue,
  onAccept,
  onReject,
}: {
  oldValue: string | null;
  proposedValue: string | null;
  onAccept: () => void;
  onReject: () => void;
}) {
  const next = proposedValue?.trim() || '';
  if (!next) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)] mb-1">Старый вариант</div>
        <div className="text-sm whitespace-pre-wrap">{oldValue?.trim() || '—'}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-amber-300 mb-1">Отредактированный вариант</div>
        <div className="text-sm whitespace-pre-wrap">{next}</div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onReject}>Отклонить</Button>
        <Button size="sm" onClick={onAccept}>Принять</Button>
      </div>
    </div>
  );
}

