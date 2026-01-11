import { Card, CardContent } from '@/components/ui/card';

export function ButterflyChainLegend() {
  const legendItems = [
    { color: 'bg-emerald-500/20 text-emerald-400', label: 'Value ≥ 90%', description: 'Excellent Entry' },
    { color: 'bg-green-500/20 text-green-400', label: 'Value ≥ 70%', description: 'Good Entry' },
    { color: 'bg-yellow-500/20 text-yellow-400', label: 'Value ≥ 50%', description: 'Hold' },
    { color: 'bg-orange-500/20 text-orange-400', label: 'Value ≥ 30%', description: 'Caution' },
    { color: 'bg-red-500/20 text-red-400', label: 'Value < 30%', description: 'Avoid' },
  ];

  return (
    <Card className="bg-secondary/50 border-border">
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <span className="text-muted-foreground font-medium">Value Legend:</span>
          {legendItems.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded ${item.color}`}>
                {item.label}
              </span>
              <span className="text-muted-foreground">{item.description}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
