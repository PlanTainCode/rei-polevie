import { useState, useEffect, useRef } from 'react';
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
  Upload,
  X,
  Paperclip,
  Eye,
  Mail,
  Send,
  Loader2,
} from 'lucide-react';
import {
  projectsApi,
  type InquiryType,
  type GeneratedInquiryFile,
} from '@/api/projects';
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '@/components/ui';

// Компонент модального окна для просмотра PDF
function PdfViewerModal({
  isOpen,
  onClose,
  blobUrl,
  fileName,
  isLoading,
  onDownload,
}: {
  isOpen: boolean;
  onClose: () => void;
  blobUrl: string | null;
  fileName: string;
  isLoading: boolean;
  onDownload: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-teal-400" />
          <span className="font-medium truncate max-w-md">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onDownload}
          >
            <Download className="w-4 h-4" />
            Скачать
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full" />
          </div>
        ) : blobUrl ? (
          <iframe
            src={blobUrl}
            className="w-full h-full rounded-lg bg-white"
            title={fileName}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            Не удалось загрузить PDF
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 text-center text-sm text-[var(--text-secondary)]">
        Нажмите <kbd className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-xs">Esc</kbd> или кнопку закрытия чтобы выйти
      </div>
    </div>
  );
}

// Компонент модального окна для отправки email
function SendEmailModal({
  isOpen,
  onClose,
  inquiryName,
  defaultEmail,
  onSend,
  isSending,
}: {
  isOpen: boolean;
  onClose: () => void;
  inquiryName: string;
  defaultEmail: string;
  onSend: (email: string) => void;
  isSending: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail);

  useEffect(() => {
    setEmail(defaultEmail);
  }, [defaultEmail]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSending) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, isSending]);

  if (!isOpen) return null;

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)] w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-teal-400" />
            <span className="font-medium">Отправить на email</span>
          </div>
          <button
            onClick={onClose}
            disabled={isSending}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-1">Справка:</p>
            <p className="font-medium">{inquiryName}</p>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2">
              Email получателя
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.ru"
              disabled={isSending}
              className={!isValidEmail && email ? 'border-red-500' : ''}
            />
            {!isValidEmail && email && (
              <p className="text-xs text-red-400 mt-1">Введите корректный email адрес</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-primary)]">
          <Button variant="secondary" onClick={onClose} disabled={isSending}>
            Отмена
          </Button>
          <Button
            onClick={() => onSend(email)}
            disabled={!isValidEmail || isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Отправить
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

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
  
  // PDF приложение для объединения
  const [attachmentPdf, setAttachmentPdf] = useState<File | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // Состояние для просмотра PDF
  const [pdfViewer, setPdfViewer] = useState<{
    isOpen: boolean;
    blobUrl: string | null;
    fileName: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    blobUrl: null,
    fileName: '',
    isLoading: false,
  });

  // Открыть просмотр PDF
  const openPdfViewer = async (fileName: string) => {
    setPdfViewer({ isOpen: true, blobUrl: null, fileName, isLoading: true });
    try {
      const blobUrl = await projectsApi.getInquiryPdfBlobUrl(id!, fileName);
      setPdfViewer((prev) => ({ ...prev, blobUrl, isLoading: false }));
    } catch {
      setPdfViewer((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // Закрыть просмотр PDF
  const closePdfViewer = () => {
    // Освобождаем blob URL
    if (pdfViewer.blobUrl) {
      window.URL.revokeObjectURL(pdfViewer.blobUrl);
    }
    setPdfViewer({ isOpen: false, blobUrl: null, fileName: '', isLoading: false });
  };

  // Состояние для отправки email
  const [emailModal, setEmailModal] = useState<{
    isOpen: boolean;
    inquiryId: string;
    inquiryName: string;
    defaultEmail: string;
  }>({
    isOpen: false,
    inquiryId: '',
    inquiryName: '',
    defaultEmail: '',
  });

  // Уведомление об отправке
  const [emailNotification, setEmailNotification] = useState<{
    show: boolean;
    success: boolean;
    message: string;
  }>({ show: false, success: false, message: '' });

  // Мутация для отправки email
  const sendEmailMutation = useMutation({
    mutationFn: async ({ inquiryId, email }: { inquiryId: string; email: string }) => {
      return projectsApi.sendInquiryEmail(id!, inquiryId, email);
    },
    onSuccess: (data) => {
      setEmailModal((prev) => ({ ...prev, isOpen: false }));
      if (data.success) {
        setEmailNotification({
          show: true,
          success: true,
          message: 'Письмо успешно отправлено!',
        });
      } else {
        setEmailNotification({
          show: true,
          success: false,
          message: data.error || 'Ошибка отправки письма',
        });
      }
      // Скрыть уведомление через 5 секунд
      setTimeout(() => setEmailNotification((prev) => ({ ...prev, show: false })), 5000);
    },
    onError: (error: Error) => {
      setEmailModal((prev) => ({ ...prev, isOpen: false }));
      setEmailNotification({
        show: true,
        success: false,
        message: error.message || 'Ошибка отправки',
      });
      setTimeout(() => setEmailNotification((prev) => ({ ...prev, show: false })), 5000);
    },
  });

  // Открыть модалку отправки email
  const openEmailModal = (inquiry: InquiryType) => {
    setEmailModal({
      isOpen: true,
      inquiryId: inquiry.id,
      inquiryName: inquiry.shortName,
      defaultEmail: inquiry.email || '',
    });
  };

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
      // Затем генерируем (с PDF приложением если есть)
      return projectsApi.generateInquiries(
        id!,
        Array.from(selectedInquiries),
        attachmentPdf || undefined,
      );
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
      {/* Модальное окно просмотра PDF */}
      <PdfViewerModal
        isOpen={pdfViewer.isOpen}
        onClose={closePdfViewer}
        blobUrl={pdfViewer.blobUrl}
        fileName={pdfViewer.fileName}
        isLoading={pdfViewer.isLoading}
        onDownload={() => {
          if (pdfViewer.fileName) {
            projectsApi.downloadInquiry(id!, pdfViewer.fileName);
          }
        }}
      />

      {/* Модальное окно отправки email */}
      <SendEmailModal
        isOpen={emailModal.isOpen}
        onClose={() => setEmailModal((prev) => ({ ...prev, isOpen: false }))}
        inquiryName={emailModal.inquiryName}
        defaultEmail={emailModal.defaultEmail}
        onSend={(email) => sendEmailMutation.mutate({ inquiryId: emailModal.inquiryId, email })}
        isSending={sendEmailMutation.isPending}
      />

      {/* Уведомление об отправке email */}
      {emailNotification.show && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in ${
            emailNotification.success
              ? 'bg-teal-500/20 border border-teal-500/30'
              : 'bg-red-500/20 border border-red-500/30'
          }`}
        >
          {emailNotification.success ? (
            <CheckCircle className="w-5 h-5 text-teal-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          <span className={emailNotification.success ? 'text-teal-400' : 'text-red-400'}>
            {emailNotification.message}
          </span>
          <button
            onClick={() => setEmailNotification((prev) => ({ ...prev, show: false }))}
            className="ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                onPreview={() => {
                  const file = generatedFiles.find((f) => f.inquiryId === inquiry.id);
                  if (file) {
                    openPdfViewer(file.fileName);
                  }
                }}
                onSendEmail={() => openEmailModal(inquiry)}
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

              {/* PDF приложение */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <label className="block text-sm font-medium text-emerald-400 mb-2">
                  <Paperclip className="w-4 h-4 inline mr-1" />
                  PDF приложение (опционально)
                </label>
                <p className="text-xs text-emerald-400/70 mb-3">
                  Загрузите PDF с альбомной ориентацией — он будет добавлен к каждой справке после конвертации в PDF
                </p>
                
                {attachmentPdf ? (
                  <div className="flex items-center gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
                    <FileText className="w-5 h-5 text-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachmentPdf.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {(attachmentPdf.size / 1024 / 1024).toFixed(2)} МБ
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAttachmentPdf(null)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-emerald-500/30 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-colors"
                    onClick={() => pdfInputRef.current?.click()}
                  >
                    <Upload className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm text-emerald-400">Выбрать PDF файл</span>
                  </div>
                )}
                
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAttachmentPdf(file);
                    }
                    // Сбрасываем input для возможности повторного выбора того же файла
                    e.target.value = '';
                  }}
                />
              </div>
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
  onPreview,
  onSendEmail,
}: {
  inquiry: InquiryType;
  isSelected: boolean;
  onToggle: () => void;
  generatedFile?: GeneratedInquiryFile;
  onDownload: () => void;
  onPreview: () => void;
  onSendEmail: () => void;
}) {
  const isPdf = generatedFile?.fileName.toLowerCase().endsWith('.pdf');

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

      {/* Кнопки если файл сгенерирован */}
      {generatedFile && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Кнопка отправки email (только для PDF) */}
          {isPdf && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onSendEmail();
              }}
              title="Отправить на email"
              className="text-amber-400 hover:text-amber-300"
            >
              <Mail className="w-4 h-4" />
            </Button>
          )}
          {/* Кнопка просмотра (только для PDF) */}
          {isPdf && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              title="Просмотреть"
              className="text-teal-400 hover:text-teal-300"
            >
              <Eye className="w-4 h-4" />
            </Button>
          )}
          {/* Кнопка скачивания */}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            title="Скачать"
          >
            <Download className="w-4 h-4" />
            <span className="ml-1 text-xs text-[var(--text-secondary)]">
              {new Date(generatedFile.generatedAt).toLocaleDateString('ru')}
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}

