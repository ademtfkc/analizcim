/**
 * Analizcim - Predictor Module
 * Geçmiş verilere dayalı istatistiksel projeksiyon
 */

const DISCLAIMER = 'Bu bilgiler yalnızca geçmiş verilere dayalı istatistiksel projeksiyondur; yatırım, finansal veya stratejik tavsiye niteliği taşımaz.';
const ARIMA = require('arima');

const REGRESSION_MONTHS = 3;
const EXTENDED_FORECAST_MONTHS = 12;
const MODEL_LABELS = {
    linear: 'Linear Regresyon',
    exponentialSmoothing: 'Exponential Smoothing',
    holtWinters: 'Holt-Winters',
    arima: 'ARIMA'
};
const MODEL_KEYS = Object.keys(MODEL_LABELS);

// ============================================
// CORE REGRESSION FUNCTIONS
// ============================================

function quantile(sortedValues, q) {
    if (!sortedValues || sortedValues.length === 0) return 0;
    const pos = (sortedValues.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sortedValues[base + 1];
    if (next === undefined) return sortedValues[base];
    return sortedValues[base] + rest * (next - sortedValues[base]);
}

/**
 * OLS lineer regresyon: y = slope*x + intercept
 * Döner: slope, intercept, rSquared, see (tahmin standart hatası), seSlope (eğim standart hatası), n, xMean
 */
function calculateLinearRegression(data) {
    const n = data.length;
    if (n < 2) return null;

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (const point of data) {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const xMean = sumX / n;
    const yMean = sumY / n;

    let ssTotal = 0, ssRes = 0;
    const residuals = [];
    const apeValues = [];
    for (const point of data) {
        const yPred = slope * point.x + intercept;
        const residual = point.y - yPred;
        residuals.push(residual);
        if (point.y > 0) apeValues.push(Math.abs(residual / point.y) * 100);
        ssTotal += Math.pow(point.y - yMean, 2);
        ssRes += Math.pow(residual, 2);
    }
    const rSquared = 1 - (ssRes / (ssTotal || 1));

    // Standart hatalar (gerçek formüller)
    const see = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
    const sxx = sumXX - (sumX * sumX) / n;
    const seSlope = (see > 0 && sxx > 0) ? see / Math.sqrt(sxx) : 0;
    const absResiduals = residuals.map(Math.abs);
    const mae = absResiduals.reduce((sum, val) => sum + val, 0) / n;
    const rmse = Math.sqrt(ssRes / n);
    const mape = apeValues.length > 0 ? apeValues.reduce((sum, val) => sum + val, 0) / apeValues.length : 0;
    const sortedResiduals = [...residuals].sort((a, b) => a - b);
    const residualQuantiles = {
        p025: quantile(sortedResiduals, 0.025),
        p10: quantile(sortedResiduals, 0.10),
        p50: quantile(sortedResiduals, 0.50),
        p90: quantile(sortedResiduals, 0.90),
        p975: quantile(sortedResiduals, 0.975)
    };

    return { slope, intercept, rSquared, see, seSlope, n, xMean, residuals, mae, rmse, mape, residualQuantiles };
}

/**
 * Tek seri için regresyon + tahmin + güven aralığı üret
 * @param {Array} dataArray - [{month, amount}]
 * @returns {Object} { regression, predictions[], confidenceBands[], trend, confidence, cmgr }
 */
function predictSeries(dataArray, seasonality = null) {
    if (!dataArray || dataArray.length < 3) return null;

    const regressionData = dataArray.map((d, i) => ({ x: i, y: d.amount }));
    const reg = calculateLinearRegression(regressionData);
    if (!reg) return null;

    const nextIndex = regressionData.length;
    const predictions = [];
    const confidenceBands = [];

    const intervalQuantiles = reg.residualQuantiles || { p025: -reg.see, p975: reg.see };

    // Parse base date
    const baseDateStr = dataArray[dataArray.length - 1].month;
    const [y, m] = baseDateStr.split('-').map(Number);
    const baseDate = new Date(y, m - 1);

    for (let i = 0; i < REGRESSION_MONTHS; i++) {
        const x = nextIndex + i;
        let amount = reg.slope * x + reg.intercept;
        const unadjustedAmount = amount;

        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i + 1);
        const monthStr = d.toISOString().slice(0, 7);

        if (seasonality?.detected) {
            const quarter = getQuarterForMonth(d.getMonth() + 1);
            const quarterIndex = seasonality.quarterIndices?.[quarter] || 1;
            // Apply quarterly seasonal multiplier to the trend projection; confidence bands remain unadjusted.
            amount *= quarterIndex;
        }

        const predicted = Math.max(0, Math.round(amount));
        const unadjustedPredicted = Math.max(0, Math.round(unadjustedAmount));
        predictions.push({ month: monthStr, amount: predicted });
        confidenceBands.push({
            month: monthStr,
            upper: Math.max(0, Math.round(unadjustedPredicted + intervalQuantiles.p975)),
            lower: Math.max(0, Math.round(unadjustedPredicted + intervalQuantiles.p025)),
            method: 'empirical_residual_quantile'
        });
    }

    // Trend: eğimin istatistiksel anlamlılığı
    // Not: seSlope = 0 (mükemmel doğrusal uyum) durumunda slope yönünü kullan
    const tSlope = (reg.seSlope > 0) ? reg.slope / reg.seSlope : (reg.slope !== 0 ? (reg.slope > 0 ? Infinity : -Infinity) : 0);
    const trend = Math.abs(tSlope) < 2 ? 'stable' : (reg.slope > 0 ? 'up' : 'down');

    // Güven skoru
    const adj = reg.n > 2 ? 1 - (1 / reg.n) : 0;
    const confidence = Math.max(0, Math.min(100, Math.round(reg.rSquared * 100 * adj)));

    // CMGR (bileşik aylık büyüme)
    const firstAmount = dataArray[0].amount;
    const lastAmount = dataArray[dataArray.length - 1].amount;
    const numPeriods = dataArray.length - 1;
    const cmgr = (firstAmount > 0 && numPeriods > 0)
        ? (Math.pow(lastAmount / firstAmount, 1 / numPeriods) - 1) : 0;

    return {
        regression: reg,
        predictions,
        confidenceBands,
        trend,
        confidence,
        cmgr: Number((cmgr * 100).toFixed(2)),
        slope: reg.slope,
        diagnostics: {
            residuals: reg.residuals.map(v => Math.round(v)),
            mae: Math.round(reg.mae),
            rmse: Math.round(reg.rmse),
            mape: Number(reg.mape.toFixed(2)),
            residualQuantiles: {
                p025: Math.round(reg.residualQuantiles.p025),
                p10: Math.round(reg.residualQuantiles.p10),
                p50: Math.round(reg.residualQuantiles.p50),
                p90: Math.round(reg.residualQuantiles.p90),
                p975: Math.round(reg.residualQuantiles.p975)
            },
            intervalMethod: 'empirical_residual_quantile'
        }
    };
}

function finiteAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
}

function clampForecastAmount(value) {
    return Math.max(0, Math.round(finiteAmount(value)));
}

function addMonths(yyyyMM, offset) {
    const [year, month] = String(yyyyMM).split('-').map(Number);
    const date = new Date(year, month - 1);
    date.setMonth(date.getMonth() + offset);
    return date.toISOString().slice(0, 7);
}

function getForecastMonths(dataArray, count) {
    const lastMonth = dataArray[dataArray.length - 1]?.month;
    return Array.from({ length: count }, (_, index) => addMonths(lastMonth, index + 1));
}

function calculateErrorMetrics(actuals, forecastValues) {
    const pairs = actuals
        .map((actual, index) => ({ actual: finiteAmount(actual), predicted: finiteAmount(forecastValues[index]) }))
        .filter(pair => Number.isFinite(pair.actual) && Number.isFinite(pair.predicted));

    if (pairs.length === 0) {
        return { mae: null, rmse: null, mape: null, residuals: [] };
    }

    const residuals = pairs.map(pair => pair.actual - pair.predicted);
    const absErrors = residuals.map(Math.abs);
    const sqErrors = residuals.map(error => error * error);
    const apeValues = pairs
        .filter(pair => pair.actual > 0)
        .map(pair => Math.abs((pair.actual - pair.predicted) / pair.actual) * 100);

    return {
        mae: absErrors.reduce((sum, value) => sum + value, 0) / pairs.length,
        rmse: Math.sqrt(sqErrors.reduce((sum, value) => sum + value, 0) / pairs.length),
        mape: apeValues.length ? apeValues.reduce((sum, value) => sum + value, 0) / apeValues.length : null,
        residuals
    };
}

