import { apiClient } from './client';
import { isAxiosError } from 'axios';
import type { AttachedFile, BoundaryImage, TzSource, TzXmlModel, ValidationIssue } from '@tz-xml';

export type TechnicalTaskStatus = 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

export interface TechnicalTaskListItem {
  id: string;
  name: string;
  status: TechnicalTaskStatus;
  source: TzSource;
  sourceFileName: string | null;
  xmlFileName: string | null;
  xmlGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; firstName: string; lastName: string } | null;
}

export interface TechnicalTask extends TechnicalTaskListItem {
  sourceFileUrl: string | null;
  sourceFileType: string | null;
  /** Данные прежнего Word-шаблона (для ТЗ, созданных до XML) */
  extractedData: Record<string, unknown> | null;
  generatedFileName: string | null;
  generatedFileUrl: string | null;
  generatedAt: string | null;
  xmlData: TzXmlModel | null;
  xmlFileUrl: string | null;
  processingError: string | null;
  issues: ValidationIssue[];
  createdById: string | null;
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface UploadedAttachment extends AttachedFile {
  imageType?: BoundaryImage['type'];
}

export interface GenerateError {
  message: string;
  issues?: ValidationIssue[];
}

function downloadBlob(data: Blob, fallbackName: string, contentDisposition?: string) {
  let filename = fallbackName;
  if (contentDisposition) {
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i);
    const plainMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
    if (utf8Match?.[1]) filename = decodeURIComponent(utf8Match[1]);
    else if (plainMatch?.[1]) filename = decodeURIComponent(plainMatch[1]);
  }
  const url = window.URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

async function downloadFrom(url: string, fallbackName: string) {
  const response = await apiClient.get(url, { responseType: 'blob' });
  downloadBlob(new Blob([response.data]), fallbackName, response.headers['content-disposition']);
}

export const technicalTasksApi = {
  create: async (data: { name: string; source: TzSource }, file?: File): Promise<TechnicalTask> => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('source', data.source);
    if (file) formData.append('file', file);
    const response = await apiClient.post<TechnicalTask>('/technical-tasks', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getAll: async (): Promise<TechnicalTaskListItem[]> => {
    const response = await apiClient.get<TechnicalTaskListItem[]>('/technical-tasks');
    return response.data;
  },

  getById: async (id: string): Promise<TechnicalTask> => {
    const response = await apiClient.get<TechnicalTask>(`/technical-tasks/${id}`);
    return response.data;
  },

  update: async (id: string, data: { name?: string; xmlData?: TzXmlModel }): Promise<TechnicalTask> => {
    const response = await apiClient.patch<TechnicalTask>(`/technical-tasks/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/technical-tasks/${id}`);
  },

  generate: async (id: string): Promise<TechnicalTask> => {
    const response = await apiClient.post<TechnicalTask>(`/technical-tasks/${id}/generate`);
    return response.data;
  },

  reprocess: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/technical-tasks/${id}/reprocess`);
    return response.data;
  },

  uploadAttachment: async (id: string, file: File): Promise<UploadedAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<UploadedAttachment>(`/technical-tasks/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** URL вложения для показа (изображения границ). */
  attachmentUrl: (id: string, fileUrl: string): string => {
    const fileName = fileUrl.split('/').pop() ?? '';
    return `/api/technical-tasks/${id}/attachments/${encodeURIComponent(fileName)}`;
  },

  fetchAttachmentBlobUrl: async (id: string, fileUrl: string): Promise<string> => {
    const fileName = fileUrl.split('/').pop() ?? '';
    const response = await apiClient.get(`/technical-tasks/${id}/attachments/${encodeURIComponent(fileName)}`, { responseType: 'blob' });
    return window.URL.createObjectURL(new Blob([response.data]));
  },

  downloadXml: (id: string) => downloadFrom(`/technical-tasks/${id}/files/xml`, 'task.xml'),
  downloadSourceFile: (id: string) => downloadFrom(`/technical-tasks/${id}/files/source`, 'document'),
  downloadGeneratedFile: (id: string) => downloadFrom(`/technical-tasks/${id}/files/generated`, 'document.docx'),

  getPreviewPdf: async (id: string, signal?: AbortSignal): Promise<{ blob: Blob; fileName: string }> => {
    try {
      const response = await apiClient.get<Blob>(`/technical-tasks/${id}/document/pdf`, { responseType: 'blob', signal });
      const disposition = response.headers['content-disposition'] as string | undefined;
      const filename = disposition?.match(/filename\*=UTF-8''([^;\s]+)/i)?.[1];
      return { blob: response.data, fileName: filename ? decodeURIComponent(filename) : 'ЗИИ.pdf' };
    } catch (error) {
      if (isAxiosError(error) && error.response?.data instanceof Blob) {
        let message: string | undefined;
        try {
          const body = JSON.parse(await error.response.data.text()) as { message?: string };
          message = body.message;
        } catch { /* Ответ без JSON — используем общее сообщение. */ }
        throw new Error(message || 'Не удалось сформировать PDF. Попробуйте ещё раз.');
      }
      throw error;
    }
  },

  /** Текст XML и XSL для визуализации в браузере. */
  getXmlText: async (id: string): Promise<string> => {
    const response = await apiClient.get<string>(`/technical-tasks/${id}/files/xml/raw`, { responseType: 'text' });
    return response.data;
  },
  getXslText: async (): Promise<string> => {
    const response = await apiClient.get<string>('/technical-tasks/xsl', { responseType: 'text' });
    return response.data;
  },

  getDocumentHtml: async (id: string): Promise<{ html: string }> => {
    const response = await apiClient.get<{ html: string }>(`/technical-tasks/${id}/document/html`);
    return response.data;
  },
};
