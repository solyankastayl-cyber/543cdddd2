/**
 * BUILD FULL SERIES — Universal snapshot series builder
 * 
 * Creates unified series: [history] → anchor → [forecast]
 * 
 * ARCHITECTURE RULES (FIXED):
 * - History START = 2026-01-01 for ALL assets and ALL horizons
 * - History END = asOf (NOW)
 * - Forecast = selected horizon (variable: 7d, 14d, 30d, 90d, 180d, 365d)
 * 
 * History is built from CANDLE CLOSES (not from currentWindow.raw)
 * to ensure consistency between chart candles and model-fit line.
 * 
 * Works for:
 * - BTC Fractal
 * - SPX Fractal
 * - DXY Terminal
 */

// FIXED: One history start date for ALL assets and ALL horizons
// This ensures consistent chart range regardless of selected horizon
export const FIXED_HISTORY_START_ISO = "2026-01-01T00:00:00.000Z";
export const FIXED_HISTORY_START_DATE = "2026-01-01";

export interface SeriesPoint {
  t: string;  // ISO date YYYY-MM-DD
  v: number;  // price value
}

export interface BuildFullSeriesParams {
  asOfDate: string;           // Anchor date (YYYY-MM-DD)
  asOfPrice: number;          // Anchor price
  historicalPrices: number[]; // Past prices (oldest to newest)
  historicalDates: string[];  // Past dates (oldest to newest)
  forecastPrices: number[];   // Future prices (day 1 to horizon)
  forecastDates: string[];    // Future dates (day 1 to horizon)
}

export interface BuildFullSeriesResult {
  series: SeriesPoint[];
  anchorIndex: number;
  historyLength: number;
  forecastLength: number;
}

/**
 * Build full model series from prices
 * 
 * Alternative signature using returns (for models that output returns):
 */
export interface BuildFromReturnsParams {
  asOfDate: string;
  asOfPrice: number;
  historicalReturns: number[];  // Daily returns (oldest to newest)
  historicalDates: string[];
  forecastReturns: number[];    // Forecast returns (day 1 to horizon)
  forecastDates: string[];
}

/**
 * Build series from raw prices (most common case)
 */
export function buildFullSeries(params: BuildFullSeriesParams): BuildFullSeriesResult {
  const {
    asOfDate,
    asOfPrice,
    historicalPrices,
    historicalDates,
    forecastPrices,
    forecastDates,
  } = params;

  const series: SeriesPoint[] = [];
  
  // 1) HISTORICAL PART (before anchor)
  for (let i = 0; i < historicalPrices.length; i++) {
    const date = historicalDates[i];
    // Skip if date >= asOfDate (belongs to future)
    if (date && date < asOfDate) {
      series.push({
        t: date,
        v: historicalPrices[i]
      });
    }
  }
  
  // 2) ANCHOR POINT
  const anchorIndex = series.length;
  series.push({
    t: asOfDate,
    v: asOfPrice
  });
  
  // 3) FORECAST PART (after anchor)
  for (let i = 0; i < forecastPrices.length; i++) {
    const date = forecastDates[i];
    // Only include future dates
    if (date && date > asOfDate) {
      series.push({
        t: date,
        v: forecastPrices[i]
      });
    }
  }
  
  // Filter invalid and sort
  const validSeries = series
    .filter(p => p.t && isFinite(p.v) && p.v > 0)
    .sort((a, b) => a.t.localeCompare(b.t));
  
  // Recalculate anchor index after sort
  const finalAnchorIndex = validSeries.findIndex(p => p.t === asOfDate);
  
  return {
    series: validSeries,
    anchorIndex: finalAnchorIndex >= 0 ? finalAnchorIndex : Math.floor(validSeries.length / 2),
    historyLength: finalAnchorIndex >= 0 ? finalAnchorIndex : 0,
    forecastLength: finalAnchorIndex >= 0 ? validSeries.length - finalAnchorIndex - 1 : 0
  };
}

/**
 * Build series from returns (when model outputs daily returns)
 */
export function buildFullSeriesFromReturns(params: BuildFromReturnsParams): BuildFullSeriesResult {
  const {
    asOfDate,
    asOfPrice,
    historicalReturns,
    historicalDates,
    forecastReturns,
    forecastDates,
  } = params;

  const totalLength = historicalReturns.length + 1 + forecastReturns.length;
  const anchorIdx = historicalReturns.length;
  
  const prices: number[] = new Array(totalLength);
  const dates: string[] = new Array(totalLength);
  
  // Set anchor
  prices[anchorIdx] = asOfPrice;
  dates[anchorIdx] = asOfDate;
  
  // Forward (forecast): price[i] = price[i-1] * (1 + return[i])
  for (let i = anchorIdx + 1; i < totalLength; i++) {
    const r = forecastReturns[i - anchorIdx - 1] || 0;
    prices[i] = prices[i - 1] * (1 + r);
    dates[i] = forecastDates[i - anchorIdx - 1] || '';
  }
  
  // Backward (history): price[i] = price[i+1] / (1 + return[i+1])
  for (let i = anchorIdx - 1; i >= 0; i--) {
    const r = historicalReturns[i + 1] || historicalReturns[i] || 0;
    prices[i] = prices[i + 1] / (1 + r);
    dates[i] = historicalDates[i] || '';
  }
  
  const series: SeriesPoint[] = prices.map((v, i) => ({
    t: dates[i],
    v
  })).filter(p => p.t && isFinite(p.v) && p.v > 0);
  
  return {
    series,
    anchorIndex: anchorIdx,
    historyLength: anchorIdx,
    forecastLength: forecastReturns.length
  };
}

/**
 * Calculate daily returns from price array
 */
export function calculateReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];
  
  const returns: number[] = [0]; // First return is 0
  for (let i = 1; i < prices.length; i++) {
    const r = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(isFinite(r) ? r : 0);
  }
  return returns;
}

/**
 * Generate date array from start date
 */
export function generateDateArray(startDate: Date | string, length: number, direction: 'forward' | 'backward' = 'forward'): string[] {
  const dates: string[] = [];
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  
  for (let i = 0; i < length; i++) {
    const d = new Date(start);
    if (direction === 'forward') {
      d.setDate(d.getDate() + i);
    } else {
      d.setDate(d.getDate() - (length - 1 - i));
    }
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}

/**
 * Convert timestamps (ms) to date strings
 */
export function timestampsToDateStrings(timestamps: number[]): string[] {
  return timestamps.map(ts => {
    const d = new Date(ts);
    return d.toISOString().split('T')[0];
  });
}

export default buildFullSeries;
