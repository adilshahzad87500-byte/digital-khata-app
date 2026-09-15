/* ==========================================
   DIGITAL KHATA - CUSTOMERS CONTROLLER
   ========================================== */

(function () {
  'use strict';

  // Calculate Customer Net Balance
  // Balance > 0: Customer owes money (Udhaar)
  // Balance < 0: You owe customer (Advance payment)
  function getCustomerBalance(customerId, transactions = []) {
    const custTxs = transactions.filter(t => t.customerId === customerId);
    let net = 0;
    custTxs.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'udhaar') {
        net += amt;
      } else if (t.type === 'payment') {
        net -= amt;
      }
    });
    return net;
  }

  // Filter customers by search term and tab filter ('all', 'got', 'gave')
  function filterCustomers(customers = [], transactions = [], query = '', filterType = 'all') {
    let list = customers;

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      );
    }

    if (filterType === 'got') {
      // You will get money (Balance > 0)
      list = list.filter(c => getCustomerBalance(c.id, transactions) > 0);
    } else if (filterType === 'gave') {
      // You gave / owe (Balance < 0)
      list = list.filter(c => getCustomerBalance(c.id, transactions) < 0);
    }

    return list;
  }

  window.CustomerModule = {
    getCustomerBalance,
    filterCustomers
  };

})();