function buildBandsFromResiduals(predictions, residuals) {
    const sortedResiduals = residuals.length ? [...residuals].sort((a, b) => a - b) : [0];
    const p10 = quantile(sortedResiduals, 0.10);
    const p90 = quantile(sortedResiduals, 0.90);
    const fallback = Math.max(1, Math.sqrt(sortedResiduals.reduce((sum, value) => sum + value * value, 0) / sortedResiduals.length));

    return predictions.map((prediction, index) => {
        const scale = Math.sqrt(index + 1);
        const lowerDelta = Number.isFinite(p10) && p10 !== 0 ? p10 * scale : -fallback * scale;
        const upperDelta = Number.isFinite(p90) && p90 !== 0 ? p90 * scale : fallback * scale;
        const lower = clampForecastAmount(prediction.amount + Math.min(lowerDelta, upperDelta));
        const upper = clampForecastAmount(prediction.amount + Math.max(lowerDelta, upperDelta));
        return {
            month: prediction.month,
            lower,
            upper,
            method: 'model_residual_interval',
            confidence: 80
        };
    });
}

function deriveTrendFromSeries(dataArray, forecastValues) {
    const values = dataArray.map(item => finiteAmount(item.amount));
    const last3 = values.slice(-3);
    const forecast3 = forecastValues.slice(0, 3);
    const baseAvg = last3.length ? last3.reduce((sum, value) => sum + value, 0) / last3.length : 0;
    const forecastAvg = forecast3.length ? forecast3.reduce((sum, value) => sum + value, 0) / forecast3.length : 0;
    const pct = baseAvg > 0 ? ((forecastAvg - baseAvg) / baseAvg) * 100 : 0;
    if (pct > 3) return 'up';
    if (pct < -3) return 'down';
    return 'stable';
}

function computeForecastConfidence(metrics, dataArray) {
    const values = dataArray.map(item => finiteAmount(item.amount));
    const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const errorRatio = avg > 0 && Number.isFinite(metrics.rmse) ? metrics.rmse / avg : 1;
    const dataScore = Math.min(25, Math.max(0, dataArray.length - 3) * 2);
    return Math.max(0, Math.min(100, Math.round(85 - errorRatio * 100 + dataScore)));
}

function finalizeModelResult(model, dataArray, forecastValues, fittedValues, metrics, params = {}) {
    const forecastMonths = getForecastMonths(dataArray, forecastValues.length);
    const predictions = forecastValues.map((amount, index) => ({
        month: forecastMonths[index],
        amount: clampForecastAmount(amount)
    }));
    const fittedMetrics = calculateErrorMetrics(
        dataArray.map(item => item.amount),
        fittedValues
    );
    const residuals = metrics.residuals?.length ? metrics.residuals : fittedMetrics.residuals;
    const confidenceBands = buildBandsFromResiduals(predictions, residuals);

    return {
        key: model,
        label: MODEL_LABELS[model],
        available: true,
        predictions,
        confidenceBands,
        fittedValues: fittedValues.map(value => clampForecastAmount(value)),
        residuals,
        mae: metrics.mae,
        rmse: metrics.rmse,
        mape: metrics.mape,
        confidence: computeForecastConfidence(metrics, dataArray),
        trend: deriveTrendFromSeries(dataArray, forecastValues),
        params
    };
}

function runLinearModel(dataArray, forecastMonths = EXTENDED_FORECAST_MONTHS) {
    if (!dataArray || dataArray.length < 3) return null;
    const regressionData = dataArray.map((item, index) => ({ x: index, y: finiteAmount(item.amount) }));
    const reg = calculateLinearRegression(regressionData);
    if (!reg) return null;

    const fittedValues = regressionData.map(point => reg.slope * point.x + reg.intercept);
    const forecastValues = Array.from({ length: forecastMonths }, (_, index) => {
        const x = regressionData.length + index;
        return reg.slope * x + reg.intercept;
    });
    const metrics = calculateErrorMetrics(dataArray.map(item => item.amount), fittedValues);
    return finalizeModelResult('linear', dataArray, forecastValues, fittedValues, metrics, {
        slope: Number(reg.slope.toFixed(2)),
        intercept: Number(reg.intercept.toFixed(2)),
        rSquared: Number((reg.rSquared || 0).toFixed(4))
    });
}

function fitSimpleExponentialSmoothing(values, alpha) {
    const fittedValues = [values[0]];
    let level = values[0];
    for (let i = 1; i < values.length; i++) {
        fittedValues.push(level);
        level = alpha * values[i] + (1 - alpha) * level;
    }
    return { level, fittedValues };
}

function runExponentialSmoothingModel(dataArray, forecastMonths = EXTENDED_FORECAST_MONTHS) {
    if (!dataArray || dataArray.length < 3) return null;
    const values = dataArray.map(item => finiteAmount(item.amount));
    const alphas = [0.2, 0.35, 0.5, 0.65, 0.8];
    let best = null;

    for (const alpha of alphas) {
        const fit = fitSimpleExponentialSmoothing(values, alpha);
        const metrics = calculateErrorMetrics(values.slice(1), fit.fittedValues.slice(1));
        if (!best || metrics.rmse < best.metrics.rmse) {
            best = { alpha, ...fit, metrics };
        }
    }

    if (!best) return null;
    const fittedValues = best.fittedValues;
    const forecastValues = Array.from({ length: forecastMonths }, () => best.level);
    const metrics = calculateErrorMetrics(values, fittedValues);
    return finalizeModelResult('exponentialSmoothing', dataArray, forecastValues, fittedValues, metrics, {
        alpha: best.alpha
    });
}

function runHoltWintersModel(dataArray, forecastMonths = EXTENDED_FORECAST_MONTHS) {
    if (!dataArray || dataArray.length < 8) return null;
    const values = dataArray.map(item => finiteAmount(item.amount));
    const period = values.length >= 18 ? 12 : 4;
    if (values.length < period * 2) return null;

    const alpha = 0.35;
    const beta = 0.12;
    const gamma = 0.2;
    const firstSeasonAvg = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
    const secondSeasonAvg = values.slice(period, period * 2).reduce((sum, value) => sum + value, 0) / period;
    let level = firstSeasonAvg;
    let trend = (secondSeasonAvg - firstSeasonAvg) / period;
    const seasonals = values.slice(0, period).map(value => value - firstSeasonAvg);
    const fittedValues = [];

    for (let i = 0; i < values.length; i++) {
        const seasonalIndex = i % period;
        const seasonal = seasonals[seasonalIndex] || 0;
        const previousLevel = level;
        const fitted = i < period ? values[i] : level + trend + seasonal;
        fittedValues.push(fitted);
        level = alpha * (values[i] - seasonal) + (1 - alpha) * (level + trend);
        trend = beta * (level - previousLevel) + (1 - beta) * trend;
        seasonals[seasonalIndex] = gamma * (values[i] - level) + (1 - gamma) * seasonal;
    }

    const forecastValues = Array.from({ length: forecastMonths }, (_, index) => {
        const step = index + 1;
        const seasonal = seasonals[(values.length + index) % period] || 0;
        return level + step * trend + seasonal;
    });
    const metrics = calculateErrorMetrics(values.slice(period), fittedValues.slice(period));
    return finalizeModelResult('holtWinters', dataArray, forecastValues, fittedValues, metrics, {
        alpha,
        beta,
        gamma,
        period,
        seasonalMode: 'additive'
    });
}

function getArimaCandidateOptions(values) {
    const candidates = [
        { p: 2, d: 1, q: 2, verbose: false },
        { p: 1, d: 1, q: 1, verbose: false },
        { p: 2, d: 1, q: 0, verbose: false },
        { p: 0, d: 1, q: 1, verbose: false },
        { p: 1, d: 0, q: 1, verbose: false }
    ];

    if (values.length >= 24) {
        candidates.push({ p: 1, d: 1, q: 1, P: 1, D: 0, Q: 1, s: 12, verbose: false });
    }

    return candidates;
}

