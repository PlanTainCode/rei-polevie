import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Beaker,
  Plus,
  Calendar,
  User,
  Search,
  X,
  RotateCcw,
  MapPin,
  FlaskConical,
} from 'lucide-react';
import { monitoringsApi, type Monitoring } from '@/api/monitorings';
import { Button, Card, CardContent, Select } from '@/components/ui';

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

const ALL_STATUSES = Object.keys(STATUS_LABELS);
const DEFAULT_STATUSES = ALL_STATUSES.filter((s) => s !== 'ARCHIVED');
const DEFAULT_SORT = 'createdAt_desc';

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Сначала новые' },
  { value: 'createdAt_asc', label: 'Сначала старые' },
  { value: 'updatedAt_desc', label: 'Недавно обновлённые' },
  { value: 'name_asc', label: 'По названию А–Я' },
  { value: 'name_desc', label: 'По названию Я–А' },
];

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function matchesSearch(monitoring: Monitoring, query: string): boolean {
  const q = query.toLowerCase();
  const fields = [
    monitoring.name,
    monitoring.objectName,
    monitoring.objectAddress,
  ];
  return fields.some((f) => f?.toLowerCase().includes(q));
}

function sortMonitorings(monitorings: Monitoring[], sort: string): Monitoring[] {
  const [field, dir] = sort.split('_') as [string, 'asc' | 'desc'];
  const mult = dir === 'asc' ? 1 : -1;

  return [...monitorings].sort((a, b) => {
    if (field === 'name') {
      return mult * (a.name || '').localeCompare(b.name || '', 'ru');
    }
    if (field === 'updatedAt') {
      return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    }
    return mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  });
}

export function MonitoringsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get('q') || '';
  const urlStatuses = searchParams.get('status');
  const urlSort = searchParams.get('sort') || DEFAULT_SORT;

  const activeStatuses = useMemo(() => {
    if (!urlStatuses) return DEFAULT_STATUSES;
    const parsed = urlStatuses.split(',').filter((s) => ALL_STATUSES.includes(s));
    return parsed.length > 0 ? parsed : DEFAULT_STATUSES;
  }, [urlStatuses]);

  const [searchInput, setSearchInput] = useState(urlQuery);
  const debouncedQuery = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedQuery) next.set('q', debouncedQuery);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [debouncedQuery, setSearchParams]);

  useEffect(() => {
    setSearchInput(urlQuery);
  }, [urlQuery]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const toggleStatus = useCallback(
    (status: string) => {
      const next = activeStatuses.includes(status)
        ? activeStatuses.filter((s) => s !== status)
        : [...activeStatuses, status];
      if (next.length === 0) return;
      const isDefault =
        next.length === DEFAULT_STATUSES.length &&
        DEFAULT_STATUSES.every((s) => next.includes(s));
      updateParam('status', isDefault ? null : next.join(','));
    },
    [activeStatuses, updateParam],
  );

  const isDefault = !urlQuery && !urlStatuses && urlSort === DEFAULT_SORT;

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const { data: monitorings, isLoading } = useQuery({
    queryKey: ['monitorings'],
    queryFn: monitoringsApi.getAll,
  });

  const filteredMonitorings = useMemo(() => {
    if (!monitorings) return [];
    let result = monitorings.filter((m) => activeStatuses.includes(m.status));
    if (debouncedQuery) {
      result = result.filter((m) => matchesSearch(m, debouncedQuery));
    }
    return sortMonitorings(result, urlSort);
  }, [monitorings, debouncedQuery, activeStatuses, urlSort]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalCount = monitorings?.length || 0;
  const hasMonitorings = totalCount > 0;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Мониторинги</h1>
          <p className="text-[var(--text-secondary)]">
            Управление мониторингами и пробами
          </p>
        </div>
        <Button onClick={() => navigate('/monitorings/create')}>
          <Plus className="w-4 h-4" />
          Создать мониторинг
        </Button>
      </div>

      {hasMonitorings && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Поиск по названию, объекту, адресу..."
                className="w-full h-10 pl-10 pr-9 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Select
              className="w-full sm:w-56 h-10"
              value={urlSort}
              onChange={(e) =>
                updateParam('sort', e.target.value === DEFAULT_SORT ? null : e.target.value)
              }
              options={SORT_OPTIONS}
            />
            {!isDefault && (
              <Button variant="ghost" onClick={resetFilters} className="shrink-0">
                <RotateCcw className="w-4 h-4" />
                Сброс
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {ALL_STATUSES.map((status) => {
              const isActive = activeStatuses.includes(status);
              return (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    isActive
                      ? STATUS_COLORS[status] + ' border-transparent'
                      : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] opacity-50 hover:opacity-75'
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>

          {(debouncedQuery || urlStatuses) && (
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {filteredMonitorings.length === totalCount
                ? `${totalCount} мониторингов`
                : `Найдено ${filteredMonitorings.length} из ${totalCount}`}
            </p>
          )}
        </>
      )}

      {!hasMonitorings ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
              <Beaker className="w-8 h-8 text-[var(--text-secondary)]" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Мониторингов пока нет</h2>
            <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-6">
              Создайте первый мониторинг и добавьте пробы
            </p>
            <Button onClick={() => navigate('/monitorings/create')}>
              <Plus className="w-4 h-4" />
              Создать мониторинг
            </Button>
          </CardContent>
        </Card>
      ) : filteredMonitorings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="w-10 h-10 mx-auto mb-3 text-[var(--text-secondary)] opacity-40" />
            <h3 className="text-lg font-medium mb-1">Ничего не найдено</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Попробуйте изменить параметры поиска или фильтры
            </p>
            <Button variant="ghost" onClick={resetFilters}>
              <RotateCcw className="w-4 h-4" />
              Сбросить фильтры
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMonitorings.map((monitoring) => (
            <Card
              key={monitoring.id}
              className="cursor-pointer hover:border-primary-500/50 transition-colors"
              onClick={() => navigate(`/monitorings/${monitoring.id}`)}
            >
              <CardContent className="py-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                    <Beaker className="w-5 h-5 text-primary-400" />
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      STATUS_COLORS[monitoring.status] || STATUS_COLORS.DRAFT
                    }`}
                  >
                    {STATUS_LABELS[monitoring.status] || monitoring.status}
                  </span>
                </div>

                <h3 className="font-semibold mb-1 line-clamp-2">{monitoring.name}</h3>

                {monitoring.objectName && (
                  <p className="text-xs text-[var(--text-secondary)] mb-1.5 line-clamp-1">
                    {monitoring.objectName}
                  </p>
                )}

                {monitoring.objectAddress && (
                  <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {monitoring.objectAddress}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mb-2">
                  <span className="flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5" />
                    {monitoring._count?.probes ?? 0} проб
                  </span>
                </div>

                <div className="space-y-1.5 text-sm text-[var(--text-secondary)]">
                  {monitoring.createdBy && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>
                        {monitoring.createdBy.firstName} {monitoring.createdBy.lastName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(monitoring.createdAt).toLocaleDateString('ru')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
