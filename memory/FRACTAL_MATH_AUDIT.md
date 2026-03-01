# FRACTAL PLATFORM — ПОЛНЫЙ АУДИТ МАТЕМАТИКИ

**Дата аудита:** 2026-03-01  
**Версия:** v2.1  
**Статус:** Production

---

## L2/L3 AUDIT RESULTS (Automated)

| Asset | Grade | Overall Score | Invariant Tests | Consistency | Stress |
|-------|-------|--------------|-----------------|-------------|--------|
| BTC   | **A** | 91%          | 9/9 ✅          | 70%         | 100%   |
| SPX   | **A** | 100%         | 9/9 ✅          | 100%        | 100%   |
| DXY   | **A** | 100%         | 9/9 ✅          | 100%        | 100%   |

### Passed Invariant Tests (All Assets):
1. ✅ Scale Invariance (returns ×2)
2. ✅ Shift Invariance (price + C)
3. ✅ No NaN / Infinite Values
4. ✅ Bounded Outputs
5. ✅ Overlay Neutrality (β=0)
6. ✅ Overlay Neutrality (g=0)
7. ✅ Overlay Neutrality (w=0)
8. ✅ Overlay Monotonicity
9. ✅ Overlay Bounded Impact

### API Endpoints:
```
GET /api/audit/invariants/:asset  - Run 9 invariant tests
GET /api/audit/consistency/:asset - Run horizon consistency check
GET /api/audit/stress/:asset      - Run stress tests (vol sensitivity)
GET /api/audit/full/:asset        - Run full audit suite with grade
```

---