function formatArimaOrder(options) {
    const base = `(${options.p || 0},${options.d || 0},${options.q || 0})`;
    if (options.P || options.D || options.Q || options.s) {
        return `${base}x(${options.P || 0},${options.D || 0},${options.Q || 0})[${options.s || 0}]`;
    }
    return base;
}

function fitNativeArima(values, forecastMonths, options) {
    let model = null;
    const originalStderrWrite = process.stderr.write;
    const originalStdoutWrite = process.stdout.write;
    const filterArimaNoise = (originalWrite, stream) => function arimaOutputFilter(chunk, encoding, callback) {
        const message = String(chunk || '');
        if (message.includes('non-stationary AR part') || message.trim() === '') {
            if (typeof encoding === 'function') encoding();
            if (typeof callback === 'function') callback();
            return true;
        }
        return originalWrite.apply(stream, arguments);
    };
    try {
        process.stderr.write = filterArimaNoise(originalStderrWrite, process.stderr);
        process.stdout.write = filterArimaNoise(originalStdoutWrite, process.stdout);
        model = new ARIMA(options).train(values);
        const [predictions, errors] = model.predict(forecastMonths);
        const forecastValues = Array.from(predictions || [])
            .slice(0, forecastMonths)
            .map(finiteAmount);
        const forecastErrors = Array.from(errors || [])
            .slice(0, forecastMonths)
            .map(value => Math.max(0, finiteAmount(value)));
        if (forecastValues.length !== forecastMonths || forecastValues.some(value => !Number.isFinite(value))) return null;
        return { forecastValues, forecastErrors };
    } catch (_) {
        return null;
    } finally {
        process.stderr.write = originalStderrWrite;
        process.stdout.write = originalStdoutWrite;
        if (model && typeof model.destroy === 'function') model.destroy();
    }
}

function selectArimaCandidate(values) {
    const candidates = getArimaCandidateOptions(values);
    const holdoutSize = values.length >= 14 ? Math.min(4, Math.max(2, Math.floor(values.length / 4))) : 0;
    const trainValues = holdoutSize > 0 ? values.slice(0, -holdoutSize) : values;
    const actualHoldout = holdoutSize > 0 ? values.slice(-holdoutSize) : [];
    let best = null;

    for (const options of candidates) {
        const fitted = fitNativeArima(trainValues, holdoutSize || 1, options);
        if (!fitted) continue;
        const metrics = holdoutSize > 0
            ? calculateErrorMetrics(actualHoldout, fitted.forecastValues)
            : { mae: 0, rmse: 0, mape: null, residuals: [] };
        if (!Number.isFinite(metrics.rmse)) continue;
        if (!best || metrics.rmse < best.metrics.rmse) {
            best = { options, metrics };
        }
    }

    return best;
}

function buildArimaRollingFittedValues(values, options) {
    const minTrain = Math.min(values.length, 10);
    const fittedValues = values.slice(0, minTrain);
    const actuals = [];
    const forecasts = [];

    for (let index = minTrain; index < values.length; index++) {
        const fitted = fitNativeArima(values.slice(0, index), 1, options);
        const forecast = fitted?.forecastValues?.[0];
        const safeForecast = Number.isFinite(forecast) ? forecast : values[index - 1];
        fittedValues[index] = safeForecast;
        actuals.push(values[index]);
        forecasts.push(safeForecast);
    }

    return {
        fittedValues,
        metrics: actuals.length
            ? calculateErrorMetrics(actuals, forecasts)
            : calculateErrorMetrics(values, fittedValues)
    };
}

function runArimaModel(dataArray, forecastMonths = EXTENDED_FORECAST_MONTHS) {
    if (!dataArray || dataArray.length < 10) return null;
    const values = dataArray.map(item => finiteAmount(item.amount));
    const selectedCandidate = selectArimaCandidate(values);
    if (!selectedCandidate) return null;

    const finalFit = fitNativeArima(values, forecastMonths, selectedCandidate.options);
    if (!finalFit) return null;

    const rollingFit = buildArimaRollingFittedValues(values, selectedCandidate.options);
    const result = finalizeModelResult('arima', dataArray, finalFit.forecastValues, rollingFit.fittedValues, rollingFit.metrics, {
        arimaEngine: 'arima',
        order: formatArimaOrder(selectedCandidate.options),
        p: selectedCandidate.options.p || 0,
        d: selectedCandidate.options.d || 0,
        q: selectedCandidate.options.q || 0,
        seasonalOrder: selectedCandidate.options.s ? {
            P: selectedCandidate.options.P || 0,
            D: selectedCandidate.options.D || 0,
            Q: selectedCandidate.options.Q || 0,
            s: selectedCandidate.options.s
        } : null,
        candidateSelection: 'holdout_rmse',
        forecastErrorMethod: 'arima_package_mse'
    });

    if (finalFit.forecastErrors.length === result.confidenceBands.length) {
        result.confidenceBands = result.predictions.map((prediction, index) => {
            const sigma = Math.sqrt(finalFit.forecastErrors[index] || 0);
            const delta = Math.max(sigma * 1.28, prediction.amount * 0.03);
            return {
                month: prediction.month,
                lower: clampForecastAmount(prediction.amount - delta),
                upper: clampForecastAmount(prediction.amount + delta),
                method: 'arima_package_mse_interval',
                confidence: 80
            };
        });
    }

    return result;
}

function runModelByKey(model, dataArray, forecastMonths = EXTENDED_FORECAST_MONTHS) {
    if (model === 'linear') return runLinearModel(dataArray, forecastMonths);
    if (model === 'exponentialSmoothing') return runExponentialSmoothingModel(dataArray, forecastMonths);
    if (model === 'holtWinters') return runHoltWintersModel(dataArray, forecastMonths);
    if (model === 'arima') return runArimaModel(dataArray, forecastMonths);
    return null;
}

function getModelMinimumTrainingSize(model) {
    if (model === 'holtWinters') return 8;
    if (model === 'arima') return 10;
    return 3;
}

function backtestModel(model, dataArray) {
    const minTraining = getModelMinimumTrainingSize(model);
    if (!dataArray || dataArray.length <= minTraining) return null;

    const actuals = [];
    const forecasts = [];
    for (let split = minTraining; split < dataArray.length; split++) {
        const train = dataArray.slice(0, split);
        const result = runModelByKey(model, train, 1);
        if (!result?.predictions?.length) continue;
        actuals.push(dataArray[split].amount);
        forecasts.push(result.predictions[0].amount);
    }

    if (actuals.length < 2) return null;
    return calculateErrorMetrics(actuals, forecasts);
}

function buildForecastModelSuite(dataArray, options = {}) {
    const requestedModel = MODEL_KEYS.includes(options.model) ? options.model : 'auto';
    const fullResults = {};
    const comparison = MODEL_KEYS.map(model => {
        const fullResult = runModelByKey(model, dataArray, EXTENDED_FORECAST_MONTHS);
        const backtestMetrics = backtestModel(model, dataArray);
        if (!fullResult || !backtestMetrics || !Number.isFinite(backtestMetrics.rmse)) {
            return {
                key: model,
                label: MODEL_LABELS[model],
                available: false,
                selected: false,
                mae: null,
                rmse: null,
                mape: null,
                reason: 'Bu model için veri uzunluğu yetersiz.'
            };
        }
        fullResults[model] = fullResult;
        return {
            key: model,
            label: MODEL_LABELS[model],
            available: true,
            selected: false,
            mae: Math.round(backtestMetrics.mae),
            rmse: Math.round(backtestMetrics.rmse),
            mape: backtestMetrics.mape == null ? null : Number(backtestMetrics.mape.toFixed(2)),
            reason: 'Rolling backtest ile hesaplandı.'
        };
    });

    const available = comparison.filter(item => item.available);
    if (available.length === 0) {
        const fallback = runLinearModel(dataArray, EXTENDED_FORECAST_MONTHS);
        return {
            selected: fallback,
            comparison,
            modelSelection: {
                selectedModel: 'linear',
                selectedLabel: MODEL_LABELS.linear,
                selectionMode: 'fallback',
                reason: 'Veri sınırlı olduğu için lineer regresyon kullanıldı.',
                metrics: { mae: fallback?.mae || 0, rmse: fallback?.rmse || 0 }
            }
        };
    }

    let selectedKey = null;
    let selectionMode = 'auto';
    if (requestedModel !== 'auto' && fullResults[requestedModel]) {
        selectedKey = requestedModel;
        selectionMode = 'manual';
    } else {
        selectedKey = available
            .slice()
            .sort((a, b) => (a.rmse - b.rmse) || (a.mae - b.mae))[0].key;
    }

    const selectedComparison = comparison.find(item => item.key === selectedKey);
    comparison.forEach(item => { item.selected = item.key === selectedKey; });

    return {
        selected: fullResults[selectedKey],
        comparison,
        modelSelection: {
            selectedModel: selectedKey,
            selectedLabel: MODEL_LABELS[selectedKey],
            selectionMode,
            reason: selectionMode === 'manual'
                ? `${MODEL_LABELS[selectedKey]} kullanıcı seçimiyle kullanıldı.`
                : `En düşük RMSE ${MODEL_LABELS[selectedKey]} modelinde görüldü.`,
            metrics: {
                mae: selectedComparison?.mae || 0,
                rmse: selectedComparison?.rmse || 0,
                mape: selectedComparison?.mape
            }
        }
    };
}

