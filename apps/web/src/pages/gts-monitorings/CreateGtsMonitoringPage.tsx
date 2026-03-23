import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Upload, FileSpreadsheet } from 'lucide-react';
import type { AxiosError } from 'axios';
import { gtsMonitoringsApi } from '@/api/gts-monitorings';
import { Button, Input, Card, CardContent } from '@/components/ui';

export function CreateGtsMonitoringPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);

  const getErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<{ message?: string | string[] }>;
    const apiMessage = axiosError.response?.data?.message;
    if (Array.isArray(apiMessage)) return apiMessage.join(', ');
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    if (error instanceof Error && error.message) return error.message;
    return 'Произошла ошибка';
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('year', String(year));
      if (file) formData.append('file', file);
      return gtsMonitoringsApi.create(formData);
    },
    onSuccess: (data) => {
      navigate(`/gts-monitorings/${data.id}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
    e.target.value = '';
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/gts-monitorings')}
          className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Создать мониторинг ГТС</h1>
          <p className="text-[var(--text-secondary)] text-sm">Загрузите Excel с перечнем ГТС</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Название</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Мониторинг ГТС Курской области 2025"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Год</label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
              min={2020}
              max={2030}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Excel-файл с данными ГТС
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <FileSpreadsheet className="w-5 h-5 text-green-400 shrink-0" />
                <span className="flex-1 truncate text-sm">{file.name}</span>
                <button
                  onClick={() => setFile(null)}
                  className="text-xs text-[var(--text-secondary)] hover:text-red-400"
                >
                  Удалить
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-[var(--border-color)] hover:border-primary-500/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span>Выбрать файл .xlsx</span>
              </button>
            )}
            <p className="text-xs text-[var(--text-secondary)] mt-1.5">
              Таблица с колонками: №, Водоток, Населённый пункт, Год, Объём, Площадь, Уровень безопасности, Собственник, Координаты
            </p>
          </div>

          {createMutation.isError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {getErrorMessage(createMutation.error)}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => navigate('/gts-monitorings')} className="flex-1">
              Отмена
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              isLoading={createMutation.isPending}
              disabled={!name.trim()}
              className="flex-1"
            >
              Создать
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
