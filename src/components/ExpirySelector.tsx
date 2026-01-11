import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

interface ExpirySelectorProps {
  expiryDates: string[];
  selectedExpiry: string;
  onExpiryChange: (expiry: string) => void;
  disabled?: boolean;
}

export function ExpirySelector({
  expiryDates,
  selectedExpiry,
  onExpiryChange,
  disabled = false,
}: ExpirySelectorProps) {
  const formatExpiryDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedExpiry}
        onValueChange={onExpiryChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[180px] bg-secondary border-border">
          <SelectValue placeholder="Select expiry" />
        </SelectTrigger>
        <SelectContent>
          {expiryDates.map((expiry) => (
            <SelectItem key={expiry} value={expiry}>
              {formatExpiryDate(expiry)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
