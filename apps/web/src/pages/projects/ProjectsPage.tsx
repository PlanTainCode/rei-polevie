import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Plus, Calendar, User, FileText } from 'lucide-react';
import { projectsApi } from '@/api/projects';
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

export function ProjectsPage() {
  const navigate = useNavigate();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
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
      <div className="flex items-center justify-between mb-8">
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

      {!projects || projects.length === 0 ? (
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
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
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      STATUS_COLORS[project.status] || STATUS_COLORS.DRAFT
                    }`}
                  >
                    {STATUS_LABELS[project.status] || project.status}
                  </span>
                </div>

                <h3 className="font-semibold mb-2 line-clamp-2">{project.name}</h3>

                <div className="space-y-1.5 text-sm text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>
                      {project.createdBy.firstName} {project.createdBy.lastName}
                    </span>
                  </div>
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

