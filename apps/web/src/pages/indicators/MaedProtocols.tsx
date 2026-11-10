import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Copy, Radiation, Trash2, Upload } from 'lucide-react';
import { maedApi, type MaedProtocol } from '@/api/maed';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { copyMaedResults, maedRows } from './maed-results';
import { MaedCalculationForm } from './MaedCalculationForm';

function errorMessage(error: unknown) {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('. ');
  }
  return error instanceof Error ? error.message : 'Не удалось выполнить действие. Попробуйте снова.';
}

function ProtocolResults({ protocol, projectId, canEdit }: { protocol: MaedProtocol; projectId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');
  const [copyError, setCopyError] = useState('');
  const remove = useMutation({
    mutationFn: () => maedApi.delete(projectId, protocol.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maed', projectId] }),
  });
  const rows = maedRows(protocol.summary);
  const complete = rows.every((row) => row.value !== null);

  async function copy(action: () => Promise<void>) {
    setNotice('');
    setCopyError('');
    try {
      await action();
      setNotice('Скопировано');
    } catch {
      setCopyError('Не удалось скопировать. Проверьте разрешение браузера на доступ к буферу обмена.');
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-[var(--border-color)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{protocol.protocolNumber ? `Протокол № ${protocol.protocolNumber}` : protocol.fileName}</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {protocol.measurementDate && `${protocol.measurementDate} · `}{protocol.points.length} точек · {protocol.fileName}
          </p>
        </div>
        {canEdit && <Button size="sm" variant="ghost" isLoading={remove.isPending} onClick={() => {
          if (window.confirm('Удалить этот протокол МАЭД и его результаты?')) remove.mutate();
        }}><Trash2 className="h-4 w-4" />Удалить</Button>}
      </div>
      {remove.isError && <p role="alert" className="text-sm text-red-400">{errorMessage(remove.error)}</p>}
      {protocol.calculation.method === 'manual' ? (
        <p className="text-sm text-[var(--text-secondary)]">δ введена вручную как готовая абсолютная расширенная неопределённость.</p>
      ) : (
        <div className="space-y-1 rounded-lg bg-amber-500/10 p-3 text-sm">
          <p>Расчётная оценка при k=2. Точки условно рассматриваются как одна серия измерений участка.</p>
          {protocol.calculation.settings && <p>Основная погрешность: {protocol.calculation.settings.mainErrorPercent} %.
            {protocol.calculation.settings.additionalErrorsPercent.length
              ? ` Дополнительные: ${protocol.calculation.settings.additionalErrorsPercent.join('; ')} %.`
              : ' Дополнительные погрешности не учтены — это неполный бюджет неопределённости.'}</p>}
          {!complete && <p>{protocol.calculation.reason}</p>}
        </div>
      )}
      <details open={!complete}>
        <summary className="cursor-pointer text-sm font-medium">Параметры и формула расчёта</summary>
        <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
          {protocol.instrumentName && <p>Прибор: {protocol.instrumentName}</p>}
          {protocol.calculation.sourceUrl && <p>БДКГ-Р20Д: основная погрешность ±13 %. <a className="text-primary-500 underline" href={protocol.calculation.sourceUrl} target="_blank" rel="noreferrer">Описание типа, таблица 2</a>. Температурная погрешность ±3 % на каждые 10 °C и другие влияния требуют отдельного учёта по условиям измерений.</p>}
          <p>По формулам (8)–(14): uA = √[Σ(Hᵢ − H̄)² / (n(n−1))] / H̄ × 100 %; uB = √[(θ² + Σθᵢ²) / 3]; δ = 2 × √(uA² + uB²) × H̄ / 100.</p>
          <p>δ в итоговой таблице — абсолютная расширенная неопределённость U. Неопределённости отдельных точек из Excel не подставляются вместо погрешностей прибора.</p>
          {protocol.calculation.method === 'mr' && protocol.calculation.typeA !== null && <p>Стандартная составляющая A: {protocol.calculation.typeA.toFixed(6)} мкЗв/ч; B: {protocol.calculation.typeBPercent?.toFixed(4)} %; суммарная: {protocol.calculation.combinedPercent?.toFixed(4)} %. δ до округления: {protocol.summary.uncertainty?.toFixed(6)} мкЗв/ч.</p>}
          {canEdit && <MaedCalculationForm key={`${protocol.id}:${protocol.uncertainty}:${JSON.stringify(protocol.calculation.settings)}`} projectId={projectId} protocol={protocol} />}
        </div>
      </details>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="mb-3 text-left font-medium">Результаты измерения МАЭД ГИ на участке</caption>
          <thead className="bg-[var(--bg-tertiary)]">
            <tr><th className="p-3 text-left">№ п/п</th><th className="p-3 text-left">Наименование показателя</th><th className="p-3 text-right">Значение, мкЗв/ч</th><th><span className="sr-only">Копировать</span></th></tr>
          </thead>
          <tbody>{rows.map((row, index) => <tr key={row.label} className="border-b border-[var(--border-color)]">
            <td className="p-3">{index + 1}</td><td className="p-3">{row.label}</td><td className="p-3 text-right tabular-nums">{row.value ?? '—'}</td>
            <td className="px-2"><Button size="sm" variant="ghost" disabled={row.value === null} aria-label={`Копировать: ${row.label}`} onClick={() => copy(() => navigator.clipboard.writeText(row.value!))}><Copy className="h-4 w-4" /></Button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={!complete} onClick={() => copy(() => copyMaedResults(protocol.summary, true))}><Copy className="h-4 w-4" />Копировать значения</Button>
        <Button size="sm" variant="secondary" disabled={!complete} onClick={() => copy(() => copyMaedResults(protocol.summary, false))}><Copy className="h-4 w-4" />Копировать таблицу</Button>
        <span role="status" className="text-sm text-green-500">{notice}</span>
      </div>
      {copyError && <p role="alert" className="text-sm text-red-400">{copyError}</p>}
      <details>
        <summary className="cursor-pointer text-sm text-[var(--text-secondary)]">Исходные измерения ({protocol.points.length})</summary>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="p-2 text-left">№ точки</th><th className="p-2 text-right">МАЭД, мкЗв/ч</th><th className="p-2 text-right">Расширенная неопределённость (k=2), мкЗв/ч</th></tr></thead>
            <tbody>{protocol.points.map((point) => <tr key={point.number} className="border-t border-[var(--border-color)]"><td className="p-2">{point.number}</td><td className="p-2 text-right">{point.value}</td><td className="p-2 text-right">{point.uncertainty === null ? '—' : `± ${point.uncertainty}`}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function MaedProtocols({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const protocols = useQuery({ queryKey: ['maed', projectId], queryFn: () => maedApi.list(projectId) });
  const upload = useMutation({
    mutationFn: () => maedApi.upload(projectId, file!),
    onSuccess: () => {
      setFile(null);
      if (input.current) input.current.value = '';
      return queryClient.invalidateQueries({ queryKey: ['maed', projectId] });
    },
  });
  function selectFile(selected?: File) {
    if (upload.isPending) return;
    upload.reset();
    setFileError('');
    setFile(null);
    if (!selected) return;
    if (!/\.xlsx?$/i.test(selected.name)) { setFileError('Выберите Excel-файл (.xlsx или .xls)'); return; }
    if (selected.size > 10 * 1024 * 1024) { setFileError('Размер файла не должен превышать 10 МБ'); return; }
    setFile(selected);
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center gap-2"><Radiation className="h-5 w-5 text-amber-500" /><CardTitle>Протоколы МАЭД</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">Результаты измерений гамма-излучения на участке. Каждый протокол рассчитывается отдельно.</p>
        {protocols.isPending && <p role="status" className="text-sm">Загрузка протоколов…</p>}
        {protocols.isError && <div role="alert" className="text-sm text-red-400">{errorMessage(protocols.error)} <Button size="sm" variant="ghost" onClick={() => protocols.refetch()}>Повторить</Button></div>}
        {protocols.data?.map((protocol) => <ProtocolResults key={protocol.id} protocol={protocol} projectId={projectId} canEdit={canEdit} />)}
        {protocols.data?.length === 0 && !canEdit && <p className="text-sm text-[var(--text-secondary)]">Протоколы пока не загружены.</p>}
        {canEdit && <div className="space-y-3">
          <input ref={input} type="file" accept=".xlsx,.xls" className="hidden" aria-label="Протокол МАЭД" onChange={(event) => selectFile(event.target.files?.[0])} />
          <div className={`rounded-lg border-2 border-dashed p-5 text-center ${dragging ? 'border-primary-500 bg-primary-500/10' : 'border-[var(--border-color)]'}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}>
            <Upload className="mx-auto mb-2 h-6 w-6 text-[var(--text-secondary)]" />
            <p className="text-sm">{file ? file.name : 'Перетащите протокол МАЭД или выберите файл'}</p>
            <p className="my-2 text-xs text-[var(--text-secondary)]">Excel (.xlsx, .xls), до 10 МБ</p>
            <Button size="sm" variant="secondary" disabled={upload.isPending} onClick={() => input.current?.click()}>{file ? 'Выбрать другой файл' : 'Выбрать файл'}</Button>
          </div>
          {fileError && <p role="alert" className="text-sm text-red-400">{fileError}</p>}
          {upload.isError && <p role="alert" className="text-sm text-red-400">{errorMessage(upload.error)}</p>}
          {file && <Button size="sm" isLoading={upload.isPending} onClick={() => upload.mutate()}><Upload className="h-4 w-4" />Загрузить протокол</Button>}
        </div>}
      </CardContent>
    </Card>
  );
}
