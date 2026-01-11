import { useOptionChain } from '@/hooks/useOptionChain';
import { OptionChainTable } from '@/components/OptionChainTable';
import { ButterflyNavTabs } from '@/components/ButterflyNavTabs';
import { LiveIndicator } from '@/components/LiveIndicator';
import { SpotPriceDisplay } from '@/components/SpotPriceDisplay';
import { ExpirySelector } from '@/components/ExpirySelector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, Activity } from 'lucide-react';

const Index = () => {
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
                  <p className="text-xs text-muted-foreground">Real-time Analysis Platform</p>
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
        {/* Controls Card */}
        <Card className="bg-card border-border mb-6">
          <CardHeader className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-call" />
                Live Option Chain
              </CardTitle>
              
              <div className="flex items-center gap-4">
                {expiryDates.length > 0 && (
                  <ExpirySelector
                    expiryDates={expiryDates}
                    selectedExpiry={selectedExpiry}
                    onExpiryChange={setSelectedExpiry}
                    disabled={loading}
                  />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <RefreshCw className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Connecting to NSE data feed...</p>
              </div>
            ) : error && data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive max-w-md text-center">
                  <p className="font-medium mb-2">Connection Error</p>
                  <p className="text-sm">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    className="mt-4"
                  >
                    Retry Connection
                  </Button>
                </div>
              </div>
            ) : (
              <OptionChainTable data={data} spotPrice={spotPrice} />
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="bg-secondary/50 border-border">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground">Analysis Signals:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">LB</span>
                <span className="text-muted-foreground">Long Buildup</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">SB</span>
                <span className="text-muted-foreground">Short Buildup</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40">SC</span>
                <span className="text-muted-foreground">Short Covering</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">LU</span>
                <span className="text-muted-foreground">Long Unwinding</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-auto">
        <div className="container">
          <p className="text-xs text-muted-foreground text-center">
            Data refreshes every 5 seconds • Market hours: 9:15 AM - 3:30 PM IST
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
