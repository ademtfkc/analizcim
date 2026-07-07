const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
    calculateLinearRegression,
    predictSeries,
    predictNextMonths,
    analyzeSeasonality,
    calculateRiskScore,
    generateCEOInsights,
    formatCurrency,
    computeFinancialHealth,
    buildBusinessStats
} = require('../../src/predictor');

describe('predictor.js - calculateLinearRegression', () => {
    test('should calculate linear regression for valid data', () => {
        const data = [
            { x: 0, y: 100 },
            { x: 1, y: 150 },
            { x: 2, y: 200 },
            { x: 3, y: 250 }
        ];

        const result = calculateLinearRegression(data);
        assert.ok(result);
        assert.ok(result.slope !== undefined);
        assert.ok(result.intercept !== undefined);
        assert.ok(result.rSquared !== undefined);
        assert.ok(result.n === 4);
    });

    test('should return null for insufficient data', () => {
        const data = [{ x: 0, y: 100 }];
        const result = calculateLinearRegression(data);
        assert.strictEqual(result, null);
    });

    test('should calculate correct slope for linear data', () => {
        const data = [
            { x: 0, y: 0 },
            { x: 1, y: 10 },
            { x: 2, y: 20 },
            { x: 3, y: 30 }
        ];

        const result = calculateLinearRegression(data);
        assert.ok(Math.abs(result.slope - 10) < 0.01);
        assert.ok(Math.abs(result.intercept) < 0.01);
    });

    test('should calculate perfect rSquared for perfect fit', () => {
        const data = [
            { x: 0, y: 0 },
            { x: 1, y: 10 },
            { x: 2, y: 20 },
            { x: 3, y: 30 }
        ];

        const result = calculateLinearRegression(data);
        assert.ok(result.rSquared >= 0.99);
    });

    test('should handle horizontal line', () => {
        const data = [
            { x: 0, y: 100 },
            { x: 1, y: 100 },
            { x: 2, y: 100 }
        ];

        const result = calculateLinearRegression(data);
        assert.ok(Math.abs(result.slope) < 0.001);
        assert.strictEqual(result.intercept, 100);
    });
});

describe('predictor.js - predictSeries', () => {
    test('should predict next months for valid data', () => {
        const dataArray = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];

        const result = predictSeries(dataArray);
        assert.ok(result);
        assert.ok(result.predictions);
        assert.ok(result.predictions.length > 0);
        assert.ok(result.confidenceBands);
        assert.ok(result.trend);
        assert.ok(result.confidence !== undefined);
    });

    test('should return null for insufficient data', () => {
        const dataArray = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 }
        ];

        const result = predictSeries(dataArray);
        assert.strictEqual(result, null);
    });

    test('should detect upward trend', () => {
        const dataArray = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];

        const result = predictSeries(dataArray);
        assert.strictEqual(result.trend, 'up');
    });

    test('should detect downward trend', () => {
        const dataArray = [
            { month: '2024-01', amount: 30000 },
            { month: '2024-02', amount: 25000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 15000 },
            { month: '2024-05', amount: 10000 }
        ];

        const result = predictSeries(dataArray);
        assert.strictEqual(result.trend, 'down');
    });

    test('should calculate confidence correctly', () => {
        const dataArray = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 10000 },
            { month: '2024-03', amount: 10000 },
            { month: '2024-04', amount: 10000 },
            { month: '2024-05', amount: 10000 }
        ];

        const result = predictSeries(dataArray);
        assert.ok(result.confidence >= 0);
        assert.ok(result.confidence <= 100);
    });

    test('should calculate CMGR', () => {
        const dataArray = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 11000 },
            { month: '2024-03', amount: 12100 },
            { month: '2024-04', amount: 13310 },
            { month: '2024-05', amount: 14641 }
        ];

        const result = predictSeries(dataArray);
        assert.ok(result.cmgr !== undefined);
    });

    test('should generate confidence bands', () => {
        const dataArray = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];

        const result = predictSeries(dataArray);
        assert.ok(result.confidenceBands.length > 0);
        assert.ok(result.confidenceBands[0].upper !== undefined);
        assert.ok(result.confidenceBands[0].lower !== undefined);
    });

    test('should expose empirical residual diagnostics for data-driven intervals', () => {
        const dataArray = [
            { month: '2024-01', amount: 1000 },
            { month: '2024-02', amount: 1080 },
            { month: '2024-03', amount: 1210 },
            { month: '2024-04', amount: 1280 },
            { month: '2024-05', amount: 1425 },
            { month: '2024-06', amount: 1510 }
        ];

        const result = predictSeries(dataArray);

        assert.ok(result.diagnostics);
        assert.ok(Array.isArray(result.diagnostics.residuals));
        assert.equal(result.diagnostics.residuals.length, dataArray.length);
        assert.ok(Number.isFinite(result.diagnostics.mae));
        assert.ok(Number.isFinite(result.diagnostics.rmse));
        assert.ok(Number.isFinite(result.diagnostics.mape));
        assert.ok(result.diagnostics.residualQuantiles.p10 !== undefined);
        assert.ok(result.diagnostics.residualQuantiles.p90 !== undefined);
        assert.equal(result.confidenceBands[0].method, 'empirical_residual_quantile');
    });
});

