import { cn } from '@/lib/utils';

interface LiveIndicatorProps {
  isLive: boolean;
  lastUpdated: Date | null;
  className?: string;
}

export function LiveIndicator({ isLive, lastUpdated, className }: LiveIndicatorProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'status-dot',
            isLive ? 'status-live animate-pulse-glow' : 'status-error'
          )}
        />
        <span className={cn('font-medium', isLive ? 'text-call' : 'text-put')}>
          {isLive ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
      {lastUpdated && (
        <span className="text-muted-foreground text-xs">
          Last update: {formatTime(lastUpdated)}
        </span>
      )}
    </div>
  );
}
