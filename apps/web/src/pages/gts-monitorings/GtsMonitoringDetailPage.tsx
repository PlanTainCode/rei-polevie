import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft, Camera, ChevronRight, FileText,
  Landmark, MapPin, Trash2,
} from 'lucide-react';
import { gtsMonitoringsApi, type GtsObject } from '@/api/gts-monitorings';
import { Button, Card, CardContent } from '@/components/ui';

export function GtsMonitoringDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [generatingDV, setGeneratingDV] = useState(false);
  const [generatingAlbum, setGeneratingAlbum] = useState(false);

  const { data: monitoring, isLoading: loadingMonitoring } = useQuery({
    queryKey: ['gts-monitorings', id],
    queryFn: () => gtsMonitoringsApi.getById(id!),
    enabled: !!id,
  });

  const { data: districts, isLoading: loadingDistricts } = useQuery({
    queryKey: ['gts-monitorings', id, 'districts'],
    queryFn: () => gtsMonitoringsApi.getDistricts(id!),
    enabled: !!id,
  });

  const activeDistrictId = selectedDistrictId || districts?.[0]?.id || null;

  const { data: objects, isLoading: loadingObjects } = useQuery({
    queryKey: ['gts-monitorings', id, 'objects', activeDistrictId],
    queryFn: () => gtsMonitoringsApi.getObjects(id!, activeDistrictId!),
    enabled: !!id && !!activeDistrictId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => gtsMonitoringsApi.delete(id!),
    onSuccess: () => navigate('/gts-monitorings'),
  });

  const activeDistrict = districts?.find((d) => d.id === activeDistrictId);

  const handleGenerateDV = async () => {
    if (!id || !activeDistrictId) return;
    setGeneratingDV(true);
    try {
      await gtsMonitoringsApi.generateDistrictDefectStatements(id, activeDistrictId);
    } catch (err) {
      console.error('Ошибка генерации ДВ:', err);
    } finally {
      setGeneratingDV(false);
    }
  };

  const handleGenerateAlbum = async () => {
    if (!id || !activeDistrictId) return;
    setGeneratingAlbum(true);
    try {
      await gtsMonitoringsApi.generateDistrictAlbum(id, activeDistrictId);
    } catch (err) {
      console.error('Ошибка генерации альбома:', err);
    } finally {
      setGeneratingAlbum(false);
    }
  };

  if (loadingMonitoring || loadingDistricts) {
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
        <Link to="/gts-monitorings" className="text-primary-500 hover:text-primary-400 mt-2 inline-block">
          ← К списку
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/gts-monitorings"
          className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{monitoring.name}</h1>
          <p className="text-[var(--text-secondary)] text-sm">
            {monitoring.year} · {monitoring._count?.districts || 0} районов · {monitoring._count?.objects || 0} ГТС
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (window.confirm('Удалить мониторинг ГТС?')) deleteMutation.mutate();
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {(!districts || districts.length === 0) ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Landmark className="w-16 h-16 mx-auto mb-4 text-[var(--text-secondary)]" />
            <h2 className="text-lg font-semibold mb-2">Данные не загружены</h2>
            <p className="text-[var(--text-secondary)]">
              Загрузите Excel-файл с перечнем ГТС при создании мониторинга
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-6">
          {/* Районы */}
          <div className="w-64 shrink-0">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
              Районы
            </h3>
            <div className="space-y-1">
              {districts.map((district) => (
                <button
                  key={district.id}
                  onClick={() => setSelectedDistrictId(district.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    district.id === activeDistrictId
                      ? 'bg-primary-500/20 text-primary-400 font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="truncate">{district.name}</div>
                  <div className="text-xs opacity-70 mt-0.5">{district._count?.objects || 0} ГТС</div>
                </button>
              ))}
            </div>
          </div>

          {/* Объекты */}
          <div className="flex-1 min-w-0">
            {activeDistrict && (
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{activeDistrict.name}</h3>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerateDV}
                    isLoading={generatingDV}
                  >
                    <FileText className="w-4 h-4" />
                    ДВ района
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerateAlbum}
                    isLoading={generatingAlbum}
                  >
                    <Camera className="w-4 h-4" />
                    Фотоальбом района
                  </Button>
                </div>
              </div>
            )}

            {loadingObjects ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : !objects || objects.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-[var(--text-secondary)]">
                  Нет объектов ГТС в этом районе
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {objects.map((obj) => (
                  <ObjectCard key={obj.id} object={obj} monitoringId={id!} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectCard({ object, monitoringId }: { object: GtsObject; monitoringId: string }) {
  const navigate = useNavigate();

  return (
    <Card
      className="border-[var(--border-color)] cursor-pointer hover:border-primary-500/50 transition-colors"
      onClick={() => navigate(`/gts-monitorings/${monitoringId}/objects/${object.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary-400">#{object.number}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">
              {object.watercourseName} — {object.settlement}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)] mt-1">
              {object.ownerName && <span className="truncate max-w-48">{object.ownerName}</span>}
              {object.latitude && object.longitude && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {object.latitude}, {object.longitude}
                </span>
              )}
              <span>{object._count?.photos || 0} фото</span>
              <span>{object._count?.elements || 0} элем.</span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
        </div>
      </CardContent>
    </Card>
  );
}
