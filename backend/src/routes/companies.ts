import { Router, Request, Response } from 'express';
import db from '../db/database';
import { CompanyRow, ApiResponse, Company } from '../types';

const router = Router();

// Helper to map DB row to API model
const mapCompany = (row: CompanyRow): Company => ({
  id: row.id,
  name: row.name,
  career_url: row.career_url,
  scraper_engine: row.scraper_engine,
  target_selector: row.target_selector,
  created_at: row.created_at
});

// GET /api/companies - List all
router.get('/', (req: Request, res: Response<ApiResponse<Company[]>>) => {
  try {
    const rows = db.prepare('SELECT * FROM companies ORDER BY name ASC').all() as CompanyRow[];
    res.json({ success: true, data: rows.map(mapCompany) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/companies/:id - Retrieve one
router.get('/:id', (req: Request, res: Response<ApiResponse<Company>>) => {
  try {
    const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id) as CompanyRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }
    res.json({ success: true, data: mapCompany(row) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/companies - Create
router.post('/', (req: Request, res: Response<ApiResponse<Company>>) => {
  try {
    const { name, career_url, scraper_engine, target_selector } = req.body;
    if (!name || !career_url) {
      return res.status(400).json({ success: false, error: 'Name and career_url are required' });
    }

    // URL verification
    try {
      new URL(career_url);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid career page URL' });
    }

    const engine = scraper_engine || 'cheerio';
    if (engine !== 'cheerio' && engine !== 'playwright') {
      return res.status(400).json({ success: false, error: "scraper_engine must be 'cheerio' or 'playwright'" });
    }

    const stmt = db.prepare(
      'INSERT INTO companies (name, career_url, scraper_engine, target_selector) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(name, career_url, engine, target_selector || null);
    
    const newRow = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid) as CompanyRow;
    res.status(201).json({ success: true, data: mapCompany(newRow) });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ success: false, error: 'A company with this name already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/companies/:id - Update
router.put('/:id', (req: Request, res: Response<ApiResponse<Company>>) => {
  try {
    const { name, career_url, scraper_engine, target_selector } = req.body;
    const { id } = req.params;

    const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as CompanyRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    if (!name || !career_url) {
      return res.status(400).json({ success: false, error: 'Name and career_url are required' });
    }

    try {
      new URL(career_url);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid career page URL' });
    }

    const engine = scraper_engine || 'cheerio';
    if (engine !== 'cheerio' && engine !== 'playwright') {
      return res.status(400).json({ success: false, error: "scraper_engine must be 'cheerio' or 'playwright'" });
    }

    const stmt = db.prepare(
      'UPDATE companies SET name = ?, career_url = ?, scraper_engine = ?, target_selector = ? WHERE id = ?'
    );
    stmt.run(name, career_url, engine, target_selector || null, id);

    const updatedRow = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as CompanyRow;
    res.json({ success: true, data: mapCompany(updatedRow) });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ success: false, error: 'A company with this name already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/companies/:id - Delete
router.delete('/:id', (req: Request, res: Response<ApiResponse<{ id: number }>>) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as CompanyRow | undefined;
    if (!row) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    db.prepare('DELETE FROM companies WHERE id = ?').run(id);
    res.json({ success: true, data: { id: Number(id) } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
