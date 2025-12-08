import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Beaker,
  MapPinned,
  CheckCircle,
  RefreshCw,
  X,
  Check,
  Pencil,
} from 'lucide-react';
import { projectsApi, type Sample } from '@/api/projects';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

// Типовые характеристики проб
const SAMPLE_DESCRIPTIONS = [
  'супесь',
  'суглинок',
  'глина',
  'песок',
  'торф',
  'ил',
  'гравий',
  'чернозём',
  'грунт насыпной',
  'грунт смешанный',
];

export function ProjectSamplesPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ description: '', latitude: '', longitude: '' });

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });

  const { data: samples, isLoading: samplesLoading } = useQuery({
    queryKey: ['project-samples', id],
    queryFn: () => projectsApi.getSamples(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { sampleId: string; description?: string; latitude?: string; longitude?: string }) =>
      projectsApi.updateSample(id!, data.sampleId, {
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-samples', id] });
      setEditingSampleId(null);
    },
  });

  const collectMutation = useMutation({
    mutationFn: (sampleId: string) => projectsApi.collectSample(id!, sampleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-samples', id] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => projectsApi.regenerateSamples(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-samples', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });

  const startEditing = (sample: Sample) => {
    setEditingSampleId(sample.id);
    setEditData({
      description: sample.description || '',
      latitude: sample.latitude || '',
      longitude: sample.longitude || '',
    });
  };

  const saveEditing = () => {
    if (editingSampleId) {
      updateMutation.mutate({
        sampleId: editingSampleId,
        ...editData,
      });
    }
  };

  const cancelEditing = () => {
    setEditingSampleId(null);
    setEditData({ description: '', latitude: '', longitude: '' });
  };

  if (projectLoading || samplesLoading) {
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

  const canEdit = project.canEdit ?? false;

  // Группируем пробы по площадкам
  const groupedSamples = (samples || []).reduce((acc, sample) => {
    const key = sample.platform.label;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(sample);
    return acc;
  }, {} as Record<string, Sample[]>);

  // Сортируем ключи: ПП1, ПП2... СК1, СК2...
  const sortedKeys = Object.keys(groupedSamples).sort((a, b) => {
    const typeA = a.startsWith('ПП') ? 0 : 1;
    const typeB = b.startsWith('ПП') ? 0 : 1;
    if (typeA !== typeB) return typeA - typeB;
    
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  // Считаем статистику
  const totalSamples = samples?.length || 0;
  const collectedSamples = samples?.filter(s => s.status === 'COLLECTED').length || 0;

  return (
    <div className="max-w-4xl animate-fade-in">
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
              <Beaker className="w-7 h-7 text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Пробы</h1>
              <p className="text-[var(--text-secondary)]">{project.name}</p>
            </div>
          </div>

          {canEdit && (
            <Button
              variant="secondary"
              onClick={() => regenerateMutation.mutate()}
              isLoading={regenerateMutation.isPending}
            >
              <RefreshCw className="w-4 h-4" />
              Перегенерировать
            </Button>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-primary-400">{totalSamples}</p>
            <p className="text-sm text-[var(--text-secondary)]">Всего проб</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-green-400">{collectedSamples}</p>
            <p className="text-sm text-[var(--text-secondary)]">Отобрано</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-amber-400">{totalSamples - collectedSamples}</p>
            <p className="text-sm text-[var(--text-secondary)]">Осталось</p>
          </CardContent>
        </Card>
      </div>

      {/* Пробы */}
      {(!samples || samples.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Beaker className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
            <p className="text-[var(--text-secondary)] mb-4">Пробы пока не сгенерированы</p>
            {canEdit && (
              <Button
                onClick={() => regenerateMutation.mutate()}
                isLoading={regenerateMutation.isPending}
              >
                <RefreshCw className="w-4 h-4" />
                Сгенерировать пробы
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedKeys.map((platformLabel) => (
            <Card key={platformLabel}>
              <CardHeader className="py-3 bg-[var(--bg-tertiary)]">
                <CardTitle className="text-base">{platformLabel}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-[var(--border-primary)]">
                {groupedSamples[platformLabel].map((sample) => (
                  <div key={sample.id} className="px-4 py-3">
                    {editingSampleId === sample.id ? (
                      // Режим редактирования
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-primary-400">{sample.cipher}</span>
                          <span className="text-xs text-[var(--text-secondary)]">{sample.depthLabel} м</span>
                          <span className="text-xs text-[var(--text-tertiary)]">{sample.mass}</span>
                        </div>
                        
                        <div>
                          <label className="text-xs text-[var(--text-secondary)] mb-1 block">Характеристика</label>
                          <select
                            value={editData.description}
                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm"
                          >
                            <option value="">Выберите...</option>
                            {SAMPLE_DESCRIPTIONS.map((desc) => (
                              <option key={desc} value={desc}>{desc}</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Широта</label>
                            <Input
                              value={editData.latitude}
                              onChange={(e) => setEditData({ ...editData, latitude: e.target.value })}
                              placeholder="55 50.792"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-[var(--text-secondary)] mb-1 block">Долгота</label>
                            <Input
                              value={editData.longitude}
                              onChange={(e) => setEditData({ ...editData, longitude: e.target.value })}
                              placeholder="37 39.277"
                              className="text-sm"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={cancelEditing}>
                            <X className="w-4 h-4" />
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="font-mono font-medium text-primary-400">{sample.cipher}</span>
                            <span className="text-xs text-[var(--text-secondary)] ml-2">{sample.depthLabel} м</span>
                            <span className="text-xs text-[var(--text-tertiary)] ml-2">{sample.mass}</span>
                          </div>
                          {sample.description && (
                            <span className="text-sm text-[var(--text-secondary)]">{sample.description}</span>
                          )}
                          {(sample.latitude || sample.longitude) && (
                            <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                              <MapPinned className="w-3 h-3" />
                              {sample.latitude}, {sample.longitude}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {sample.status === 'COLLECTED' && (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Отобрана
                            </span>
                          )}
                          
                          {canEdit && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => startEditing(sample)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {sample.status !== 'COLLECTED' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => collectMutation.mutate(sample.id)}
                                  isLoading={collectMutation.isPending}
                                >
                                  <Check className="w-4 h-4" />
                                  Отметить
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

