/**
 * PREDICTION SNAPSHOTS SERVICE
 * 
 * Stores prediction history for transparent model tracking.
 * 
 * Principles:
 * - NO recalculation based on price
 * - Each snapshot is immutable
 * - Old predictions fade to gray, not corrected
 * - Shows model adaptation honestly
 * 
 * Storage trigger rules:
 * - Stance changed
 * - |confidence_new - confidence_old| >= 0.10
 * - series hash changed
 * - >= 24h since last snapshot
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient, Db, Collection } from 'mongodb';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type AssetType = 'SPX' | 'DXY' | 'BTC';
export type PredictionView = 'synthetic' | 'hybrid' | 'macro' | 'crossAsset';
export type Stance = 'BULLISH' | 'BEARISH' | 'HOLD';

export interface PredictionPoint {
  t: string;  // ISO timestamp
  v: number;  // absolute price
}

export interface ConfidenceBand {
  p10: PredictionPoint[];
  p90: PredictionPoint[];
}

export interface SnapshotMetadata {
  stance: Stance;
  confidence: number;   // 0..1
  quality?: number;
  modelVersion: string;
}

export interface PredictionSnapshot {
  _id?: any;
  asset: AssetType;
  view: PredictionView;
  horizonDays: number;

  asOf: string;          // prediction start (ISO)
  asOfPrice: number;

  series: PredictionPoint[];
  band?: ConfidenceBand;

  metadata: SnapshotMetadata;
  
  hash: string;
  createdAt: string;
}

export interface SnapshotSaveResult {
  saved: boolean;
  reason?: string;
  snapshotId?: string;
}

// ═══════════════════════════════════════════════════════════════
// MONGODB CONNECTION
// ═══════════════════════════════════════════════════════════════

let _db: Db | null = null;
let _collection: Collection<PredictionSnapshot> | null = null;

async function getCollection(): Promise<Collection<PredictionSnapshot> | null> {
  if (_collection) return _collection;
  
  try {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
    const dbName = process.env.DB_NAME || 'fractal_platform';
    const client = new MongoClient(mongoUrl);
    await client.connect();
    _db = client.db(dbName);
    _collection = _db.collection<PredictionSnapshot>('prediction_snapshots');
    
    // Ensure indexes
    await _collection.createIndex({ asset: 1, view: 1, horizonDays: 1, asOf: -1 });
    await _collection.createIndex({ asset: 1, createdAt: -1 });
    
    return _collection;
  } catch (e) {
    console.error('[Snapshots] MongoDB connection failed:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// HASH CALCULATION
// ═══════════════════════════════════════════════════════════════

function calculateSnapshotHash(
  series: PredictionPoint[],
  stance: Stance,
  confidence: number
): string {
  const data = JSON.stringify({
    series: series.map(p => ({ t: p.t, v: Math.round(p.v * 100) / 100 })),
    stance,
    confidence: Math.round(confidence * 100) / 100
  });
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

// ═══════════════════════════════════════════════════════════════
// SNAPSHOT SAVING LOGIC
// ═══════════════════════════════════════════════════════════════

const CONFIDENCE_THRESHOLD = 0.10;
const MIN_HOURS_BETWEEN_SNAPSHOTS = 24;

export async function shouldSaveSnapshot(
  asset: AssetType,
  view: PredictionView,
  horizonDays: number,
  newHash: string,
  newConfidence: number,
  newStance: Stance
): Promise<{ shouldSave: boolean; reason: string }> {
  const collection = await getCollection();
  if (!collection) {
    return { shouldSave: false, reason: 'no_db' };
  }
  
  // Get latest snapshot for this asset/view/horizon
  const latest = await collection.findOne(
    { asset, view, horizonDays },
    { sort: { asOf: -1 } }
  );
  
  if (!latest) {
    return { shouldSave: true, reason: 'first_snapshot' };
  }
  
  // Check if stance changed
  if (latest.metadata.stance !== newStance) {
    return { shouldSave: true, reason: 'stance_changed' };
  }
  
  // Check if confidence changed significantly
  if (Math.abs(latest.metadata.confidence - newConfidence) >= CONFIDENCE_THRESHOLD) {
    return { shouldSave: true, reason: 'confidence_changed' };
  }
  
  // Check if prediction series changed
  if (latest.hash !== newHash) {
    return { shouldSave: true, reason: 'series_changed' };
  }
  
  // Check if enough time has passed (fallback)
  const hoursSinceLastSnapshot = 
    (Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceLastSnapshot >= MIN_HOURS_BETWEEN_SNAPSHOTS) {
    return { shouldSave: true, reason: 'time_elapsed' };
  }
  
  return { shouldSave: false, reason: 'no_significant_change' };
}

export async function saveSnapshot(
  asset: AssetType,
  view: PredictionView,
  horizonDays: number,
  asOf: string,
  asOfPrice: number,
  series: PredictionPoint[],
  metadata: SnapshotMetadata,
  band?: ConfidenceBand
): Promise<SnapshotSaveResult> {
  const collection = await getCollection();
  if (!collection) {
    return { saved: false, reason: 'no_db' };
  }
  
  const hash = calculateSnapshotHash(series, metadata.stance, metadata.confidence);
  
  const { shouldSave, reason } = await shouldSaveSnapshot(
    asset,
    view,
    horizonDays,
    hash,
    metadata.confidence,
    metadata.stance
  );
  
  if (!shouldSave) {
    return { saved: false, reason };
  }
  
  const snapshot: PredictionSnapshot = {
    asset,
    view,
    horizonDays,
    asOf,
    asOfPrice,
    series,
    band,
    metadata,
    hash,
    createdAt: new Date().toISOString()
  };
  
  try {
    const result = await collection.insertOne(snapshot as any);
    console.log(`[Snapshots] Saved ${asset}/${view}/${horizonDays}d: ${reason}`);
    return { saved: true, reason, snapshotId: result.insertedId.toString() };
  } catch (e: any) {
    return { saved: false, reason: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// SNAPSHOT RETRIEVAL
// ═══════════════════════════════════════════════════════════════

export async function getSnapshots(
  asset: AssetType,
  view: PredictionView,
  horizonDays: number,
  limit: number = 12
): Promise<PredictionSnapshot[]> {
  const collection = await getCollection();
  if (!collection) {
    return [];
  }
  
  const snapshots = await collection
    .find({ asset, view, horizonDays })
    .sort({ asOf: -1 })
    .limit(limit)
    .toArray();
  
  // Remove MongoDB _id from response
  return snapshots.map(s => {
    const { _id, ...rest } = s;
    return rest as PredictionSnapshot;
  });
}

export async function getAllSnapshotsForAsset(
  asset: AssetType,
  limit: number = 50
): Promise<PredictionSnapshot[]> {
  const collection = await getCollection();
  if (!collection) {
    return [];
  }
  
  const snapshots = await collection
    .find({ asset })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  
  return snapshots.map(s => {
    const { _id, ...rest } = s;
    return rest as PredictionSnapshot;
  });
}

// ═══════════════════════════════════════════════════════════════
// MARKET CANDLES (from existing data)
// ═══════════════════════════════════════════════════════════════

export interface Candle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
}

export async function getMarketCandles(
  asset: AssetType,
  fromDate?: string,
  toDate?: string,
  limit: number = 365
): Promise<Candle[]> {
  const db = _db || (await getCollection(), _db);
  if (!db) return [];
  
  // Map asset to collection
  const collectionMap: Record<AssetType, string> = {
    'BTC': 'btc_candles',
    'SPX': 'spx_candles',
    'DXY': 'dxy_candles'
  };
  
  const candleCollection = db.collection(collectionMap[asset]);
  
  const query: any = {};
  if (fromDate) query.date = { $gte: fromDate };
  if (toDate) query.date = { ...query.date, $lte: toDate };
  
  const candles = await candleCollection
    .find(query)
    .sort({ date: -1 })
    .limit(limit)
    .toArray();
  
  return candles.map(c => ({
    t: c.date,
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close
  })).reverse();
}

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

export async function registerPredictionRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/prediction/snapshots
   * Get prediction snapshots for chart
   */
  app.get('/api/prediction/snapshots', async (request: FastifyRequest, reply: FastifyReply) => {
    const { 
      asset = 'SPX', 
      view = 'crossAsset', 
      horizon = '180',
      limit = '12'
    } = request.query as { 
      asset?: string; 
      view?: string; 
      horizon?: string;
      limit?: string;
    };
    
    const validAssets: AssetType[] = ['SPX', 'DXY', 'BTC'];
    const validViews: PredictionView[] = ['synthetic', 'hybrid', 'macro', 'crossAsset'];
    
    const assetParsed = validAssets.includes(asset as AssetType) 
      ? asset as AssetType 
      : 'SPX';
    const viewParsed = validViews.includes(view as PredictionView) 
      ? view as PredictionView 
      : 'crossAsset';
    const horizonParsed = parseInt(horizon) || 180;
    const limitParsed = Math.min(parseInt(limit) || 12, 50);
    
    const snapshots = await getSnapshots(
      assetParsed,
      viewParsed,
      horizonParsed,
      limitParsed
    );
    
    return reply.send({
      ok: true,
      asset: assetParsed,
      view: viewParsed,
      horizonDays: horizonParsed,
      count: snapshots.length,
      snapshots
    });
  });
  
  /**
   * GET /api/market/candles
   * Get market candles for chart
   */
  app.get('/api/market/candles', async (request: FastifyRequest, reply: FastifyReply) => {
    const { 
      asset = 'SPX', 
      from,
      to,
      limit = '365'
    } = request.query as { 
      asset?: string; 
      from?: string;
      to?: string;
      limit?: string;
    };
    
    const validAssets: AssetType[] = ['SPX', 'DXY', 'BTC'];
    const assetParsed = validAssets.includes(asset as AssetType) 
      ? asset as AssetType 
      : 'SPX';
    
    const candles = await getMarketCandles(
      assetParsed,
      from,
      to,
      Math.min(parseInt(limit) || 365, 1000)
    );
    
    return reply.send({
      ok: true,
      asset: assetParsed,
      count: candles.length,
      candles
    });
  });
  
  /**
   * POST /api/prediction/snapshot (internal - save new snapshot)
   */
  app.post('/api/prediction/snapshot', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    
    if (!body.asset || !body.view || !body.series || !body.metadata) {
      return reply.status(400).send({
        ok: false,
        error: 'Missing required fields: asset, view, series, metadata'
      });
    }
    
    const result = await saveSnapshot(
      body.asset,
      body.view,
      body.horizonDays || 180,
      body.asOf || new Date().toISOString(),
      body.asOfPrice || 0,
      body.series,
      body.metadata,
      body.band
    );
    
    return reply.send({
      ok: result.saved,
      ...result
    });
  });
  
  /**
   * GET /api/prediction/stats
   * Get snapshot statistics
   */
  app.get('/api/prediction/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const collection = await getCollection();
    if (!collection) {
      return reply.status(500).send({ ok: false, error: 'No database' });
    }
    
    const stats = await collection.aggregate([
      {
        $group: {
          _id: { asset: '$asset', view: '$view', horizonDays: '$horizonDays' },
          count: { $sum: 1 },
          firstSnapshot: { $min: '$asOf' },
          lastSnapshot: { $max: '$asOf' }
        }
      },
      { $sort: { '_id.asset': 1, '_id.view': 1 } }
    ]).toArray();
    
    const total = await collection.countDocuments();
    
    return reply.send({
      ok: true,
      totalSnapshots: total,
      byAssetViewHorizon: stats
    });
  });
  
  console.log('[Prediction] Snapshot routes registered at /api/prediction/*');
  console.log('[Prediction] Market candles at /api/market/candles');
}

export default registerPredictionRoutes;
