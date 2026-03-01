/**
 * OVERVIEW UI SERVICE
 * 
 * Aggregates existing packs into user-friendly overview.
 * NO MATH RECALCULATION - read-only aggregation only.
 * 
 * Sources:
 * - MacroScore v3
 * - Fractal Hybrid (DXY/SPX/BTC)
 * - Cross-Asset Classification
 * - Capital Scaling
 * - L5 Audit Meta
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ═══════════════════════════════════════════════════════════════
// CONTRACTS
// ═══════════════════════════════════════════════════════════════

export type Stance = 'BULLISH' | 'BEARISH' | 'HOLD';
export type ActionHint = 'INCREASE_RISK' | 'REDUCE_RISK' | 'HOLD_WAIT' | 'HEDGE';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
export type IndicatorStatus = 'GOOD' | 'NEUTRAL' | 'BAD';
export type Asset = 'dxy' | 'spx' | 'btc';

export interface OverviewPack {
  asOf: string;
  asset: Asset;

  verdict: {
    stance: Stance;
    actionHint: ActionHint;
    confidencePct: number;
    horizonDays: number;
    summary: string;
  };

  reasons: Array<{
    title: string;
    text: string;
    severity: Severity;
    source: 'macro' | 'dxy' | 'crossAsset' | 'brain' | 'capitalScaling';
  }>;

  risks: Array<{
    title: string;
    text: string;
    severity: Severity;
  }>;

  indicators: Array<{
    key: string;
    label: string;
    valueText: string;
    status: IndicatorStatus;
    tooltip: string;
  }>;

  horizons: Array<{
    days: number | 'synthetic';
    stance: Stance;
    medianProjectionPct: number;
    rangeLowPct: number;
    rangeHighPct: number;
    confidencePct: number;
  }>;

  pipeline: {
    macroScore: { score: number; regime: string; stability: number };
    dxyFinal: { projectionPct: number; stance: string };
    spxOverlay?: { projectionPct: number; stance: string };
    btcOverlay?: { projectionPct: number; stance: string };
    capitalScaling?: { scalePct: number; posture: string; drivers: string[] };
  };

  charts?: {
    actual: Array<{ t: string; v: number }>;
    predicted: Array<{ t: string; v: number }>;
    band?: Array<{ t: string; low: number; high: number }>;
  };

  meta: {
    systemVersion: string;
    inputsHash: string;
    dataMode: 'mongo' | 'mock';
    l5Grade: 'PRODUCTION' | 'REVIEW' | 'FAIL';
  };
}

// ═══════════════════════════════════════════════════════════════
// HUMAN TEXT BUILDER
// ═══════════════════════════════════════════════════════════════

const INDICATOR_TOOLTIPS: Record<string, string> = {
  T10Y2Y: 'Yield curve (10Y-2Y). Negative = inversion, recession signal. Positive = expansion mode.',
  CPIAUCSL: 'Consumer inflation YoY. High (>4%) = hawkish Fed. Low (<2%) = dovish.',
  CPILFESL: 'Core inflation (ex food/energy). Fed\'s preferred metric.',
  PPIACO: 'Producer prices. Leading indicator for CPI.',
  UNRATE: 'Unemployment rate. Rising = recession risk. Falling = expansion.',
  M2SL: 'Money supply growth. High = liquidity driven rally. Negative = tightening.',
  BAA10Y: 'Credit spread. Wide (>3%) = stress. Narrow (<2%) = risk-on.',
  TEDRATE: 'Interbank stress. High = funding crisis.',
  FEDFUNDS: 'Fed funds rate. Rising = tightening. Falling = easing.',
  HOUST: 'Housing starts. Leading economic indicator.',
  INDPRO: 'Industrial production. Economic growth proxy.',
  VIXCLS: 'Volatility index. High (>25) = fear. Low (<15) = complacency.',
};

const STANCE_SUMMARIES: Record<string, Record<Stance, string>> = {
  dxy: {
    BULLISH: 'Dollar strength expected. Risk assets may face headwinds.',
    BEARISH: 'Dollar weakness ahead. Supportive for risk assets and commodities.',
    HOLD: 'Dollar range-bound. No clear directional signal.',
  },
  spx: {
    BULLISH: 'Equity market conditions favorable. Consider increasing exposure.',
    BEARISH: 'Defensive positioning recommended. Reduce risk, increase cash.',
    HOLD: 'Mixed signals. Wait for confirmation before acting.',
  },
  btc: {
    BULLISH: 'Crypto conditions favorable. Risk-on environment supports BTC.',
    BEARISH: 'Caution advised. Macro headwinds may pressure crypto.',
    HOLD: 'Neutral stance. BTC following broader risk sentiment.',
  },
};

const ACTION_HINTS: Record<ActionHint, string> = {
  INCREASE_RISK: 'Market supports risk. Gradually increase exposure.',
  REDUCE_RISK: 'Defense mode. Reduce positions, raise cash.',
  HOLD_WAIT: 'Signal weak. Wait for confirmation.',
  HEDGE: 'Elevated tail risk. Consider protective positions.',
};

function buildSummary(asset: Asset, stance: Stance, confidence: number): string {
  const base = STANCE_SUMMARIES[asset][stance];
  const confText = confidence >= 70 ? 'High confidence.' : confidence >= 50 ? 'Moderate confidence.' : 'Low confidence.';
  return `${base} ${confText}`;
}

function buildReasonText(driver: string, contribution: number, direction: string): string {
  const dirText = direction === 'positive' ? 'supporting risk' : 'pressuring markets';
  const impact = Math.abs(contribution) > 0.3 ? 'strongly' : Math.abs(contribution) > 0.15 ? 'moderately' : 'slightly';
  return `${driver} is ${impact} ${dirText}.`;
}

function buildRiskText(riskType: string, severity: Severity): string {
  const texts: Record<string, string> = {
    tailRisk: 'Elevated tail risk scenarios. Consider hedges.',
    decoupled: 'Cross-asset relationships unstable. Diversification may not work.',
    horizonConflict: 'Short and long-term signals disagree. Higher uncertainty.',
    lowConfidence: 'Model confidence below threshold. Reduce position sizing.',
    spreadWide: 'Credit spreads widening. Risk-off signal.',
  };
  return texts[riskType] || 'Unknown risk factor detected.';
}

// ═══════════════════════════════════════════════════════════════
// SIMPLE CACHE (60 second TTL)
// ═══════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: Map<string, CacheEntry<any>> = new Map();
const CACHE_TTL_MS = 60000; // 60 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ═══════════════════════════════════════════════════════════════
// FETCHERS WITH CACHING
// ═══════════════════════════════════════════════════════════════

async function fetchMacroScore(horizon: number): Promise<any> {
  const cacheKey = `macro_${horizon}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;
  
  try {
    const res = await fetch(`http://localhost:8002/api/macro-score/v3/compute?horizon=${horizon}&dataMode=mongo`);
    const data = await res.json();
    setCache(cacheKey, data);
    return data;
  } catch (e) {
    return null;
  }
}

async function fetchContributionReport(): Promise<any> {
  const cacheKey = 'contrib_report';
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;
  
  try {
    const res = await fetch('http://localhost:8002/api/macro-score/v3/contribution-report?dataMode=mongo');
    const data = await res.json();
    setCache(cacheKey, data);
    return data;
  } catch (e) {
    return null;
  }
}

async function fetchFractalTerminal(asset: Asset, focus: string): Promise<any> {
  const cacheKey = `fractal_${asset}_${focus}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;
  
  try {
    const endpoints: Record<Asset, string> = {
      dxy: `/api/fractal/dxy/terminal?focus=${focus}`,
      spx: `/api/spx/v2.1/terminal?horizon=${focus}`,
      btc: `/api/fractal/v2.1/focus-pack?symbol=BTC&focus=${focus}`,
    };
    const res = await fetch(`http://localhost:8002${endpoints[asset]}`);
    const data = await res.json();
    setCache(cacheKey, data);
    return data;
  } catch (e) {
    return null;
  }
}

async function fetchBrainDecision(): Promise<any> {
  const cacheKey = 'brain_decision';
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;
  
  try {
    const res = await fetch('http://localhost:8002/api/ui/brain/decision');
    const data = await res.json();
    setCache(cacheKey, data);
    return data;
  } catch (e) {
    return null;
  }
}

async function fetchL5Audit(): Promise<any> {
  try {
    const res = await fetch('http://localhost:8002/api/audit/l5/quick');
    return await res.json();
  } catch (e) {
    return { status: 'unknown', checks: [] };
  }
}

function deriveStance(projection: number, confidence: number, threshold = 0.02): Stance {
  if (confidence < 40) return 'HOLD';
  if (projection > threshold) return 'BULLISH';
  if (projection < -threshold) return 'BEARISH';
  return 'HOLD';
}

function deriveActionHint(stance: Stance, tailRisk: boolean, confidence: number): ActionHint {
  if (tailRisk) return 'HEDGE';
  if (confidence < 40) return 'HOLD_WAIT';
  if (stance === 'BULLISH') return 'INCREASE_RISK';
  if (stance === 'BEARISH') return 'REDUCE_RISK';
  return 'HOLD_WAIT';
}

function deriveSeverity(value: number, thresholds: [number, number] = [0.15, 0.35]): Severity {
  if (value > thresholds[1]) return 'HIGH';
  if (value > thresholds[0]) return 'MEDIUM';
  return 'LOW';
}

function deriveIndicatorStatus(contribution: number): IndicatorStatus {
  if (contribution > 0.05) return 'GOOD';
  if (contribution < -0.05) return 'BAD';
  return 'NEUTRAL';
}

// ═══════════════════════════════════════════════════════════════
// MAIN AGGREGATOR
// ═══════════════════════════════════════════════════════════════

export async function buildOverviewPack(
  asset: Asset,
  horizonDays: number
): Promise<OverviewPack> {
  const focusMap: Record<number, string> = {
    30: '30d',
    90: '90d',
    180: '180d',
    365: '365d',
  };
  const focus = focusMap[horizonDays] || '90d';
  
  // Fetch all sources in parallel
  const [macroResult, contribReport, fractalData, brainData, l5Audit] = await Promise.all([
    fetchMacroScore(horizonDays),
    fetchContributionReport(),
    fetchFractalTerminal(asset, focus),
    fetchBrainDecision(),
    fetchL5Audit(),
  ]);
  
  const asOf = new Date().toISOString().slice(0, 10);
  
  // Extract macro data
  const macroScore = macroResult?.score || 0;
  const macroRegime = macroScore > 0.1 ? 'EASING' : macroScore < -0.1 ? 'TIGHTENING' : 'NEUTRAL';
  const macroConfidence = macroResult?.diagnostics?.confidence || 50;
  
  // Extract fractal data
  const projection = fractalData?.summary?.projection?.median || 0;
  const fractalConfidence = fractalData?.summary?.confidence || 50;
  const projectionPct = projection * 100;
  
  // Derive verdict
  const stance = deriveStance(projection, fractalConfidence);
  const tailRisk = (fractalData?.summary?.tailRiskRate || 0) > 0.15;
  const actionHint = deriveActionHint(stance, tailRisk, fractalConfidence);
  
  // Build reasons from contribution report
  const reasons: OverviewPack['reasons'] = [];
  
  if (contribReport?.report?.analysis) {
    const topDrivers = contribReport.report.analysis.slice(0, 2);
    for (const driver of topDrivers) {
      reasons.push({
        title: `${driver.key} impact`,
        text: buildReasonText(driver.key, driver.rawContribution, driver.signal > 0 ? 'positive' : 'negative'),
        severity: deriveSeverity(Math.abs(driver.share / 100)),
        source: 'macro',
      });
    }
  }
  
  // Add DXY direction reason
  if (asset !== 'dxy' && macroResult) {
    const dxyDir = macroScore > 0 ? 'weakening' : 'strengthening';
    reasons.push({
      title: 'Dollar direction',
      text: `Dollar ${dxyDir} ${Math.abs(macroScore) > 0.1 ? 'significantly' : 'modestly'}. ${dxyDir === 'weakening' ? 'Supportive for risk.' : 'Headwind for risk.'}`,
      severity: deriveSeverity(Math.abs(macroScore), [0.05, 0.15]),
      source: 'dxy',
    });
  }
  
  // Build risks
  const risks: OverviewPack['risks'] = [];
  
  if (tailRisk) {
    risks.push({
      title: 'Tail risk elevated',
      text: buildRiskText('tailRisk', 'HIGH'),
      severity: 'HIGH',
    });
  }
  
  if (fractalConfidence < 50) {
    risks.push({
      title: 'Low model confidence',
      text: buildRiskText('lowConfidence', 'MEDIUM'),
      severity: 'MEDIUM',
    });
  }
  
  // Horizon conflict check
  if (brainData?.horizonConflict) {
    risks.push({
      title: 'Horizon disagreement',
      text: buildRiskText('horizonConflict', 'MEDIUM'),
      severity: 'MEDIUM',
    });
  }
  
  // Build indicators from macro diagnostics
  const indicators: OverviewPack['indicators'] = [];
  
  if (macroResult?.diagnostics?.contributions) {
    const contribs = macroResult.diagnostics.contributions;
    for (const [key, value] of Object.entries(contribs)) {
      const contrib = value as number;
      if (Math.abs(contrib) > 0.001) {
        indicators.push({
          key,
          label: key,
          valueText: contrib > 0 ? `+${(contrib * 100).toFixed(1)}%` : `${(contrib * 100).toFixed(1)}%`,
          status: deriveIndicatorStatus(contrib),
          tooltip: INDICATOR_TOOLTIPS[key] || 'Macro indicator',
        });
      }
    }
  }
  
  // Build horizons
  const horizons: OverviewPack['horizons'] = [30, 90, 180, 365].map(days => {
    const h = fractalData?.horizons?.find((h: any) => h.days === days);
    return {
      days,
      stance: h ? deriveStance(h.projection || 0, h.confidence || 50) : 'HOLD',
      medianProjectionPct: (h?.projection || 0) * 100,
      rangeLowPct: (h?.rangeLow || -0.05) * 100,
      rangeHighPct: (h?.rangeHigh || 0.05) * 100,
      confidencePct: h?.confidence || 50,
    };
  });
  
  // Add synthetic if available
  if (fractalData?.synthetic) {
    horizons.push({
      days: 'synthetic' as any,
      stance: deriveStance(fractalData.synthetic.projection || 0, fractalData.synthetic.confidence || 50),
      medianProjectionPct: (fractalData.synthetic.projection || 0) * 100,
      rangeLowPct: (fractalData.synthetic.rangeLow || -0.05) * 100,
      rangeHighPct: (fractalData.synthetic.rangeHigh || 0.05) * 100,
      confidencePct: fractalData.synthetic.confidence || 50,
    });
  }
  
  // Build pipeline
  const pipeline: OverviewPack['pipeline'] = {
    macroScore: {
      score: Math.round(macroScore * 1000) / 1000,
      regime: macroRegime,
      stability: macroConfidence / 100,
    },
    dxyFinal: {
      projectionPct: projectionPct,
      stance: stance,
    },
  };
  
  if (asset === 'spx' || asset === 'btc') {
    pipeline.spxOverlay = {
      projectionPct: projectionPct,
      stance: stance,
    };
  }
  
  if (asset === 'btc') {
    pipeline.btcOverlay = {
      projectionPct: projectionPct,
      stance: stance,
    };
  }
  
  // Build charts from fractal timeline if available
  let charts: OverviewPack['charts'] | undefined;
  
  if (fractalData?.timeline) {
    charts = {
      actual: fractalData.timeline.actual?.map((p: any) => ({ t: p.date, v: p.price })) || [],
      predicted: fractalData.timeline.predicted?.map((p: any) => ({ t: p.date, v: p.price })) || [],
    };
  }
  
  // Determine L5 grade
  const l5Grade = l5Audit?.status === 'healthy' ? 'PRODUCTION' : 'REVIEW';
  
  return {
    asOf,
    asset,
    verdict: {
      stance,
      actionHint,
      confidencePct: Math.round(fractalConfidence),
      horizonDays,
      summary: buildSummary(asset, stance, fractalConfidence),
    },
    reasons: reasons.slice(0, 3),
    risks: risks.slice(0, 3),
    indicators: indicators.sort((a, b) => Math.abs(parseFloat(b.valueText)) - Math.abs(parseFloat(a.valueText))).slice(0, 9),
    horizons,
    pipeline,
    charts,
    meta: {
      systemVersion: 'v3.1.0',
      inputsHash: macroResult?.diagnostics?.inputsHash || 'unknown',
      dataMode: 'mongo',
      l5Grade,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

export async function registerOverviewRoutes(app: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/ui/overview
   * Main Overview endpoint - aggregates all packs
   */
  app.get('/api/ui/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const { asset = 'spx', horizon = '90' } = request.query as { asset?: string; horizon?: string };
    
    const validAssets: Asset[] = ['dxy', 'spx', 'btc'];
    const validHorizons = [30, 90, 180, 365];
    
    const assetParsed = validAssets.includes(asset as Asset) ? asset as Asset : 'spx';
    const horizonParsed = validHorizons.includes(parseInt(horizon)) ? parseInt(horizon) : 90;
    
    try {
      const start = Date.now();
      const pack = await buildOverviewPack(assetParsed, horizonParsed);
      const latency = Date.now() - start;
      
      return reply.send({
        ok: true,
        latencyMs: latency,
        ...pack,
      });
    } catch (e: any) {
      return reply.status(500).send({
        ok: false,
        error: e.message,
      });
    }
  });
  
  console.log('[Overview] UI Overview registered at /api/ui/overview');
}

export default registerOverviewRoutes;
