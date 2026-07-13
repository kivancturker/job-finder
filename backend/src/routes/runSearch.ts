import { Router, Request, Response } from 'express';
import db from '../db/database';
import queueService from '../services/queueService';
import { ApiResponse } from '../types';

const router = Router();

// POST /api/run-search - Trigger a new job search run
router.post('/', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { search_config_id } = req.body;

    if (!search_config_id) {
      return res.status(400).json({ success: false, error: 'search_config_id is required' });
    }

    // 1. Verify search configuration exists
    const searchConfig = db.prepare('SELECT * FROM search_configs WHERE id = ?').get(search_config_id);
    if (!searchConfig) {
      return res.status(404).json({ success: false, error: `Search configuration with ID ${search_config_id} not found` });
    }

    // 2. Fetch all companies to scrape
    const companies = db.prepare('SELECT id, name FROM companies').all() as { id: number; name: string }[];
    if (companies.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No companies are recorded in the database. Add at least one company before starting a job search.' 
      });
    }

    console.log(`[RunSearch] Queueing search run for config: ${(searchConfig as any).name} across ${companies.length} companies.`);

    // 3. Queue a scraping job for each company
    const queuedTasks = [];
    for (const company of companies) {
      const task = queueService.push(company.id, company.name, Number(search_config_id));
      queuedTasks.push(task);
    }

    // Return 202 Accepted (processing happens asynchronously in the background)
    res.status(202).json({
      success: true,
      data: {
        message: `Successfully queued scraping tasks for ${companies.length} companies.`,
        tasks: queuedTasks
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/run-search/queue - Optional helper route to inspect queue items
router.get('/queue', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    res.json({
      success: true,
      data: {
        tasks: queueService.getQueue()
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