function buildForecastHorizons(predictions, confidenceBands) {
    return [1, 3, 6, 12].map(months => {
        const selectedPredictions = predictions.slice(0, months);
        const selectedBands = confidenceBands.slice(0, months);
        return {
            months,
            label: `${months} ay`,
            total: selectedPredictions.reduce((sum, item) => sum + finiteAmount(item.amount), 0),
            average: selectedPredictions.length
                ? Math.round(selectedPredictions.reduce((sum, item) => sum + finiteAmount(item.amount), 0) / selectedPredictions.length)
                : 0,
            lower: selectedBands.reduce((sum, item) => sum + finiteAmount(item.lower), 0),
            upper: selectedBands.reduce((sum, item) => sum + finiteAmount(item.upper), 0)
        };
    });
}

function buildSamePeriodLastYearComparison(dataArray, predictions) {
    const lookup = new Map(dataArray.map(item => [item.month, finiteAmount(item.amount)]));
    const forecastMonths = predictions.slice(0, 3).map(item => item.month);
    const previousMonths = forecastMonths.map(month => addMonths(month, -12));
    if (!previousMonths.every(month => lookup.has(month))) return null;

    const forecastTotal = predictions.slice(0, 3).reduce((sum, item) => sum + finiteAmount(item.amount), 0);
    const previousYearTotal = previousMonths.reduce((sum, month) => sum + lookup.get(month), 0);
    return {
        previousMonths,
        forecastTotal: Math.round(forecastTotal),
        previousYearTotal: Math.round(previousYearTotal),
        changePct: previousYearTotal > 0 ? Number((((forecastTotal - previousYearTotal) / previousYearTotal) * 100).toFixed(1)) : null
    };
}

function getTrendStrength(changePct) {
    const abs = Math.abs(changePct);
    if (abs >= 12) return 'güçlü';
    if (abs >= 5) return 'orta';
    return 'hafif';
}

function buildAccountantFeedback(dataArray, forecastResult, seasonality, riskAssessment) {
    const predictions = forecastResult.predictions;
    const bands = forecastResult.confidenceBands;
    const last3 = dataArray.slice(-3);
    const last3Total = last3.reduce((sum, item) => sum + finiteAmount(item.amount), 0);
    const threeMonthForecast = predictions.slice(0, 3).reduce((sum, item) => sum + finiteAmount(item.amount), 0);
    const interval = {
        lower: bands.slice(0, 3).reduce((sum, item) => sum + finiteAmount(item.lower), 0),
        upper: bands.slice(0, 3).reduce((sum, item) => sum + finiteAmount(item.upper), 0),
        confidence: 80
    };
    const changePct = last3Total > 0 ? ((threeMonthForecast - last3Total) / last3Total) * 100 : 0;
    const direction = changePct > 3 ? 'up' : changePct < -3 ? 'down' : 'stable';
    const directionLabel = direction === 'up' ? 'yükseliş' : direction === 'down' ? 'düşüş' : 'durağan';
    const strength = getTrendStrength(changePct);
    const samePeriodLastYearComparison = buildSamePeriodLastYearComparison(dataArray, predictions);

    let actionSentence = 'Satış ritmi yatay görünüyor. Tahmin bandını yeni satış verileriyle aylık takip etmeniz önerilir.';
    if (direction === 'up') {
        actionSentence = 'Satış beklentisi yükseliyor. Stok, tahsilat ve kapasite planını tahmin artışına göre gözden geçirmeniz önerilir.';
    } else if (direction === 'down') {
        actionSentence = 'Satış beklentisi düşüyor. Maliyetleri gözden geçirmeniz, tahsilat takibini sıkılaştırmanız ve kampanya planlamanız önerilir.';
    }

    let criticalWarning = null;
    if (riskAssessment?.level === 'high' || changePct <= -20) {
        criticalWarning = 'Kritik uyarı: Tahmin dönemi güçlü düşüş veya yüksek risk sinyali taşıyor; nakit akışı ve gider kararları yakından izlenmeli.';
    }

    const seasonalityWarning = seasonality?.detected
        ? `${seasonality.peakPeriod} döneminde artış, ${seasonality.lowPeriod} döneminde zayıflama etkisi görülebilir.`
        : 'Belirgin mevsimsel etki tespit edilmedi.';

    return {
        summary: `Önümüzdeki 3 ay için satış tahmini ${formatCurrency(threeMonthForecast)}; ${strength} ${directionLabel} sinyali var.`,
        threeMonthForecast: Math.round(threeMonthForecast),
        confidenceInterval: {
            lower: Math.round(interval.lower),
            upper: Math.round(interval.upper),
            confidence: interval.confidence
        },
        trend: {
            direction,
            strength,
            changePct: Number(changePct.toFixed(1)),
            message: `${strength} ${directionLabel}`
        },
        seasonalityWarning,
        samePeriodLastYearComparison,
        actionSentence,
        criticalWarning,
        selectedModel: forecastResult.key,
        selectedModelLabel: forecastResult.label
    };
}

// ============================================
// SEASONALITY ANALYSIS
// ============================================

function analyzeSeasonality(monthlyData) {
    if (monthlyData.length < 6) {
        return {
            detected: false,
            message: 'Mevsimsellik analizi için en az 6 aylık veri gerekli.',
            quarterIndices: { Q1: 1.0, Q2: 1.0, Q3: 1.0, Q4: 1.0 }
        };
    }

    // Group by quarter
    const quarters = { Q1: [], Q2: [], Q3: [], Q4: [] };

    for (const d of monthlyData) {
        const month = parseInt(d.month.split('-')[1]);
        if (month <= 3) quarters.Q1.push(d.amount);
        else if (month <= 6) quarters.Q2.push(d.amount);
        else if (month <= 9) quarters.Q3.push(d.amount);
        else quarters.Q4.push(d.amount);
    }

    const qAvgs = {};
    for (const q in quarters) {
        if (quarters[q].length > 0) {
            qAvgs[q] = quarters[q].reduce((a, b) => a + b, 0) / quarters[q].length;
        }
    }

    const avgValues = Object.values(qAvgs);
    if (avgValues.length < 2) {
        return {
            detected: false,
            message: 'Yeterli çeyrek verisi yok.',
            quarterIndices: { Q1: 1.0, Q2: 1.0, Q3: 1.0, Q4: 1.0 }
        };
    }

    const overallAvg = avgValues.reduce((a, b) => a + b, 0) / avgValues.length;
    const maxQ = Object.entries(qAvgs).reduce((a, b) => b[1] > a[1] ? b : a);
    const minQ = Object.entries(qAvgs).reduce((a, b) => b[1] < a[1] ? b : a);

    // Detect seasonality if variance is significant (>15%)
    const variance = (maxQ[1] - minQ[1]) / overallAvg;
    const detected = variance > 0.15;

    const quarterIndices = detected ? {
        Q1: qAvgs.Q1 != null && overallAvg > 0 ? qAvgs.Q1 / overallAvg : 1.0,
        Q2: qAvgs.Q2 != null && overallAvg > 0 ? qAvgs.Q2 / overallAvg : 1.0,
        Q3: qAvgs.Q3 != null && overallAvg > 0 ? qAvgs.Q3 / overallAvg : 1.0,
        Q4: qAvgs.Q4 != null && overallAvg > 0 ? qAvgs.Q4 / overallAvg : 1.0
    } : { Q1: 1.0, Q2: 1.0, Q3: 1.0, Q4: 1.0 };

    const quarterNames = { Q1: 'Ocak-Mart', Q2: 'Nisan-Haziran', Q3: 'Temmuz-Eylül', Q4: 'Ekim-Aralık' };

    return {
        detected,
        peakQuarter: maxQ[0],
        peakPeriod: quarterNames[maxQ[0]],
        lowQuarter: minQ[0],
        lowPeriod: quarterNames[minQ[0]],
        variance: Math.round(variance * 100),
        quarterIndices,
        message: detected
            ? `En yüksek performans ${quarterNames[maxQ[0]]} döneminde, en düşük ${quarterNames[minQ[0]]} döneminde gözlemlendi.`
            : 'Belirgin bir mevsimsellik tespit edilmedi.'
    };
}

