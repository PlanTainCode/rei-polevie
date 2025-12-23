import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, X, FileUp } from 'lucide-react';
import { technicalTasksApi } from '@/api/technical-tasks';
import { Button, Card, CardContent, Input } from '@/components/ui';

export function CreateTechnicalTaskPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      return technicalTasksApi.create({ name }, file || undefined);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['technical-tasks'] });
      navigate(`/technical-tasks/${data.id}`);
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFile(droppedFile)) {
      setFile(droppedFile);
      if (!name) {
        // Автозаполнение имени из файла
        const fileName = droppedFile.name.replace(/\.(docx?|pdf)$/i, '');
        setName(fileName);
      }
    }
  }, [name]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidFile(selectedFile)) {
      setFile(selectedFile);
      if (!name) {
        const fileName = selectedFile.name.replace(/\.(docx?|pdf)$/i, '');
        setName(fileName);
      }
    }
  }, [name]);

  const isValidFile = (file: File): boolean => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/pdf',
    ];
    return validTypes.includes(file.type);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canSubmit = name.trim().length > 0;

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-500/20 flex items-center justify-center">
          <FileUp className="w-8 h-8 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Создание ТЗ</h1>
        <p className="text-[var(--text-secondary)]">
          Загрузите ТЗ заказчика для преобразования
        </p>
      </div>

      {createMutation.isError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          Произошла ошибка при создании ТЗ. Попробуйте ещё раз.
        </div>
      )}

      <Card>
        <CardContent className="py-6 space-y-6">
          {/* Название */}
          <Input
            label="Название ТЗ"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введите название или загрузите файл..."
          />

          {/* Зона загрузки файла */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
              Файл ТЗ заказчика (Word или PDF)
            </label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".doc,.docx,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {file ? (
              <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <FileText className="w-5 h-5 text-primary-400" />
                <div className="flex-1 min-w-0">
                  <span className="truncate text-sm block">{file.name}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{formatFileSize(file.size)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1 hover:bg-red-500/20 rounded text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  w-full p-6 border-2 border-dashed rounded-lg transition-colors flex flex-col items-center gap-2
                  ${isDragOver 
                    ? 'border-primary-500 bg-primary-500/10' 
                    : 'border-[var(--border-color)] hover:border-primary-500/50'
                  }
                `}
              >
                <Upload className="w-6 h-6 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">
                  {isDragOver ? 'Отпустите файл' : 'Нажмите или перетащите файл'}
                </span>
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span>.docx</span>
                  <span>.doc</span>
                  <span>.pdf</span>
                </div>
              </button>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => navigate('/technical-tasks')}
            >
              Отмена
            </Button>
            <Button
              className="flex-1"
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit}
              isLoading={createMutation.isPending}
            >
              Создать
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


