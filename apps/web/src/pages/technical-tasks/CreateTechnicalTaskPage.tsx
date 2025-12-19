import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  X, 
  Sparkles,
  CheckCircle2,
  FileUp
} from 'lucide-react';
import { technicalTasksApi } from '@/api/technical-tasks';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import { MirrorButton } from '@/components/ui/MirrorButton';

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

  const getFileIcon = () => {
    if (!file) return null;
    if (file.type === 'application/pdf') {
      return <span className="text-red-400">PDF</span>;
    }
    return <span className="text-blue-400">DOC</span>;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canSubmit = name.trim().length > 0;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Заголовок */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/technical-tasks')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к списку
        </Button>
        
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Создание ТЗ
        </h1>
        <p className="text-[var(--text-secondary)]">
          Загрузите ТЗ заказчика для преобразования в ваш формат
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Новое техническое задание
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Название */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Название ТЗ
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название или загрузите файл..."
              className="text-lg"
            />
          </div>

          {/* Зона загрузки файла */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Файл ТЗ заказчика
            </label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".doc,.docx,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative cursor-pointer
                  border-2 border-dashed rounded-xl p-8
                  transition-all duration-300
                  ${isDragOver 
                    ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02]' 
                    : 'border-[var(--border-color)] hover:border-cyan-500/50 hover:bg-[var(--bg-tertiary)]'
                  }
                `}
              >
                <div className="text-center">
                  <div className={`
                    w-16 h-16 mx-auto mb-4 rounded-2xl 
                    flex items-center justify-center
                    transition-all duration-300
                    ${isDragOver 
                      ? 'bg-cyan-500/20 scale-110' 
                      : 'bg-[var(--bg-tertiary)]'
                    }
                  `}>
                    <Upload className={`w-8 h-8 transition-colors ${isDragOver ? 'text-cyan-400' : 'text-[var(--text-secondary)]'}`} />
                  </div>
                  
                  <p className="text-lg font-medium mb-1">
                    {isDragOver ? 'Отпустите файл' : 'Перетащите файл сюда'}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    или нажмите для выбора
                  </p>
                  
                  <div className="flex items-center justify-center gap-3 text-xs text-[var(--text-secondary)]">
                    <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400">.docx</span>
                    <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400">.doc</span>
                    <span className="px-2 py-1 rounded bg-red-500/10 text-red-400">.pdf</span>
                  </div>
                </div>

                {/* Декоративные элементы */}
                <div className="absolute top-4 right-4 opacity-20">
                  <FileUp className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            ) : (
              <div className="relative border border-[var(--border-color)] rounded-xl p-4 bg-[var(--bg-tertiary)]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center">
                    <FileText className="w-7 h-7 text-cyan-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{file.name}</span>
                      {getFileIcon()}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                      <span>{formatFileSize(file.size)}</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Готов к загрузке
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                    className="text-[var(--text-secondary)] hover:text-red-400"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Информация о процессе */}
          <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
            <h4 className="font-medium text-cyan-400 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Как это работает
            </h4>
            <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
              <li>• Загрузите ТЗ заказчика в формате Word или PDF</li>
              <li>• AI извлечёт все данные и сопоставит с вашим шаблоном</li>
              <li>• Проверьте результат и скачайте готовое ТЗ</li>
            </ul>
          </div>

          {/* Кнопка создания */}
          <div className="flex justify-end pt-4">
            <MirrorButton
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Создание...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Создать ТЗ</span>
                </>
              )}
            </MirrorButton>
          </div>

          {/* Ошибка */}
          {createMutation.isError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              Произошла ошибка при создании ТЗ. Попробуйте ещё раз.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


