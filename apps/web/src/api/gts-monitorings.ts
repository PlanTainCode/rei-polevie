import { apiClient } from './client';

export interface GtsMonitoring {
  id: string;
  companyId: string;
  name: string;
  year: number;
  status: string;
  sourceFileName: string | null;
  sourceFileUrl: string | null;
  createdById: string | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { districts: number; objects: number; photos: number };
}

export interface GtsDistrict {
  id: string;
  gtsMonitoringId: string;
  name: string;
  numberRange: string | null;
  sortOrder: number;
  _count?: { objects: number };
}

export interface GtsObject {
  id: string;
  gtsMonitoringId: string;
  gtsDistrictId: string;
  number: number;
  watercourseName: string;
  settlement: string;
  yearBuilt: number | null;
  volume: string | null;
  area: string | null;
  safetyLevel: string | null;
  ownerName: string | null;
  latitude: string | null;
  longitude: string | null;
  inspectionDate: string | null;
  inspectorName: string | null;
  overallCondition: string | null;
  hasTechnicalDoc: boolean;
  district?: { id: string; name: string };
  elements?: GtsElement[];
  _count?: { elements: number; photos: number };
}

export interface GtsElement {
  id: string;
  gtsObjectId: string;
  name: string;
  characteristics: string | null;
  technicalCondition: string | null;
  defects: string | null;
  recommendations: string | null;
  sortOrder: number;
}

export interface GtsPhoto {
  id: string;
  gtsObjectId: string;
  gtsMonitoringId: string;
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
}

function downloadBlob(response: any, fallbackName: string) {
  const cd = response.headers['content-disposition'];
  const filename = cd
    ? decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || fallbackName)
    : fallbackName;
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

const BASE = '/gts-monitorings';

export const gtsMonitoringsApi = {
  // ========== МОНИТОРИНГИ ==========

  create: async (formData: FormData): Promise<GtsMonitoring> => {
    const response = await apiClient.post<GtsMonitoring>(BASE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getAll: async (): Promise<GtsMonitoring[]> => {
    const response = await apiClient.get<GtsMonitoring[]>(BASE);
    return response.data;
  },

  getById: async (id: string): Promise<GtsMonitoring> => {
    const response = await apiClient.get<GtsMonitoring>(`${BASE}/${id}`);
    return response.data;
  },

  update: async (id: string, data: Record<string, any>): Promise<GtsMonitoring> => {
    const response = await apiClient.patch<GtsMonitoring>(`${BASE}/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}`);
  },

  // ========== РАЙОНЫ ==========

  getDistricts: async (monitoringId: string): Promise<GtsDistrict[]> => {
    const response = await apiClient.get<GtsDistrict[]>(`${BASE}/${monitoringId}/districts`);
    return response.data;
  },

  // ========== ОБЪЕКТЫ ==========

  getObjects: async (monitoringId: string, districtId?: string): Promise<GtsObject[]> => {
    const params = districtId ? { districtId } : {};
    const response = await apiClient.get<GtsObject[]>(`${BASE}/${monitoringId}/objects`, { params });
    return response.data;
  },

  getObject: async (monitoringId: string, objectId: string): Promise<GtsObject> => {
    const response = await apiClient.get<GtsObject>(`${BASE}/${monitoringId}/objects/${objectId}`);
    return response.data;
  },

  updateObject: async (monitoringId: string, objectId: string, data: Record<string, any>): Promise<GtsObject> => {
    const response = await apiClient.patch<GtsObject>(`${BASE}/${monitoringId}/objects/${objectId}`, data);
    return response.data;
  },

  // ========== ЭЛЕМЕНТЫ ==========

  updateElement: async (monitoringId: string, objectId: string, elementId: string, data: Record<string, any>): Promise<GtsElement> => {
    const response = await apiClient.patch<GtsElement>(
      `${BASE}/${monitoringId}/objects/${objectId}/elements/${elementId}`,
      data,
    );
    return response.data;
  },

  // ========== ФОТО ==========

  getObjectPhotos: async (monitoringId: string, objectId: string): Promise<GtsPhoto[]> => {
    const response = await apiClient.get<GtsPhoto[]>(`${BASE}/${monitoringId}/objects/${objectId}/photos`);
    return response.data;
  },

  uploadPhotos: async (monitoringId: string, objectId: string, files: File[]): Promise<any[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file, file.name || `photo_${Date.now()}.jpg`));
    const response = await apiClient.post(`${BASE}/${monitoringId}/objects/${objectId}/photos`, formData);
    return response.data;
  },

  updatePhoto: async (monitoringId: string, photoId: string, data: Record<string, any>): Promise<GtsPhoto> => {
    const response = await apiClient.patch<GtsPhoto>(`${BASE}/${monitoringId}/photos/${photoId}`, data);
    return response.data;
  },

  reorderPhotos: async (monitoringId: string, objectId: string, orders: { id: string; sortOrder: number }[]): Promise<GtsPhoto[]> => {
    const response = await apiClient.post<GtsPhoto[]>(
      `${BASE}/${monitoringId}/objects/${objectId}/photos/reorder`,
      { orders },
    );
    return response.data;
  },

  deletePhoto: async (monitoringId: string, photoId: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${monitoringId}/photos/${photoId}`);
  },

  getPhotoThumbnailUrl: (monitoringId: string, photoId: string): string =>
    `${BASE}/${monitoringId}/photos/${photoId}/thumbnail`,

  getPhotoOriginalUrl: (monitoringId: string, photoId: string): string =>
    `${BASE}/${monitoringId}/photos/${photoId}/original`,

  // ========== ГЕНЕРАЦИЯ ==========

  generateObjectDefectStatement: async (monitoringId: string, objectId: string): Promise<void> => {
    const response = await apiClient.post(
      `${BASE}/${monitoringId}/objects/${objectId}/generate-defect-statement`,
      {},
      { responseType: 'blob', timeout: 180000 },
    );
    downloadBlob(response, 'ДВ.pdf');
  },

  generateDistrictDefectStatements: async (monitoringId: string, districtId: string): Promise<void> => {
    const response = await apiClient.post(
      `${BASE}/${monitoringId}/districts/${districtId}/generate-defect-statements`,
      {},
      { responseType: 'blob', timeout: 300000 },
    );
    downloadBlob(response, 'ДВ_район.pdf');
  },

  generateObjectAlbum: async (monitoringId: string, objectId: string): Promise<void> => {
    const response = await apiClient.post(
      `${BASE}/${monitoringId}/objects/${objectId}/generate-album`,
      {},
      { responseType: 'blob', timeout: 180000 },
    );
    downloadBlob(response, 'Фотоальбом.pptx');
  },

  generateDistrictAlbum: async (monitoringId: string, districtId: string): Promise<void> => {
    const response = await apiClient.post(
      `${BASE}/${monitoringId}/districts/${districtId}/generate-album`,
      {},
      { responseType: 'blob', timeout: 300000 },
    );
    downloadBlob(response, 'Фотоальбом_район.pptx');
  },
};
