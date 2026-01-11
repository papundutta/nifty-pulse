import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Zap, Activity, Star, Flame } from 'lucide-react';

export interface OptionData {
  strike_price: number;
  call_ltp?: number;
  call_oi?: number;
  call_volume?: number;
  call_iv?: number;
  call_change?: number;
  call_change_oi?: number;
  call_bid?: number;
  call_ask?: number;
  put_ltp?: number;
  put_oi?: number;
  put_volume?: number;
  put_iv?: number;
  put_change?: number;
  put_change_oi?: number;
  put_bid?: number;
  put_ask?: number;
  // Raw data fields
  symbol?: string;
  ltp?: number;
  open_interest?: number;
  volume?: number;
  iv?: number;
  bid_price?: number;
  ask_price?: number;
  change?: number;
  change_oi?: number;
  option_type?: 'CE' | 'PE';
}

type AnalysisSignal = 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'SHORT_COVERING' | 'LONG_UNWINDING' | 'NEUTRAL';

interface AnalyzedRow extends OptionData {
  call_analysis?: AnalysisSignal;
  put_analysis?: AnalysisSignal;
  call_highlights: string[];
  put_highlights: string[];
  isHighOiChange: boolean;
  isHighVolume: boolean;
  isFreshPosition: boolean;
  isSmartMoneyActive: boolean;
}

interface Props {
  data: OptionData[];
  spotPrice?: number;
}

const formatNumber = (val: number | undefined, decimals = 2): string => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  return val.toLocaleString('en-IN', { maximumFractionDigits: decimals });
};

const formatOI = (val: number | undefined): string => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  if (val >= 10000000) return (val / 10000000).toFixed(2) + ' Cr';
  if (val >= 100000) return (val / 100000).toFixed(2) + ' L';
  if (val >= 1000) return (val / 1000).toFixed(1) + ' K';
  return val.toString();
};

const formatOIChange = (val: number | undefined): string => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  if (val >= 10000000) return (val / 10000000).toFixed(2) + ' Cr';
  if (val >= 100000) return (val / 100000).toFixed(2) + ' L';
  if (val >= 1000) return (val / 1000).toFixed(1) + ' K';
  return val.toString();
};

const getAnalysisSignal = (priceChange: number | undefined, oiChange: number | undefined): AnalysisSignal => {
  const pc = priceChange ?? 0;
  const oi = oiChange ?? 0;
  
  if (pc > 0 && oi > 0) return 'LONG_BUILDUP';
  if (pc < 0 && oi > 0) return 'SHORT_BUILDUP';
  if (pc > 0 && oi < 0) return 'SHORT_COVERING';
  if (pc < 0 && oi < 0) return 'LONG_UNWINDING';
  return 'NEUTRAL';
};

const signalConfig: Record<AnalysisSignal, { label: string; abbrev: string; color: string; bg: string; icon: React.ElementType }> = {
  LONG_BUILDUP: { 
    label: 'Long Buildup', 
    abbrev: 'LB',
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/20 border-emerald-500/40',
    icon: TrendingUp
  },
  SHORT_BUILDUP: { 
    label: 'Short Buildup', 
    abbrev: 'SB',
    color: 'text-rose-400', 
    bg: 'bg-rose-500/20 border-rose-500/40',
    icon: TrendingDown
  },
  SHORT_COVERING: { 
    label: 'Short Covering', 
    abbrev: 'SC',
    color: 'text-blue-400', 
    bg: 'bg-blue-500/20 border-blue-500/40',
    icon: Zap
  },
  LONG_UNWINDING: { 
    label: 'Long Unwinding', 
    abbrev: 'LU',
    color: 'text-orange-400', 
    bg: 'bg-orange-500/20 border-orange-500/40',
    icon: Activity
  },
  NEUTRAL: { 
    label: 'Neutral', 
    abbrev: '-',
    color: 'text-muted-foreground', 
    bg: 'bg-muted/30',
    icon: Activity
  },
};

