import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Calendar, Landmark, X } from 'lucide-react';
import { gtsMonitoringsApi, type GtsMonitoring } from '@/api/gts-monitorings';
import { Button, Card, CardContent } from '@/components/ui';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активный',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Завершён',
  ARCHIVED: 'Архив',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400',
  ACTIVE: 'bg-blue-500/20 text-blue-400',
  IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400',
  COMPLETED: 'bg-green-500/20 text-green-400',
  ARCHIVED: 'bg-gray-500/20 text-gray-400',
};

export function GtsMonitoringsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: monitorings, isLoading } = useQuery({
    queryKey: ['gts-monitorings'],
    queryFn: gtsMonitoringsApi.getAll,
  });

  const filtered = useMemo(() => {
    if (!monitorings) return [];
    if (!search.trim()) return monitorings;
    const q = search.toLowerCase();
    return monitorings.filter(
      (m) => m.name.toLowerCase().includes(q) || String(m.year).includes(q),
    );
  }, [monitorings, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Мониторинг ГТС</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Гидротехнические сооружения ({monitorings?.length || 0})
          </p>
        </div>
        <Button onClick={() => navigate('/gts-monitorings/create')}>
          <Plus className="w-4 h-4" />
          Создать
        </Button>
      </div>

      {(monitorings?.length ?? 0) > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или году..."
            className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--bg-tertiary)]"
            >
              <X className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Landmark className="w-16 h-16 mx-auto mb-4 text-[var(--text-secondary)]" />
            <h2 className="text-lg font-semibold mb-2">
              {monitorings?.length === 0 ? 'Нет мониторингов ГТС' : 'Ничего не найдено'}
            </h2>
            <p className="text-[var(--text-secondary)] mb-6">
              {monitorings?.length === 0
                ? 'Создайте первый мониторинг, загрузив Excel с данными ГТС'
                : 'Попробуйте изменить критерии поиска'}
            </p>
            {monitorings?.length === 0 && (
              <Button onClick={() => navigate('/gts-monitorings/create')}>
                <Plus className="w-4 h-4" />
                Создать мониторинг ГТС
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((m) => (
            <MonitoringCard key={m.id} monitoring={m} onClick={() => navigate(`/gts-monitorings/${m.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MonitoringCard({ monitoring, onClick }: { monitoring: GtsMonitoring; onClick: () => void }) {
  return (
    <Card
      className="border-[var(--border-color)] cursor-pointer hover:border-primary-500/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold truncate">{monitoring.name}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[monitoring.status] || ''}`}>
                {STATUS_LABELS[monitoring.status] || monitoring.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {monitoring.year}
              </span>
              <span>{monitoring._count?.districts || 0} районов</span>
              <span>{monitoring._count?.objects || 0} ГТС</span>
              <span>{monitoring._count?.photos || 0} фото</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
