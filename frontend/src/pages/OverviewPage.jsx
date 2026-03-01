/**
 * OVERVIEW PAGE — PRODUCTION VERSION
 * 
 * LAYOUT (top to bottom):
 * 1. Asset + Horizon Switchers (top bar)
 * 2. BIG CHART (70vh, full width) — главный элемент
 * 3. Verdict Block (stance + confidence + action)
 * 4. Drivers + Risks (compact grid)
 * 5. Signal Stack (collapsible)
 * 
 * Graph is the hero. Text is secondary.
 * NO vertical NOW line. NO small charts.
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Activity,
  Target,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  XCircle,
  Info,
  Clock,
  Shield,
  CheckCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Lazy load LivePredictionChart
const LivePredictionChart = lazy(() => import('../components/charts/LivePredictionChart'));

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const ASSETS = [
  { key: 'spx', label: 'S&P 500', icon: '📊' },
  { key: 'btc', label: 'Bitcoin', icon: '₿' },
  { key: 'dxy', label: 'Dollar', icon: '💵' }
];

const HORIZONS = [7, 14, 30, 90, 180, 365];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const getStanceColor = (stance) => {
  switch (stance) {
    case 'BULLISH': return 'text-emerald-600';
    case 'BEARISH': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

const getStanceBg = (stance) => {
  switch (stance) {
    case 'BULLISH': return 'bg-emerald-50 border-emerald-100';
    case 'BEARISH': return 'bg-red-50 border-red-100';
    default: return 'bg-gray-50 border-gray-100';
  }
};

const getStanceIcon = (stance) => {
  switch (stance) {
    case 'BULLISH': return <TrendingUp className="w-6 h-6" />;
    case 'BEARISH': return <TrendingDown className="w-6 h-6" />;
    default: return <Minus className="w-6 h-6" />;
  }
};

const getActionText = (hint) => {
  switch (hint) {
    case 'INCREASE_RISK': return 'Increase Risk Exposure';
    case 'REDUCE_RISK': return 'Reduce Risk / Raise Cash';
    case 'HOLD_WAIT': return 'Wait for Confirmation';
    case 'HEDGE': return 'Consider Hedging';
    default: return 'Hold Position';
  }
};

const getSeverityStyle = (severity) => {
  switch (severity) {
    case 'HIGH': return 'text-red-700 bg-red-100';
    case 'MEDIUM': return 'text-amber-700 bg-amber-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

// ═══════════════════════════════════════════════════════════════
// VERDICT BLOCK (compact, under chart)
// ═══════════════════════════════════════════════════════════════

const VerdictBlock = ({ verdict, asset }) => {
  if (!verdict) return null;
  
  const assetNames = { dxy: 'Dollar', spx: 'S&P 500', btc: 'Bitcoin' };
  
  return (
    <div className={`p-5 rounded-xl border ${getStanceBg(verdict.stance)}`}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left: Stance */}
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${verdict.stance === 'BULLISH' ? 'bg-emerald-100' : verdict.stance === 'BEARISH' ? 'bg-red-100' : 'bg-gray-200'}`}>
            <span className={getStanceColor(verdict.stance)}>
              {getStanceIcon(verdict.stance)}
            </span>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
              {assetNames[asset]} Verdict
            </div>
            <div className={`text-2xl font-bold ${getStanceColor(verdict.stance)}`}>
              {verdict.stance}
            </div>
          </div>
        </div>
        
        {/* Center: Confidence */}
        <div className="text-center px-6 border-l border-r border-gray-200/50">
          <div className="text-xs text-gray-500">Confidence</div>
          <div className="text-xl font-bold text-gray-800">
            {verdict.confidencePct}%
          </div>
        </div>
        
        {/* Right: Action */}
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-gray-400" />
          <div>
            <div className="text-xs text-gray-500">Action</div>
            <div className={`font-semibold ${getStanceColor(verdict.stance)}`}>
              {getActionText(verdict.actionHint)}
            </div>
          </div>
        </div>
      </div>
      
      {verdict.summary && (
        <p className="mt-4 text-sm text-gray-600">{verdict.summary}</p>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DRIVERS & RISKS (compact grid)
// ═══════════════════════════════════════════════════════════════

const DriversRisksGrid = ({ reasons, risks }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Drivers */}
      <div className="p-4 bg-white rounded-xl border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-700">Key Drivers</h3>
        </div>
        {reasons && reasons.length > 0 ? (
          <ul className="space-y-2">
            {reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getSeverityStyle(r.severity)}`}>
                  {r.severity?.charAt(0) || 'M'}
                </span>
                <span className="text-gray-700">{r.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No drivers available</p>
        )}
      </div>
      
      {/* Risks */}
      <div className="p-4 bg-white rounded-xl border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-700">Key Risks</h3>
        </div>
        {risks && risks.length > 0 ? (
          <ul className="space-y-2">
            {risks.slice(0, 3).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getSeverityStyle(r.severity)}`}>
                  {r.severity?.charAt(0) || 'M'}
                </span>
                <span className="text-gray-700">{r.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No risks identified</p>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SIGNAL STACK (collapsible)
// ═══════════════════════════════════════════════════════════════

const SignalStack = ({ indicators }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!indicators || indicators.length === 0) return null;
  
  const visibleIndicators = expanded ? indicators : indicators.slice(0, 4);
  
  return (
    <div className="p-4 bg-white rounded-xl border border-gray-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Signal Stack</h3>
          <span className="text-xs text-gray-400">({indicators.length} indicators)</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {visibleIndicators.map((ind, i) => (
          <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${
              ind.status === 'GOOD' ? 'bg-emerald-500' :
              ind.status === 'BAD' ? 'bg-red-500' : 'bg-gray-400'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 truncate">{ind.name}</div>
              <div className="text-sm font-medium text-gray-800">{ind.value}</div>
            </div>
          </div>
        ))}
      </div>
      
      {!expanded && indicators.length > 4 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 text-xs text-gray-500 hover:text-gray-700"
        >
          Show {indicators.length - 4} more...
        </button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function OverviewPage() {
  const [asset, setAsset] = useState('spx');
  const [horizon, setHorizon] = useState(90);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Fetch overview data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_URL}/api/ui/overview?asset=${asset}&horizon=${horizon}`);
      const json = await res.json();
      
      if (json.ok) {
        setData(json);
        setLastUpdate(new Date());
      } else {
        setError(json.error || 'Failed to load data');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [asset, horizon]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // View mapping for prediction (must match what snapshot_hook saves)
  const predictionView = asset === 'dxy' ? 'hybrid' : asset === 'spx' ? 'crossAsset' : 'hybrid';
  
  return (
    <div className="min-h-screen bg-gray-50" data-testid="overview-page">
      {/* ═══════════════════════════════════════════════════════════
          TOP BAR: Asset + Horizon Switchers + Price
          ═══════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Left: Title + Asset Price (if available) */}
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-900">Market Overview</h1>
              {data?.currentPrice && (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold text-gray-800">
                    ${data.currentPrice.toLocaleString()}
                  </span>
                  {data?.priceChange24h && (
                    <span className={`text-sm font-medium ${
                      data.priceChange24h >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {data.priceChange24h >= 0 ? '+' : ''}{data.priceChange24h.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Center: Asset Switcher */}
            <div className="flex items-center gap-2">
              {ASSETS.map(a => (
                <button
                  key={a.key}
                  onClick={() => setAsset(a.key)}
                  data-testid={`asset-${a.key}`}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    asset === a.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="mr-1">{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
            
            {/* Right: Horizon Switcher + Refresh */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {HORIZONS.map(h => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    data-testid={`horizon-${h}`}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      horizon === h
                        ? 'bg-emerald-500 text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {h}d
                  </button>
                ))}
              </div>
              
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Error: {error}</span>
            </div>
          </div>
        )}
        
        {/* ═══════════════════════════════════════════════════════
            1. MAIN CHART (70vh, full width) — THE HERO
            ═══════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <Suspense fallback={
            <div className="h-[65vh] bg-white rounded-2xl border border-gray-100 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
            </div>
          }>
            <LivePredictionChart
              asset={asset.toUpperCase()}
              horizonDays={horizon}
              view={predictionView}
            />
          </Suspense>
        </div>
        
        {/* Loading State for text blocks */}
        {loading && !data && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading verdict...</span>
            </div>
          </div>
        )}
        
        {/* ═══════════════════════════════════════════════════════
            2. VERDICT BLOCK (under chart)
            ═══════════════════════════════════════════════════════ */}
        {data?.verdict && (
          <div className="mb-6">
            <VerdictBlock verdict={data.verdict} asset={asset} />
          </div>
        )}
        
        {/* ═══════════════════════════════════════════════════════
            3. DRIVERS + RISKS (compact grid)
            ═══════════════════════════════════════════════════════ */}
        {data && (
          <div className="mb-6">
            <DriversRisksGrid reasons={data.reasons} risks={data.risks} />
          </div>
        )}
        
        {/* ═══════════════════════════════════════════════════════
            4. SIGNAL STACK (collapsible)
            ═══════════════════════════════════════════════════════ */}
        {data?.indicators && (
          <div className="mb-6">
            <SignalStack indicators={data.indicators} />
          </div>
        )}
        
        {/* ═══════════════════════════════════════════════════════
            FOOTER: Last Update
            ═══════════════════════════════════════════════════════ */}
        {lastUpdate && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
