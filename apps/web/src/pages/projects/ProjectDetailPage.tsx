import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderOpen,
  FileText,
  Download,
  Trash2,
  Edit3,
  Save,
  X,
  Upload,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  Building2,
  MapPin,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Target,
  Loader2,
  Beaker,
  Camera,
  ArrowRight,
  Plus,
  GitBranch,
  ExternalLink,
  Send,
} from 'lucide-react';
import { projectsApi, type GenerateExcelResult } from '@/api/projects';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [newTzFile, setNewTzFile] = useState<File | null>(null);
  const [newOrderFile, setNewOrderFile] = useState<File | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    services: true,
    dates: false,
  });
  const [excelResult, setExcelResult] = useState<GenerateExcelResult | null>(null);
  
  // Даты документов
  const [documentDates, setDocumentDates] = useState<{
    ilcRequestDate: string;
    fmbaRequestDate: string;
    samplingDate: string;
  }>({
    ilcRequestDate: '',
    fmbaRequestDate: '',
    samplingDate: '',
  });

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      // Автообновление пока идёт обработка
      const data = query.state.data;
      if (data && !data.processedAt && (data.tzFileUrl || data.orderFileUrl)) {
        return 3000; // каждые 3 секунды
      }
      return false;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (editName && editName !== project?.name) {
        formData.append('name', editName);
      }
      if (newTzFile) {
        formData.append('tz', newTzFile);
      }
      if (newOrderFile) {
        formData.append('order', newOrderFile);
      }
      return projectsApi.update(id!, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setIsEditing(false);
      setNewTzFile(null);
      setNewOrderFile(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
    },
  });

  const generateExcelMutation = useMutation({
    mutationFn: async () => {
      // Сначала сохраняем даты если они заполнены
      const hasAnyDate = documentDates.ilcRequestDate || documentDates.fmbaRequestDate || documentDates.samplingDate;
      if (hasAnyDate) {
        console.log('Saving dates:', documentDates);
        try {
          await projectsApi.setDocumentDates(id!, {
            ilcRequestDate: documentDates.ilcRequestDate || undefined,
            fmbaRequestDate: documentDates.fmbaRequestDate || undefined,
            samplingDate: documentDates.samplingDate || undefined,
          });
          console.log('Dates saved successfully');
        } catch (err) {
          console.error('Error saving dates:', err);
          throw err;
        }
      }
      // Затем генерируем Excel
      return projectsApi.generateExcel(id!);
    },
    onSuccess: (result) => {
      setExcelResult(result);
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
    onError: (error) => {
      console.error('Generate Excel error:', error);
    },
  });

  // Перегенерация из обновленного ТЗ
  const [regenerateTzFile, setRegenerateTzFile] = useState<File | null>(null);
  const regenerateTzInputRef = useRef<HTMLInputElement>(null);

  const regenerateFromTzMutation = useMutation({
    mutationFn: async () => {
      if (!regenerateTzFile) throw new Error('Файл не выбран');
      return projectsApi.regenerateFromTz(id!, regenerateTzFile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setRegenerateTzFile(null);
    },
  });

  // Создание доотбора
  const [showCreateChildModal, setShowCreateChildModal] = useState(false);
  const [childProjectName, setChildProjectName] = useState('');
  const [childOrderFile, setChildOrderFile] = useState<File | null>(null);
  const childOrderInputRef = useRef<HTMLInputElement>(null);

  const createChildMutation = useMutation({
    mutationFn: async () => {
      if (!childOrderFile || !childProjectName) throw new Error('Заполните все поля');
      return projectsApi.createChildProject(id!, childProjectName, childOrderFile);
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setShowCreateChildModal(false);
      setChildProjectName('');
      setChildOrderFile(null);
      navigate(`/projects/${newProject.id}`);
    },
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const startEditing = () => {
    setEditName(project?.name || '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName('');
    setNewTzFile(null);
    setNewOrderFile(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Объект не найден</p>
      </div>
    );
  }

  const isProcessing = !project.processedAt && (project.tzFileUrl || project.orderFileUrl);
  const services = project.services || [];
  const isChildProject = !!project.parentProjectId;
  const hasChildren = project.childProjects && project.childProjects.length > 0;

  return (
    <div className="max-w-4xl animate-fade-in">
      {/* Индикатор доотбора (если это дочерний проект) */}
      {isChildProject && project.parentProject && (
        <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-purple-400" />
          <div className="flex-1">
            <span className="text-sm text-purple-400">Доотбор от объекта:</span>{' '}
            <Link
              to={`/projects/${project.parentProject.id}`}
              className="text-sm font-medium text-purple-400 hover:underline"
            >
              {project.parentProject.name}
            </Link>
          </div>
          <Link
            to={`/projects/${project.parentProject.id}`}
            className="text-purple-400 hover:text-purple-300"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Заголовок */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary-500/20 flex items-center justify-center">
            <FolderOpen className="w-7 h-7 text-primary-400" />
          </div>
          <div>
            {isEditing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-xl font-bold"
              />
            ) : (
              <h1 className="text-2xl font-bold">{project.name}</h1>
            )}
            <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {project.createdBy.firstName} {project.createdBy.lastName}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(project.createdAt).toLocaleDateString('ru')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing}>
                <X className="w-4 h-4" />
                Отмена
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                isLoading={updateMutation.isPending}
              >
                <Save className="w-4 h-4" />
                Сохранить
              </Button>
            </>
          ) : (
            <>
              {project.canEdit && (
                <Button variant="secondary" onClick={startEditing}>
                  <Edit3 className="w-4 h-4" />
                  Редактировать
                </Button>
              )}
              {project.canDelete && (
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm('Удалить этот объект?')) {
                      deleteMutation.mutate();
                    }
                  }}
                  isLoading={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Статус обработки */}
      {isProcessing && (
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <div>
            <p className="font-medium text-blue-400">Обработка документов...</p>
            <p className="text-sm text-[var(--text-secondary)]">
              AI анализирует загруженные файлы. Это может занять до 30 секунд.
            </p>
          </div>
        </div>
      )}

      {/* Файлы */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Документы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ТЗ — не показываем для доотборов (наследуется от родителя) */}
          {!isChildProject && (
            <FileItem
              label="Техническое задание"
              fileName={project.tzFileName}
              onDownload={() =>
                window.open(projectsApi.getFileUrl(project.id, 'tz'), '_blank')
              }
              isEditing={isEditing}
              newFile={newTzFile}
              onFileSelect={(file) => setNewTzFile(file)}
              onClearFile={() => setNewTzFile(null)}
            />
          )}
          <FileItem
            label="Поручение"
            fileName={project.orderFileName}
            onDownload={() =>
              window.open(projectsApi.getFileUrl(project.id, 'order'), '_blank')
            }
            isEditing={isEditing}
            newFile={newOrderFile}
            onFileSelect={(file) => setNewOrderFile(file)}
            onClearFile={() => setNewOrderFile(null)}
          />

          {/* Перегенерация из обновленного ТЗ (только для корневых проектов, не для доотборов) */}
          {!isChildProject && project.processedAt && project.canEdit && (
            <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <RefreshCw className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-amber-400">Обновить данные из ТЗ</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    Загрузите обновленное ТЗ для перегенерации данных объекта. Пробы останутся без изменений.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      ref={regenerateTzInputRef}
                      type="file"
                      accept=".doc,.docx"
                      onChange={(e) => setRegenerateTzFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {regenerateTzFile ? (
                      <>
                        <span className="text-sm text-primary-400 flex-1 truncate">
                          {regenerateTzFile.name}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRegenerateTzFile(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => regenerateFromTzMutation.mutate()}
                          isLoading={regenerateFromTzMutation.isPending}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Применить
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => regenerateTzInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4" />
                        Выбрать файл ТЗ
                      </Button>
                    )}
                  </div>
                  {regenerateFromTzMutation.isError && (
                    <p className="text-sm text-red-400 mt-2">
                      Ошибка при обновлении. Попробуйте снова.
                    </p>
                  )}
                  {regenerateFromTzMutation.isSuccess && (
                    <p className="text-sm text-primary-400 mt-2">
                      Данные успешно обновлены!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Извлечённые данные */}
      {project.processedAt && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Данные объекта</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {project.objectName && (
                <DataField icon={FolderOpen} label="Название объекта" value={project.objectName} />
              )}
              {project.objectAddress && (
                <DataField icon={MapPin} label="Адрес" value={project.objectAddress} />
              )}
              {project.objectPurpose && (
                <DataField icon={Target} label="Назначение" value={project.objectPurpose} />
              )}
              {project.documentNumber && (
                <DataField icon={FileText} label="Номер документа" value={project.documentNumber} />
              )}
              {project.clientName && (
                <DataField icon={Building2} label="Заказчик" value={project.clientName} />
              )}
              {project.processedAt && (
                <DataField
                  icon={Clock}
                  label="Обработано"
                  value={new Date(project.processedAt).toLocaleString('ru')}
                />
              )}
            </div>

            {/* Услуги */}
            {services.length > 0 && (
              <div className="mt-6">
                <button
                  className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-3"
                  onClick={() => toggleSection('services')}
                >
                  {expandedSections.services ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  Найденные услуги ({services.length})
                </button>

                {expandedSections.services && (
                  <div className="space-y-2">
                    {services.map((service, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg text-sm"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{service.name}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {service.category} • {service.unit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-medium text-primary-400">
                            {service.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Пробы — ссылка на отдельную страницу */}
      {project.processedAt && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <Link
              to={`/projects/${id}/samples`}
              className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                  <Beaker className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <p className="font-medium">Пробы</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Просмотр и редактирование проб
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-primary-400 transition-colors" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Фотоальбом — ссылка на отдельную страницу */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <Link
            to={`/projects/${id}/photos`}
            className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Camera className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-medium">Фотоальбом</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Фотографии с выезда
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-amber-400 transition-colors" />
          </Link>
        </CardContent>
      </Card>

      {/* Программа ИЭИ — ссылка на отдельную страницу (только для корневых проектов) */}
      {!isChildProject && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <Link
              to={`/projects/${id}/program-iei`}
              className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium flex items-center gap-2">
                    Программа ИЭИ
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-amber-500/20 text-amber-400 rounded">
                      beta
                    </span>
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Программа инженерно-экологических изысканий
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-purple-400 transition-colors" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Запросы справок — ссылка на отдельную страницу (только для корневых проектов) */}
      {!isChildProject && project.processedAt && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <Link
              to={`/projects/${id}/inquiry-requests`}
              className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <p className="font-medium">Запросы справок</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Генерация запросов в ведомства
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-teal-400 transition-colors" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Генерация Excel */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-400" />
            <CardTitle>Генерация документов</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {!project.processedAt ? (
            <p className="text-[var(--text-secondary)] text-center py-4">
              {isProcessing
                ? 'Дождитесь завершения обработки документов'
                : 'Загрузите ТЗ или поручение для генерации документов'}
            </p>
          ) : (
            <div className="space-y-4">
              {/* Настройка дат */}
              <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('dates')}
                  className="w-full flex items-center justify-between p-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-400" />
                    <span className="font-medium">Даты документов</span>
                    {(documentDates.ilcRequestDate || documentDates.fmbaRequestDate || documentDates.samplingDate) && (
                      <span className="text-xs text-primary-400 bg-primary-500/20 px-2 py-0.5 rounded">
                        настроено
                      </span>
                    )}
                  </div>
                  {expandedSections.dates ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                
                {expandedSections.dates && (
                  <div className="p-4 space-y-3 bg-[var(--bg-primary)]">
                    <p className="text-xs text-[var(--text-secondary)]">
                      Если не заполнено — используется завтрашняя дата. Если заполнена одна — применяется везде.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">
                          Дата заявки ИЛЦ
                        </label>
                        <input
                          type="date"
                          value={documentDates.ilcRequestDate}
                          onChange={(e) => setDocumentDates(prev => ({ ...prev, ilcRequestDate: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">
                          Дата заявки ФМБА
                        </label>
                        <input
                          type="date"
                          value={documentDates.fmbaRequestDate}
                          onChange={(e) => setDocumentDates(prev => ({ ...prev, fmbaRequestDate: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1">
                          Дата отбора проб
                        </label>
                        <input
                          type="date"
                          value={documentDates.samplingDate}
                          onChange={(e) => setDocumentDates(prev => ({ ...prev, samplingDate: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm rounded-md border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Кнопка генерации */}
              <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg">
                <div>
                  <p className="font-medium">Задание ПБ</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {project.generatedAt
                      ? `Последняя генерация: ${new Date(project.generatedAt).toLocaleString('ru')}`
                      : 'Ещё не генерировалась'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {project.generatedFileName && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => projectsApi.downloadExcel(id!, project.generatedFileName!)}
                    >
                      <Download className="w-4 h-4" />
                      Скачать
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => generateExcelMutation.mutate()}
                    isLoading={generateExcelMutation.isPending}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {project.generatedFileName ? 'Перегенерировать' : 'Сгенерировать'}
                  </Button>
                </div>
              </div>

              {/* Результат генерации */}
              {generateExcelMutation.isError && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-lg text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>Ошибка генерации. Попробуйте снова.</p>
                </div>
              )}

              {excelResult && (
                <div className="flex items-center gap-3 p-4 bg-primary-500/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-primary-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-primary-400">Задание сгенерировано</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {excelResult.fileName}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => projectsApi.downloadExcel(id!, excelResult.fileName)}
                  >
                    <Download className="w-4 h-4" />
                    Скачать
                  </Button>
                </div>
              )}

            </div>
          )}
        </CardContent>
      </Card>

      {/* Доотборы — только для корневых проектов (не для дочерних) */}
      {!isChildProject && project.processedAt && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-purple-400" />
              <CardTitle>Доотборы</CardTitle>
              {hasChildren && (
                <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
                  {project.childProjects!.length}
                </span>
              )}
            </div>
            {project.canEdit && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowCreateChildModal(true)}
              >
                <Plus className="w-4 h-4" />
                Создать доотбор
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {hasChildren ? (
              <div className="space-y-2">
                {project.childProjects!.map((child) => (
                  <Link
                    key={child.id}
                    to={`/projects/${child.id}`}
                    className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <GitBranch className="w-4 h-4 text-purple-400" />
                      <span className="font-medium">{child.name}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-purple-400 transition-colors" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                Доотборов пока нет. Создайте доотбор для дополнительного отбора проб.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Модальное окно создания доотбора */}
      {showCreateChildModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-bold mb-4">Создать доотбор</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Название проекта
                </label>
                <Input
                  value={childProjectName}
                  onChange={(e) => setChildProjectName(e.target.value)}
                  placeholder={`${project.name} (доотбор)`}
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Поручение (Word)
                </label>
                <input
                  ref={childOrderInputRef}
                  type="file"
                  accept=".doc,.docx"
                  onChange={(e) => setChildOrderFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {childOrderFile ? (
                  <div className="flex items-center gap-2 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                    <FileText className="w-4 h-4 text-primary-400" />
                    <span className="text-sm flex-1 truncate">{childOrderFile.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setChildOrderFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => childOrderInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    Выбрать файл
                  </Button>
                )}
              </div>

              {createChildMutation.isError && (
                <p className="text-sm text-red-400">
                  Ошибка при создании доотбора. Проверьте данные и попробуйте снова.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateChildModal(false);
                  setChildProjectName('');
                  setChildOrderFile(null);
                }}
              >
                Отмена
              </Button>
              <Button
                onClick={() => createChildMutation.mutate()}
                isLoading={createChildMutation.isPending}
                disabled={!childProjectName || !childOrderFile}
              >
                <Plus className="w-4 h-4" />
                Создать
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function FileItem({
  label,
  fileName,
  onDownload,
  isEditing,
  newFile,
  onFileSelect,
  onClearFile,
}: {
  label: string;
  fileName: string | null;
  onDownload: () => void;
  isEditing: boolean;
  newFile: File | null;
  onFileSelect: (file: File) => void;
  onClearFile: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-primary-400" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {newFile ? (
              <span className="text-primary-400">{newFile.name} (новый)</span>
            ) : fileName ? (
              fileName
            ) : (
              'Не загружен'
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            {newFile && (
              <Button size="sm" variant="ghost" onClick={onClearFile}>
                <X className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              {fileName || newFile ? 'Заменить' : 'Загрузить'}
            </Button>
          </>
        ) : (
          fileName && (
            <Button size="sm" variant="secondary" onClick={onDownload}>
              <Download className="w-4 h-4" />
              Скачать
            </Button>
          )
        )}
      </div>
    </div>
  );
}

function DataField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
      <Icon className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-[var(--text-secondary)]">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

