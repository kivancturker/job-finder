import { request } from './client';
import type { SearchConfig, JobPosting } from '../types';

export const searchConfigs = {
  list: () => request<SearchConfig[]>('/search_configs'),
  
  get: (id: string | number) => request<SearchConfig>(`/search_configs/${id}`),
  
  create: (data: Omit<SearchConfig, 'id' | 'created_at'>) => 
    request<SearchConfig>('/search_configs', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
  remove: (id: string | number) => 
    request<{ id: number }>(`/search_configs/${id}`, {
      method: 'DELETE'
    }),
    
  getJobs: (id: string | number) => 
    request<JobPosting[]>(`/search_configs/${id}/jobs`)
};
