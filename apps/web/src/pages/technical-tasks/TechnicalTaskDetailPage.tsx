import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Download, Trash2, Clock, CheckCircle2, AlertCircle, Loader2, RefreshCw, Save, FileCode2, Eye, Info } from 'lucide-react';
import type { TzXmlModel, ValidationIssue } from '@tz-xml';
import { technicalTasksApi, type TechnicalTask, type TechnicalTaskStatus } from '@/api/technical-tasks';
import { Button, Card, CardContent } from '@/components/ui';
import { TzEditor } from './editor/TzEditor';
import { XmlPreview } from './editor/XmlPreview';

const STATUS: Record<TechnicalTaskStatus, { label: string; cls: string; icon: typeof Clock }> = {
  DRAFT: { label: 'Черновик', cls: 'bg-gray-500/20 text-gray-300', icon: Clock },
  PROCESSING: { label: 'Извлечение данных', cls: 'bg-amber-500/20 text-amber-300', icon: Loader2 },
  COMPLETED: { label: 'XML сформирован', cls: 'bg-emerald-500/20 text-emerald-300', icon: CheckCircle2 },
  ERROR: { label: 'Ошибка', cls: 'bg-red-500/20 text-red-300', icon: AlertCircle },
};

const SOURCE_LABEL = { WORD: 'из ТЗ заказчика', DESIGN_XML: 'из задания на проектирование', SCRATCH: 'с нуля' };

export function TechnicalTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: task, isLoading, isError } = useQuery({
    queryKey: ['technical-task', id],
    queryFn: () => technicalTasksApi.getById(id!),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.status === 'PROCESSING' ? 2000 : false),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
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

  return <TaskView task={task} onDeleted={() => { queryClient.invalidateQueries({ queryKey: ['technical-tasks'] }); navigate('/technical-tasks'); }} />;
}

