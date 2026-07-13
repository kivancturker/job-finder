import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-4 max-w-xl mx-auto flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
      <div className="flex-grow">
        <h3 className="text-sm font-semibold text-rose-200">Error Occurred</h3>
        <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/40 text-rose-200 rounded-lg text-xs font-semibold tracking-wide transition-all"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
