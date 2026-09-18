import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Calendar, User, Clock, CheckCircle2, AlertCircle, Loader2, Trash2, FileCode2 } from 'lucide-react';
import { technicalTasksApi, type TechnicalTaskListItem } from '@/api/technical-tasks';
import { Button, Card, CardContent } from '@/components/ui';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: 'Черновик', color: 'bg-gray-500/20 text-gray-400', icon: Clock },
  PROCESSING: { label: 'Извлечение', color: 'bg-amber-500/20 text-amber-400', icon: Loader2 },
  COMPLETED: { label: 'XML готов', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle2 },
  ERROR: { label: 'Ошибка', color: 'bg-red-500/20 text-red-400', icon: AlertCircle },
};

const SOURCE_LABEL: Record<string, string> = { WORD: 'из ТЗ заказчика', DESIGN_XML: 'из задания на проектирование', SCRATCH: 'с нуля' };

function TechnicalTaskCard({ task }: { task: TechnicalTaskListItem }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.DRAFT;
  const StatusIcon = status.icon;

  const deleteMutation = useMutation({
    mutationFn: () => technicalTasksApi.delete(task.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technical-tasks'] }),
  });

  return (
    <Card className="cursor-pointer group hover:border-primary-500/50 transition-colors relative" onClick={() => navigate(`/technical-tasks/${task.id}`)}>
      <button
        type="button"
        className="absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-secondary)] hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm('Удалить это ТЗ?')) deleteMutation.mutate();
        }}
        disabled={deleteMutation.isPending}
      >
        <Trash2 className={`w-4 h-4 ${deleteMutation.isPending ? 'animate-spin' : ''}`} />
      </button>

      <CardContent className="py-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
            <FileCode2 className="w-5 h-5 text-primary-400" />
          </div>
          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mr-6 ${status.color}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${task.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
            {status.label}
          </span>
        </div>
        <h3 className="font-semibold mb-2 line-clamp-2">{task.name}</h3>
        <div className="space-y-1.5 text-sm text-[var(--text-secondary)]">
          <div className="text-xs">{SOURCE_LABEL[task.source] ?? ''}</div>
          {task.createdBy && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>
                {task.createdBy.firstName} {task.createdBy.lastName}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{new Date(task.createdAt).toLocaleDateString('ru')}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="truncate">{task.xmlFileName || task.sourceFileName || 'Нет файла'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TechnicalTasksPage() {
  const navigate = useNavigate();
  const { data: tasks, isLoading } = useQuery({ queryKey: ['technical-tasks'], queryFn: technicalTasksApi.getAll });

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Задания на изыскания</h1>
          <p className="text-[var(--text-secondary)] text-sm">XML по схеме Минстроя (EngineeringSurveysTask-01-00)</p>
        </div>
        <Button onClick={() => navigate('/technical-tasks/create')}>
          <Plus className="w-4 h-4" /> Новое задание
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-[var(--text-secondary)]">
            <FileCode2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="mb-4">Заданий пока нет</p>
            <Button onClick={() => navigate('/technical-tasks/create')}>
              <Plus className="w-4 h-4" /> Создать первое
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((t) => (
            <TechnicalTaskCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}
