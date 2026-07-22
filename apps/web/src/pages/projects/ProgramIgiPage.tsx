import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Upload,
  Trash2,
  Save,
  Download,
  MapPin,
  Loader2,
  Info,
  FileText,
} from 'lucide-react';
import { projectsApi } from '@/api/projects';
import { Button, Input, Card, CardContent } from '@/components/ui';

const CADASTRAL_REGEX = /^\d{2}:\d{2}:\d{6,7}:\d{1,5}$/;

const formatCadastralNumber = (value: string, prevValue: string): string => {
  const cleaned = value.replace(/[^\d:]/g, '');
  const colonCount = (cleaned.match(/:/g) || []).length;
  const prevColonCount = (prevValue.match(/:/g) || []).length;
  const isPaste =
    colonCount >= 3 ||
    cleaned.replace(/:/g, '').length - prevValue.replace(/:/g, '').length > 3;

  if (isPaste && colonCount >= 3) {
    const parts = cleaned.split(':');
    const formatted = [
      parts[0]?.replace(/\D/g, '').slice(0, 2) || '',
      parts[1]?.replace(/\D/g, '').slice(0, 2) || '',
      parts[2]?.replace(/\D/g, '').slice(0, 7) || '',
      parts[3]?.replace(/\D/g, '').slice(0, 5) || '',
    ];

    let result = formatted[0];
    if (formatted[1]) result += ':' + formatted[1];
    if (formatted[2]) result += ':' + formatted[2];
    if (formatted[3]) result += ':' + formatted[3];
    return result;
  }

  if (colonCount > prevColonCount) {
    const parts = cleaned.split(':');
    const limits = [2, 2, 7, 5];
    const formatted = parts
      .slice(0, 4)
      .map((p, i) => p.replace(/\D/g, '').slice(0, limits[i]));
    return formatted.filter(Boolean).join(':');
  }

  const digits = cleaned.replace(/:/g, '').slice(0, 16);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 4);
  const part3 = digits.slice(4, 11);
  const part4 = digits.slice(11, 16);

  let result = part1;
  if (part2) result += (part1.length === 2 ? ':' : '') + part2;
  if (part3) result += (part2.length === 2 ? ':' : '') + part3;
  if (part4) result += (part3.length === 7 ? ':' : '') + part4;

  return result;
};

const validateCadastralNumber = (value: string): boolean => {
  if (!value) return true;
  return CADASTRAL_REGEX.test(value);
};

