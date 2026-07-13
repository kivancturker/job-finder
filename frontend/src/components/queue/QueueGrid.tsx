import { useState } from 'react';
import { Clock, CheckCircle2, AlertTriangle, Loader2, XCircle, ChevronDown, ChevronUp, Terminal, Trash2 } from 'lucide-react';
import type { QueueItem } from '../../types';

interface QueueGridProps {
  tasks: QueueItem[];
  onDeleteTask: (id: string) => void;
}

export default function QueueGrid({ tasks, onDeleteTask }: QueueGridProps) {
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  if (tasks.length === 0) return null;

  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

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
          const hasLogs = task.logs && task.logs.length > 0;
          const isExpanded = !!expandedTaskIds[task.id];

          return (
            <div 
              key={task.id} 
              onClick={() => hasLogs && toggleExpand(task.id)}
              className={`glass-effect rounded-xl border p-4.5 flex flex-col gap-1 transition-all duration-300 ${
                hasLogs ? 'cursor-pointer hover:border-gray-800' : ''
              } ${
                isProcessing 
                  ? 'border-amber-500/20 bg-amber-950/5 shadow-[0_2px_12px_rgba(245,158,11,0.02)]' 
                  : isCompleted 
                    ? 'border-emerald-500/10 bg-emerald-950/2' 
                    : isFailed 
                      ? 'border-rose-500/20 bg-rose-950/5' 
                      : 'border-gray-900 bg-gray-950/5 text-gray-400'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
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

                <div className="flex items-center gap-3 shrink-0">
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

                  {/* Chevron Toggle */}
                  {hasLogs && (
                    <div className="text-gray-500 hover:text-gray-350 transition-colors">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  )}

                  {/* Delete Button */}
                  {!isProcessing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTask(task.id);
                      }}
                      className="p-1.5 text-gray-500 hover:text-rose-450 hover:bg-gray-900/60 rounded-lg transition-colors cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Collapsible log view */}
              {isExpanded && task.logs && task.logs.length > 0 && (
                <div 
                  onClick={(e) => e.stopPropagation()} 
                  className="mt-3.5 border border-gray-900 rounded-xl overflow-hidden bg-black/40 shadow-inner"
                >
                  <div className="flex items-center gap-1.5 px-3.5 py-1.5 border-b border-gray-900 bg-gray-950/20 text-gray-500 text-[9px] font-bold uppercase tracking-wider font-sans">
                    <Terminal size={10} />
                    <span>Execution Logs</span>
                  </div>
                  <div className="p-3.5 font-mono text-[9px] text-emerald-450/90 max-h-40 overflow-y-auto space-y-1 scrollbar-thin select-text">
                    {task.logs.map((logLine, idx) => (
                      <div key={idx} className="leading-relaxed whitespace-pre-wrap">{logLine}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
