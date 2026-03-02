/**
 * PREDICTION SNAPSHOT HOOK
 * 
 * Auto-save hook for terminal endpoints.
 * Called after compute, before return response.
 * 
 * Save conditions:
 * 1. No previous snapshot for {asset, view, horizonDays}
 * 2. Stance changed
 * 3. |confidence - lastConfidence| > 0.02
 * 4. maxAbsDelta(series, lastSeries) > 0.35% of price
 * 5. >= 24h since last snapshot (heartbeat fallback)
 * 
 * Never save if:
 * - confidence NaN/Inf
 * - series empty or < 5 points
 * - asOf out of valid range
 */

import { MongoClient, Db, Collection } from 'mongodb';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type AssetType = 'SPX' | 'DXY' | 'BTC';
export type PredictionView = 'synthetic' | 'hybrid' | 'macro' | 'crossAsset';
export type Stance = 'BULLISH' | 'BEARISH' | 'HOLD';

export interface PredictionPoint {
  t: string;
  v: number;
}

export interface SnapshotPayload {
  asset: AssetType;
  view: PredictionView;
  horizonDays: number;
  asOf: string;
  asOfPrice: number;
  series: PredictionPoint[];
  band?: { p10: PredictionPoint[]; p90: PredictionPoint[] };
  stance: Stance;
  confidence: number;
  quality?: number;
  modelVersion: string;
  sourceEndpoint: string;
}

interface StoredSnapshot {
  asset: string;
  view: string;
  horizonDays: number;
  asOf: string;
  asOfPrice: number;
  series: PredictionPoint[];
  metadata: {
    stance: string;
    confidence: number;
  };
  hash: string;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  CONFIDENCE_DELTA_THRESHOLD: 0.02,    // 2% change triggers save
  SERIES_DELTA_THRESHOLD: 0.0035,      // 0.35% price change triggers save
  HEARTBEAT_HOURS: 24,                 // Fallback save interval
  MIN_SERIES_POINTS: 5,                // Minimum points to save
  RATE_LIMIT_MINUTES: 15,              // Max 1 save per 15 min per key
};

// ═══════════════════════════════════════════════════════════════
// MONGODB
// ═══════════════════════════════════════════════════════════════

let _db: Db | null = null;
let _collection: Collection<StoredSnapshot> | null = null;
const _rateLimitCache: Map<string, number> = new Map();

