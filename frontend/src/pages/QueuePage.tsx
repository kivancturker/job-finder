import { useState, useEffect } from 'react';
import { Trash2, Loader2, Wifi, WifiOff, Terminal } from 'lucide-react';
import type { QueueItem } from '../types';
import { api } from '../api';
import ActiveTaskCard from '../components/queue/ActiveTaskCard';
import QueueGrid from '../components/queue/QueueGrid';
import EmptyState from '../components/ui/EmptyState';

export default function QueuePage() {
  const [tasks, setTasks] = useState<QueueItem[]>([]);
  const [clearing, setClearing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

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
        if (eventSource) {
          eventSource.close();
        }
        // Start polling fallback if not already running
        if (!fallbackInterval) {
          pollQueue(); // Immediate first attempt
          fallbackInterval = setInterval(pollQueue, 3000);
        }
        // Retry connection later
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
        const result = await api.runSearch.getQueue();
        setTasks(result.tasks);
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
      const result = await api.runSearch.clearQueue();
      setTasks(result.tasks);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task from history?')) return;
    try {
      await api.runSearch.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  const processingTask = tasks.find((t) => t.status === 'processing');

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col h-full overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold tracking-tight text-white">System Operations</h1>
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide ${
              connectionStatus === 'connected' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : connectionStatus === 'connecting'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {connectionStatus === 'connected' ? <Wifi size={10} /> : <WifiOff size={10} />}
              <span className="capitalize">{connectionStatus}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 font-medium">
            Monitor real-time job scraping and deep-tech AI parsing pipeline tasks.
          </p>
        </div>

        {tasks.length > 0 && (
          <button
            onClick={handleClear}
            disabled={clearing || tasks.some(t => t.status === 'processing' || t.status === 'pending')}
            className="px-4 py-2 hover:bg-rose-950/20 text-gray-500 hover:text-rose-400 border border-gray-900 hover:border-rose-500/25 rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            <span>Clear Operations Log</span>
          </button>
        )}
      </div>

      {/* Main Panel Content */}
      <div className="flex-grow space-y-8">
        {tasks.length === 0 ? (
          <EmptyState
            icon={Terminal}
            title="Operational Queue Empty"
            description="There are currently no active operations in the scraping or AI analysis queues. Use the action button in the sidebar to start a new search."
          />
        ) : (
          <div className="space-y-8">
            <ActiveTaskCard task={processingTask} />
            <QueueGrid tasks={tasks} onDeleteTask={handleDeleteTask} />
          </div>
        )}
      </div>
    </div>
  );
}