function TaskView({ task, onDeleted }: { task: TechnicalTask; onDeleted: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [model, setModel] = useState<TzXmlModel | null>(task.xmlData);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<'form' | 'preview'>('form');
  const [generateIssues, setGenerateIssues] = useState<ValidationIssue[] | null>(null);
  const lastSaved = useRef<string>(JSON.stringify(task.xmlData));

  // Обновление модели с сервера (после извлечения данных или генерации), если нет несохранённых правок
  useEffect(() => {
    const incoming = JSON.stringify(task.xmlData);
    if (!dirty && incoming !== lastSaved.current) {
      setModel(task.xmlData);
      lastSaved.current = incoming;
    }
  }, [task.xmlData, dirty]);

  const saveMutation = useMutation({
    mutationFn: (m: TzXmlModel) => technicalTasksApi.update(task.id, { xmlData: m }),
    onSuccess: (data) => {
      lastSaved.current = JSON.stringify(data.xmlData);
      setDirty(false);
      queryClient.setQueryData(['technical-task', task.id], data);
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (model && dirty) await technicalTasksApi.update(task.id, { xmlData: model });
      setDirty(false);
      return technicalTasksApi.generate(task.id);
    },
    onSuccess: (data) => {
      setGenerateIssues(null);
      lastSaved.current = JSON.stringify(data.xmlData);
      queryClient.setQueryData(['technical-task', task.id], data);
      setTab('preview');
    },
    onError: (error: { response?: { data?: { issues?: ValidationIssue[]; message?: string } } }) => {
      setGenerateIssues(error.response?.data?.issues ?? []);
      queryClient.invalidateQueries({ queryKey: ['technical-task', task.id] });
    },
  });

  const deleteMutation = useMutation({ mutationFn: () => technicalTasksApi.delete(task.id), onSuccess: onDeleted });
  const reprocessMutation = useMutation({
    mutationFn: () => technicalTasksApi.reprocess(task.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technical-task', task.id] }),
  });

  // Автосохранение через 1,5 с после последней правки
  useEffect(() => {
    if (!dirty || !model) return;
    const t = setTimeout(() => saveMutation.mutate(model), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, dirty]);

  const onChange = (m: TzXmlModel) => {
    setModel(m);
    setDirty(true);
  };

  const status = STATUS[task.status];
  const StatusIcon = status.icon;
  const isLegacy = !task.xmlData && !!task.generatedFileUrl;

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/technical-tasks')} className="mb-3">
          <ArrowLeft className="w-4 h-4" /> Назад к списку
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold mb-1 truncate">{task.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
                <StatusIcon className={`w-3.5 h-3.5 ${task.status === 'PROCESSING' ? 'animate-spin' : ''}`} /> {status.label}
              </span>
              <span>{SOURCE_LABEL[task.source]}</span>
              {task.sourceFileName && (
                <button type="button" className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]" onClick={() => technicalTasksApi.downloadSourceFile(task.id)}>
                  <FileText className="w-3.5 h-3.5" /> {task.sourceFileName}
                </button>
              )}
              {saveMutation.isPending ? <span className="inline-flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> сохраняем…</span> : dirty ? <span>есть несохранённые правки</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {model && task.canEdit && (
              <Button variant="secondary" size="sm" onClick={() => model && saveMutation.mutate(model)} disabled={!dirty || saveMutation.isPending}>
                <Save className="w-4 h-4" /> Сохранить
              </Button>
            )}
            {model && task.canEdit && (
              <Button size="sm" onClick={() => generateMutation.mutate()} isLoading={generateMutation.isPending} disabled={task.status === 'PROCESSING'}>
                <FileCode2 className="w-4 h-4" /> Сгенерировать XML
              </Button>
            )}
            {task.xmlFileUrl && (
              <Button variant="secondary" size="sm" onClick={() => technicalTasksApi.downloadXml(task.id)}>
                <Download className="w-4 h-4" /> Скачать XML
              </Button>
            )}
            {task.canDelete && (
              <Button variant="danger" size="sm" onClick={() => confirm('Удалить это ТЗ?') && deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {task.status === 'PROCESSING' && (
        <Card className="mb-6">
          <CardContent className="py-6 flex items-center gap-4">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <div className="flex-1">
              <div className="font-semibold">ИИ извлекает данные из документа</div>
              <div className="text-sm text-[var(--text-secondary)]">Обычно это занимает три–пять минут: модель разбирает документ целиком. Форма откроется автоматически.</div>
            </div>
            {task.canEdit && (
              <Button variant="secondary" size="sm" onClick={() => reprocessMutation.mutate()} disabled={reprocessMutation.isPending} title="Если обработка зависла">
                <RefreshCw className={`w-4 h-4 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} /> Запустить заново
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {task.status === 'ERROR' && (
        <Card className="mb-6 border-red-500/30">
          <CardContent className="py-5 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-red-300">Не удалось извлечь данные</div>
              <div className="text-sm text-[var(--text-secondary)] mb-3">{task.processingError || 'Попробуйте запустить обработку ещё раз или заполните форму вручную.'}</div>
              <Button variant="secondary" size="sm" onClick={() => reprocessMutation.mutate()} disabled={reprocessMutation.isPending}>
                <RefreshCw className={`w-4 h-4 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} /> Повторить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {model?.importInfo && (model.importInfo.imported.length > 0 || model.importInfo.notes.length > 0) && (
        <Card className="mb-6">
          <CardContent className="py-4 text-sm space-y-2">
            {model.importInfo.imported.length > 0 && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>
                  <span className="text-[var(--text-secondary)]">Перенесено из документа: </span>
                  {model.importInfo.imported.join(', ')}
                </span>
              </div>
            )}
            {model.importInfo.notes.map((n, i) => (
              <div key={i} className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <span>{n}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {generateIssues && generateIssues.length > 0 && (
        <Card className="mb-6 border-amber-500/30">
          <CardContent className="py-4 text-sm">
            <div className="font-semibold text-amber-300 mb-1">XML не сформирован: заполните обязательные поля</div>
            <div className="text-[var(--text-secondary)]">Осталось {generateIssues.length}. Проблемные блоки отмечены в списке слева.</div>
          </CardContent>
        </Card>
      )}

      {isLegacy && (
        <Card className="mb-6">
          <CardContent className="py-5 flex flex-wrap items-center gap-4">
            <div className="flex-1 text-sm">
              <div className="font-semibold">ТЗ создано по прежнему Word-шаблону</div>
              <div className="text-[var(--text-secondary)]">Для XML по схеме Минстроя создайте новое задание. Прежний документ можно скачать.</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => technicalTasksApi.downloadGeneratedFile(task.id)}>
              <Download className="w-4 h-4" /> Скачать Word
            </Button>
          </CardContent>
        </Card>
      )}

      {model && (
        <>
          <div className="flex gap-2 mb-4 border-b border-[var(--border-color)]">
            <button type="button" onClick={() => setTab('form')} className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === 'form' ? 'border-primary-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'}`}>
              Форма
            </button>
            <button type="button" onClick={() => setTab('preview')} disabled={!task.xmlFileUrl} className={`px-4 py-2 text-sm border-b-2 -mb-px inline-flex items-center gap-1.5 disabled:opacity-40 ${tab === 'preview' ? 'border-primary-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)]'}`}>
              <Eye className="w-4 h-4" /> Печатная форма
            </button>
          </div>
          {tab === 'form' ? (
            <TzEditor taskId={task.id} model={model} onChange={onChange} readOnly={!task.canEdit} />
          ) : (
            <div className="space-y-3">
              {dirty && <div className="text-sm text-amber-300">Есть правки, не попавшие в XML. Сгенерируйте XML заново.</div>}
              <XmlPreview taskId={task.id} version={task.xmlGeneratedAt} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
