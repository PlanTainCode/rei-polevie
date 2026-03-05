import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Upload, X, FileText } from 'lucide-react';
import { monitoringsApi } from '@/api/monitorings';
import { Button, Input, Card, CardContent } from '@/components/ui';

interface CreateMonitoringForm {
  name: string;
  objectName?: string;
  objectAddress?: string;
}

const TZ_ACCEPT = '.doc,.docx';

export function CreateMonitoringPage() {
  const [error, setError] = useState<string | null>(null);
  const [tzFile, setTzFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const tzInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateMonitoringForm>();

  const mutation = useMutation({
    mutationFn: async (data: CreateMonitoringForm) => {
      const formData = new FormData();
      formData.append('name', data.name);
      if (data.objectName) formData.append('objectName', data.objectName);
      if (data.objectAddress) formData.append('objectAddress', data.objectAddress);
      if (tzFile) formData.append('tz', tzFile);
      return monitoringsApi.create(formData);
    },
    onSuccess: (monitoring) => {
      queryClient.invalidateQueries({ queryKey: ['monitorings'] });
      navigate(`/monitorings/${monitoring.id}`);
    },
    onError: (err: Error) => {
      setError(err.message || 'Ошибка создания мониторинга');
    },
  });

  const onSubmit = (data: CreateMonitoringForm) => {
    setError(null);
    mutation.mutate(data);
  };

  const validateTzFile = (file: File): boolean => {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'doc' && ext !== 'docx') {
      setError('Разрешены только файлы Word (.doc, .docx)');
      return false;
    }
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateTzFile(file)) {
      setTzFile(file);
      setError(null);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && validateTzFile(file)) {
      setTzFile(file);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const dropZoneClick = () => tzInputRef.current?.click();

  const removeTzFile = () => {
    setTzFile(null);
    if (tzInputRef.current) tzInputRef.current.value = '';
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-500/20 flex items-center justify-center">
          <Activity className="w-8 h-8 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Создание мониторинга</h1>
        <p className="text-[var(--text-secondary)]">
          Заполните данные и загрузите техническое задание
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
              label="Название мониторинга"
              placeholder="Введите название"
              error={errors.name?.message}
              {...register('name', {
                required: 'Название обязательно',
              })}
            />

            <Input
              label="Наименование объекта"
              placeholder="Опционально"
              {...register('objectName')}
            />

            <Input
              label="Адрес"
              placeholder="Опционально"
              {...register('objectAddress')}
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">
                Техническое задание (.doc, .docx)
              </label>
              <input
                ref={tzInputRef}
                type="file"
                accept={TZ_ACCEPT}
                onChange={handleFileSelect}
                className="hidden"
              />
              {tzFile ? (
                <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <FileText className="w-5 h-5 text-primary-400 shrink-0" />
                  <span className="flex-1 truncate text-sm">{tzFile.name}</span>
                  <button
                    type="button"
                    onClick={removeTzFile}
                    className="p-1 hover:bg-red-500/20 rounded text-red-400 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={dropZoneClick}
                  onKeyDown={(e) => e.key === 'Enter' && dropZoneClick()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors flex flex-col items-center gap-2 cursor-pointer
                    ${isDragging
                      ? 'border-primary-500/50 bg-primary-500/10'
                      : 'border-[var(--border-color)] hover:border-primary-500/50'
                    }`}
                >
                  <Upload className="w-8 h-8 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    Перетащите файл сюда или нажмите для загрузки
                  </span>
                </div>
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