export function ProgramIgiPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const sourceInputRef = useRef<HTMLInputElement>(null);

  const [cadastralNumber, setCadastralNumber] = useState('');
  const [cadastralError, setCadastralError] = useState('');
  const [egrnDescription, setEgrnDescription] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });

  const { data: programIgi, isLoading: programLoading } = useQuery({
    queryKey: ['program-igi', id],
    queryFn: () => projectsApi.getProgramIgi(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (programIgi) {
      setCadastralNumber(programIgi.cadastralNumber || '');
      setEgrnDescription(programIgi.egrnDescription || '');
      setHasChanges(false);
    }
  }, [programIgi]);

  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const invalidateProgramQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['program-igi', id] });
    queryClient.invalidateQueries({ queryKey: ['program-iei', id] });
    queryClient.invalidateQueries({ queryKey: ['program-igmi', id] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: { cadastralNumber?: string; egrnDescription?: string }) =>
      projectsApi.updateProgramIgi(id!, data),
    onSuccess: () => {
      invalidateProgramQueries();
      setHasChanges(false);
    },
  });

  const uploadSourceMutation = useMutation({
    mutationFn: (file: File) => projectsApi.uploadProgramIgiSource(id!, file),
    onSuccess: () => {
      invalidateProgramQueries();
      setIsUploadingSource(false);
    },
    onError: () => {
      setIsUploadingSource(false);
      alert('Не удалось загрузить файл подрядчика');
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: () => projectsApi.deleteProgramIgiSource(id!),
    onSuccess: () => {
      invalidateProgramQueries();
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => projectsApi.generateProgramIgi(id!),
    onSuccess: async (result) => {
      setIsGenerating(false);
      invalidateProgramQueries();
      if (result.fileName) {
        await projectsApi.downloadWord(id!, result.fileName);
      }
    },
    onError: (error: unknown) => {
      setIsGenerating(false);
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Ошибка генерации программы ИГИ';
      alert(message);
    },
  });

  const handleSave = () => {
    if (cadastralNumber && !validateCadastralNumber(cadastralNumber)) {
      setCadastralError('Неверный формат кадастрового номера');
      return;
    }
    updateMutation.mutate({
      cadastralNumber: cadastralNumber || undefined,
      egrnDescription: egrnDescription || undefined,
    });
  };

  const handleGenerate = async () => {
    if (!programIgi?.igiSourceFileName) {
      alert('Сначала загрузите Word-файл программы ИГИ от подрядчика');
      return;
    }
    if (hasChanges) {
      if (cadastralNumber && !validateCadastralNumber(cadastralNumber)) {
        setCadastralError('Неверный формат кадастрового номера');
        return;
      }
      await updateMutation.mutateAsync({
        cadastralNumber: cadastralNumber || undefined,
        egrnDescription: egrnDescription || undefined,
      });
    }
    setIsGenerating(true);
    generateMutation.mutate();
  };

  const handleSourceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('Нужен файл .docx');
      e.target.value = '';
      return;
    }
    setIsUploadingSource(true);
    uploadSourceMutation.mutate(file);
    e.target.value = '';
  };

  const handleCadastralChange = (value: string) => {
    const formatted = formatCadastralNumber(value, cadastralNumber);
    setCadastralNumber(formatted);
    setHasChanges(true);
    if (formatted && !validateCadastralNumber(formatted)) {
      setCadastralError('Неверный формат (например 77:06:0009005:10)');
    } else {
      setCadastralError('');
    }
  };

  const markChanged = () => setHasChanges(true);

  if (projectLoading || programLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Проект не найден</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className={`sticky top-0 z-30 rounded-xl py-4 transition-all ${
          isHeaderScrolled ? 'bg-[var(--bg-tertiary)] px-4' : 'bg-[var(--bg-primary)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/projects/${id}`}
              className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Программа ИГИ</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {project.objectName || project.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </Button>
            )}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !programIgi?.igiSourceFileName}
              variant="primary"
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Сгенерировать
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-100">
          Загрузите Word программы ИГИ от подрядчика. Мы подгоним титул и §1 «Общие сведения» под
          канон РЭИ (как в ИЭИ/ИГМИ); остальное содержимое файла не меняется.
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Файл подрядчика (Word)
            </h2>
          </div>

          <input
            ref={sourceInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleSourceSelect}
            className="hidden"
          />

          {programIgi?.igiSourceFileName ? (
            <div className="flex items-center justify-between gap-4 p-4 bg-[var(--bg-tertiary)] rounded-lg">
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-primary)] truncate">
                  {programIgi.igiSourceFileName}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Исходный файл загружен — можно генерировать
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  onClick={() => sourceInputRef.current?.click()}
                  disabled={isUploadingSource}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  {isUploadingSource ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Заменить
                </Button>
                <Button
                  onClick={() => deleteSourceMutation.mutate()}
                  disabled={deleteSourceMutation.isPending}
                  variant="danger"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => sourceInputRef.current?.click()}
              disabled={isUploadingSource}
              className="w-full border-2 border-dashed border-[var(--border-color)] rounded-lg py-10 flex flex-col items-center justify-center gap-3 hover:border-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              {isUploadingSource ? (
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    Загрузить .docx программы ИГИ от подрядчика
                  </span>
                </>
              )}
            </button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Сведения из ЕГРН
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Кадастровый номер участка
              </label>
              <Input
                value={cadastralNumber}
                onChange={(e) => handleCadastralChange(e.target.value)}
                placeholder="77:06:0009005:10"
                className={
                  cadastralError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''
                }
              />
              {cadastralError && <p className="mt-1 text-xs text-red-400">{cadastralError}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Сведения о категории земель и разрешенном использовании
              </label>
              <textarea
                value={egrnDescription}
                onChange={(e) => {
                  setEgrnDescription(e.target.value);
                  markChanged();
                }}
                rows={6}
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {programIgi?.igiGeneratedAt && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Download className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Последняя генерация
              </h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-primary)]">
                  {programIgi.igiGeneratedFileName}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {new Date(programIgi.igiGeneratedAt).toLocaleString('ru-RU')}
                </p>
              </div>
              <Button
                onClick={() =>
                  programIgi.igiGeneratedFileName &&
                  projectsApi.downloadWord(id!, programIgi.igiGeneratedFileName)
                }
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Скачать
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
