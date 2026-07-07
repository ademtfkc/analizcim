/**
 * Migration: 010_recompute_net_profit_kdv_haric
 *
 * Brüt kâr artık KDV HARİÇ hesaplanıyor (KDV devlete ödenecek geçiş kalemidir, kâr değil).
 * Geçmiş analiz kayıtlarındaki `net_profit` sütunu, eskiden KDV DAHİL tutarların farkıydı
 * ((sales_amount) - (purchase_amount)). Bu migration onu KDV hariç hale getirir:
 *   net_profit = (sales_amount - sales_tax) - (purchase_amount - purchase_tax)
 *
 * Yalnızca zaten saklanan sütunlardan hesaplandığı için deterministik ve idempotenttir
 * (tekrar çalıştırılırsa aynı sonucu verir). `down` eski KDV dahil haline geri döndürür.
 */
function up(db) {
    return new Promise((resolve, reject) => {
        const sql = `
            UPDATE analyses
            SET net_profit =
                (COALESCE(sales_amount, 0) - COALESCE(sales_tax, 0))
                - (COALESCE(purchase_amount, 0) - COALESCE(purchase_tax, 0))
        `;
        db.run(sql, function (err) {
            if (err) {
                reject(err);
            } else {
                console.log(`  → net_profit KDV hariç olarak yeniden hesaplandı (${this.changes} satır)`);
                resolve();
            }
        });
    });
}

function down(db) {
    return new Promise((resolve, reject) => {
        // Eski davranış: KDV dahil tutar farkı
        const sql = `
            UPDATE analyses
            SET net_profit = COALESCE(sales_amount, 0) - COALESCE(purchase_amount, 0)
        `;
        db.run(sql, function (err) {
            if (err) {
                reject(err);
            } else {
                console.log(`  → net_profit eski KDV dahil haline döndürüldü (${this.changes} satır)`);
                resolve();
            }
        });
    });
}

module.exports = { up, down };
