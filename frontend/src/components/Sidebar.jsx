/**
 * Sidebar Navigation — FOMO Platform
 * 
 * FINAL ARCHITECTURE v3
 * 
 * HIERARCHY:
 * - FOMO AI = Product verdict (one screen, asset selector)
 * - On-chain = On-chain objects (tokens, wallets, entities)
 * - Attribution = Graph & relationships
 * - Signals = What to act on
 * - Social = Twitter/sentiment (NOT touched)
 * - Exchange = Analytics + Labs (instruments)
 * - Intelligence = Brain/ML/Control (admin level)
 * 
 * RULES:
 * - FOMO AI: NO sub-tabs per asset
 * - Exchange: Dashboard, Market, Signals, Research, Labs
 * - Intelligence: Dashboard, MLOps, Meta-Brain, On-chain Validation
 * - Social/Sentiment: NOT modified (legacy)
 */

import { Link, useLocation } from 'react-router-dom';
import { Wallet, ChevronDown, ChevronRight, Lock, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { 
  IconInfluencer, 
  IconNetwork, 
  IconCluster, 
  IconAltSeason, 
  IconLifecycle, 
  IconNarratives, 
  IconRadar, 
  IconTrophy, 
  IconFund, 
  IconOverlapFarm, 
  IconStrategy 
} from './icons/FomoIcons';
import { FEATURE_FLAGS } from '../config/feature-flags';

export function Sidebar({ globalState }) {
  const location = useLocation();
  
  // Navigation structure — FINAL ARCHITECTURE v3
  const navGroups = [
    // ═══════════════════════════════════════════════════════════════
    // PREDICTION — Main Intelligence Engine (HERO PAGE)
    // Multi-horizon verdict with explainable AI and rankings
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'prediction',
      label: 'Prediction',
      icon: '🎯',
      path: '/intelligence/price-expectation-v2',  // Direct link to main prediction page
      badge: 'NEW',
      badgeColor: 'bg-gradient-to-r from-green-500 to-emerald-500',
    },
    
    // ═══════════════════════════════════════════════════════════════
    // FOMO AI — Product Verdict (ONE SCREEN, asset selector inside)
    // NO sub-tabs per asset!
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'fomo-ai',
      label: 'FOMO AI',
      icon: '🚀',
      path: '/fomo-ai',  // Direct link, no children
      badge: 'LIVE',
      badgeColor: 'bg-gradient-to-r from-blue-500 to-purple-500',
    },
    
    // ═══════════════════════════════════════════════════════════════
    // FRACTAL — Historical Pattern Analysis Engine (V2.1)
    // Multi-horizon pattern matching with institutional governance
    // 3-page structure: /fractal (BTC), /fractal/spx, /combined
    // DXY is BACKEND-ONLY until UI START signal
    // Combined is LOCKED until SPX finalization
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'fractal',
      label: 'Fractal',
      icon: '📐',
      badge: 'NEW',
      badgeColor: 'bg-gradient-to-r from-amber-500 to-orange-500',
      children: [
        { path: '/fractal/btc', label: 'Bitcoin', icon: '₿' },
        { path: '/fractal/spx', label: 'SPX', icon: '📊' },
        { path: '/fractal/dxy', label: 'DXY', icon: '💵' },
        { path: '/brain', label: 'Macro Brain', icon: '🧠', badge: 'NEW' },
        { path: '/overview', label: 'Overview', icon: '🎯', badge: 'NEW' },
      ],
    },
    
    // ═══════════════════════════════════════════════════════════════
    // ON-CHAIN — On-chain objects (tokens, wallets, entities)
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'onchain',
      label: 'On-chain',
      icon: '🔗',
      children: [
        { path: '/market', label: 'Overview', icon: '📈' },
        { path: '/tokens', label: 'Tokens', icon: '🪙' },
        { path: '/wallets', label: 'Wallets', icon: '👛' },
        { path: '/entities', label: 'Entities', icon: '🏢' },
      ],
    },
    
    // ═══════════════════════════════════════════════════════════════
    // ATTRIBUTION — Graph & relationships
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'attribution',
      label: 'Attribution',
      icon: '🕸️',
      children: [
        { path: '/actors/correlation', label: 'Graph', icon: '🔗' },
        { path: '/actors', label: 'Actors', icon: '👤' },
      ],
    },
    
    // ═══════════════════════════════════════════════════════════════
    // SIGNALS — What to act on
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'signals',
      label: 'Signals',
      icon: '📡',
      children: [
        { path: '/signals', label: 'Live Signals', icon: '⚡' },
        { path: '/rankings', label: 'Rankings', icon: '🏆' },
        { path: '/engine', label: 'Engine', icon: '⚙️' },
      ],
    },
    
    // ═══════════════════════════════════════════════════════════════
    // SOCIAL — Twitter, sentiment (NOT MODIFIED - legacy)
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'social',
      label: 'Social',
      icon: '🐦',
      children: [
        { path: '/dashboard/parser', label: 'Parser', icon: '🔧' },
        { path: '/dashboard/twitter', label: 'Accounts', icon: '👥' },
        { path: '/sentiment/twitter', label: 'Feed', icon: '📱' },
        { path: '/sentiment/twitter-ai', label: 'AI Analysis', icon: '🤖' },
        { path: '/sentiment', label: 'Sentiment', icon: '🎭' },
      ],
    },
    
    // ═══════════════════════════════════════════════════════════════
    // CONNECTIONS — Isolated Intelligence Layer (OSINT Dashboard)
    // Network graph, clusters, capital flow, influence scoring
    // NOTE: Does NOT affect verdict, forecast, confidence, or retrain
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'connections',
      label: 'Connections',
      icon: '🔗',
      children: [
        { path: '/connections/influencers', label: 'Influencers', IconComponent: IconInfluencer },
        { path: '/connections/graph', label: 'Graph', IconComponent: IconNetwork },
        { path: '/connections/clusters', label: 'Clusters', IconComponent: IconCluster },
        { path: '/connections/alt-season', label: 'Alt Season', IconComponent: IconAltSeason },
        { path: '/connections/lifecycle', label: 'Lifecycle', IconComponent: IconLifecycle },
        { path: '/connections/narratives', label: 'Narratives', IconComponent: IconNarratives },
        { path: '/connections/radar', label: 'Radar', IconComponent: IconRadar },
        { path: '/connections/reality', label: 'Reality', IconComponent: IconTrophy },
        { path: '/connections/backers', label: 'Backers', IconComponent: IconFund },
        { path: '/connections/farm-network', label: 'Farm Network', IconComponent: IconOverlapFarm },
        { path: '/connections/strategy-simulation', label: 'Strategy Sim', IconComponent: IconStrategy },
      ]
    },
    
    // ═══════════════════════════════════════════════════════════════
    // EXCHANGE — Analytics + Instruments (Labs returned!)
    // 
    // Structure:
    // - Dashboard: Market state overview
    // - Market: Price, volume, OI, funding
    // - Signals: Raw exchange signals
    // - Research: Interpretations/hypotheses
    // - Labs: Individual analysis tools (RCA, Volume, Whale, etc.)
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'exchange',
      label: 'Exchange',
      icon: '🏦',
      children: [
        { path: '/exchange', label: 'Dashboard', icon: '🏠' },
        { path: '/exchange/markets', label: 'Market', icon: '📈' },
        { path: '/exchange/alt-radar', label: 'Alt Radar', icon: '📡', badge: 'NEW' },
        { path: '/exchange/signals', label: 'Signals', icon: '⚡' },
        { path: '/exchange/research', label: 'Research', icon: '🔬' },
        { path: '/exchange/labs', label: 'Labs', icon: '🧪' },
        { path: '/exchange/labs/macro-regime', label: 'Macro Regime', icon: '🌍' },
      ],
    },
    
    // ═══════════════════════════════════════════════════════════════
    // INTELLIGENCE — Brain/ML/Control (Admin level)
    // 
    // Cleaned:
    // ✅ Dashboard - system health
    // ✅ MLOps - model lifecycle
    // ✅ Meta-Brain - decision logic
    // ✅ On-chain Validation - validation layer
    // ❌ Price vs Expectation - MOVED TO TOP LEVEL as "Prediction"
    // ❌ Sentiment Engine - removed (duplicate of Social)
    // ❌ Observation Model - removed (stub)
    // ❌ Fractal - MOVED TO TOP LEVEL as main tab
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'intelligence',
      label: 'Intelligence',
      icon: '🧠',
      children: [
        { path: '/intelligence/dashboard', label: 'Dashboard', icon: '🏠' },
        { path: '/intelligence/mlops/promotion', label: 'Promotion', icon: '🚀' },
        { path: '/intelligence/metabrain', label: 'Meta-Brain', icon: '🧠' },
        { path: '/intelligence/onchain', label: 'Validation', icon: '🔗' },
      ],
    },
    
  ];

  // Find which group contains current path
  const findActiveGroup = () => {
    // Root path "/" should not expand any group
    if (location.pathname === '/') return null;
    
    for (const group of navGroups) {
      // Direct link groups (like FOMO AI)
      if (group.path && location.pathname.startsWith(group.path)) {
        return group.id;
      }
      // Groups with children
      if (group.children?.some(child => location.pathname === child.path)) {
        return group.id;
      }
    }
    return null;
  };

  // Start with no groups expanded
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const active = findActiveGroup();
    return active ? [active] : [];
  });

  // Update expanded groups when route changes
  useEffect(() => {
    const active = findActiveGroup();
    if (active && !expandedGroups.includes(active)) {
      setExpandedGroups(prev => [...prev, active]);
    }
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;
  
  const isGroupActive = (group) => {
    // Direct link groups
    if (group.path) {
      return location.pathname.startsWith(group.path);
    }
    // Groups with children
    return group.children?.some(child => location.pathname === child.path);
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  return (
    <aside className="w-56 bg-gray-900 text-white min-h-screen flex flex-col overflow-y-auto">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <Link to="/" className="flex items-center">
          <img 
            src="/assets/logo.svg" 
            alt="FOMO" 
            className="h-7 w-auto"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navGroups.map((group) => {
          const isExpanded = expandedGroups.includes(group.id);
          const hasActiveChild = isGroupActive(group);
          const hasChildren = group.children && group.children.length > 0;
          
          // Direct link item (no children) - like FOMO AI
          if (group.path && !hasChildren) {
            return (
              <Link
                key={group.id}
                to={group.path}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  hasActiveChild
                    ? 'bg-blue-600/20 text-blue-400 font-medium'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{group.icon}</span>
                  <span>{group.label}</span>
                  {group.badge && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      group.badge === 'LIVE' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {group.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          }
          
          // Group with children
          return (
            <div key={group.id} className="mb-1">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  hasActiveChild
                    ? 'bg-gray-800 text-white font-medium'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{group.icon}</span>
                  <span>{group.label}</span>
                  {group.badge && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      group.badgeColor ? `${group.badgeColor} text-white` : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {group.badge}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              
              {/* Children */}
              {isExpanded && hasChildren && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-700/50 pl-3">
                  {group.children.map((child) => (
                    child.stub ? (
                      // Stub item (Coming Soon)
                      <div
                        key={child.path}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded text-sm text-gray-600 cursor-not-allowed"
                        title="Coming Soon"
                      >
                        <span className="text-xs opacity-50">{child.icon}</span>
                        <span>{child.label}</span>
                        <Lock className="w-3 h-3 ml-auto opacity-40" />
                      </div>
                    ) : child.locked ? (
                      // Locked item (Feature locked)
                      <Link
                        key={child.path}
                        to={child.path}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded text-sm text-gray-500 hover:bg-gray-800/30 transition-colors"
                        title={child.lockReason || 'Locked'}
                      >
                        <span className="text-xs opacity-50">{child.icon}</span>
                        <span className="opacity-70">{child.label}</span>
                        <Lock className="w-3 h-3 ml-auto text-amber-500/60" />
                      </Link>
                    ) : (
                      // Active item
                      <Link
                        key={child.path}
                        to={child.path}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-sm transition-colors ${
                          isActive(child.path)
                            ? 'bg-blue-600/20 text-blue-400 font-medium'
                            : 'text-gray-400 hover:bg-gray-800/40 hover:text-white'
                        }`}
                      >
                        {child.IconComponent ? (
                          <child.IconComponent className="w-4 h-4 opacity-70" />
                        ) : (
                          <span className="text-xs opacity-70">{child.icon}</span>
                        )}
                        <span>{child.label}</span>
                        {child.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-400 ml-auto">
                            {child.badge}
                          </span>
                        )}
                      </Link>
                    )
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Connect Wallet */}
      <div className="p-4 border-t border-gray-800 mt-auto">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-bold transition-all shadow-lg">
          <Wallet className="w-4 h-4" />
          <span>Connect</span>
        </button>
      </div>
    </aside>
  );
}
