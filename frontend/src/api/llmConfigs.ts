import { request } from './client';
import type { LLMConfig } from '../types';

export const llmConfigs = {
  list: () => request<LLMConfig[]>('/llm_configs'),
  
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
    })
};
