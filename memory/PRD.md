# Fractal Index Platform PRD

## Original Problem Statement
Развёртывание проекта из GitHub репозитория https://github.com/solyankastayl-cyber/546fhgfh
- Модуль фракталов для валютных пар (DXY) - основной фокус разработки
- SPX и Bitcoin логика (в заморозке)
- Админка
- FRED API: 2c0bf55cfd182a3a4d2e4fd017a622f7

## Architecture
- **Backend**: TypeScript/Fastify (8002), Python proxy (8001)
- **Frontend**: React (3000)
- **Database**: MongoDB (fractal_platform)
- **External APIs**: FRED

## What's Been Implemented

### Session 8: Prediction History (2026-03-01)

#### ✅ Model Transparency Layer — Prediction Snapshots

**Principle**: "Модель не должна перестраиваться из-за цены"

**Implemented:**
1. **MongoDB Collection**: `prediction_snapshots`
   - Asset, view, horizonDays
   - asOf, asOfPrice, series (prediction points)
   - Confidence band (p10, p90)
   - Metadata: stance, confidence, quality, modelVersion
   - Hash for deduplication

2. **Snapshot Saving Logic** (no spam):
   - Save if stance changed
   - Save if |confidence_new - confidence_old| >= 10%
   - Save if series hash changed
   - Save if >= 24h elapsed (fallback)

3. **SVG Chart Component** (PredictionChart.jsx):
   - Real candles (black line)
   - Active prediction (colored by stance)
   - Archived predictions (gray, thin, faded)
   - NOW vertical line
   - Toggle "History" button
   - Legend

**Visual Rules:**
- Active: 2.5px, stance color, confidence band
- Archived: 1px, gray, 35% opacity, NO band
- Old predictions trimmed at next snapshot's asOf

**API Endpoints:**
```
GET /api/prediction/snapshots?asset=SPX&view=crossAsset&horizon=180
GET /api/market/candles?asset=SPX&limit=365
GET /api/prediction/stats
POST /api/prediction/snapshot (internal)
```

**Seeded Data:**
- SPX: 6 snapshots (6 months history)
- DXY: 4 snapshots
- BTC: 4 snapshots

### Session 7: Overview UI

- 8 UI Blocks: Verdict, Action, Reasons, Risks, Signal Stack, Pipeline, Horizon Table, Chart
- Cached latency: 672ms (60s TTL)
- Routes: /overview, /fractal/overview

### Session 6-7: L5 Final Audit

- **Grade: PRODUCTION** (100% PASS, 19/19 tests)
- Frequency Normalization: factor 0.48
- T10Y2Y reduced: 83% → 52%

## Test Results (Latest)

- Backend: 100%
- Frontend: 100% (after TypeScript syntax fixes)
- Prediction Snapshots: SPX 6, DXY 4, BTC 4
- Market Candles: SPX 365, DXY 365
- L5 Audit: healthy

## Files Created (Session 8)

**Backend:**
- `/app/backend/src/modules/prediction/prediction_snapshots.service.ts`
- `/app/backend/scripts/seed_snapshots.cjs`

**Frontend:**
- `/app/frontend/src/components/charts/PredictionChart.jsx`

**Modified:**
- `/app/frontend/src/pages/OverviewPage.jsx` — Added PredictionChart
- `/app/backend/src/modules/fractal/runtime/fractal.module.ts` — Registered routes

## Key Design Decisions

### Why NO auto-correction by price:
- Model recalculates only when: macro/cross-asset changes, new fractal found, pattern structure changed
- Price-driven correction would kill fractal independence

### Snapshot Storage:
- Each snapshot is immutable
- Old predictions fade to gray, not corrected
- Shows model adaptation honestly

## Prioritized Backlog

### P0 (Critical) - DONE ✅
- [x] L5 Final Audit (PRODUCTION)
- [x] Frequency Normalization
- [x] Overview UI (8 blocks)
- [x] Prediction History (snapshots + chart)

### P1 (High Priority)
- [ ] Admin panel testing
- [ ] Snapshot tooltip (hover for details)
- [ ] Live snapshot saving hook (post-compute)

### P2 (Medium Priority)
- [ ] BTC candles import
- [ ] Confidence band visualization
- [ ] More granular snapshot triggers

## Next Tasks

1. Admin panel testing
2. Hook snapshot saving into compute endpoints
3. Add tooltip for archived snapshots
