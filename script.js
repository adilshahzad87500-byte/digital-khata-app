/* ==========================================
   DIGITAL KHATA - APPLICATION CORE LOGIC
   ========================================== */

(function () {
  'use strict';

  // --- LOCALSTORAGE KEYS ---
  const STORAGE_KEYS = {
    ONBOARDED: 'digital_khata_onboarded',
    BUSINESS: 'digital_khata_business',
    CUSTOMERS: 'digital_khata_customers',
    TRANSACTIONS: 'digital_khata_transactions'
  };

  // --- STATE ---
  let appState = {
    onboarded: false,
    business: {
      name: 'Your Business Name',
      phone: '03XX-XXXXXXX',
      address: 'Your Address'
    },
    customers: [],
    transactions: [],
    activeCustomerId: null,
    activeCustomerFilter: 'all',
    activeReportTimeframe: 'all',
    quickActionTarget: null // 'udhaar' or 'payment' when using quick action picker
  };

  // --- DOM ELEMENTS ---
  const screens = {
    welcome: document.getElementById('screen-welcome'),
    dashboard: document.getElementById('screen-dashboard'),
    customers: document.getElementById('screen-customers'),
    addCustomer: document.getElementById('screen-add-customer'),
    customerDetails: document.getElementById('screen-customer-details'),
    addUdhaar: document.getElementById('screen-add-udhaar'),
    receivePayment: document.getElementById('screen-receive-payment'),
    reports: document.getElementById('screen-reports'),
    settings: document.getElementById('screen-settings')
  };

  const bottomNav = document.getElementById('bottom-nav');
  const navItems = document.querySelectorAll('.nav-item');

  // --- INITIALIZATION ---
  function init() {
    loadData();
    bindEvents();

    if (!appState.onboarded) {
      showScreen('screen-welcome');
    } else {
      showScreen('screen-dashboard');
    }

    renderAllScreens();

    // Handle Splash Screen dismissal
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
      setTimeout(() => {
        splashScreen.classList.add('splash-fade-out');
        setTimeout(() => {
          splashScreen.style.display = 'none';
        }, 500);
      }, 1800);
    }
  }

  // --- STORAGE HELPERS ---
  function loadData() {
    try {
      appState.onboarded = localStorage.getItem(STORAGE_KEYS.ONBOARDED) === 'true';

      const storedBiz = localStorage.getItem(STORAGE_KEYS.BUSINESS);
      if (storedBiz) appState.business = JSON.parse(storedBiz);

      const storedCust = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (storedCust) appState.customers = JSON.parse(storedCust);

      const storedTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (storedTx) appState.transactions = JSON.parse(storedTx);
    } catch (e) {
      console.error('Error loading data from LocalStorage:', e);
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEYS.ONBOARDED, appState.onboarded);
      localStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(appState.business));
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(appState.customers));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(appState.transactions));
    } catch (e) {
      console.error('Error saving data to LocalStorage:', e);
    }
  }

  // --- NAVIGATION CONTROLLER ---
  function showScreen(screenId) {
    Object.keys(screens).forEach(key => {
      const screen = screens[key];
      if (screen.id === screenId) {
        screen.classList.add('active');
      } else {
        screen.classList.remove('active');
      }
    });

    // Handle bottom navigation visibility
    const mainScreens = ['screen-dashboard', 'screen-customers', 'screen-reports', 'screen-settings'];
    if (mainScreens.includes(screenId)) {
      bottomNav.classList.remove('hidden');

      // Update active nav button
      navItems.forEach(item => {
        if (item.dataset.targetScreen === screenId) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    } else {
      bottomNav.classList.add('hidden');
    }

    // Refresh contents when navigating
    if (screenId === 'screen-dashboard') renderDashboard();
    if (screenId === 'screen-customers') renderCustomersScreen();
    if (screenId === 'screen-reports') renderReportsScreen();
    if (screenId === 'screen-settings') renderSettingsScreen();
    if (screenId === 'screen-customer-details' && appState.activeCustomerId) {
      renderCustomerDetailsScreen(appState.activeCustomerId);
    }
  }

  // --- DATA CALCULATIONS ---
  function getCustomerBalance(customerId) {
    const custTxs = appState.transactions.filter(t => t.customerId === customerId);
    let totalUdhaar = 0;
    let totalReceived = 0;

    custTxs.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'UDHAAR') totalUdhaar += amt;
      if (t.type === 'PAYMENT') totalReceived += amt;
    });

    return {
      totalUdhaar,
      totalReceived,
      remaining: totalUdhaar - totalReceived
    };
  }

  function getGlobalTotals(txList = appState.transactions) {
    let totalUdhaar = 0;
    let totalReceived = 0;

    txList.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'UDHAAR') totalUdhaar += amt;
      if (t.type === 'PAYMENT') totalReceived += amt;
    });

    return {
      totalUdhaar,
      totalReceived,
      remaining: totalUdhaar - totalReceived
    };
  }

  function formatRs(amount) {
    const num = Math.abs(amount || 0);
    return `Rs. ${num.toLocaleString('en-PK')}`;
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  // --- RENDER LOGIC ---
  function renderAllScreens() {
    renderDashboard();
    renderCustomersScreen();
    renderReportsScreen();
    renderSettingsScreen();
  }

  // 1. DASHBOARD
  function renderDashboard() {
    const totals = getGlobalTotals();
    document.getElementById('dash-total-udhaar').textContent = formatRs(totals.totalUdhaar);
    document.getElementById('dash-total-received').textContent = formatRs(totals.totalReceived);
    document.getElementById('dash-remaining').textContent = formatRs(totals.remaining);

    const searchTerm = (document.getElementById('dash-search-input').value || '').trim().toLowerCase();
    const emptyState = document.getElementById('dash-empty-state');
    const customerListEl = document.getElementById('dash-customer-list');

    if (appState.customers.length === 0) {
      emptyState.classList.remove('hidden');
      customerListEl.classList.add('hidden');
      return;
    }

    const filtered = appState.customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm) || c.phone.includes(searchTerm)
    );

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      customerListEl.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      customerListEl.classList.remove('hidden');
      renderCustomerCards(customerListEl, filtered);
    }
  }

  // 2. CUSTOMERS SCREEN
  function renderCustomersScreen() {
    const searchTerm = (document.getElementById('cust-search-input').value || '').trim().toLowerCase();
    const filterTab = appState.activeCustomerFilter;

    const emptyState = document.getElementById('cust-empty-state');
    const customerListEl = document.getElementById('cust-cards-list');

    if (appState.customers.length === 0) {
      emptyState.classList.remove('hidden');
      customerListEl.classList.add('hidden');
      return;
    }

    let filtered = appState.customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm) || c.phone.includes(searchTerm)
    );

    if (filterTab === 'due') {
      filtered = filtered.filter(c => getCustomerBalance(c.id).remaining > 0);
    } else if (filterTab === 'paid') {
      filtered = filtered.filter(c => getCustomerBalance(c.id).remaining <= 0);
    }

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      customerListEl.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      customerListEl.classList.remove('hidden');
      renderCustomerCards(customerListEl, filtered);
    }
  }

  // Render generic list of customer cards
  function renderCustomerCards(containerEl, customersList) {
    containerEl.innerHTML = '';

    customersList.forEach(cust => {
      const bal = getCustomerBalance(cust.id);
      const initial = cust.name.charAt(0).toUpperCase();

      const card = document.createElement('div');
      card.className = 'customer-card';
      card.innerHTML = `
        <div class="cust-info-col">
          <div class="cust-avatar-circle">${initial}</div>
          <div>
            <h4 class="cust-name">${escapeHtml(cust.name)}</h4>
            <p class="cust-phone">${escapeHtml(cust.phone)}</p>
          </div>
        </div>
        <div class="cust-balance-col">
          <div class="cust-balance-amount ${bal.remaining > 0 ? 'is-due' : 'is-paid'}">
            ${formatRs(bal.remaining)}
          </div>
          <span class="cust-status-badge ${bal.remaining > 0 ? 'badge-due' : 'badge-paid'}">
            ${bal.remaining > 0 ? 'Due' : 'Paid'}
          </span>
        </div>
      `;

      card.addEventListener('click', () => {
        appState.activeCustomerId = cust.id;
        showScreen('screen-customer-details');
      });

      containerEl.appendChild(card);
    });
  }

  // 3. CUSTOMER DETAILS SCREEN
  function renderCustomerDetailsScreen(customerId) {
    const cust = appState.customers.find(c => c.id === customerId);
    if (!cust) {
      showScreen('screen-dashboard');
      return;
    }

    document.getElementById('detail-cust-name').textContent = cust.name;
    document.getElementById('detail-cust-phone').textContent = cust.phone;
    document.getElementById('detail-cust-address').textContent = cust.address || '';

    const bal = getCustomerBalance(cust.id);
    document.getElementById('detail-cust-balance').textContent = formatRs(bal.remaining);

    // Transactions list
    const custTxs = appState.transactions.filter(t => t.customerId === customerId);
    // Sort recent first
    custTxs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const emptyState = document.getElementById('tx-empty-state');
    const txListEl = document.getElementById('tx-history-list');

    if (custTxs.length === 0) {
      emptyState.classList.remove('hidden');
      txListEl.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      txListEl.classList.remove('hidden');
      txListEl.innerHTML = '';

      custTxs.forEach(t => {
        const item = document.createElement('div');
        item.className = 'tx-item';
        const isUdhaar = t.type === 'UDHAAR';

        item.innerHTML = `
          <div>
            <span class="tx-type-badge ${isUdhaar ? 'badge-udhaar' : 'badge-payment'}">
              ${isUdhaar ? 'Udhaar' : 'Payment'}
            </span>
            <div class="tx-desc">${escapeHtml(t.description || (isUdhaar ? 'Udhaar Added' : 'Payment Received'))}</div>
            <div class="tx-date">${formatDate(t.date)}</div>
          </div>
          <div class="tx-amount-col">
            <div class="tx-amount ${isUdhaar ? 'udhaar-val' : 'payment-val'}">
              ${isUdhaar ? '+' : '-'} ${formatRs(t.amount)}
            </div>
            <button class="tx-del-btn" title="Delete Transaction" data-tx-id="${t.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
        `;

        item.querySelector('.tx-del-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTransaction(t.id);
        });

        txListEl.appendChild(item);
      });
    }

    // WhatsApp Reminder button styling update
    const btnWa = document.getElementById('btn-whatsapp-reminder');
    if (bal.remaining > 0) {
      btnWa.style.opacity = '1';
      btnWa.disabled = false;
    } else {
      btnWa.style.opacity = '0.6';
    }
  }

  // 4. REPORTS SCREEN
  function renderReportsScreen() {
    const timeframe = appState.activeReportTimeframe;
    let filteredTxs = [...appState.transactions];

    const todayStr = getTodayString();
    const now = new Date();

    if (timeframe === 'today') {
      filteredTxs = filteredTxs.filter(t => t.date === todayStr);
    } else if (timeframe === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredTxs = filteredTxs.filter(t => new Date(t.date) >= oneWeekAgo);
    } else if (timeframe === 'month') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredTxs = filteredTxs.filter(t => new Date(t.date) >= oneMonthAgo);
    }

    const totals = getGlobalTotals(filteredTxs);
    document.getElementById('rep-total-udhaar').textContent = formatRs(totals.totalUdhaar);
    document.getElementById('rep-total-received').textContent = formatRs(totals.totalReceived);
    document.getElementById('rep-remaining').textContent = formatRs(totals.remaining);

    const emptyState = document.getElementById('rep-empty-state');
    const chartCard = document.getElementById('rep-chart-wrapper');

    if (filteredTxs.length === 0) {
      emptyState.classList.remove('hidden');
      chartCard.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      chartCard.classList.remove('hidden');

      const maxVal = Math.max(totals.totalUdhaar, totals.totalReceived, 1);
      const udhaarPct = Math.min(100, Math.max(5, (totals.totalUdhaar / maxVal) * 100));
      const recPct = Math.min(100, Math.max(5, (totals.totalReceived / maxVal) * 100));

      document.getElementById('bar-udhaar-fill').style.height = `${udhaarPct}%`;
      document.getElementById('bar-received-fill').style.height = `${recPct}%`;
    }
  }

  // 5. SETTINGS SCREEN
  function renderSettingsScreen() {
    document.getElementById('set-biz-name').textContent = appState.business.name || 'Your Business Name';
    document.getElementById('set-biz-phone').textContent = appState.business.phone || '03XX-XXXXXXX';
    document.getElementById('set-biz-address').textContent = appState.business.address || 'Your Address';
  }

  // --- CRUD ACTIONS ---

  // Add Customer
  function handleAddCustomer(e) {
    e.preventDefault();
    const nameInput = document.getElementById('cust-name');
    const phoneInput = document.getElementById('cust-phone');
    const addressInput = document.getElementById('cust-address');

    const errName = document.getElementById('err-cust-name');
    const errPhone = document.getElementById('err-cust-phone');

    errName.textContent = '';
    errPhone.textContent = '';

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const address = addressInput.value.trim();

    let isValid = true;

    if (!name) {
      errName.textContent = 'Customer name is required';
      isValid = false;
    }

    if (!phone) {
      errPhone.textContent = 'Phone number is required';
      isValid = false;
    } else if (phone.length < 8) {
      errPhone.textContent = 'Enter a valid phone number (03XX-XXXXXXX)';
      isValid = false;
    }

    // Check duplicate phone
    const existing = appState.customers.find(c => c.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, ''));
    if (existing) {
      errPhone.textContent = 'A customer with this phone number already exists';
      isValid = false;
    }

    if (!isValid) return;

    const newCust = {
      id: 'cust_' + Date.now(),
      name: name,
      phone: phone,
      address: address,
      createdAt: new Date().toISOString()
    };

    appState.customers.push(newCust);
    saveData();

    // Reset Form
    document.getElementById('form-add-customer').reset();

    showToast('Customer saved successfully');
    appState.activeCustomerId = newCust.id;
    showScreen('screen-customer-details');
  }

  // Add Udhaar
  function handleAddUdhaar(e) {
    e.preventDefault();
    const amountInput = document.getElementById('udhaar-amount');
    const descInput = document.getElementById('udhaar-desc');
    const dateInput = document.getElementById('udhaar-date');
    const errAmt = document.getElementById('err-udhaar-amount');

    errAmt.textContent = '';
    const amount = parseFloat(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
      errAmt.textContent = 'Please enter a valid amount';
      return;
    }

    if (!appState.activeCustomerId) {
      showToast('No customer selected');
      return;
    }

    const newTx = {
      id: 'tx_' + Date.now(),
      customerId: appState.activeCustomerId,
      type: 'UDHAAR',
      amount: amount,
      description: descInput.value.trim() || 'Udhaar',
      date: dateInput.value || getTodayString(),
      createdAt: new Date().toISOString()
    };

    appState.transactions.push(newTx);
    saveData();

    document.getElementById('form-add-udhaar').reset();
    document.getElementById('udhaar-date').value = getTodayString();

    showToast('Udhaar saved successfully');
    showScreen('screen-customer-details');
  }

  // Receive Payment
  function handleReceivePayment(e) {
    e.preventDefault();
    const amountInput = document.getElementById('payment-amount');
    const noteInput = document.getElementById('payment-note');
    const dateInput = document.getElementById('payment-date');
    const errAmt = document.getElementById('err-payment-amount');

    errAmt.textContent = '';
    const amount = parseFloat(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
      errAmt.textContent = 'Please enter a valid payment amount';
      return;
    }

    if (!appState.activeCustomerId) {
      showToast('No customer selected');
      return;
    }

    const newTx = {
      id: 'tx_' + Date.now(),
      customerId: appState.activeCustomerId,
      type: 'PAYMENT',
      amount: amount,
      description: noteInput.value.trim() || 'Payment Received',
      date: dateInput.value || getTodayString(),
      createdAt: new Date().toISOString()
    };

    appState.transactions.push(newTx);
    saveData();

    document.getElementById('form-receive-payment').reset();
    document.getElementById('payment-date').value = getTodayString();

    showToast('Payment received successfully');
    showScreen('screen-customer-details');
  }

  // Delete Transaction
  function deleteTransaction(txId) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    appState.transactions = appState.transactions.filter(t => t.id !== txId);
    saveData();
    showToast('Transaction deleted');
    renderCustomerDetailsScreen(appState.activeCustomerId);
  }

  // Delete Customer
  function deleteCustomer(customerId) {
    appState.customers = appState.customers.filter(c => c.id !== customerId);
    appState.transactions = appState.transactions.filter(t => t.customerId !== customerId);
    saveData();

    showToast('Customer deleted');
    closeAllModals();
    showScreen('screen-customers');
  }

  // WhatsApp Reminder
  function triggerWhatsAppReminder() {
    const cust = appState.customers.find(c => c.id === appState.activeCustomerId);
    if (!cust) return;

    const bal = getCustomerBalance(cust.id);
    if (bal.remaining <= 0) {
      showToast('Customer has no outstanding balance');
      return;
    }

    // Clean phone number (replace leading 0 with 92 for Pakistan standard WhatsApp links)
    let rawPhone = cust.phone.replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '92' + rawPhone.substring(1);
    }

    const message = `Assalam-o-Alaikum ${cust.name},\n\nYour remaining khata balance is ${formatRs(bal.remaining)}.\n\nPlease clear the outstanding amount.\n\nThank you.`;
    const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  }

  // --- MODALS & QUICK ACTIONS ---
  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  }

  function openCustomerPicker(targetAction) {
    if (appState.customers.length === 0) {
      showToast('Please add a customer first');
      showScreen('screen-add-customer');
      return;
    }

    appState.quickActionTarget = targetAction;
    const modal = document.getElementById('modal-select-customer');
    const titleEl = document.getElementById('select-cust-modal-title');
    titleEl.textContent = targetAction === 'udhaar' ? 'Select Customer for Udhaar' : 'Select Customer for Payment';

    renderCustomerPickerList();
    modal.classList.remove('hidden');
  }

  function renderCustomerPickerList() {
    const listEl = document.getElementById('select-cust-list');
    const searchVal = (document.getElementById('select-cust-search').value || '').trim().toLowerCase();

    listEl.innerHTML = '';
    const filtered = appState.customers.filter(c => 
      c.name.toLowerCase().includes(searchVal) || c.phone.includes(searchVal)
    );

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="text-center text-muted py-3">No customers found</div>';
      return;
    }

    filtered.forEach(c => {
      const bal = getCustomerBalance(c.id);
      const item = document.createElement('div');
      item.className = 'picker-item';
      item.innerHTML = `
        <div>
          <div style="font-weight:600;">${escapeHtml(c.name)}</div>
          <div style="font-size:12px;color:#64748B;">${escapeHtml(c.phone)}</div>
        </div>
        <div style="font-weight:700;color:${bal.remaining > 0 ? '#DC2626' : '#059669'};">
          ${formatRs(bal.remaining)}
        </div>
      `;
      item.addEventListener('click', () => {
        appState.activeCustomerId = c.id;
        closeAllModals();
        if (appState.quickActionTarget === 'udhaar') {
          showScreen('screen-add-udhaar');
        } else if (appState.quickActionTarget === 'payment') {
          showScreen('screen-receive-payment');
        } else {
          showScreen('screen-customer-details');
        }
      });
      listEl.appendChild(item);
    });
  }

  // Toast Notification
  function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- EVENT BINDINGS ---
  function bindEvents() {
    // Welcome screen Get Started button
    document.getElementById('btn-get-started').addEventListener('click', () => {
      appState.onboarded = true;
      saveData();
      showScreen('screen-dashboard');
    });

    // Bottom Navigation click
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetScreen = item.dataset.targetScreen;
        showScreen(targetScreen);
      });
    });

    // Header Settings icon
    document.getElementById('btn-header-settings').addEventListener('click', () => {
      showScreen('screen-settings');
    });

    // Floating FAB Center (+)
    document.getElementById('btn-fab-center').addEventListener('click', () => {
      document.getElementById('modal-action-sheet').classList.remove('hidden');
    });

    document.getElementById('btn-close-action-sheet').addEventListener('click', closeAllModals);

    // Action Sheet Items
    document.getElementById('act-add-customer').addEventListener('click', () => {
      closeAllModals();
      showScreen('screen-add-customer');
    });

    document.getElementById('act-add-udhaar').addEventListener('click', () => {
      closeAllModals();
      openCustomerPicker('udhaar');
    });

    document.getElementById('act-receive-payment').addEventListener('click', () => {
      closeAllModals();
      openCustomerPicker('payment');
    });

    // "+ Add Customer" buttons on empty states
    document.querySelectorAll('.btn-add-cust-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        showScreen('screen-add-customer');
      });
    });

    // Back buttons
    document.querySelectorAll('.btn-back').forEach(btn => {
      btn.addEventListener('click', () => {
        // Simple back logic
        const activeScreen = document.querySelector('.screen.active');
        if (activeScreen && (activeScreen.id === 'screen-add-udhaar' || activeScreen.id === 'screen-receive-payment')) {
          showScreen('screen-customer-details');
        } else {
          showScreen('screen-dashboard');
        }
      });
    });

    // Form Submissions
    document.getElementById('form-add-customer').addEventListener('submit', handleAddCustomer);
    document.getElementById('form-add-udhaar').addEventListener('submit', handleAddUdhaar);
    document.getElementById('form-receive-payment').addEventListener('submit', handleReceivePayment);

    // Set Default dates in forms
    document.getElementById('udhaar-date').value = getTodayString();
    document.getElementById('payment-date').value = getTodayString();

    // Customer Detail buttons
    document.getElementById('btn-add-udhaar').addEventListener('click', () => {
      showScreen('screen-add-udhaar');
    });

    document.getElementById('btn-receive-payment').addEventListener('click', () => {
      showScreen('screen-receive-payment');
    });

    document.getElementById('btn-whatsapp-reminder').addEventListener('click', triggerWhatsAppReminder);

    // Customer Menu button (3 dots)
    document.getElementById('btn-cust-menu').addEventListener('click', () => {
      const cust = appState.customers.find(c => c.id === appState.activeCustomerId);
      if (cust) {
        document.getElementById('cust-menu-title').textContent = cust.name;
        document.getElementById('modal-cust-options').classList.remove('hidden');
      }
    });

    document.getElementById('btn-close-cust-options').addEventListener('click', closeAllModals);

    document.getElementById('opt-edit-customer').addEventListener('click', () => {
      closeAllModals();
      const cust = appState.customers.find(c => c.id === appState.activeCustomerId);
      if (cust) {
        document.getElementById('cust-name').value = cust.name;
        document.getElementById('cust-phone').value = cust.phone;
        document.getElementById('cust-address').value = cust.address || '';
        showScreen('screen-add-customer');
      }
    });

    document.getElementById('opt-delete-customer').addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this customer and all their transactions?')) {
        deleteCustomer(appState.activeCustomerId);
      }
    });

    // Search inputs live filtering
    document.getElementById('dash-search-input').addEventListener('input', renderDashboard);
    document.getElementById('cust-search-input').addEventListener('input', renderCustomersScreen);
    document.getElementById('select-cust-search').addEventListener('input', renderCustomerPickerList);

    // Customer Filter Chips
    document.querySelectorAll('[data-filter]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('[data-filter]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        appState.activeCustomerFilter = chip.dataset.filter;
        renderCustomersScreen();
      });
    });

    // Reports Timeframe Chips
    document.querySelectorAll('[data-report-time]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-report-time]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        appState.activeReportTimeframe = chip.dataset.reportTime;
        renderReportsScreen();
      });
    });

    // Settings Actions
    document.getElementById('item-edit-business').addEventListener('click', () => {
      document.getElementById('input-biz-name').value = appState.business.name || '';
      document.getElementById('input-biz-phone').value = appState.business.phone || '';
      document.getElementById('input-biz-address').value = appState.business.address || '';
      document.getElementById('modal-edit-business').classList.remove('hidden');
    });

    document.getElementById('item-edit-phone').addEventListener('click', () => {
      document.getElementById('item-edit-business').click();
    });

    document.getElementById('item-edit-address').addEventListener('click', () => {
      document.getElementById('item-edit-business').click();
    });

    document.getElementById('form-edit-business').addEventListener('submit', (e) => {
      e.preventDefault();
      appState.business.name = document.getElementById('input-biz-name').value.trim() || 'Your Business Name';
      appState.business.phone = document.getElementById('input-biz-phone').value.trim();
      appState.business.address = document.getElementById('input-biz-address').value.trim();
      saveData();
      closeAllModals();
      renderSettingsScreen();
      showToast('Business details updated');
    });

    // Export Data
    document.getElementById('item-export-data').addEventListener('click', () => {
      const exportDataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", exportDataStr);
      downloadAnchor.setAttribute("download", "digital_khata_backup.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Data backup downloaded');
    });

    // Clear All Data
    document.getElementById('item-clear-data').addEventListener('click', () => {
      document.getElementById('modal-clear-confirm').classList.remove('hidden');
    });

    document.getElementById('btn-cancel-clear').addEventListener('click', closeAllModals);

    document.getElementById('btn-confirm-clear').addEventListener('click', () => {
      localStorage.clear();
      appState = {
        onboarded: false,
        business: { name: 'Your Business Name', phone: '03XX-XXXXXXX', address: 'Your Address' },
        customers: [],
        transactions: [],
        activeCustomerId: null,
        activeCustomerFilter: 'all',
        activeReportTimeframe: 'all'
      };
      closeAllModals();
      showToast('All data deleted');
      showScreen('screen-welcome');
      renderAllScreens();
    });

    // Close Modals on close button or backdrop click
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', closeAllModals);
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeAllModals();
      });
    });
  }

  // DOM Content Loaded trigger
  document.addEventListener('DOMContentLoaded', init);

})();
