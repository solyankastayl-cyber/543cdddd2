/**
 * PREDICTION CHART — Transparent Model History
 * 
 * Shows:
 * - Real candles (history up to NOW)
 * - Prediction Snapshots (archived = gray, active = colored)
 * - NOW vertical line
 * - Confidence band (only for active)
 * 
 * Principles:
 * - Old predictions are NOT corrected
 * - Each snapshot starts at its asOf point
 * - Older snapshots trimmed at next snapshot's asOf
 * - No smoothing, no magic
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Eye, EyeOff, Info } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const getStanceColor = (stance) => {
  switch (stance) {
    case 'BULLISH': return '#16a34a';
    case 'BEARISH': return '#dc2626';
    default: return '#111111';
  }
};

const formatDate = (iso) => {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatPrice = (price) => {
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ═══════════════════════════════════════════════════════════════
// MINI CHART RENDERER (SVG-based)
// ═══════════════════════════════════════════════════════════════

const defaultDimensions = {
  width: 800,
  height: 400,
  padding: { top: 20, right: 60, bottom: 40, left: 60 }
};

function scaleX(
  date,
  minDate,
  maxDate,
  width,
  padding
) {
  const d = new Date(date).getTime();
  const min = minDate.getTime();
  const max = maxDate.getTime();
  const range = max - min;
  if (range === 0) return padding.left;
  return padding.left + ((d - min) / range) * (width - padding.left - padding.right);
}

function scaleY(
  value,
  minValue,
  maxValue,
  height,
  padding
) {
  const range = maxValue - minValue;
  if (range === 0) return height / 2;
  return height - padding.bottom - ((value - minValue) / range) * (height - padding.top - padding.bottom);
}

// ═══════════════════════════════════════════════════════════════
// SVG CHART COMPONENT
// ═══════════════════════════════════════════════════════════════

const PredictionChartSVG = ({
  candles,
  snapshots,
  showHistory,
  dimensions = { width: 800, height: 400, padding: { top: 20, right: 60, bottom: 40, left: 60 } },
  onSnapshotHover = null
}) => {
  const { width, height, padding } = dimensions;
  
  // Sort snapshots newest first
  const sortedSnapshots = useMemo(() => {
    return [...snapshots].sort(
      (a, b) => new Date(b.asOf).getTime() - new Date(a.asOf).getTime()
    );
  }, [snapshots]);
  
  const activeSnapshot = sortedSnapshots[0];
  const archivedSnapshots = showHistory ? sortedSnapshots.slice(1) : [];
  
  // Calculate bounds
  const bounds = useMemo(() => {
    const allDates = [];
    const allValues = [];
    
    // Add candle data
    candles.forEach(c => {
      allDates.push(new Date(c.t));
      allValues.push(c.h, c.l);
    });
    
    // Add prediction data
    sortedSnapshots.forEach(snap => {
      snap.series.forEach(p => {
        allDates.push(new Date(p.t));
        allValues.push(p.v);
      });
    });
    
    if (allDates.length === 0 || allValues.length === 0) {
      return {
        minDate: new Date(),
        maxDate: new Date(),
        minValue: 0,
        maxValue: 100
      };
    }
    
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    
    // Add 5% padding to values
    const valueRange = maxValue - minValue;
    
    return {
      minDate,
      maxDate,
      minValue: minValue - valueRange * 0.05,
      maxValue: maxValue + valueRange * 0.05
    };
  }, [candles, sortedSnapshots]);
  
  // Generate candle path
  const candlePath = useMemo(() => {
    if (candles.length === 0) return '';
    
    const points = candles.map(c => {
      const x = scaleX(c.t, bounds.minDate, bounds.maxDate, width, padding);
      const y = scaleY(c.c, bounds.minValue, bounds.maxValue, height, padding);
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  }, [candles, bounds, width, height, padding]);
  
  // Generate prediction path
  const getPredictionPath = useCallback((
    series,
    endTime
  ) => {
    let filteredSeries = series;
    
    if (endTime) {
      const endDate = new Date(endTime);
      filteredSeries = series.filter(p => new Date(p.t) < endDate);
    }
    
    if (filteredSeries.length === 0) return '';
    
    const points = filteredSeries.map(p => {
      const x = scaleX(p.t, bounds.minDate, bounds.maxDate, width, padding);
      const y = scaleY(p.v, bounds.minValue, bounds.maxValue, height, padding);
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  }, [bounds, width, height, padding]);
  
  // NOW line position
  const nowX = activeSnapshot
    ? scaleX(activeSnapshot.asOf, bounds.minDate, bounds.maxDate, width, padding)
    : width - padding.right;
  
  // Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks = [];
    const range = bounds.maxValue - bounds.minValue;
    const step = range / 5;
    for (let i = 0; i <= 5; i++) {
      ticks.push(bounds.minValue + step * i);
    }
    return ticks;
  }, [bounds]);
  
  // X-axis ticks (dates)
  const xTicks = useMemo(() => {
    const ticks = [];
    const range = bounds.maxDate.getTime() - bounds.minDate.getTime();
    const step = range / 6;
    for (let i = 0; i <= 6; i++) {
      ticks.push(new Date(bounds.minDate.getTime() + step * i));
    }
    return ticks;
  }, [bounds]);
  
  return (
    <svg width={width} height={height} className="bg-white">
      {/* Grid lines */}
      <g className="grid-lines">
        {yTicks.map((tick, i) => {
          const y = scaleY(tick, bounds.minValue, bounds.maxValue, height, padding);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#f0f0f0"
                strokeWidth={1}
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="text-xs fill-gray-400"
              >
                {formatPrice(tick)}
              </text>
            </g>
          );
        })}
        
        {xTicks.map((tick, i) => {
          const x = scaleX(tick.toISOString(), bounds.minDate, bounds.maxDate, width, padding);
          return (
            <g key={i}>
              <line
                x1={x}
                y1={padding.top}
                x2={x}
                y2={height - padding.bottom}
                stroke="#f0f0f0"
                strokeWidth={1}
              />
              <text
                x={x}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs fill-gray-400"
              >
                {formatDate(tick.toISOString())}
              </text>
            </g>
          );
        })}
      </g>
      
      {/* Candle line (price history) */}
      {candlePath && (
        <path
          d={candlePath}
          fill="none"
          stroke="#000000"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      
      {/* NOW vertical line */}
      <line
        x1={nowX}
        y1={padding.top}
        x2={nowX}
        y2={height - padding.bottom}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth={1}
        strokeDasharray="4,4"
      />
      <text
        x={nowX}
        y={padding.top - 5}
        textAnchor="middle"
        className="text-xs fill-gray-500"
      >
        NOW
      </text>
      
      {/* Archived predictions (gray, thin) */}
      {archivedSnapshots.map((snap, index) => {
        const nextSnap = sortedSnapshots[index]; // newer snapshot
        const path = getPredictionPath(snap.series, nextSnap?.asOf);
        
        return path ? (
          <g key={snap.hash}>
            <path
              d={path}
              fill="none"
              stroke="rgba(120,120,120,0.35)"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => onSnapshotHover && onSnapshotHover(snap, nextSnap)}
              onMouseLeave={() => onSnapshotHover && onSnapshotHover(null, null)}
            />
            {/* Invisible wider path for easier hover */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={10}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => onSnapshotHover && onSnapshotHover(snap, nextSnap)}
              onMouseLeave={() => onSnapshotHover && onSnapshotHover(null, null)}
            />
          </g>
        ) : null;
      })}
      
      {/* Active prediction (colored, thick) */}
      {activeSnapshot && (
        <path
          d={getPredictionPath(activeSnapshot.series)}
          fill="none"
          stroke={getStanceColor(activeSnapshot.metadata.stance)}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      
      {/* Confidence band for active */}
      {activeSnapshot?.band && (
        <g opacity={0.15}>
          <path
            d={`${getPredictionPath(activeSnapshot.band.p90)} L ${getPredictionPath(activeSnapshot.band.p10).replace('M ', '').split(' L ').reverse().join(' L ')}`}
            fill={getStanceColor(activeSnapshot.metadata.stance)}
            stroke="none"
          />
        </g>
      )}
      
      {/* Legend */}
      <g transform={`translate(${width - padding.right - 150}, ${padding.top + 10})`}>
        <rect x={0} y={0} width={140} height={showHistory ? 80 : 50} fill="white" stroke="#e5e5e5" rx={4} />
        
        <line x1={10} y1={20} x2={30} y2={20} stroke="#000" strokeWidth={2} />
        <text x={35} y={24} className="text-xs fill-gray-700">Price</text>
        
        {activeSnapshot && (
          <>
            <line x1={10} y1={40} x2={30} y2={40} stroke={getStanceColor(activeSnapshot.metadata.stance)} strokeWidth={2.5} />
            <text x={35} y={44} className="text-xs fill-gray-700">Active Forecast</text>
          </>
        )}
        
        {showHistory && archivedSnapshots.length > 0 && (
          <>
            <line x1={10} y1={60} x2={30} y2={60} stroke="rgba(120,120,120,0.5)" strokeWidth={1} />
            <text x={35} y={64} className="text-xs fill-gray-500">History ({archivedSnapshots.length})</text>
          </>
        )}
      </g>
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export const PredictionChart = ({
  asset = 'SPX',
  view = 'crossAsset',
  horizonDays = 180
}) => {
  const [candles, setCandles] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(true);
  const [hoveredSnapshot, setHoveredSnapshot] = useState(null);
  const [nextSnapshot, setNextSnapshot] = useState(null);
  
  const handleSnapshotHover = (snap, next) => {
    setHoveredSnapshot(snap);
    setNextSnapshot(next);
  };
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch candles and snapshots in parallel
      const [candlesRes, snapshotsRes] = await Promise.all([
        fetch(`${API_URL}/api/market/candles?asset=${asset}&limit=365`),
        fetch(`${API_URL}/api/prediction/snapshots?asset=${asset}&view=${view}&horizon=${horizonDays}&limit=12`)
      ]);
      
      const candlesData = await candlesRes.json();
      const snapshotsData = await snapshotsRes.json();
      
      if (candlesData.ok && candlesData.candles) {
        setCandles(candlesData.candles);
      }
      
      if (snapshotsData.ok && snapshotsData.snapshots) {
        setSnapshots(snapshotsData.snapshots);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [asset, view, horizonDays]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const activeSnapshot = snapshots[0];
  
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">Prediction History</h3>
          <p className="text-sm text-gray-500">
            {asset} • {view} • {horizonDays}d horizon
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Toggle History */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showHistory 
                ? 'bg-gray-900 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {showHistory ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            History
          </button>
          
          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Active Snapshot Info */}
      {activeSnapshot && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
          <div>
            <span className="text-xs text-gray-500">Stance</span>
            <div className={`font-semibold ${
              activeSnapshot.metadata.stance === 'BULLISH' ? 'text-emerald-600' :
              activeSnapshot.metadata.stance === 'BEARISH' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {activeSnapshot.metadata.stance}
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Confidence</span>
            <div className="font-semibold text-gray-800">
              {Math.round(activeSnapshot.metadata.confidence * 100)}%
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500">As Of</span>
            <div className="font-semibold text-gray-800">
              {formatDate(activeSnapshot.asOf)}
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Version</span>
            <div className="font-semibold text-gray-800">
              {activeSnapshot.metadata.modelVersion}
            </div>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      
      {/* Loading State */}
      {loading && candles.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      )}
      
      {/* Chart */}
      {!loading && candles.length > 0 && (
        <div className="relative">
          <PredictionChartSVG
            candles={candles}
            snapshots={snapshots}
            showHistory={showHistory}
            dimensions={{ width: 800, height: 400, padding: { top: 30, right: 170, bottom: 50, left: 70 } }}
            onSnapshotHover={handleSnapshotHover}
          />
          
          {/* Hover Tooltip */}
          {hoveredSnapshot && (
            <div className="absolute top-4 left-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 w-64">
              <div className="text-xs font-medium text-gray-500 mb-2">Historical Forecast</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Created:</span>
                  <div className="font-medium">{formatDate(hoveredSnapshot.createdAt || hoveredSnapshot.asOf)}</div>
                </div>
                <div>
                  <span className="text-gray-500">As Of:</span>
                  <div className="font-medium">{formatDate(hoveredSnapshot.asOf)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Stance:</span>
                  <div className={`font-medium ${
                    hoveredSnapshot.metadata?.stance === 'BULLISH' ? 'text-emerald-600' :
                    hoveredSnapshot.metadata?.stance === 'BEARISH' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {hoveredSnapshot.metadata?.stance || 'HOLD'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Confidence:</span>
                  <div className="font-medium">{Math.round((hoveredSnapshot.metadata?.confidence || 0.5) * 100)}%</div>
                </div>
              </div>
              {nextSnapshot && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                  Active until: {formatDate(nextSnapshot.asOf)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* No Data */}
      {!loading && candles.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Info className="w-8 h-8 mb-2" />
          <p>No candle data available for {asset}</p>
        </div>
      )}
      
      {/* History Info */}
      {showHistory && snapshots.length > 1 && (
        <div className="mt-4 text-xs text-gray-400">
          Showing {snapshots.length} prediction snapshots. Gray lines = past predictions (not corrected). 
          Each snapshot starts at its calculation date.
        </div>
      )}
    </div>
  );
};

export default PredictionChart;
