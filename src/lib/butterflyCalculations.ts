// Butterfly strategy calculations

export interface ButterflyData {
  strike: number;
  premium: number;
  bid: number;
  ask: number;
  isATM?: boolean;
  gaps: {
    gap50?: { rate: number; value: number };
    gap100?: { rate: number; value: number };
    gap150?: { rate: number; value: number };
    gap200?: { rate: number; value: number };
  };
}

// Transform raw Fyers data to grouped CE/PE format (like OptionChainTable)
export function transformOptionDataForButterfly(rawData: any[]): any[] {
  if (!rawData || !Array.isArray(rawData)) return [];

  // Check if data is already transformed
  if (rawData.some(d => d.call_ltp !== undefined || d.put_ltp !== undefined)) {
    return rawData.filter(d => d.strike_price !== -1);
  }

  // Filter out the index/spot entry (strike_price = -1)
  const optionsOnly = rawData.filter(item => item.strike_price !== -1);

  // Group by strike price
  const strikeMap = new Map<number, any>();

  optionsOnly.forEach((item: any) => {
    const strike = item.strike_price;
    if (!strike && strike !== 0) return;

    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, { strike_price: strike });
    }

    const entry = strikeMap.get(strike)!;
    const isCall = item.option_type === 'CE' || item.symbol?.includes('CE');

    if (isCall) {
      entry.call_ltp = item.ltp ?? entry.call_ltp;
      entry.call_oi = item.open_interest ?? item.oi ?? entry.call_oi;
      entry.call_bid = item.bid_price ?? item.bid ?? entry.call_bid;
      entry.call_ask = item.ask_price ?? item.ask ?? entry.call_ask;
      entry.CE = { bidprice: item.bid_price ?? item.bid ?? entry.CE?.bidprice, askprice: item.ask_price ?? item.ask ?? entry.CE?.askprice, ltp: item.ltp ?? entry.CE?.ltp };
    } else {
      entry.put_ltp = item.ltp ?? entry.put_ltp;
      entry.put_oi = item.open_interest ?? item.oi ?? entry.put_oi;
      entry.put_bid = item.bid_price ?? item.bid ?? entry.put_bid;
      entry.put_ask = item.ask_price ?? item.ask ?? entry.put_ask;
      entry.PE = { bidprice: item.bid_price ?? item.bid ?? entry.PE?.bidprice, askprice: item.ask_price ?? item.ask ?? entry.PE?.askprice, ltp: item.ltp ?? entry.PE?.ltp };
    }
  });

  return Array.from(strikeMap.values()).sort((a, b) => a.strike_price - b.strike_price);
}

export interface ButterflyStrategy {
  type: 'CALL' | 'PUT';
  strikeCombo: string;
  strikes: [number, number, number];
  gap: number;
  firstLegPremium: number;
  butterflyRate: number;
  valuePercent: number;
  distanceFromATM: number;
  recommendation: 'ENTRY' | 'HOLD' | 'EXIT' | 'AVOID' | 'SCALE' | 'PROFIT_BOOKING' | 'CHAIN_WARNING' | 'VALUE_BREACH';
  isNearATM?: boolean;
  hasGoodGap?: boolean;
  alertType?: 'good_entry' | 'value_breach' | 'profit_booking' | 'scaling_opportunity' | 'chain_warning';
  violatesChainConcept?: boolean;
  violatesValueConcept?: boolean;
}

export type DetailedRecommendation = 
  | 'ENTRY' | 'HOLD' | 'EXIT' | 'AVOID' | 'SCALE' 
  | 'PROFIT_BOOKING' | 'CHAIN_WARNING' | 'VALUE_BREACH';