describe('predictor.js - predictNextMonths', () => {
    test('should return insufficient data error for less than 3 months', () => {
        const salesData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 }
        ];

        const result = predictNextMonths(salesData);
        assert.ok(result);
        assert.strictEqual(result.trend, 'insufficient_data');
        assert.strictEqual(result.confidence, 0);
        assert.ok(result.predictions);
        assert.strictEqual(result.predictions.length, 0);
    });

    test('should predict with valid sales data', () => {
        const salesData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];

        const result = predictNextMonths(salesData);
        assert.ok(result);
        assert.ok(result.predictions.length > 0);
        assert.ok(result.trend);
    });

    test('should include purchase predictions when provided', () => {
        const salesData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];
        const purchaseData = [
            { month: '2024-01', amount: 5000 },
            { month: '2024-02', amount: 6000 },
            { month: '2024-03', amount: 7000 },
            { month: '2024-04', amount: 8000 },
            { month: '2024-05', amount: 9000 }
        ];

        const result = predictNextMonths(salesData, purchaseData);
        assert.ok(result);
        assert.ok(result.profitPredictions);
    });

    test('should calculate net profit with expense', () => {
        const salesData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];
        const purchaseData = [
            { month: '2024-01', amount: 5000 },
            { month: '2024-02', amount: 6000 },
            { month: '2024-03', amount: 7000 },
            { month: '2024-04', amount: 8000 },
            { month: '2024-05', amount: 9000 }
        ];
        const avgMonthlyExpense = 3000;

        const result = predictNextMonths(salesData, purchaseData, avgMonthlyExpense);
        assert.ok(result);
        assert.ok(result.netProfitPredictions);
    });

    test('should include CEO analysis', () => {
        const salesData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];

        const result = predictNextMonths(salesData);
        assert.ok(result);
        assert.ok(result.ceoAnalysis);
        assert.ok(result.ceoAnalysis.executiveSummary);
    });

    test('should include seasonality analysis', () => {
        const salesData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 },
            { month: '2024-06', amount: 35000 },
            { month: '2024-07', amount: 40000 }
        ];

        const result = predictNextMonths(salesData);
        assert.ok(result);
        assert.ok(result.seasonality);
    });

    test('should include risk assessment', () => {
        const salesData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];

        const result = predictNextMonths(salesData);
        assert.ok(result);
        assert.ok(result.riskAssessment);
    });

    test('should compare statistical models and select one automatically', () => {
        const salesData = [
            { month: '2023-01', amount: 12000 },
            { month: '2023-02', amount: 12800 },
            { month: '2023-03', amount: 13500 },
            { month: '2023-04', amount: 14200 },
            { month: '2023-05', amount: 15000 },
            { month: '2023-06', amount: 15800 },
            { month: '2023-07', amount: 16600 },
            { month: '2023-08', amount: 17400 },
            { month: '2023-09', amount: 18300 },
            { month: '2023-10', amount: 19100 },
            { month: '2023-11', amount: 20000 },
            { month: '2023-12', amount: 21000 }
        ];

        const result = predictNextMonths(salesData);

        assert.ok(result.modelSelection);
        assert.ok(['linear', 'exponentialSmoothing', 'holtWinters', 'arima'].includes(result.modelSelection.selectedModel));
        assert.ok(Array.isArray(result.modelComparison));
        assert.ok(result.modelComparison.length >= 4);
        assert.ok(result.modelComparison.some(model => model.key === 'arima' && model.available));
        assert.ok(result.modelComparison.some(model => model.selected));
        assert.ok(result.modelComparison.every(model => Number.isFinite(model.mae) || model.available === false));
        assert.ok(result.modelComparison.every(model => Number.isFinite(model.rmse) || model.available === false));
    });

    test('should provide 1, 3, 6 and 12 month forecast horizons without changing 3 month compatibility field', () => {
        const salesData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 11200 },
            { month: '2024-03', amount: 11800 },
            { month: '2024-04', amount: 12500 },
            { month: '2024-05', amount: 13400 },
            { month: '2024-06', amount: 14100 },
            { month: '2024-07', amount: 14900 },
            { month: '2024-08', amount: 15700 },
            { month: '2024-09', amount: 16600 },
            { month: '2024-10', amount: 17400 },
            { month: '2024-11', amount: 18200 },
            { month: '2024-12', amount: 19100 }
        ];

        const result = predictNextMonths(salesData);

        assert.equal(result.predictions.length, 3);
        assert.equal(result.allPredictions.length, 12);
        assert.equal(result.allConfidenceBands.length, 12);
        assert.deepEqual(result.forecastHorizons.map(h => h.months), [1, 3, 6, 12]);
        assert.ok(result.forecastHorizons.every(h => Number.isFinite(h.total)));
        assert.ok(result.forecastHorizons.every(h => h.lower <= h.total && h.upper >= h.total));
    });

    test('should allow a supported model to be selected manually', () => {
        const salesData = [
            { month: '2024-01', amount: 20000 },
            { month: '2024-02', amount: 20500 },
            { month: '2024-03', amount: 19800 },
            { month: '2024-04', amount: 21000 },
            { month: '2024-05', amount: 20700 },
            { month: '2024-06', amount: 21400 },
            { month: '2024-07', amount: 21100 },
            { month: '2024-08', amount: 21800 }
        ];

        const result = predictNextMonths(salesData, null, 0, { model: 'exponentialSmoothing' });

        assert.equal(result.modelSelection.selectedModel, 'exponentialSmoothing');
        assert.equal(result.modelSelection.selectionMode, 'manual');
        assert.ok(result.modelComparison.find(model => model.key === 'exponentialSmoothing').selected);
    });

    test('should use the native ARIMA package when ARIMA is selected manually', () => {
        const salesData = [
            { month: '2023-01', amount: 18000 },
            { month: '2023-02', amount: 19200 },
            { month: '2023-03', amount: 20500 },
            { month: '2023-04', amount: 21200 },
            { month: '2023-05', amount: 22800 },
            { month: '2023-06', amount: 24100 },
            { month: '2023-07', amount: 25700 },
            { month: '2023-08', amount: 26300 },
            { month: '2023-09', amount: 27900 },
            { month: '2023-10', amount: 29200 },
            { month: '2023-11', amount: 30800 },
            { month: '2023-12', amount: 32100 },
            { month: '2024-01', amount: 33600 },
            { month: '2024-02', amount: 34900 },
            { month: '2024-03', amount: 36500 },
            { month: '2024-04', amount: 37900 }
        ];

        const result = predictNextMonths(salesData, null, 0, { model: 'arima' });
        const arimaRow = result.modelComparison.find(model => model.key === 'arima');

        assert.equal(result.modelSelection.selectedModel, 'arima');
        assert.equal(result.modelSelection.selectionMode, 'manual');
        assert.ok(arimaRow.available);
        assert.equal(arimaRow.selected, true);
        assert.equal(result.detailedStatistics.modelParameters.arimaEngine, 'arima');
        assert.match(result.detailedStatistics.modelParameters.order, /^\(\d+,\d+,\d+\)/);
        assert.equal(result.allPredictions.length, 12);
    });

    test('should generate accountant feedback with trend, interval, comparison and action rules', () => {
        const salesData = [
            { month: '2023-01', amount: 42000 },
            { month: '2023-02', amount: 41000 },
            { month: '2023-03', amount: 39500 },
            { month: '2023-04', amount: 38000 },
            { month: '2023-05', amount: 37000 },
            { month: '2023-06', amount: 35000 },
            { month: '2023-07', amount: 33500 },
            { month: '2023-08', amount: 32000 },
            { month: '2023-09', amount: 30200 },
            { month: '2023-10', amount: 28500 },
            { month: '2023-11', amount: 27000 },
            { month: '2023-12', amount: 25000 },
            { month: '2024-01', amount: 23500 },
            { month: '2024-02', amount: 22000 }
        ];

        const result = predictNextMonths(salesData);
        const feedback = result.accountantFeedback;

        assert.ok(feedback);
        assert.ok(Number.isFinite(feedback.threeMonthForecast));
        assert.ok(feedback.confidenceInterval.lower <= feedback.confidenceInterval.upper);
        assert.equal(feedback.trend.direction, 'down');
        assert.ok(['hafif', 'orta', 'güçlü'].includes(feedback.trend.strength));
        assert.ok(typeof feedback.actionSentence === 'string' && feedback.actionSentence.length > 20);
        assert.ok(typeof feedback.summary === 'string' && feedback.summary.includes('3 ay'));
        assert.ok(feedback.samePeriodLastYearComparison == null || Number.isFinite(feedback.samePeriodLastYearComparison.changePct));
    });
});

