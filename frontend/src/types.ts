export interface Company {
  id: number;
  name: string;
  career_url: string;
  scraper_engine: 'cheerio' | 'playwright';
  target_selector: string | null;
  created_at: string;
}

export interface SearchConfig {
  id: number;
  name: string;
  keywords: string[];
  negative_keywords: string[] | null;
  min_experience: number;
  target_countries: string[] | null;
  custom_prompt: string | null;
  created_at: string;
}

export interface JobPosting {
  id: number;
  company_id: number;
  company_name?: string;
  search_config_id: number;
  title: string;
  url: string;
  raw_text: string;
  is_relevant: boolean;
  ai_parsed: boolean;
  ai_summary: string | null;
  tech_stack: string[] | null;
  min_experience: number;
  is_visited: boolean;
  created_at: string;
}

export interface LLMConfig {
  id: number;
  provider: 'ollama' | 'openai' | 'anthropic' | 'openrouter';
  model_name: string;
  api_key: string | null;
  is_active: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface QueueItem {
  id: string;
  type: 'scrape' | 'parse';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  companyId: number;
  companyName: string;
  searchConfigId: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  logs?: string[];
}
