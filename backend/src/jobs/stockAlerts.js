const cron = require('node-cron');
const db = require('../utils/db');

// Runs every day at 7:00 AM — logs low stock and expiry alerts to console/notifications
cron.schedule('0 7 * * *', async () => {
  console.log('[StockAlerts] Checking pharmacy inventory...');
  try {
    const result = await db.query(`SELECT * FROM pharmacy_inventory WHERE is_active = true`);
    const data = result.rows || [];

    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const lowStock     = data.filter(m => m.current_stock <= m.reorder_level);
    const expiringSoon = data.filter(m => m.expiry_date && m.expiry_date <= thirtyDays && m.expiry_date > today);
    const expired      = data.filter(m => m.expiry_date && m.expiry_date <= today);

    if (lowStock.length) {
      console.log(`[StockAlerts] LOW STOCK (${lowStock.length} items):`, lowStock.map(m => `${m.medicine_name} (${m.current_stock} left)`).join(', '));
    }
    if (expiringSoon.length) {
      console.log(`[StockAlerts] EXPIRING SOON (${expiringSoon.length} items):`, expiringSoon.map(m => `${m.medicine_name} (expires ${m.expiry_date})`).join(', '));
    }
    if (expired.length) {
      console.log(`[StockAlerts] EXPIRED (${expired.length} items):`, expired.map(m => m.medicine_name).join(', '));
    }
    if (!lowStock.length && !expiringSoon.length && !expired.length) {
      console.log('[StockAlerts] All stock levels and expiry dates are OK');
    }
  } catch (err) {
    console.error('[StockAlerts] Error:', err.message);
  }
});
