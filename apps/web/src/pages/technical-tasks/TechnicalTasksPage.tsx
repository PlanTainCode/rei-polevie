import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, 
  Plus, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2
} from 'lucide-react';
import { technicalTasksApi, type TechnicalTask } from '@/api/technical-tasks';
import { Button, Card, CardContent } from '@/components/ui';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { 
    label: 'Черновик', 
    color: 'bg-gray-500/20 text-gray-400',
    icon: Clock
  },
  PROCESSING: { 
    label: 'Обработка', 
    color: 'bg-amber-500/20 text-amber-400',
    icon: Loader2
  },
  COMPLETED: { 
    label: 'Готово', 
    color: 'bg-emerald-500/20 text-emerald-400',
    icon: CheckCircle2
  },
  ERROR: { 
    label: 'Ошибка', 
    color: 'bg-red-500/20 text-red-400',
    icon: AlertCircle
  },
};

function TechnicalTaskCard({ task }: { task: TechnicalTask }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.DRAFT;
  const StatusIcon = status.icon;

  const deleteMutation = useMutation({
    mutationFn: () => technicalTasksApi.delete(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical-tasks'] });
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Удалить это ТЗ?')) {
      deleteMutation.mutate();
    }
  };

  return (
    <Card
      className="cursor-pointer group hover:border-primary-500/50 transition-colors relative"
      onClick={() => navigate(`/technical-tasks/${task.id}`)}
    >
      {/* Кнопка удаления */}
      <button
        type="button"
        className="absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-secondary)] hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400"
        onClick={handleDelete}
        disabled={deleteMutation.isPending}
      >
        <Trash2 className={`w-4 h-4 ${deleteMutation.isPending ? 'animate-spin' : ''}`} />
      </button>

      <CardContent className="py-5">
        {/* Верхняя строка с иконкой и статусом */}
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary-400" />
          </div>
          
          <span
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mr-6 ${status.color}`}
          >
            <StatusIcon className={`w-3.5 h-3.5 ${task.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
            {status.label}
          </span>
        </div>

        {/* Название */}
        <h3 className="font-semibold mb-2 line-clamp-2">
          {task.name}
        </h3>

        {/* Метаданные */}
        <div className="space-y-1.5 text-sm text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>
              {task.createdBy.firstName} {task.createdBy.lastName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(task.createdAt).toLocaleDateString('ru')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="truncate">
              {task.sourceFileName || 'Нет файла'}
            </span>
          </div>
        </div>

        {/* Индикатор готовности */}
        {task.generatedFileName && (
          <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>ТЗ готово</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TechnicalTasksPage() {
  const navigate = useNavigate();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['technical-tasks'],
    queryFn: technicalTasksApi.getAll,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Технические задания</h1>
          <p className="text-[var(--text-secondary)]">
            Преобразование ТЗ заказчика в ваш формат
          </p>
        </div>
        
        <Button onClick={() => navigate('/technical-tasks/create')}>
          <Plus className="w-4 h-4" />
          Создать ТЗ
        </Button>
      </div>

      {/* Контент */}
      {!tasks || tasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[var(--text-secondary)]" />
            </div>
            
            <h2 className="text-xl font-semibold mb-2">
              Технических заданий пока нет
            </h2>
            <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-6">
              Загрузите ТЗ от заказчика в формате Word или PDF, и система автоматически 
              преобразует его в ваш корпоративный формат
            </p>
            
            <Button onClick={() => navigate('/technical-tasks/create')}>
              <Plus className="w-4 h-4" />
              Создать ТЗ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TechnicalTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}


