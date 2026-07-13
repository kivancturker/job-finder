import { request } from './client';
import type { QueueItem } from '../types';

export const runSearch = {
  start: (searchConfigId: number | string) => 
    request<{ tasks: QueueItem[] }>('/run-search', {
      method: 'POST',
      body: JSON.stringify({ search_config_id: Number(searchConfigId) })
    }),
    
  getQueue: () => request<{ tasks: QueueItem[] }>('/run-search/queue'),
  
  clearQueue: () => 
    request<{ tasks: QueueItem[] }>('/run-search/clear', {
      method: 'POST'
    }),

  analyzePreMatches: () => 
    request<{ task: QueueItem }>('/run-search/analyze-prematches', {
      method: 'POST'
    }),

  deleteTask: (id: string) => 
    request<{ success: boolean; tasks: QueueItem[] }>(`/run-search/queue/${id}`, {
      method: 'DELETE'
    })
};
