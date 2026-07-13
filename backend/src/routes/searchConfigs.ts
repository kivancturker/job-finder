import { Router, Request, Response } from 'express';
import db from '../db/database';
import { SearchConfigRow, ApiResponse, SearchConfig } from '../types';
import { mapSearchConfig, mapJobPosting } from '../mappers';
import { validateKeywordsArray } from '../utils/validators';

const router = Router();

// GET /api/search_configs - List all strategies
router.get('/', (req: Request, res: Response<ApiResponse<SearchConfig[]>>) => {
  try {
    const rows = db.prepare('SELECT * FROM search_configs ORDER BY created_at DESC').all() as SearchConfigRow[];
    res.json({ success: true, data: rows.map(mapSearchConfig) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/search_configs/:id - Retrieve one strategy
router.get('/:id', (req: Request, res: Response<ApiResponse<SearchConfig>>) => {
  try {
    const row = db.prepare('SELECT * FROM search_configs WHERE id = ?').get(req.params.id) as SearchConfigRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Search configuration not found' });
    }
    res.json({ success: true, data: mapSearchConfig(row) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/search_configs - Create a strategy
router.post('/', (req: Request, res: Response<ApiResponse<SearchConfig>>) => {
  try {
    const { name, keywords, negative_keywords, min_experience, target_countries, custom_prompt } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Strategy name is required' });
    }

    try {
      validateKeywordsArray(keywords);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const keywordsStr = JSON.stringify(keywords);
    const negativeKeywordsStr = negative_keywords ? JSON.stringify(negative_keywords) : null;
    const targetCountriesStr = target_countries ? JSON.stringify(target_countries) : null;
    const exp = min_experience !== undefined ? Number(min_experience) : 0;
    const customPromptStr = custom_prompt ? String(custom_prompt).trim() : null;

    const stmt = db.prepare(
      'INSERT INTO search_configs (name, keywords, negative_keywords, min_experience, target_countries, custom_prompt) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(name, keywordsStr, negativeKeywordsStr, exp, targetCountriesStr, customPromptStr);

    const newRow = db.prepare('SELECT * FROM search_configs WHERE id = ?').get(result.lastInsertRowid) as SearchConfigRow;
    res.status(201).json({ success: true, data: mapSearchConfig(newRow) });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ success: false, error: 'A search configuration with this name already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/search_configs/:id - Update a strategy
router.put('/:id', (req: Request, res: Response<ApiResponse<SearchConfig>>) => {
  try {
    const { name, keywords, negative_keywords, min_experience, target_countries, custom_prompt } = req.body;
    const { id } = req.params;

    const row = db.prepare('SELECT * FROM search_configs WHERE id = ?').get(id) as SearchConfigRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Search configuration not found' });
    }

    if (!name) {
      return res.status(400).json({ success: false, error: 'Strategy name is required' });
    }

    try {
      validateKeywordsArray(keywords);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }

    const keywordsStr = JSON.stringify(keywords);
    const negativeKeywordsStr = negative_keywords ? JSON.stringify(negative_keywords) : null;
    const targetCountriesStr = target_countries ? JSON.stringify(target_countries) : null;
    const exp = min_experience !== undefined ? Number(min_experience) : 0;
    const customPromptStr = custom_prompt ? String(custom_prompt).trim() : null;

    const stmt = db.prepare(
      'UPDATE search_configs SET name = ?, keywords = ?, negative_keywords = ?, min_experience = ?, target_countries = ?, custom_prompt = ? WHERE id = ?'
    );
    stmt.run(name, keywordsStr, negativeKeywordsStr, exp, targetCountriesStr, customPromptStr, id);

    const updatedRow = db.prepare('SELECT * FROM search_configs WHERE id = ?').get(id) as SearchConfigRow;
    res.json({ success: true, data: mapSearchConfig(updatedRow) });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ success: false, error: 'A search configuration with this name already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/search_configs/:id - Delete a strategy
router.delete('/:id', (req: Request, res: Response<ApiResponse<{ id: number }>>) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM search_configs WHERE id = ?').get(id) as SearchConfigRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Search configuration not found' });
    }

    db.prepare('DELETE FROM search_configs WHERE id = ?').run(id);
    res.json({ success: true, data: { id: Number(id) } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/search_configs/:id/jobs - Get all jobs matching a strategy
router.get('/:id/jobs', (req: Request, res: Response<ApiResponse<any[]>>) => {
  try {
    const { id } = req.params;
    
    // Check if configuration exists
    const config = db.prepare('SELECT id FROM search_configs WHERE id = ?').get(id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Search configuration not found' });
    }

    // Join with companies to get the company name for the front-end list
    const jobs = db.prepare(`
      SELECT jp.*, c.name as company_name 
      FROM job_postings jp
      JOIN companies c ON jp.company_id = c.id
      WHERE jp.search_config_id = ?
      ORDER BY jp.created_at DESC
    `).all(id) as any[];

    // Map rows to parse JSON and properly convert booleans
    const mappedJobs = jobs.map(mapJobPosting);

    res.json({ success: true, data: mappedJobs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