// ============================================
// RISK ASSESSMENT
// ============================================

function calculateRiskScore(monthlyData, trend) {
    const factors = [];
    let riskScore = 0;

    // 1. Volatility check
    const amounts = monthlyData.map(d => d.amount);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const coeffOfVar = (stdDev / avg) * 100;

    if (coeffOfVar > 30) {
        riskScore += 30;
        factors.push({ name: 'Yüksek Volatilite', severity: 'high', description: `Satış değişkenliği %${Math.round(coeffOfVar)} seviyesinde gözlemlenmektedir.` });
    } else if (coeffOfVar > 15) {
        riskScore += 15;
        factors.push({ name: 'Orta Volatilite', severity: 'medium', description: `Satış değişkenliği %${Math.round(coeffOfVar)} seviyesinde gözlemlenmektedir.` });
    }

    // 2. Declining trend
    if (trend === 'down') {
        riskScore += 25;
        factors.push({ name: 'Düşüş Trendi', severity: 'high', description: 'Geçmiş verilere dayanarak satışlarda düşüş eğilimi tespit edilmiştir.' });
    }

    // 3. Recent decline check (last 2 months)
    if (monthlyData.length >= 3) {
        const last3 = monthlyData.slice(-3);
        if (last3[2].amount < last3[1].amount && last3[1].amount < last3[0].amount) {
            riskScore += 20;
            factors.push({ name: 'Ardışık Düşüş', severity: 'high', description: 'Son 3 ayda ardışık düşüş gözlemlenmiştir.' });
        }
    }

    // 4. Low data points
    if (monthlyData.length < 6) {
        riskScore += 10;
        factors.push({ name: 'Sınırlı Veri', severity: 'low', description: 'Mevcut veri miktarı sınırlı olduğundan projeksiyon hassasiyeti düşük olabilir.' });
    }

    // Determine level
    let level = 'low';
    if (riskScore >= 50) level = 'high';
    else if (riskScore >= 25) level = 'medium';

    return { score: Math.min(100, riskScore), level, factors };
}

// ============================================
// INSIGHTS GENERATOR
// ============================================

function generateCEOInsights(data, predictions, trend, seasonality, risk, purchasePredictions, profitPredictions, avgMonthlyExpense) {
    const insights = [];
    const observations = [];
    const noteItems = [];

    const avgAmount = data.reduce((a, b) => a + b.amount, 0) / data.length;
    const lastAmount = data[data.length - 1].amount;
    const predictedNext = predictions[0]?.amount || 0;
    // Sıfıra bölme koruması: geçen ay 0 TL ise %Infinity yerine nötr 0.0 göster
    const growthPct = (lastAmount !== 0 && Number.isFinite(lastAmount))
        ? ((predictedNext - lastAmount) / lastAmount * 100).toFixed(1)
        : '0.0';

    // profit & expense context
    const nextProfit = profitPredictions?.[0]?.amount || 0;
    const nextNetProfit = nextProfit - (avgMonthlyExpense || 0);

    let executiveSummary = DISCLAIMER + ' ';

    if (trend === 'up') {
        executiveSummary += `Geçmiş verilere dayanarak yükseliş eğilimi gözlemlenmektedir. Önümüzdeki ay için projeksiyon ${formatCurrency(predictedNext)} olup, bu mevcut seviyenin %${Math.abs(growthPct)} üzerindedir.`;

        if (nextProfit > 0) {
            executiveSummary += ` Tahmini brüt kâr: ${formatCurrency(nextProfit)}.`;
        }

        observations.push('Geçmiş verilere göre satış hacminde artış eğilimi gözlemlenmektedir.');
        observations.push('Bilgilendirme amaçlı: mevcut stok ve operasyonel kapasite durumu değerlendirilebilir.');
        noteItems.push({ priority: 'high', action: 'Büyüme trendi detaylı incelenebilir', deadline: 'Bilgilendirme' });
    } else if (trend === 'down') {
        executiveSummary += `Geçmiş verilere dayanarak satışlarda düşüş eğilimi gözlemlenmektedir. Projeksiyon önümüzdeki ay için ${formatCurrency(predictedNext)} satış göstermektedir.`;

        observations.push('Geçmiş verilere göre maliyet kalemlerinin incelenmesi bilgilendirici olabilir.');
        observations.push('Müşteri hareketliliğinde değişim gözlemlenmiş olabilir.');
        observations.push('Bilgilendirme amaçlı: alternatif gelir kanalları incelenebilir.');
        noteItems.push({ priority: 'urgent', action: 'Maliyet dağılımı incelenebilir', deadline: 'Bilgilendirme' });
        noteItems.push({ priority: 'high', action: 'Müşteri verileri gözden geçirilebilir', deadline: 'Bilgilendirme' });
    } else {
        executiveSummary += `Geçmiş verilere dayanarak satışlarda stabil bir seyir gözlemlenmektedir. Mevcut performans düzeyi korunmaktadır.`;

        observations.push('Bilgilendirme amaçlı: pazar koşulları periyodik olarak gözden geçirilebilir.');
        noteItems.push({ priority: 'medium', action: 'Trend analizi periyodik olarak tekrarlanabilir', deadline: 'Bilgilendirme' });
    }

    // Expense-based insight
    if (avgMonthlyExpense > 0 && nextProfit > 0) {
        const expenseRatio = (avgMonthlyExpense / nextProfit * 100).toFixed(1);
        observations.push(`Aylık ortalama gider (${formatCurrency(avgMonthlyExpense)}), tahmini brüt kârın %${expenseRatio}'unu oluşturmaktadır.`);

        if (nextNetProfit < 0) {
            noteItems.push({ priority: 'urgent', action: 'Giderler brüt kârı aşıyor — gider optimizasyonu değerlendirilebilir', deadline: 'Acil' });
        }
    }

    // Seasonality insights
    if (seasonality.detected) {
        insights.push({
            type: 'seasonality',
            icon: '📅',
            title: 'Mevsimsellik Tespit Edildi',
            description: seasonality.message
        });

        observations.push(`Geçmiş verilere göre ${seasonality.peakPeriod} döneminde daha yüksek satış hacmi gözlemlenmiştir.`);
        observations.push(`${seasonality.lowPeriod} döneminde satış hacminin görece düşük kaldığı tespit edilmiştir.`);
    }

    // Risk insights
    if (risk.level === 'high') {
        insights.push({
            type: 'risk',
            icon: '⚠️',
            title: 'Yüksek Değişkenlik',
            description: 'Birden fazla değişkenlik faktörü tespit edilmiştir. Bilgilendirme amaçlı sunulmaktadır.'
        });
    }

    // Performance insight
    const performanceRatio = lastAmount / avgAmount;
    if (performanceRatio > 1.1) {
        insights.push({
            type: 'performance',
            icon: '🎯',
            title: 'Ortalamanın Üzerinde Performans',
            description: `Son ay performansı ortalamanın %${Math.round((performanceRatio - 1) * 100)} üzerinde gözlemlenmiştir.`
        });
    } else if (performanceRatio < 0.9) {
        insights.push({
            type: 'performance',
            icon: '📉',
            title: 'Ortalamanın Altında Performans',
            description: `Son ay performansı ortalamanın %${Math.round((1 - performanceRatio) * 100)} altında gözlemlenmiştir.`
        });
    }

    // Outlook
    let marketOutlook = '';
    let outlookType = 'neutral';
    if (trend === 'up' && risk.level === 'low') {
        marketOutlook = 'Pozitif Eğilim — Geçmiş verilere göre yükseliş trendi gözlemlenmektedir.';
        outlookType = 'positive';
    } else if (trend === 'up' && risk.level === 'medium') {
        marketOutlook = 'Pozitif Eğilim — Geçmiş verilere göre yükseliş trendi; risk seviyesi orta.';
        outlookType = 'positive';
    } else if (trend === 'up') {
        marketOutlook = 'Pozitif Eğilim — Geçmiş verilere göre yükseliş trendi gözlemlenmektedir.';
        outlookType = 'positive';
    } else if (trend === 'down' || risk.level === 'high') {
        marketOutlook = 'Düşüş Eğilimi — Geçmiş verilere göre düşüş trendi gözlemlenmektedir.';
        outlookType = 'negative';
    } else {
        marketOutlook = 'Stabil Seyir — Geçmiş verilere göre belirgin bir yön değişikliği gözlemlenmemektedir.';
        outlookType = 'neutral';
    }

    // CFO-Style Financial Metrics
    const profitMargin = null;
    const avgProfitMargin = null;

    // Çeyreklik büyüme
    const last3Months = data.slice(-3);
    const prev3Months = data.slice(-6, -3);
    let quarterlyGrowth = null;
    if (prev3Months.length === 3) {
        const last3Sum = last3Months.reduce((s, d) => s + d.amount, 0);
        const prev3Sum = prev3Months.reduce((s, d) => s + d.amount, 0);
        quarterlyGrowth = prev3Sum > 0 ? ((last3Sum - prev3Sum) / prev3Sum * 100).toFixed(1) : null;
    }

    // CFO Analysis - Missing Areas
    const missingAreas = [];

    if (data.length >= 3) {
        const last3 = data.slice(-3).map(d => d.amount);
        if (last3[2] < last3[1] && last3[1] < last3[0]) {
            missingAreas.push({
                area: 'Gelir Trendi',
                severity: 'high',
                description: 'Ardışık 3 aydır satışlarda düşüş gözlemlenmiştir.',
                action: 'Bilgilendirme amaçlı: satış kanalları ve müşteri portföyü incelenebilir.'
            });
        }
    }

    const volVariance = data.reduce((sum, d) => sum + Math.pow(d.amount - avgAmount, 2), 0) / data.length;
    const volatility = avgAmount > 0 ? (Math.sqrt(volVariance) / avgAmount * 100) : 0;
    if (volatility > 25) {
        missingAreas.push({
            area: 'Gelir İstikrarı',
            severity: 'medium',
            description: `%${volatility.toFixed(0)} gelir volatilitesi gözlemlenmiştir.`,
            action: 'Bilgilendirme amaçlı: gelir dağılımı detaylı incelenebilir.'
        });
    }

    if (seasonality.detected && seasonality.variance > 30) {
        missingAreas.push({
            area: 'Mevsimsel Bağımlılık',
            severity: 'medium',
            description: `%${seasonality.variance} sezonsal varyans gözlemlenmiştir.`,
            action: `Bilgilendirme amaçlı: ${seasonality.lowPeriod} dönemi ayrıca incelenebilir.`
        });
    }

    if (data.length < 12) {
        missingAreas.push({
            area: 'Veri Kapsama',
            severity: 'low',
            description: `Mevcut veri ${data.length} ay ile sınırlıdır.`,
            action: 'Projeksiyon hassasiyeti için en az 12 aylık veri girilebilir.'
        });
    }

    const recentPerformance = data.slice(-6).filter(d => d.amount > avgAmount * 1.1).length;
    if (recentPerformance === 0 && data.length >= 6) {
        missingAreas.push({
            area: 'Performans Gözlemi',
            severity: 'medium',
            description: 'Son 6 ayda ortalamanın üzerinde performans gözlemlenmemiştir.',
            action: 'Bilgilendirme amaçlı: dönemsel satış verileri detaylı incelenebilir.'
        });
    }

    const cfoMetrics = {
        profitMargin: profitMargin != null ? parseFloat(profitMargin) : null,
        avgProfitMargin: avgProfitMargin != null ? parseFloat(avgProfitMargin) : null,
        quarterlyGrowth: quarterlyGrowth != null ? parseFloat(quarterlyGrowth) : null,
        volatility: Number(volatility.toFixed(1)),
        dataMonths: data.length,
        missingAreas
    };

    return {
        executiveSummary,
        insights,
        recommendations: observations,
        actionItems: noteItems,
        marketOutlook,
        outlookType,
        cfoMetrics
    };
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(amount);
}

