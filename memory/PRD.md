# Fractal Platform PRD

## Original Problem Statement
Развернуть код из GitHub репозитория (https://github.com/solyankastayl-cyber/245678vgh). Проект включает:
- BTC Fractal (индекс биткоина)
- SPX Fractal (S&P 500)
- DXY Fractal (Dollar Index с Macro Overlay)
- Macro Brain
- Overview page
- Admin Panel

FRED API Key: 2c0bf55cfd182a3a4d2e4fd017a622f7

## Architecture
- **Backend**: TypeScript (Fastify) на порту 8002 + Python proxy на порту 8001
- **Frontend**: React с Tailwind CSS
- **Database**: MongoDB
- **Data Sources**: FRED API (macro data), Bitstamp/Kraken (BTC), Yahoo Finance (SPX)

## User Personas
1. **Trader** - использует прогнозы для принятия торговых решений
2. **Analyst** - изучает паттерны и фракталы на рынках
3. **Admin** - управляет системой через админ-панель

## Core Requirements (Static)
1. Фракталный анализ для BTC, SPX, DXY
2. Prediction snapshots с историей
3. Auto-save hook для terminal endpoints
4. Macro overlay для DXY
5. Cross-Asset режим для SPX
6. Overview dashboard с вердиктами

## What's Been Implemented

### 2026-03-01 (Initial Deployment)
- [x] Клонирован и развёрнут репозиторий
- [x] Настроены .env файлы (FRED_API_KEY, MONGO_URL)
- [x] Установлены все зависимости (npm, yarn)
- [x] Запущены backend и frontend через supervisor
- [x] Все fractal endpoints работают:
  - `/api/fractal/dxy/terminal` - DXY с Macro overlay
  - `/api/spx/v2.1/focus-pack` - SPX analysis
  - `/api/fractal/v2.1/focus-pack` - BTC analysis
- [x] Prediction snapshot hook уже врезан в:
  - DXY terminal route
  - SPX core routes
  - BTC focus routes
- [x] Frontend страницы работают:
  - `/fractal/btc` - BTC Fractal (NEUTRAL)
  - `/fractal/spx` - SPX Fractal (BULLISH +2.41%)
  - `/fractal/dxy` - DXY Fractal (BEARISH USD -5.77%)
  - `/overview` - Market Overview
  - `/admin` - Admin Panel (login)

### 2026-03-01 (Overview Refactor)
- [x] **LivePredictionChart** — новый компонент с lightweight-charts v5
  - OHLC свечи (реальные, не линия)
  - 65vh высота, full-width
  - zoom/scroll/crosshair
  - NO vertical NOW line
- [x] **Overview Page** полностью переделан:
  - Asset switcher вверху (SPX/BTC/DXY)
  - Horizon switcher (7/14/30/90/180/365d)
  - Большой график как главный элемент
  - Verdict block под графиком
  - Drivers/Risks compact grid
  - Signal Stack collapsible
- [x] **Prediction Overlay**:
  - Active prediction — solid line
  - Archived predictions — gray dashed, trimmed by next.asOf
  - History toggle button

### Snapshot Hook Implementation Status
- [x] `snapshot_hook.service.ts` - полностью реализован
- [x] Smart save conditions (stance change, confidence delta >2%, series delta >0.35%)
- [x] Rate limiting (15 min per key)
- [x] Heartbeat fallback (24h)
- [x] DXY terminal hook integration
- [x] SPX core routes hook integration
- [x] BTC focus routes hook integration

### PredictionChart Component Status
- [x] Trim logic для archived snapshots
- [x] Hover tooltip для historical forecasts
- [x] NOW vertical line
- [x] Active vs Archived styling

## Prioritized Backlog

### P0 (Critical)
- Нет критических задач

### P1 (High)
- [ ] Overview page - ускорить загрузку данных
- [ ] WebSocket reconnection logic (не критично, но желательно)

### P2 (Medium)
- [ ] Расширить tooltip информацией о Median projection vs actual
- [ ] Добавить hash в UI для аудита моделей
- [ ] Parents linking для crossAsset snapshots (dxySnapshotId, spxHybridSnapshotId)

### P3 (Low/Future)
- [ ] Export predictions to CSV
- [ ] Email alerts при смене stance
- [ ] Mobile-optimized views

## Next Tasks
1. Протестировать полный flow prediction history на фронте
2. Добавить seed data для демонстрации history функционала
3. Оптимизировать Overview page loading
