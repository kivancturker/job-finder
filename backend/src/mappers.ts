import {
  CompanyRow,
  Company,
  SearchConfigRow,
  SearchConfig,
  JobPostingRow,
  JobPosting,
  LLMConfigRow,
  LLMConfig
} from './types';

// Helper to map DB row to Company model
export const mapCompany = (row: CompanyRow): Company => ({
  id: row.id,
  name: row.name,
  career_url: row.career_url,
  scraper_engine: row.scraper_engine,
  target_selector: row.target_selector,
  created_at: row.created_at
});

// Helper to map DB row to SearchConfig model
export const mapSearchConfig = (row: SearchConfigRow): SearchConfig => ({
  id: row.id,
  name: row.name,
  keywords: JSON.parse(row.keywords),
  negative_keywords: row.negative_keywords ? JSON.parse(row.negative_keywords) : null,
  min_experience: row.min_experience,
  target_countries: row.target_countries ? JSON.parse(row.target_countries) : null,
  created_at: row.created_at
});

// Helper to map DB row to JobPosting model (fully typed)
export const mapJobPosting = (
  row: JobPostingRow & { company_name?: string }
): JobPosting & { company_name?: string } => ({
  id: row.id,
  company_id: row.company_id,
  company_name: row.company_name,
  search_config_id: row.search_config_id,
  title: row.title,
  url: row.url,
  raw_text: row.raw_text,
  is_relevant: Boolean(row.is_relevant),
  ai_parsed: Boolean(row.ai_parsed),
  ai_summary: row.ai_summary,
  tech_stack: row.tech_stack ? JSON.parse(row.tech_stack) : null,
  is_visited: Boolean(row.is_visited),
  created_at: row.created_at
});

// Helper to map DB row to LLMConfig model
export const mapLLMConfig = (row: LLMConfigRow): LLMConfig => ({
  id: row.id,
  provider: row.provider,
  model_name: row.model_name,
  api_key: row.api_key,
  is_active: Boolean(row.is_active)
});
