import { useOptionChain } from '@/hooks/useOptionChain';
import { ButterflyRatesContent } from '@/components/ButterflyRatesContent';
import { ButterflyNavTabs } from '@/components/ButterflyNavTabs';
import { LiveIndicator } from '@/components/LiveIndicator';
import { SpotPriceDisplay } from '@/components/SpotPriceDisplay';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp } from 'lucide-react';

const ButterflyRates = () => {
  const {
    data,
    spotPrice,
    expiryDates,
    selectedExpiry,
    loading,
    error,
    lastUpdated,
    isLive,
    setSelectedExpiry,
    refresh,
  } = useOptionChain(5000);

  return (
    <div className="min-h-screen bg-gradient-terminal">
      {/* Header */}
      <header className="border-b border-border bg-gradient-header sticky top-0 z-20">
        <div className="container py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-call flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-call-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">NIFTY Options</h1>
                  <p className="text-xs text-muted-foreground">Butterfly Strategy Analysis</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <SpotPriceDisplay spotPrice={spotPrice} />
              <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Refresh
              </Button>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <ButterflyNavTabs />
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <ButterflyRatesContent
          optionData={data}
          spotPrice={spotPrice}
          loading={loading}
          error={error}
          expiryDates={expiryDates}
          selectedExpiry={selectedExpiry}
          onExpiryChange={setSelectedExpiry}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-auto">
        <div className="container">
          <p className="text-xs text-muted-foreground text-center">
            Butterfly rates update in real-time • Value% = Butterfly Rate / First Leg Premium × 100
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ButterflyRates;
