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
  Sparkles,
  Trash2
} from 'lucide-react';
import { technicalTasksApi, type TechnicalTask } from '@/api/technical-tasks';
import { Card, CardContent } from '@/components/ui';
import { MirrorButton } from '@/components/ui/MirrorButton';

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

function TechnicalTaskCard({ task, index }: { task: TechnicalTask; index: number }) {
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
      className="cursor-pointer group transition-all duration-300 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 relative"
      onClick={() => navigate(`/technical-tasks/${task.id}`)}
      style={{
        animationDelay: `${index * 100}ms`,
      }}
    >
      {/* Кнопка удаления */}
      <button
        type="button"
        className="absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-50 bg-[var(--bg-secondary)] hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400 border border-transparent hover:border-red-500/30"
        onClick={handleDelete}
        disabled={deleteMutation.isPending}
      >
        <Trash2 className={`w-4 h-4 ${deleteMutation.isPending ? 'animate-spin' : ''}`} />
      </button>

      <CardContent className="py-5">
        {/* Верхняя строка с иконкой и статусом */}
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FileText className="w-6 h-6 text-cyan-400" />
            </div>
            {/* Декоративные частицы */}
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400/30 blur-sm group-hover:animate-ping" />
          </div>
          
          <span
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              transition-all duration-300 mr-6
              ${status.color}
            `}
          >
            <StatusIcon className={`w-3.5 h-3.5 ${task.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
            {status.label}
          </span>
        </div>

        {/* Название */}
        <h3 className="font-semibold text-lg mb-3 line-clamp-2 group-hover:text-cyan-400 transition-colors">
          {task.name}
        </h3>

        {/* Информация о файле */}
        {task.sourceFileName && (
          <div className="mb-3 p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <FileText className="w-4 h-4 text-cyan-400/60" />
              <span className="truncate">{task.sourceFileName}</span>
            </div>
          </div>
        )}

        {/* Метаданные */}
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>
              {task.createdBy.firstName} {task.createdBy.lastName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(task.createdAt).toLocaleDateString('ru', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
          </div>
        </div>

        {/* Индикатор готовности сгенерированного файла */}
        {task.generatedFileName && (
          <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>ТЗ готово к скачиванию</span>
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
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-b-blue-500/50 rounded-full animate-spin" 
               style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Технические задания
          </h1>
          <p className="text-[var(--text-secondary)]">
            Преобразование ТЗ заказчика в ваш формат
          </p>
        </div>
        
        <MirrorButton onClick={() => navigate('/technical-tasks/create')}>
          <Plus className="w-5 h-5" />
          <span>Создать ТЗ</span>
          <Sparkles className="w-4 h-4 opacity-60" />
        </MirrorButton>
      </div>

      {/* Контент */}
      {!tasks || tasks.length === 0 ? (
        <Card className="relative overflow-hidden">
          <CardContent className="py-20 text-center">
            {/* Фоновый паттерн */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2322d3ee' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />
            </div>

            <div className="relative">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <FileText className="w-10 h-10 text-cyan-400" />
              </div>
              
              <h2 className="text-2xl font-semibold mb-3">
                Пока нет технических заданий
              </h2>
              <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-8">
                Загрузите ТЗ от заказчика в формате Word или PDF, и система автоматически 
                преобразует его в ваш корпоративный формат
              </p>
              
              <MirrorButton onClick={() => navigate('/technical-tasks/create')}>
                <Plus className="w-5 h-5" />
                <span>Создать первое ТЗ</span>
                <Sparkles className="w-4 h-4 opacity-60" />
              </MirrorButton>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task, index) => (
            <TechnicalTaskCard key={task.id} task={task} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}


