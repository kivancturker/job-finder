import { request } from './client';
import type { Company } from '../types';

export const companies = {
  list: () => request<Company[]>('/companies'),
  
  get: (id: string | number) => request<Company>(`/companies/${id}`),
  
  create: (data: Omit<Company, 'id' | 'created_at'>) => 
    request<Company>('/companies', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
  update: (id: string | number, data: Omit<Company, 'id' | 'created_at'>) => 
    request<Company>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    
  remove: (id: string | number) => 
    request<{ id: number }>(`/companies/${id}`, {
      method: 'DELETE'
    })
};
