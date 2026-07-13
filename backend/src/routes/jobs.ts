import { Router, Request, Response } from 'express';
import db from '../db/database';
import { ApiResponse } from '../types';

const router = Router();

// Helper to map DB row to API model
const mapJobPosting = (row: any): any => ({
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

// GET /api/jobs/:id - Get detailed job
router.get('/:id', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { id } = req.params;
    const row = db.prepare(`
      SELECT jp.*, c.name as company_name 
      FROM job_postings jp
      JOIN companies c ON jp.company_id = c.id
      WHERE jp.id = ?
    `).get(id) as any | undefined;

    if (!row) {
      return res.status(404).json({ success: false, error: 'Job posting not found' });
    }
    res.json({ success: true, data: mapJobPosting(row) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/jobs/:id/visit - Mark job as visited
router.put('/:id/visit', (req: Request, res: Response<ApiResponse<{ id: number; is_visited: boolean }>>) => {
  try {
    const { id } = req.params;
    const row = db.prepare('SELECT id FROM job_postings WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Job posting not found' });
    }

    db.prepare('UPDATE job_postings SET is_visited = 1 WHERE id = ?').run(id);
    res.json({ success: true, data: { id: Number(id), is_visited: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
