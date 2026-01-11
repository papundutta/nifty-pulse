import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SpotPriceDisplayProps {
  spotPrice: number | undefined;
  previousPrice?: number;
  className?: string;
}

export function SpotPriceDisplay({ spotPrice, previousPrice, className }: SpotPriceDisplayProps) {
  const change = previousPrice && spotPrice ? spotPrice - previousPrice : 0;
  const changePercent = previousPrice && spotPrice ? ((spotPrice - previousPrice) / previousPrice) * 100 : 0;

  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">NIFTY 50 Spot</span>
        <span className="text-3xl font-bold font-mono tracking-tight">
          {spotPrice ? spotPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '--'}
        </span>
      </div>
      {change !== 0 && (
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-sm font-medium',
            change > 0 ? 'bg-call-muted text-call' : 'bg-put-muted text-put'
          )}
        >
          <TrendIcon className="h-4 w-4" />
          <span>{change > 0 ? '+' : ''}{change.toFixed(2)}</span>
          <span className="text-xs">({changePercent.toFixed(2)}%)</span>
        </div>
      )}
    </div>
  );
}
