import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Download,
  CheckCircle,
  AlertCircle,
  MapPin,
  Building2,
  Info,
  RefreshCw,
  User,
  Phone,
} from 'lucide-react';
import {
  projectsApi,
  type InquiryType,
  type GeneratedInquiryFile,
} from '@/api/projects';
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '@/components/ui';

// ID справок ЦГМС (для показа поля хим. веществ)
const CGMS_INQUIRY_IDS = ['CGMS_CLIMATE', 'CGMS_CLIMATE_MO'];

// ID справок требующих кадастровые кварталы (МО)
const CADASTRAL_INQUIRY_IDS = ['GU_KN_MO', 'MSH_VETERINARY', 'VODOKANAL', 'MVK_ZSO_MO', 'ADMINISTRATION', 'KLH', 'MIN_ECOLOGY_ZSO'];

// ID справки Администрация (требует название администрации)
const ADMINISTRATION_INQUIRY_ID = 'ADMINISTRATION';

// Тип для исполнителя
interface Executor {
  name: string;
  phone: string;
}

// Форматирование телефона
function formatPhone(value: string): string {
  // Оставляем только цифры
  const digits = value.replace(/\D/g, '');
  
  // Форматируем как +7 XXX XXX-XXXX
  if (digits.length === 0) return '';
  if (digits.length <= 1) return `+${digits}`;
  if (digits.length <= 4) return `+${digits.slice(0, 1)} ${digits.slice(1)}`;
  if (digits.length <= 7) return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4)}`;
  return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
}

// Валидация телефона (минимум 11 цифр для российского номера)
function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 11;
}

export function InquiryRequestsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Состояние выбранных справок
  const [selectedInquiries, setSelectedInquiries] = useState<Set<string>>(new Set());
  
  // Дополнительные данные для заполнения
  const [additionalData, setAdditionalData] = useState<Record<string, string>>({});
  
  // Исполнитель (ФИО + телефон)
  const [executor, setExecutor] = useState<Executor>({ name: '', phone: '' });

  // Загрузка проекта
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });

  // Загрузка доступных справок
  const { data: availableData, isLoading: availableLoading } = useQuery({
    queryKey: ['inquiry-available', id],
    queryFn: () => projectsApi.getAvailableInquiries(id!),
    enabled: !!id,
  });

  // Загрузка текущего запроса справок
  const { data: inquiryRequest, isLoading: inquiryLoading } = useQuery({
    queryKey: ['inquiry-request', id],
    queryFn: () => projectsApi.getInquiryRequest(id!),
    enabled: !!id,
  });

  // Инициализация состояния из загруженных данных
  useEffect(() => {
    if (inquiryRequest) {
      setSelectedInquiries(new Set(inquiryRequest.selectedInquiries));
      const data = inquiryRequest.additionalData || {};
      setAdditionalData(data);
      // Загружаем исполнителя из сохранённых данных
      if (data.executor) {
        try {
          const parsed = JSON.parse(data.executor);
          if (parsed && typeof parsed === 'object') {
            setExecutor(parsed);
          }
        } catch {
          // ignore
        }
      }
    }
  }, [inquiryRequest]);

  // Проверяем нужно ли показывать поле хим. веществ
  const showChemicals = Array.from(selectedInquiries).some((id) =>
    CGMS_INQUIRY_IDS.includes(id),
  );

  // Проверяем нужно ли показывать поле кадастровых кварталов (для МО)
  const showCadastral = Array.from(selectedInquiries).some((id) =>
    CADASTRAL_INQUIRY_IDS.includes(id),
  );

  // Проверяем нужно ли показывать поле названия администрации
  const showAdministration = selectedInquiries.has(ADMINISTRATION_INQUIRY_ID);

  // Собираем данные для сохранения
  const getDataToSave = () => {
    return {
      selectedInquiries: Array.from(selectedInquiries),
      additionalData: {
        ...additionalData,
        executor: JSON.stringify(executor),
      },
    };
  };

  // Мутация для сохранения выбора
  const saveMutation = useMutation({
    mutationFn: () => projectsApi.updateInquiryRequest(id!, getDataToSave()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiry-request', id] });
    },
  });

  // Мутация для генерации справок
  const generateMutation = useMutation({
    mutationFn: async () => {
      // Сначала сохраняем данные
      await projectsApi.updateInquiryRequest(id!, getDataToSave());
      // Затем генерируем
      return projectsApi.generateInquiries(id!, Array.from(selectedInquiries));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inquiry-request', id] });
    },
  });

  // Переключение выбора справки
  const toggleInquiry = (inquiryId: string) => {
    setSelectedInquiries((prev) => {
      const next = new Set(prev);
      if (next.has(inquiryId)) {
        next.delete(inquiryId);
      } else {
        next.add(inquiryId);
      }
      return next;
    });
  };

  // Выбрать все
  const selectAll = () => {
    if (availableData?.inquiries) {
      setSelectedInquiries(new Set(availableData.inquiries.map((i) => i.id)));
    }
  };

  // Снять выбор со всех
  const deselectAll = () => {
    setSelectedInquiries(new Set());
  };

  // Обновление дополнительных данных
  const updateAdditionalData = (key: string, value: string) => {
    setAdditionalData((prev) => ({ ...prev, [key]: value }));
  };

  const isLoading = projectLoading || availableLoading || inquiryLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project || !availableData) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Объект не найден</p>
      </div>
    );
  }

  const inquiries = availableData.inquiries;
  const generatedFiles = inquiryRequest?.generatedFiles || [];

  // Проверка возможности генерации
  const hasValidExecutor = executor.name.trim() && isValidPhone(executor.phone);
  const canGenerate =
    selectedInquiries.size > 0 &&
    additionalData.requestNumberMiddle?.trim() &&
    additionalData.requestDate &&
    hasValidExecutor;

  return (
    <div className="max-w-4xl animate-fade-in">
      {/* Навигация */}
      <div className="mb-6">
        <Link
          to={`/projects/${id}`}
          className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к объекту
        </Link>
      </div>

      {/* Заголовок */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-teal-500/20 flex items-center justify-center">
            <FileText className="w-7 h-7 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Запросы справок</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {project.objectName || project.name}
            </p>
          </div>
        </div>
      </div>

      {/* Информация о регионе */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 p-4 bg-[var(--bg-tertiary)] rounded-lg">
            <MapPin className="w-5 h-5 text-teal-400" />
            <div className="flex-1">
              <p className="text-sm text-[var(--text-secondary)]">
                Регион определён по адресу объекта
              </p>
              <p className="font-medium text-teal-400">{availableData.regionName}</p>
            </div>
            {availableData.region === 'MOSCOW' ? (
              <Building2 className="w-6 h-6 text-teal-400/50" />
            ) : (
              <MapPin className="w-6 h-6 text-teal-400/50" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Выбор справок */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Выберите справки для генерации</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={selectAll}>
              Выбрать все
            </Button>
            <Button size="sm" variant="ghost" onClick={deselectAll}>
              Снять все
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {inquiries.map((inquiry) => (
              <InquiryCheckbox
                key={inquiry.id}
                inquiry={inquiry}
                isSelected={selectedInquiries.has(inquiry.id)}
                onToggle={() => toggleInquiry(inquiry.id)}
                generatedFile={generatedFiles.find((f) => f.inquiryId === inquiry.id)}
                onDownload={() => {
                  const file = generatedFiles.find((f) => f.inquiryId === inquiry.id);
                  if (file) {
                    projectsApi.downloadInquiry(id!, file.fileName);
                  }
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Дополнительные данные — только если выбраны справки */}
      {selectedInquiries.size > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-teal-400" />
              Данные для запросов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Номер и дата */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">
                    Номер (средняя часть)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-secondary)]">ЭА-1-</span>
                    <Input
                      value={additionalData.requestNumberMiddle || ''}
                      onChange={(e) => updateAdditionalData('requestNumberMiddle', e.target.value)}
                      placeholder="201"
                      className="w-24"
                    />
                    <span className="text-sm text-[var(--text-secondary)]">
                      -{new Date().getFullYear().toString().slice(-2)}-N
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    N — порядковый номер справки
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">
                    Дата запроса
                  </label>
                  <input
                    type="date"
                    value={additionalData.requestDate || ''}
                    onChange={(e) => updateAdditionalData('requestDate', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Исполнитель */}
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Исполнитель
                </label>
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[var(--text-secondary)]" />
                    <Input
                      value={executor.name}
                      onChange={(e) => setExecutor({ ...executor, name: e.target.value })}
                      placeholder="ФИО исполнителя"
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[var(--text-secondary)]" />
                    <Input
                      value={executor.phone}
                      onChange={(e) => setExecutor({ ...executor, phone: formatPhone(e.target.value) })}
                      placeholder="+7 XXX XXX-XXXX"
                      className={`flex-1 ${executor.phone && !isValidPhone(executor.phone) ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {executor.phone && !isValidPhone(executor.phone) && (
                    <p className="text-xs text-red-400 ml-6">Введите полный номер телефона</p>
                  )}
                </div>
              </div>

              {/* Хим. вещества — только для ЦГМС */}
              {showChemicals && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <label className="block text-sm font-medium text-amber-400 mb-2">
                    Химические вещества для ЦГМС
                  </label>
                  <textarea
                    value={additionalData.chemicals || ''}
                    onChange={(e) => updateAdditionalData('chemicals', e.target.value)}
                    placeholder="Перечислите химические вещества для запроса фоновых концентраций..."
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] min-h-[100px]"
                  />
                </div>
              )}

              {/* Кадастровые кварталы — для справок МО */}
              {showCadastral && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <label className="block text-sm font-medium text-purple-400 mb-2">
                    Кадастровые кварталы
                  </label>
                  <textarea
                    value={additionalData.cadastralNumbers || ''}
                    onChange={(e) => updateAdditionalData('cadastralNumbers', e.target.value)}
                    placeholder="50:24:0070101, 50:24:0070214, 50:24:0070608..."
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] min-h-[80px]"
                  />
                  <p className="text-xs text-purple-400/70 mt-1">
                    Укажите кадастровые кварталы через запятую
                  </p>
                </div>
              )}

              {/* Название администрации — для справки Администрация */}
              {showAdministration && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <label className="block text-sm font-medium text-blue-400 mb-2">
                    Название администрации (получатель)
                  </label>
                  <Input
                    value={additionalData.administrationName || ''}
                    onChange={(e) => updateAdditionalData('administrationName', e.target.value)}
                    placeholder="Администрация г.Куровское, Орехово-Зуевского г.о., Московской обл."
                  />
                  <p className="text-xs text-blue-400/70 mt-1">
                    Укажите полное название администрации муниципального образования
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Кнопки действий */}
      <div className="flex items-center justify-between gap-4 p-4 bg-[var(--bg-secondary)] rounded-xl sticky bottom-4">
        <div className="text-sm text-[var(--text-secondary)]">
          Выбрано справок: <span className="font-medium text-teal-400">{selectedInquiries.size}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => saveMutation.mutate()}
            isLoading={saveMutation.isPending}
            disabled={selectedInquiries.size === 0}
          >
            Сохранить выбор
          </Button>
          <Button
            onClick={() => generateMutation.mutate()}
            isLoading={generateMutation.isPending}
            disabled={!canGenerate}
            title={!canGenerate ? 'Заполните номер, дату и исполнителя' : ''}
          >
            <RefreshCw className="w-4 h-4" />
            Сгенерировать ({selectedInquiries.size})
          </Button>
        </div>
      </div>

      {/* Результат генерации */}
      {generateMutation.isSuccess && (
        <div className="mt-4 p-4 bg-teal-500/10 border border-teal-500/20 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-teal-400" />
            <div>
              <p className="font-medium text-teal-400">Справки сгенерированы</p>
              <p className="text-sm text-[var(--text-secondary)]">
                Сгенерировано файлов: {generateMutation.data?.generatedFiles.length}
              </p>
            </div>
          </div>
          {generateMutation.data?.errors && generateMutation.data.errors.length > 0 && (
            <div className="mt-3 p-3 bg-red-500/10 rounded-lg">
              <p className="text-sm text-red-400 font-medium">Ошибки при генерации:</p>
              <ul className="mt-1 text-sm text-red-400/80">
                {generateMutation.data.errors.map((err, i) => (
                  <li key={i}>• {err.inquiryId}: {err.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {generateMutation.isError && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">Ошибка при генерации справок</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Компонент чекбокса справки
function InquiryCheckbox({
  inquiry,
  isSelected,
  onToggle,
  generatedFile,
  onDownload,
}: {
  inquiry: InquiryType;
  isSelected: boolean;
  onToggle: () => void;
  generatedFile?: GeneratedInquiryFile;
  onDownload: () => void;
}) {
  return (
    <div
      className={`
        flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer
        ${isSelected
          ? 'bg-teal-500/10 border-teal-500/30'
          : 'bg-[var(--bg-tertiary)] border-transparent hover:border-[var(--border-primary)]'
        }
      `}
      onClick={onToggle}
    >
      <div className="flex items-center gap-4">
        {/* Чекбокс */}
        <div
          className={`
            w-5 h-5 rounded border-2 flex items-center justify-center transition-all
            ${isSelected
              ? 'bg-teal-500 border-teal-500'
              : 'border-[var(--border-primary)]'
            }
          `}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6L5 9L10 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {/* Информация о справке */}
        <div>
          <p className="font-medium">{inquiry.shortName}</p>
          <p className="text-sm text-[var(--text-secondary)]">{inquiry.description}</p>
        </div>
      </div>

      {/* Кнопка скачивания если файл сгенерирован */}
      {generatedFile && (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          <span className="ml-1 text-xs text-[var(--text-secondary)]">
            {new Date(generatedFile.generatedAt).toLocaleDateString('ru')}
          </span>
        </Button>
      )}
    </div>
  );
}

