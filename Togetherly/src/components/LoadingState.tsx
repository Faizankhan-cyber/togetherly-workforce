import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Loader2 size={24} className="text-primary animate-spin mb-3" />
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}
