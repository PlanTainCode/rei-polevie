/**
 * Печатная форма задания: официальный XSL Минстроя применяется к XML прямо
 * в браузере (XSLTProcessor), результат показывается в iframe.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { technicalTasksApi } from '@/api/technical-tasks';

export function XmlPreview({ taskId, version }: { taskId: string; version: string | null }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    (async () => {
      try {
        const [xmlText, xslText] = await Promise.all([technicalTasksApi.getXmlText(taskId), technicalTasksApi.getXslText()]);
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');
        const xsl = parser.parseFromString(xslText, 'application/xml');
        if (xml.querySelector('parsererror') || xsl.querySelector('parsererror')) throw new Error('Не удалось разобрать XML или XSL');
        const processor = new XSLTProcessor();
        processor.importStylesheet(xsl);
        const result = processor.transformToDocument(xml);
        const serialized = new XMLSerializer().serializeToString(result);
        if (!cancelled) setHtml(serialized);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка визуализации');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskId, version]);

  if (error) return <div className="p-4 text-sm text-red-400">{error}</div>;
  if (!html)
    return (
      <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Формируем печатную форму…
      </div>
    );
  return <iframe title="Печатная форма задания" srcDoc={html} className="w-full bg-white rounded-lg border border-[var(--border-color)]" style={{ height: '80vh' }} />;
}

export function downloadPreviewHtml(html: string, fileName: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
