import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 glass-effect rounded-2xl border border-gray-900 bg-gray-950/20 max-w-lg mx-auto">
      <div className="p-4 bg-gray-900/60 rounded-full border border-gray-800 text-gray-500 mb-4">
        <Icon size={32} className="stroke-[1.5]" />
      </div>
      <h3 className="text-lg font-display font-semibold text-white tracking-tight">{title}</h3>
      <p className="text-sm text-gray-400 mt-2 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-sm font-semibold tracking-wide shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
