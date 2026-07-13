import { scrapeCompany } from './scraperService';
import { QUEUE_DELAY_MS } from '../constants';
import db from '../db/database';
import { LlmService } from './llmService';
import { mapSearchConfig } from '../mappers';
import { SearchConfigRow } from '../types';

export interface QueueItem {
  id: string;
  type: 'scrape' | 'parse';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  companyId: number;
  companyName: string;
  searchConfigId: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  logs?: string[];
}

export type QueueEvent = 
  | { type: 'update'; task: QueueItem }
  | { type: 'clear'; queue: QueueItem[] };

type QueueListener = (event: QueueEvent) => void;

class QueueService {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private listeners: QueueListener[] = [];

  constructor() {
    this.loadFromDb();
  }

  private loadFromDb() {
    try {
      const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all() as any[];
      this.queue = rows.map(row => ({
        id: row.id,
        type: row.type as any,
        status: row.status as any,
        companyId: row.company_id || 0,
        companyName: row.company_name || '',
        searchConfigId: row.search_config_id || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        error: row.error || undefined,
        logs: row.logs ? JSON.parse(row.logs) : []
      }));

      // Update processing tasks to failed because they were cut off by a server restart/crash
      let hasPending = false;
      this.queue = this.queue.map(item => {
        if (item.status === 'processing') {
          item.status = 'failed';
          item.error = 'Task execution interrupted by server restart';
          if (!item.logs) item.logs = [];
          item.logs.push(`[${new Date().toLocaleTimeString()}] Task execution interrupted by server restart`);
          
          db.prepare('UPDATE tasks SET status = ?, error = ?, logs = ?, updated_at = ? WHERE id = ?')
            .run(item.status, item.error, JSON.stringify(item.logs), new Date().toISOString(), item.id);
        } else if (item.status === 'pending') {
          hasPending = true;
        }
        return item;
      });

      if (hasPending) {
        this.processNext();
      }
    } catch (err) {
      console.error('Failed to load queue from database:', err);
    }
  }

  // Register listener for real-time notifications (SSE in Phase 6)
  public addListener(listener: QueueListener) {
    this.listeners.push(listener);
  }