describe('predictor.js - financial health diagnostics', () => {
    test('should calculate richer financial health metrics from observed data and predictions', () => {
        const salesStats = { mean: 10000, stdDev: 1200, cv: 12 };
        const purchaseStats = { mean: 6500, stdDev: 900, cv: 13.8 };
        const profitPredictions = [
            { month: '2024-07', amount: 3500 },
            { month: '2024-08', amount: 3800 },
            { month: '2024-09', amount: 3200 }
        ];
        const netProfitPredictions = [
            { month: '2024-07', amount: 2500 },
            { month: '2024-08', amount: 2800 },
            { month: '2024-09', amount: 2200 }
        ];
        const salesPredictions = [
            { month: '2024-07', amount: 10500 },
            { month: '2024-08', amount: 11000 },
            { month: '2024-09', amount: 9800 }
        ];

        const health = computeFinancialHealth(
            salesStats,
            purchaseStats,
            profitPredictions,
            netProfitPredictions,
            1000,
            salesPredictions
        );

        assert.equal(health.salesVolatilityPct, 12);
        assert.equal(health.purchaseVolatilityPct, 13.8);
        assert.equal(health.avgNetProfitAhead, 2500);
        assert.equal(health.downsideNetProfit, 2200);
        assert.ok(Number.isFinite(health.salesToBreakEvenGapPct));
        assert.ok(Number.isFinite(health.costCoveragePct));
    });

    test('should include model diagnostics in business stats without assumed distributions', () => {
        const sales = [
            { month: '2024-01', amount: 1000 },
            { month: '2024-02', amount: 1100 },
            { month: '2024-03', amount: 1180 },
            { month: '2024-04', amount: 1300 },
            { month: '2024-05', amount: 1390 },
            { month: '2024-06', amount: 1500 }
        ];
        const purchases = sales.map((item) => ({ month: item.month, amount: Math.round(item.amount * 0.62) }));
        const salesResult = predictSeries(sales);
        const purchaseResult = predictSeries(purchases);
        const profitPredictions = salesResult.predictions.map((prediction, index) => ({
            month: prediction.month,
            amount: prediction.amount - purchaseResult.predictions[index].amount
        }));

        const stats = buildBusinessStats(sales, purchases, salesResult, purchaseResult, profitPredictions, profitPredictions, 0);

        assert.ok(stats.modelDiagnostics);
        assert.ok(Number.isFinite(stats.modelDiagnostics.sales.mape));
        assert.ok(Number.isFinite(stats.modelDiagnostics.sales.mae));
        assert.equal(stats.modelDiagnostics.intervalMethod, 'empirical_residual_quantile');
    });
});

