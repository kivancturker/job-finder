# Database Schema Specification
Database: SQLite (using `better-sqlite3` in Express)

## Table: `companies`
Stores the target websites to be scraped.
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `name` (TEXT, UNIQUE, NOT NULL): Company name.
- `career_url` (TEXT, NOT NULL): The URL to start scraping.
- `scraper_engine` (TEXT, NOT NULL DEFAULT 'cheerio'): Enum ('cheerio', 'playwright').
- `target_selector` (TEXT, NULLABLE): CSS selector containing job cards (if manual override needed).
- `created_at` (DATETIME, DEFAULT CURRENT_TIMESTAMP)

## Table: `search_configs`
Stores the different job search strategies (e.g., "Database Internals", "Junior Dev").
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `name` (TEXT, UNIQUE, NOT NULL): Name of the strategy.
- `keywords` (TEXT, NOT NULL): JSON array of strings (e.g., `["C++", "Rust", "Storage"]`).
- `negative_keywords` (TEXT, NULLABLE): JSON array of strings to explicitly exclude.
- `min_experience` (INTEGER, DEFAULT 0): Minimum years required.
- `target_countries` (TEXT, NULLABLE): JSON array of strings (e.g., `["USA", "Remote"]`).
- `created_at` (DATETIME, DEFAULT CURRENT_TIMESTAMP)

## Table: `job_postings`
Stores the scraped jobs and their LLM evaluation results.
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `company_id` (INTEGER, FOREIGN KEY REFERENCES companies(id), NOT NULL)
- `search_config_id` (INTEGER, FOREIGN KEY REFERENCES search_configs(id), NOT NULL)
- `title` (TEXT, NOT NULL)
- `url` (TEXT, UNIQUE, NOT NULL): Used for deduplication.
- `raw_text` (TEXT, NOT NULL): The scraped HTML/Text.
- `is_relevant` (BOOLEAN, DEFAULT FALSE): Result of fast-keyword pre-filter.
- `ai_parsed` (BOOLEAN, DEFAULT FALSE): Whether LLM has evaluated it.
- `ai_summary` (TEXT, NULLABLE): 2-sentence explanation from LLM.
- `tech_stack` (TEXT, NULLABLE): JSON array of extracted tech.
- `is_visited` (BOOLEAN, DEFAULT FALSE): True if the user has clicked on this job in the UI.
- `created_at` (DATETIME, DEFAULT CURRENT_TIMESTAMP)

## Table: `llm_configs`
Stores user preferences for the AI processing step.
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `provider` (TEXT, NOT NULL): Enum ('ollama', 'openai', 'anthropic').
- `model_name` (TEXT, NOT NULL): e.g., 'llama3', 'gpt-4o'.
- `api_key` (TEXT, NULLABLE): Encrypted or plain text string (local only).
- `is_active` (BOOLEAN, DEFAULT FALSE): Only one config can be active at a time.