import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BarChart3, Layers } from 'lucide-react';

export function ButterflyNavTabs() {
  return (
    <nav className="flex items-center justify-center gap-2 py-3">
      <NavLink to="/">
        {({ isActive }) => (
          <Button
            variant={isActive ? 'default' : 'ghost'}
            className={cn(
              'rounded-full px-6 transition-all gap-2',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Option Chain
          </Button>
        )}
      </NavLink>
      <NavLink to="/butterfly-rates">
        {({ isActive }) => (
          <Button
            variant={isActive ? 'default' : 'ghost'}
            className={cn(
              'rounded-full px-6 transition-all gap-2',
              isActive ? 'bg-call text-call-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Layers className="h-4 w-4" />
            Butterfly Rates
          </Button>
        )}
      </NavLink>
    </nav>
  );
}
