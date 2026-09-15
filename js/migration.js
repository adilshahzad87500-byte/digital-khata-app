/* ==========================================
   DIGITAL KHATA - DATA MIGRATION UTILITY
   ========================================== */

(function () {
  'use strict';

  async function importLocalDataToCloud(user) {
    if (!user || !user.id) return;

    try {
      const legacyCustRaw = localStorage.getItem('digital_khata_customers');
      const legacyTxRaw = localStorage.getItem('digital_khata_transactions');
      const legacyBizRaw = localStorage.getItem('digital_khata_business');

      let legacyCustomers = [];
      let legacyTransactions = [];

      if (legacyCustRaw) {
        try { legacyCustomers = JSON.parse(legacyCustRaw); } catch(e){}
      }
      if (legacyTxRaw) {
        try { legacyTransactions = JSON.parse(legacyTxRaw); } catch(e){}
      }

      if (!Array.isArray(legacyCustomers) || legacyCustomers.length === 0) {
        console.log('[Migration] No pre-existing local data to migrate.');
        return;
      }

      console.log(`[Migration] Migrating ${legacyCustomers.length} customers and ${legacyTransactions.length} transactions to account (${user.phone})...`);

      // Copy legacy items to user-scoped cache
      const userCacheCustKey = `digital_khata_customers_${user.id}`;
      const userCacheTxKey = `digital_khata_transactions_${user.id}`;

      localStorage.setItem(userCacheCustKey, JSON.stringify(legacyCustomers));
      localStorage.setItem(userCacheTxKey, JSON.stringify(legacyTransactions));

      // Upload to Cloud Database if connected
      if (window.DB && typeof window.DB.saveCustomer === 'function') {
        for (const cust of legacyCustomers) {
          if (cust && cust.name) {
            await window.DB.saveCustomer({
              id: cust.id,
              name: cust.name,
              phone: cust.phone || '',
              address: cust.address || '',
              createdAt: cust.createdAt || new Date().toISOString()
            });
          }
        }
      }

      if (window.DB && typeof window.DB.saveTransaction === 'function') {
        for (const tx of legacyTransactions) {
          if (tx && tx.customerId && tx.amount) {
            await window.DB.saveTransaction({
              id: tx.id,
              customerId: tx.customerId,
              type: tx.type || 'udhaar',
              amount: tx.amount,
              date: tx.date || new Date().toISOString().slice(0, 10),
              note: tx.note || ''
            });
          }
        }
      }

      console.log('[Migration] Data migration completed successfully.');

    } catch (err) {
      console.error('[Migration] Migration error:', err);
    }
  }

  window.DataMigration = {
    importLocalDataToCloud
  };

})();
