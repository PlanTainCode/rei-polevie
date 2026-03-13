import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Droplets, Layers, MapPin, Trash2, Check, Camera, Clock } from 'lucide-react';
import { monitoringsApi, type MonitoringProbe } from '@/api/monitorings';
import { Button, Card, CardContent } from '@/components/ui';

type FilterTab = 'all' | 'WATER' | 'SEDIMENT';

const TYPE_BADGE: Record<string, string> = {
  WATER: 'bg-blue-500/20 text-blue-400',
  SEDIMENT: 'bg-amber-700/30 text-amber-300',
};
const TYPE_LABEL: Record<string, string> = { WATER: 'Вода', SEDIMENT: 'ДО' };

const FILTERS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'WATER', label: 'Вода' },
  { value: 'SEDIMENT', label: 'ДО' },
];

function formatCollectedAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 16);
}

function ProbeCard({
  probe,
  onCollect,
  onDelete,
  onUpdateCollectedAt,
}: {
  probe: MonitoringProbe;
  onCollect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateCollectedAt: (probeId: string, date: string) => void;
}) {
  const [editingDate, setEditingDate] = useState(false);
  const [localCollectedAt, setLocalCollectedAt] = useState<string | null>(null);
  const collected = probe.status === 'COLLECTED';
  const hasCoords = !!probe.latitude && !!probe.longitude;
  const photos = probe._count?.photos ?? 0;
  const displayedCollectedAt = localCollectedAt ?? probe.collectedAt;

  return (
    <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-1">
        <p className="font-medium text-[13px] leading-snug min-w-0 line-clamp-2" title={probe.name}>
          {probe.name}
        </p>
        <button
          onClick={() => { if (window.confirm('Удалить?')) onDelete(probe.id); }}
          className="p-0.5 rounded text-red-400/40 hover:text-red-400 hover:bg-red-500/10 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${TYPE_BADGE[probe.type]}`}>
          {TYPE_LABEL[probe.type]}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
          collected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-500/20 text-zinc-400'
        }`}>
          {collected ? 'Отобрана' : 'Ожидает'}
        </span>
      </div>

      {collected && (
        editingDate ? (
          <input
            type="datetime-local"
            defaultValue={toDatetimeLocal(displayedCollectedAt)}
            className="w-full h-7 px-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-[11px] focus:outline-none focus:border-primary-500 [color-scheme:dark]"
            autoFocus
            onBlur={(e) => {
              setEditingDate(false);
              if (e.target.value) {
                const iso = new Date(e.target.value).toISOString();
                setLocalCollectedAt(iso);
                onUpdateCollectedAt(probe.id, iso);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditingDate(false);
            }}
          />
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-primary-400 transition-colors text-left"
          >
            <Clock className="w-3 h-3 shrink-0" />
            {displayedCollectedAt ? formatCollectedAt(displayedCollectedAt) : 'Указать дату отбора'}
          </button>
        )
      )}

      {hasCoords && (
        <a
          href={`https://yandex.ru/maps/?pt=${probe.longitude},${probe.latitude}&z=16&l=map`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-primary-400 hover:text-primary-300 truncate"
        >
          <MapPin className="w-3 h-3 shrink-0" />
          {probe.latitude}, {probe.longitude}
        </a>
      )}

      {probe.description && (
        <p className="text-[11px] text-[var(--text-secondary)] truncate">{probe.description}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-[var(--border-color)]">
        <span className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
          {photos > 0 && <><Camera className="w-3 h-3" />{photos}</>}
        </span>
        {!collected && (
          <button
            onClick={() => onCollect(probe.id)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-600/80 text-white hover:bg-emerald-600 transition-colors"
          >
            <Check className="w-3 h-3" />
            Отобрать
          </button>
        )}
      </div>
    </div>
  );
}

export function MonitoringProbesPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'WATER' | 'SEDIMENT'>('WATER');

  const { data: monitoring, isLoading: lm } = useQuery({
    queryKey: ['monitorings', id],
    queryFn: () => monitoringsApi.getById(id!),
    enabled: !!id,
  });

  const { data: probes, isLoading: lp } = useQuery({
    queryKey: ['monitorings', id, 'probes'],
    queryFn: () => monitoringsApi.getProbes(id!),
    enabled: !!id,
  });

  const inv = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['monitorings', id, 'probes'] });
    qc.invalidateQueries({ queryKey: ['monitorings', id] });
  }, [qc, id]);

  const collectMut = useMutation({
    mutationFn: (probeId: string) => monitoringsApi.collectProbe(id!, probeId),
    onSuccess: inv,
  });

  const deleteMut = useMutation({
    mutationFn: (probeId: string) => monitoringsApi.deleteProbe(id!, probeId),
    onSuccess: inv,
  });

  const updateCollectedAtMut = useMutation({
    mutationFn: ({ probeId, collectedAt }: { probeId: string; collectedAt: string }) =>
      monitoringsApi.updateProbe(id!, probeId, { collectedAt }),
    onSuccess: inv,
  });

  const createMut = useMutation({
    mutationFn: () => monitoringsApi.createProbe(id!, { name: name.trim(), type }),
    onSuccess: () => { inv(); setName(''); setType('WATER'); setAddOpen(false); },
  });

  const filtered = (probes ?? []).filter((p) => filter === 'all' || p.type === filter);
  const total = probes?.length ?? 0;
  const collected = probes?.filter((p) => p.status === 'COLLECTED').length ?? 0;

  if (lm || lp || !id) {
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
        <Link to="/monitorings" className="text-primary-500 hover:text-primary-400 mt-2 inline-block">К списку</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-5">
        <Link
          to={`/monitorings/${id}`}
          className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{monitoring.name}</h1>
          <p className="text-[var(--text-secondary)] text-sm">{total} проб &middot; {collected} отобрано</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" />
          Добавить
        </Button>
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === f.value
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Droplets className="w-10 h-10 mx-auto mb-3 text-[var(--text-secondary)]" />
            <p className="text-sm font-medium mb-1">Проб нет</p>
            <p className="text-xs text-[var(--text-secondary)] mb-4">Загрузите ТЗ или добавьте вручную</p>
            {filter === 'all' && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4" />
                Добавить
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((p) => (
            <ProbeCard
              key={p.id}
              probe={p}
              onCollect={(pid) => collectMut.mutate(pid)}
              onDelete={(pid) => deleteMut.mutate(pid)}
              onUpdateCollectedAt={(probeId, collectedAt) => updateCollectedAtMut.mutate({ probeId, collectedAt })}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddOpen(false)} />
          <Card className="relative w-full max-w-sm">
            <CardContent className="p-5">
              <h3 className="text-base font-semibold mb-3">Новая проба</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Название точки"
                  className="w-full h-9 px-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-primary-500"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setType('WATER')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      type === 'WATER'
                        ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                        : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Droplets className="w-3.5 h-3.5" />
                    Вода
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('SEDIMENT')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      type === 'SEDIMENT'
                        ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                        : 'border-[var(--border-color)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    ДО
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setAddOpen(false)}>
                  Отмена
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => { if (name.trim()) createMut.mutate(); }}
                  disabled={!name.trim()}
                  isLoading={createMut.isPending}
                >
                  Добавить
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
