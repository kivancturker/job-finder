import { Clock, CheckCircle2, AlertTriangle, Loader2, XCircle } from 'lucide-react';
import type { QueueItem } from '../../types';

interface QueueGridProps {
  tasks: QueueItem[];
}

export default function QueueGrid({ tasks }: QueueGridProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Scrape Queue Status ({tasks.length} items)
      </h3>
      
      <div className="grid grid-cols-1 gap-3">
        {tasks.map((task) => {
          const isProcessing = task.status === 'processing';
          const isCompleted = task.status === 'completed';
          const isFailed = task.status === 'failed';

          return (
            <div 
              key={task.id} 
              className={`glass-effect rounded-xl border p-4.5 flex items-center justify-between gap-4 transition-all duration-300 ${
                isProcessing 
                  ? 'border-amber-500/20 bg-amber-950/5 shadow-[0_2px_12px_rgba(245,158,11,0.02)]' 
                  : isCompleted 
                    ? 'border-emerald-500/10 bg-emerald-950/2' 
                    : isFailed 
                      ? 'border-rose-500/20 bg-rose-950/5' 
                      : 'border-gray-900 bg-gray-950/5 text-gray-400'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Status Indicator */}
                <div className={`p-2 rounded-lg border shrink-0 ${
                  isProcessing 
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                    : isCompleted 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : isFailed 
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                        : 'bg-gray-900 border-gray-800 text-gray-500'
                }`}>
                  {isProcessing ? (
                    <Loader2 className="animate-spin" size={15} />
                  ) : isCompleted ? (
                    <CheckCircle2 size={15} />
                  ) : isFailed ? (
                    <XCircle size={15} />
                  ) : (
                    <Clock size={15} />
                  )}
                </div>

                <div className="min-w-0">
                  <h4 className={`text-sm font-semibold tracking-tight ${
                    isProcessing || isCompleted ? 'text-white' : 'text-gray-300'
                  }`}>
                    {task.companyName}
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[10px] text-gray-500">
                    <span className="font-mono bg-gray-900 px-1 py-0.5 rounded border border-gray-850">
                      ID: {task.id.slice(-6)}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{task.type} Job</span>
                    <span>•</span>
                    <span>Created {new Date(task.createdAt).toLocaleTimeString()}</span>
                  </div>
                  {task.error && (
                    <p className="text-[10px] text-rose-400 mt-2 flex items-start gap-1 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                      <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                      <span>{task.error}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border shrink-0 ${
                isProcessing 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                  : isCompleted 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : isFailed 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                      : 'bg-gray-900 border-gray-800 text-gray-500'
              }`}>
                {task.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
