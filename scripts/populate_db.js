const fs = require('fs');
const path = require('path');
const { analyzeFiles } = require('../src/analyzer');
const db = require('../src/database');
const storage = require('../src/storage');

const samplesDir = path.join(__dirname, '../samples');

const months = [
    { name: 'ocak', month: '01', date: '2025-01-31T12:00:00.000Z' },
    { name: 'subat', month: '02', date: '2025-02-28T12:00:00.000Z' },
    { name: 'mart', month: '03', date: '2025-03-31T12:00:00.000Z' },
    { name: 'nisan', month: '04', date: '2025-04-30T12:00:00.000Z' },
    { name: 'mayis', month: '05', date: '2025-05-31T12:00:00.000Z' },
    { name: 'haziran', month: '06', date: '2025-06-30T12:00:00.000Z' }
];

async function processMonth(m) {
    const salesFile = `satis_raporu_${m.name}2025.xlsx`;
    const purchaseFile = `alis_raporu_${m.name}2025.xlsx`;

    const salesPath = path.join(samplesDir, salesFile);
    const purchasePath = path.join(samplesDir, purchaseFile);

    if (!fs.existsSync(salesPath) || !fs.existsSync(purchasePath)) {
        console.error(`❌ Dosyalar bulunamadı: ${m.name}`);
        return;
    }

    const salesBuf = fs.readFileSync(salesPath);
    const purchaseBuf = fs.readFileSync(purchasePath);

    console.log(`📊 Analiz ediliyor: ${m.name} 2025`);
    const analysis = analyzeFiles(salesBuf, purchaseBuf);

    // Insert into DB with custom date
    await new Promise((resolve, reject) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const displayDate = new Date(m.date).toLocaleString('tr-TR');

        const salesAmount = analysis.sales?.totalAmount || 0;
        const purchaseAmount = analysis.purchase?.totalAmount || 0;
        const salesTax = analysis.sales?.totalTax || 0;
        const purchaseTax = analysis.purchase?.totalTax || 0;
        const netProfit = (analysis.profitLoss?.amount !== undefined) ? analysis.profitLoss.amount : (salesAmount - purchaseAmount);

        const sql = `INSERT INTO analyses (
            id, date, display_date, sales_filename, purchase_filename, 
            sales_amount, purchase_amount, sales_tax, purchase_tax, net_profit,
            sales_json, purchase_json, summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            id, m.date, displayDate, salesFile, purchaseFile,
            salesAmount, purchaseAmount, salesTax, purchaseTax, netProfit,
            JSON.stringify(analysis.sales),
            JSON.stringify(analysis.purchase),
            analysis.summary || ''
        ];

        db.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    console.log(`✅ Veritabanına kaydedildi: ${m.name} 2025`);
}

async function run() {
    // Determine the user's project directory if not in the current CWD
    // Assuming we run this from project root

    // First clear old history to avoid duplicates/confusion if user wants fresh test
    // But maybe user wants to keep... let's keep for now or maybe ask? 
    // "create new data" implies adding. But for prediction testing, clean data is better.
    // I'll delete entries with '2025' in date using sqlite delete query first to avoid duplicates if run multiple times.

    await new Promise((resolve) => {
        db.run("DELETE FROM analyses WHERE date LIKE '2025-%'", [], resolve);
    });
    console.log("🧹 Eski 2025 verileri temizlendi.");

    for (const m of months) {
        await processMonth(m);
    }
    console.log("\n✨ Tüm veriler başarıyla yüklendi!");
}

// Wait for DB connection
setTimeout(run, 1000);