async function getCollection(): Promise<Collection<StoredSnapshot> | null> {
  if (_collection) return _collection;
  
  try {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'fractal_platform';
    const client = new MongoClient(mongoUrl);
    await client.connect();
    _db = client.db(dbName);
    _collection = _db.collection<StoredSnapshot>('prediction_snapshots');
    
    // Ensure indexes
    await _collection.createIndex({ asset: 1, view: 1, horizonDays: 1, asOf: -1 });
    await _collection.createIndex({ asset: 1, view: 1, horizonDays: 1, createdAt: -1 });
    
    return _collection;
  } catch (e) {
    console.error('[SnapshotHook] MongoDB failed:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function calculateHash(series: PredictionPoint[], stance: Stance, confidence: number): string {
  const data = JSON.stringify({
    s: series.slice(0, 10).map(p => Math.round(p.v * 10) / 10),
    st: stance,
    c: Math.round(confidence * 100)
  });
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

function maxSeriesDelta(
  newSeries: PredictionPoint[],
  oldSeries: PredictionPoint[],
  basePrice: number
): number {
  if (oldSeries.length === 0 || newSeries.length === 0) return 1; // Force save
  
  let maxDelta = 0;
  const minLen = Math.min(newSeries.length, oldSeries.length);
  
  for (let i = 0; i < minLen; i++) {
    const delta = Math.abs(newSeries[i].v - oldSeries[i].v) / basePrice;
    if (delta > maxDelta) maxDelta = delta;
  }
  
  return maxDelta;
}

function isRateLimited(key: string): boolean {
  const lastSave = _rateLimitCache.get(key);
  if (!lastSave) return false;
  
  const minutesSince = (Date.now() - lastSave) / (1000 * 60);
  return minutesSince < CONFIG.RATE_LIMIT_MINUTES;
}

function setRateLimitTimestamp(key: string): void {
  _rateLimitCache.set(key, Date.now());
}

// ═══════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════

export interface SnapshotHookResult {
  saved: boolean;
  reason: string;
  snapshotId?: string;
}

/**
 * Auto-save prediction snapshot after terminal compute.
 * Call this after computing the terminal pack, before returning response.
 */
export async function snapshotHook(payload: SnapshotPayload): Promise<SnapshotHookResult> {
  // Validate payload
  if (!payload.series || payload.series.length < CONFIG.MIN_SERIES_POINTS) {
    return { saved: false, reason: 'series_too_short' };
  }
  
  if (!isFinite(payload.confidence) || payload.confidence < 0 || payload.confidence > 1) {
    return { saved: false, reason: 'invalid_confidence' };
  }
  
  // Check rate limit
  const key = `${payload.asset}_${payload.view}_${payload.horizonDays}`;
  if (isRateLimited(key)) {
    return { saved: false, reason: 'rate_limited' };
  }
  
  const collection = await getCollection();
  if (!collection) {
    return { saved: false, reason: 'no_db' };
  }
  
  // Get latest snapshot
  const latest = await collection.findOne(
    { 
      asset: payload.asset, 
      view: payload.view, 
      horizonDays: payload.horizonDays 
    },
    { sort: { asOf: -1 } }
  );
  
  const newHash = calculateHash(payload.series, payload.stance, payload.confidence);
  
  // Determine if we should save
  let shouldSave = false;
  let saveReason = '';
  
  if (!latest) {
    shouldSave = true;
    saveReason = 'first_snapshot';
  } else if (latest.metadata.stance !== payload.stance) {
    shouldSave = true;
    saveReason = 'stance_changed';
  } else if (Math.abs(latest.metadata.confidence - payload.confidence) > CONFIG.CONFIDENCE_DELTA_THRESHOLD) {
    shouldSave = true;
    saveReason = 'confidence_delta';
  } else if (maxSeriesDelta(payload.series, latest.series, payload.asOfPrice) > CONFIG.SERIES_DELTA_THRESHOLD) {
    shouldSave = true;
    saveReason = 'series_delta';
  } else {
    // Check heartbeat fallback
    const hoursSinceLast = (Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast >= CONFIG.HEARTBEAT_HOURS) {
      shouldSave = true;
      saveReason = 'heartbeat';
    }
  }
  
  if (!shouldSave) {
    return { saved: false, reason: 'no_significant_change' };
  }
  
  // Build snapshot document
  const snapshot: StoredSnapshot = {
    asset: payload.asset,
    view: payload.view,
    horizonDays: payload.horizonDays,
    asOf: payload.asOf,
    asOfPrice: payload.asOfPrice,
    series: payload.series,
    metadata: {
      stance: payload.stance,
      confidence: payload.confidence,
    },
    hash: newHash,
    createdAt: new Date().toISOString(),
  };
  
  // Add optional fields
  if (payload.band) {
    (snapshot as any).band = payload.band;
  }
  if (payload.quality !== undefined) {
    (snapshot.metadata as any).quality = payload.quality;
  }
  (snapshot.metadata as any).modelVersion = payload.modelVersion;
  (snapshot as any).sourceEndpoint = payload.sourceEndpoint;
  
  try {
    const result = await collection.insertOne(snapshot as any);
    setRateLimitTimestamp(key);
    
    console.log(`[SnapshotHook] Saved ${payload.asset}/${payload.view}/${payload.horizonDays}d: ${saveReason}`);
    
    return {
      saved: true,
      reason: saveReason,
      snapshotId: result.insertedId.toString()
    };
  } catch (e: any) {
    console.error('[SnapshotHook] Save failed:', e.message);
    return { saved: false, reason: `error: ${e.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Extract data from terminal pack
// ═══════════════════════════════════════════════════════════════

/**
 * Extract snapshot payload from DXY terminal pack
 * Builds FULL model series: [historical] → anchor → [forecast]
 */
export function extractDxySnapshotPayload(
  terminalPack: any,
  focus: string
): SnapshotPayload | null {
  try {
    const hybrid = terminalPack?.hybrid;
    const core = terminalPack?.core;
    const replay = terminalPack?.replay;
    
    // Debug logging
    console.log('[ExtractDxy] replay exists:', !!replay);
    console.log('[ExtractDxy] replay.window exists:', !!replay?.window);
    console.log('[ExtractDxy] replay.window length:', replay?.window?.length || 0);
    
    if (!hybrid?.path) return null;
    
    // Get current price from core.current.price
    const asOfPrice = core?.current?.price || core?.lastPrice || 0;
    if (asOfPrice === 0) return null;
    
    // Convert focus to horizonDays
    const horizonMap: Record<string, number> = {
      '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180, '365d': 365
    };
    const horizonDays = horizonMap[focus] || 30;
    
    const asOfDate = new Date();
    const asOfDateStr = asOfDate.toISOString().split('T')[0];
    
    // ═══════════════════════════════════════════════════════════════
    // BUILD FULL MODEL SERIES: [historical] → anchor → [forecast]
    // ═══════════════════════════════════════════════════════════════
    
    const series: PredictionPoint[] = [];
    
    // 1) HISTORICAL PART - from replay.window (historical model fit)
    const replayWindow = replay?.window;
    console.log('[ExtractDxy] replayWindow length:', replayWindow?.length || 0);
    
    if (replayWindow && Array.isArray(replayWindow)) {
      // Take last N days of historical data (matching horizon)
      const historyDays = Math.min(replayWindow.length, horizonDays);
      const startIdx = replayWindow.length - historyDays;
      
      console.log('[ExtractDxy] historyDays:', historyDays, 'startIdx:', startIdx, 'asOfDateStr:', asOfDateStr);
      
      let historicalCount = 0;
      for (let i = startIdx; i < replayWindow.length; i++) {
        const p = replayWindow[i];
        const rawDate = p.date || p.t;
        let dateStr: string | undefined;
        
        // Convert various date formats to YYYY-MM-DD
        if (rawDate) {
          if (typeof rawDate === 'string') {
            if (rawDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Already YYYY-MM-DD
              dateStr = rawDate;
            } else if (rawDate.includes('T')) {
              // ISO format: 2024-09-04T00:00:00.000Z
              dateStr = rawDate.split('T')[0];
            } else {
              // Try parsing any other string format
              try {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                  dateStr = d.toISOString().split('T')[0];
                }
              } catch (e) {}
            }
          } else if (typeof rawDate === 'number') {
            // Unix timestamp
            const d = new Date(rawDate);
            dateStr = d.toISOString().split('T')[0];
          }
        }
        
        // Log first few
        if (i < startIdx + 3) {
          console.log(`[ExtractDxy] historical[${i}]: rawDate=${rawDate}, dateStr=${dateStr}`);
        }
        
        // Don't include dates >= asOf
        if (dateStr && dateStr < asOfDateStr) {
          series.push({
            t: dateStr,
            v: p.value || p.v
          });
          historicalCount++;
        }
      }
      console.log('[ExtractDxy] Added historical points:', historicalCount);
    }
    
    // 2) ANCHOR POINT - asOf with current price
    series.push({
      t: asOfDateStr,
      v: asOfPrice
    });
    
    // 3) FORECAST PART - from hybrid.path
    for (const p of hybrid.path) {
      let dateStr = p.date || p.t;
      
      // Convert ISO date to YYYY-MM-DD
      if (dateStr && typeof dateStr === 'string' && dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0];
      }
      
      // Only include future dates (after asOf)
      if (dateStr && dateStr > asOfDateStr) {
        series.push({
          t: dateStr,
          v: p.value || p.v
        });
      }
    }
    
    // Filter and sort
    const validSeries = series
      .filter((p: PredictionPoint) => p.t && isFinite(p.v))
      .sort((a, b) => a.t.localeCompare(b.t));
    
    if (validSeries.length < 10) return null;
    
    // ═══════════════════════════════════════════════════════════════
    // DERIVE STANCE FROM FORECAST DIRECTION
    // ═══════════════════════════════════════════════════════════════
    
    const anchorIdx = validSeries.findIndex(p => p.t === asOfDateStr);
    const forecastPart = validSeries.slice(anchorIdx);
    
    let stance: Stance = 'HOLD';
    if (forecastPart.length > 1) {
      const firstVal = forecastPart[0].v;
      const lastVal = forecastPart[forecastPart.length - 1].v;
      const returnPct = (lastVal - firstVal) / firstVal;
      
      if (returnPct > 0.02) stance = 'BULLISH';
      else if (returnPct < -0.02) stance = 'BEARISH';
    }
    
    // Get confidence from meta
    const confidence = terminalPack?.meta?.confidence || hybrid.confidence || 0.5;
    
    return {
      asset: 'DXY',
      view: 'hybrid',
      horizonDays,
      asOf: asOfDate.toISOString(),
      asOfPrice,
      series: validSeries,
      stance,
      confidence,
      modelVersion: 'v3.1.0',
      sourceEndpoint: '/api/fractal/dxy/terminal'
    };
  } catch (e) {
    console.error('[ExtractDxy] Error:', e);
    return null;
  }
}

/**
 * Extract snapshot payload from SPX terminal pack
 */
export function extractSpxSnapshotPayload(
  terminalPack: any,
  horizon: string
): SnapshotPayload | null {
  try {
    // SPX focus-pack wraps data in 'data' key
    const data = terminalPack?.data || terminalPack;
    const forecast = data?.forecast;
    const price = data?.price;
    const overlay = data?.overlay;
    
    if (!forecast?.path || forecast.path.length < 5) return null;
    
    // Convert horizon to days
    const horizonMap: Record<string, number> = {
      '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180, '365d': 365
    };
    const horizonDays = horizonMap[horizon] || parseInt(horizon) || 30;
    
    // Get anchor point
    const asOfPrice = price?.current || forecast.currentPrice || 6000;
    const asOfDate = new Date();
    const asOfDateStr = asOfDate.toISOString().split('T')[0];
    
    // ═══════════════════════════════════════════════════════════════
    // BUILD FULL MODEL SERIES: [historical] → anchor → [forecast]
    // ═══════════════════════════════════════════════════════════════
    
    const series: PredictionPoint[] = [];
    
    // 1) HISTORICAL PART - from currentWindow (model fit on past data)
    const currentWindow = overlay?.currentWindow;
    if (currentWindow?.raw && currentWindow?.timestamps) {
      const raw = currentWindow.raw as number[];
      const timestamps = currentWindow.timestamps as number[];
      
      // Take last N days of historical data (matching horizon for consistency)
      const historyDays = Math.min(raw.length, horizonDays);
      const startIdx = raw.length - historyDays;
      
      for (let i = startIdx; i < raw.length; i++) {
        const ts = timestamps[i];
        const dateStr = new Date(ts).toISOString().split('T')[0];
        
        // Don't include dates >= asOf (those belong to forecast)
        if (dateStr < asOfDateStr) {
          series.push({
            t: dateStr,
            v: raw[i]
          });
        }
      }
    }
    
    // 2) ANCHOR POINT - asOf with current price
    series.push({
      t: asOfDateStr,
      v: asOfPrice
    });
    
    // 3) FORECAST PART - from forecast.path
    const startDate = forecast.startTs ? new Date(forecast.startTs) : new Date();
    for (let idx = 0; idx < forecast.path.length; idx++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + idx);
      const dateStr = d.toISOString().split('T')[0];
      
      // Only include future dates (after asOf)
      if (dateStr > asOfDateStr) {
        series.push({
          t: dateStr,
          v: forecast.path[idx]
        });
      }
    }
    
    // Filter and sort
    const validSeries = series
      .filter((p: PredictionPoint) => p.t && isFinite(p.v))
      .sort((a, b) => a.t.localeCompare(b.t));
    
    if (validSeries.length < 10) return null;
    
    // ═══════════════════════════════════════════════════════════════
    // DERIVE STANCE FROM FORECAST DIRECTION
    // ═══════════════════════════════════════════════════════════════
    
    // Find anchor index
    const anchorIdx = validSeries.findIndex(p => p.t === asOfDateStr);
    const forecastPart = validSeries.slice(anchorIdx);
    
    let stance: Stance = 'HOLD';
    if (forecastPart.length > 1) {
      const firstVal = forecastPart[0].v;
      const lastVal = forecastPart[forecastPart.length - 1].v;
      const returnPct = (lastVal - firstVal) / firstVal;
      
      if (returnPct > 0.02) stance = 'BULLISH';
      else if (returnPct < -0.02) stance = 'BEARISH';
    }
    
    const confidence = data?.diagnostics?.qualityScore || 0.5;
    
    return {
      asset: 'SPX',
      view: 'crossAsset',
      horizonDays,
      asOf: asOfDate.toISOString(),
      asOfPrice,
      series: validSeries,
      stance,
      confidence,
      modelVersion: 'v3.1.0',
      sourceEndpoint: '/api/spx/v2.1/focus-pack'
    };
  } catch (e) {
    console.error('[ExtractSpx] Error:', e);
    return null;
  }
}

/**
 * Extract snapshot payload from BTC terminal pack
 * Builds FULL model series: [historical] → anchor → [forecast]
 */
export function extractBtcSnapshotPayload(
  terminalPack: any,
  focus: string
): SnapshotPayload | null {
  try {
    // BTC focus-pack wraps data in 'focusPack' key
    const focusPack = terminalPack?.focusPack || terminalPack;
    const forecast = focusPack?.forecast;
    const overlay = focusPack?.overlay;
    
    if (!forecast?.path || forecast.path.length < 5) return null;
    
    // Convert focus to days
    const horizonMap: Record<string, number> = {
      '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180, '365d': 365
    };
    const horizonDays = horizonMap[focus] || parseInt(focus) || 30;
    
    // Get anchor point
    const asOfPrice = forecast.currentPrice || 95000;
    const asOfDate = new Date();
    const asOfDateStr = asOfDate.toISOString().split('T')[0];
    
    // ═══════════════════════════════════════════════════════════════
    // BUILD FULL MODEL SERIES: [historical] → anchor → [forecast]
    // ═══════════════════════════════════════════════════════════════
    
    const series: PredictionPoint[] = [];
    
    // 1) HISTORICAL PART - from currentWindow (model fit on past data)
    const currentWindow = overlay?.currentWindow;
    if (currentWindow?.raw && currentWindow?.timestamps) {
      const raw = currentWindow.raw as number[];
      const timestamps = currentWindow.timestamps as number[];
      
      // Take last N days of historical data (matching horizon for consistency)
      const historyDays = Math.min(raw.length, horizonDays);
      const startIdx = raw.length - historyDays;
      
      for (let i = startIdx; i < raw.length; i++) {
        const ts = timestamps[i];
        const dateStr = new Date(ts).toISOString().split('T')[0];
        
        // Don't include dates >= asOf (those belong to forecast)
        if (dateStr < asOfDateStr) {
          series.push({
            t: dateStr,
            v: raw[i]
          });
        }
      }
    }
    
    // 2) ANCHOR POINT - asOf with current price
    series.push({
      t: asOfDateStr,
      v: asOfPrice
    });
    
    // 3) FORECAST PART - from forecast.path
    const startDate = forecast.startTs ? new Date(forecast.startTs) : new Date();
    for (let idx = 0; idx < forecast.path.length; idx++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + idx);
      const dateStr = d.toISOString().split('T')[0];
      
      // Only include future dates (after asOf)
      if (dateStr > asOfDateStr) {
        series.push({
          t: dateStr,
          v: forecast.path[idx]
        });
      }
    }
    
    // Filter and sort
    const validSeries = series
      .filter((p: PredictionPoint) => p.t && isFinite(p.v))
      .sort((a, b) => a.t.localeCompare(b.t));
    
    if (validSeries.length < 10) return null;
    
    // ═══════════════════════════════════════════════════════════════
    // DERIVE STANCE FROM FORECAST DIRECTION
    // ═══════════════════════════════════════════════════════════════
    
    // Find anchor index
    const anchorIdx = validSeries.findIndex(p => p.t === asOfDateStr);
    const forecastPart = validSeries.slice(anchorIdx);
    
    let stance: Stance = 'HOLD';
    if (forecastPart.length > 1) {
      const firstVal = forecastPart[0].v;
      const lastVal = forecastPart[forecastPart.length - 1].v;
      const returnPct = (lastVal - firstVal) / firstVal;
      
      if (returnPct > 0.03) stance = 'BULLISH';
      else if (returnPct < -0.03) stance = 'BEARISH';
    }
    
    const confidence = focusPack?.diagnostics?.qualityScore || 0.5;
    
    return {
      asset: 'BTC',
      view: 'hybrid',
      horizonDays,
      asOf: asOfDate.toISOString(),
      asOfPrice,
      series: validSeries,
      stance,
      confidence,
      modelVersion: 'v3.1.0',
      sourceEndpoint: '/api/fractal/v2.1/focus-pack'
    };
  } catch (e) {
    console.error('[ExtractBtc] Error:', e);
    return null;
  }
}

export default snapshotHook;
