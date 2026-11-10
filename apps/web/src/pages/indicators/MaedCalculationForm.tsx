import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { maedApi, type MaedProtocol } from '@/api/maed';
import { Button, Input } from '@/components/ui';
import { parseMaedInput, parseMaedSettings } from './maed-settings';

export function MaedCalculationForm({ protocol, projectId }: { protocol: MaedProtocol; projectId: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState(protocol.calculation.method);
  const [main, setMain] = useState(protocol.calculation.settings?.mainErrorPercent.toString() ?? '');
  const [additional, setAdditional] = useState(protocol.calculation.settings?.additionalErrorsPercent.join('; ') ?? '');
  const [manual, setManual] = useState(protocol.uncertainty?.toString() ?? '');
  const save = useMutation({
    mutationFn: () => mode === 'manual'
      ? maedApi.updateUncertainty(projectId, protocol.id, parseMaedInput(manual))
      : maedApi.updateCalculation(projectId, protocol.id, parseMaedSettings(main, additional)),
    onSuccess: (updated) => {
      queryClient.setQueryData<MaedProtocol[]>(['maed', projectId], (previous) => previous?.map((item) => item.id === updated.id ? updated : item));
      return queryClient.invalidateQueries({ queryKey: ['maed', projectId] });
    },
  });
  const serverMessage = isAxiosError(save.error) ? save.error.response?.data?.message : null;
  const error = Array.isArray(serverMessage) ? serverMessage.join('. ') : serverMessage || save.error?.message;

  return (
    <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <fieldset disabled={save.isPending} className="space-y-3">
        <label className="block text-sm" htmlFor={`maed-mode-${protocol.id}`}>Способ определения δ</label>
        <select id={`maed-mode-${protocol.id}`} className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2 text-sm" value={mode} onChange={(event) => { setMode(event.target.value as 'mr' | 'manual'); save.reset(); }}>
          <option value="mr">Оценка по формулам МР (k=2)</option>
          <option value="manual">Готовая расширенная неопределённость</option>
        </select>
        {mode === 'mr' ? <>
          <Input id={`maed-main-${protocol.id}`} label="Основная относительная погрешность θ, %" inputMode="decimal" value={main} onChange={(event) => setMain(event.target.value)} placeholder="Например: 13" />
          <Input id={`maed-additional-${protocol.id}`} label="Дополнительные относительные погрешности θᵢ, %" value={additional} onChange={(event) => setAdditional(event.target.value)} placeholder="Через точку с запятой: 3; 5,5" />
          <p className="text-xs text-[var(--text-secondary)]">Введите пределы погрешностей, а не стандартные неопределённости. Пустое поле означает, что дополнительные составляющие в оценку не включены.</p>
        </> : <Input id={`maed-manual-${protocol.id}`} label="Абсолютная расширенная неопределённость δ, мкЗв/ч" inputMode="decimal" value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Например: 0,02" />}
        <Button type="submit" size="sm" isLoading={save.isPending}>Сохранить и пересчитать</Button>
      </fieldset>
      {save.isError && <p role="alert" className="text-sm text-red-400">{error || 'Не удалось сохранить параметры'}</p>}
      <p className="text-xs text-[var(--text-secondary)]">В таблице показан результат по сохранённым параметрам.</p>
    </form>
  );
}