// ============================================
// ADVANCED BUSINESS STATISTICS
// ============================================

/**
 * Tek seri için istatistiksel özet: ortalama, medyan, stdDev, CV, min/max, son-ilk değişim
 */
function computeSeriesStats(data) {
    if (!data || data.length === 0) return null;
    const amounts = data.map(d => d.amount);
    const n = amounts.length;
    const sum = amounts.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const sorted = [...amounts].sort((a, b) => a - b);
    const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];
    const variance = amounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? (stdDev / mean) * 100 : 0;
    const min = sorted[0];
    const max = sorted[n - 1];
    const minIdx = amounts.indexOf(min);
    const maxIdx = amounts.indexOf(max);
    const first = amounts[0];
    const last = amounts[n - 1];
    const totalChangePct = first > 0 ? ((last - first) / first) * 100 : 0;

    // MoM değişim (son 2 ay)
    const momPct = n >= 2 && amounts[n - 2] > 0
        ? ((last - amounts[n - 2]) / amounts[n - 2]) * 100 : null;

    // YoY karşılaştırma (12 ay varsa son ay vs. -12)
    const yoyPct = n >= 13 && amounts[n - 13] > 0
        ? ((last - amounts[n - 13]) / amounts[n - 13]) * 100 : null;

    // Son 3 ay ort. vs. önceki 3 ay ort. (QoQ)
    let qoqPct = null;
    if (n >= 6) {
        const last3 = amounts.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const prev3 = amounts.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
        qoqPct = prev3 > 0 ? ((last3 - prev3) / prev3) * 100 : null;
    }

    // Pozitif / negatif ay sayısı
    const positiveMonths = amounts.filter(v => v > 0).length;
    const zeroMonths = amounts.filter(v => v === 0).length;

    return {
        n,
        sum: Math.round(sum),
        mean: Math.round(mean),
        median: Math.round(median),
        stdDev: Math.round(stdDev),
        cv: Number(cv.toFixed(1)),
        min: Math.round(min),
        max: Math.round(max),
        minMonth: data[minIdx]?.month || null,
        maxMonth: data[maxIdx]?.month || null,
        first: Math.round(first),
        last: Math.round(last),
        totalChangePct: Number(totalChangePct.toFixed(1)),
        momPct: momPct != null ? Number(momPct.toFixed(1)) : null,
        yoyPct: yoyPct != null ? Number(yoyPct.toFixed(1)) : null,
        qoqPct: qoqPct != null ? Number(qoqPct.toFixed(1)) : null,
        positiveMonths,
        zeroMonths
    };
}

/**
 * P10 / P50 / P90 senaryo tahminleri (kötü / baz / iyi) — regresyon SEE bazlı
 */
function buildScenarios(seriesResult) {
    if (!seriesResult || !seriesResult.predictions) return null;
    const q = seriesResult.regression?.residualQuantiles || { p10: 0, p90: 0 };
    return seriesResult.predictions.map((p, i) => {
        const band = seriesResult.confidenceBands?.[i];
        return {
            month: p.month,
            pessimistic: Math.max(0, Math.round(p.amount + q.p10)),
            base: p.amount,
            optimistic: Math.max(0, Math.round(p.amount + q.p90)),
            upper95: band?.upper ?? null,
            lower95: band?.lower ?? null
        };
    });
}

/**
 * Finansal sağlık göstergeleri: kâr marjı, breakeven, runway, gider oranı
 */
