/**
 * Конструктор задания: слева список блоков схемы с индикацией ошибок и
 * переключателями необязательных блоков, справа редактор выбранного блока.
 */

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { TZ_BLOCKS, isBlockEnabled, issuesByBlock, validateModel, type TzXmlModel } from '@tz-xml';
import { ConstructionBlock, CustomerBlock, ObjectBlock, RequisitesBlock } from './blocks-object';
import { AvailableDocumentsBlock, EcologyBlock, InitiationDocumentsBlock, PurposesBlock, ResearchersBlock, SurveysBlock, TechnogenicBlock } from './blocks-surveys';
import { BoundariesBlock, DangerousBlock, RequirementsBlock } from './blocks-requirements';
import type { BlockProps } from './types';

const BLOCK_COMPONENTS: Record<string, (p: BlockProps) => JSX.Element> = {
  requisites: RequisitesBlock,
  object: ObjectBlock,
  initiationDocuments: InitiationDocumentsBlock,
  construction: ConstructionBlock,
  customer: CustomerBlock,
  researchers: ResearchersBlock,
  purposes: PurposesBlock,
  surveys: SurveysBlock,
  technogenicImpacts: TechnogenicBlock,
  ecology: EcologyBlock,
  boundaries: BoundariesBlock,
  dangerous: DangerousBlock,
  requirements: RequirementsBlock,
  availableDocuments: AvailableDocumentsBlock,
};

interface TzEditorProps {
  taskId: string;
  model: TzXmlModel;
  onChange: (model: TzXmlModel) => void;
  readOnly?: boolean;
}

export function TzEditor({ taskId, model, onChange, readOnly = false }: TzEditorProps) {
  const [active, setActive] = useState<string>('requisites');
  const issues = useMemo(() => validateModel(model), [model]);
  const counts = useMemo(() => issuesByBlock(issues), [issues]);
  const Block = BLOCK_COMPONENTS[active];

  const toggleBlock = (key: keyof TzXmlModel['enabled'], value: boolean) => {
    onChange({ ...model, enabled: { ...model.enabled, [key]: value } });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <aside className="space-y-1 lg:sticky lg:top-4 self-start">
        {TZ_BLOCKS.map((b) => {
          const enabled = isBlockEnabled(b.id, model.enabled);
          const n = counts[b.id] ?? 0;
          const isActive = active === b.id;
          return (
            <div key={b.id} className={`flex items-center gap-2 rounded-lg ${isActive ? 'bg-primary-500/15 border border-primary-500/40' : 'border border-transparent hover:bg-[var(--bg-tertiary)]'}`}>
              <button type="button" onClick={() => setActive(b.id)} className="flex-1 text-left px-3 py-2 flex items-center gap-2 min-w-0">
                {!enabled ? (
                  <Circle className="w-4 h-4 shrink-0 text-[var(--text-secondary)]/50" />
                ) : n > 0 ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                )}
                <span className={`text-sm truncate ${enabled ? '' : 'text-[var(--text-secondary)]'}`}>{b.title}</span>
                {enabled && n > 0 && <span className="ml-auto text-xs px-1.5 rounded-full bg-amber-500/20 text-amber-300">{n}</span>}
              </button>
              {!b.required && b.enabledKey && !readOnly && (
                <input type="checkbox" className="mr-3 accent-primary-500" title="Включить блок" checked={Boolean(model.enabled[b.enabledKey])} onChange={(e) => toggleBlock(b.enabledKey!, e.target.checked)} />
              )}
            </div>
          );
        })}
        <div className="pt-3 text-xs text-[var(--text-secondary)] px-3">
          {issues.length === 0 ? 'Все обязательные поля заполнены' : `Осталось заполнить: ${issues.length}`}
        </div>
      </aside>

      <div className={readOnly ? 'pointer-events-none opacity-70' : ''}>
        {Block ? <Block taskId={taskId} model={model} onChange={onChange} issues={issues} /> : null}
      </div>
    </div>
  );
}