// Transform raw data to grouped CE/PE format
export function transformOptionData(rawData: any[]): OptionData[] {
  if (!rawData || !Array.isArray(rawData)) return [];

  const optionsOnly = rawData.filter(item => item.strike_price !== -1);
  const strikeMap = new Map<number, OptionData>();

  optionsOnly.forEach((item: any) => {
    const strike = item.strike_price;
    if (!strike) return;

    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, { strike_price: strike });
    }

    const entry = strikeMap.get(strike)!;
    const isCall = item.option_type === 'CE' || item.symbol?.includes('CE');

    if (isCall) {
      entry.call_ltp = item.ltp;
      entry.call_oi = item.open_interest || item.oi;
      entry.call_volume = item.volume || item.vol;
      entry.call_iv = item.iv;
      entry.call_change = item.chg ?? item.ltpch ?? 0;
      entry.call_change_oi = item.oich ?? (item.oi && item.prev_oi ? item.oi - item.prev_oi : 0);
      entry.call_bid = item.bid_price || item.bid;
      entry.call_ask = item.ask_price || item.ask;
    } else {
      entry.put_ltp = item.ltp;
      entry.put_oi = item.open_interest || item.oi;
      entry.put_volume = item.volume || item.vol;
      entry.put_iv = item.iv;
      entry.put_change = item.chg ?? item.ltpch ?? 0;
      entry.put_change_oi = item.oich ?? (item.oi && item.prev_oi ? item.oi - item.prev_oi : 0);
      entry.put_bid = item.bid_price || item.bid;
      entry.put_ask = item.ask_price || item.ask;
    }
  });

  return Array.from(strikeMap.values()).sort((a, b) => a.strike_price - b.strike_price);
}

