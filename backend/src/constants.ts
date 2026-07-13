export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const MAX_NEW_POSTINGS_PER_RUN = 20;

export const SCRAPE_DELAY_MS = 500;

export const QUEUE_DELAY_MS = 1000;

export const LLM_TIMEOUT_MS = {
  ollama: 45000,
  openai: 30000,
  anthropic: 30000,
  openrouter: 45000
};

export const SCRAPER_ENGINES = ['cheerio', 'playwright'] as const;

export const LLM_PROVIDERS = ['ollama', 'openai', 'anthropic', 'openrouter'] as const;

export const RAW_TEXT_TRUNCATION_LIMIT = 12000;
