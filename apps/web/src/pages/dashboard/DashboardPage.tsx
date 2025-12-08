import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  FileText,
  FlaskConical,
  Users,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { companiesApi } from '@/api/companies';
import { Button, Card, CardContent } from '@/components/ui';

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: company, isLoading } = useQuery({
    queryKey: ['myCompany'],
    queryFn: companiesApi.getMyCompany,
  });

  if (isLoading) {
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

  // Основная страница дашборда
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Добро пожаловать, {user?.firstName}!
        </h1>
        <p className="text-[var(--text-secondary)]">
          Компания: <span className="text-[var(--text-primary)]">{company.name}</span>
        </p>
      </div>

      {/* Быстрые действия */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <QuickActionCard
          icon={FileText}
          title="Новый объект"
          description="Создать объект и загрузить документы"
          onClick={() => navigate('/projects/create')}
        />
        <QuickActionCard
          icon={FlaskConical}
          title="Пробы"
          description="Просмотр и редактирование проб"
          onClick={() => navigate('/samples')}
        />
        <QuickActionCard
          icon={Users}
          title="Сотрудники"
          description="Управление командой"
          onClick={() => navigate('/company')}
        />
      </div>

      {/* Статистика */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Активных объектов" value="0" />
        <StatCard title="Проб в работе" value="0" />
        <StatCard title="Сотрудников" value={String(company.members?.length || 1)} />
        <StatCard title="Завершено за месяц" value="0" />
      </div>
    </div>
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

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-sm text-[var(--text-secondary)] mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

