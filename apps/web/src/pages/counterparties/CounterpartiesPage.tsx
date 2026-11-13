import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { BookUser, Plus, Save, Trash2 } from 'lucide-react';
import { COUNTERPARTY_KINDS, COUNTERPARTY_LABELS, counterpartyIssues, emptyCounterparty, type CounterpartyDraft, type CounterpartyKind, type CounterpartyRecord } from '@tz-xml';
import { counterpartiesApi } from '@/api/counterparties';
import { Button, Card, CardContent, Input, Select } from '@/components/ui';
import { EntrepreneurEditor, OrganizationEditor, PersonEditor } from '@/pages/technical-tasks/editor/entities';

function errorMessage(error: unknown): string {
  const message = isAxiosError(error) ? error.response?.data?.message : null;
  return typeof message === 'string' ? message : 'Не удалось сохранить изменения. Попробуйте ещё раз.';
}

const kindOptions = COUNTERPARTY_KINDS.map((kind) => ({ value: kind, label: COUNTERPARTY_LABELS[kind] }));

function CounterpartyForm({ record, readOnly, onClose, onSaved }: {
  record: CounterpartyRecord | null;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<CounterpartyDraft>(() => record ? structuredClone({ kind: record.kind, details: record.details } as CounterpartyDraft) : emptyCounterparty('ORGANIZATION'));
  const issues = counterpartyIssues(draft);
  const save = useMutation({
    mutationFn: () => record ? counterpartiesApi.update(record.id, draft) : counterpartiesApi.create(draft),
    onSuccess: onSaved,
  });
  const minimum = draft.kind === 'ORGANIZATION' ? 'наименование, ИНН и КПП'
    : draft.kind === 'ENTREPRENEUR' ? 'фамилию, имя и ОГРНИП' : 'фамилию, имя и почтовый адрес';

  return (
    <Card className="mb-6">
      <CardContent className="py-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{record ? record.name : 'Новый контрагент'}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={save.isPending}>Закрыть</Button>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">Для сохранения в реестре укажите {minimum}. Остальные реквизиты можно дополнить позже. Звёздочкой отмечены поля, необходимые для ТЗ.</p>
        <fieldset disabled={readOnly || save.isPending} className="space-y-4 min-w-0">
          <Select id="counterparty-kind" label="Форма" value={draft.kind} disabled={Boolean(record)} onChange={(e) => {
            const next = e.target.value as CounterpartyKind;
            if (JSON.stringify(draft) !== JSON.stringify(emptyCounterparty(draft.kind)) && !window.confirm('Смена формы очистит несохранённые поля новой карточки. Продолжить?')) return;
            setDraft(emptyCounterparty(next));
            save.reset();
          }} options={kindOptions} />
          {draft.kind === 'ORGANIZATION' && <OrganizationEditor value={draft.details} onChange={(details) => setDraft({ kind: 'ORGANIZATION', details })} issues={issues} path="details" nopriz />}
          {draft.kind === 'ENTREPRENEUR' && <EntrepreneurEditor value={draft.details} onChange={(details) => setDraft({ kind: 'ENTREPRENEUR', details })} issues={issues} path="details" nopriz />}
          {draft.kind === 'PERSON' && <PersonEditor value={draft.details} onChange={(details) => setDraft({ kind: 'PERSON', details })} issues={issues} path="details" />}
          {!readOnly && <Button type="button" onClick={() => save.mutate()} disabled={issues.length > 0} isLoading={save.isPending}><Save className="w-4 h-4" /> Сохранить карточку</Button>}
        </fieldset>
        {save.isError && <p role="alert" className="text-sm text-red-400">{errorMessage(save.error)}</p>}
        <p className="text-sm text-[var(--text-secondary)]">Изменения этой карточки не затрагивают уже заполненные ТЗ.</p>
      </CardContent>
    </Card>
  );
}

function identifiers(record: CounterpartyRecord): string {
  if (record.kind === 'ORGANIZATION') return `ИНН ${record.details.inn} · КПП ${record.details.kpp}`;
  if (record.kind === 'ENTREPRENEUR') return `ОГРНИП ${record.details.ogrnip}${record.details.inn ? ` · ИНН ${record.details.inn}` : ''}`;
  const a = record.details.postAddress;
  return a.note || [a.city || a.settlement, a.street, a.building, a.room].filter(Boolean).join(', ');
}

export function CounterpartiesPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [kind, setKind] = useState<CounterpartyKind | ''>('');
  const [editing, setEditing] = useState<CounterpartyRecord | 'new' | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ['counterparties', 'list', kind, debounced],
    queryFn: () => counterpartiesApi.list({ kind: kind || undefined, search: debounced }),
  });
  const remove = useMutation({
    mutationFn: counterpartiesApi.delete,
    onSuccess: () => { client.invalidateQueries({ queryKey: ['counterparties'] }); },
  });

  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2"><BookUser className="w-6 h-6" /> Контрагенты</h1>
          <p className="text-sm text-[var(--text-secondary)]">Общий реестр вашей компании: заказчики, исполнители и другие участники ТЗ.</p>
        </div>
        <Button type="button" onClick={() => setEditing('new')} disabled={editing !== null || !query.data}><Plus className="w-4 h-4" /> Добавить контрагента</Button>
      </div>
      {editing !== null && <CounterpartyForm key={editing === 'new' ? 'new' : editing.id} record={editing === 'new' ? null : editing} readOnly={editing !== 'new' && !query.data?.canManage} onClose={() => setEditing(null)} onSaved={() => {
        setEditing(null);
        client.invalidateQueries({ queryKey: ['counterparties'] });
      }} />}
      <div className="grid gap-4 sm:grid-cols-2 mb-5">
        <Input id="counterparties-search" label="Поиск по названию, ФИО или реквизитам" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={200} />
        <Select id="counterparties-kind" label="Форма контрагента" value={kind} onChange={(e) => setKind(e.target.value as CounterpartyKind | '')} options={[{ value: '', label: 'Все' }, ...kindOptions]} />
      </div>
      {remove.isError && <p role="alert" className="text-sm text-red-400 mb-4">{errorMessage(remove.error)}</p>}
      {query.isError ? (
        <p className="text-red-400">Не удалось загрузить реестр. <button type="button" className="underline" onClick={() => void query.refetch()}>Повторить</button></p>
      ) : query.isPending ? <p className="text-[var(--text-secondary)]">Загрузка реестра…</p> : (
        <>
          <p className="text-sm text-[var(--text-secondary)] mb-3">Найдено: {query.data.total}.{query.data.total > 100 ? ' Показаны первые 100 карточек — уточните поиск.' : ''}</p>
          {query.data.items.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-[var(--text-secondary)]">{search || kind ? 'По вашему запросу ничего не найдено.' : 'Контрагентов пока нет. Добавьте карточку здесь или заполните участника в ТЗ и нажмите «Сохранить».'}</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {query.data.items.map((record) => (
                <Card key={record.id}>
                  <CardContent className="py-4 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium break-words">{record.name}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">{COUNTERPARTY_LABELS[record.kind]}</div>
                      <div className="text-sm text-[var(--text-secondary)] break-words">{identifiers(record)}</div>
                    </div>
                    <Button type="button" size="sm" variant="secondary" disabled={editing !== null} onClick={() => setEditing(record)}>{query.data.canManage ? 'Редактировать' : 'Посмотреть'}</Button>
                    {query.data.canManage && <Button type="button" size="sm" variant="ghost" aria-label={`Удалить ${record.name}`} disabled={remove.isPending || editing !== null} onClick={() => {
                      if (window.confirm(`Удалить «${record.name}» из реестра? Реквизиты в уже созданных ТЗ сохранятся.`)) remove.mutate(record.id);
                    }}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
