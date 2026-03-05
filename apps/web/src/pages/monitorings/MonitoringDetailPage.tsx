import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Beaker,
  Camera,
  Trash2,
  Save,
  Upload,
  FileText,
  ArrowRight,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { monitoringsApi } from '@/api/monitorings';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

export function MonitoringDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tzInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [objectName, setObjectName] = useState('');
  const [objectAddress, setObjectAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [actType, setActType] = useState<'water' | 'sediment'>('water');
  const [actDate, setActDate] = useState(() =>
    new Date().toISOString().split('T')[0],
  );
  const [tzFile, setTzFile] = useState<File | null>(null);

  const { data: monitoring, isLoading } = useQuery({
    queryKey: ['monitoring', id],
    queryFn: () => monitoringsApi.getById(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (monitoring) {
      setName(monitoring.name ?? '');
      setObjectName(monitoring.objectName ?? '');
      setObjectAddress(monitoring.objectAddress ?? '');
      setCustomerName(monitoring.customerName ?? '');
    }
  }, [monitoring]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('objectName', objectName);
      formData.append('objectAddress', objectAddress);
      formData.append('customerName', customerName);
      if (tzFile) formData.append('tz', tzFile);
      return monitoringsApi.update(id!, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', id] });
      setTzFile(null);
    },
  });

  const generateActMutation = useMutation({
    mutationFn: () =>
      monitoringsApi.generateAct(id!, actType, actDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', id] });
    },
  });

  const uploadTzMutation = useMutation({
    mutationFn: async () => {
      if (!tzFile) throw new Error('Файл не выбран');
      const formData = new FormData();
      formData.append('tz', tzFile);
      return monitoringsApi.update(id!, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring', id] });
      setTzFile(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => monitoringsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitorings'] });
      navigate('/monitorings');
    },
  });

  const handleSave = () => updateMutation.mutate();
  const handleDelete = () => {
    if (window.confirm('Удалить этот мониторинг? Все связанные пробы и фото будут удалены.')) {
      deleteMutation.mutate();
    }
  };

  const hasChanges =
    monitoring &&
    (name !== (monitoring.name ?? '') ||
      objectName !== (monitoring.objectName ?? '') ||
      objectAddress !== (monitoring.objectAddress ?? '') ||
      customerName !== (monitoring.customerName ?? ''));
  const canSave = hasChanges || tzFile;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (!monitoring) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Мониторинг не найден</p>
      </div>
    );
  }

  const probesCount = monitoring._count?.probes ?? 0;
  const photosCount = monitoring._count?.photos ?? 0;

  return (
    <div className="w-full animate-fade-in page-content">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary-500/20 flex items-center justify-center">
            <Beaker className="w-7 h-7 text-primary-400" />
          </div>
          <div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xl font-bold bg-[var(--bg-tertiary)]"
              placeholder="Название мониторинга"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canSave && (
            <Button
              onClick={handleSave}
              isLoading={updateMutation.isPending}
            >
              <Save className="w-4 h-4" />
              Сохранить
            </Button>
          )}
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
            Удалить
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Основные данные</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">
              Наименование объекта
            </label>
            <Input
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
              placeholder="Наименование объекта"
              className="bg-[var(--bg-tertiary)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">
              Адрес
            </label>
            <Input
              value={objectAddress}
              onChange={(e) => setObjectAddress(e.target.value)}
              placeholder="Адрес"
              className="bg-[var(--bg-tertiary)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">
              Наименование и адрес заказчика
            </label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ООО «Компания», г. Москва"
              className="bg-[var(--bg-tertiary)]"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Навигация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to={`/monitorings/${id}/probes`}
              className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group border border-[var(--border-color)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <Beaker className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <p className="font-medium">Пробы</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {probesCount} {probesCount === 1 ? 'проба' : probesCount < 5 ? 'пробы' : 'проб'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-primary-400 transition-colors" />
            </Link>
            <Link
              to={`/monitorings/${id}/photos`}
              className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group border border-[var(--border-color)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium">Фотоматериалы</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {photosCount} фото
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-amber-400 transition-colors" />
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-400" />
            <CardTitle>Генерация актов</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-2">Тип акта</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActType('water')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  actType === 'water'
                    ? 'bg-primary-500/20 text-primary-400 border-primary-500/50'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-primary-500/30'
                }`}
              >
                Вода
              </button>
              <button
                type="button"
                onClick={() => setActType('sediment')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  actType === 'sediment'
                    ? 'bg-primary-500/20 text-primary-400 border-primary-500/50'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-primary-500/30'
                }`}
              >
                Донные отложения
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              Дата отбора
            </label>
            <input
              type="date"
              value={actDate}
              onChange={(e) => setActDate(e.target.value)}
              className="w-full max-w-xs px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
            />
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Метеоусловия подтягиваются автоматически по адресу и дате отбора
          </p>
          <Button
            onClick={() => generateActMutation.mutate()}
            isLoading={generateActMutation.isPending}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Сгенерировать акт
          </Button>
          {generateActMutation.isError && (
            <p className="text-sm text-red-400">
              {(generateActMutation.error as Error)?.message || 'Ошибка генерации акта'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-400" />
            <CardTitle>Техническое задание</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {monitoring.tzFileName ? (
            <p className="text-sm text-[var(--text-primary)] mb-4">
              Файл: {monitoring.tzFileName}
            </p>
          ) : null}
          <input
            ref={tzInputRef}
            type="file"
            accept=".doc,.docx"
            className="hidden"
            onChange={(e) => setTzFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => tzInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              {monitoring.tzFileName ? 'Заменить ТЗ' : 'Загрузить ТЗ'}
            </Button>
            {tzFile && (
              <>
                <span className="text-sm text-primary-400 truncate max-w-[200px]">
                  {tzFile.name}
                </span>
                <Button
                  size="sm"
                  onClick={() => uploadTzMutation.mutate()}
                  isLoading={uploadTzMutation.isPending}
                >
                  Применить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTzFile(null)}
                >
                  Отмена
                </Button>
              </>
            )}
          </div>
          {uploadTzMutation.isError && (
            <p className="text-sm text-red-400 mt-2">Ошибка загрузки файла</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
