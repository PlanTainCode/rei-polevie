import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  MapPin,
  Calendar,
  Upload,
  Trash2,
  X,
  Check,
  Pencil,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Image,
  Download,
  FolderDown,
  Presentation,
  Plus,
  FolderOpen,
} from 'lucide-react';
import { projectsApi, type Photo } from '@/api/projects';
import { Button, Input, Card, CardContent, AuthImage } from '@/components/ui';

/**
 * Формирует ссылку на Яндекс.Карты по координатам
 */
function getYandexMapsUrl(latitude: string, longitude: string): string | null {
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude.replace(/^0+/, '')); // убираем ведущие нули
  
  if (isNaN(lat) || isNaN(lon)) return null;
  
  return `https://yandex.ru/maps/?pt=${lon},${lat}&z=17&l=map`;
}

export function ProjectPhotosPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ description: '', photoDate: '', latitude: '', longitude: '' });
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  
  // Подальбомы
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | undefined>(undefined);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [renamingAlbumId, setRenamingAlbumId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // Генерация альбома
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [crewMembers, setCrewMembers] = useState('');
  const [isGeneratingAlbum, setIsGeneratingAlbum] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });

  const { data: albums } = useQuery({
    queryKey: ['photo-albums', id],
    queryFn: () => projectsApi.getPhotoAlbums(id!),
    enabled: !!id,
  });

  const { data: photos, isLoading: photosLoading } = useQuery({
    queryKey: ['project-photos', id, selectedAlbumId],
    queryFn: () => projectsApi.getPhotos(id!, selectedAlbumId),
    enabled: !!id,
  });

  const createAlbumMutation = useMutation({
    mutationFn: (name: string) => projectsApi.createPhotoAlbum(id!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-albums', id] });
      setShowCreateAlbum(false);
      setNewAlbumName('');
    },
  });

  const renameAlbumMutation = useMutation({
    mutationFn: ({ albumId, name }: { albumId: string; name: string }) =>
      projectsApi.renamePhotoAlbum(id!, albumId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-albums', id] });
      setRenamingAlbumId(null);
    },
  });

  const deleteAlbumMutation = useMutation({
    mutationFn: (albumId: string) => projectsApi.deletePhotoAlbum(id!, albumId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-albums', id] });
      queryClient.invalidateQueries({ queryKey: ['project-photos', id] });
      setSelectedAlbumId(undefined);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => projectsApi.uploadPhotos(id!, files, selectedAlbumId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', id] });
      queryClient.invalidateQueries({ queryKey: ['photo-albums', id] });
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { photoId: string; description?: string; photoDate?: string; latitude?: string; longitude?: string }) =>
      projectsApi.updatePhoto(id!, data.photoId, {
        description: data.description,
        photoDate: data.photoDate,
        latitude: data.latitude,
        longitude: data.longitude,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', id] });
      setEditingPhotoId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => projectsApi.deletePhoto(id!, photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', id] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orders: { id: string; sortOrder: number }[]) => projectsApi.reorderPhotos(id!, orders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', id] });
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setIsUploading(true);
      uploadMutation.mutate(files);
    }
    // Сбрасываем input для повторной загрузки тех же файлов
    e.target.value = '';
  }, [uploadMutation]);

  const handleDownloadAll = useCallback(async () => {
    if (!id) return;
    setIsDownloadingAll(true);
    try {
      await projectsApi.downloadAllPhotos(id, selectedAlbumId);
    } finally {
      setIsDownloadingAll(false);
    }
  }, [id, selectedAlbumId]);

  const handleDownloadPhoto = useCallback(async (photoId: string) => {
    if (!id) return;
    setDownloadingPhotoId(photoId);
    try {
      await projectsApi.downloadPhoto(id, photoId);
    } finally {
      setDownloadingPhotoId(null);
    }
  }, [id]);

  const handleGenerateAlbum = useCallback(async () => {
    if (!id || !crewMembers.trim()) return;
    setIsGeneratingAlbum(true);
    setAlbumError(null);
    try {
      await projectsApi.generatePhotoAlbum(id, crewMembers.trim(), selectedAlbumId);
      setShowAlbumModal(false);
      setCrewMembers('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error('Album generation failed:', err);
      setAlbumError(`Ошибка генерации альбома: ${message}`);
    } finally {
      setIsGeneratingAlbum(false);
    }
  }, [id, crewMembers, selectedAlbumId]);

  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const startEditing = (photo: Photo) => {
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
      updateMutation.mutate({
        photoId: editingPhotoId,
        ...editData,
      });
    }
  };

  const cancelEditing = () => {
    setEditingPhotoId(null);
    setEditData({ description: '', photoDate: '', latitude: '', longitude: '' });
  };

  const movePhoto = (photo: Photo, direction: 'up' | 'down') => {
    if (!photos) return;
    
    const currentIndex = photos.findIndex(p => p.id === photo.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= photos.length) return;

    // Меняем порядок
    const newPhotos = [...photos];
    [newPhotos[currentIndex], newPhotos[newIndex]] = [newPhotos[newIndex], newPhotos[currentIndex]];
    
    // Формируем новый порядок
    const orders = newPhotos.map((p, idx) => ({ id: p.id, sortOrder: idx }));
    reorderMutation.mutate(orders);
  };

  const canEdit = project?.canEditPhotos ?? project?.canEdit ?? false;

  if (projectLoading || photosLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Объект не найден</p>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in page-content">
      {/* Заголовок */}
      <div className={`sticky top-0 z-30 rounded-xl py-4 mb-6 transition-all ${isHeaderScrolled ? 'bg-[var(--bg-tertiary)] px-4' : 'bg-[var(--bg-primary)]'}`}>
        <Link
          to={`/projects/${id}`}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к объекту
        </Link>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <Camera className="w-7 h-7 text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Фотоматериалы</h1>
              <p className="text-[var(--text-secondary)]">{project.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Кнопка генерации альбома */}
            {photos && photos.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => setShowAlbumModal(true)}
              >
                <Presentation className="w-4 h-4" />
                Создать альбом
              </Button>
            )}

            {/* Кнопка скачать все */}
            {photos && photos.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleDownloadAll}
                isLoading={isDownloadingAll}
              >
                <FolderDown className="w-4 h-4" />
                Скачать все
              </Button>
            )}

            {/* Кнопка загрузки */}
            {canEdit && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  isLoading={isUploading || uploadMutation.isPending}
                >
                  <Upload className="w-4 h-4" />
                  Загрузить
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Подальбомы */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setSelectedAlbumId(undefined)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            selectedAlbumId === undefined
              ? 'bg-primary-500 text-white'
              : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          Все фото
        </button>

        {albums?.map((album) => (
          <div key={album.id} className="relative group/album flex items-center">
            {renamingAlbumId === album.id ? (
              <div className="flex items-center gap-1">
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="text-sm h-9 w-40"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renameValue.trim()) renameAlbumMutation.mutate({ albumId: album.id, name: renameValue.trim() });
                    if (e.key === 'Escape') setRenamingAlbumId(null);
                  }}
                />
                <button onClick={() => { if (renameValue.trim()) renameAlbumMutation.mutate({ albumId: album.id, name: renameValue.trim() }); }} className="p-1 text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
                <button onClick={() => setRenamingAlbumId(null)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button
                onClick={() => setSelectedAlbumId(album.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedAlbumId === album.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                {album.name}
                <span className="text-xs opacity-70">{album._count.photos}</span>
              </button>
            )}
            {canEdit && renamingAlbumId !== album.id && (
              <div className="absolute -top-2 -right-2 hidden group-hover/album:flex items-center gap-0.5">
                <button
                  onClick={() => { setRenamingAlbumId(album.id); setRenameValue(album.name); }}
                  className="p-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-primary-400 shadow"
                  title="Переименовать"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => { if (confirm(`Удалить подальбом «${album.name}»? Фото перенесутся в общий.`)) deleteAlbumMutation.mutate(album.id); }}
                  className="p-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-red-400 shadow"
                  title="Удалить"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}

        {canEdit && (
          showCreateAlbum ? (
            <div className="flex items-center gap-1">
              <Input
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Название..."
                className="text-sm h-9 w-40"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newAlbumName.trim()) createAlbumMutation.mutate(newAlbumName.trim());
                  if (e.key === 'Escape') { setShowCreateAlbum(false); setNewAlbumName(''); }
                }}
              />
              <button onClick={() => { if (newAlbumName.trim()) createAlbumMutation.mutate(newAlbumName.trim()); }} className="p-1 text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
              <button onClick={() => { setShowCreateAlbum(false); setNewAlbumName(''); }} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateAlbum(true)}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-1 border border-dashed border-[var(--border-primary)]"
            >
              <Plus className="w-4 h-4" />
              Подальбом
            </button>
          )
        )}
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-primary-400">{photos?.length || 0}</p>
            <p className="text-sm text-[var(--text-secondary)]">Всего фото</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-green-400">
              {photos?.filter(p => p.latitude && p.longitude).length || 0}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">С GPS</p>
          </CardContent>
        </Card>
      </div>

      {/* Фотографии */}
      {(!photos || photos.length === 0) ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
              <Image className="w-8 h-8 text-primary-400" />
            </div>
            <p className="text-lg font-medium mb-1">Фотографии пока не загружены</p>
            <p className="text-sm text-[var(--text-tertiary)] mb-6">Загрузите фотографии с выезда для формирования альбома</p>
            {canEdit && (
              <Button onClick={() => fileInputRef.current?.click()} size="lg">
                <Upload className="w-5 h-5" />
                Загрузить фото
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {photos.map((photo, index) => (
            <div 
              key={photo.id} 
              className="group bg-[var(--bg-secondary)] rounded-xl overflow-hidden border border-[var(--border-primary)] hover:border-primary-500/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/10"
            >
              {/* Превью */}
              <div 
                className="relative aspect-[4/3] bg-[var(--bg-tertiary)] cursor-pointer overflow-hidden"
                onClick={() => setViewingPhoto(photo)}
              >
                <AuthImage
                  src={projectsApi.getPhotoThumbnailUrl(id!, photo.id)}
                  alt={photo.description || photo.originalName}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Градиент снизу для лучшей читаемости */}
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Номер фото */}
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
                  #{index + 1}
                </div>
                
                {/* Иконка GPS если есть */}
                {photo.latitude && photo.longitude && (
                  <div className="absolute top-3 right-3 bg-green-500/90 backdrop-blur-sm text-white p-1.5 rounded-full">
                    <MapPin className="w-3 h-3" />
                  </div>
                )}
                
                {/* Оверлей при наведении */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white/20 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full">
                    Просмотреть
                  </div>
                </div>
              </div>

              {/* Информация */}
              <div className="p-4">
                {editingPhotoId === photo.id ? (
                  // Режим редактирования
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Описание</label>
                      <Input
                        value={editData.description}
                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        placeholder="Описание фото..."
                        className="text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Дата съёмки</label>
                      <input
                        type="date"
                        value={editData.photoDate}
                        onChange={(e) => setEditData({ ...editData, photoDate: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Широта</label>
                        <Input
                          value={editData.latitude}
                          onChange={(e) => setEditData({ ...editData, latitude: e.target.value })}
                          placeholder="55.64433"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Долгота</label>
                        <Input
                          value={editData.longitude}
                          onChange={(e) => setEditData({ ...editData, longitude: e.target.value })}
                          placeholder="037.49028"
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end pt-2">
                      <Button size="sm" variant="ghost" onClick={cancelEditing}>
                        Отмена
                      </Button>
                      <Button size="sm" onClick={saveEditing} isLoading={updateMutation.isPending}>
                        <Check className="w-4 h-4" />
                        Сохранить
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Режим просмотра
                  <div className="space-y-3">
                    {/* Описание */}
                    <div className="min-h-[2.5rem]">
                      {photo.description ? (
                        <p className="text-sm font-medium line-clamp-2 text-[var(--text-primary)]">{photo.description}</p>
                      ) : (
                        <p className="text-sm text-[var(--text-tertiary)] italic">Без описания</p>
                      )}
                    </div>
                    
                    {/* Метаданные */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {photo.photoDate && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                          <Calendar className="w-3.5 h-3.5 text-primary-400" />
                          {new Date(photo.photoDate).toLocaleDateString('ru', { 
                            day: 'numeric', 
                            month: 'short',
                            year: 'numeric' 
                          })}
                        </span>
                      )}
                      
                      {photo.latitude && photo.longitude && (
                        <a
                          href={getYandexMapsUrl(photo.latitude, photo.longitude) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-primary-400 transition-colors"
                          title="Открыть на Яндекс.Картах"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MapPin className="w-3.5 h-3.5 text-green-400" />
                          <span>{photo.latitude.slice(0, 8)}, {photo.longitude.slice(0, 8)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* Управление */}
                    <div className="flex items-center gap-1 pt-3 border-t border-[var(--border-primary)]">
                      {canEdit && (
                        <div className="flex items-center gap-0.5 bg-[var(--bg-tertiary)] rounded-lg p-0.5">
                          <button
                            className="p-1.5 rounded-md hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            onClick={() => movePhoto(photo, 'up')}
                            disabled={index === 0 || reorderMutation.isPending}
                            title="Переместить выше"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded-md hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            onClick={() => movePhoto(photo, 'down')}
                            disabled={index === photos.length - 1 || reorderMutation.isPending}
                            title="Переместить ниже"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      
                      <div className="flex-1" />
                      
                      {/* Кнопка скачивания - доступна всем */}
                      <button
                        className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-green-400 transition-colors disabled:opacity-50"
                        onClick={() => handleDownloadPhoto(photo.id)}
                        disabled={downloadingPhotoId === photo.id}
                        title="Скачать"
                      >
                        {downloadingPhotoId === photo.id ? (
                          <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                      
                      {canEdit && (
                        <>
                          <button
                            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-primary-400 transition-colors"
                            onClick={() => startEditing(photo)}
                            title="Редактировать"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                            onClick={() => {
                              if (confirm('Удалить это фото?')) {
                                deleteMutation.mutate(photo.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно просмотра фото */}
      {viewingPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewingPhoto(null)}
        >
          {/* Кнопки управления */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              className="p-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadPhoto(viewingPhoto.id);
              }}
              disabled={downloadingPhotoId === viewingPhoto.id}
              title="Скачать"
            >
              {downloadingPhotoId === viewingPhoto.id ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-6 h-6" />
              )}
            </button>
            <button
              className="p-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
              onClick={() => setViewingPhoto(null)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <AuthImage
              src={projectsApi.getPhotoOriginalUrl(id!, viewingPhoto.id)}
              alt={viewingPhoto.description || viewingPhoto.originalName}
              className="max-w-full max-h-[90vh] object-contain"
            />
            
            {/* Информация под фото */}
            <div className="mt-4 text-center text-white/80 space-y-1">
              {viewingPhoto.description && (
                <p className="text-lg">{viewingPhoto.description}</p>
              )}
              <div className="flex items-center justify-center gap-4 text-sm">
                {viewingPhoto.photoDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(viewingPhoto.photoDate).toLocaleDateString('ru')}
                  </span>
                )}
                {viewingPhoto.latitude && viewingPhoto.longitude && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {viewingPhoto.latitude}, {viewingPhoto.longitude}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно генерации альбома */}
      {showAlbumModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !isGeneratingAlbum && setShowAlbumModal(false)}
        >
          <div 
            className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-md shadow-xl border border-[var(--border-primary)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Presentation className="w-5 h-5 text-primary-400" />
                Создать презентацию
              </h2>
              <button
                className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                onClick={() => !isGeneratingAlbum && setShowAlbumModal(false)}
                disabled={isGeneratingAlbum}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Будет сгенерирована презентация с {photos?.length || 0} фотографиями в формате PPTX.
            </p>

            <div className="mb-6">
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
                Состав ПБ (исполнители)
              </label>
              <Input
                value={crewMembers}
                onChange={(e) => setCrewMembers(e.target.value)}
                placeholder="Иванов И.И., Петров П.П."
                disabled={isGeneratingAlbum}
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                Укажите ФИО сотрудников через запятую
              </p>
            </div>

            {albumError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {albumError}
              </div>
            )}

            <div className="flex items-center gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowAlbumModal(false)}
                disabled={isGeneratingAlbum}
              >
                Отмена
              </Button>
              <Button
                onClick={handleGenerateAlbum}
                isLoading={isGeneratingAlbum}
                disabled={!crewMembers.trim()}
              >
                <Presentation className="w-4 h-4" />
                Сгенерировать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
