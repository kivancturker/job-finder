import { request } from './client';
import type { LLMConfig } from '../types';

export const llmConfigs = {
  list: () => request<LLMConfig[]>('/llm_configs'),
  
  getActive: () => request<LLMConfig | null>('/llm_configs/active'),
  
  create: (data: Omit<LLMConfig, 'id'>) => 
    request<LLMConfig>('/llm_configs', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
  activate: (id: string | number) => 
    request<LLMConfig>(`/llm_configs/${id}/activate`, {
      method: 'POST'
    }),
    
  remove: (id: string | number) => 
    request<{ id: number }>(`/llm_configs/${id}`, {
      method: 'DELETE'
    }),

  testConnection: (data: { provider: string; model_name: string; api_key: string | null }) => 
    request<{ success: boolean; message: string; details?: string }>('/llm_configs/test', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  testConnectionSaved: (id: string | number) => 
    request<{ success: boolean; message: string; details?: string }>('/llm_configs/test', {
      method: 'POST',
      body: JSON.stringify({ id })
    })
};

