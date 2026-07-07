const fs = require('fs');
const path = require('path');
const db = require('../src/database');

const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

async function migrate() {
    console.log('📦 Migration başlatılıyor...');

    if (!fs.existsSync(HISTORY_FILE)) {
        console.log('⚠️ history.json bulunamadı. Migration gerekli değil.');
        process.exit(0);
    }

    let historyData;
    try {
        const rawData = fs.readFileSync(HISTORY_FILE, 'utf8');
        historyData = JSON.parse(rawData);
    } catch (error) {
        console.error('❌ history.json okunamadı:', error);
        process.exit(1);
    }

    if (!Array.isArray(historyData) || historyData.length === 0) {
        console.log('⚠️ Geçmiş verisi boş. Migration gerekli değil.');
        process.exit(0);
    }

    console.log(`📊 ${historyData.length} kayıt taşınacak...`);

    const insertStmt = db.prepare(`INSERT OR IGNORE INTO analyses (
        id, date, display_date, sales_filename, purchase_filename, 
        sales_amount, purchase_amount, sales_tax, purchase_tax, net_profit,
        sales_json, purchase_json, summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        let count = 0;
        historyData.forEach(entry => {
            const salesAmount = entry.sales?.totalAmount || 0;
            const purchaseAmount = entry.purchase?.totalAmount || 0;
            const salesTax = entry.sales?.totalTax || 0;
            const purchaseTax = entry.purchase?.totalTax || 0;
            const netProfit = (entry.profitLoss?.amount !== undefined) ? entry.profitLoss.amount : (salesAmount - purchaseAmount);

            insertStmt.run([
                entry.id,
                entry.date,
                entry.displayDate,
                entry.salesFileName,
                entry.purchaseFileName,
                salesAmount,
                purchaseAmount,
                salesTax,
                purchaseTax,
                netProfit,
                JSON.stringify(entry.sales || {}),
                JSON.stringify(entry.purchase || {}),
                entry.summary || ''
            ], (err) => {
                if (err) console.error(`❌ Hata (ID: ${entry.id}):`, err.message);
            });
            count++;
        });

        insertStmt.finalize();

        db.run("COMMIT", (err) => {
            if (err) {
                console.error('❌ Transaction commit hatası:', err);
            } else {
                console.log(`✅ ${count} kayıt başarıyla SQLite veritabanına taşındı.`);

                // Rename old file
                const backupPath = path.join(DATA_DIR, 'history.json.bak');
                fs.renameSync(HISTORY_FILE, backupPath);
                console.log(`📄 history.json -> history.json.bak olarak yeniden adlandırıldı.`);
            }
            // Close DB connection after work is done to allow script to exit (though db object is global-ish)
            // We can just exit process
            setTimeout(() => process.exit(0), 1000);
        });
    });
}

// Wait for DB connection
setTimeout(migrate, 1000);
