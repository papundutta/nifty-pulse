import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { calculateButterflyChain, isATMorOTM, ButterflyData } from '@/lib/butterflyCalculations';
import { cn } from '@/lib/utils';

interface ButterflyChainTableProps {
  optionData: any[];
  spotPrice: number;
  type: 'CALL' | 'PUT';
}

const formatPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  return `₹${value.toFixed(2)}`;
};

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(1)}%`;
};

// Value color classes based on percentage
const getValueColorClass = (value: number): string => {
  if (value >= 90) return 'bg-emerald-500/20 text-emerald-400';
  if (value >= 70) return 'bg-green-500/20 text-green-400';
  if (value >= 50) return 'bg-yellow-500/20 text-yellow-400';
  if (value >= 30) return 'bg-orange-500/20 text-orange-400';
  if (value > 0) return 'bg-red-500/20 text-red-400';
  return 'text-muted-foreground';
};

export function ButterflyChainTable({ optionData, spotPrice, type }: ButterflyChainTableProps) {
  const { butterflyData, atmStrike } = useMemo(() => {
    if (!optionData?.length || !spotPrice) return { butterflyData: [], atmStrike: 0 };
    
    const data = calculateButterflyChain(optionData, spotPrice, type);
    
    // Find ATM strike
    const strikes = data.map(d => d.strike).filter(s => s > 0);
    const atm = strikes.reduce((prev, curr) =>
      Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
    , strikes[0] || 0);
    
    return { butterflyData: data, atmStrike: atm };
  }, [optionData, spotPrice, type]);

  const gaps = [50, 100, 150, 200];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className={cn('w-3 h-3 rounded-full', type === 'CALL' ? 'bg-call' : 'bg-put')} />
          {type === 'CALL' ? 'CE Butterfly (1-2-1)' : 'PE Butterfly (1-2-1)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[600px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th colSpan={2} className={cn('p-2 text-center font-medium', type === 'CALL' ? 'text-call' : 'text-put')}>
                    Premium
                  </th>
                  <th className={cn('p-2 text-center font-medium', type === 'CALL' ? 'text-call' : 'text-put')}>
                    Strike
                  </th>
                  {gaps.map(gap => (
                    <th key={gap} colSpan={2} className="p-2 text-center font-medium text-muted-foreground border-l border-border">
                      Gap {gap}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-2 text-center text-xs text-blue-400">Bid</th>
                  <th className="p-2 text-center text-xs text-orange-400">Ask</th>
                  <th className="p-2"></th>
                  {gaps.map(gap => (
                    <React.Fragment key={`${gap}-sub`}>
                      <th className="p-2 text-center text-xs text-muted-foreground border-l border-border">Rate</th>
                      <th className="p-2 text-center text-xs text-muted-foreground">Value%</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {butterflyData.map((row) => {
                  const isATMorOTMStrike = isATMorOTM(row.strike, atmStrike, type);
                  const isITM = !isATMorOTMStrike;
                  
                  return (
                    <tr 
                      key={row.strike} 
                      className={cn(
                        'border-b border-border/50 hover:bg-muted/30 transition-colors', 
                        row.isATM && 'bg-atm/10 font-semibold',
                        isITM && 'opacity-50'
                      )}
                    >
                      <td className="p-2 text-center text-blue-400">{formatPrice(row.bid)}</td>
                      <td className="p-2 text-center text-orange-400">{formatPrice(row.ask)}</td>
                      <td className="p-2 font-semibold text-center">
                        {row.strike.toLocaleString('en-IN')}
                        {row.isATM && <span className="ml-2 text-xs bg-call/20 text-call px-1.5 py-0.5 rounded">ATM</span>}
                        {isITM && <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">ITM</span>}
                      </td>
                      {gaps.map(gap => {
                        const gapKey = `gap${gap}` as keyof ButterflyData['gaps'];
                        const gapData = row.gaps[gapKey];
                        const showValueColors = isATMorOTMStrike;
                        
                        return (
                          <React.Fragment key={`${row.strike}-${gap}`}>
                            <td className="p-2 text-center border-l border-border/50">
                              {gapData ? formatPrice(gapData.rate) : '-'}
                            </td>
                            <td className="p-2 text-center">
                              {gapData ? (
                                <span className={cn(
                                  'px-1.5 py-0.5 rounded text-xs',
                                  showValueColors ? getValueColorClass(gapData.value) : 'text-muted-foreground'
                                )}>
                                  {formatPercent(gapData.value)}
                                </span>
                              ) : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
