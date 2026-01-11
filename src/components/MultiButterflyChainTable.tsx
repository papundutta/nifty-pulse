import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { transformOptionDataForButterfly, isATMorOTM } from '@/lib/butterflyCalculations';
import { cn } from '@/lib/utils';

interface MultiButterflyChainTableProps {
  optionData: any[];
  spotPrice: number;
  type: 'CALL' | 'PUT';
}

// Reordered legs so gap 50 appears first
const CE_LEGS = [
  { gap: 50, ratio: 2.0 },
  { gap: 100, ratio: 2.0 },
  { gap: 100, ratio: 1.33 },
  { gap: 150, ratio: 1.5 },
  { gap: 150, ratio: 2.0 },
  { gap: 200, ratio: 2.0 },
  { gap: 250, ratio: 1.5 },
];

const PE_LEGS = [
  { gap: 50, ratio: 1.33 },
  { gap: 100, ratio: 1.5 },
  { gap: 100, ratio: 1.33 },
  { gap: 150, ratio: 1.5 },
  { gap: 150, ratio: 2.0 },
  { gap: 200, ratio: 2.0 },
  { gap: 250, ratio: 2.0 },
];

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

export function MultiButterflyChainTable({ optionData, spotPrice, type }: MultiButterflyChainTableProps) {
  const { butterflyData, atmStrike } = useMemo(() => {
    if (!optionData?.length || !spotPrice) return { butterflyData: [], atmStrike: 0 };
    
    const transformedData = transformOptionDataForButterfly(optionData);
    const strikes = transformedData
      .filter((item: any) => item.strike_price > 0)
      .map((item: any) => item.strike_price)
      .sort((a: number, b: number) => a - b);
    
    const atm = strikes.length > 0 
      ? strikes.reduce((prev: number, curr: number) =>
          Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
        )
      : 0;

    const legs = type === 'CALL' ? CE_LEGS : PE_LEGS;
    
    // Create a map for quick lookup
    const strikeDataMap = new Map<number, any>();
    transformedData.forEach((item: any) => {
      strikeDataMap.set(item.strike_price, item);
    });

    // Sort strikes for display (CALL ascending, PUT descending)
    const sortedStrikes = type === 'CALL'
      ? strikes.slice().sort((a: number, b: number) => a - b)
      : strikes.slice().sort((a: number, b: number) => b - a);

    const toNumberOrNull = (v: any) => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const data = sortedStrikes.map((strike: number) => {
      const strikeInfo = strikeDataMap.get(strike) ?? {};

      const bid = toNumberOrNull(type === 'CALL' ? strikeInfo.call_bid : strikeInfo.put_bid);
      const ask = toNumberOrNull(type === 'CALL' ? strikeInfo.call_ask : strikeInfo.put_ask);
      const ltp = toNumberOrNull(type === 'CALL' ? strikeInfo.call_ltp : strikeInfo.put_ltp);
      
      // Calculate butterfly values for each configured leg using trader-side two-price formula
      const legValues: Record<string, { rate: number; value: number; ratio: number; parts: { firstAsk: number; middleBid: number } }> = {};
      
      legs.forEach((leg, index) => {
        const { gap, ratio } = leg;
        const legKey = `leg${index}`;
        
        // For CALL: lower = strike, middle = strike + gap
        // For PUT:  upper = strike, middle = strike - gap
        let baseStrike: number, middleStrike: number;
        if (type === 'CALL') {
          baseStrike = strike; // lower
          middleStrike = strike + gap;
        } else {
          baseStrike = strike; // upper (for puts)
          middleStrike = strike - gap;
        }

        const baseData = strikeDataMap.get(baseStrike);
        const middleData = strikeDataMap.get(middleStrike);

        // Trader-side prices:
        // - For bought base leg use ASK (fallback to LTP only if ask missing)
        // - For sold middle leg use BID (fallback to LTP only if bid missing)
        const baseAsk = toNumberOrNull(type === 'CALL' 
          ? baseData?.call_ask ?? baseData?.CE?.askprice 
          : baseData?.put_ask ?? baseData?.PE?.askprice) 
          ?? toNumberOrNull(type === 'CALL' 
            ? baseData?.call_ltp ?? baseData?.CE?.ltp 
            : baseData?.put_ltp ?? baseData?.PE?.ltp);

        const middleBid = toNumberOrNull(type === 'CALL' 
          ? middleData?.call_bid ?? middleData?.CE?.bidprice 
          : middleData?.put_bid ?? middleData?.PE?.bidprice) 
          ?? toNumberOrNull(type === 'CALL' 
            ? middleData?.call_ltp ?? middleData?.CE?.ltp 
            : middleData?.put_ltp ?? middleData?.PE?.ltp);

        // Required prices must be present
        if (baseAsk === null || middleBid === null) {
          return;
        }

        // Two-leg butterfly with variable middle-leg ratio:
        // CALL:  rate = lowerAsk - (ratio * middleBid)
        // PUT:   rate = upperAsk - (ratio * middleBid)
        const rate = baseAsk - ratio * middleBid;

        // Value% relative to the premium on first buy leg (baseAsk)
        const firstLegPremium = baseAsk;
        const value = (firstLegPremium && firstLegPremium > 0) ? (rate / firstLegPremium) * 100 : 0;

        legValues[legKey] = {
          rate,
          value,
          ratio,
          parts: { firstAsk: baseAsk, middleBid },
        };
      });
      
      return {
        strike,
        bid: bid ?? 0,
        ask: ask ?? 0,
        ltp: ltp ?? 0,
        isATM: strike === atm,
        legs: legValues,
      };
    });

    return { butterflyData: data, atmStrike: atm };
  }, [optionData, spotPrice, type]);

  const legs = (type === 'CALL' ? CE_LEGS : PE_LEGS);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className={cn('w-3 h-3 rounded-full', type === 'CALL' ? 'bg-call' : 'bg-put')} />
          {type === 'CALL' ? 'CE Multi-Leg Butterfly (↑)' : 'PE Multi-Leg Butterfly (↓)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[800px]">    
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th colSpan={2} className={cn('p-2 text-center font-medium', type === 'CALL' ? 'text-call' : 'text-put')}>Premium</th>
                  <th className={cn('p-2 text-center font-medium', type === 'CALL' ? 'text-call' : 'text-put')}>Strike</th>
                  {legs.map((leg, index) => (
                    <th key={`${index}-header`} colSpan={2} className="p-2 text-center font-medium text-muted-foreground border-l border-border">
                      <div className="flex flex-col">
                        <span>Gap {leg.gap}</span>
                        <span className="text-xs text-primary">({leg.ratio}x)</span>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-2 text-center text-xs text-blue-400">Bid</th>
                  <th className="p-2 text-center text-xs text-orange-400">Ask</th>
                  <th className="p-2"></th>
                  {legs.map((_, index) => (
                    <React.Fragment key={`${index}-sub`}>
                      <th className="p-2 text-center text-xs text-muted-foreground border-l border-border">Rate</th>
                      <th className="p-2 text-center text-xs text-muted-foreground">Value%</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {butterflyData.map((row) => {
                  // Check if this strike is ATM or OTM (not ITM)
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
                      {legs.map((_, index) => {
                        const legKey = `leg${index}`;
                        const legData = row.legs[legKey];
                        
                        // Only show value colors for ATM to OTM strikes
                        const showValueColors = isATMorOTMStrike;
                        
                        return (
                          <React.Fragment key={`${row.strike}-${index}`}>
                            <td className="p-2 text-center border-l border-border/50">
                              {legData ? formatPrice(legData.rate) : '-'}
                            </td>
                            <td className="p-2 text-center">
                              {legData ? (
                                <span className={cn(
                                  'px-1.5 py-0.5 rounded text-xs',
                                  showValueColors ? getValueColorClass(legData.value) : 'text-muted-foreground'
                                )}>
                                  {formatPercent(legData.value)}
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
