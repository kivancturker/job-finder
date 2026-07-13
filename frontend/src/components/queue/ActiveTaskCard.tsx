import { Loader2, Clock } from 'lucide-react';
import type { QueueItem } from '../../types';

interface ActiveTaskCardProps {
  task: QueueItem | undefined;
}

export default function ActiveTaskCard({ task }: ActiveTaskCardProps) {
  if (!task) return null;

  return (
    <div className="glass-effect rounded-2xl border border-amber-500/25 bg-amber-950/5 p-6 shadow-[0_4px_24px_rgba(245,158,11,0.05)] relative overflow-hidden animate-soft-pulse">
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Active Operations Run</span>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mt-2">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-1">
            <Loader2 className="animate-spin" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-white tracking-tight">
              Scraping {task.companyName}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Scraper Engine: Connecting to company career page and mapping elements...
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-950/80 border border-gray-900 rounded-xl px-3.5 py-2 w-fit">
          <Clock size={13} />
          <span>Started {new Date(task.updatedAt).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
