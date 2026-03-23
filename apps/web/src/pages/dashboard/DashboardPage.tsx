import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  FileText,
  FlaskConical,
  Users,
  ArrowRight,
  Plus,
  AlertTriangle,
  Info,
  X,
  FolderOpen,
  CheckCircle2,
  Clock,
  User,
  Beaker,
  Gift,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { companiesApi } from '@/api/companies';
import { projectsApi, type DashboardStats } from '@/api/projects';
import { Button, Card, CardContent } from '@/components/ui';

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

const BIRTHDAY_USERS = new Set([
  'termolov@gruppa-rei.ru',
  'plancode14@gmail.com',
]);

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const normalizedEmail = user?.email?.trim().toLowerCase() || '';
  const today = new Date();
  const isMarch23 = today.getMonth() === 2 && today.getDate() === 23;
  const showBirthdayNotice = BIRTHDAY_USERS.has(normalizedEmail) && isMarch23;

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['myCompany'],
    queryFn: companiesApi.getMyCompany,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: projectsApi.getDashboardStats,
    enabled: !!company,
  });

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Если нет компании - предлагаем создать
  if (!company) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        {showBirthdayNotice && <BirthdayNotice />}

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Добро пожаловать, {user?.firstName}!
          </h1>
          <p className="text-[var(--text-secondary)]">
            Для начала работы создайте компанию или дождитесь приглашения
          </p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-500/20 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Создайте компанию</h2>
            <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
              Создайте свою компанию и пригласите сотрудников для совместной
              работы над проектами
            </p>
            <Button onClick={() => navigate('/company/create')}>
              <Plus className="w-4 h-4" />
              Создать компанию
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = ['OWNER', 'ADMIN'].includes(stats?.role || company.myRole);

  // Основная страница дашборда
  return (
    <div className="w-full animate-fade-in page-content">
      {showBirthdayNotice && <BirthdayNotice />}

      {/* Beta информация */}
      <BetaNotice />

      {/* Оповещение об обновлении */}
      <UpdateNotice />

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Добро пожаловать, {user?.firstName}!
        </h1>
        <p className="text-[var(--text-secondary)]">
          Компания: <span className="text-[var(--text-primary)]">{company.name}</span>
        </p>
      </div>

      {/* Статистика */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : stats ? (
          <>
            <StatCard
              icon={FolderOpen}
              title={isAdmin ? 'Всего объектов' : 'Моих объектов'}
              value={stats.totalProjects}
              subtitle={`Активных: ${stats.activeProjects}`}
              color="blue"
            />
            <StatCard
              icon={FlaskConical}
              title="Проб в работе"
              value={stats.samplesInProgress}
              color="yellow"
            />
            {isAdmin ? (
              <StatCard
                icon={Users}
                title="Сотрудников"
                value={stats.membersCount}
                color="purple"
              />
            ) : (
              <StatCard
                icon={Beaker}
                title="Завершено проб"
                value={stats.completedThisMonth}
                subtitle="За 30 дней"
                color="green"
              />
            )}
            <StatCard
              icon={CheckCircle2}
              title="Завершено за месяц"
              value={stats.completedThisMonth}
              subtitle="Объектов"
              color="green"
            />
          </>
        ) : null}
      </div>

      {/* Быстрые действия (только для OWNER/ADMIN/MANAGER — у WORKER таблица недавних объектов) */}
      {company.myRole !== 'WORKER' && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Быстрые действия</h2>
          <div className={`grid gap-4 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-3' : ''}`}>
            <QuickActionCard
              icon={FileText}
              title="Новый объект"
              description="Создать объект и загрузить документы"
              onClick={() => navigate('/projects/create')}
            />
            {isAdmin && (
              <QuickActionCard
                icon={Users}
                title="Сотрудники"
                description="Управление командой"
                onClick={() => navigate('/company')}
              />
            )}
            <QuickActionCard
              icon={FolderOpen}
              title="Все объекты"
              description="Перейти к списку объектов"
              onClick={() => navigate('/projects')}
            />
          </div>
        </div>
      )}

      {/* Недавние объекты */}
      {stats && stats.recentProjects.length > 0 && (
        <RecentProjectsSection
          projects={stats.recentProjects}
          onNavigate={navigate}
        />
      )}
    </div>
  );
}

function BirthdayNotice() {
  return (
    <div className="mb-6 p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
          <Gift className="w-5 h-5 text-primary-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-primary-400 mb-1">С Днем рождения, Томас</h3>
        </div>
      </div>
    </div>
  );
}

