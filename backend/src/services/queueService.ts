import { scrapeCompany } from './scraperService';
import { QUEUE_DELAY_MS } from '../constants';

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
}

export type QueueEvent = 
  | { type: 'update'; task: QueueItem }
  | { type: 'clear'; queue: QueueItem[] };

type QueueListener = (event: QueueEvent) => void;

class QueueService {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private listeners: QueueListener[] = [];

  // Register listener for real-time notifications (SSE in Phase 6)
  public addListener(listener: QueueListener) {
    this.listeners.push(listener);
  }

  public removeListener(listener: QueueListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notify(item: QueueItem) {
    const event: QueueEvent = { type: 'update', task: item };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in QueueService listener:', err);
      }
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
    this.notify(nextItem);

    try {
      console.log(`[QueueService] Processing task ${nextItem.id} for company ${nextItem.companyName}`);
      
      // Call scraper service to scrape the company's career page
      await scrapeCompany(nextItem.companyId, nextItem.searchConfigId);

      nextItem.status = 'completed';
    } catch (err: any) {
      console.error(`[QueueService] Task ${nextItem.id} failed:`, err);
      nextItem.status = 'failed';
      nextItem.error = err.message || String(err);
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

  public clearCompleted() {
    this.queue = this.queue.filter(item => item.status !== 'completed' && item.status !== 'failed');
    
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
}

export const queueService = new QueueService();
export default queueService;
