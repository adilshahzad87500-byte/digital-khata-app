/* ==========================================
   DIGITAL KHATA - TRANSACTIONS CONTROLLER
   ========================================== */

(function () {
  'use strict';

  function getGlobalTotals(transactions = []) {
    let totalUdhaar = 0;
    let totalReceived = 0;

    transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'udhaar') {
        totalUdhaar += amt;
      } else if (t.type === 'payment') {
        totalReceived += amt;
      }
    });

    const remaining = totalUdhaar - totalReceived;

    return {
      totalUdhaar,
      totalReceived,
      remaining
    };
  }

  function filterTransactionsByTimeframe(transactions = [], timeframe = 'all') {
    if (timeframe === 'all') return transactions;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return transactions.filter(t => {
      if (!t.date) return false;
      const txDate = new Date(t.date);

      if (timeframe === 'today') {
        return t.date.slice(0, 10) === todayStr;
      } else if (timeframe === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return txDate >= oneWeekAgo;
      } else if (timeframe === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return txDate >= oneMonthAgo;
      }
      return true;
    });
  }

  window.TransactionModule = {
    getGlobalTotals,
    filterTransactionsByTimeframe
  };

})();
