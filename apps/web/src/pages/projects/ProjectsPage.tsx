import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderOpen,
  Plus,
  Calendar,
  User,
  FileText,
  Search,
  X,
  RotateCcw,
  GitBranch,
  MapPin,
} from 'lucide-react';
import { projectsApi, type Project } from '@/api/projects';
import { Button, Card, CardContent, Select } from '@/components/ui';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активный',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Завершён',
  ARCHIVED: 'В архиве',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400',
  ACTIVE: 'bg-blue-500/20 text-blue-400',
  IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400',
  COMPLETED: 'bg-primary-500/20 text-primary-400',
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

function matchesSearch(project: Project, query: string): boolean {
  const q = query.toLowerCase();
  const fields = [
    project.name,
    project.objectName,
    project.objectAddress,
    project.documentNumber,
    project.clientName,
  ];
  return fields.some((f) => f?.toLowerCase().includes(q));
}

function sortProjects(projects: Project[], sort: string): Project[] {
  const [field, dir] = sort.split('_') as [string, 'asc' | 'desc'];
  const mult = dir === 'asc' ? 1 : -1;

  return [...projects].sort((a, b) => {
    if (field === 'name') {
      return mult * (a.name || '').localeCompare(b.name || '', 'ru');
    }
    if (field === 'updatedAt') {
      return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    }
    return mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  });
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Состояние из URL ---
  const urlQuery = searchParams.get('q') || '';
  const urlStatuses = searchParams.get('status');
  const urlSort = searchParams.get('sort') || DEFAULT_SORT;
  const urlHideChildren = searchParams.get('hideChildren') !== '0';

  const activeStatuses = useMemo(() => {
    if (!urlStatuses) return DEFAULT_STATUSES;
    const parsed = urlStatuses.split(',').filter((s) => ALL_STATUSES.includes(s));
    return parsed.length > 0 ? parsed : DEFAULT_STATUSES;
  }, [urlStatuses]);

  // Локальное значение инпута (для мгновенного отклика при вводе)
  const [searchInput, setSearchInput] = useState(urlQuery);
  const debouncedQuery = useDebouncedValue(searchInput, 300);

  // Синхронизируем дебаунс → URL
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (debouncedQuery) next.set('q', debouncedQuery);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [debouncedQuery, setSearchParams]);

  // Синхронизируем URL → инпут (при навигации назад)
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

  const isDefault =
    !urlQuery &&
    !urlStatuses &&
    urlSort === DEFAULT_SORT &&
    urlHideChildren;

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // --- Данные ---
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  });

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    let result = projects;

    if (urlHideChildren) {
      result = result.filter((p) => !p.parentProjectId);
    }

    result = result.filter((p) => activeStatuses.includes(p.status));

    if (debouncedQuery) {
      result = result.filter((p) => matchesSearch(p, debouncedQuery));
    }

    return sortProjects(result, urlSort);
  }, [projects, debouncedQuery, activeStatuses, urlSort, urlHideChildren]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalCount = projects?.length || 0;
  const hasProjects = totalCount > 0;

  return (
    <div className="animate-fade-in">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Объекты</h1>
          <p className="text-[var(--text-secondary)]">
            Управление проектами и объектами
          </p>
        </div>
        <Button onClick={() => navigate('/projects/create')}>
          <Plus className="w-4 h-4" />
          Создать объект
        </Button>
      </div>

      {hasProjects && (
        <>
          {/* Поиск + сортировка + сброс */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Поиск по названию, адресу, номеру, заказчику..."
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
              onChange={(e) => updateParam('sort', e.target.value === DEFAULT_SORT ? null : e.target.value)}
              options={SORT_OPTIONS}
            />
            {!isDefault && (
              <Button variant="ghost" onClick={resetFilters} className="shrink-0">
                <RotateCcw className="w-4 h-4" />
                Сброс
              </Button>
            )}
          </div>

          {/* Чипы статусов + скрыть допотборы */}
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
            <div className="w-px h-5 bg-[var(--border-color)] mx-1 hidden sm:block" />
            <button
              onClick={() => updateParam('hideChildren', urlHideChildren ? '0' : null)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                urlHideChildren
                  ? 'bg-purple-500/20 text-purple-400 border-transparent'
                  : 'bg-transparent text-[var(--text-secondary)] border-[var(--border-color)] opacity-50 hover:opacity-75'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Скрыть допотборы
            </button>
          </div>

          {/* Счётчик */}
          {(debouncedQuery || urlStatuses || !urlHideChildren) && (
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {filteredProjects.length === totalCount
                ? `${totalCount} объектов`
                : `Найдено ${filteredProjects.length} из ${totalCount}`}
            </p>
          )}
        </>
      )}

      {/* Контент */}
      {!hasProjects ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
              <FolderOpen className="w-8 h-8 text-[var(--text-secondary)]" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Объектов пока нет</h2>
            <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-6">
              Создайте первый объект, загрузите ТЗ и поручение в формате Word
            </p>
            <Button onClick={() => navigate('/projects/create')}>
              <Plus className="w-4 h-4" />
              Создать объект
            </Button>
          </CardContent>
        </Card>
      ) : filteredProjects.length === 0 ? (
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
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:border-primary-500/50 transition-colors"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardContent className="py-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-primary-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {project.parentProjectId && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400">
                        допотбор
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[project.status] || STATUS_COLORS.DRAFT
                      }`}
                    >
                      {STATUS_LABELS[project.status] || project.status}
                    </span>
                  </div>
                </div>

                <h3 className="font-semibold mb-1 line-clamp-2">{project.name}</h3>

                {project.documentNumber && (
                  <p className="text-xs text-primary-400 font-mono mb-2">
                    {project.documentNumber}
                  </p>
                )}

                {project.objectAddress && (
                  <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {project.objectAddress}
                  </p>
                )}

                <div className="space-y-1.5 text-sm text-[var(--text-secondary)]">
                  {project.createdBy && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>
                        {project.createdBy.firstName} {project.createdBy.lastName}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(project.createdAt).toLocaleDateString('ru')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>
                      {[project.tzFileName && 'ТЗ', project.orderFileName && 'Поручение']
                        .filter(Boolean)
                        .join(', ') || 'Нет файлов'}
                    </span>
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