// Calculate butterfly rate for a given strike combination
export function calculateButterflyRate(
  lowerStrike: number,
  middleStrike: number,
  upperStrike: number,
  optionData: any[],
  type: 'CALL' | 'PUT'
): { rate: number; firstLegPremium: number } | null {
  const lowerOption = optionData.find((o) => o.strike_price === lowerStrike);
  const middleOption = optionData.find((o) => o.strike_price === middleStrike);
  const upperOption = optionData.find((o) => o.strike_price === upperStrike);

  if (!lowerOption || !middleOption || !upperOption) return null;

  const toNumberOrNull = (v: any) => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // Extract bid/ask/ltp for call/put in a safe way
  const extract = (option: any, opType: 'CALL' | 'PUT') => {
    if (!option) return { bid: null, ask: null, ltp: null };
    if (opType === 'CALL') {
      return {
        bid: toNumberOrNull(option.call_bid ?? option.CE?.bidprice ?? option.call_bid),
        ask: toNumberOrNull(option.call_ask ?? option.CE?.askprice ?? option.call_ask),
        ltp: toNumberOrNull(option.call_ltp ?? option.CE?.ltp),
      };
    } else {
      return {
        bid: toNumberOrNull(option.put_bid ?? option.PE?.bidprice ?? option.put_bid),
        ask: toNumberOrNull(option.put_ask ?? option.PE?.askprice ?? option.put_ask),
        ltp: toNumberOrNull(option.put_ltp ?? option.PE?.ltp),
      };
    }
  };

  const low = extract(lowerOption, type);
  const mid = extract(middleOption, type);
  const up = extract(upperOption, type);

  // Use trader-side prices:
  // - For bought legs (lower and upper) use Ask (fallback to LTP if ask missing)
  // - For sold leg (middle) use Bid (fallback to LTP if bid missing)
  const lowerAsk = low.ask ?? low.ltp;
  const middleBid = mid.bid ?? mid.ltp;
  const upperAsk = up.ask ?? up.ltp;

  if (lowerAsk === null || middleBid === null || upperAsk === null) return null;

  const butterflyRate = lowerAsk - 2 * middleBid + upperAsk;

  // firstLegPremium = premium paid on the "first" buy leg used for value% denominator
  const firstLegPremium = type === 'CALL' ? lowerAsk : upperAsk;

  return { rate: butterflyRate, firstLegPremium };
}

// Calculate value percentage
export function calculateValuePercent(butterflyRate: number, firstLegPremium: number): number {
  if (firstLegPremium <= 0) return 0;
  return (butterflyRate / firstLegPremium) * 100;
}

// Get basic recommendation based on value percentage
export function getRecommendation(valuePercent: number): 'ENTRY' | 'HOLD' | 'EXIT' | 'AVOID' {
  if (valuePercent <= 10) return 'ENTRY';
  if (valuePercent <= 15) return 'HOLD';
  if (valuePercent <= 20) return 'HOLD';
  return 'AVOID';
}

// Get detailed recommendation based on Value + Chain Concept Combined
export function getDetailedRecommendation(
  valuePercent: number,
  distanceFromATM: number,
  gap: number
): DetailedRecommendation {
  const isNearATM = distanceFromATM <= 2;
  const hasGoodGap = gap <= 100;

  // Value Concept Rules
  if (valuePercent > 25) return 'EXIT';
  if (valuePercent > 20) return 'VALUE_BREACH';
  
  // Chain Concept Rules (combined with value)
  if (valuePercent <= 10 && isNearATM && hasGoodGap) return 'ENTRY';
  if (valuePercent <= 10 && isNearATM) return 'PROFIT_BOOKING';
  if (valuePercent <= 15 && isNearATM) return 'SCALE';
  if (valuePercent <= 15 && !isNearATM) return 'HOLD';
  if (valuePercent <= 20 && !isNearATM && !hasGoodGap) return 'CHAIN_WARNING';
  if (valuePercent <= 20) return 'HOLD';
  
  return 'AVOID';
}

