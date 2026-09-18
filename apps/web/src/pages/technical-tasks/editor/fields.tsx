/**
 * Примитивы полей конструктора ТЗ. Все поля контролируемые, стиль общий
 * с остальным приложением (Input/Select из components/ui).
 */

import { useId, type ReactNode } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { DictItem, TextBlock } from '@tz-xml';
import { Input, Select } from '@/components/ui';

export type Provenance = 'document' | 'default' | 'company' | 'manual' | undefined;

const PROVENANCE_LABEL: Record<NonNullable<Provenance>, { text: string; cls: string }> = {
  document: { text: 'из документа', cls: 'bg-cyan-500/15 text-cyan-300' },
  default: { text: 'типовое', cls: 'bg-amber-500/15 text-amber-300' },
  company: { text: 'из карточки компании', cls: 'bg-purple-500/15 text-purple-300' },
  manual: { text: 'вручную', cls: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]' },
};

export function ProvenanceTag({ value }: { value: Provenance }) {
  if (!value) return null;
  const p = PROVENANCE_LABEL[value];
  return <span className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${p.cls}`}>{p.text}</span>;
}

export function FieldLabel({ children, required, provenance, hint }: { children: ReactNode; required?: boolean; provenance?: Provenance; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="text-sm font-medium text-[var(--text-secondary)]">
        {children}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      <ProvenanceTag value={provenance} />
      {hint && <span className="text-xs text-[var(--text-secondary)]/70">{hint}</span>}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  provenance?: Provenance;
  error?: string;
  type?: 'text' | 'date' | 'number' | 'email';
  className?: string;
}

export function TextField({ label, value, onChange, required, placeholder, hint, provenance, error, type = 'text', className = '' }: TextFieldProps) {
  const id = useId();
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id}>
        <FieldLabel required={required} provenance={provenance} hint={hint}>
          {label}
        </FieldLabel>
      </label>
      <Input id={id} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} error={error} />
    </div>
  );
}

interface TextAreaFieldProps extends Omit<TextFieldProps, 'type'> {
  rows?: number;
}

export function TextAreaField({ label, value, onChange, required, placeholder, hint, provenance, error, rows = 3, className = '' }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id}>
        <FieldLabel required={required} provenance={provenance} hint={hint}>
          {label}
        </FieldLabel>
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors ${
          error ? 'border-red-500' : 'border-[var(--border-color)]'
        }`}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  options: DictItem[] | { code: string; label: string }[];
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  hint?: string;
  provenance?: Provenance;
  error?: string;
  className?: string;
}

export function SelectField({ label, value, onChange, options, required, allowEmpty = true, emptyLabel = '— не выбрано —', hint, provenance, error, className = '' }: SelectFieldProps) {
  const id = useId();
  const opts = [...(allowEmpty ? [{ value: '', label: emptyLabel }] : []), ...options.map((o) => ({ value: o.code, label: o.label }))];
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id}>
        <FieldLabel required={required} provenance={provenance} hint={hint}>
          {label}
        </FieldLabel>
      </label>
      <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} options={opts} error={error} />
    </div>
  );
}

interface MultiSelectFieldProps {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: DictItem[];
  required?: boolean;
  hint?: string;
  provenance?: Provenance;
  error?: string;
  columns?: 1 | 2 | 3;
}

