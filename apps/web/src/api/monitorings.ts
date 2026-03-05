import { apiClient } from './client';

export interface Monitoring {
  id: string;
  companyId: string;
  name: string;
  objectName: string | null;
  objectAddress: string | null;
  customerName: string | null;
  tzFileName: string | null;
  tzFileUrl: string | null;
  extractedData: any;
  weatherTemperature: string | null;
  weatherWind: string | null;
  weatherPressure: string | null;
  weatherHumidity: string | null;
  status: string;
  processedAt: string | null;
  createdById: string | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { probes: number; photos: number };
}

export interface MonitoringProbe {
  id: string;
  monitoringId: string;
  name: string;
  type: 'WATER' | 'SEDIMENT';
  latitude: string | null;
  longitude: string | null;
  status: 'PENDING' | 'COLLECTED';
  description: string | null;
  container: string | null;
  containerVolume: string | null;
  containerCount: number;
  depth: string | null;
  temperature: string | null;
  mass: string | null;
  note: string | null;
  collectedAt: string | null;
  collectedById: string | null;
  collectedBy: { id: string; firstName: string; lastName: string } | null;
  sortOrder: number;
  _count?: { photos: number };
}

export interface MonitoringPhoto {
  id: string;
  monitoringId: string;
  probeId: string;
  filename: string;
  originalName: string;
  thumbnailName: string | null;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  photoDate: string | null;
  sortOrder: number;
  uploadedAt: string;
  uploadedById: string | null;
  uploadedBy?: { id: string; firstName: string; lastName: string } | null;
  probe?: { id: string; name: string; type: string };
}

export interface MonitoringPhotoUploadResult {
  success: boolean;
  photo?: MonitoringPhoto;
  error?: string;
  filename?: string;
}

