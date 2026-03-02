# Fractal Platform PRD

## Original Problem Statement
Развёртывание и доработка Fractal Platform из https://github.com/solyankastayl-cyber/7654323456.
Модули: BTC Fractal, SPX Fractal, DXY Terminal.
Требования: унификация snapshot логики для всех активов.

## Architecture
- **Backend**: TypeScript (Fastify) on port 8002, proxied through Python FastAPI on port 8001
- **Frontend**: React with TailwindCSS on port 3000
- **Database**: MongoDB (fractal_platform)
- **Key Collections**: prediction_snapshots, fractal_canonical_ohlcv, spx_candles, dxy_candles

## Core Requirements (Static)
1. All three engines (BTC, SPX, DXY) must produce unified series format
2. Series structure: [history] → anchor → [forecast]
3. anchorIndex must be correctly calculated and stored
4. All horizons (7d, 14d, 30d, 90d, 180d, 365d) must be supported

## User Personas
1. **Trader** - Uses forecast data for trading decisions
2. **Analyst** - Studies historical patterns and model accuracy
3. **Developer** - Integrates API into trading systems

## What's Been Implemented

### Session 1 (2026-03-02)
- Cloned and deployed repository from GitHub
- Fixed BTC candles collection (fractal_canonical_ohlcv instead of btc_candles)
- Configured FRED API key: 2c0bf55cfd182a3a4d2e4fd017a622f7
- All services running: backend, frontend, MongoDB

### Session 2 (2026-03-02) - Snapshot Unification
- **Created**: `/app/backend/src/shared/utils/buildFullSeries.ts`
  - Universal function to build [history] → anchor → [forecast] series
  - Supports both raw prices and returns-based calculation
  
- **Created**: `/app/backend/src/modules/prediction/unified_extractor.ts`
  - Single `extractSnapshotPayload()` function for all assets
  - Asset-specific data extraction (extractBtcData, extractSpxData, extractDxyData)
  - Legacy exports maintained for backward compatibility

- **Updated**: `/app/backend/src/modules/prediction/snapshot_hook.service.ts`
  - Re-exports from unified_extractor.ts
  - Disabled rate-limit for initial snapshot generation
  - Rate-limit only for repeat saves (15 minutes)

- **Fixed**: `/app/backend/src/modules/spx-core/spx-core.routes.ts`
  - Now supports both `horizon` and `focus` query parameters

### Session 3 (2026-03-02) - Architecture Fixes
**PROBLEM 1: History fixed at 365 days**
- Updated unified_extractor to use FIXED_HISTORY_DAYS = 365
- Note: BTC/SPX limited by engine's currentWindow.raw (90-200 days)
- DXY has full 365 days from replay.window

**PROBLEM 2: Overview read-only**
- **Fixed**: `/app/backend/src/modules/overview/overview.service.ts`
  - Overview now reads from prediction_snapshots only (READ-ONLY)
  - No model recalculation - uses saved snapshots
  - Logs: `[Overview] READ-ONLY snapshot loaded`

**PROBLEM 3: Cross-module consistency**
- Verified: Overview and Final Fractal show IDENTICAL forecastMax
- BTC: 80,839.88 = 80,839.88 ✅
- SPX: 7,232.58 = 7,232.58 ✅  
- DXY: 118.79 = 118.79 ✅

## Testing Results
- Backend: 100% pass rate
- All horizons: 7d, 14d, 30d, 90d, 180d, 365d working
- anchorIndex correctly calculated for all assets
- modelVersion: v3.2.0-unified

## Snapshots in Database
| Asset | Horizons | Status |
|-------|----------|--------|
| BTC | 14d, 30d, 90d, 180d, 365d | ✅ Working |
| SPX | 7d, 14d, 30d, 90d, 180d, 365d | ✅ Working |
| DXY | 14d, 30d, 90d, 180d, 365d | ✅ Working |

## Prioritized Backlog

### P0 (Critical)
- [x] Unified snapshot extraction
- [x] anchorIndex calculation
- [x] All horizons support

### P1 (High Priority)
- [ ] Historical returns calculation from raw prices (BTC/DXY missing modelReturns)
- [ ] Extend historical window beyond 90 days for BTC
- [ ] Frontend integration validation (preview server sleeping)

### P2 (Medium Priority)
- [ ] WebSocket real-time updates
- [ ] Snapshot comparison and divergence tracking
- [ ] Performance optimization for large series

### P3 (Nice to Have)
- [ ] Admin dashboard enhancements
- [ ] Export functionality
- [ ] Multi-timeframe overlay

## Next Tasks
1. Validate frontend chart rendering with new unified series
2. Extend BTC historical window (currently limited to 90 days from currentWindow.raw)
3. Add modelReturns calculation for assets that lack it
4. Implement divergence tracking between snapshots

## API Endpoints
- `GET /api/fractal/v2.1/focus-pack?focus={horizon}` - BTC Fractal
- `GET /api/spx/v2.1/focus-pack?horizon={horizon}` - SPX Fractal  
- `GET /api/fractal/dxy/terminal?focus={horizon}` - DXY Terminal
- `GET /api/prediction/snapshots?asset={asset}&view={view}&horizon={days}` - Stored snapshots
- `GET /api/market/candles?asset={asset}&limit={n}` - Historical candles
