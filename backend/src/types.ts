// Database Row Types (as stored in SQLite)
export interface CompanyRow {
  id: number;
  name: string;
  career_url: string;
  scraper_engine: 'cheerio' | 'playwright';
  target_selector: string | null;
  created_at: string;
}

export interface SearchConfigRow {
  id: number;
  name: string;
  keywords: string; // JSON array of strings
  negative_keywords: string | null; // JSON array of strings
  min_experience: number;
  target_countries: string | null; // JSON array of strings
  created_at: string;
}

export interface JobPostingRow {
  id: number;
  company_id: number;
  search_config_id: number;
  title: string;
  url: string;
  raw_text: string;
  is_relevant: number; // 0 or 1
  ai_parsed: number; // 0 or 1
  ai_summary: string | null;
  tech_stack: string | null; // JSON array of strings
  is_visited: number; // 0 or 1
  created_at: string;
}

export interface LLMConfigRow {
  id: number;
  provider: 'ollama' | 'openai' | 'anthropic' | 'openrouter';
  model_name: string;
  api_key: string | null;
  is_active: number; // 0 or 1
}

// API Model Types (with parsed JSON fields and proper booleans)
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
  created_at: string;
}

export interface JobPosting {
  id: number;
  company_id: number;
  search_config_id: number;
  title: string;
  url: string;
  raw_text: string;
  is_relevant: boolean;
  ai_parsed: boolean;
  ai_summary: string | null;
  tech_stack: string[] | null;
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

// API Response Wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
