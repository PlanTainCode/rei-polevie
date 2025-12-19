import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Loader2, FileWarning, Download, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { apiClient } from '@/api/client';

interface DocxViewerProps {
  fileUrl: string;
  onDownload?: () => void;
  className?: string;
}

export function DocxViewer({ fileUrl, onDownload, className = '' }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    async function loadDocument() {
      if (!containerRef.current || !fileUrl) return;

      setIsLoading(true);
      setError(null);

      try {
        // Используем apiClient для корректной авторизации
        const response = await apiClient.get(fileUrl, {
          responseType: 'blob',
        });

        const blob = new Blob([response.data]);
        
        // Очищаем контейнер
        containerRef.current.innerHTML = '';

        await renderAsync(blob, containerRef.current, undefined, {
          className: 'docx-wrapper',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading DOCX:', err);
        setError(err instanceof Error ? err.message : 'Не удалось загрузить документ');
        setIsLoading(false);
      }
    }

    loadDocument();
  }, [fileUrl]);

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  return (
    <div 
      className={`
        flex flex-col border border-[var(--border-primary)] rounded-xl overflow-hidden bg-white
        ${isFullscreen ? 'fixed inset-4 z-50' : ''}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          Просмотр документа
        </span>
        <div className="flex items-center gap-2">
          {onDownload && (
            <Button variant="secondary" size="sm" onClick={onDownload}>
              <Download className="w-4 h-4" />
              Скачать
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Document container */}
      <div 
        className={`
          relative overflow-auto bg-gray-100
          ${isFullscreen ? 'flex-1' : 'min-h-[500px] max-h-[700px]'}
        `}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
              <span className="text-gray-600">Загрузка документа...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center gap-3 text-red-500">
              <FileWarning className="w-12 h-12" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <div 
          ref={containerRef} 
          className="docx-viewer-content"
          style={{ 
            visibility: isLoading || error ? 'hidden' : 'visible',
            padding: '20px',
          }}
        />
      </div>

      {/* Fullscreen backdrop */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={toggleFullscreen}
        />
      )}
    </div>
  );
}

