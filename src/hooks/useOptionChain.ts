import { useState, useEffect, useCallback, useRef } from 'react';

export interface OptionChainData {
  records: {
    data: any[];
    expiryDates: string[];
    strikePrices: number[];
    underlyingValue: number;
    timestamp: string;
  };
  filtered: {
    data: any[];
  };
}

interface UseOptionChainReturn {
  data: any[];
  spotPrice: number | undefined;
  expiryDates: string[];
  selectedExpiry: string;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isLive: boolean;
  setSelectedExpiry: (expiry: string) => void;
  refresh: () => void;
}

// API base URL - defaults to localhost for development
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useOptionChain(refreshInterval = 5000): UseOptionChainReturn {
  const [data, setData] = useState<any[]>([]);
  const [spotPrice, setSpotPrice] = useState<number | undefined>(undefined);
  const [expiryDates, setExpiryDates] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 3;

  const fetchData = useCallback(async () => {
    try {
      const url = selectedExpiry 
        ? `${API_BASE}/chain?expiry=${encodeURIComponent(selectedExpiry)}`
        : `${API_BASE}/chain`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      
      // Handle the response structure
      if (json.records) {
        const records = json.records;
        setData(records.data || []);
        setSpotPrice(records.underlyingValue);
        setExpiryDates(records.expiryDates || []);
        
        // Set initial expiry if not set
        if (!selectedExpiry && records.expiryDates?.length > 0) {
          setSelectedExpiry(records.expiryDates[0]);
        }
      } else if (Array.isArray(json)) {
        setData(json);
      } else if (json.data) {
        setData(json.data);
        if (json.underlyingValue) setSpotPrice(json.underlyingValue);
        if (json.expiryDates) setExpiryDates(json.expiryDates);
      }

      setLastUpdated(new Date());
      setIsLive(true);
      setError(null);
      retryCount.current = 0;
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch option chain:', err);
      setIsLive(false);
      
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        setError(`Connection failed. Retrying... (${retryCount.current}/${maxRetries})`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setLoading(false);
      }
    }
  }, [selectedExpiry]);

  const refresh = useCallback(() => {
    setLoading(true);
    retryCount.current = 0;
    fetchData();
  }, [fetchData]);

  // Initial fetch and interval setup
  useEffect(() => {
    fetchData();

    intervalRef.current = setInterval(fetchData, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, refreshInterval]);

  return {
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
  };
}