// Get alert type based on strategy conditions
export function getAlertType(
  valuePercent: number,
  distanceFromATM: number,
  gap: number
): ButterflyStrategy['alertType'] {
  const isNearATM = distanceFromATM <= 2;
  const hasGoodGap = gap <= 100;

  if (valuePercent <= 10 && isNearATM && hasGoodGap) return 'good_entry';
  if (valuePercent > 20) return 'value_breach';
  if (valuePercent <= 15 && isNearATM) return 'profit_booking';
  if (valuePercent <= 15) return 'scaling_opportunity';
  if (!isNearATM || !hasGoodGap) return 'chain_warning';
  
  return undefined;
}

// Get value color class based on percentage
export function getValueColorClass(valuePercent: number): string {
  if (valuePercent <= 15) return 'text-emerald-500 bg-emerald-500/10';
  if (valuePercent <= 20) return 'text-yellow-500 bg-yellow-500/10';
  return 'text-red-500 bg-red-500/10';
}

// Calculate all butterfly data for a given option chain
export function calculateButterflyChain(
  rawOptionData: any[],
  spotPrice: number,
  type: 'CALL' | 'PUT',
  gaps: number[] = [50, 100, 150, 200]
): ButterflyData[] {
  // Transform raw data first
  const optionData = transformOptionDataForButterfly(rawOptionData);
  
  if (!optionData.length) return [];

  const strikes = optionData
    .filter((item) => item.strike_price > 0)
    .map((item) => item.strike_price)
    .sort((a, b) => (type === 'CALL' ? a - b : b - a));

  if (!strikes.length) return [];

  const atmStrike = strikes.reduce((prev, curr) =>
    Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
  );

  return strikes.map((strike) => {
    const option = optionData.find((o) => o.strike_price === strike);
    
    // Get bid and ask separately
    let bid = 0, ask = 0, premium = 0;
    if (type === 'CALL') {
      bid = option?.call_bid ?? 0;
      ask = option?.call_ask ?? 0;
      premium = (bid + ask) / 2 || option?.call_ltp || 0;
    } else {
      bid = option?.put_bid ?? 0;
      ask = option?.put_ask ?? 0;
      premium = (bid + ask) / 2 || option?.put_ltp || 0;
    }

    const gapData: ButterflyData['gaps'] = {};

    gaps.forEach((gap) => {
      let lowerStrike: number, middleStrike: number, upperStrike: number;

      if (type === 'CALL') {
        lowerStrike = strike;
        middleStrike = strike + gap;
        upperStrike = strike + gap * 2;
      } else {
        upperStrike = strike;
        middleStrike = strike - gap;
        lowerStrike = strike - gap * 2;
      }

      const result = calculateButterflyRate(lowerStrike, middleStrike, upperStrike, optionData, type);
      if (result && result.rate > 0) {
        const valuePercent = calculateValuePercent(result.rate, result.firstLegPremium);
        const gapKey = `gap${gap}` as keyof ButterflyData['gaps'];
        gapData[gapKey] = { rate: result.rate, value: valuePercent };
      }
    });

    return {
      strike,
      premium,
      bid,
      ask,
      isATM: strike === atmStrike,
      gaps: gapData,
    };
  });
}

// Check if a strike is OTM or ATM for a given option type
export function isATMorOTM(strike: number, atmStrike: number, type: 'CALL' | 'PUT'): boolean {
  // For CALLS: ATM and strikes >= ATM are OTM (higher strikes are OTM)
  // For PUTS: ATM and strikes <= ATM are OTM (lower strikes are OTM)
  if (type === 'CALL') {
    return strike >= atmStrike;
  } else {
    return strike <= atmStrike;
  }
}

