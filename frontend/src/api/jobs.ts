import { request } from './client';
import type { JobPosting } from '../types';

export const jobs = {
  get: (id: string | number) => request<JobPosting>(`/jobs/${id}`),
  
  markVisited: (id: string | number) => 
    request<{ id: number; is_visited: boolean }>(`/jobs/${id}/visit`, {
      method: 'PUT'
    }),
    
  evaluate: (id: string | number) => 
    request<JobPosting>(`/jobs/${id}/evaluate`, {
      method: 'POST'
    })
};
