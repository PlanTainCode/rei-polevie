import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, X, FileUp, FileCode2, PenLine } from 'lucide-react';
import type { TzSource } from '@tz-xml';
import { technicalTasksApi } from '@/api/technical-tasks';
import { Button, Card, CardContent, Input } from '@/components/ui';

const SOURCES: { code: TzSource; title: string; description: string; icon: typeof FileText; accept?: string; fileLabel?: string }[] = [
  {
    code: 'WORD',
    title: 'Из ТЗ заказчика',
    description: 'Word или PDF. Данные извлекаются автоматически, затем проверяются в форме.',
    icon: FileText,
    accept: '.doc,.docx,.pdf',
    fileLabel: 'ТЗ заказчика (Word или PDF)',
  },
  {
    code: 'DESIGN_XML',
    title: 'Из задания на проектирование',
    description: 'XML по схеме Минстроя. Объект, адрес, заказчик и документы переносятся без ИИ.',
    icon: FileCode2,
    accept: '.xml',
    fileLabel: 'XML задания на проектирование',
  },
  {
    code: 'SCRATCH',
    title: 'С нуля',
    description: 'Пустая форма с типовыми формулировками. Нужные блоки включаются вручную.',
    icon: PenLine,
  },
];

export function CreateTechnicalTaskPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<TzSource>('WORD');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const current = SOURCES.find((s) => s.code === source)!;
  const needsFile = source !== 'SCRATCH';

  const createMutation = useMutation({
    mutationFn: async () => technicalTasksApi.create({ name, source }, file || undefined),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['technical-tasks'] });
      navigate(`/technical-tasks/${data.id}`);
    },
  });

  const acceptFile = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      setFile(f);
      if (!name) setName(f.name.replace(/\.(docx?|pdf|xml)$/i, ''));
    },
    [name],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      acceptFile(e.dataTransfer.files[0]);
    },
    [acceptFile],
  );

  const canSubmit = name.trim().length > 0 && (!needsFile || !!file);
  const errorMessage = (createMutation.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-500/20 flex items-center justify-center">
          <FileUp className="w-8 h-8 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Новое задание на изыскания</h1>
        <p className="text-[var(--text-secondary)]">XML по схеме Минстроя. Выберите, откуда взять вводные.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3 mb-6">
        {SOURCES.map((s) => {
          const Icon = s.icon;
          const active = s.code === source;
          return (
            <button
              key={s.code}
              type="button"
              onClick={() => {
                setSource(s.code);
                setFile(null);
              }}
              className={`text-left p-4 rounded-xl border transition-colors ${active ? 'border-primary-500 bg-primary-500/10' : 'border-[var(--border-color)] hover:border-primary-500/50'}`}
            >
              <Icon className={`w-6 h-6 mb-3 ${active ? 'text-primary-400' : 'text-[var(--text-secondary)]'}`} />
              <div className="font-semibold mb-1">{s.title}</div>
              <div className="text-xs text-[var(--text-secondary)]">{s.description}</div>
            </button>
          );
        })}
      </div>

      {createMutation.isError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{errorMessage || 'Произошла ошибка при создании ТЗ. Попробуйте ещё раз.'}</div>
      )}

      <Card>
        <CardContent className="py-6 space-y-6">
          <Input label="Название ТЗ" value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: ЗИИ Синдика, корпус 3" />

          {needsFile && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">{current.fileLabel}</label>
              <input ref={fileInputRef} type="file" accept={current.accept} onChange={(e) => acceptFile(e.target.files?.[0])} className="hidden" />
              {file ? (
                <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <FileText className="w-5 h-5 text-primary-400" />
                  <div className="flex-1 min-w-0">
                    <span className="truncate text-sm block">{file.name}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button type="button" onClick={() => setFile(null)} className="p-1 hover:bg-red-500/20 rounded text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full p-6 border-2 border-dashed rounded-lg transition-colors flex flex-col items-center gap-2 ${isDragOver ? 'border-primary-500 bg-primary-500/10' : 'border-[var(--border-color)] hover:border-primary-500/50'}`}
                >
                  <Upload className="w-6 h-6 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">{isDragOver ? 'Отпустите файл' : 'Нажмите или перетащите файл'}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{current.accept}</span>
                </button>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate('/technical-tasks')}>
              Отмена
            </Button>
            <Button className="flex-1" onClick={() => createMutation.mutate()} disabled={!canSubmit} isLoading={createMutation.isPending}>
              {source === 'WORD' ? 'Создать и извлечь данные' : 'Создать'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
