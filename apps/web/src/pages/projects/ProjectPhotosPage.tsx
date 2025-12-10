import { useState, useRef, useCallback } from 'react';
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
  
  // Генерация альбома
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [crewMembers, setCrewMembers] = useState('');
  const [isGeneratingAlbum, setIsGeneratingAlbum] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });

  const { data: photos, isLoading: photosLoading } = useQuery({
    queryKey: ['project-photos', id],
    queryFn: () => projectsApi.getPhotos(id!),
    enabled: !!id,
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => projectsApi.uploadPhotos(id!, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-photos', id] });
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
      await projectsApi.downloadAllPhotos(id);
    } finally {
      setIsDownloadingAll(false);
    }
  }, [id]);

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
    try {
      await projectsApi.generatePhotoAlbum(id, crewMembers.trim());
      setShowAlbumModal(false);
      setCrewMembers('');
    } finally {
      setIsGeneratingAlbum(false);
    }
  }, [id, crewMembers]);

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

  const canEdit = project?.canEdit ?? false;

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
    <div className="max-w-6xl animate-fade-in">
      {/* Заголовок */}
      <div className="mb-8">
        <Link
          to={`/projects/${id}`}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4"
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
              <h1 className="text-2xl font-bold">Фотоальбом</h1>
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
                Создать фотоальбом
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
