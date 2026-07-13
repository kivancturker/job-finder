import { useState, useEffect } from 'react';
import { 
  Terminal, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Wifi, 
  WifiOff, 
  XCircle,
  Play
} from 'lucide-react';
import type { ApiResponse } from '../types';

interface QueueItem {
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

export default function QueuePage() {
  const [tasks, setTasks] = useState<QueueItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let fallbackInterval: any = null;

    const connectSSE = () => {
      setConnectionStatus('connecting');
      eventSource = new EventSource('/api/run-search/sse');

      eventSource.onopen = () => {
        setConnectionStatus('connected');
        if (fallbackInterval) {
          clearInterval(fallbackInterval);
          fallbackInterval = null;
        }
      };

      eventSource.onerror = () => {
        setConnectionStatus('error');
        eventSource?.close();

        // Start fallback polling if not already started
        if (!fallbackInterval) {
          console.warn('SSE disconnected. Falling back to HTTP polling...');
          pollQueue(); // immediate poll
          fallbackInterval = setInterval(pollQueue, 3000);
        }

        // Try to reconnect SSE after 5 seconds
        setTimeout(() => {
          if (connectionStatus === 'error') {
            connectSSE();
          }
        }, 5000);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'initial') {
            setTasks(data.queue);
          } else if (data.type === 'update') {
            const updatedTask: QueueItem = data.task;
            setTasks((prev) => {
              const exists = prev.some((t) => t.id === updatedTask.id);
              if (exists) {
                return prev.map((t) => (t.id === updatedTask.id ? updatedTask : t));
              } else {
                return [...prev, updatedTask];
              }
            });
          } else if (data.type === 'clear') {
            setTasks(data.queue);
          }
        } catch (err) {
          console.error('Failed to parse SSE data:', err);
        }
      };
    };

    const pollQueue = async () => {
      try {
        const response = await fetch('/api/run-search/queue');
        const result: ApiResponse<{ tasks: QueueItem[] }> = await response.json();
        if (result.success && result.data) {
          setTasks(result.data.tasks);
        }
      } catch (err) {
        console.error('Fallback polling failed:', err);
      }
    };

    connectSSE();

    // Clean up
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, []);

  const handleClear = async () => {
    setClearing(true);
    try {
      const response = await fetch('/api/run-search/clear', {
        method: 'POST',
      });
      const result: ApiResponse<{ tasks: QueueItem[] }> = await response.json();
      if (result.success && result.data) {
        setTasks(result.data.tasks);
      } else {
        throw new Error(result.error || 'Failed to clear tasks');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setClearing(false);
    }
  };

  // Extract active processing task if any
  const processingTask = tasks.find((t) => t.status === 'processing');

  // Filter lists
  const failedTasks = tasks.filter((t) => t.status === 'failed');

  return (
    <div className="p-8 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold tracking-tight text-white">System Operations</h1>
            
            {/* Live Connection Badge */}
            <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : connectionStatus === 'connecting'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi size={10} className="animate-pulse" />
                  <span>Live Sync</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <Loader2 size={10} className="animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <WifiOff size={10} />
                  <span>Core Offline (Polling)</span>
                </>
              )}
            </span>
          </div>
          <p className="text-gray-400 mt-1 text-sm">Real-time status of scraping jobs and deep-tech company target evaluations.</p>
        </div>

        {tasks.length > 0 && (
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 disabled:opacity-50 text-gray-300 hover:text-white rounded-xl transition-all cursor-pointer font-semibold text-sm"
          >
            {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            <span>Clear Completed</span>
          </button>
        )}
      </div>

      {/* Main Content Pane */}
      {tasks.length === 0 ? (
        <div className="glass-effect rounded-2xl p-16 border border-gray-800/80 text-center max-w-xl mx-auto mt-6">
          <div className="p-4 bg-gray-900/60 rounded-3xl border border-gray-800 text-gray-500 w-fit mx-auto mb-4 animate-soft-pulse">
            <Terminal size={32} />
          </div>
          <h3 className="text-lg font-semibold text-white">Scraper Queue Idle</h3>
          <p className="text-gray-400 mt-2 text-sm max-w-sm mx-auto leading-relaxed">
            There are currently no operations in the scraping or AI analysis queues. Start a new run using the action button in the sidebar.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500 font-medium">
            <Play size={10} fill="currentColor" />
            <span>Click "START JOB SEARCH" on the sidebar panel</span>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Active / Processing Task Card (Hero Component) */}
          {processingTask && (
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
                      Scraping {processingTask.companyName}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Scraper Engine: Connecting to company career page and mapping elements...
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-950/80 border border-gray-900 rounded-xl px-3.5 py-2 w-fit">
                  <Clock size={13} />
                  <span>Started {new Date(processingTask.updatedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Queue Cards Grid */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Scrape Queue Status ({tasks.length} items)</h3>
            
            <div className="grid grid-cols-1 gap-3">
              {tasks.map((task) => {
                const isProcessing = task.status === 'processing';
                const isCompleted = task.status === 'completed';
                const isFailed = task.status === 'failed';

                return (
                  <div 
                    key={task.id}
                    className={`glass-effect rounded-xl border p-4.5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition-colors ${
                      isProcessing 
                        ? 'border-amber-500/30 bg-amber-950/10 shadow-[0_2px_12px_rgba(245,158,11,0.05)]' 
                        : isCompleted
                          ? 'border-emerald-500/20 bg-emerald-950/5'
                          : isFailed
                            ? 'border-rose-500/20 bg-rose-950/5'
                            : 'border-gray-900 bg-gray-950/10'
                    }`}
                  >
                    {/* Task Info */}
                    <div className="flex-1 min-w-0 flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        isProcessing 
                          ? 'bg-amber-500/10 text-amber-400' 
                          : isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : isFailed
                              ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-gray-900 text-gray-500'
                      }`}>
                        {isProcessing ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 size={15} />
                        ) : isFailed ? (
                          <XCircle size={15} />
                        ) : (
                          <Clock size={15} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-white truncate">
                          {task.companyName}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                          <span>Task ID: {task.id.slice(-8)}</span>
                          <span>•</span>
                          <span>Created {new Date(task.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Actions */}
                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      
                      {/* State Badge */}
                      <span className={`text-[10px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider border ${
                        isProcessing 
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                          : isCompleted
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : isFailed
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                              : 'bg-gray-900 border-gray-800 text-gray-400'
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    {/* Error message box if failed */}
                    {isFailed && task.error && (
                      <div className="w-full mt-2 sm:mt-0 sm:hidden p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex gap-1.5 items-start">
                        <AlertTriangle className="shrink-0 mt-0.5" size={13} />
                        <span>{task.error}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Desktop only full error print */}
            {failedTasks.some((t) => t.error) && (
              <div className="hidden sm:block mt-6 space-y-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Failure Operations Log</span>
                <div className="space-y-2">
                  {failedTasks.filter((t) => t.error).map((task) => (
                    <div key={task.id} className="p-3 bg-rose-500/5 border border-rose-500/10 text-rose-400/90 rounded-xl text-xs flex gap-2 items-start font-mono leading-relaxed">
                      <AlertTriangle className="shrink-0 mt-0.5 text-rose-400" size={14} />
                      <div className="flex-1">
                        <span className="font-semibold">{task.companyName}:</span> {task.error}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
