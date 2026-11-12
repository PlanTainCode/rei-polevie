import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { projectsApi, type CreateSampleData, type Platform } from '@/api/projects';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

const ANALYSES = [
  { value: 'АХ', label: 'АХ — химия почвы', mass: '1,0 кг/Пэ', depthTo: 0.2 },
  { value: 'АМ', label: 'АМ — микробиология', mass: '750 г/Пэ', depthTo: 0.2 },
  { value: 'АП', label: 'АП — паразитология', mass: '200 г/Пэ', depthTo: 0.1 },
  { value: 'АЭ', label: 'АЭ — энтомология', mass: '1,0 кг/Пэ', depthTo: 0.1 },
  { value: 'БХ', label: 'БХ — донные отложения', mass: '1,0 кг/Пэ', depthTo: 0.2 },
  { value: 'ВХ', label: 'ВХ — вода', mass: '1,0 л/Ст; 1,5л Пэ', depthTo: 0 },
];
const PLATFORM_LABELS = { PP: 'ПП — пробная площадка', SK: 'СК — скважина', DO: 'ДО — донные отложения', V: 'В — вода' };

export function CreateSampleForm({ projectId, onCreated, onCancel }: {
  projectId: string;
  onCreated: (cipher: string) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [data, setData] = useState<CreateSampleData>({
    cipher: '', platformType: 'PP', platformNumber: 1, analysisCode: 'АХ',
    layerNumber: 1, depthFrom: 0, depthTo: 0.2, mass: '1,0 кг/Пэ',
  });
  const [selectedPlatform, setSelectedPlatform] = useState('new');
  const [error, setError] = useState('');
  const platforms = useQuery({
    queryKey: ['project-platforms', projectId],
    queryFn: () => projectsApi.getPlatforms(projectId),
  });
  const createMutation = useMutation({
    mutationFn: (payload: CreateSampleData) => projectsApi.createSample(projectId, payload),
    onSuccess: (sample) => {
      for (const queryKey of [
        ['project-samples', projectId], ['project-platforms', projectId],
        ['project', projectId], ['projects'], ['dashboardStats'],
      ]) void queryClient.invalidateQueries({ queryKey });
      onCreated(sample.cipher);
    },
    onError: (cause: unknown) => {
      const message = isAxiosError(cause) ? cause.response?.data?.message : undefined;
      setError(Array.isArray(message) ? message.join('. ') : typeof message === 'string'
        ? message : 'Не удалось добавить пробу. Проверьте соединение и попробуйте снова.');
    },
  });

  const allowedTypes: Platform['type'][] = data.analysisCode === 'БХ' ? ['DO']
    : data.analysisCode === 'ВХ' ? ['V'] : ['PP', 'SK'];
  const availablePlatforms = (platforms.data || []).filter((platform) => allowedTypes.includes(platform.type));
  const suggestedCipher = `${String(data.platformNumber).padStart(2, '0')}${data.analysisCode}.${String(data.layerNumber).padStart(2, '0')}`;

  function changeAnalysis(analysisCode: CreateSampleData['analysisCode']) {
    const preset = ANALYSES.find((analysis) => analysis.value === analysisCode)!;
    const platformType = analysisCode === 'БХ' ? 'DO' : analysisCode === 'ВХ' ? 'V'
      : data.platformType === 'SK' ? 'SK' : 'PP';
    if (platformType !== data.platformType) setSelectedPlatform('new');
    setData({ ...data, analysisCode, platformType, mass: preset.mass, depthFrom: 0, depthTo: preset.depthTo });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createMutation.isPending) return;
    setError('');
    if (!data.cipher.trim() || !data.mass.trim()) {
      setError('Укажите шифр пробы и массу/объём с тарой.');
      return;
    }
    if (data.depthTo < data.depthFrom) {
      setError('Глубина «до» не может быть меньше глубины «от».');
      return;
    }
    createMutation.mutate({ ...data, cipher: data.cipher.trim(), mass: data.mass.trim() });
  }

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Добавление пробы</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <fieldset disabled={createMutation.isPending} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input name="sample-cipher" label="Шифр пробы" required maxLength={200} autoFocus
                value={data.cipher} placeholder={`Например, ${suggestedCipher}`}
                onChange={(event) => setData({ ...data, cipher: event.target.value })} />
              <Select name="sample-analysis" label="Вид анализа" options={ANALYSES} value={data.analysisCode}
                onChange={(event) => changeAnalysis(event.target.value as CreateSampleData['analysisCode'])} />
              <div className="sm:col-span-2">
                <Select name="sample-platform" label="Площадка" value={selectedPlatform}
                  options={[
                    { value: 'new', label: 'Указать тип и номер площадки' },
                    ...availablePlatforms.map((platform) => ({ value: platform.id, label: platform.label })),
                  ]}
                  onChange={(event) => {
                    setSelectedPlatform(event.target.value);
                    const platform = availablePlatforms.find((item) => item.id === event.target.value);
                    if (platform) setData({ ...data, platformType: platform.type, platformNumber: platform.number });
                  }} />
                {platforms.isPending && <p className="text-sm text-[var(--text-secondary)] mt-1">Загрузка площадок…</p>}
                {platforms.isError && (
                  <p className="text-sm text-red-400 mt-1" role="alert">
                    Не удалось загрузить площадки. Можно указать тип и номер вручную.{' '}
                    <button type="button" className="underline" onClick={() => void platforms.refetch()}>Повторить</button>
                  </p>
                )}
              </div>
              {selectedPlatform === 'new' && <>
                <Select name="sample-platform-type" label="Тип площадки" value={data.platformType}
                  options={allowedTypes.map((value) => ({ value, label: PLATFORM_LABELS[value] }))}
                  onChange={(event) => setData({ ...data, platformType: event.target.value as Platform['type'] })} />
                <Input name="sample-platform-number" label="Номер площадки" type="number" min={1} max={2147483647} step={1} required
                  value={Number.isNaN(data.platformNumber) ? '' : data.platformNumber}
                  onChange={(event) => setData({ ...data, platformNumber: event.target.valueAsNumber })} />
                <p className="sm:col-span-2 text-sm text-[var(--text-secondary)]">
                  Если такая площадка уже есть в объекте, проба будет добавлена в неё. Иначе площадка создастся автоматически.
                </p>
              </>}
              <Input name="sample-layer" label="Номер слоя" type="number" min={1} max={2147483647} step={1} required
                value={Number.isNaN(data.layerNumber) ? '' : data.layerNumber}
                onChange={(event) => setData({ ...data, layerNumber: event.target.valueAsNumber })} />
              <Input name="sample-mass" label="Масса/объём и тара" required maxLength={200} value={data.mass}
                onChange={(event) => setData({ ...data, mass: event.target.value })} />
              <Input name="sample-depth-from" label="Глубина от, м" type="number" min={0} step="any" required
                value={Number.isNaN(data.depthFrom) ? '' : data.depthFrom}
                onChange={(event) => setData({ ...data, depthFrom: event.target.valueAsNumber })} />
              <Input name="sample-depth-to" label="Глубина до, м" type="number" min={data.depthFrom || 0} step="any" required
                value={Number.isNaN(data.depthTo) ? '' : data.depthTo}
                onChange={(event) => setData({ ...data, depthTo: event.target.valueAsNumber })} />
            </div>
            {data.analysisCode === 'ВХ' && <p className="text-sm text-[var(--text-secondary)]">Если глубина не применяется, оставьте оба значения равными 0.</p>}
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Добавить пробу</Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
