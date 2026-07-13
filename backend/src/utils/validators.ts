// Validation functions throwing descriptive error messages
import { SCRAPER_ENGINES, LLM_PROVIDERS } from '../constants';

export function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid career page URL');
  }
}

export function validateScraperEngine(engine: any): void {
  if (!SCRAPER_ENGINES.includes(engine)) {
    throw new Error(`scraper_engine must be one of: ${SCRAPER_ENGINES.join(', ')}`);
  }
}

export function validateLlmProvider(provider: any): void {
  if (!LLM_PROVIDERS.includes(provider)) {
    throw new Error(`Provider must be one of: ${LLM_PROVIDERS.join(', ')}`);
  }
}

export function validateKeywordsArray(keywords: unknown): void {
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    throw new Error('Keywords must be a non-empty array of strings');
  }
  if (!keywords.every(k => typeof k === 'string')) {
    throw new Error('Keywords must be an array of strings');
  }
}
