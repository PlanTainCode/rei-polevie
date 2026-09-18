/**
 * Список документов (tDocumentsInfo): вид из справочника, реквизиты,
 * файл с контрольной суммой, ссылка или ссылка на другой документ.
 */

import { useRef, useState } from 'react';
import { Paperclip, Loader2, X } from 'lucide-react';
import { DOCUMENT_TYPE_GROUPS, emptyDocument, type DocumentInfo, type DocumentsInfo, type ValidationIssue } from '@tz-xml';
import { technicalTasksApi } from '@/api/technical-tasks';
import { AddButton, Grid, RemoveButton, SelectField, TextField, errorFor, type Provenance } from './fields';

interface DocumentsEditorProps {
  taskId: string;
  value: DocumentsInfo;
  onChange: (v: DocumentsInfo) => void;
  issues: ValidationIssue[];
  path: string;
  /** Документы, на которые можно сослаться (ReferenceToDocumentId). */
  referenceCandidates?: DocumentInfo[];
  defaultTypeCode?: string;
  provenance?: Provenance;
  addLabel?: string;
}

const SOURCE_OPTIONS = [
  { code: 'FILE', label: 'Файл документа' },
  { code: 'WEBLINK', label: 'Ссылка на официальную публикацию' },
  { code: 'REFERENCE', label: 'Входит в состав другого документа' },
];

export function DocumentsEditor({ taskId, value, onChange, issues, path, referenceCandidates = [], defaultTypeCode = '', provenance, addLabel = 'Добавить документ' }: DocumentsEditorProps) {
  const setDoc = (i: number, d: DocumentInfo) => onChange({ ...value, documents: value.documents.map((x, j) => (j === i ? d : x)) });
  const remove = (i: number) => onChange({ ...value, documents: value.documents.filter((_, j) => j !== i) });

  return (
    <div className="space-y-3">
      {errorFor(issues, path) && <p className="text-sm text-red-400">{errorFor(issues, path)}</p>}
      {value.documents.map((d, i) => (
        <DocumentCard
          key={d.id}
          taskId={taskId}
          value={d}
          onChange={(v) => setDoc(i, v)}
          onRemove={() => remove(i)}
          issues={issues}
          path={`${path}.documents[${i}]`}
          referenceCandidates={referenceCandidates.filter((c) => c.id !== d.id)}
          provenance={provenance}
          index={i + 1}
        />
      ))}
      <div className="flex items-center gap-4">
        <AddButton onClick={() => onChange({ ...value, documents: [...value.documents, emptyDocument(defaultTypeCode)] })} label={addLabel} />
      </div>
      <TextField label="Дополнительные сведения" value={value.note} onChange={(v) => onChange({ ...value, note: v || undefined })} />
    </div>
  );
}

const TYPE_OPTIONS = DOCUMENT_TYPE_GROUPS.flatMap((g) => g.items.map((it) => ({ code: it.code, label: `${it.code} — ${it.label.length > 90 ? it.label.slice(0, 90) + '…' : it.label}` })));

function DocumentCard({ taskId, value, onChange, onRemove, issues, path, referenceCandidates, provenance, index }: {
  taskId: string;
  value: DocumentInfo;
  onChange: (v: DocumentInfo) => void;
  onRemove: () => void;
  issues: ValidationIssue[];
  path: string;
  referenceCandidates: DocumentInfo[];
  provenance?: Provenance;
  index: number;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await technicalTasksApi.uploadAttachment(taskId, file);
      onChange({ ...value, files: [...value.files, { fileUrl: uploaded.fileUrl, name: uploaded.name, format: uploaded.format, checksum: uploaded.checksum, size: uploaded.size }] });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/40 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Документ {index}</span>
        <RemoveButton onClick={onRemove} />
      </div>
      <SelectField label="Вид документа" value={value.typeCode} onChange={(typeCode) => onChange({ ...value, typeCode })} options={TYPE_OPTIONS} required provenance={provenance} error={errorFor(issues, `${path}.typeCode`)} />
      <TextField label="Наименование" value={value.name} onChange={(name) => onChange({ ...value, name })} required error={errorFor(issues, `${path}.name`)} />
      <Grid cols={3}>
        <TextField label="Номер" value={value.number} onChange={(number) => onChange({ ...value, number })} required placeholder="б/н, если без номера" error={errorFor(issues, `${path}.number`)} />
        <TextField label="Дата" type="date" value={value.date} onChange={(date) => onChange({ ...value, date })} required error={errorFor(issues, `${path}.date`)} />
        <TextField label="Автор (организация или лицо)" value={value.authorNote} onChange={(authorNote) => onChange({ ...value, authorNote })} required error={errorFor(issues, `${path}.authorNote`)} />
      </Grid>
      <Grid cols={2}>
        <SelectField label="Как представлен" value={value.source} onChange={(source) => onChange({ ...value, source: source as DocumentInfo['source'] })} options={SOURCE_OPTIONS} allowEmpty={false} />
        <TextField label="Отметка об изменении" value={value.changes} onChange={(changes) => onChange({ ...value, changes: changes || undefined })} />
      </Grid>

      {value.source === 'FILE' && (
        <div className="space-y-2">
          {value.files.map((f, i) => (
            <div key={`${f.fileUrl}-${i}`} className="flex items-center gap-2 text-sm px-3 py-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)]">
              <Paperclip className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="font-mono text-xs text-[var(--text-secondary)]">CRC32 {f.checksum}</span>
              {!f.fileUrl && <span className="text-xs text-amber-400">файл не приложен</span>}
              <button type="button" className="p-1 text-red-400 hover:bg-red-500/20 rounded" onClick={() => onChange({ ...value, files: value.files.filter((_, j) => j !== i) })}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <input ref={fileInput} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 disabled:opacity-50">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />} Прикрепить файл
          </button>
          {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
          {errorFor(issues, `${path}.files`) && <p className="text-sm text-red-400">{errorFor(issues, `${path}.files`)}</p>}
        </div>
      )}
      {value.source === 'WEBLINK' && (
        <TextField label="Ссылка" value={value.webLink} onChange={(webLink) => onChange({ ...value, webLink })} required placeholder="https://…" error={errorFor(issues, `${path}.webLink`)} />
      )}
      {value.source === 'REFERENCE' && (
        <SelectField
          label="Документ, в состав которого входит"
          value={value.referenceToDocumentId}
          onChange={(referenceToDocumentId) => onChange({ ...value, referenceToDocumentId })}
          options={referenceCandidates.map((c) => ({ code: c.id, label: c.name || c.id }))}
          required
          error={errorFor(issues, `${path}.referenceToDocumentId`)}
        />
      )}
    </div>
  );
}
