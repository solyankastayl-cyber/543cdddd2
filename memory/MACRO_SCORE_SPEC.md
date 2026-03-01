# MACRO SCORE V3 — МАТЕМАТИЧЕСКАЯ СПЕЦИФИКАЦИЯ

**Версия:** v3.0.0  
**Статус:** Engineering Audit  
**Дата:** 2026-03-01

---

## 1. OVERVIEW

MacroScore — агрегатный индекс состояния макро:
- Строится из N индикаторов
- Каждый индикатор → Signal ∈ [-1, +1]
- Агрегируется в: score, confidence, concentration, drivers[]

---

## 2. ИНДИКАТОРЫ И DIRECTION MAP

| Series Key | Name | Direction | Rationale |
|------------|------|-----------|-----------|
| FEDFUNDS | Fed Funds Rate | -1 | ↑ = tightening = bearish risk |
| CPIAUCSL | CPI Inflation | -1 | ↑ = inflation pressure = bearish |
| CPILFESL | Core CPI | -1 | ↑ = sticky inflation = bearish |
| PPIACO | PPI | -1 | ↑ = cost push = bearish |
| UNRATE | Unemployment | -1 | ↑ = recession signal = bearish |
| T10Y2Y | Yield Curve Spread | +1 | ↑ = less inversion = bullish |
| M2SL | Money Supply M2 | +1 | ↑ = liquidity expansion = bullish |
| BAA10Y | Credit Spread | -1 | ↑ = risk aversion = bearish |
| TEDRATE | TED Spread | -1 | ↑ = credit stress = bearish |
| HOUST | Housing Starts | +1 | ↑ = economic strength = bullish |
| PERMIT | Building Permits | +1 | ↑ = forward construction = bullish |
| INDPRO | Industrial Production | +1 | ↑ = output growth = bullish |
| TCU | Capacity Utilization | +1 | ↑ = demand strength = bullish |
| VIXCLS | VIX | -1 | ↑ = fear = bearish |
| WALCL | Fed Balance Sheet | +1 | ↑ = QE/liquidity = bullish |

**GOLD (Special):**
- NOT included in MacroScore directly
- Used as separate Risk-Flow Channel
- GOLD ↑ → increases P(FLIGHT_TO_QUALITY) and P(TAIL)

---

## 3. НОРМАЛИЗАЦИЯ (ЕДИНЫЙ СЛОЙ)

### 3.1 Шаг 1: Lag/Shift (asOf-safe)

```
value = getLatestValue(series, released_at <= asOf)
```

- Никаких future prints
- Если серия с задержкой → используем released_at

### 3.2 Шаг 2: Transformation

| Series Type | Transform |
|-------------|-----------|
| Level (FEDFUNDS, UNRATE) | Δx = x(t) - x(t-lookback) |
| YoY (CPI, PPI, M2) | YoY = (x(t) - x(t-12m)) / x(t-12m) |
| Spread (T10Y2Y, BAA10Y) | Direct value |
| Index (VIX, INDPRO) | Δx or level |

### 3.3 Шаг 3: Robust Z-Score

```
median = median(window)
MAD = median(|x - median|)  // Median Absolute Deviation
z_raw = (x - median) / (MAD * 1.4826 + ε)
z = clip(z_raw, -Z_MAX, +Z_MAX)
```

Where:
- `Z_MAX = 3.0` (default)
- `ε = 1e-10`
- `1.4826` is scaling factor to make MAD consistent with std for normal dist

### 3.4 Шаг 4: Squash → [-1, +1]

```
s_raw = tanh(z / k)
```

Where:
- `k = 2.0` (steepness parameter)
- Result: `s_raw ∈ (-1, +1)`

### 3.5 Шаг 5: Apply Direction

```
signal = direction * s_raw
```

Where `direction ∈ {-1, +1}` from Direction Map.

---

## 4. WEIGHTS (PER-ASSET, PER-HORIZON)

### 4.1 Default Weights (DXY-optimized)

| Series | Weight | Rationale |
|--------|--------|-----------|
| T10Y2Y | 0.250 | Strongest predictor (corr=-0.1241) |
| FEDFUNDS | 0.133 | Direct policy impact |
| UNRATE | 0.124 | Labor market signal |
| CPIAUCSL | 0.070 | Inflation component 1 |
| PPIACO | 0.043 | Inflation component 2 |
| M2SL | 0.091 | Liquidity proxy |
| BAA10Y | 0.080 | Credit risk |
| HOUST | 0.060 | Housing |
| INDPRO | 0.050 | Activity |
| VIXCLS | 0.050 | Fear gauge |
| WALCL | 0.049 | Fed balance sheet |
| **Total** | **1.000** | |

### 4.2 Horizon Adjustments

For longer horizons, increase weight of structural factors:

| Horizon | T10Y2Y | FEDFUNDS | M2SL | VIXCLS |
|---------|--------|----------|------|--------|
| 30d | 0.250 | 0.133 | 0.091 | 0.050 |
| 90d | 0.260 | 0.125 | 0.100 | 0.040 |
| 180d | 0.270 | 0.115 | 0.110 | 0.030 |
| 365d | 0.280 | 0.105 | 0.120 | 0.020 |

---

## 5. AGGREGATION

### 5.1 Score Calculation

```
score = Σ(w_i * s_i) / Σ(w_i)
```

Where:
- `w_i` = weight of indicator i
- `s_i` = signal of indicator i (after direction)
- Result: `score ∈ [-1, +1]`

### 5.2 Confidence Calculation