describe('predictor.js - analyzeSeasonality', () => {
    test('should return error for insufficient data', () => {
        const monthlyData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 }
        ];

        const result = analyzeSeasonality(monthlyData);
        assert.ok(result);
        assert.strictEqual(result.detected, false);
    });

    test('should detect seasonality with enough variance', () => {
        const monthlyData = [
            { month: '2024-01', amount: 10000 },  // Q1
            { month: '2024-02', amount: 11000 },
            { month: '2024-03', amount: 12000 },
            { month: '2024-04', amount: 50000 },  // Q2 - high
            { month: '2024-05', amount: 55000 },
            { month: '2024-06', amount: 60000 },
            { month: '2024-07', amount: 10000 },  // Q3 - low
            { month: '2024-08', amount: 11000 },
            { month: '2024-09', amount: 12000 }
        ];

        const result = analyzeSeasonality(monthlyData);
        assert.ok(result);
    });

    test('should not detect seasonality with low variance', () => {
        const monthlyData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 10500 },
            { month: '2024-03', amount: 11000 },
            { month: '2024-04', amount: 11500 },
            { month: '2024-05', amount: 12000 },
            { month: '2024-06', amount: 12500 }
        ];

        const result = analyzeSeasonality(monthlyData);
        assert.ok(result);
        assert.strictEqual(result.detected, false);
    });
});