export const monitoringsApi = {
  // ========== CRUD ==========

  create: async (formData: FormData): Promise<Monitoring> => {
    const response = await apiClient.post<Monitoring>('/monitorings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getAll: async (): Promise<Monitoring[]> => {
    const response = await apiClient.get<Monitoring[]>('/monitorings');
    return response.data;
  },

  getById: async (id: string): Promise<Monitoring> => {
    const response = await apiClient.get<Monitoring>(`/monitorings/${id}`);
    return response.data;
  },

  update: async (id: string, data: FormData | Record<string, any>): Promise<Monitoring> => {
    const isFormData = data instanceof FormData;
    const response = await apiClient.patch<Monitoring>(`/monitorings/${id}`, data, isFormData ? {
      headers: { 'Content-Type': 'multipart/form-data' },
    } : undefined);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/monitorings/${id}`);
  },

  // ========== ПРОБЫ ==========

  getProbes: async (monitoringId: string): Promise<MonitoringProbe[]> => {
    const response = await apiClient.get<MonitoringProbe[]>(`/monitorings/${monitoringId}/probes`);
    return response.data;
  },

  createProbe: async (monitoringId: string, data: { name: string; type: 'WATER' | 'SEDIMENT'; latitude?: string; longitude?: string; container?: string; containerVolume?: string; depth?: string }): Promise<MonitoringProbe> => {
    const response = await apiClient.post<MonitoringProbe>(`/monitorings/${monitoringId}/probes`, data);
    return response.data;
  },

  updateProbe: async (monitoringId: string, probeId: string, data: Record<string, any>): Promise<MonitoringProbe> => {
    const response = await apiClient.patch<MonitoringProbe>(`/monitorings/${monitoringId}/probes/${probeId}`, data);
    return response.data;
  },

  collectProbe: async (monitoringId: string, probeId: string): Promise<MonitoringProbe> => {
    const response = await apiClient.post<MonitoringProbe>(`/monitorings/${monitoringId}/probes/${probeId}/collect`);
    return response.data;
  },

  deleteProbe: async (monitoringId: string, probeId: string): Promise<void> => {
    await apiClient.delete(`/monitorings/${monitoringId}/probes/${probeId}`);
  },

  // ========== ФОТО ==========

  getAllPhotos: async (monitoringId: string): Promise<MonitoringPhoto[]> => {
    const response = await apiClient.get<MonitoringPhoto[]>(`/monitorings/${monitoringId}/photos`);
    return response.data;
  },

  getProbePhotos: async (monitoringId: string, probeId: string): Promise<MonitoringPhoto[]> => {
    const response = await apiClient.get<MonitoringPhoto[]>(`/monitorings/${monitoringId}/probes/${probeId}/photos`);
    return response.data;
  },

  uploadPhotos: async (monitoringId: string, probeId: string, files: File[]): Promise<MonitoringPhotoUploadResult[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file, file.name || `photo_${Date.now()}.jpg`));
    const response = await apiClient.post<MonitoringPhotoUploadResult[]>(
      `/monitorings/${monitoringId}/probes/${probeId}/photos`, formData,
    );
    return response.data;
  },

  updatePhoto: async (monitoringId: string, photoId: string, data: { description?: string; photoDate?: string; latitude?: string; longitude?: string }): Promise<MonitoringPhoto> => {
    const response = await apiClient.patch<MonitoringPhoto>(`/monitorings/${monitoringId}/photos/${photoId}`, data);
    return response.data;
  },

  reorderPhotos: async (monitoringId: string, probeId: string, orders: { id: string; sortOrder: number }[]): Promise<MonitoringPhoto[]> => {
    const response = await apiClient.patch<MonitoringPhoto[]>(`/monitorings/${monitoringId}/probes/${probeId}/photos-reorder`, { orders });
    return response.data;
  },

  deletePhoto: async (monitoringId: string, photoId: string): Promise<void> => {
    await apiClient.delete(`/monitorings/${monitoringId}/photos/${photoId}`);
  },

  voiceDescribePhoto: async (monitoringId: string, photoId: string, audioBlob: Blob): Promise<{ transcription: string; photo: MonitoringPhoto }> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');
    const response = await apiClient.post(`/monitorings/${monitoringId}/photos/${photoId}/voice-description`, formData, { timeout: 30000 });
    return response.data;
  },

  getPhotoThumbnailUrl: (monitoringId: string, photoId: string): string => `/monitorings/${monitoringId}/photos/${photoId}/thumbnail`,

  getPhotoOriginalUrl: (monitoringId: string, photoId: string): string => `/monitorings/${monitoringId}/photos/${photoId}/original`,

  downloadProbePhotos: async (monitoringId: string, probeId: string): Promise<void> => {
    const response = await apiClient.get(`/monitorings/${monitoringId}/probes/${probeId}/photos-download`, {
      responseType: 'blob', timeout: 120000,
    });
    const cd = response.headers['content-disposition'];
    const filename = cd ? decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || 'photos.zip') : 'photos.zip';
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  downloadAllPhotos: async (monitoringId: string): Promise<void> => {
    const response = await apiClient.get(`/monitorings/${monitoringId}/photos-download`, {
      responseType: 'blob', timeout: 120000,
    });
    const cd = response.headers['content-disposition'];
    const filename = cd ? decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || 'photos.zip') : 'photos.zip';
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // ========== ТОЧКИ НАБЛЮДЕНИЯ ==========

  getPointPhotos: async (monitoringId: string, pointName: string): Promise<MonitoringPhoto[]> => {
    const response = await apiClient.get<MonitoringPhoto[]>(
      `/monitorings/${monitoringId}/points/${encodeURIComponent(pointName)}/photos`,
    );
    return response.data;
  },

  reorderPointPhotos: async (monitoringId: string, pointName: string, orders: { id: string; sortOrder: number }[]): Promise<MonitoringPhoto[]> => {
    const response = await apiClient.patch<MonitoringPhoto[]>(
      `/monitorings/${monitoringId}/points/${encodeURIComponent(pointName)}/photos-reorder`,
      { orders },
    );
    return response.data;
  },

  downloadPointPhotos: async (monitoringId: string, pointName: string): Promise<void> => {
    const response = await apiClient.get(
      `/monitorings/${monitoringId}/points/${encodeURIComponent(pointName)}/photos-download`,
      { responseType: 'blob', timeout: 120000 },
    );
    const cd = response.headers['content-disposition'];
    const filename = cd ? decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || 'photos.zip') : 'photos.zip';
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  generatePointAlbum: async (monitoringId: string, pointName: string, crewMembers?: string): Promise<void> => {
    const response = await apiClient.post(
      `/monitorings/${monitoringId}/points/${encodeURIComponent(pointName)}/generate-album`,
      { crewMembers },
      { responseType: 'blob', timeout: 180000 },
    );
    const cd = response.headers['content-disposition'];
    const filename = cd ? decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || 'album.pptx') : 'album.pptx';
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // ========== ГЕНЕРАЦИЯ АКТОВ ==========

  generateAct: async (monitoringId: string, type: 'water' | 'sediment', date: string): Promise<void> => {
    const response = await apiClient.post(`/monitorings/${monitoringId}/generate-act`, { type, date }, {
      responseType: 'blob', timeout: 60000,
    });
    const cd = response.headers['content-disposition'];
    const fallback = type === 'water' ? 'Акт_Вода.xlsx' : 'Акт_ДО.xlsx';
    const filename = cd ? decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || fallback) : fallback;
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // ========== ГЕНЕРАЦИЯ АЛЬБОМА ==========

  generateProbeAlbum: async (monitoringId: string, probeId: string, crewMembers?: string): Promise<void> => {
    const response = await apiClient.post(
      `/monitorings/${monitoringId}/probes/${probeId}/generate-album`,
      { crewMembers },
      { responseType: 'blob', timeout: 180000 },
    );
    const cd = response.headers['content-disposition'];
    const filename = cd ? decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || 'album.pptx') : 'album.pptx';
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
