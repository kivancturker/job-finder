import { ArrowRight, Trash2, Loader2, Search } from 'lucide-react';
import type { SearchConfig } from '../../types';

interface StrategyListProps {
  configs: SearchConfig[];
  selectedId: number | undefined;
  onSelect: (config: SearchConfig) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
  actionId: number | null;
}

export default function StrategyList({
  configs,
  selectedId,
  onSelect,
  onDelete,
  actionId
}: StrategyListProps) {
  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-gray-800 rounded-2xl bg-gray-950/10">
        <div className="p-2.5 bg-gray-950 border border-gray-900 text-gray-500 rounded-lg mb-2">
          <Search size={16} />
        </div>
        <p className="text-xs text-gray-400">No strategies found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {configs.map((config) => {
        const isSelected = selectedId === config.id;
        const isDeleting = actionId === config.id;

        return (
          <div
            key={config.id}
            onClick={() => onSelect(config)}
            className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group relative overflow-hidden ${
              isSelected 
                ? 'bg-indigo-600/10 border-indigo-500/30 text-white shadow-[0_2px_12px_rgba(99,102,241,0.05)]' 
                : 'bg-gray-950 border-gray-900 hover:border-gray-800/80 text-gray-300 hover:text-white'
            }`}
          >
            {isSelected && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r" />
            )}
            
            <div className="flex-grow pr-4">
              <h3 className="text-xs font-semibold tracking-tight truncate">{config.name}</h3>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {config.keywords.slice(0, 3).map((kw, idx) => (
                  <span 
                    key={idx} 
                    className="px-1.5 py-0.5 bg-gray-900 border border-gray-850 rounded text-[9px] font-medium text-gray-400 max-w-[80px] truncate"
                  >
                    {kw}
                  </span>
                ))}
                {config.keywords.length > 3 && (
                  <span className="text-[9px] text-gray-500">+{config.keywords.length - 3}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => onDelete(config.id, e)}
                disabled={isDeleting}
                className="p-1.5 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/20 text-gray-500 hover:text-rose-400 rounded-lg transition-all"
                title="Delete Strategy"
              >
                {isDeleting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
              </button>
              <ArrowRight size={12} className={`transition-transform duration-300 group-hover:translate-x-0.5 ${
                isSelected ? 'text-indigo-400' : 'text-gray-500'
              }`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