describe('predictor.js - calculateRiskScore', () => {
    test('should calculate low risk for stable data', () => {
        const monthlyData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 10500 },
            { month: '2024-03', amount: 10000 },
            { month: '2024-04', amount: 10200 },
            { month: '2024-05', amount: 10000 },
            { month: '2024-06', amount: 10100 }
        ];

        const result = calculateRiskScore(monthlyData, 'stable');
        assert.ok(result);
        assert.ok(result.score !== undefined);
        assert.ok(result.level);
        assert.ok(result.factors);
    });

    test('should calculate high risk for volatile data', () => {
        const monthlyData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 50000 },
            { month: '2024-03', amount: 10000 },
            { month: '2024-04', amount: 50000 },
            { month: '2024-05', amount: 10000 },
            { month: '2024-06', amount: 50000 }
        ];

        const result = calculateRiskScore(monthlyData, 'up');
        assert.ok(result);
        assert.ok(result.score > 0);
    });

    test('should add risk for declining trend', () => {
        const monthlyData = [
            { month: '2024-01', amount: 30000 },
            { month: '2024-02', amount: 25000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 15000 },
            { month: '2024-05', amount: 10000 },
            { month: '2024-06', amount: 5000 }
        ];

        const result = calculateRiskScore(monthlyData, 'down');
        assert.ok(result);
        assert.ok(result.score >= 25);
    });

    test('should add risk for consecutive decline', () => {
        const monthlyData = [
            { month: '2024-01', amount: 30000 },
            { month: '2024-02', amount: 25000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 15000 }
        ];

        const result = calculateRiskScore(monthlyData, 'down');
        assert.ok(result);
        assert.ok(result.factors.some(f => f.name === 'Ardışık Düşüş'));
    });

    test('should add risk for limited data', () => {
        const monthlyData = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 12000 }
        ];

        const result = calculateRiskScore(monthlyData, 'stable');
        assert.ok(result);
        assert.ok(result.factors.some(f => f.name === 'Sınırlı Veri'));
    });
});

