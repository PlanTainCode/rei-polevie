import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Upload, FileSpreadsheet, Check, X } from 'lucide-react';
import { indicatorsApi, AvailableProject } from '@/api/indicators';

export function CreateIndicatorPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<AvailableProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await indicatorsApi.getAvailableProjects();
      setProjects(data);
    } catch (err) {
      setError('Ошибка загрузки списка объектов');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (
        droppedFile.name.endsWith('.xlsx') ||
        droppedFile.name.endsWith('.xls')
      ) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Поддерживаются только файлы Excel (.xlsx, .xls)');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProjectId) {
      setError('Выберите объект');
      return;
    }

    if (!file) {
      setError('Загрузите файл протокола');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await indicatorsApi.create(selectedProjectId, file);
      navigate(`/indicators/${selectedProjectId}`);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || 'Ошибка при создании показателей';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/indicators"
          className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Добавить показатели</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Загрузите протокол лабораторных исследований
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-4" />
          <h3 className="text-lg font-medium mb-2">Нет доступных объектов</h3>
          <p className="text-[var(--text-secondary)] mb-4">
            Все объекты уже имеют показатели или объекты не созданы
          </p>
          <Link
            to="/projects/create"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            Создать объект
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project selection */}
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
            <label className="block text-sm font-medium mb-2">
              Выберите объект
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg focus:border-primary-500 focus:outline-none"
            >
              <option value="">Выберите объект...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.documentNumber
                    ? `${project.documentNumber} — `
                    : ''}
                  {project.name} ({project.sampleCount} проб)
                </option>
              ))}
            </select>
          </div>

          {/* File upload */}
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
            <label className="block text-sm font-medium mb-2">
              Файл протокола
            </label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-[var(--border-color)] hover:border-primary-500/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-400" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {(file.size / 1024).toFixed(1)} КБ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="p-1 hover:bg-red-500/10 rounded text-red-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 mx-auto text-[var(--text-secondary)] mb-3" />
                  <p className="text-[var(--text-secondary)] mb-2">
                    Перетащите файл сюда или{' '}
                    <label className="text-primary-400 hover:text-primary-300 cursor-pointer">
                      выберите файл
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Поддерживаются файлы Excel (.xlsx, .xls)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Link
              to="/indicators"
              className="px-4 py-2 border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={submitting || !selectedProjectId || !file}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {submitting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>Загрузка...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Создать показатели</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