// === Компоненты ===

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: typeof FolderOpen;
  title: string;
  value: number;
  subtitle?: string;
  color: 'blue' | 'yellow' | 'green' | 'purple';
}) {
  const colorMap = {
    blue: 'bg-blue-500/20 text-blue-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    green: 'bg-emerald-500/20 text-emerald-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };

  const iconColorMap = {
    blue: 'text-blue-400',
    yellow: 'text-yellow-400',
    green: 'text-emerald-400',
    purple: 'text-purple-400',
  };

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
          </div>
        </div>
        <p className="text-2xl font-bold mb-0.5">{value}</p>
        <p className="text-sm text-[var(--text-secondary)]">{title}</p>
        {subtitle && (
          <p className="text-xs text-[var(--text-tertiary)] mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] animate-pulse mb-3" />
        <div className="h-7 w-12 bg-[var(--bg-tertiary)] animate-pulse rounded mb-1" />
        <div className="h-4 w-24 bg-[var(--bg-tertiary)] animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Card className="group cursor-pointer hover:border-primary-500/50 transition-colors">
      <CardContent
        className="flex items-center gap-4 py-5"
        onClick={onClick}
      >
        <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center group-hover:bg-primary-500/30 transition-colors">
          <Icon className="w-6 h-6 text-primary-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-0.5">{title}</h3>
          <p className="text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-primary-400 transition-colors" />
      </CardContent>
    </Card>
  );
}

function RecentProjectsSection({
  projects,
  onNavigate,
}: {
  projects: DashboardStats['recentProjects'];
  onNavigate: (path: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Недавние объекты</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('/projects')}
          className="text-sm"
        >
          Все объекты
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-primary)]">
                <th className="text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider px-4 py-3">
                  Объект
                </th>
                <th className="text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider px-4 py-3 hidden md:table-cell">
                  Адрес
                </th>
                <th className="text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider px-4 py-3">
                  Статус
                </th>
                <th className="text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                  Проб
                </th>
                <th className="text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider px-4 py-3 hidden lg:table-cell">
                  Обновлён
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-secondary)] cursor-pointer transition-colors"
                  onClick={() => onNavigate(`/projects/${project.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-4 h-4 text-primary-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{project.name}</p>
                        {project.createdBy && (
                          <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3" />
                            {project.createdBy.firstName} {project.createdBy.lastName}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm text-[var(--text-secondary)] truncate max-w-xs">
                      {project.objectAddress || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[project.status] || STATUS_COLORS.DRAFT
                      }`}
                    >
                      {STATUS_LABELS[project.status] || project.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                      <FlaskConical className="w-3.5 h-3.5" />
                      {project.samplesCount}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                      <Clock className="w-3.5 h-3.5" />
                      {formatRelativeDate(project.updatedAt)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  if (diffDays < 7) return `${diffDays} дн. назад`;

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

function UpdateNotice() {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('updateNotice_2025_03_indicators') === 'true';
  });

  const handleDismiss = () => {
    localStorage.setItem('updateNotice_2025_03_indicators', 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Info className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-blue-400 mb-1">Обновление системы</h3>
          <ul className="text-sm text-[var(--text-secondary)] space-y-1.5">
            <li>
              <strong className="text-[var(--text-primary)]">Показатели перенесены внутрь объекта.</strong>{' '}
              Теперь загрузка и просмотр показателей доступны на странице объекта (плашка в самом низу страницы, после «Допотборы»). Отдельный раздел «Показатели» в меню убран.
            </li>
            <li>
              <strong className="text-[var(--text-primary)]">Поиск и фильтры на странице объектов.</strong>{' '}
              Добавлены умный поиск, фильтрация по статусу, сортировка и возможность скрыть допотборы.
            </li>
          </ul>
          <p className="text-sm text-amber-400 mt-2 font-medium">
            Пожалуйста, внимательно протестируйте все функции после обновления.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1.5 hover:bg-blue-500/20 rounded-lg transition-colors"
          title="Скрыть"
        >
          <X className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
      </div>
    </div>
  );
}

function BetaNotice() {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('betaNoticeDismissed') === 'true';
  });

  const handleDismiss = () => {
    localStorage.setItem('betaNoticeDismissed', 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-amber-400">Что означает</h3>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-amber-500/20 text-amber-400 rounded">
              beta
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Функционал с пометкой <span className="text-amber-400 font-medium">beta</span> находится 
            в стадии разработки и тестирования. Он может работать нестабильно или содержать ошибки. 
            <span className="text-[var(--text-primary)]"> Не рекомендуется использовать beta-функции для рабочих задач</span> — 
            они предназначены для ознакомления и тестирования.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1.5 hover:bg-amber-500/20 rounded-lg transition-colors"
          title="Скрыть"
        >
          <X className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
      </div>
    </div>
  );
}