describe('predictor.js - generateCEOInsights', () => {
    test('should generate insights for upward trend', () => {
        const data = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];
        const predictions = [
            { month: '2024-06', amount: 35000 },
            { month: '2024-07', amount: 40000 }
        ];
        const seasonality = { detected: false };
        const risk = { score: 10, level: 'low', factors: [] };

        const result = generateCEOInsights(data, predictions, 'up', seasonality, risk, null, null, 0);
        assert.ok(result);
        assert.ok(result.executiveSummary);
        assert.ok(result.insights);
        assert.ok(result.recommendations);
    });

    test('should generate insights for downward trend', () => {
        const data = [
            { month: '2024-01', amount: 30000 },
            { month: '2024-02', amount: 25000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 15000 },
            { month: '2024-05', amount: 10000 }
        ];
        const predictions = [
            { month: '2024-06', amount: 5000 },
            { month: '2024-07', amount: 2000 }
        ];
        const seasonality = { detected: false };
        const risk = { score: 30, level: 'medium', factors: [] };

        const result = generateCEOInsights(data, predictions, 'down', seasonality, risk, null, null, 0);
        assert.ok(result);
        assert.ok(result.actionItems);
    });

    test('should include seasonality insights when detected', () => {
        const data = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 },
            { month: '2024-06', amount: 35000 }
        ];
        const predictions = [{ month: '2024-07', amount: 40000 }];
        const seasonality = { detected: true, peakPeriod: 'Nisan-Haziran', lowPeriod: 'Ocak-Mart', variance: 25 };
        const risk = { score: 10, level: 'low', factors: [] };

        const result = generateCEOInsights(data, predictions, 'up', seasonality, risk, null, null, 0);
        assert.ok(result);
        assert.ok(result.insights.some(i => i.type === 'seasonality'));
    });

    test('should include risk insights when high risk', () => {
        const data = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 50000 },
            { month: '2024-03', amount: 10000 },
            { month: '2024-04', amount: 50000 },
            { month: '2024-05', amount: 10000 }
        ];
        const predictions = [{ month: '2024-06', amount: 50000 }];
        const seasonality = { detected: false };
        const risk = { score: 60, level: 'high', factors: [] };

        const result = generateCEOInsights(data, predictions, 'stable', seasonality, risk, null, null, 0);
        assert.ok(result);
        assert.ok(result.insights.some(i => i.type === 'risk'));
    });

    test('should calculate market outlook', () => {
        const data = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];
        const predictions = [{ month: '2024-06', amount: 35000 }];
        const seasonality = { detected: false };
        const risk = { score: 10, level: 'low', factors: [] };

        const result = generateCEOInsights(data, predictions, 'up', seasonality, risk, null, null, 0);
        assert.ok(result.marketOutlook);
        assert.ok(result.outlookType);
    });

    test('should include CFO metrics', () => {
        const data = [
            { month: '2024-01', amount: 10000 },
            { month: '2024-02', amount: 15000 },
            { month: '2024-03', amount: 20000 },
            { month: '2024-04', amount: 25000 },
            { month: '2024-05', amount: 30000 }
        ];
        const predictions = [{ month: '2024-06', amount: 35000 }];
        const seasonality = { detected: false };
        const risk = { score: 10, level: 'low', factors: [] };

        const result = generateCEOInsights(data, predictions, 'up', seasonality, risk, null, null, 5000);
        assert.ok(result.cfoMetrics);
    });
});

describe('predictor.js - formatCurrency', () => {
    test('should format currency in Turkish format', () => {
        const result = formatCurrency(1000);
        assert.ok(result);
    });
});
