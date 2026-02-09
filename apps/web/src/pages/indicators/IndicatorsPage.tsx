import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FlaskConical,
  Plus,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { indicatorsApi, IndicatorProject } from '@/api/indicators';

export function IndicatorsPage() {
  const [projects, setProjects] = useState<IndicatorProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await indicatorsApi.getAll();
      setProjects(data);
    } catch (err) {
      setError('Ошибка загрузки данных');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getIndicatorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      SOIL_CHEMISTRY: 'Грунты',
      WATER_CHEMISTRY: 'Вода',
      SEDIMENT_CHEMISTRY: 'Донные отложения',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Показатели</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Лабораторные показатели по объектам
          </p>
        </div>
        <Link
          to="/indicators/create"
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Добавить показатели</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Projects list */}
      {projects.length === 0 ? (
        <div className="text-center py-12 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
          <FlaskConical className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-4" />
          <h3 className="text-lg font-medium mb-2">Нет показателей</h3>
          <p className="text-[var(--text-secondary)] mb-4">
            Загрузите протокол лабораторных исследований для начала работы
          </p>
          <Link
            to="/indicators/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Добавить показатели</span>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/indicators/${project.id}`}
              className="block p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] hover:border-primary-500/50 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileSpreadsheet className="w-5 h-5 text-primary-400 flex-shrink-0" />
                    <h3 className="font-medium truncate">{project.name}</h3>
                    {project.documentNumber && (
                      <span className="px-2 py-0.5 text-xs bg-[var(--bg-tertiary)] rounded">
                        {project.documentNumber}
                      </span>
                    )}
                  </div>
                  {project.objectAddress && (
                    <p className="text-sm text-[var(--text-secondary)] truncate mb-2">
                      {project.objectAddress}
                    </p>
                  )}

                  {project.indicator && (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="px-2 py-0.5 bg-primary-500/10 text-primary-400 rounded">
                        {getIndicatorTypeLabel(project.indicator.type)}
                      </span>
                      {project.indicator.protocolNumber && (
                        <span className="text-[var(--text-secondary)]">
                          Протокол: {project.indicator.protocolNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        {project.indicator.matchedSampleCount ===
                        project.indicator.sampleCount ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                        )}
                        <span className="text-[var(--text-secondary)]">
                          {project.indicator.matchedSampleCount}/
                          {project.indicator.sampleCount} проб сопоставлено
                        </span>
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-primary-400 transition-colors flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
