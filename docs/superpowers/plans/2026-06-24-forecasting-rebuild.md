# Forecasting Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Analizcim forecasting with automatic statistical model selection, accountant feedback, redesigned forecast UI, and a dashboard forecast widget.

**Architecture:** Keep the existing Express + vanilla JS + Chart.js app. Extend `src/predictor.js` response shape without removing current fields; update `/api/predictions` only through additional query parsing and extra response data; refresh `public/index.html`, `public/app.js`, and `public/styles.css` in-place.

**Tech Stack:** Node.js, Express, SQLite, vanilla JavaScript, Chart.js, node:test, ESLint.

---

### Task 1: Predictor Unit Tests

**Files:**
- Modify: `tests/unit/predictor.test.js`

- [ ] **Step 1: Write failing tests**

Add tests that require `modelSelection`, `modelComparison`, `forecastHorizons`, `allPredictions`, and `accountantFeedback` from `predictNextMonths()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_ENV=test node --test tests/unit/predictor.test.js`
Expected: FAIL because new fields do not exist yet.

### Task 2: Forecast Engine

**Files:**
- Modify: `src/predictor.js`

- [ ] **Step 1: Implement model helpers**

Add model runners for linear regression, simple exponential smoothing, Holt-Winters additive, and native `arima` package forecasting.

- [ ] **Step 2: Implement rolling backtest selection**

Calculate MAE/RMSE per usable model and select the lowest RMSE. Preserve `predictions` as the 3-month array; add 12-month `allPredictions`.

- [ ] **Step 3: Add feedback**

Generate `accountantFeedback` with 3-month value, interval, trend strength, seasonality note, YoY/QoQ comparison, action sentence, and critical warning.

- [ ] **Step 4: Run unit tests**

Run: `NODE_ENV=test node --test tests/unit/predictor.test.js`
Expected: PASS.

### Task 3: Predictions API Filters

**Files:**
- Modify: `src/server.js`

- [ ] **Step 1: Parse query**

Support `period=6|12|all` and `model=auto|linear|exponentialSmoothing|holtWinters|arima`.

- [ ] **Step 2: Preserve response**

Return existing keys plus new prediction fields. Do not alter storage writes.

### Task 4: Forecast UI Rebuild

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`

- [ ] **Step 1: Add top filters and summary fields**

Add period/model selectors and new text targets for selected model, interval, trend strength, seasonality, and feedback.

- [ ] **Step 2: Render comparison table and horizons**

Add model comparison table, 1/3/6/12 horizon cards, and keep risk/scenario/action/CFO/model details below.

- [ ] **Step 3: Update chart**

Use `allPredictions` and confidence bands while retaining historical sales/purchase/profit datasets.

### Task 5: Dashboard Widget

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`

- [ ] **Step 1: Add forecast widget card**

Insert `widget-forecast` after KPI stats. Clicking it calls `switchTab('predictions')`.

- [ ] **Step 2: Load prediction summary**

Fetch `/api/predictions?period=12&model=auto`, render 3-month forecast, trend arrow, selected model, and warning dot.

### Task 6: Verification

**Commands:**
- `npm run lint`
- `npm run test:unit`
- `npm run test:smoke`
- `npm run verify:fast`

**Browser QA:**
- Start app with safe local env.
- Validate login/dashboard/predictions at 390px, 768px, 1440px.
- Check console errors, layout overlap, dark/light compatibility, forecast widget navigation.
