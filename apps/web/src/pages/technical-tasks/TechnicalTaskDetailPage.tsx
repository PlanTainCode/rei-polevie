import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  RefreshCw,
  Sparkles,
  Eye,
} from 'lucide-react';
import { technicalTasksApi, type TechnicalTaskStatus } from '@/api/technical-tasks';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { DocxEditor } from '@/components/document-editor';

const STATUS_CONFIG: Record<TechnicalTaskStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  DRAFT: { 
    label: 'Черновик', 
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    icon: Clock
  },
  PROCESSING: { 
    label: 'Обработка AI', 
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    icon: Loader2
  },
  COMPLETED: { 
    label: 'Готово', 
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    icon: CheckCircle2
  },
  ERROR: { 
    label: 'Ошибка', 
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    icon: AlertCircle
  },
};

export function TechnicalTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDocument, setShowDocument] = useState(false);

  const { data: task, isLoading, isError } = useQuery({
    queryKey: ['technical-task', id],
    queryFn: () => technicalTasksApi.getById(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      // Автообновление пока статус PROCESSING
      const data = query.state.data;
      if (data?.status === 'PROCESSING') {
        return 2000; // Каждые 2 секунды
      }
      return false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => technicalTasksApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical-tasks'] });
      navigate('/technical-tasks');
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: () => technicalTasksApi.reprocess(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technical-task', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">ТЗ не найдено</h2>
        <Button variant="secondary" onClick={() => navigate('/technical-tasks')}>
          Вернуться к списку
        </Button>
      </div>
    );
  }

  const status = STATUS_CONFIG[task.status];
  const StatusIcon = status.icon;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
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

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{task.name}</h1>
            <div className="flex items-center gap-4 text-[var(--text-secondary)]">
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                {task.createdBy.firstName} {task.createdBy.lastName}
              </span>
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(task.createdAt).toLocaleDateString('ru', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>

          {task.canDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm('Удалить это ТЗ?')) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
              Удалить
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Статус */}
        <Card>
          <CardHeader>
            <CardTitle>Статус обработки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`
              inline-flex items-center gap-3 px-4 py-3 rounded-xl
              ${status.bgColor}
            `}>
              <StatusIcon className={`w-6 h-6 ${status.color} ${task.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
              <div>
                <div className={`font-semibold ${status.color}`}>
                  {status.label}
                </div>
                {task.status === 'PROCESSING' && (
                  <div className="text-sm text-[var(--text-secondary)]">
                    AI анализирует документ...
                  </div>
                )}
              </div>
            </div>

            {task.status === 'PROCESSING' && (
              <div className="mt-4">
                <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-pulse"
                    style={{ width: '60%' }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Исходный файл */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Исходный файл
            </CardTitle>
          </CardHeader>
          <CardContent>
            {task.sourceFileName ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center">
                      <FileText className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{task.sourceFileName}</div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {task.sourceFileType?.toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => technicalTasksApi.downloadSourceFile(task.id)}
                >
                  <Download className="w-4 h-4" />
                  Скачать исходный файл
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Файл не загружен</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Сгенерированный файл */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Результат обработки
            </CardTitle>
          </CardHeader>
          <CardContent>
            {task.status === 'COMPLETED' && task.generatedFileName ? (
              <div className="space-y-4">
                <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-emerald-400 mb-1">
                        ТЗ успешно сформировано
                      </div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {task.generatedFileName}
                      </div>
                      {task.generatedAt && (
                        <div className="text-xs text-[var(--text-secondary)] mt-1">
                          Сгенерировано: {new Date(task.generatedAt).toLocaleString('ru')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Кнопки действий */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={showDocument ? 'primary' : 'secondary'}
                    onClick={() => setShowDocument(!showDocument)}
                  >
                    <Eye className="w-4 h-4" />
                    {showDocument ? 'Скрыть документ' : 'Открыть документ'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => technicalTasksApi.downloadGeneratedFile(task.id)}
                  >
                    <Download className="w-4 h-4" />
                    Скачать
                  </Button>
                </div>
              </div>
            ) : task.status === 'PROCESSING' ? (
              <div className="text-center py-12">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
                  <div className="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">AI обрабатывает документ</h3>
                <p className="text-[var(--text-secondary)]">
                  Это может занять несколько минут...
                </p>
              </div>
            ) : task.status === 'ERROR' ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-400 mb-2">
                  Ошибка обработки
                </h3>
                <p className="text-[var(--text-secondary)] mb-4">
                  Не удалось обработать документ. Попробуйте перезапустить обработку.
                </p>
                <Button 
                  variant="secondary"
                  onClick={() => reprocessMutation.mutate()}
                  disabled={reprocessMutation.isPending}
                >
                  <RefreshCw className={`w-4 h-4 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} />
                  {reprocessMutation.isPending ? 'Запуск...' : 'Попробовать снова'}
                </Button>
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--text-secondary)]">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Загрузите файл ТЗ для начала обработки</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Просмотр/редактирование документа */}
        {showDocument && task.status === 'COMPLETED' && task.generatedFileName && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  Документ
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDocument(false)}
                >
                  Скрыть
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DocxEditor
                fileUrl={technicalTasksApi.getGeneratedFileUrl(task.id)}
                onDownload={() => technicalTasksApi.downloadGeneratedFile(task.id)}
              />
            </CardContent>
          </Card>
        )}

        {/* Извлечённые данные (если есть) */}
        {task.extractedData && Object.keys(task.extractedData).length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                Извлечённые данные
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ExtractedDataDisplay data={task.extractedData} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Компонент для красивого отображения извлечённых данных
function ExtractedDataDisplay({ data }: { data: Record<string, unknown> }) {
  const FIELD_LABELS: Record<string, string> = {
    objectName: 'Наименование объекта',
    objectLocation: 'Местоположение',
    cadastralNumber: 'Кадастровый номер',
    areaSize: 'Площадь участка',
    contractNumber: 'Номер договора',
    contractDate: 'Дата договора',
    year: 'Год',
    'customer.name': 'Заказчик',
    'customer.address': 'Адрес заказчика',
    'customer.contactName': 'Контактное лицо',
    'customer.contactPhone': 'Телефон',
    'customer.contactEmail': 'Email',
    'objectInfo.purpose': 'Назначение объекта',
    'objectInfo.responsibilityLevel': 'Уровень ответственности',
    'technicalCharacteristics.description': 'Описание объекта',
    'technicalCharacteristics.excavationDepth': 'Глубина земляных работ',
    'technicalCharacteristics.foundationType': 'Тип фундамента',
    'technicalCharacteristics.foundationDepth': 'Глубина заложения',
    reportRequirements: 'Требования к отчётности',
  };

  const SECTION_LABELS: Record<string, string> = {
    surveyTypes: 'Виды изысканий',
    urbanPlanningActivities: 'Виды градостроительной деятельности',
    ecologySurveyWorks: 'Состав экологических работ',
    customer: 'Сведения о заказчике',
    objectInfo: 'Сведения об объекте',
    technicalCharacteristics: 'Технические характеристики',
  };

  const BOOL_LABELS: Record<string, string> = {
    hydrometeorology: 'Гидрометеорология',
    geology: 'Геология',
    ecology: 'Экология',
    architecturalDesign: 'Архитектурно-строительное проектирование',
    construction: 'Строительство',
    reconstruction: 'Реконструкция',
    capitalRepair: 'Капитальный ремонт',
    gammaTerrain: 'МЭД гамма на территории',
    gammaBuilding: 'МЭД гамма в здании',
    radonTerrain: 'Радон на территории',
    radonBuilding: 'ЭРОА радона в здании',
    heavyMetalsSoil: 'Тяжёлые металлы в грунте',
    benzpyrene: 'Бенз(а)пирен',
    oilProducts: 'Нефтепродукты',
    microbiologySoil: 'Микробиология грунта',
    noiseLevel: 'Уровень шума',
    vibration: 'Вибрация',
    emf: 'ЭМП',
  };

  const renderValue = (key: string, value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === '') return null;
    
    if (typeof value === 'boolean') {
      return value ? (
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="w-4 h-4" /> Да
        </span>
      ) : null;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      return (
        <ul className="list-disc list-inside space-y-1">
          {value.map((item, i) => (
            <li key={i} className="text-[var(--text-secondary)]">{String(item)}</li>
          ))}
        </ul>
      );
    }
    
    if (typeof value === 'object') {
      return (
        <div className="space-y-2 pl-4 border-l-2 border-[var(--border-color)]">
          {Object.entries(value as Record<string, unknown>).map(([k, v]) => {
            const rendered = renderValue(k, v);
            if (!rendered) return null;
            return (
              <div key={k}>
                <span className="text-[var(--text-secondary)] text-sm">
                  {BOOL_LABELS[k] || FIELD_LABELS[`${key}.${k}`] || k}:
                </span>
                <div className="mt-1">{rendered}</div>
              </div>
            );
          })}
        </div>
      );
    }
    
    return <span className="text-[var(--text-primary)]">{String(value)}</span>;
  };

  // Группируем поля
  const mainFields = ['objectName', 'objectLocation', 'cadastralNumber', 'areaSize', 'contractNumber', 'year'];
  const sections = ['surveyTypes', 'customer', 'objectInfo', 'technicalCharacteristics', 'ecologySurveyWorks'];

  return (
    <div className="space-y-6">
      {/* Основные поля */}
      <div className="grid gap-4 md:grid-cols-2">
        {mainFields.map((field) => {
          const value = data[field];
          if (!value) return null;
          return (
            <div key={field} className="p-4 rounded-lg bg-[var(--bg-tertiary)]">
              <div className="text-sm text-[var(--text-secondary)] mb-1">
                {FIELD_LABELS[field] || field}
              </div>
              <div className="font-medium">{String(value)}</div>
            </div>
          );
        })}
      </div>

      {/* Секции */}
      {sections.map((section) => {
        const value = data[section];
        if (!value || typeof value !== 'object') return null;
        
        // Проверяем есть ли хотя бы одно значимое поле
        const hasContent = Object.values(value as Record<string, unknown>).some(
          v => v !== null && v !== undefined && v !== '' && v !== false
        );
        if (!hasContent) return null;

        return (
          <div key={section} className="p-4 rounded-lg bg-[var(--bg-tertiary)]">
            <h4 className="font-medium mb-3 text-[var(--text-primary)]">
              {SECTION_LABELS[section] || section}
            </h4>
            {renderValue(section, value)}
          </div>
        );
      })}
    </div>
  );
}


