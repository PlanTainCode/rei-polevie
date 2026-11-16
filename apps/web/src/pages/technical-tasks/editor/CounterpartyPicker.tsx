import { createContext, useContext, useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookUser } from 'lucide-react';
import { counterpartyConflicts, fillEmptyCounterpartyFields, type CounterpartyDetails, type CounterpartyKind, type CounterpartyRecord, type CounterpartySignatory } from '@tz-xml';
import { counterpartiesApi } from '@/api/counterparties';
import { Button, Input, Select } from '@/components/ui';

export const CounterpartyPickerContext = createContext({ enabled: false, readOnly: false });

function optionLabel(item: CounterpartyRecord): string {
  if (item.kind === 'ORGANIZATION') return `${item.name} · ИНН ${item.details.inn}, КПП ${item.details.kpp}`;
  if (item.kind === 'ENTREPRENEUR') return `${item.name} · ОГРНИП ${item.details.ogrnip}`;
  const a = item.details.postAddress;
  return `${item.name} · ${a.note || [a.city, a.street, a.building].filter(Boolean).join(', ')}`;
}

export function CounterpartyPicker<K extends CounterpartyKind>({ kind, value, onChange, withSignatories = false }: {
  kind: K;
  value: CounterpartyDetails[K];
  onChange: (value: CounterpartyDetails[K], signatories?: CounterpartySignatory[]) => void;
  withSignatories?: boolean;
}) {
  const context = useContext(CounterpartyPickerContext);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<CounterpartyRecord | null>(null);
  const [signatoryIndices, setSignatoryIndices] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const id = useId();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ['counterparties', kind, debounced],
    queryFn: () => counterpartiesApi.list({ kind, search: debounced }),
    enabled: context.enabled && !context.readOnly && open,
  });

  if (!context.enabled || context.readOnly) return null;
  const fill = () => {
    if (!selected || selected.kind !== kind) return;
    const source = selected.details as CounterpartyDetails[K];
    if (counterpartyConflicts(kind, value, source)) {
      setMessage('Идентификационные данные отличаются. Чтобы не смешать реквизиты разных контрагентов, используйте пустую карточку или исправьте данные вручную.');
      return;
    }
    const signatories = withSignatories && selected.kind === 'ORGANIZATION'
      ? (selected.details.signatories ?? []).filter((_, i) => signatoryIndices.includes(i)) : [];
    onChange(fillEmptyCounterpartyFields(kind, value, source), signatories);
    setOpen(false);
    setMessage(signatories.length
      ? 'Реквизиты и выбранные подписанты перенесены без перезаписи ручных данных. Проверьте роли подписантов в ТЗ.'
      : 'Пустые поля дополнены из реестра. Ранее введённые значения сохранены.');
  };

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border-color)] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          <BookUser className="w-4 h-4" /> {open ? 'Скрыть выбор' : 'Выбрать из реестра'}
        </Button>
        <Link to="/counterparties" target="_blank" rel="noreferrer" className="text-sm text-primary-400 hover:underline">Открыть реестр</Link>
      </div>
      {open && (
        <div className="space-y-3">
          <Input id={`${id}-search`} label="Поиск по названию, ФИО или реквизитам" value={search} onChange={(e) => { setSearch(e.target.value); setSelected(null); setMessage(''); }} maxLength={200} />
          {query.isError ? (
            <p className="text-sm text-red-400">Не удалось загрузить реестр. <button type="button" className="underline" onClick={() => void query.refetch()}>Повторить</button>. Можно заполнить поля вручную.</p>
          ) : query.isFetching ? <p className="text-sm text-[var(--text-secondary)]">Загрузка…</p> : (
            <>
              <Select id={`${id}-select`} label="Контрагент" value={selected?.id ?? ''} onChange={(e) => {
                const record = query.data?.items.find((item) => item.id === e.target.value) ?? null;
                setSelected(record);
                setSignatoryIndices(record?.kind === 'ORGANIZATION' ? (record.details.signatories ?? []).map((_, i) => i) : []);
                setMessage('');
              }} options={[
                { value: '', label: '— выберите карточку —' },
                ...(query.data?.items ?? []).map((item) => ({ value: item.id, label: optionLabel(item) })),
              ]} />
              {withSignatories && selected?.kind === 'ORGANIZATION' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Подписанты для этого ТЗ</p>
                  {(selected.details.signatories ?? []).map((s, i) => (
                    <label key={i} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1 accent-primary-500" checked={signatoryIndices.includes(i)} onChange={(e) => setSignatoryIndices(e.target.checked ? [...signatoryIndices, i] : signatoryIndices.filter((n) => n !== i))} />
                      <span>{[s.surname, s.name, s.patronymic].filter(Boolean).join(' ')} — {s.position}</span>
                    </label>
                  ))}
                  {!selected.details.signatories?.length && <p className="text-sm text-[var(--text-secondary)]">В карточке пока нет подписантов. Их можно добавить в реестре или заполнить вручную в ТЗ.</p>}
                  {!!selected.details.signatories?.length && <p className="text-xs text-[var(--text-secondary)]">Снимите отметки с ненужных подписантов. Роли проверьте после переноса; ранее введённые данные сохранятся.</p>}
                </div>
              )}
              {query.data?.total === 0 && <p className="text-sm text-[var(--text-secondary)]">Карточек не найдено. Можно заполнить реквизиты вручную.</p>}
              {(query.data?.total ?? 0) > 100 && <p className="text-sm text-[var(--text-secondary)]">Показаны первые 100 карточек. Уточните поиск.</p>}
              <Button type="button" size="sm" disabled={!selected || search !== debounced} onClick={fill}>{withSignatories && signatoryIndices.length ? 'Заполнить реквизиты и подписантов' : 'Заполнить пустые поля'}</Button>
            </>
          )}
        </div>
      )}
      {message && <p role="status" className="text-sm text-[var(--text-secondary)]">{message}</p>}
      <p className="text-xs text-[var(--text-secondary)]">Можно заполнить вручную. Новая карточка добавится в реестр при нажатии «Сохранить» в ТЗ, если заполнены идентификационные данные.</p>
    </div>
  );
}
