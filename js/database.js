/* ==========================================
   DIGITAL KHATA - CLOUD DATABASE & SYNC ENGINE
   ========================================== */

(function () {
  'use strict';

  let supabaseClient = null;
  if (window.supabase && CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('your-supabase-id')) {
    try {
      supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('[DB] Supabase initialization notice:', e.message);
    }
  }

  // Get active user ID safely
  function getUserId() {
    const user = window.Auth ? window.Auth.getCurrentUser() : null;
    return user ? user.id : 'guest';
  }

  // Local Storage Cache Keys scoped per user
  function getCacheKeys() {
    const uid = getUserId();
    return {
      CUSTOMERS: `digital_khata_customers_${uid}`,
      TRANSACTIONS: `digital_khata_transactions_${uid}`,
      BUSINESS: `digital_khata_business_${uid}`,
      PROFILE: `digital_khata_profile_${uid}`
    };
  }

  // Load User Data (Cloud first, Local cache fallback)
  async function loadUserData(userId) {
    const uid = userId || getUserId();
    const cacheKeys = getCacheKeys();
    let customers = [];
    let transactions = [];
    let business = null;

    // 1. Try Cloud DB Fetch
    if (supabaseClient && uid && uid !== 'guest') {
      try {
        const [custRes, txRes, profileRes] = await Promise.all([
          supabaseClient.from('customers').select('*').eq('user_id', uid),
          supabaseClient.from('transactions').select('*').eq('user_id', uid),
          supabaseClient.from('profiles').select('*').eq('user_id', uid).maybeSingle()
        ]);

        if (custRes.data && Array.isArray(custRes.data)) {
          customers = custRes.data.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            address: c.address || '',
            createdAt: c.created_at
          }));
        }

        if (txRes.data && Array.isArray(txRes.data)) {
          transactions = txRes.data.map(t => ({
            id: t.id,
            customerId: t.customer_id,
            type: t.type,
            amount: parseFloat(t.amount) || 0,
            date: t.date || t.created_at,
            note: t.note || ''
          }));
        }

        if (profileRes.data) {
          business = {
            name: profileRes.data.business_name || '',
            ownerName: profileRes.data.full_name || '',
            phone: profileRes.data.phone || '',
            email: profileRes.data.email || '',
            address: profileRes.data.address || ''
          };
        }

        // Cache fresh cloud data locally
        if (customers.length > 0) localStorage.setItem(cacheKeys.CUSTOMERS, JSON.stringify(customers));
        if (transactions.length > 0) localStorage.setItem(cacheKeys.TRANSACTIONS, JSON.stringify(transactions));
        if (business) localStorage.setItem(cacheKeys.BUSINESS, JSON.stringify(business));

      } catch (err) {
        console.warn('[DB] Cloud load notice, reading local cache:', err);
      }
    }

    // 2. Read from Local Cache if Cloud empty or offline
    if (customers.length === 0) {
      const cachedCust = localStorage.getItem(cacheKeys.CUSTOMERS) || localStorage.getItem(CONFIG.STORAGE_KEYS.CUSTOMERS);
      if (cachedCust) {
        try { customers = JSON.parse(cachedCust); } catch (e) {}
      }
    }

    if (transactions.length === 0) {
      const cachedTx = localStorage.getItem(cacheKeys.TRANSACTIONS) || localStorage.getItem(CONFIG.STORAGE_KEYS.TRANSACTIONS);
      if (cachedTx) {
        try { transactions = JSON.parse(cachedTx); } catch (e) {}
      }
    }

    return { customers, transactions, business };
  }

  // Save Customer (Cloud + Local Cache)
  async function saveCustomer(customerData) {
    const uid = getUserId();
    const cacheKeys = getCacheKeys();

    const customerRecord = {
      id: customerData.id || ('cust_' + Date.now()),
      user_id: uid,
      name: customerData.name,
      phone: customerData.phone || '',
      address: customerData.address || '',
      created_at: customerData.createdAt || new Date().toISOString()
    };

    // 1. Update Local Cache immediately
    let customers = [];
    try {
      const cached = localStorage.getItem(cacheKeys.CUSTOMERS);
      if (cached) customers = JSON.parse(cached);
    } catch(e){}

    const existingIdx = customers.findIndex(c => c.id === customerRecord.id);
    const clientFormatted = {
      id: customerRecord.id,
      name: customerRecord.name,
      phone: customerRecord.phone,
      address: customerRecord.address,
      createdAt: customerRecord.created_at
    };

    if (existingIdx >= 0) {
      customers[existingIdx] = clientFormatted;
    } else {
      customers.push(clientFormatted);
    }
    localStorage.setItem(cacheKeys.CUSTOMERS, JSON.stringify(customers));

    // 2. Sync to Cloud DB
    if (supabaseClient && uid && uid !== 'guest') {
      try {
        await supabaseClient.from('customers').upsert([customerRecord]);
      } catch (cloudErr) {
        console.warn('[DB] Offline: Customer saved locally, will sync when online.', cloudErr);
      }
    }

    return clientFormatted;
  }

  // Delete Customer
  async function deleteCustomer(customerId) {
    const uid = getUserId();
    const cacheKeys = getCacheKeys();

    // 1. Update Local Cache
    let customers = [];
    try {
      const cached = localStorage.getItem(cacheKeys.CUSTOMERS);
      if (cached) customers = JSON.parse(cached).filter(c => c.id !== customerId);
    } catch(e){}
    localStorage.setItem(cacheKeys.CUSTOMERS, JSON.stringify(customers));

    // Also delete customer transactions locally
    let transactions = [];
    try {
      const cachedTx = localStorage.getItem(cacheKeys.TRANSACTIONS);
      if (cachedTx) transactions = JSON.parse(cachedTx).filter(t => t.customerId !== customerId);
    } catch(e){}
    localStorage.setItem(cacheKeys.TRANSACTIONS, JSON.stringify(transactions));

    // 2. Sync to Cloud DB
    if (supabaseClient && uid && uid !== 'guest') {
      try {
        await Promise.all([
          supabaseClient.from('transactions').delete().eq('customer_id', customerId).eq('user_id', uid),
          supabaseClient.from('customers').delete().eq('id', customerId).eq('user_id', uid)
        ]);
      } catch (cloudErr) {
        console.warn('[DB] Offline: Customer deletion queued locally.', cloudErr);
      }
    }
  }

  // Save Transaction (Udhaar or Payment)
  async function saveTransaction(txData) {
    const uid = getUserId();
    const cacheKeys = getCacheKeys();

    const txRecord = {
      id: txData.id || ('tx_' + Date.now()),
      user_id: uid,
      customer_id: txData.customerId,
      type: txData.type, // 'udhaar' or 'payment'
      amount: parseFloat(txData.amount) || 0,
      date: txData.date || new Date().toISOString().slice(0, 10),
      note: txData.note || '',
      created_at: new Date().toISOString()
    };

    // 1. Update Local Cache
    let transactions = [];
    try {
      const cached = localStorage.getItem(cacheKeys.TRANSACTIONS);
      if (cached) transactions = JSON.parse(cached);
    } catch(e){}

    const clientFormatted = {
      id: txRecord.id,
      customerId: txRecord.customer_id,
      type: txRecord.type,
      amount: txRecord.amount,
      date: txRecord.date,
      note: txRecord.note
    };

    transactions.push(clientFormatted);
    localStorage.setItem(cacheKeys.TRANSACTIONS, JSON.stringify(transactions));

    // 2. Sync to Cloud DB
    if (supabaseClient && uid && uid !== 'guest') {
      try {
        await supabaseClient.from('transactions').insert([txRecord]);
      } catch (cloudErr) {
        console.warn('[DB] Offline: Transaction saved locally.', cloudErr);
      }
    }

    return clientFormatted;
  }

  // Delete Transaction
  async function deleteTransaction(txId) {
    const uid = getUserId();
    const cacheKeys = getCacheKeys();

    // 1. Update Local Cache
    let transactions = [];
    try {
      const cached = localStorage.getItem(cacheKeys.TRANSACTIONS);
      if (cached) transactions = JSON.parse(cached).filter(t => t.id !== txId);
    } catch(e){}
    localStorage.setItem(cacheKeys.TRANSACTIONS, JSON.stringify(transactions));

    // 2. Sync to Cloud DB
    if (supabaseClient && uid && uid !== 'guest') {
      try {
        await supabaseClient.from('transactions').delete().eq('id', txId).eq('user_id', uid);
      } catch (cloudErr) {
        console.warn('[DB] Offline: Transaction deletion queued locally.', cloudErr);
      }
    }
  }

  // Online Reconnection Handler
  window.addEventListener('online', () => {
    console.log('[DB] Network restored. Synchronizing offline records...');
    const user = window.Auth ? window.Auth.getCurrentUser() : null;
    if (user && user.id) {
      loadUserData(user.id);
    }
  });

  // Export DB API
  window.DB = {
    loadUserData,
    saveCustomer,
    deleteCustomer,
    saveTransaction,
    deleteTransaction
  };

})();
