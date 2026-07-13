import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'jobs.db');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Enable foreign keys and WAL mode for better performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Define database schemas
const schema = `
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    career_url TEXT NOT NULL,
    scraper_engine TEXT NOT NULL DEFAULT 'cheerio',
    target_selector TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS search_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    keywords TEXT NOT NULL, -- JSON array of strings
    negative_keywords TEXT, -- JSON array of strings
    min_experience INTEGER DEFAULT 0,
    target_countries TEXT, -- JSON array of strings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS job_postings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    search_config_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    raw_text TEXT NOT NULL,
    is_relevant INTEGER DEFAULT 0, -- 0 = false, 1 = true
    ai_parsed INTEGER DEFAULT 0, -- 0 = false, 1 = true
    ai_summary TEXT,
    tech_stack TEXT, -- JSON array of strings
    is_visited INTEGER DEFAULT 0, -- 0 = false, 1 = true
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY(search_config_id) REFERENCES search_configs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS llm_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL, -- Enum: 'ollama', 'openai', 'anthropic'
    model_name TEXT NOT NULL,
    api_key TEXT,
    is_active INTEGER DEFAULT 0 -- 0 = false, 1 = true
  );
`;

// Run schema migration
db.exec(schema);

export default db;