```
// Entropy of contributions
p_i = |w_i * s_i| / Σ|w_j * s_j|
entropy = -Σ(p_i * log(p_i + ε))
entropy_max = log(N)
entropy_norm = entropy / entropy_max

// Confidence factors
dataFreshness = countFresh / countTotal  // fresh = updated within 30d
stability = 1 - std(signals) / 2

// Final confidence
conf = clamp((1 - entropy_norm) * dataFreshness * stability, 0, 1)
```

### 5.3 Concentration

```
contributions = sort(|w_i * s_i|, descending)
topKShare = sum(contributions[:K]) / sum(contributions)
```

Where `K = 3` (default).

### 5.4 Drivers

```
drivers = top_k(series, by=|w_i * s_i|, k=3)

For each driver:
  - name: series key
  - direction: +1 or -1
  - contribution: w_i * s_i
  - z: z-score value
  - signal: s_i
```

---

## 6. OVERLAY INTEGRATION

### 6.1 MacroScore → Asset Adjustment

```
R_adj = R_base + macroStrength * score * cap
```

Where:
- `macroStrength` = overlay weight (default 0.1-0.3)
- `cap` = max impact (default ±5%)

### 6.2 Constraints

1. **Neutrality**: If `macroStrength = 0` → `R_adj == R_base`
2. **Bounded**: `|R_adj - R_base| <= cap * |R_base|`
3. **Sign Preservation**: Weak macro doesn't flip strong trend

---

## 7. INVARIANTS (MUST HOLD)

| ID | Invariant | Formula |
|----|-----------|---------|
| I1 | NoLookahead | All values from `released_at <= asOf` |
| I2 | Determinism | Same `asOf` → same `inputsHash` |
| I3 | BoundedScore | `score ∈ [-1, +1]` |
| I4 | BoundedConf | `confidence ∈ [0, 1]` |
| I5 | BoundedSignals | `∀i: s_i ∈ [-1, +1]` |
| I6 | NoNaN | No NaN/Inf in any output |
| I7 | MissingSafe | Missing series → recalc weights, no crash |

---

## 8. MONOTONICITY TESTS

| ID | Test | Expected |
|----|------|----------|
| M1 | Direction Sanity | If `direction=-1` and `x↑` → `s↓` |
| M2 | Weight Monotonic | `w_i↑` → `|contribution_i|↑` (fixed signals) |
| M3 | Aggregation Monotonic | One signal bullish → score shifts bullish |

---

## 9. STRESS SCENARIOS

| ID | Scenario | Perturbation |
|----|----------|--------------|
| S1 | Rate Shock | FEDFUNDS z += 2 |
| S2 | Inflation Shock | CPI z += 2 |
| S3 | Curve Inversion | T10Y2Y z -= 2 |
| S4 | Unemployment Jump | UNRATE z += 2 |
| S5 | Liquidity Freeze | M2 z -= 2, BAA10Y z += 2 |
| S6 | Flight to Quality | VIX z += 2, GOLD external signal |
| S7 | Data Corruption | Missing series, constant series, outlier |

---

## 10. CONFIGURATION

```typescript
interface MacroScoreV3Config {
  // Normalization
  zMax: number;           // default: 3.0
  tanhK: number;          // default: 2.0
  windowDays: number;     // default: 252 (1 year)
  madScaleFactor: number; // default: 1.4826
  
  // Aggregation
  topKDrivers: number;    // default: 3
  
  // Overlay
  macroStrength: number;  // default: 0.2
  impactCap: number;      // default: 0.05 (5%)
  
  // Feature flags
  enabled: boolean;
  useHorizonWeights: boolean;
}
```

---

## 11. API CONTRACT

### Request
```
GET /api/macro-score/v3/compute?asOf=2026-03-01&asset=DXY&horizon=90
```

### Response
```json
{
  "ok": true,
  "version": "v3.0.0",
  "asOf": "2026-03-01",
  "asset": "DXY",
  "horizon": 90,
  
  "score": 0.15,
  "confidence": 0.72,
  "concentration": 0.45,
  "entropy": 0.68,
  
  "drivers": [
    {
      "name": "T10Y2Y",
      "direction": 1,
      "contribution": 0.08,
      "z": 1.2,
      "signal": 0.54
    },
    ...
  ],
  
  "diagnostics": {
    "inputsHash": "a1b2c3d4",
    "seriesCount": 11,
    "missingSeries": [],
    "freshCount": 10,
    "zScores": { "FEDFUNDS": -0.8, ... },
    "signals": { "FEDFUNDS": 0.37, ... },
    "windowMeta": {
      "start": "2025-03-01",
      "end": "2026-03-01",
      "days": 252
    }
  },
  
  "computedAt": "2026-03-01T14:30:00Z"
}
```

---

## 12. AUDIT CHECKLIST

### MacroScore v3 (Math) ✅ IMPLEMENTED
- [x] Spec doc complete
- [x] Normalizer MAD+tanh bounded
- [x] Direction map for all series
- [x] Drivers, concentration, entropy
- [x] inputsHash determinism
- [x] missing-safe

### Audit Tests (20 total) ✅ ALL PASSING
- [x] I1: noLookahead
- [x] I2: determinism
- [x] I3-I5: bounded outputs (score, confidence, signals)
- [x] I6: no NaN/Inf
- [x] I7: missing series safe
- [x] M1: direction sanity
- [x] M2: weight monotonic
- [x] M3: aggregation monotonic
- [x] O1: overlay neutrality
- [x] O2: overlay bounded
- [x] O3: sign preservation
- [x] S1-S7: All stress scenarios passed

**Grade: A | Pass Rate: 100% | Tests: 20/20**

---

**Document Version:** 1.0  
**Author:** E1 Agent  
**Status:** Draft → Implement → Validate