function computeFinancialHealth(salesStats, purchaseStats, profitPredictions, netProfitPredictions, avgMonthlyExpense, salesPredictions) {
    const health = {
        grossMarginPct: null,          // brüt kâr marjı (%)
        netMarginPct: null,            // net kâr marjı (%)
        avgGrossMarginPct: null,       // geçmişe dayalı ort. brüt marj
        expenseRatioPct: null,         // gider / brüt kâr (%)
        breakEvenSales: null,          // başa baş noktası (satış)
        breakEvenMonth: null,          // hangi tahmin ayında +net kâra geçiyor
        runwayMonths: null,            // mevcut nakit yok — proxy: net kâr negatifse kaç ay öncesi ort.
        profitableMonthsAhead: 0,      // 3 ayda kaç ay net kâr > 0
        lossMonthsAhead: 0,
        avgPurchaseRatio: null,        // alış / satış oranı (%)
        salesVolatilityPct: null,
        purchaseVolatilityPct: null,
        avgNetProfitAhead: null,
        downsideNetProfit: null,
        salesToBreakEvenGapPct: null,
        costCoveragePct: null
    };

    // Geçmiş ortalama brüt marj
    if (salesStats && purchaseStats && salesStats.mean > 0) {
        const avgGross = salesStats.mean - purchaseStats.mean;
        health.avgGrossMarginPct = Number(((avgGross / salesStats.mean) * 100).toFixed(1));
        health.avgPurchaseRatio = Number(((purchaseStats.mean / salesStats.mean) * 100).toFixed(1));
    }
    if (salesStats?.cv != null) health.salesVolatilityPct = salesStats.cv;
    if (purchaseStats?.cv != null) health.purchaseVolatilityPct = purchaseStats.cv;

    // Gelecek ay kâr marjı
    if (profitPredictions && salesPredictions && salesPredictions[0]?.amount > 0) {
        const grossMargin = (profitPredictions[0].amount / salesPredictions[0].amount) * 100;
        health.grossMarginPct = Number(grossMargin.toFixed(1));
    }

    // Net kâr marjı
    if (netProfitPredictions && salesPredictions && salesPredictions[0]?.amount > 0) {
        const netMargin = (netProfitPredictions[0].amount / salesPredictions[0].amount) * 100;
        health.netMarginPct = Number(netMargin.toFixed(1));
    }

    // Gider oranı (gider / brüt kâr)
    if (avgMonthlyExpense > 0 && profitPredictions && profitPredictions[0]?.amount > 0) {
        health.expenseRatioPct = Number(((avgMonthlyExpense / profitPredictions[0].amount) * 100).toFixed(1));
        health.costCoveragePct = Number(((profitPredictions[0].amount / avgMonthlyExpense) * 100).toFixed(1));
    }

    // Breakeven satış: gider + (alış oranı × satış) = satış → breakeven = gider / (1 - alışOranı)
    if (avgMonthlyExpense > 0 && health.avgPurchaseRatio != null) {
        const purchaseRatio = health.avgPurchaseRatio / 100;
        if (purchaseRatio < 1) {
            health.breakEvenSales = Math.round(avgMonthlyExpense / (1 - purchaseRatio));
        }
    }

    // Aylık net kâr durumu
    if (netProfitPredictions) {
        health.profitableMonthsAhead = netProfitPredictions.filter(p => p.amount > 0).length;
        health.lossMonthsAhead = netProfitPredictions.filter(p => p.amount < 0).length;
        const netAmounts = netProfitPredictions.map(p => p.amount);
        health.avgNetProfitAhead = Math.round(netAmounts.reduce((sum, val) => sum + val, 0) / netAmounts.length);
        health.downsideNetProfit = Math.min(...netAmounts);
        const firstProfitIdx = netProfitPredictions.findIndex(p => p.amount > 0);
        if (firstProfitIdx !== -1) {
            health.breakEvenMonth = netProfitPredictions[firstProfitIdx].month;
        }
    }
    if (health.breakEvenSales != null && salesPredictions?.[0]?.amount > 0) {
        health.salesToBreakEvenGapPct = Number((((salesPredictions[0].amount - health.breakEvenSales) / health.breakEvenSales) * 100).toFixed(1));
    }

    return health;
}

/**
 * Büyüme analizleri: CMGR, hareketli ortalama, momentum
 */
function computeGrowthMetrics(data) {
    if (!data || data.length < 2) return null;
    const amounts = data.map(d => d.amount);
    const n = amounts.length;

    // CMGR (Compound Monthly Growth Rate)
    const first = amounts[0];
    const last = amounts[n - 1];
    const cmgr = (first > 0 && n > 1) ? (Math.pow(last / first, 1 / (n - 1)) - 1) * 100 : 0;

    // 3 aylık hareketli ortalama (son nokta)
    let ma3 = null;
    if (n >= 3) ma3 = amounts.slice(-3).reduce((a, b) => a + b, 0) / 3;

    // 6 aylık hareketli ortalama
    let ma6 = null;
    if (n >= 6) ma6 = amounts.slice(-6).reduce((a, b) => a + b, 0) / 6;

    // Momentum: son ay vs. 3 ay ort.
    const momentum = (ma3 && ma3 > 0) ? ((last - ma3) / ma3) * 100 : null;

    // Kaç aydır artış eğilimi var
    let consecutiveUp = 0;
    for (let i = n - 1; i > 0; i--) {
        if (amounts[i] > amounts[i - 1]) consecutiveUp++;
        else break;
    }
    let consecutiveDown = 0;
    for (let i = n - 1; i > 0; i--) {
        if (amounts[i] < amounts[i - 1]) consecutiveDown++;
        else break;
    }

    return {
        cmgrPct: Number(cmgr.toFixed(2)),
        ma3: ma3 != null ? Math.round(ma3) : null,
        ma6: ma6 != null ? Math.round(ma6) : null,
        momentumPct: momentum != null ? Number(momentum.toFixed(1)) : null,
        consecutiveUp,
        consecutiveDown
    };
}

/**
 * Ana istatistik paketi: hepsini bir araya getirir
 */
function buildBusinessStats(salesData, purchaseData, salesResult, purchaseResult, profitPredictions, netProfitPredictions, avgMonthlyExpense) {
    const salesStats = computeSeriesStats(salesData);
    const purchaseStats = purchaseData && purchaseData.length > 0 ? computeSeriesStats(purchaseData) : null;

    // Geçmiş brüt kâr serisi
    let profitStats = null;
    if (purchaseData && purchaseData.length === salesData.length) {
        const profitSeries = salesData.map((s, i) => ({
            month: s.month,
            amount: s.amount - (purchaseData[i]?.amount || 0)
        }));
        profitStats = computeSeriesStats(profitSeries);
    }

    const salesGrowth = computeGrowthMetrics(salesData);
    const purchaseGrowth = purchaseData && purchaseData.length > 1 ? computeGrowthMetrics(purchaseData) : null;

    const salesScenarios = buildScenarios(salesResult);
    const purchaseScenarios = purchaseResult ? buildScenarios(purchaseResult) : null;

    const financialHealth = computeFinancialHealth(
        salesStats, purchaseStats, profitPredictions, netProfitPredictions, avgMonthlyExpense,
        salesResult?.predictions
    );

    // Regresyon kalite metrikleri
    const regressionQuality = salesResult?.regression ? {
        rSquared: Number((salesResult.regression.rSquared * 100).toFixed(1)),
        see: Math.round(salesResult.regression.see),
        seSlope: Math.round(salesResult.regression.seSlope),
        slope: Math.round(salesResult.regression.slope),
        interpretation: (() => {
            const r2 = salesResult.regression.rSquared;
            if (r2 >= 0.8) return 'Güçlü doğrusal ilişki — trend oldukça tutarlı.';
            if (r2 >= 0.5) return 'Orta düzeyde doğrusal ilişki — trend kısmen tutarlı.';
            if (r2 >= 0.25) return 'Zayıf doğrusal ilişki — veri dalgalı seyrediyor.';
            return 'Çok zayıf ilişki — tahminler büyük belirsizlik içerir.';
        })()
    } : null;

    return {
        sales: salesStats,
        purchase: purchaseStats,
        profit: profitStats,
        salesGrowth,
        purchaseGrowth,
        scenarios: {
            sales: salesScenarios,
            purchase: purchaseScenarios
        },
        financialHealth,
        regressionQuality,
        modelDiagnostics: {
            intervalMethod: salesResult?.diagnostics?.intervalMethod || 'empirical_residual_quantile',
            sales: salesResult?.diagnostics || null,
            purchase: purchaseResult?.diagnostics || null
        }
    };
}

