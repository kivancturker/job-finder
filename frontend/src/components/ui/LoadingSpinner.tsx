import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  text?: string;
}

export default function LoadingSpinner({ text = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      {text && <p className="text-gray-400 text-sm font-medium">{text}</p>}
    </div>
  );
}