  public removeListener(listener: QueueListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notify(item: QueueItem) {
    try {
      db.prepare(`
        UPDATE tasks SET status = ?, updated_at = ?, error = ?, logs = ? WHERE id = ?
      `).run(
        item.status,
        item.updatedAt,
        item.error || null,
        item.logs ? JSON.stringify(item.logs) : '[]',
        item.id
      );
    } catch (err) {
      console.error(`Failed to update task ${item.id} in DB:`, err);
    }

    const event: QueueEvent = { type: 'update', task: item };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in QueueService listener:', err);
      }
    }
  }

  public addLog(taskId: string, message: string) {
    const item = this.queue.find(t => t.id === taskId);
    if (item) {
      if (!item.logs) {
        item.logs = [];
      }
      const timestamp = new Date().toLocaleTimeString();
      item.logs.push(`[${timestamp}] ${message}`);
      this.notify(item);
    }
  }

  public getQueue(): QueueItem[] {
    return [...this.queue];
  }

  public push(companyId: number, companyName: string, searchConfigId: number) {
    const item: QueueItem = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: 'scrape',
      status: 'pending',
      companyId,
      companyName,
      searchConfigId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      db.prepare(`
        INSERT INTO tasks (id, type, status, company_id, company_name, search_config_id, created_at, updated_at, error, logs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.type,
        item.status,
        item.companyId,
        item.companyName,
        item.searchConfigId,
        item.createdAt,
        item.updatedAt,
        item.error || null,
        '[]'
      );
    } catch (err) {
      console.error('Failed to insert new task into DB:', err);
    }

    this.queue.push(item);
    this.notify(item);

    // Trigger processing (runs asynchronously)
    this.processNext();
    return item;
  }

  public pushParseTask() {
    const item: QueueItem = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: 'parse',
      status: 'pending',
      companyId: 0,
      companyName: 'AI Pre-match Analysis',
      searchConfigId: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      db.prepare(`
        INSERT INTO tasks (id, type, status, company_id, company_name, search_config_id, created_at, updated_at, error, logs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.type,
        item.status,
        null,
        item.companyName,
        null,
        item.createdAt,
        item.updatedAt,
        item.error || null,
        '[]'
      );
    } catch (err) {
      console.error('Failed to insert new parse task into DB:', err);
    }

    this.queue.push(item);
    this.notify(item);

    // Trigger processing (runs asynchronously)
    this.processNext();
    return item;
  }

  private async processNext() {
    if (this.isProcessing) return;

    const nextItem = this.queue.find(item => item.status === 'pending');
    if (!nextItem) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    nextItem.status = 'processing';
    nextItem.updatedAt = new Date().toISOString();
    nextItem.logs = []; // Initialize logs for the run
    this.notify(nextItem);

    try {
      console.log(`[QueueService] Processing task ${nextItem.id} of type ${nextItem.type}`);
      this.addLog(nextItem.id, `Starting operations: ${nextItem.companyName}`);
      
      const onLog = (msg: string) => {
        this.addLog(nextItem.id, msg);
      };

      if (nextItem.type === 'parse') {
        await this.processParseTask(nextItem, onLog);
      } else {
        // Call scraper service to scrape the company's career page
        await scrapeCompany(nextItem.companyId, nextItem.searchConfigId, onLog);
      }

      nextItem.status = 'completed';
      this.addLog(nextItem.id, `Operations completed successfully.`);
    } catch (err: any) {
      console.error(`[QueueService] Task ${nextItem.id} failed:`, err);
      nextItem.status = 'failed';
      nextItem.error = err.message || String(err);
      this.addLog(nextItem.id, `Failed: ${nextItem.error}`);
    } finally {
      nextItem.updatedAt = new Date().toISOString();
      this.notify(nextItem);
      this.isProcessing = false;
      
      // Delay briefly between tasks (e.g. 1 second) to be gentle
      setTimeout(() => {
        this.processNext();
      }, QUEUE_DELAY_MS);
    }
  }

  private async processParseTask(task: QueueItem, onLog: (msg: string) => void) {
    // 1. Verify LLM configuration is active
    const activeLlm = db.prepare('SELECT id FROM llm_configs WHERE is_active = 1').get();
    if (!activeLlm) {
      throw new Error('No active LLM configuration. Please configure and activate an LLM provider first.');
    }

    // 2. Fetch pre-matches
    const preMatches = db.prepare(`
      SELECT jp.*, c.name as company_name 
      FROM job_postings jp
      JOIN companies c ON jp.company_id = c.id
      WHERE jp.is_relevant = 1 AND jp.ai_parsed = 0
    `).all() as any[];

    if (preMatches.length === 0) {
      onLog('No pending pre-matches found for analysis.');
      return;
    }

    onLog(`Found ${preMatches.length} pending pre-match(es) to analyze.`);
    for (let i = 0; i < preMatches.length; i++) {
      const job = preMatches[i];
      onLog(`[${i+1}/${preMatches.length}] Evaluating job: "${job.title}" at ${job.company_name}...`);

      const configRow = db.prepare('SELECT * FROM search_configs WHERE id = ?').get(job.search_config_id) as SearchConfigRow | undefined;
      if (!configRow) {
        onLog(`[${i+1}/${preMatches.length}] Warning: Associated search config not found for "${job.title}". Skipping.`);
        continue;
      }
      const searchConfig = mapSearchConfig(configRow);

      try {
        const aiResult = await LlmService.analyzeJob(job.raw_text, searchConfig, job.title, job.company_name);
        if (aiResult) {
          const isRelevant = aiResult.is_relevant ? 1 : 0;
          const techStackStr = JSON.stringify(aiResult.tech_stack);

          db.prepare(`
            UPDATE job_postings 
            SET is_relevant = ?, ai_parsed = 1, ai_summary = ?, tech_stack = ?, min_experience = ? 
            WHERE id = ?
          `).run(isRelevant, aiResult.ai_summary, techStackStr, aiResult.min_experience, job.id);

          onLog(`[${i+1}/${preMatches.length}] Result: ${aiResult.is_relevant ? 'RELEVANT' : 'IRRELEVANT'}. Fit summary: ${aiResult.ai_summary}`);
        } else {
          onLog(`[${i+1}/${preMatches.length}] Error: Failed to evaluate job via LLM.`);
        }
      } catch (err: any) {
        onLog(`[${i+1}/${preMatches.length}] Error evaluating job: ${err.message || err}`);
      }

      // Be gentle, sleep briefly
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  public clearCompleted() {
    this.queue = this.queue.filter(item => item.status !== 'completed' && item.status !== 'failed');
    
    try {
      db.prepare("DELETE FROM tasks WHERE status = 'completed' OR status = 'failed'").run();
    } catch (err) {
      console.error('Failed to clear finished tasks from DB:', err);
    }
    
    // Notify all active listeners of the clear event
    const event: QueueEvent = { type: 'clear', queue: this.queue };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in QueueService clear listener:', err);
      }
    }
  }

  public deleteTask(taskId: string) {
    const taskIndex = this.queue.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      const task = this.queue[taskIndex];
      if (task.status === 'processing') {
        throw new Error('Cannot delete a task while it is processing');
      }
      this.queue.splice(taskIndex, 1);
    }
    
    try {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    } catch (err) {
      console.error(`Failed to delete task ${taskId} from DB:`, err);
    }
    
    // Notify listeners of the updated queue
    const event: QueueEvent = { type: 'clear', queue: [...this.queue] };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in QueueService delete listener:', err);
      }
    }
  }
}

export const queueService = new QueueService();
export default queueService;