// ============================================
// MAIN PREDICTION FUNCTION (Multi-Series)
// ============================================

/**
 * @param {Array} salesData   - [{ month, amount }]
 * @param {Array} purchaseData - [{ month, amount }] (optional)
 * @param {number} avgMonthlyExpense - ortalama aylık gider (optional)
 */
function predictNextMonths(salesData, purchaseData, avgMonthlyExpense, options = {}) {
    // Backward compat: first arg can be the old single-series call
    if (!salesData || salesData.length < 3) {
        return {
            predictions: [],
            confidenceBands: [],
            allPredictions: [],
            allConfidenceBands: [],
            forecastHorizons: [],
            purchasePredictions: [],
            profitPredictions: [],
            netProfitPredictions: [],
            businessStats: null,
            trend: 'insufficient_data',
            confidence: 0,
            ceoAnalysis: {
                executiveSummary: DISCLAIMER + ' Projeksiyon hesaplayabilmek için en az 3 aylık veri gerekmektedir.',
                insights: [],
                recommendations: ['Bilgilendirme amaçlı: düzenli veri girişi projeksiyon hassasiyetini artırır.'],
                actionItems: [{ priority: 'high', action: 'Geçmiş veriler sisteme girilebilir', deadline: 'Bilgilendirme' }],
                marketOutlook: 'Yetersiz Veri'
            },
            seasonality: { detected: false },
            riskAssessment: { score: 0, level: 'unknown', factors: [] },
            modelSelection: {
                selectedModel: null,
                selectedLabel: 'Yetersiz veri',
                selectionMode: 'none',
                reason: 'Projeksiyon için en az 3 aylık satış verisi gerekir.',
                metrics: { mae: 0, rmse: 0, mape: null }
            },
            modelComparison: MODEL_KEYS.map(key => ({
                key,
                label: MODEL_LABELS[key],
                available: false,
                selected: false,
                mae: null,
                rmse: null,
                mape: null,
                reason: 'Yetersiz veri'
            })),
            accountantFeedback: null,
            detailedStatistics: null
        };
    }

    const seasonality = analyzeSeasonality(salesData);

    // === Sales prediction ===
    const linearCompatResult = predictSeries(salesData, seasonality);
    const suite = buildForecastModelSuite(salesData, options);
    if (!suite.selected || !linearCompatResult) return null;
    const selectedSalesResult = suite.selected;
    const salesResult = {
        regression: linearCompatResult.regression,
        predictions: selectedSalesResult.predictions.slice(0, REGRESSION_MONTHS),
        confidenceBands: selectedSalesResult.confidenceBands.slice(0, REGRESSION_MONTHS),
        trend: selectedSalesResult.trend,
        confidence: selectedSalesResult.confidence,
        cmgr: linearCompatResult.cmgr,
        slope: selectedSalesResult.params?.slope ?? linearCompatResult.slope,
        diagnostics: {
            residuals: selectedSalesResult.residuals.map(v => Math.round(v)),
            mae: Math.round(selectedSalesResult.mae || 0),
            rmse: Math.round(selectedSalesResult.rmse || 0),
            mape: selectedSalesResult.mape == null ? 0 : Number(selectedSalesResult.mape.toFixed(2)),
            residualQuantiles: linearCompatResult.diagnostics.residualQuantiles,
            intervalMethod: 'model_residual_interval'
        },
        modelKey: selectedSalesResult.key,
        modelLabel: selectedSalesResult.label
    };

    // === Purchase prediction ===
    let purchaseResult = null;
    if (purchaseData && purchaseData.length >= 3) {
        const purchaseSuite = buildForecastModelSuite(purchaseData, {
            model: options.purchaseModel || options.model || 'auto'
        });
        const selectedPurchase = purchaseSuite.selected;
        if (selectedPurchase) {
            purchaseResult = {
                predictions: selectedPurchase.predictions.slice(0, REGRESSION_MONTHS),
                confidenceBands: selectedPurchase.confidenceBands.slice(0, REGRESSION_MONTHS),
                trend: selectedPurchase.trend,
                confidence: selectedPurchase.confidence,
                diagnostics: {
                    residuals: selectedPurchase.residuals.map(v => Math.round(v)),
                    mae: Math.round(selectedPurchase.mae || 0),
                    rmse: Math.round(selectedPurchase.rmse || 0),
                    mape: selectedPurchase.mape == null ? 0 : Number(selectedPurchase.mape.toFixed(2)),
                    intervalMethod: 'model_residual_interval'
                }
            };
        }
    }

    // === Profit prediction (derived) ===
    let profitPredictions = null;
    if (purchaseResult) {
        profitPredictions = salesResult.predictions.map((sp, i) => {
            const pp = purchaseResult.predictions[i];
            return {
                month: sp.month,
                amount: Math.round(sp.amount - (pp?.amount || 0))
            };
        });
    }

    // === Net profit (profit - expense) ===
    let netProfitPredictions = null;
    if (profitPredictions && avgMonthlyExpense != null) {
        netProfitPredictions = profitPredictions.map(p => ({
            month: p.month,
            amount: Math.round(p.amount - avgMonthlyExpense)
        }));
    }

    // Advanced analyses (sales-based)
    const riskAssessment = calculateRiskScore(salesData, salesResult.trend);
    const ceoAnalysis = generateCEOInsights(
        salesData, salesResult.predictions, salesResult.trend,
        seasonality, riskAssessment,
        purchaseResult?.predictions, profitPredictions, avgMonthlyExpense
    );
    const forecastHorizons = buildForecastHorizons(selectedSalesResult.predictions, selectedSalesResult.confidenceBands);
    const accountantFeedback = buildAccountantFeedback(salesData, selectedSalesResult, seasonality, riskAssessment);

    // Kapsamlı iş istatistikleri
    const businessStats = buildBusinessStats(
        salesData, purchaseData, salesResult, purchaseResult,
        profitPredictions, netProfitPredictions, avgMonthlyExpense
    );

    return {
        // Sales (primary — backward compat)
        predictions: salesResult.predictions,
        allPredictions: selectedSalesResult.predictions,
        trend: salesResult.trend,
        slope: salesResult.slope,
        confidence: salesResult.confidence,
        avgMonthlyGrowth: salesResult.slope,
        avgMonthlyGrowthPct: salesResult.cmgr,
        confidenceBands: salesResult.confidenceBands,
        allConfidenceBands: selectedSalesResult.confidenceBands,
        forecastHorizons,

        // Purchase
        purchasePredictions: purchaseResult?.predictions || null,
        purchaseTrend: purchaseResult?.trend || null,
        purchaseConfidence: purchaseResult?.confidence || null,

        // Profit (derived)
        profitPredictions,
        netProfitPredictions,

        // Analytics
        ceoAnalysis,
        seasonality,
        riskAssessment,
        modelSelection: suite.modelSelection,
        modelComparison: suite.comparison,
        accountantFeedback,
        detailedStatistics: {
            trendCoefficient: salesResult.slope,
            seasonalIndices: seasonality?.quarterIndices || null,
            modelParameters: selectedSalesResult.params,
            selectedModel: selectedSalesResult.key,
            selectedModelLabel: selectedSalesResult.label
        },

        // Kapsamlı iş istatistikleri
        businessStats,

        // Meta
        avgMonthlyExpense: avgMonthlyExpense || 0
    };
}

function getQuarterForMonth(month) {
    if (month <= 3) return 'Q1';
    if (month <= 6) return 'Q2';
    if (month <= 9) return 'Q3';
    return 'Q4';
}

module.exports = {
    predictNextMonths,
    analyzeSeasonality,
    calculateRiskScore,
    predictSeries,
    calculateLinearRegression,
    generateCEOInsights,
    formatCurrency,
    computeSeriesStats,
    buildScenarios,
    computeFinancialHealth,
    computeGrowthMetrics,
    buildBusinessStats
};
