const { predictNextMonths } = require('../src/predictor');
const fs = require('fs');
const path = require('path');

// Mock data simulating what server.js sends (based on what populate_db.js inserted)
// Note: server.js Logic:
// let date = new Date(entry.date);
// const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
// monthlyDataSales = [ { month: '2025-01', amount: ... } ]

const mockHistory = [
    { month: '2025-01', amount: 88000 },
    { month: '2025-02', amount: 98000 },
    { month: '2025-03', amount: 112000 },
    { month: '2025-04', amount: 124000 },
    { month: '2025-05', amount: 140000 },
    { month: '2025-06', amount: 156000 }
];

console.log('Testing predictNextMonths with mock data...');
try {
    const result = predictNextMonths(mockHistory);
    console.log('Result:', JSON.stringify(result, null, 2));
} catch (error) {
    console.error('CRASHED:', error);
}