// Find best butterfly strategies (only ATM to OTM)
export function findBestStrategies(
  rawOptionData: any[],
  spotPrice: number,
  maxValuePercent: number = 20
): ButterflyStrategy[] {
  // Transform raw data first (same as calculateButterflyChain)
  const optionData = transformOptionDataForButterfly(rawOptionData);
  
  if (!optionData.length || !spotPrice) return [];

  const strategies: ButterflyStrategy[] = [];
  const gaps = [50, 100, 150, 200];
  const types: ('CALL' | 'PUT')[] = ['CALL', 'PUT'];

  const strikes = optionData
    .filter((item) => item.strike_price > 0)
    .map((item) => item.strike_price)
    .sort((a, b) => a - b);

  if (!strikes.length) return [];

  const atmStrike = strikes.reduce((prev, curr) =>
    Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
  );

  // Use actual available strikes as the base (so each row's strike is used as the first leg)
  types.forEach((type) => {
    gaps.forEach((gap) => {
      for (const baseStrike of strikes) {
        let lowerStrike: number, middleStrike: number, upperStrike: number;

        if (type === 'CALL') {
          lowerStrike = baseStrike;
          middleStrike = baseStrike + gap;
          upperStrike = baseStrike + gap * 2;
          
          // For CALL butterflies: Only include if lower strike is ATM or OTM (>= ATM)
          if (lowerStrike < atmStrike) continue;
        } else {
          upperStrike = baseStrike;
          middleStrike = baseStrike - gap;
          lowerStrike = baseStrike - gap * 2;
          
          // For PUT butterflies: Only include if upper strike is ATM or OTM (<= ATM)
          if (upperStrike > atmStrike) continue;
        }

        // Check if all strikes exist
        const hasAllStrikes = 
          optionData.some(d => d.strike_price === lowerStrike) &&
          optionData.some(d => d.strike_price === middleStrike) &&
          optionData.some(d => d.strike_price === upperStrike);

        if (!hasAllStrikes) continue;

        const result = calculateButterflyRate(lowerStrike, middleStrike, upperStrike, optionData, type);
        if (result && result.rate > 0 && result.rate < result.firstLegPremium * 0.5) {
          const valuePercent = calculateValuePercent(result.rate, result.firstLegPremium);
          const distanceFromATM = Math.abs(lowerStrike - atmStrike);
          const isNearATM = distanceFromATM <= 100;
          const hasGoodGap = gap <= 100;
          
          if (valuePercent <= maxValuePercent && valuePercent > 0) {
            strategies.push({
              type,
              strikeCombo: `${lowerStrike} - ${middleStrike} - ${upperStrike}`,
              strikes: [lowerStrike, middleStrike, upperStrike],
              gap,
              firstLegPremium: result.firstLegPremium,
              butterflyRate: result.rate,
              valuePercent,
              distanceFromATM: Math.round(distanceFromATM / 50),
              recommendation: getRecommendation(valuePercent),
              isNearATM,
              hasGoodGap,
            });
          }
        }
      }
    });
  });

  // Sort by value percentage (lower is better), then by distance from ATM
  return strategies.sort((a, b) => {
    if (a.valuePercent !== b.valuePercent) return a.valuePercent - b.valuePercent;
    return a.distanceFromATM - b.distanceFromATM;
  });
}

// Find best trades (Value + Chain Concept combined) - Only ATM to OTM
export function findBestTrades(
  rawOptionData: any[],
  spotPrice: number
): ButterflyStrategy[] {
  // findBestStrategies already filters to ATM-OTM only
  const allStrategies = findBestStrategies(rawOptionData, spotPrice, 15);
  
  return allStrategies
    .filter(strategy => {
      // Value Concept: Only ≤15% for best trades
      const hasGoodValue = strategy.valuePercent <= 15;
      
      // Chain Concept: Prefer ATM/near ATM positions (already filtered to ATM-OTM)
      const isNearATM = strategy.distanceFromATM <= 2;
      
      // Prefer 50-100 gaps for better liquidity
      const hasGoodGap = strategy.gap <= 100;
      
      return hasGoodValue && isNearATM && hasGoodGap;
    })
    .slice(0, 8);
}