export function MultiSelectField({ label, values, onChange, options, required, hint, provenance, error, columns = 2 }: MultiSelectFieldProps) {
  const toggle = (code: string) => {
    onChange(values.includes(code) ? values.filter((v) => v !== code) : [...values, code]);
  };
  const cols = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' }[columns];
  return (
    <div className="space-y-1.5">
      <FieldLabel required={required} provenance={provenance} hint={hint}>
        {label}
      </FieldLabel>
      <div className={`grid ${cols} gap-x-4 gap-y-1.5 p-3 rounded-lg bg-[var(--bg-tertiary)] border ${error ? 'border-red-500' : 'border-[var(--border-color)]'}`}>
        {options.map((o) => (
          <label key={o.code} className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1 accent-primary-500" checked={values.includes(o.code)} onChange={() => toggle(o.code)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)]'}`}
        onClick={() => onChange(!checked)}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <span className="text-sm">
        {label}
        {hint && <span className="block text-xs text-[var(--text-secondary)]">{hint}</span>}
      </span>
    </label>
  );
}

interface StringListFieldProps {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  required?: boolean;
  hint?: string;
  provenance?: Provenance;
  error?: string;
  placeholder?: string;
  multiline?: boolean;
  addLabel?: string;
}

/** Список строк: цели, задачи, нормативные документы, кадастровые номера. */
export function StringListField({ label, values, onChange, required, hint, provenance, error, placeholder, multiline = true, addLabel = 'Добавить' }: StringListFieldProps) {
  const setAt = (i: number, v: string) => onChange(values.map((x, j) => (j === i ? v : x)));
  const remove = (i: number) => onChange(values.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= values.length) return;
    const next = [...values];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      <FieldLabel required={required} provenance={provenance} hint={hint}>
        {label}
      </FieldLabel>
      <div className={`space-y-2 ${error ? 'rounded-lg ring-1 ring-red-500 p-2' : ''}`}>
        {values.map((v, i) => (
          <div key={i} className="flex gap-2 items-start">
            {multiline ? (
              <textarea
                rows={2}
                value={v}
                placeholder={placeholder}
                onChange={(e) => setAt(i, e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm focus:outline-none focus:border-primary-500"
              />
            ) : (
              <Input value={v} placeholder={placeholder} onChange={(e) => setAt(i, e.target.value)} className="flex-1" />
            )}
            <div className="flex flex-col gap-0.5">
              <button type="button" onClick={() => move(i, -1)} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]" title="Выше">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]" title="Ниже">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => remove(i)} className="p-1 rounded hover:bg-red-500/20 text-red-400" title="Удалить">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...values, ''])} className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300">
          <Plus className="w-4 h-4" /> {addLabel}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

interface TextBlockFieldProps {
  label: string;
  value: TextBlock | undefined;
  onChange: (v: TextBlock) => void;
  required?: boolean;
  hint?: string;
  provenance?: Provenance;
  error?: string;
  withTitle?: boolean;
}

/** Текстовый блок схемы: абзацы (каждый — отдельный элемент Text). */
export function TextBlockField({ label, value, onChange, required, hint, provenance, error, withTitle = false }: TextBlockFieldProps) {
  const tb = value ?? { paragraphs: [] };
  return (
    <div className="space-y-2">
      {withTitle && <TextField label={`${label}: заголовок`} value={tb.title} onChange={(title) => onChange({ ...tb, title: title || undefined })} />}
      <StringListField
        label={label}
        values={tb.paragraphs}
        onChange={(paragraphs) => onChange({ ...tb, paragraphs })}
        required={required}
        hint={hint ?? 'каждый пункт — отдельный абзац'}
        provenance={provenance}
        error={error}
        addLabel="Добавить абзац"
      />
    </div>
  );
}

export function Section({ title, children, actions, description }: { title: string; children: ReactNode; actions?: ReactNode; description?: string }) {
  return (
    <section className="space-y-4 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 lg:grid-cols-4' }[cols];
  return <div className={`grid grid-cols-1 ${c} gap-4`}>{children}</div>;
}

export function RemoveButton({ onClick, label = 'Удалить' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm text-red-400 hover:text-red-300">
      <Trash2 className="w-4 h-4" /> {label}
    </button>
  );
}

export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300">
      <Plus className="w-4 h-4" /> {label}
    </button>
  );
}

/** Ошибки валидации, относящиеся к пути (точное совпадение или вложенные). */
export function errorFor(issues: { path: string; message: string }[], path: string): string | undefined {
  return issues.find((i) => i.path === path)?.message;
}
