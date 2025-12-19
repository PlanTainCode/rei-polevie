import { apiClient } from './client';

export type TechnicalTaskStatus = 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

export interface TechnicalTask {
  id: string;
  name: string;
  status: TechnicalTaskStatus;
  sourceFileName: string | null;
  sourceFileUrl: string | null;
  sourceFileType: string | null;
  extractedData: Record<string, unknown> | null;
  generatedFileName: string | null;
  generatedFileUrl: string | null;
  generatedAt: string | null;
  createdById: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface CreateTechnicalTaskData {
  name: string;
}

export interface UpdateTechnicalTaskData {
  name?: string;
  extractedData?: Record<string, unknown>;
}

export const technicalTasksApi = {
  create: async (data: CreateTechnicalTaskData, file?: File): Promise<TechnicalTask> => {
    const formData = new FormData();
    formData.append('name', data.name);
    if (file) {
      formData.append('file', file);
    }
    const response = await apiClient.post<TechnicalTask>('/technical-tasks', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getAll: async (): Promise<TechnicalTask[]> => {
    const response = await apiClient.get<TechnicalTask[]>('/technical-tasks');
    return response.data;
  },

  getById: async (id: string): Promise<TechnicalTask> => {
    const response = await apiClient.get<TechnicalTask>(`/technical-tasks/${id}`);
    return response.data;
  },

  update: async (id: string, data: UpdateTechnicalTaskData, file?: File): Promise<TechnicalTask> => {
    const formData = new FormData();
    if (data.name) {
      formData.append('name', data.name);
    }
    if (data.extractedData) {
      formData.append('extractedData', JSON.stringify(data.extractedData));
    }
    if (file) {
      formData.append('file', file);
    }
    const response = await apiClient.patch<TechnicalTask>(`/technical-tasks/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/technical-tasks/${id}`);
  },

  downloadSourceFile: async (id: string): Promise<void> => {
    const response = await apiClient.get(`/technical-tasks/${id}/files/source`, {
      responseType: 'blob',
    });
    
    // Извлекаем имя файла из заголовка
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'document';
    if (contentDisposition) {
      // Сначала пробуем filename*=UTF-8'' (RFC 5987)
      const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i);
      if (utf8Match && utf8Match[1]) {
        filename = decodeURIComponent(utf8Match[1]);
      } else {
        // Фолбэк на обычный filename
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }
    }
    
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  downloadGeneratedFile: async (id: string): Promise<void> => {
    const response = await apiClient.get(`/technical-tasks/${id}/files/generated`, {
      responseType: 'blob',
    });
    
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'document.docx';
    if (contentDisposition) {
      // Сначала пробуем filename*=UTF-8'' (RFC 5987)
      const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i);
      if (utf8Match && utf8Match[1]) {
        filename = decodeURIComponent(utf8Match[1]);
      } else {
        // Фолбэк на обычный filename
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }
    }
    
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  reprocess: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/technical-tasks/${id}/reprocess`);
    return response.data;
  },

  // Получить HTML содержимое документа
  getDocumentHtml: async (id: string): Promise<{ html: string }> => {
    const response = await apiClient.get<{ html: string }>(`/technical-tasks/${id}/document/html`);
    return response.data;
  },

  // Сохранить изменённый HTML
  saveDocumentHtml: async (id: string, html: string): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/technical-tasks/${id}/document/html`, { html });
    return response.data;
  },

  // Получить URL для просмотра документа (относительный для apiClient)
  getGeneratedFileUrl: (id: string): string => {
    return `/technical-tasks/${id}/files/generated`;
  },
};