export function OptionChainTable({ data, spotPrice }: Props) {
  const processedData = useMemo(() => {
    if (!data?.length) return [];
    
    const needsTransform = data.some(d => d.option_type || (d.symbol && !d.call_ltp && !d.put_ltp));
    
    if (needsTransform) {
      return transformOptionData(data);
    }
    
    return data.filter(d => d.strike_price !== -1);
  }, [data]);

  // Calculate thresholds for highlighting
  const thresholds = useMemo(() => {
    if (!processedData.length) return { oiChange: 0, volume: 0, oi: 0 };
    
    const allOiChanges = processedData.flatMap(d => [
      Math.abs(d.call_change_oi ?? 0),
      Math.abs(d.put_change_oi ?? 0)
    ]).filter(v => v > 0);
    
    const allVolumes = processedData.flatMap(d => [
      d.call_volume ?? 0,
      d.put_volume ?? 0
    ]).filter(v => v > 0);
    
    const allOis = processedData.flatMap(d => [
      d.call_oi ?? 0,
      d.put_oi ?? 0
    ]).filter(v => v > 0);
    
    const percentile = (arr: number[], p: number) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.floor(sorted.length * p);
      return sorted[idx] || 0;
    };
    
    return {
      oiChange: percentile(allOiChanges, 0.85),
      volume: percentile(allVolumes, 0.85),
      oi: percentile(allOis, 0.90),
    };
  }, [processedData]);

  // Add analysis to each row
  const analyzedData: AnalyzedRow[] = useMemo(() => {
    return processedData.map(row => {
      const call_analysis = getAnalysisSignal(row.call_change, row.call_change_oi);
      const put_analysis = getAnalysisSignal(row.put_change, row.put_change_oi);
      
      const call_highlights: string[] = [];
      const put_highlights: string[] = [];
      
      // High OI change
      if (Math.abs(row.call_change_oi ?? 0) > thresholds.oiChange) call_highlights.push('High OI Change');
      if (Math.abs(row.put_change_oi ?? 0) > thresholds.oiChange) put_highlights.push('High OI Change');
      
      // High volume
      if ((row.call_volume ?? 0) > thresholds.volume) call_highlights.push('Heavy Volume');
      if ((row.put_volume ?? 0) > thresholds.volume) put_highlights.push('Heavy Volume');
      
      // Fresh position (high OI change + high volume)
      const callFresh = Math.abs(row.call_change_oi ?? 0) > thresholds.oiChange && (row.call_volume ?? 0) > thresholds.volume;
      const putFresh = Math.abs(row.put_change_oi ?? 0) > thresholds.oiChange && (row.put_volume ?? 0) > thresholds.volume;
      if (callFresh) call_highlights.push('Fresh Position');
      if (putFresh) put_highlights.push('Fresh Position');
      
      // Smart money activity (high OI + aggressive buildup)
      const callSmart = (row.call_oi ?? 0) > thresholds.oi && call_analysis !== 'NEUTRAL';
      const putSmart = (row.put_oi ?? 0) > thresholds.oi && put_analysis !== 'NEUTRAL';
      if (callSmart) call_highlights.push('Smart Money');
      if (putSmart) put_highlights.push('Smart Money');
      
      return {
        ...row,
        call_analysis,
        put_analysis,
        call_highlights,
        put_highlights,
        isHighOiChange: call_highlights.includes('High OI Change') || put_highlights.includes('High OI Change'),
        isHighVolume: call_highlights.includes('Heavy Volume') || put_highlights.includes('Heavy Volume'),
        isFreshPosition: callFresh || putFresh,
        isSmartMoneyActive: callSmart || putSmart,
      };
    });
  }, [processedData, thresholds]);

  const atmStrike = useMemo(() => {
    if (!spotPrice || !processedData.length) return null;
    return processedData.reduce((prev, curr) =>
      Math.abs(curr.strike_price - spotPrice) < Math.abs(prev.strike_price - spotPrice) ? curr : prev
    ).strike_price;
  }, [processedData, spotPrice]);

  if (!analyzedData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No option chain data available
      </div>
    );
  }

  const AnalysisBadge = ({ signal, highlights }: { signal: AnalysisSignal; highlights: string[] }) => {
    const config = signalConfig[signal];
    const Icon = config.icon;
    
    if (signal === 'NEUTRAL' && !highlights.length) {
      return <span className="text-muted-foreground text-xs">-</span>;
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-help",
              config.bg, config.color,
              highlights.length > 0 && "ring-1 ring-inset ring-primary/30"
            )}>
              <Icon className="h-3 w-3" />
              <span>{config.abbrev}</span>
              {highlights.length > 0 && (
                <div className="flex items-center">
                  {highlights.includes('Fresh Position') && <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />}
                  {highlights.includes('Smart Money') && <Flame className="h-2.5 w-2.5 text-orange-400" />}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold">{config.label}</p>
              {highlights.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {highlights.map((h, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{h}</Badge>
                  ))}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="overflow-auto max-h-[600px] rounded-lg border border-border scrollbar-trading">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow className="hover:bg-muted">
            <TableHead className="text-center bg-call-muted text-call border-b border-border text-xs">
              Analysis
            </TableHead>
            <TableHead colSpan={7} className="text-center bg-call-muted text-call border-b border-border">
              CALLS (CE)
            </TableHead>
            <TableHead className="text-center bg-muted-foreground/10 font-bold border-x border-border">
              STRIKE
            </TableHead> 
            <TableHead colSpan={7} className="text-center bg-put-muted text-put border-b border-border">
              PUTS (PE)
            </TableHead>
            <TableHead className="text-center bg-put-muted text-put border-b border-border text-xs">
              Analysis
            </TableHead>
          </TableRow>
          <TableRow className="hover:bg-muted text-xs">
            <TableHead className="text-center text-call/80 w-16 border-r border-border/50">Signal</TableHead>
            <TableHead className="text-right text-call/80 w-16">OI Chg</TableHead>
            <TableHead className="text-right text-call/80 w-16">OI</TableHead>
            <TableHead className="text-right text-call/80 w-14">Vol</TableHead>
            <TableHead className="text-right text-call/80 w-14">Chg</TableHead>
            <TableHead className="text-right text-call/80 w-16">Bid</TableHead>
            <TableHead className="text-right text-call/80 w-16">Ask</TableHead>
            <TableHead className="text-right text-call/80 w-16 border-r border-border">LTP</TableHead>
            <TableHead className="text-center font-bold bg-muted-foreground/10 w-24 border-x border-border">STRIKE</TableHead>
            <TableHead className="text-left text-put/80 w-16 border-l border-border">LTP</TableHead>
            <TableHead className="text-left text-put/80 w-16">Bid</TableHead>
            <TableHead className="text-left text-put/80 w-16">Ask</TableHead>
            <TableHead className="text-left text-put/80 w-14">Chg</TableHead>
            <TableHead className="text-left text-put/80 w-14">Vol</TableHead>
            <TableHead className="text-left text-put/80 w-16">OI</TableHead>
            <TableHead className="text-left text-put/80 w-16">OI Chg</TableHead>
            <TableHead className="text-center text-put/80 w-16 border-l border-border/50">Signal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {analyzedData.map((row) => {
            const isATM = atmStrike === row.strike_price;
            const isITMCall = spotPrice && row.strike_price < spotPrice;
            const isITMPut = spotPrice && row.strike_price > spotPrice;

            return (
              <TableRow
                key={row.strike_price}
                className={cn(
                  'text-xs font-mono hover:bg-muted/50 transition-colors',
                  isATM && 'bg-atm/10 border-y-2 border-atm/50 glow-atm',
                  row.isFreshPosition && !isATM && 'bg-primary/5',
                  row.isSmartMoneyActive && !isATM && 'ring-1 ring-inset ring-primary/20'
                )}
              >
                {/* Call Analysis */}
                <TableCell className={cn(
                  'text-center border-r border-border/50',
                  isITMCall && 'bg-call-muted'
                )}>
                  <AnalysisBadge signal={row.call_analysis!} highlights={row.call_highlights} />
                </TableCell>
                
                {/* Call Side */}
                <TableCell className={cn('text-right', isITMCall && 'bg-call-muted')}>
                  <span className={cn(
                    (row.call_change_oi ?? 0) > 0 ? 'text-call' : (row.call_change_oi ?? 0) < 0 ? 'text-put' : '',
                    Math.abs(row.call_change_oi ?? 0) > thresholds.oiChange && 'font-bold animate-pulse'
                  )}>
                    {formatOIChange(row.call_change_oi)}
                  </span>
                </TableCell>
                <TableCell className={cn('text-right font-medium', isITMCall && 'bg-call-muted')}>
                  <span className={cn((row.call_oi ?? 0) > thresholds.oi && 'text-amber-400 font-bold')}>
                    {formatOI(row.call_oi)}
                  </span>
                </TableCell>
                <TableCell className={cn('text-right text-muted-foreground', isITMCall && 'bg-call-muted')}>
                  <span className={cn((row.call_volume ?? 0) > thresholds.volume && 'text-cyan-400 font-semibold')}>
                    {formatOI(row.call_volume)}
                  </span>
                </TableCell>
                <TableCell className={cn('text-right', isITMCall && 'bg-call-muted')}>
                  <span className={cn(
                    (row.call_change ?? 0) > 0 ? 'text-call' : (row.call_change ?? 0) < 0 ? 'text-put' : ''
                  )}>
                    {formatNumber(row.call_change)}
                  </span>
                </TableCell>
                <TableCell className={cn('text-right text-blue-400/80', isITMCall && 'bg-call-muted')}>
                  {formatNumber(row.call_bid)}
                </TableCell>
                <TableCell className={cn('text-right text-orange-400/80', isITMCall && 'bg-call-muted')}>
                  {formatNumber(row.call_ask)}
                </TableCell>
                <TableCell className={cn('text-right font-semibold border-r border-border', isITMCall && 'bg-call-muted')}>
                  {formatNumber(row.call_ltp)}
                </TableCell>

                {/* Strike Price */}
                <TableCell className={cn(
                  'text-center font-bold border-x border-border',
                  isATM ? 'bg-atm/20 text-atm' : 'bg-muted-foreground/5'
                )}>
                  <div className="flex items-center justify-center gap-1">
                    {row.isFreshPosition && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                    {row.strike_price.toLocaleString('en-IN')}
                    {row.isSmartMoneyActive && <Flame className="h-3 w-3 text-orange-400" />}
                  </div>
                </TableCell>

                {/* Put Side */}
                <TableCell className={cn('text-left font-semibold border-l border-border', isITMPut && 'bg-put-muted')}>
                  {formatNumber(row.put_ltp)}
                </TableCell>
                <TableCell className={cn('text-left text-blue-400/80', isITMPut && 'bg-put-muted')}>
                  {formatNumber(row.put_bid)}
                </TableCell>
                <TableCell className={cn('text-left text-orange-400/80', isITMPut && 'bg-put-muted')}>
                  {formatNumber(row.put_ask)}
                </TableCell>
                <TableCell className={cn('text-left', isITMPut && 'bg-put-muted')}>
                  <span className={cn(
                    (row.put_change ?? 0) > 0 ? 'text-call' : (row.put_change ?? 0) < 0 ? 'text-put' : ''
                  )}>
                    {formatNumber(row.put_change)}
                  </span>
                </TableCell>
                <TableCell className={cn('text-left text-muted-foreground', isITMPut && 'bg-put-muted')}>
                  <span className={cn((row.put_volume ?? 0) > thresholds.volume && 'text-cyan-400 font-semibold')}>
                    {formatOI(row.put_volume)}
                  </span>
                </TableCell>
                <TableCell className={cn('text-left font-medium', isITMPut && 'bg-put-muted')}>
                  <span className={cn((row.put_oi ?? 0) > thresholds.oi && 'text-amber-400 font-bold')}>
                    {formatOI(row.put_oi)}
                  </span>
                </TableCell>
                <TableCell className={cn('text-left', isITMPut && 'bg-put-muted')}>
                  <span className={cn(
                    (row.put_change_oi ?? 0) > 0 ? 'text-call' : (row.put_change_oi ?? 0) < 0 ? 'text-put' : '',
                    Math.abs(row.put_change_oi ?? 0) > thresholds.oiChange && 'font-bold animate-pulse'
                  )}>
                    {formatOIChange(row.put_change_oi)}
                  </span>
                </TableCell>
                
                {/* Put Analysis */}
                <TableCell className={cn(
                  'text-center border-l border-border/50',
                  isITMPut && 'bg-put-muted'
                )}>
                  <AnalysisBadge signal={row.put_analysis!} highlights={row.put_highlights} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
