import { useState } from 'react';
import { ButterflyChainTable } from '@/components/ButterflyChainTable';
import { MultiButterflyChainTable } from '@/components/MultiButterflyChainTable';
import { ButterflyChainLegend } from '@/components/ButterflyChainLegend';
import { ExpirySelector } from '@/components/ExpirySelector';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButterflyRatesContentProps {
  optionData: any[];
  spotPrice: number | undefined;
  loading: boolean;
  error?: string | null;
  expiryDates?: string[];
  selectedExpiry?: string;
  onExpiryChange?: (expiry: string) => void;
}

type ButterflyTab = 'butterfly121' | 'multiButterfly';

export function ButterflyRatesContent({
  optionData,
  spotPrice,
  loading,
  error,
  expiryDates = [],
  selectedExpiry = '',
  onExpiryChange,
}: ButterflyRatesContentProps) {
  const [activeTab, setActiveTab] = useState<ButterflyTab>('butterfly121');

  return (
    <div className="space-y-3">
      {/* Visual Chain Section */}
      <Card className="bg-card border-border">
        <CardHeader className="py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Expiry Selector */}
              {expiryDates.length > 0 && onExpiryChange && (
                <ExpirySelector
                  expiryDates={expiryDates}
                  selectedExpiry={selectedExpiry}
                  onExpiryChange={onExpiryChange}
                  disabled={loading}
                />
              )}
            </div>
            
            {/* Tab Switcher */}
            <div className="flex bg-call rounded-lg p-1 gap-1">
              <button
                onClick={() => setActiveTab('butterfly121')}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === 'butterfly121'
                    ? 'bg-background text-call shadow-sm'
                    : 'text-call-foreground hover:bg-call/80'
                )}
              >
                Butterfly 1-2-1
              </button>
              <button
                onClick={() => setActiveTab('multiButterfly')}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === 'multiButterfly'
                    ? 'bg-background text-call shadow-sm'
                    : 'text-call-foreground hover:bg-call/80'
                )}
              >
                Multi Butterfly
              </button>
            </div>
          </div>
        </CardHeader> 
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : spotPrice && optionData.length > 0 ? (
            <div className="grid lg:grid-cols-2 gap-4">
              {activeTab === 'butterfly121' ? (
                <>
                  <ButterflyChainTable
                    optionData={optionData}
                    spotPrice={spotPrice}
                    type="CALL"
                  />
                  <ButterflyChainTable
                    optionData={optionData}
                    spotPrice={spotPrice}
                    type="PUT"
                  />
                </>
              ) : (
                <>
                  <MultiButterflyChainTable
                    optionData={optionData}
                    spotPrice={spotPrice}
                    type="CALL"
                  />
                  <MultiButterflyChainTable
                    optionData={optionData}
                    spotPrice={spotPrice}
                    type="PUT"
                  />
                </>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No option chain data available. Waiting for data...
            </div>
          )}

          {/* Legend */}
          <ButterflyChainLegend />
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
