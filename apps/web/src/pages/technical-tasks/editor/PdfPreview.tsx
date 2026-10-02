import { useEffect, useState } from 'react';
import { Download, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { technicalTasksApi } from '@/api/technical-tasks';
import { Button } from '@/components/ui';

export function PdfPreview({ taskId, version }: { taskId: string; version: string }) {
  const [pdf, setPdf] = useState<{ url: string; fileName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();
    setPdf(null);
    setError(null);
    (async () => {
      try {
        const { blob, fileName } = await technicalTasksApi.getPreviewPdf(taskId, controller.signal);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdf({ url: objectUrl, fileName });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось сформировать PDF');
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [taskId, version, attempt]);

  if (error) return (
    <div className="space-y-3 p-4 text-sm">
      <div className="text-red-400">{error}</div>
      <Button type="button" variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
        <RefreshCw className="w-4 h-4" /> Повторить
      </Button>
    </div>
  );
  if (!pdf) return (
    <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Формируем PDF…
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm text-primary-400">
        <a className="inline-flex items-center gap-1.5" href={pdf.url} download={pdf.fileName}><Download className="w-4 h-4" /> Скачать PDF</a>
        <a className="inline-flex items-center gap-1.5" href={pdf.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /> Открыть PDF</a>
      </div>
      <iframe title="Просмотр PDF задания" src={pdf.url} className="w-full bg-white rounded-lg border border-[var(--border-color)]" style={{ height: '80vh' }} />
    </div>
  );
}