## СОДЕРЖАНИЕ
1. [BTC Fractal Terminal](#1-btc-fractal-terminal)
2. [SPX Fractal Terminal](#2-spx-fractal-terminal)
3. [DXY Fractal Terminal](#3-dxy-fractal-terminal)
4. [Общие компоненты](#4-общие-компоненты)
5. [Выявленные проблемы](#5-выявленные-проблемы)
6. [Рекомендации](#6-рекомендации)

---

## 1. BTC FRACTAL TERMINAL

### 1.1 SYNTHETIC Mode

**Источник:** `/modules/fractal/engine/similarity.engine.ts`

**Алгоритм:**
1. **Извлечение log-returns:**
```
r[i] = ln(close[i] / close[i-1])
```

2. **Нормализация (два режима):**
   - **raw_returns** (asOf-safe): Только L2 normalize
   - **zscore**: Z-score + L2 normalize

3. **Z-Score нормализация:**
```
mean = Σr[i] / n
std = √(Σ(r[i] - mean)² / (n-1))
z[i] = (r[i] - mean) / std
```

4. **L2 Нормализация (unit vector):**
```
||v|| = √(Σv[i]²)
v_norm[i] = v[i] / ||v||
```

5. **Cosine Similarity:**
```
score = (cur · hist) / (||cur|| × ||hist|| + ε)
где ε = 1e-12
```

**Параметры:**
- Window sizes: 30, 60, 90 дней
- Top-K matches: по умолчанию 20
- MIN_GAP_DAYS: минимальный разрыв между текущим и историческим окном

---

### 1.2 REPLAY Mode

**Источник:** `/modules/fractal/replay/replay-pack.builder.ts`

**Алгоритм:**
1. Берём выбранный исторический match
2. Строим replay path из aftermath (что было после match)
3. Нормализуем к anchor price текущей точки

**Формула Replay Path:**
```
replayPrice[i] = anchorPrice × (histAftermath[i] / histAnchor)
```

**Outcomes:**
- Horizons: 7d, 14d, 30d, 90d, 180d, 365d
- Return: `(endPrice - startPrice) / startPrice`
- Max Drawdown: `max((peak - price) / peak)` за период

---

### 1.3 HYBRID Mode

**Источник:** `/modules/fractal/focus/focus.types.ts` + UI logic

**Алгоритм:**
```
hybrid = (synthetic × wS) + (replay × wR)
```

Где обычно:
- wS = 0.5 (вес синтетик)
- wR = 0.5 (вес replay)

**Adaptive weights** (если включено):
- При высокой divergence между synthetic и replay → снижаем wR
- При низком sample size → увеличиваем wS

---

### 1.4 BTC ∧ SPX (Cross-Asset Overlay)

**Источник:** `/modules/btc-overlay/btc_overlay.service.ts`

**Основная формула:**
```
R_adj = R_btc + g × w × β × R_spx
```

Где:
- **R_btc** — базовый BTC Hybrid return
- **R_spx** — SPX forecast return
- **β** — бета (коэффициент чувствительности BTC к SPX)
- **ρ (rho)** — корреляция BTC/SPX
- **w** — overlay weight = |ρ| × corrStability × quality
- **g** — guard (снижение при regime conflict)

**Расчёт Beta:**
```
β = Cov(BTC, SPX) / Var(SPX)
```

**Расчёт Correlation:**
```
ρ = Cov(BTC, SPX) / (σ_BTC × σ_SPX)
```

**Correlation Stability:**
```
Рассчитываем rolling correlations (30-дневные окна)
corrStability = max(0, 1 - std(rollingCorrs))
```

**Guard Logic:**
```
gate = clamp(1 - corrStability, 0, 1)
level = BLOCKED if gate >= 0.7
      = WARNING if gate >= 0.4
      = OK otherwise
applied = 1 - gate
```

**Итоговый adjusted return:**
```
impact = g × w × β × R_spx
final = clamp(R_btc + impact, -maxImpact, +maxImpact)
```

---

## 2. SPX FRACTAL TERMINAL

### 2.1 SYNTHETIC Mode

**Источник:** `/modules/spx-core/spx.engine.ts`

**Нормализация окна:**
```
normalized[i] = (close[i] - close[0]) / close[0] × 100
```
(в отличие от BTC, тут используется процентное изменение от начала окна)

**Similarity (Pearson Correlation):**
```
meanA = Σa[i] / n
meanB = Σb[i] / n
num = Σ(a[i] - meanA)(b[i] - meanB)
den = √(Σ(a[i]-meanA)² × Σ(b[i]-meanB)²)
correlation = num / den
similarity = (correlation + 1) × 50  // Scale to 0-100
```

**Пороги:**
- Match threshold: similarity > 60

---

### 2.2 PHASE Detection

**Источник:** `/modules/spx-core/spx.engine.ts` → `detectPhase()`

**Индикаторы:**
- SMA50, SMA200
- Momentum (20-day ROC)

**Фазы:**
| Фаза | Условие |
|------|---------|
| MARKUP | price > SMA50 && price > SMA200 && momentum > 2% |
| MARKDOWN | price < SMA50 && price < SMA200 && momentum < -2% |
| DISTRIBUTION | price > SMA200 && -1% < momentum < 1% |
| ACCUMULATION | price < SMA200 && -1% < momentum < 1% |
| NEUTRAL | else |

---

### 2.3 REPLAY Mode

Аналогичен BTC — берём aftermath выбранного match и проецируем на текущую цену.

---

### 2.4 HYBRID Mode

```
hybrid = (synthetic + replay) / 2
```
Плюс взвешивание по tier horizons:

**Horizon Weights:**
| Horizon | Days | Weight | Tier |
|---------|------|--------|------|
| 7d | 7 | 0.05 | 3 |
| 14d | 14 | 0.10 | 3 |
| 30d | 30 | 0.20 | 2 |
| 90d | 90 | 0.25 | 1 |
| 180d | 180 | 0.25 | 1 |
| 365d | 365 | 0.15 | 1 |

---

### 2.5 Cross-Asset Mode (SPX → другие активы)

**Consensus Engine:**
```
weightedScore = Σ(direction × confidence × weight)
finalScore = weightedScore / totalWeight × 100
```

Где direction:
- BULLISH = +1
- BEARISH = -1  
- NEUTRAL = 0

**Direction Determination:**
```
avgOutcome = Σmatches.outcome / n
direction = BULLISH if avgOutcome > 1%
          = BEARISH if avgOutcome < -1%
          = NEUTRAL otherwise
```

---

## 3. DXY FRACTAL TERMINAL

### 3.1 SYNTHETIC Mode

**Источник:** `/modules/dxy/` + `/modules/fractal/engine/`

Использует тот же FractalEngine что и BTC:
- Log returns
- Z-score normalization
- Cosine similarity

---

### 3.2 REPLAY Mode

Аналогичен BTC/SPX — проекция aftermath.

---

### 3.3 HYBRID Mode

```
hybrid = synthetic × 0.5 + replay × 0.5
```

---

### 3.4 MACRO Mode (DXY-специфичный)

**Источник:** `/modules/dxy-macro-core/services/macro_score.service.ts`

**Composite Macro Score:**
```
MacroScore = Σ(component × weight) / Σweight
```

**Веса по ролям (оптимизированы по корреляции с DXY):**
| Роль | Weight | Причина |
|------|--------|---------|
| curve (T10Y2Y) | 0.250 | Сильнейший предиктор (corr=-0.1241) |
| rates (FEDFUNDS) | 0.133 | corr=+0.0664 |
| labor (UNRATE) | 0.124 | corr=-0.0615 |
| inflation | 0.113 | CPI+PPI combined |
| liquidity (M2SL) | 0.091 | corr=+0.0454 |
| growth | 0.024 | Minor |

**Дополнительные компоненты:**
| Компонент | Weight | Серии |
|-----------|--------|-------|
| HOUSING | 0.12 | MORTGAGE30US, HOUST, PERMIT, CSUSHPISA |
| ACTIVITY | 0.12 | MANEMP, INDPRO, TCU |
| CREDIT | 0.12 | BAA10Y, TEDRATE, VIXCLS |
| LIQUIDITY_ENGINE | 0.20 | WALCL, RRP, TGA (Fed balance sheet) |

**Формула Liquidity Impact:**
```
scoreSigned = -impulse / 3
// Positive impulse (expansion) → negative score (USD bearish)
// Negative impulse (contraction) → positive score (USD bullish)
```

**Финальный прогноз DXY с Macro:**
```
// ui-dxy service
macroAdj = macro.scoreSigned × 2  // scaled for display
finalForecast = hybrid + macroAdj

// Chart macro line
macro[i].pct = hybrid[i].pct + macroAdj
macro[i].value = hybrid[i].value × (1 + macroAdj × 0.1)
```

---

## 4. ОБЩИЕ КОМПОНЕНТЫ

### 4.1 Forward Stats Calculator

**Источник:** `/modules/fractal/engine/forward.stats.ts`

**Return:**
```
ret = (exit / entry) - 1
```

**Max Drawdown:**
```
peak = entry
for price in [entry..exit]:
    peak = max(peak, price)
    dd = (price / peak) - 1  // negative
    maxDD = min(maxDD, dd)
```

**Percentiles:**
```
sorted = values.sort()
index = (p / 100) × (n - 1)
if index is integer: return sorted[index]
else: return interpolate(sorted[floor], sorted[ceil])
```

---

### 4.2 Confidence Calculation

**BTC:**
```
sampleFactor = min(sampleSize / 25, 1)
stabilityFactor = max(0, 1 - std × 2)
stabilityScore = sampleFactor × 0.6 + stabilityFactor × 0.4
```

**SPX:**
```
confidence = min(100, avg(top5.similarity))
```

**DXY Macro:**
```
base = HIGH
if seriesCount < 5: LOW
if seriesCount < 7: MEDIUM
if freshCount < 4: MEDIUM
if qualityPenalty > 0.2: LOW
```

---

### 4.3 Divergence Calculation

**Источник:** `/modules/spx-core/spx.engine.ts`

```
outcomes = matches.map(m => m.outcome)
mean = Σoutcomes / n
variance = Σ(o - mean)² / n
divergence = min(100, √variance × 10)
```

---

## 5. ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ

### 5.1 Несогласованность нормализации

**Проблема:** BTC использует log-returns + zscore, SPX использует процентное изменение от начала окна.

**Файлы:**
- BTC: `similarity.engine.ts` → `buildWindowVector()` 
- SPX: `spx.engine.ts` → `normalizeWindow()`

**Влияние:** Может приводить к разной чувствительности к волатильности между активами.

---

### 5.2 Hardcoded weights в DXY Macro

**Проблема:** Веса компонентов захардкожены, хотя корреляции могут меняться.

**Файл:** `macro_score.service.ts`

**Рекомендация:** Добавить адаптивную калибровку весов.

---

### 5.3 Отсутствие validation на input data

**Проблема:** Нет проверки на NaN/Infinity в входных данных similarity.

**Файл:** `similarity.engine.ts`, строки 34-38 — частичная проверка, но не полная.

---

### 5.4 DXY Macro line scaling

**Проблема:** В `dxy_overview.service.ts` строки 197-199:
```js
macro[i].value = hybrid[i].value × (1 + macroAdj × 0.1)
macro[i].pct = hybrid[i].pct + macroAdj × 2
```

Множитель 0.1 и 2 — магические числа без документации.

---

### 5.5 BTC Overlay default values

**Проблема:** При ошибке расчёта коэффициентов используются дефолты:
```js
beta: cfg.defaultBeta[horizon] || 0.2
```

Дефолтный beta=0.2 может быть неточным.

---

## 6. РЕКОМЕНДАЦИИ

### 6.0 L2/L3 Audit Implementation ✅ DONE

**Реализовано:**
- 12 Unit/Integration тестов инвариантов
- Horizon Consistency Layer (мягкая иерархия)
- Stress testing (volatility sensitivity)
- Automated grading system (A/B/C/D)

**Файлы:**
- `/modules/fractal/audit/horizon_consistency.contract.ts` - Контракты
- `/modules/fractal/audit/horizon_consistency.service.ts` - Soft blend logic
- `/modules/fractal/audit/invariant_tests.service.ts` - 12 тестов
- `/modules/fractal/audit/audit.routes.ts` - API endpoints

### 6.1 Критические (P0)

1. **Унифицировать нормализацию** между BTC и SPX
2. **Добавить data validation** на входе similarity engine
3. **Документировать magic numbers** в DXY macro overlay

### 6.2 Высокий приоритет (P1)

1. **Добавить unit tests** для core math functions
2. **Логировать correlation/beta** при каждом расчёте BTC Overlay
3. **Добавить confidence intervals** для Macro Score

### 6.3 Средний приоритет (P2)

1. **Адаптивные веса** для DXY Macro компонентов
2. **A/B тестирование** разных similarity modes
3. **Backtesting framework** для валидации формул

---

## ПРИЛОЖЕНИЕ: API ENDPOINTS

### BTC Terminal
```
GET /api/fractal/v2.1/focus-pack?symbol=BTC&focus=30d
GET /api/fractal/match
GET /api/fractal/signal
```

### SPX Terminal
```
GET /api/spx/v2.1/terminal?horizon=30d
GET /api/spx/v2.1/stats
```

### DXY Terminal
```
GET /api/fractal/dxy/terminal?focus=90d
GET /api/ui/fractal/dxy/overview?horizon=90
```

### Macro Engine
```
GET /api/macro-engine/:asset/pack
GET /api/macro-engine/v2/state/current
```

---

**Дата:** 2026-03-01  
**Аудитор:** E1 Agent  
**Версия документа:** 1.0
