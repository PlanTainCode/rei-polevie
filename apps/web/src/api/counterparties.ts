import type { CounterpartyDraft, CounterpartyKind, CounterpartyRecord } from '@tz-xml';
import { apiClient } from './client';

export interface CounterpartyList {
  items: CounterpartyRecord[];
  total: number;
  canManage: boolean;
}

export const counterpartiesApi = {
  list: async (params: { kind?: CounterpartyKind; search?: string } = {}): Promise<CounterpartyList> => {
    const response = await apiClient.get<CounterpartyList>('/counterparties', { params });
    return response.data;
  },
  create: async (draft: CounterpartyDraft): Promise<CounterpartyRecord> => {
    const response = await apiClient.post<CounterpartyRecord>('/counterparties', draft);
    return response.data;
  },
  update: async (id: string, draft: CounterpartyDraft): Promise<CounterpartyRecord> => {
    const response = await apiClient.patch<CounterpartyRecord>(`/counterparties/${id}`, draft);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/counterparties/${id}`);
  },
};
