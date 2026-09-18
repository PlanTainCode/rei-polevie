/**
 * Блоки конструктора: границы площадки/трассы, опасные процессы и грунты,
 * требования к выполнению изысканий.
 */

import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, X } from 'lucide-react';
import {
  DANGEROUS_PROCESSES,
  SPECIFIC_SOILS,
  YES_NO,
  emptyArea,
  emptyLinearRoute,
  regionalCoordinateSystem,
  stateCoordinateSystem,
  type Area,
  type CoordinateSystem,
  type LinearRoute,
  type OutsideControl,
  type Point,
  type Requirements,
} from '@tz-xml';
import { technicalTasksApi } from '@/api/technical-tasks';
import { AddButton, Grid, MultiSelectField, RemoveButton, Section, SelectField, StringListField, TextBlockField, TextField, Toggle, errorFor } from './fields';
import { ControlPersonEditor, EntrepreneurEditor, OrganizationEditor } from './entities';
import { DocumentsEditor } from './DocumentsEditor';
import type { BlockProps } from './types';

// ---------------------------------------------------------------------------
// Границы
// ---------------------------------------------------------------------------

function BoundaryImagePreview({ taskId, fileUrl }: { taskId: string; fileUrl: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    technicalTasksApi
      .fetchAttachmentBlobUrl(taskId, fileUrl)
      .then((u) => {
        url = u;
        setSrc(u);
      })
      .catch(() => setSrc(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [taskId, fileUrl]);
  if (!src) return <div className="w-32 h-24 rounded bg-[var(--bg-tertiary)] flex items-center justify-center"><ImageIcon className="w-6 h-6 opacity-40" /></div>;
  return <img src={src} alt="" className="w-32 h-24 object-cover rounded border border-[var(--border-color)]" />;
}

const CS_KINDS = [
  { code: 'REGIONAL', label: 'Местная (МСК)' },
  { code: 'STATE', label: 'Государственная (ГСК-2011)' },
  { code: 'LOCAL', label: 'Локальная' },
  { code: 'INTERNATIONAL', label: 'Международная' },
];

function CoordinateSystemEditor({ value, onChange, error }: { value: CoordinateSystem; onChange: (v: CoordinateSystem) => void; error?: string }) {
  const changeKind = (kind: string) => {
    if (kind === 'STATE') onChange(stateCoordinateSystem());
    else if (kind === 'REGIONAL') onChange(regionalCoordinateSystem(value.kind === 'REGIONAL' ? value.name : 'МСК'));
    else onChange({ kind: kind as CoordinateSystem['kind'], name: '', heightSystem: '' });
  };
  const fixedName = value.kind === 'STATE';
  const fixedHeight = value.kind === 'STATE' || value.kind === 'REGIONAL';
  return (
    <Grid cols={3}>
      <SelectField label="Система координат" value={value.kind} onChange={changeKind} options={CS_KINDS} allowEmpty={false} error={error} />
      <TextField label="Наименование системы координат" value={value.name} onChange={(name) => onChange({ ...value, name })} required placeholder="МСК-77" className={fixedName ? 'opacity-70 pointer-events-none' : ''} />
      <TextField label="Система высот" value={value.heightSystem} onChange={(heightSystem) => onChange({ ...value, heightSystem })} required className={fixedHeight ? 'opacity-70 pointer-events-none' : ''} />
    </Grid>
  );
}

function PointsEditor({ points, onChange, min = 3, error }: { points: Point[]; onChange: (p: Point[]) => void; min?: number; error?: string }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-[var(--text-secondary)]">
        Точки (X, Y) <span className="text-red-400">*</span> <span className="text-xs font-normal">не меньше {min}</span>
      </div>
      {points.map((pt, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-xs w-6 text-[var(--text-secondary)]">{i + 1}</span>
          <input value={pt.x} placeholder="X" onChange={(e) => onChange(points.map((p, j) => (j === i ? { ...p, x: e.target.value } : p)))} className="w-40 h-9 px-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm font-mono" />
          <input value={pt.y} placeholder="Y" onChange={(e) => onChange(points.map((p, j) => (j === i ? { ...p, y: e.target.value } : p)))} className="w-40 h-9 px-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm font-mono" />
          <button type="button" className="p-1 text-red-400 hover:bg-red-500/20 rounded" onClick={() => onChange(points.filter((_, j) => j !== i))}>
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <AddButton onClick={() => onChange([...points, { x: '', y: '' }])} label="Добавить точку" />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function BoundariesBlock({ taskId, model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  const b = model.boundaries;
  const setB = (patch: Partial<typeof b>) => onChange({ ...model, boundaries: { ...b, ...patch } });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setUploadError(null);
    try {
      const u = await technicalTasksApi.uploadAttachment(taskId, file);
      if (!u.imageType) throw new Error('Нужно изображение png, jpg или gif');
      setB({ images: [...b.images, { fileUrl: u.fileUrl, name: u.name, type: u.imageType }] });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Не удалось загрузить');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const setArea = (i: number, a: Area) => setB({ areas: b.areas.map((x, j) => (j === i ? a : x)) });
  const setRoute = (i: number, r: LinearRoute) => setB({ linearRoutes: b.linearRoutes.map((x, j) => (j === i ? r : x)) });

  return (
    <div className="space-y-4">
      <Section title="Графическое изображение площадки или трассы" description="Обязательно хотя бы одно изображение (png, jpg, gif). Подойдёт ситуационный план или скриншот карты с границами.">
        {errorFor(issues, 'boundaries.images') && <p className="text-sm text-red-400">{errorFor(issues, 'boundaries.images')}</p>}
        <div className="flex flex-wrap gap-4">
          {b.images.map((img, i) => (
            <div key={img.fileUrl} className="space-y-2 w-48">
              <div className="relative">
                <BoundaryImagePreview taskId={taskId} fileUrl={img.fileUrl} />
                <button type="button" className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500/80 text-white" onClick={() => setB({ images: b.images.filter((_, j) => j !== i) })}>
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="text-xs truncate text-[var(--text-secondary)]">{img.name}</div>
              <input value={img.comment ?? ''} placeholder="Подпись" onChange={(e) => setB({ images: b.images.map((x, j) => (j === i ? { ...x, comment: e.target.value || undefined } : x)) })} className="w-full h-8 px-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs" />
            </div>
          ))}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Загрузить изображение
        </button>
        {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
      </Section>

      <Section title="Координаты участков" actions={<Toggle label="Указать координаты" checked={model.enabled.areas} onChange={(areas) => onChange({ ...model, enabled: { ...model.enabled, areas } })} />}>
        {model.enabled.areas && (
          <>
            {errorFor(issues, 'boundaries.areas') && <p className="text-sm text-red-400">{errorFor(issues, 'boundaries.areas')}</p>}
            {b.areas.map((a, i) => (
              <div key={i} className="p-3 rounded-lg border border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <TextField label="Наименование участка" value={a.name} onChange={(name) => setArea(i, { ...a, name: name || undefined })} className="flex-1 mr-4" />
                  <RemoveButton onClick={() => setB({ areas: b.areas.filter((_, j) => j !== i) })} />
                </div>
                <CoordinateSystemEditor value={a.coordinateSystem} onChange={(coordinateSystem) => setArea(i, { ...a, coordinateSystem })} error={errorFor(issues, `boundaries.areas[${i}].coordinateSystem`)} />
                <PointsEditor points={a.points} onChange={(points) => setArea(i, { ...a, points })} error={errorFor(issues, `boundaries.areas[${i}]`)} />
              </div>
            ))}
            <AddButton onClick={() => setB({ areas: [...b.areas, emptyArea()] })} label="Добавить участок" />
          </>
        )}
      </Section>

      <Section title="Маршруты трасс линейных объектов" actions={<Toggle label="Указать трассы" checked={model.enabled.linearRoutes} onChange={(linearRoutes) => onChange({ ...model, enabled: { ...model.enabled, linearRoutes } })} />}>
        {model.enabled.linearRoutes && (
          <>
            {errorFor(issues, 'boundaries.linearRoutes') && <p className="text-sm text-red-400">{errorFor(issues, 'boundaries.linearRoutes')}</p>}
            {b.linearRoutes.map((r, i) => (
              <div key={i} className="p-3 rounded-lg border border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <TextField label="Наименование трассы" value={r.name} onChange={(name) => setRoute(i, { ...r, name: name || undefined })} className="flex-1 mr-4" />
                  <RemoveButton onClick={() => setB({ linearRoutes: b.linearRoutes.filter((_, j) => j !== i) })} />
                </div>
                <CoordinateSystemEditor value={r.coordinateSystem} onChange={(coordinateSystem) => setRoute(i, { ...r, coordinateSystem })} />
                <Grid cols={2}>
                  <TextField label="Начало: X" value={r.startPoint.x} onChange={(x) => setRoute(i, { ...r, startPoint: { ...r.startPoint, x } })} required error={errorFor(issues, `boundaries.linearRoutes[${i}].startPoint`)} />
                  <TextField label="Начало: Y" value={r.startPoint.y} onChange={(y) => setRoute(i, { ...r, startPoint: { ...r.startPoint, y } })} required />
                </Grid>
                <PointsEditor points={r.middlePoints} onChange={(middlePoints) => setRoute(i, { ...r, middlePoints })} min={0} />
                <Grid cols={2}>
                  <TextField label="Конец: X" value={r.finishPoint.x} onChange={(x) => setRoute(i, { ...r, finishPoint: { ...r.finishPoint, x } })} required error={errorFor(issues, `boundaries.linearRoutes[${i}].finishPoint`)} />
                  <TextField label="Конец: Y" value={r.finishPoint.y} onChange={(y) => setRoute(i, { ...r, finishPoint: { ...r.finishPoint, y } })} required />
                </Grid>
              </div>
            ))}
            <AddButton onClick={() => setB({ linearRoutes: [...b.linearRoutes, emptyLinearRoute()] })} label="Добавить трассу" />
          </>
        )}
      </Section>

      <Section title="Дополнительно">
        <TextBlockField label="Сведения о проектируемых планировочных отметках" value={b.projectedPlanningMarks} onChange={(projectedPlanningMarks) => setB({ projectedPlanningMarks })} />
        <TextBlockField label="Работы за границей землеотвода, площадь работ, описание границ" value={b.areaOutWorks} onChange={(areaOutWorks) => setB({ areaOutWorks })} provenance={prov['boundaries.areaOutWorks']} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Опасные процессы
// ---------------------------------------------------------------------------

export function DangerousBlock({ model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  const d = model.dangerous;
  const setD = (patch: Partial<typeof d>) => onChange({ ...model, dangerous: { ...d, ...patch } });
  return (
    <div className="space-y-4">
      <Section title="Опасные природные процессы и явления" description="Хотя бы один процесс из справочника. Для Москвы и области обычно «подтопление» и (или) «пучение».">
        <MultiSelectField label="Предполагаемые опасные процессы" values={d.processes} onChange={(processes) => setD({ processes })} options={DANGEROUS_PROCESSES} required columns={3} provenance={prov['dangerous.processes']} error={errorFor(issues, 'dangerous.processes')} />
        <TextBlockField label="Дополнительное описание опасных процессов" value={d.processesAdditional} onChange={(processesAdditional) => setD({ processesAdditional })} provenance={prov['dangerous.processesAdditional']} />
      </Section>
      <Section title="Многолетнемёрзлые грунты">
        <Grid cols={2}>
          <SelectField label="Наличие многолетнемёрзлых грунтов" value={d.permafrost} onChange={(permafrost) => setD({ permafrost: permafrost as typeof d.permafrost })} options={YES_NO} allowEmpty={false} required error={errorFor(issues, 'dangerous.permafrost')} />
        </Grid>
        <TextBlockField label="Описание многолетнемёрзлых грунтов" value={d.permafrostAdditional} onChange={(permafrostAdditional) => setD({ permafrostAdditional })} />
      </Section>
      <Section title="Специфические грунты">
        <MultiSelectField label="Специфические грунты" values={d.soils} onChange={(soils) => setD({ soils })} options={SPECIFIC_SOILS} columns={3} provenance={prov['dangerous.soils']} error={errorFor(issues, 'dangerous.soils')} />
        <TextBlockField label="Описание специфических грунтов" value={d.soilsAdditional} onChange={(soilsAdditional) => setD({ soilsAdditional })} />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Требования
// ---------------------------------------------------------------------------

const OUTSIDE_BY = [
  { code: 'DEVELOPER', label: 'Силами застройщика' },
  { code: 'TECHNICAL_CUSTOMER', label: 'Силами технического заказчика' },
  { code: 'ORGANIZATION', label: 'Сторонняя специализированная организация' },
];

export function RequirementsBlock({ taskId, model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  const q = model.requirements;
  const setQ = (patch: Partial<Requirements>) => onChange({ ...model, requirements: { ...q, ...patch } });
  const outside = q.controlQuality.outside;
  const setOutside = (o: OutsideControl | undefined) => setQ({ controlQuality: { ...q.controlQuality, outside: o } });
  const en = model.enabled;
  const setEnabled = (patch: Partial<typeof en>) => onChange({ ...model, enabled: { ...en, ...patch } });

  return (
    <div className="space-y-4">
      <Section title="Требования к выполнению изысканий">
        <TextBlockField label="Требование о научном сопровождении и дополнительных исследованиях" value={q.scientificSupport} onChange={(scientificSupport) => setQ({ scientificSupport })} required provenance={prov['requirements.scientificSupport']} error={errorFor(issues, 'requirements.scientificSupport')} />
        <TextBlockField label="Требования к точности и обеспеченности данных, превышающие НД" value={q.accuracySecurity} onChange={(accuracySecurity) => setQ({ accuracySecurity })} required provenance={prov['requirements.accuracySecurity']} error={errorFor(issues, 'requirements.accuracySecurity')} />
        <TextBlockField label="Требования к составлению прогноза изменения природных условий" value={q.forecastChangesNaturalConditions} onChange={(forecastChangesNaturalConditions) => setQ({ forecastChangesNaturalConditions })} required provenance={prov['requirements.forecastChangesNaturalConditions']} error={errorFor(issues, 'requirements.forecastChangesNaturalConditions')} />
        <div className="space-y-2">
          <Toggle label="Требования о подготовке предложений по инженерной защите" checked={en.suggestionsRecommendation} onChange={(suggestionsRecommendation) => setEnabled({ suggestionsRecommendation })} />
          {en.suggestionsRecommendation && <TextBlockField label="Предложения и рекомендации по инженерной защите" value={q.suggestionsRecommendation} onChange={(suggestionsRecommendation) => setQ({ suggestionsRecommendation })} required error={errorFor(issues, 'requirements.suggestionsRecommendation')} />}
        </div>
      </Section>

      <Section title="Контроль качества">
        {errorFor(issues, 'requirements.controlQuality') && <p className="text-sm text-red-400">{errorFor(issues, 'requirements.controlQuality')}</p>}
        <TextBlockField label="Внутренний контроль качества" value={q.controlQuality.inside} onChange={(inside) => setQ({ controlQuality: { ...q.controlQuality, inside } })} provenance={prov['requirements.controlQuality']} />
        <Toggle label="Внешний контроль качества" checked={!!outside} onChange={(v) => setOutside(v ? { by: 'DEVELOPER', representatives: [], organizations: [] } : undefined)} />
        {outside && (
          <div className="space-y-3 p-3 rounded-lg border border-[var(--border-color)]">
            <TextBlockField label="Описание внешнего контроля" value={outside.description} onChange={(description) => setOutside({ ...outside, description })} />
            <SelectField label="Кто обеспечивает" value={outside.by} onChange={(by) => setOutside({ ...outside, by: by as OutsideControl['by'] })} options={OUTSIDE_BY} allowEmpty={false} />
            {outside.by !== 'ORGANIZATION' ? (
              <div className="space-y-3">
                {errorFor(issues, 'requirements.controlQuality.outside.representatives') && <p className="text-sm text-red-400">{errorFor(issues, 'requirements.controlQuality.outside.representatives')}</p>}
                {outside.representatives.map((p, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)]/40 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Представитель {i + 1}</span>
                      <RemoveButton onClick={() => setOutside({ ...outside, representatives: outside.representatives.filter((_, j) => j !== i) })} />
                    </div>
                    <ControlPersonEditor value={p} onChange={(v) => setOutside({ ...outside, representatives: outside.representatives.map((x, j) => (j === i ? v : x)) })} issues={issues} path={`requirements.controlQuality.outside.representatives[${i}]`} />
                  </div>
                ))}
                <AddButton onClick={() => setOutside({ ...outside, representatives: [...outside.representatives, { surname: '', name: '' }] })} label="Добавить представителя" />
              </div>
            ) : (
              <div className="space-y-3">
                {errorFor(issues, 'requirements.controlQuality.outside.organizations') && <p className="text-sm text-red-400">{errorFor(issues, 'requirements.controlQuality.outside.organizations')}</p>}
                {outside.organizations.map((og, i) => {
                  const p = `requirements.controlQuality.outside.organizations[${i}]`;
                  const setOg = (v: typeof og) => setOutside({ ...outside, organizations: outside.organizations.map((x, j) => (j === i ? v : x)) });
                  return (
                    <div key={i} className="p-3 rounded-lg bg-[var(--bg-tertiary)]/40 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Организация {i + 1}</span>
                        <RemoveButton onClick={() => setOutside({ ...outside, organizations: outside.organizations.filter((_, j) => j !== i) })} />
                      </div>
                      <SelectField label="Форма" value={og.kind} onChange={(kind) => setOg({ ...og, kind: kind as typeof og.kind })} options={[{ code: 'ORGANIZATION', label: 'Юридическое лицо' }, { code: 'ENTREPRENEUR', label: 'Индивидуальный предприниматель' }]} allowEmpty={false} />
                      {og.kind === 'ORGANIZATION' ? (
                        <OrganizationEditor value={og.organization} onChange={(organization) => setOg({ ...og, organization })} issues={issues} path={`${p}.organization`} />
                      ) : (
                        <EntrepreneurEditor value={og.entrepreneur} onChange={(entrepreneur) => setOg({ ...og, entrepreneur })} issues={issues} path={`${p}.entrepreneur`} />
                      )}
                      {errorFor(issues, `${p}.representatives`) && <p className="text-sm text-red-400">{errorFor(issues, `${p}.representatives`)}</p>}
                      {og.representatives.map((rp, k) => (
                        <div key={k} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Представитель {k + 1}</span>
                            <RemoveButton onClick={() => setOg({ ...og, representatives: og.representatives.filter((_, j) => j !== k) })} />
                          </div>
                          <ControlPersonEditor value={rp} onChange={(v) => setOg({ ...og, representatives: og.representatives.map((x, j) => (j === k ? v : x)) })} issues={issues} path={`${p}.representatives[${k}]`} />
                        </div>
                      ))}
                      <AddButton onClick={() => setOg({ ...og, representatives: [...og.representatives, { surname: '', name: '' }] })} label="Добавить представителя" />
                    </div>
                  );
                })}
                <AddButton
                  onClick={() => setOutside({ ...outside, organizations: [...outside.organizations, { kind: 'ORGANIZATION', organization: { fullName: '', inn: '', kpp: '', address: { regionCode: '', oktmoCode: '', oktmoName: '' } }, entrepreneur: { surname: '', name: '', ogrnip: '', postAddress: { regionCode: '', oktmoCode: '', oktmoName: '' } }, representatives: [] }] })}
                  label="Добавить организацию"
                />
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Результаты и материалы">
        <TextBlockField label="Состав, форма и формат результатов, порядок передачи заказчику" value={q.compositionOrderTransfer} onChange={(compositionOrderTransfer) => setQ({ compositionOrderTransfer })} required provenance={prov['requirements.compositionOrderTransfer']} error={errorFor(issues, 'requirements.compositionOrderTransfer')} />
        <div className="space-y-2">
          <Toggle label="Материалы, передаваемые заказчиком во временное пользование" hint="результаты ранее выполненных изысканий, данные об осложнениях и авариях" checked={en.archivalMaterials} onChange={(archivalMaterials) => setEnabled({ archivalMaterials })} />
          {en.archivalMaterials && (
            <DocumentsEditor taskId={taskId} value={q.archivalMaterials ?? { documents: [] }} onChange={(archivalMaterials) => setQ({ archivalMaterials })} issues={issues} path="requirements.archivalMaterials" defaultTypeCode="06.04" provenance={prov['requirements.archivalMaterials']} referenceCandidates={[...model.initiationDocuments.documents, ...model.availableDocuments.documents]} />
          )}
        </div>
        <div className="space-y-2">
          <Toggle label="Требования к форме результатов для информационной модели" checked={en.modelFormat} onChange={(modelFormat) => setEnabled({ modelFormat })} />
          {en.modelFormat && <TextBlockField label="Требования к информационной модели" value={q.modelFormat} onChange={(modelFormat) => setQ({ modelFormat })} required error={errorFor(issues, 'requirements.modelFormat')} />}
        </div>
        <div className="space-y-2">
          <Toggle label="Перечень нормативных правовых актов и НД" checked={en.usedNorms} onChange={(usedNorms) => setEnabled({ usedNorms })} />
          {en.usedNorms && <StringListField label="Нормативные документы" values={q.usedNorms} onChange={(usedNorms) => setQ({ usedNorms })} required provenance={prov['requirements.usedNorms']} error={errorFor(issues, 'requirements.usedNorms')} addLabel="Добавить документ" />}
        </div>
      </Section>
    </div>
  );
}
