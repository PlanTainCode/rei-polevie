/**
 * Блоки конструктора: основание, исполнители, цели и задачи, виды изысканий,
 * техногенные воздействия, экологическая обстановка, прилагаемые документы.
 */

import { useRef, useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import {
  BASIC_SURVEY_TYPES,
  SPECIAL_SURVEY_TYPES,
  SURVEY_DEFAULTS,
  emptyResearcher,
  emptySurvey,
  emptySurveyAuthor,
  type Ecology,
  type Researcher,
  type Survey,
  type TextBlock,
} from '@tz-xml';
import { technicalTasksApi } from '@/api/technical-tasks';
import { AddButton, Grid, RemoveButton, Section, SelectField, StringListField, TextBlockField, TextField, Toggle, errorFor } from './fields';
import { EntrepreneurEditor, OrganizationEditor } from './entities';
import { DocumentsEditor } from './DocumentsEditor';
import type { BlockProps } from './types';

export function InitiationDocumentsBlock({ taskId, model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  return (
    <Section title="Документы — основание для выполнения работ" description="Обычно договор на выполнение изысканий. Файл договора нужен с контрольной суммой — прикрепите его.">
      <DocumentsEditor
        taskId={taskId}
        value={model.initiationDocuments}
        onChange={(initiationDocuments) => onChange({ ...model, initiationDocuments })}
        issues={issues}
        path="initiationDocuments"
        defaultTypeCode="05.99"
        provenance={prov['initiationDocuments']}
        referenceCandidates={[...model.initiationDocuments.documents, ...model.availableDocuments.documents]}
      />
    </Section>
  );
}

export function AvailableDocumentsBlock({ taskId, model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  return (
    <Section title="Документы, прилагаемые к заданию" description="Ситуационный план, ГПЗУ, правоустанавливающие документы, материалы прошлых изысканий и т.п.">
      <DocumentsEditor
        taskId={taskId}
        value={model.availableDocuments}
        onChange={(availableDocuments) => onChange({ ...model, availableDocuments })}
        issues={issues}
        path="availableDocuments"
        defaultTypeCode="99.99"
        provenance={prov['availableDocuments']}
        referenceCandidates={[...model.initiationDocuments.documents, ...model.availableDocuments.documents]}
      />
    </Section>
  );
}

function ContractFiles({ taskId, researcher, onChange, error }: { taskId: string; researcher: Researcher; onChange: (r: Researcher) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const u = await technicalTasksApi.uploadAttachment(taskId, file);
      onChange({ ...researcher, contract: { ...researcher.contract, files: [...researcher.contract.files, { fileUrl: u.fileUrl, name: u.name, format: u.format, checksum: u.checksum, size: u.size }] } });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-[var(--text-secondary)]">
        Файл договора <span className="text-red-400">*</span>
      </div>
      {researcher.contract.files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 text-sm px-3 py-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <Paperclip className="w-4 h-4 text-[var(--text-secondary)]" />
          <span className="flex-1 truncate">{f.name}</span>
          <span className="font-mono text-xs text-[var(--text-secondary)]">CRC32 {f.checksum}</span>
          <button type="button" className="p-1 text-red-400 hover:bg-red-500/20 rounded" onClick={() => onChange({ ...researcher, contract: { ...researcher.contract, files: researcher.contract.files.filter((_, j) => j !== i) } })}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <input ref={input} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />} Прикрепить файл
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function ResearchersBlock({ taskId, model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  const list = model.researchers;
  const setList = (researchers: Researcher[]) => onChange({ ...model, researchers });
  return (
    <div className="space-y-4">
      <Section
        title="Лица, заключившие договоры на выполнение изысканий"
        description="Исполнитель (РЭИ) подставляется из карточки компании. Организация должна быть в реестре НОПРИЗ."
        actions={<Toggle label="Включить блок" checked={model.enabled.researchers} onChange={(researchers) => onChange({ ...model, enabled: { ...model.enabled, researchers } })} />}
      >
        {model.enabled.researchers && (
          <>
            {errorFor(issues, 'researchers') && <p className="text-sm text-red-400">{errorFor(issues, 'researchers')}</p>}
            {list.map((r, i) => (
              <div key={i} className="p-3 rounded-lg border border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Исполнитель {i + 1}</span>
                  <RemoveButton onClick={() => setList(list.filter((_, j) => j !== i))} />
                </div>
                <SelectField
                  label="Форма"
                  value={r.kind}
                  onChange={(kind) => setList(list.map((x, j) => (j === i ? { ...x, kind: kind as Researcher['kind'] } : x)))}
                  options={[
                    { code: 'ORGANIZATION', label: 'Юридическое лицо' },
                    { code: 'ENTREPRENEUR', label: 'Индивидуальный предприниматель' },
                  ]}
                  allowEmpty={false}
                />
                {r.kind === 'ORGANIZATION' ? (
                  <OrganizationEditor value={r.organization} onChange={(organization) => setList(list.map((x, j) => (j === i ? { ...x, organization } : x)))} issues={issues} path={`researchers[${i}].organization`} nopriz provenance={prov[`researchers[${i}].organization`]} />
                ) : (
                  <EntrepreneurEditor value={r.entrepreneur} onChange={(entrepreneur) => setList(list.map((x, j) => (j === i ? { ...x, entrepreneur } : x)))} issues={issues} path={`researchers[${i}].entrepreneur`} nopriz />
                )}
                <Grid cols={2}>
                  <TextField label="Номер договора" value={r.contract.number} onChange={(number) => setList(list.map((x, j) => (j === i ? { ...x, contract: { ...x.contract, number } } : x)))} required error={errorFor(issues, `researchers[${i}].contract.number`)} />
                  <TextField label="Дата договора" type="date" value={r.contract.date} onChange={(date) => setList(list.map((x, j) => (j === i ? { ...x, contract: { ...x.contract, date } } : x)))} required error={errorFor(issues, `researchers[${i}].contract.date`)} />
                </Grid>
                <ContractFiles taskId={taskId} researcher={r} onChange={(v) => setList(list.map((x, j) => (j === i ? v : x)))} error={errorFor(issues, `researchers[${i}].contract.files`)} />
              </div>
            ))}
            <AddButton onClick={() => setList([...list, emptyResearcher()])} label="Добавить исполнителя" />
          </>
        )}
      </Section>
    </div>
  );
}

export function PurposesBlock({ model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  return (
    <Section title="Цели и задачи инженерных изысканий" description="Общие для всего задания. Цели и задачи по каждому виду изысканий задаются в блоке «Виды изысканий».">
      <StringListField label="Цели" values={model.purposes} onChange={(purposes) => onChange({ ...model, purposes })} required provenance={prov['purposes']} error={errorFor(issues, 'purposes')} addLabel="Добавить цель" />
      <StringListField label="Задачи" values={model.tasks} onChange={(tasks) => onChange({ ...model, tasks })} required provenance={prov['tasks']} error={errorFor(issues, 'tasks')} addLabel="Добавить задачу" />
    </Section>
  );
}

const KIND_OPTIONS = [
  { code: 'BASIC', label: 'Основной вид' },
  { code: 'SPECIAL', label: 'Специальный вид' },
  { code: 'OTHER', label: 'Иное исследование' },
];

export function SurveysBlock({ model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  const list = model.surveys;
  const setList = (surveys: Survey[]) => onChange({ ...model, surveys });
  const setAt = (i: number, s: Survey) => setList(list.map((x, j) => (j === i ? s : x)));

  const changeType = (i: number, s: Survey, typeCode: string) => {
    const d = SURVEY_DEFAULTS[typeCode];
    const keep = s.purposes.some(Boolean) || s.tasks.some(Boolean);
    setAt(i, { ...s, typeCode, purposes: keep ? s.purposes : d ? [...d.purposes] : [], tasks: keep ? s.tasks : d ? [...d.tasks] : [] });
  };

  return (
    <div className="space-y-4">
      {errorFor(issues, 'surveys') && <p className="text-sm text-red-400">{errorFor(issues, 'surveys')}</p>}
      {list.map((s, i) => {
        const p = `surveys[${i}]`;
        const title = s.kind === 'OTHER' ? s.otherNames[0] || 'Иное исследование' : [...BASIC_SURVEY_TYPES, ...SPECIAL_SURVEY_TYPES].find((d) => d.code === s.typeCode)?.label || 'Вид изысканий';
        return (
          <Section key={i} title={title} actions={<RemoveButton onClick={() => setList(list.filter((_, j) => j !== i))} />}>
            {errorFor(issues, p) && <p className="text-sm text-red-400">{errorFor(issues, p)}</p>}
            <Grid cols={2}>
              <SelectField label="Группа" value={s.kind} onChange={(kind) => setAt(i, { ...s, kind: kind as Survey['kind'], typeCode: '' })} options={KIND_OPTIONS} allowEmpty={false} />
              {s.kind === 'BASIC' && <SelectField label="Вид изысканий" value={s.typeCode} onChange={(v) => changeType(i, s, v)} options={BASIC_SURVEY_TYPES} required provenance={prov['surveys']} error={errorFor(issues, `${p}.typeCode`)} />}
              {s.kind === 'SPECIAL' && <SelectField label="Вид изысканий" value={s.typeCode} onChange={(v) => changeType(i, s, v)} options={SPECIAL_SURVEY_TYPES} required error={errorFor(issues, `${p}.typeCode`)} />}
            </Grid>
            {s.kind === 'OTHER' && <StringListField label="Наименование исследования" values={s.otherNames} onChange={(otherNames) => setAt(i, { ...s, otherNames })} required multiline={false} error={errorFor(issues, `${p}.otherNames`)} addLabel="Добавить наименование" />}
            <StringListField label="Цели" values={s.purposes} onChange={(purposes) => setAt(i, { ...s, purposes })} required error={errorFor(issues, `${p}.purposes`)} addLabel="Добавить цель" />
            <StringListField label="Задачи" values={s.tasks} onChange={(tasks) => setAt(i, { ...s, tasks })} required error={errorFor(issues, `${p}.tasks`)} addLabel="Добавить задачу" />
            <TextBlockField label="Дополнительные требования к отдельным видам работ (отраслевая специфика)" value={s.additionalRequirements} onChange={(additionalRequirements) => setAt(i, { ...s, additionalRequirements })} />
            <div className="space-y-2">
              <Toggle label="Указать исполнителя отчётной документации по этому виду" hint="организация или ИП из реестра НОПРИЗ" checked={s.authors.length > 0} onChange={(v) => setAt(i, { ...s, authors: v ? [emptySurveyAuthor()] : [] })} />
              {s.authors[0] && (
                <div className="p-3 rounded-lg border border-[var(--border-color)] space-y-3">
                  <SelectField
                    label="Форма"
                    value={s.authors[0].kind}
                    onChange={(kind) => setAt(i, { ...s, authors: [{ ...s.authors[0], kind: kind as 'ORGANIZATION' | 'ENTREPRENEUR' }] })}
                    options={[
                      { code: 'ORGANIZATION', label: 'Юридическое лицо' },
                      { code: 'ENTREPRENEUR', label: 'Индивидуальный предприниматель' },
                    ]}
                    allowEmpty={false}
                  />
                  {s.authors[0].kind === 'ORGANIZATION' ? (
                    <OrganizationEditor value={s.authors[0].organization} onChange={(organization) => setAt(i, { ...s, authors: [{ ...s.authors[0], organization }] })} issues={issues} path={`${p}.authors[0].organization`} nopriz provenance={prov[`${p}.authors`]} />
                  ) : (
                    <EntrepreneurEditor value={s.authors[0].entrepreneur} onChange={(entrepreneur) => setAt(i, { ...s, authors: [{ ...s.authors[0], entrepreneur }] })} issues={issues} path={`${p}.authors[0].entrepreneur`} nopriz />
                  )}
                </div>
              )}
            </div>
          </Section>
        );
      })}
      <div className="flex flex-wrap gap-4">
        <AddButton onClick={() => setList([...list, emptySurvey('BASIC', '')])} label="Добавить основной вид" />
        <AddButton onClick={() => setList([...list, emptySurvey('SPECIAL', '')])} label="Добавить специальный вид" />
        <AddButton onClick={() => setList([...list, emptySurvey('OTHER', '')])} label="Добавить иное исследование" />
      </div>
    </div>
  );
}

export function TechnogenicBlock({ model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  return (
    <Section title="Предполагаемые техногенные воздействия объекта на окружающую среду" actions={<Toggle label="Включить блок" checked={model.enabled.technogenicImpacts} onChange={(technogenicImpacts) => onChange({ ...model, enabled: { ...model.enabled, technogenicImpacts } })} />}>
      {model.enabled.technogenicImpacts && (
        <TextBlockField label="Описание воздействий" value={model.technogenicImpacts} onChange={(technogenicImpacts) => onChange({ ...model, technogenicImpacts })} required provenance={prov['technogenicImpacts']} error={errorFor(issues, 'technogenicImpacts')} />
      )}
    </Section>
  );
}

const ECOLOGY_FIELDS: { key: keyof Ecology; label: string }[] = [
  { key: 'existingPollutionSources', label: 'Существующие источники загрязнения окружающей среды' },
  { key: 'plannedPollutionSources', label: 'Проектируемые источники загрязнения' },
  { key: 'possibleAccident', label: 'Место и тип возможной аварии' },
  { key: 'landWithdraw', label: 'Границы и площадь изъятия земель разной категории' },
  { key: 'waterSource', label: 'Место предполагаемого забора воды из поверхностных источников' },
  { key: 'waterRelease', label: 'Место проектируемого сброса сточных вод' },
];

export function EcologyBlock({ model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  const set = (key: keyof Ecology, v: TextBlock) => onChange({ ...model, ecology: { ...model.ecology, [key]: v } });
  return (
    <Section title="Описание экологической обстановки" actions={<Toggle label="Включить блок" checked={model.enabled.ecology} onChange={(ecology) => onChange({ ...model, enabled: { ...model.enabled, ecology } })} />}>
      {model.enabled.ecology && (
        <>
          {errorFor(issues, 'ecology') && <p className="text-sm text-red-400">{errorFor(issues, 'ecology')}</p>}
          {ECOLOGY_FIELDS.map((f) => (
            <TextBlockField key={f.key} label={f.label} value={model.ecology[f.key]} onChange={(v) => set(f.key, v)} provenance={prov[`ecology.${f.key}`]} />
          ))}
        </>
      )}
    </Section>
  );
}
