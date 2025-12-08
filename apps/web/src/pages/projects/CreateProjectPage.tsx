import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderPlus, Upload, X, FileText } from 'lucide-react';
import { projectsApi } from '@/api/projects';
import { Button, Input, Card, CardContent } from '@/components/ui';

interface CreateProjectForm {
  name: string;
}

export function CreateProjectPage() {
  const [error, setError] = useState<string | null>(null);
  const [tzFile, setTzFile] = useState<File | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const tzInputRef = useRef<HTMLInputElement>(null);
  const orderInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectForm>();

  const mutation = useMutation({
    mutationFn: async (data: CreateProjectForm) => {
      const formData = new FormData();
      formData.append('name', data.name);
      if (tzFile) {
        formData.append('tz', tzFile);
      }
      if (orderFile) {
        formData.append('order', orderFile);
      }
      return projectsApi.create(formData);
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projects/${project.id}`);
    },
    onError: (err: Error) => {
      setError(err.message || 'Ошибка создания объекта');
    },
  });

  const onSubmit = (data: CreateProjectForm) => {
    setError(null);
    mutation.mutate(data);
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (file: File | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      // Проверяем расширение
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext !== 'doc' && ext !== 'docx') {
        setError('Разрешены только файлы Word (.doc, .docx)');
        return;
      }
      setFile(file);
      setError(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-500/20 flex items-center justify-center">
          <FolderPlus className="w-8 h-8 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Создание объекта</h1>
        <p className="text-[var(--text-secondary)]">
          Заполните данные и загрузите документы
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              label="Название объекта"
              placeholder="Например: ЖК «Новые горизонты»"
              error={errors.name?.message}
              {...register('name', {
                required: 'Название обязательно',
              })}
            />

            {/* Загрузка ТЗ */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Техническое задание (Word)
              </label>
              <input
                ref={tzInputRef}
                type="file"
                accept=".doc,.docx"
                onChange={(e) => handleFileSelect(e, setTzFile)}
                className="hidden"
              />
              {tzFile ? (
                <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <FileText className="w-5 h-5 text-primary-400" />
                  <span className="flex-1 truncate text-sm">{tzFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTzFile(null);
                      if (tzInputRef.current) tzInputRef.current.value = '';
                    }}
                    className="p-1 hover:bg-red-500/20 rounded text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => tzInputRef.current?.click()}
                  className="w-full p-4 border-2 border-dashed border-[var(--border-color)] rounded-lg hover:border-primary-500/50 transition-colors flex flex-col items-center gap-2"
                >
                  <Upload className="w-6 h-6 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    Нажмите для загрузки ТЗ
                  </span>
                </button>
              )}
            </div>

            {/* Загрузка поручения */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Поручение (Word)
              </label>
              <input
                ref={orderInputRef}
                type="file"
                accept=".doc,.docx"
                onChange={(e) => handleFileSelect(e, setOrderFile)}
                className="hidden"
              />
              {orderFile ? (
                <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <FileText className="w-5 h-5 text-primary-400" />
                  <span className="flex-1 truncate text-sm">{orderFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderFile(null);
                      if (orderInputRef.current) orderInputRef.current.value = '';
                    }}
                    className="p-1 hover:bg-red-500/20 rounded text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => orderInputRef.current?.click()}
                  className="w-full p-4 border-2 border-dashed border-[var(--border-color)] rounded-lg hover:border-primary-500/50 transition-colors flex flex-col items-center gap-2"
                >
                  <Upload className="w-6 h-6 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    Нажмите для загрузки поручения
                  </span>
                </button>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => navigate(-1)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                className="flex-1"
                isLoading={mutation.isPending}
              >
                Создать
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

