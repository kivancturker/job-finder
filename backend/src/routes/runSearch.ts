import { Router, Request, Response } from 'express';
import db from '../db/database';
import queueService, { QueueEvent } from '../services/queueService';
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

    // 2. Verify active LLM provider exists
    const activeLlm = db.prepare('SELECT id FROM llm_configs WHERE is_active = 1').get();
    if (!activeLlm) {
      return res.status(400).json({
        success: false,
        error: 'No active LLM configuration. Please configure and activate an LLM provider first.'
      });
    }

    // 3. Fetch all companies to scrape
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

// GET /api/run-search/sse - Server-Sent Events stream for queue updates
router.get('/sse', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Establish connection immediately
  res.flushHeaders();

  // Send initial state
  const initialData = {
    type: 'initial',
    queue: queueService.getQueue()
  };
  res.write(`data: ${JSON.stringify(initialData)}\n\n`);

  // Define listener to broadcast real-time events
  const listener = (event: QueueEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  queueService.addListener(listener);

  // Clean up on disconnect
  req.on('close', () => {
    queueService.removeListener(listener);
    res.end();
  });
});

// POST /api/run-search/clear - Clear completed and failed tasks from queue
router.post('/clear', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    queueService.clearCompleted();
    res.json({
      success: true,
      data: {
        message: 'Successfully cleared finished tasks.',
        tasks: queueService.getQueue()
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/run-search/analyze-prematches - Queue a task to run AI analysis on all pre-matched job postings
router.post('/analyze-prematches', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    // 1. Verify LLM configuration is active
    const activeLlm = db.prepare('SELECT id FROM llm_configs WHERE is_active = 1').get();
    if (!activeLlm) {
      return res.status(400).json({
        success: false,
        error: 'No active LLM configuration. Please configure and activate an LLM provider first.'
      });
    }

    // 2. Fetch count of prematches
    const prematchesCount = db.prepare('SELECT COUNT(*) as count FROM job_postings WHERE is_relevant = 1 AND ai_parsed = 0').get() as { count: number };
    if (prematchesCount.count === 0) {
      return res.status(400).json({
        success: false,
        error: 'No pre-matches found to analyze.'
      });
    }

    // 3. Push parse task to queue
    const task = queueService.pushParseTask();

    res.status(202).json({
      success: true,
      data: {
        message: `Successfully queued AI analysis task for ${prematchesCount.count} pre-matches.`,
        task
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/run-search/queue/:id - Delete a task from history/queue
router.delete('/queue/:id', (req: Request, res: Response<ApiResponse<any>>) => {
  try {
    const { id } = req.params;
    queueService.deleteTask(id);
    res.json({
      success: true,
      data: {
        message: `Task ${id} deleted successfully.`,
        tasks: queueService.getQueue()
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
