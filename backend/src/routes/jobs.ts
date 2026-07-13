import { Router, Request, Response } from 'express';
import db from '../db/database';
import { ApiResponse, JobPostingRow, SearchConfigRow, SearchConfig, CompanyRow, JobPosting } from '../types';
import { mapJobPosting, mapSearchConfig } from '../mappers';
import { LlmService } from '../services/llmService';

const router = Router();

// GET /api/jobs/:id - Get detailed job
router.get('/:id', (req: Request, res: Response<ApiResponse<JobPosting & { company_name?: string }>>) => {
  try {
    const { id } = req.params;
    const row = db.prepare(`
      SELECT jp.*, c.name as company_name 
      FROM job_postings jp
      JOIN companies c ON jp.company_id = c.id
      WHERE jp.id = ?
    `).get(id) as (JobPostingRow & { company_name?: string }) | undefined;

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

// POST /api/jobs/:id/evaluate - Run LLM evaluation on a job description
router.post('/:id/evaluate', async (req: Request, res: Response<ApiResponse<JobPosting & { company_name?: string }>>) => {
  try {
    const { id } = req.params;

    // 1. Fetch job details
    const job = db.prepare('SELECT * FROM job_postings WHERE id = ?').get(id) as JobPostingRow | undefined;
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job posting not found' });
    }

    // 2. Fetch search config details
    const configRow = db.prepare('SELECT * FROM search_configs WHERE id = ?').get(job.search_config_id) as SearchConfigRow | undefined;
    if (!configRow) {
      return res.status(400).json({ success: false, error: 'Associated search config not found' });
    }
    const searchConfig = mapSearchConfig(configRow);

    // 3. Fetch company details
    const company = db.prepare('SELECT name FROM companies WHERE id = ?').get(job.company_id) as CompanyRow | undefined;
    const companyName = company ? company.name : 'Unknown Company';

    // 4. Run LLM evaluation
    const aiResult = await LlmService.analyzeJob(job.raw_text, searchConfig, job.title, companyName);
    if (!aiResult) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot evaluate job. Ensure an LLM configuration is active in settings.' 
      });
    }

    // 5. Update job details
    const isRelevant = aiResult.is_relevant ? 1 : 0;
    const techStackStr = JSON.stringify(aiResult.tech_stack);

    db.prepare(`
      UPDATE job_postings 
      SET is_relevant = ?, ai_parsed = 1, ai_summary = ?, tech_stack = ? 
      WHERE id = ?
    `).run(isRelevant, aiResult.ai_summary, techStackStr, id);

    // 6. Return updated job details
    const updatedJob = db.prepare(`
      SELECT jp.*, c.name as company_name 
      FROM job_postings jp
      JOIN companies c ON jp.company_id = c.id
      WHERE jp.id = ?
    `).get(id) as JobPostingRow & { company_name?: string };

    res.json({ success: true, data: mapJobPosting(updatedJob) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
