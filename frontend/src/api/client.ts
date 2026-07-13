const API_BASE = '/api';

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errText = await res.text();
    let parsedErr = 'API request failed';
    try {
      const json = JSON.parse(errText);
      parsedErr = json.error || parsedErr;
    } catch {
      parsedErr = errText || parsedErr;
    }
    throw new Error(parsedErr);
  }

  const result = await res.json();
  if (!result.success) {
    throw new Error(result.error || 'API request failed');
  }

  return result.data as T;
}
