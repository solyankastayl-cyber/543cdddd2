/**
 * BRAIN OVERVIEW PAGE — User Brain Page v3
 * 
 * Institutional AI Macro Risk Dashboard
 * 
 * UI Rules:
 * - Light theme, white background
 * - No borders/shadows on blocks
 * - Colors: green=positive, red=negative, orange=warning, gray=neutral
 * - Gray SVG icons only
 * - Tooltips on hover
 */

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Shield, 
  TrendingUp, 
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Activity,
  DollarSign,
  BarChart3,
  Layers,
  Target,
  Scale,
  Info
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ═══════════════════════════════════════════════════════════════
// STATUS COLORS
// ═══════════════════════════════════════════════════════════════

const getStatusColor = (status) => {
  switch (status) {
    case 'positive': return 'text-green-600';
    case 'negative': return 'text-red-600';
    case 'warning': return 'text-orange-500';
    case 'nodata': return 'text-gray-400';
    default: return 'text-gray-600';
  }
};

const getStatusBg = (status) => {
  switch (status) {
    case 'positive': return 'bg-green-50';
    case 'negative': return 'bg-red-50';
    case 'warning': return 'bg-orange-50';
    default: return 'bg-gray-50';
  }
};

const getScenarioColor = (scenario) => {
  switch (scenario) {
    case 'TAIL': return 'bg-red-100 text-red-700';
    case 'RISK': return 'bg-orange-100 text-orange-700';
    case 'BASE': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getPostureColor = (posture) => {
  switch (posture) {
    case 'OFFENSIVE': return 'bg-green-100 text-green-700';
    case 'DEFENSIVE': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getGuardColor = (guard) => {
  switch (guard) {
    case 'BLOCK': return 'bg-red-100 text-red-700';
    case 'CRISIS': return 'bg-orange-100 text-orange-700';
    case 'WARN': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

// ═══════════════════════════════════════════════════════════════
// TOOLTIP COMPONENT
// ═══════════════════════════════════════════════════════════════

const Tooltip = ({ children, text }) => {
  return (
    <div className="group relative inline-block">
      {children}
      <div className="invisible group-hover:visible absolute z-50 w-64 p-2 text-xs text-gray-600 bg-white border border-gray-200 rounded shadow-sm -top-2 left-full ml-2">
        {text}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// HEALTH STRIP
// ═══════════════════════════════════════════════════════════════

const HealthStrip = ({ data }) => {
  if (!data) return null;
  
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-white border-b border-gray-100">
      <Tooltip text="Current brain scenario classification">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScenarioColor(data.brainScenario)}`}>
          <Brain className="inline w-4 h-4 mr-1" />
          {data.brainScenario}
        </span>
      </Tooltip>
      
      <Tooltip text="Risk posture: offensive (risk-on) or defensive (risk-off)">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPostureColor(data.metaPosture)}`}>
          <Target className="inline w-4 h-4 mr-1" />
          {data.metaPosture}
        </span>
      </Tooltip>
      
      <Tooltip text="Guard constraint level for risk management">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGuardColor(data.guard)}`}>
          <Shield className="inline w-4 h-4 mr-1" />
          {data.guard || 'NONE'}
        </span>
      </Tooltip>
      
      <Tooltip text="Capital scaling factor applied to risk budget">
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
          <Scale className="inline w-4 h-4 mr-1" />
          Scale: {(data.scaleFactor * 100).toFixed(1)}%
        </span>
      </Tooltip>
      
      <div className="flex-1" />
      
      <span className="text-xs text-gray-400">
        {data.systemGrade} • Hash: {data.determinismHash?.slice(0, 8)}
      </span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MACRO INPUTS GRID
// ═══════════════════════════════════════════════════════════════

const MacroIndicatorCard = ({ indicator }) => {
  const DirectionIcon = indicator.direction === 'up' ? TrendingUp : 
                        indicator.direction === 'down' ? TrendingDown : Minus;
  
  return (
    <Tooltip text={indicator.tooltip}>
      <div className="p-4 hover:bg-gray-50 transition-colors rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{indicator.title}</span>
          <DirectionIcon className={`w-4 h-4 ${getStatusColor(indicator.status)}`} />
        </div>
        <div className={`text-xl font-semibold ${getStatusColor(indicator.status)}`}>
          {indicator.value}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {indicator.explanation}
        </div>
      </div>
    </Tooltip>
  );
};

const MacroInputsGrid = ({ indicators }) => {
  if (!indicators || indicators.length === 0) return null;
  
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <Activity className="w-5 h-5 mr-2 text-gray-400" />
        Macro Indicators
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
        {indicators.map((ind) => (
          <MacroIndicatorCard key={ind.key} indicator={ind} />
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MACRO ENGINE SUMMARY
// ═══════════════════════════════════════════════════════════════

const MacroEngineSummary = ({ engine }) => {
  if (!engine) return null;
  
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <BarChart3 className="w-5 h-5 mr-2 text-gray-400" />
        Macro Engine Output
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tooltip text="Aggregated macro pressure score">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Macro Score</div>
            <div className={`text-2xl font-bold ${engine.scoreSigned >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {engine.scoreSigned >= 0 ? '+' : ''}{engine.scoreSigned?.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Confidence: {engine.confidence?.toFixed(0)}%
            </div>
          </div>
        </Tooltip>
        
        <Tooltip text="Current dominant macro regime">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Dominant Regime</div>
            <div className="text-xl font-semibold text-gray-800">
              {engine.dominantRegime}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Persistence: {engine.persistence}d
            </div>
          </div>
        </Tooltip>
        
        <Tooltip text="Top contributing macro factors">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Top Drivers</div>
            <div className="space-y-1">
              {(engine.topDrivers || []).slice(0, 3).map((d, i) => (
                <div key={i} className="text-sm flex items-center">
                  <span className={d.effect === '+' ? 'text-green-600' : 'text-red-600'}>
                    {d.effect}
                  </span>
                  <span className="ml-1 text-gray-700 truncate">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Tooltip>
        
        <Tooltip text="Regime stability measure">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">Stability</div>
            <div className="text-2xl font-bold text-gray-800">
              {(engine.stabilityScore * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Regime stability
            </div>
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TRANSMISSION MAP
// ═══════════════════════════════════════════════════════════════

const TransmissionMap = ({ transmission }) => {
  if (!transmission) return null;
  
  const channels = [
    transmission.inflationChannel,
    transmission.ratesChannel,
    transmission.flightToQualityChannel,
  ].filter(Boolean);
  
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <Layers className="w-5 h-5 mr-2 text-gray-400" />
        Macro → Market Transmission
      </h2>
      <div className="flex flex-col space-y-2">
        {channels.map((ch, i) => (
          <div key={i} className="flex items-center p-3 rounded-lg hover:bg-gray-50">
            <div className={`w-3 h-3 rounded-full mr-3 ${getStatusBg(ch.status)}`}>
              <div className={`w-3 h-3 rounded-full ${ch.status === 'warning' ? 'bg-orange-500' : ch.status === 'negative' ? 'bg-red-500' : 'bg-green-500'}`} />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-700">{ch.name}</div>
              <div className="text-sm text-gray-500">{ch.explanation}</div>
            </div>
            <div className="text-sm text-gray-400">
              {(ch.confidence * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// FORECAST BY HORIZON
// ═══════════════════════════════════════════════════════════════

const ForecastTable = ({ forecasts }) => {
  if (!forecasts || forecasts.length === 0) return null;
  
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <TrendingUp className="w-5 h-5 mr-2 text-gray-400" />
        Forecast by Horizon
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2 pr-4">Horizon</th>
              <th className="py-2 pr-4">Synthetic</th>
              <th className="py-2 pr-4">Replay</th>
              <th className="py-2 pr-4">Hybrid</th>
              <th className="py-2 pr-4">Macro Adj</th>
              <th className="py-2">Δ Macro</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((f) => (
              <tr key={f.horizon} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 pr-4 font-medium">{f.horizon}D</td>
                <td className={`py-3 pr-4 ${f.synthetic >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {f.synthetic >= 0 ? '+' : ''}{f.synthetic?.toFixed(1)}%
                </td>
                <td className={`py-3 pr-4 ${f.replay >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {f.replay >= 0 ? '+' : ''}{f.replay?.toFixed(1)}%
                </td>
                <td className={`py-3 pr-4 ${f.hybrid >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {f.hybrid >= 0 ? '+' : ''}{f.hybrid?.toFixed(1)}%
                </td>
                <td className={`py-3 pr-4 font-medium ${f.macroAdjusted >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {f.macroAdjusted >= 0 ? '+' : ''}{f.macroAdjusted?.toFixed(1)}%
                </td>
                <td className={`py-3 ${f.macroDelta >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {f.macroDelta >= 0 ? '+' : ''}{f.macroDelta?.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SCENARIO & RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════

const ScenarioRecommendations = ({ decision }) => {
  if (!decision) return null;
  
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <Brain className="w-5 h-5 mr-2 text-gray-400" />
        Scenario & Recommendations
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Probabilities */}
        <div className="space-y-4">
          <div className="text-sm text-gray-500 mb-2">Scenario Probabilities</div>
          {['BASE', 'RISK', 'TAIL'].map((s) => (
            <div key={s} className="flex items-center">
              <span className={`w-16 text-sm font-medium ${s === decision.currentScenario ? 'text-gray-900' : 'text-gray-500'}`}>
                {s}
              </span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${s === 'TAIL' ? 'bg-red-500' : s === 'RISK' ? 'bg-orange-500' : 'bg-gray-400'}`}
                  style={{ width: `${decision.scenarioProbs[s]}%` }}
                />
              </div>
              <span className="w-12 text-right text-sm text-gray-600">
                {decision.scenarioProbs[s]?.toFixed(0)}%
              </span>
            </div>
          ))}
          <div className="pt-2 text-sm">
            <span className="text-gray-500">Posture:</span>
            <span className={`ml-2 font-medium ${decision.posture === 'OFFENSIVE' ? 'text-green-600' : 'text-orange-600'}`}>
              {decision.posture}
            </span>
          </div>
        </div>
        
        {/* Right: Recommendations */}
        <div>
          <div className="text-sm text-gray-500 mb-2">Recommendations</div>
          <div className="space-y-2">
            {(decision.recommendations || []).map((rec, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-800">{rec.action}</div>
                <div className="text-sm text-gray-500 mt-1">{rec.reason}</div>
                <div className="flex gap-1 mt-2">
                  {(rec.tags || []).map((tag, j) => (
                    <span key={j} className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ALLOCATION PIPELINE
// ═══════════════════════════════════════════════════════════════

const AllocationPipeline = ({ pipeline }) => {
  if (!pipeline) return null;
  
  const formatAlloc = (a) => ({
    spx: ((a?.spx || 0) * 100).toFixed(1),
    btc: ((a?.btc || 0) * 100).toFixed(1),
    cash: ((a?.cash || 0) * 100).toFixed(1),
  });
  
  const base = formatAlloc(pipeline.base);
  const afterBrain = formatAlloc(pipeline.afterBrain);
  const final = formatAlloc(pipeline.final);
  
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <Layers className="w-5 h-5 mr-2 text-gray-400" />
        Allocation Pipeline
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Tooltip text="Base allocation before brain adjustments">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-2">Base</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">SPX</span>
                <span className="font-medium">{base.spx}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">BTC</span>
                <span className="font-medium">{base.btc}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cash</span>
                <span className="font-medium">{base.cash}%</span>
              </div>
            </div>
          </div>
        </Tooltip>
        
        <Tooltip text="After brain and meta-risk adjustments">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-2">After Brain</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">SPX</span>
                <span className="font-medium">{afterBrain.spx}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">BTC</span>
                <span className="font-medium">{afterBrain.btc}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cash</span>
                <span className="font-medium">{afterBrain.cash}%</span>
              </div>
            </div>
          </div>
        </Tooltip>
        
        <Tooltip text="Final allocation after optimizer and capital scaling">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-sm text-blue-600 mb-2 font-medium">Final</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">SPX</span>
                <span className="font-bold text-blue-700">{final.spx}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">BTC</span>
                <span className="font-bold text-blue-700">{final.btc}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cash</span>
                <span className="font-bold text-blue-700">{final.cash}%</span>
              </div>
            </div>
          </div>
        </Tooltip>
      </div>
      
      {/* Override Intensity */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-500 mb-2">Override Intensity Breakdown</div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>Brain: <span className="font-medium">{(pipeline.intensityBreakdown?.brain * 100 || 0).toFixed(1)}%</span></div>
          <div>MetaRisk: <span className="font-medium">{(pipeline.intensityBreakdown?.metaRiskScale * 100 || 0).toFixed(1)}%</span></div>
          <div>Optimizer: <span className="font-medium">{(pipeline.intensityBreakdown?.optimizer * 100 || 0).toFixed(1)}%</span></div>
          <div>CapitalScaling: <span className="font-medium">{(pipeline.intensityBreakdown?.capitalScaling * 100 || 0).toFixed(1)}%</span></div>
          <div className="font-semibold">Total: <span>{(pipeline.intensityBreakdown?.total * 100 || 0).toFixed(1)}%</span></div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CAPITAL SCALING BLOCK
// ═══════════════════════════════════════════════════════════════

const CapitalScalingBlock = ({ scaling }) => {
  if (!scaling) return null;
  
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <Scale className="w-5 h-5 mr-2 text-gray-400" />
        Capital Scaling (Risk Targeting)
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-600 mb-1">Scale Factor</div>
          <div className="text-3xl font-bold text-blue-700">
            {(scaling.scaleFactor * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600 mt-2">
            {scaling.explanation}
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-2">Drivers</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Vol Scale</span>
              <span className={scaling.volScale < 0.95 ? 'text-orange-600' : 'text-green-600'}>
                {(scaling.volScale * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tail Scale</span>
              <span className={scaling.tailScale < 0.9 ? 'text-red-600' : 'text-green-600'}>
                {(scaling.tailScale * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Regime Scale</span>
              <span>{(scaling.regimeScale * 100).toFixed(0)}%</span>
            </div>
            {scaling.guardAdjusted && (
              <div className="text-orange-600 font-medium">
                Guard constraint active
              </div>
            )}
          </div>
        </div>
      </div>
      
      {scaling.clampsApplied?.length > 0 && (
        <div className="mt-2 flex gap-2">
          {scaling.clampsApplied.map((c, i) => (
            <span key={i} className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// AUDIT BLOCK
// ═══════════════════════════════════════════════════════════════

const AuditBlock = ({ audit, meta }) => {
  if (!audit) return null;
  
  return (
    <div className="mb-8 p-4 bg-gray-50 rounded-lg">
      <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
        <Info className="w-4 h-4 mr-1" />
        Model Transparency
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-400">System Version</div>
          <div className="font-mono">{audit.systemVersion}</div>
        </div>
        <div>
          <div className="text-gray-400">Capital Scaling</div>
          <div className="font-mono">{audit.capitalScalingVersion}</div>
        </div>
        <div>
          <div className="text-gray-400">Data As Of</div>
          <div className="font-mono">{meta?.asOf}</div>
        </div>
        <div>
          <div className="text-gray-400">Hash</div>
          <div className="font-mono">{audit.inputsHash?.slice(0, 8)}</div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

const BrainOverviewPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const fetchData = async () => {
      try {
        if (isMounted) setLoading(true);
        
        const response = await fetch(`${API_URL}/api/ui/brain/overview`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (isMounted) {
          if (result.ok) {
            setData(result);
            setError(null);
          } else {
            setError(result.error || 'Failed to load data');
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMounted) {
          setError(err.message);
          console.error('[BrainOverview] Fetch error:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Refresh every 2 minutes (API takes ~10s)
    const interval = setInterval(fetchData, 120000);
    
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);
  
  // Show loading only on initial load
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" data-testid="brain-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-gray-500">Loading Brain Overview...</div>
          <div className="text-xs text-gray-400 mt-1">This may take up to 15 seconds</div>
        </div>
      </div>
    );
  }
  
  if (error && !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" data-testid="brain-error">
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading data</div>
          <div className="text-sm text-gray-500">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-white" data-testid="brain-overview-page">
      {/* Health Strip */}
      <HealthStrip data={data?.healthStrip} />
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Brain Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Institutional AI Macro Risk Dashboard • {data?.meta?.asOf}
          </p>
        </div>
        
        {/* Macro Inputs */}
        <MacroInputsGrid indicators={data?.macroInputs} />
        
        {/* Macro Engine */}
        <MacroEngineSummary engine={data?.macroEngine} />
        
        {/* Transmission */}
        <TransmissionMap transmission={data?.transmission} />
        
        {/* Forecast */}
        <ForecastTable forecasts={data?.forecastByHorizon} />
        
        {/* Scenario & Recommendations */}
        <ScenarioRecommendations decision={data?.brainDecision} />
        
        {/* Allocation Pipeline */}
        <AllocationPipeline pipeline={data?.allocationsPipeline} />
        
        {/* Capital Scaling */}
        <CapitalScalingBlock scaling={data?.capitalScaling} />
        
        {/* Audit */}
        <AuditBlock audit={data?.audit} meta={data?.meta} />
      </div>
    </div>
  );
};

export default BrainOverviewPage;
