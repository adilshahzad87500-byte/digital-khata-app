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
    TRANSACTIONS: 'digital_khata_transactions',
    SHADOW_BACKUP: 'digital_khata_shadow_backup',
    THEME: 'digital_khata_theme',
    PROFILE: 'digital_khata_profile',
    SECURITY: 'digital_khata_security'
  };

  // --- PWA INSTALLATION CONTROLLER ---
  let deferredInstallPrompt = null;

  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('[ServiceWorker] Registered successfully:', reg.scope))
          .catch(err => console.error('[ServiceWorker] Registration failed:', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.classList.add('hidden');
      showToast('Digital Khata app installed successfully!');
    });
  }

  function handleInstallAppClick() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          showToast('Installing Digital Khata...');
        }
        deferredInstallPrompt = null;
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.classList.add('hidden');
      });
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

      if (isStandalone) {
        showToast('App is already installed!');
        return;
      }

      const modal = document.getElementById('modal-install-guide');
      const iosGuide = document.getElementById('install-guide-ios');
      const triggerBtn = document.getElementById('btn-trigger-browser-install');

      if (modal) {
        if (isIOS && iosGuide) {
          iosGuide.classList.remove('hidden');
          if (triggerBtn) triggerBtn.classList.add('hidden');
        } else if (iosGuide) {
          iosGuide.classList.add('hidden');
          if (triggerBtn) triggerBtn.classList.remove('hidden');
        }
        modal.classList.remove('hidden');
      }
    }
  }

  // --- STORAGE HELPERS & BACKEND INTEGRITY ---
  function loadData() {
    try {
      appState.onboarded = localStorage.getItem(STORAGE_KEYS.ONBOARDED) === 'true';

      const storedBiz = localStorage.getItem(STORAGE_KEYS.BUSINESS);
      if (storedBiz) appState.business = JSON.parse(storedBiz);

      const storedCust = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (storedCust) {
        let parsed = JSON.parse(storedCust);
        if (Array.isArray(parsed)) {
          appState.customers = parsed.filter(c => c && c.id && c.name);
        }
      }

      const storedTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (storedTx) {
        let parsed = JSON.parse(storedTx);
        if (Array.isArray(parsed)) {
          appState.transactions = parsed.filter(t => t && t.id && t.customerId).map(t => ({
            ...t,
            amount: parseFloat(t.amount) || 0
          }));
        }
      }
      const storedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
      if (storedTheme) appState.theme = storedTheme;

      const storedProf = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (storedProf) {
        try { appState.profile = { ...appState.profile, ...JSON.parse(storedProf) }; } catch(e){}
      }

      const storedSec = localStorage.getItem(STORAGE_KEYS.SECURITY);
      if (storedSec) {
        try { appState.security = { ...appState.security, ...JSON.parse(storedSec) }; } catch(e){}
      }
    } catch (e) {
      console.error('Data loading error! Attempting shadow recovery...', e);
      recoverFromShadowBackup();
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEYS.ONBOARDED, appState.onboarded);
      localStorage.setItem(STORAGE_KEYS.BUSINESS, JSON.stringify(appState.business));
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(appState.customers));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(appState.transactions));
      localStorage.setItem(STORAGE_KEYS.THEME, appState.theme || 'light');
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(appState.profile));
      localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(appState.security));

      // Dual Mirror Shadow Backup for Data Safety
      const shadowPayload = JSON.stringify({
        timestamp: new Date().toISOString(),
        version: "1.2",
        state: appState
      });
      localStorage.setItem(STORAGE_KEYS.SHADOW_BACKUP, shadowPayload);
    } catch (e) {
      console.error('Error saving data to LocalStorage:', e);
    }
  }

  function applyTheme(theme) {
    appState.theme = theme;
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    document.body.setAttribute('data-theme', theme);

    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0F172A' : '#F4F7F6');
    }

    const radioLight = document.getElementById('radio-theme-light');
    const radioDark = document.getElementById('radio-theme-dark');
    if (radioLight && radioDark) {
      radioLight.checked = (theme === 'light');
      radioDark.checked = (theme === 'dark');
    }
  }

  function recoverFromShadowBackup() {
    try {
      const shadow = localStorage.getItem(STORAGE_KEYS.SHADOW_BACKUP);
      if (shadow) {
        const payload = JSON.parse(shadow);
        if (payload && payload.state) {
          appState = payload.state;
          saveData();
          console.log('Successfully recovered data from shadow backup!');
        }
      }
    } catch (err) {
      console.error('Shadow recovery failed:', err);
    }
  }

  function handleRestoreDataFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const imported = JSON.parse(e.target.result);
        let targetState = imported.state ? imported.state : imported;

        if (!targetState || typeof targetState !== 'object') {
          throw new Error('Invalid JSON structure');
        }

        appState.onboarded = true;
        if (targetState.business) appState.business = targetState.business;
        if (Array.isArray(targetState.customers)) appState.customers = targetState.customers;
        if (Array.isArray(targetState.transactions)) appState.transactions = targetState.transactions;

        saveData();
        renderAllScreens();
        showToast('Data backup restored successfully!');
      } catch (err) {
        alert('Failed to restore backup: Invalid or corrupted JSON file.');
      }
    };
    reader.readAsText(file);
  }

  // --- STATE ---
  let appState = {
    onboarded: false,
    theme: 'light',
    business: {
      name: 'Your Business Name',
      phone: '03XX-XXXXXXX',
      address: 'Your Address'
    },
    profile: {
      ownerName: 'Owner Name',
      email: '',
      avatar: ''
    },
    security: {
      isPasswordSet: false,
      pin: '',
      question: 'What is your shop or business name?',
      answer: ''
    },
    customers: [],
    transactions: [],
    activeCustomerId: null,
    activeDashFilter: 'all',
    activeCustomerFilter: 'all',
    activeReportTimeframe: 'all',
    quickActionTarget: null // 'udhaar' or 'payment' when using quick action picker
  };

  let currentPinBuffer = '';

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
    settings: document.getElementById('screen-settings'),
    profile: document.getElementById('screen-profile')
  };

  const bottomNav = document.getElementById('bottom-nav');
  const navItems = document.querySelectorAll('.nav-item');

  // --- INITIALIZATION ---
  async function init() {
    if (window.Auth) {
      window.Auth.requireAuth();
      const currentUser = window.Auth.getCurrentUser();
      if (currentUser) {
        appState.profile.ownerName = currentUser.fullName || appState.profile.ownerName;
        appState.business.phone = currentUser.phone || appState.business.phone;
        appState.business.name = currentUser.businessName || appState.business.name;
        appState.profile.email = currentUser.email || appState.profile.email;

        if (window.DB) {
          try {
            const data = await window.DB.loadUserData(currentUser.id);
            if (data.customers && data.customers.length > 0) appState.customers = data.customers;
            if (data.transactions && data.transactions.length > 0) appState.transactions = data.transactions;
          } catch(err) {
            console.warn('DB load warning:', err);
          }
        }
      }
    }

    loadData();
    applyTheme(appState.theme || 'light');
    bindEvents();
    initPWA();

    if (!appState.onboarded) {
      showScreen('screen-dashboard');
      appState.onboarded = true;
      saveData();
    } else {
      showScreen('screen-dashboard');
    }

    renderAllScreens();
    checkAppLockOnStart();

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
    if (screenId === 'screen-profile') renderProfileScreen();
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
      const type = (t.type || '').toUpperCase();
      if (type === 'UDHAAR') totalUdhaar += amt;
      if (type === 'PAYMENT') totalReceived += amt;
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
      const type = (t.type || '').toUpperCase();
      if (type === 'UDHAAR') totalUdhaar += amt;
      if (type === 'PAYMENT') totalReceived += amt;
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
    renderProfileScreen();
    updateAvatarUI();
  }

  // --- APP LOCK & SECURITY LOGIC ---
  function checkAppLockOnStart() {
    const lockScreen = document.getElementById('screen-app-lock');
    if (!lockScreen) return;
    if (appState.security && appState.security.isPasswordSet && appState.security.pin) {
      lockScreen.classList.remove('hidden');
      currentPinBuffer = '';
      updatePinDots();
      updateAvatarUI();
    } else {
      lockScreen.classList.add('hidden');
    }
  }

  function handleKeypadInput(key) {
    const targetLength = (appState.security && appState.security.pin) ? appState.security.pin.length : 4;

    if (key === 'clear') {
      currentPinBuffer = '';
      updatePinDots();
      return;
    }
    if (key === 'delete') {
      currentPinBuffer = currentPinBuffer.slice(0, -1);
      updatePinDots();
      return;
    }
    if (currentPinBuffer.length < targetLength) {
      currentPinBuffer += key;
      updatePinDots();
    }

    if (currentPinBuffer.length === targetLength) {
      if (currentPinBuffer === appState.security.pin) {
        // Unlock Success
        const lockScreen = document.getElementById('screen-app-lock');
        if (lockScreen) lockScreen.classList.add('hidden');
        currentPinBuffer = '';
        updatePinDots();
        showToast('App Unlocked 🔓');
      } else {
        // Unlock Error
        const dotsEl = document.getElementById('lock-pin-dots');
        const errEl = document.getElementById('lock-error-msg');
        if (dotsEl) dotsEl.classList.add('error');
        if (errEl) errEl.classList.remove('hidden');

        setTimeout(() => {
          currentPinBuffer = '';
          updatePinDots();
          if (dotsEl) dotsEl.classList.remove('error');
          if (errEl) errEl.classList.add('hidden');
        }, 600);
      }
    }
  }

  function updatePinDots() {
    const dotsContainer = document.getElementById('lock-pin-dots');
    if (!dotsContainer) return;
    const dots = dotsContainer.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
      if (index < currentPinBuffer.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  // --- PROFILE & AVATAR LOGIC ---
  function updateAvatarUI() {
    const avatarData = appState.profile ? appState.profile.avatar : '';
    const headerContainer = document.getElementById('header-avatar-container');
    const profileContainer = document.getElementById('profile-modal-avatar');
    const profilePageContainer = document.getElementById('profile-page-avatar');
    const settingsAvatarContainer = document.getElementById('settings-avatar-container');
    const lockContainer = document.getElementById('lock-user-avatar');
    const removeBtn = document.getElementById('btn-remove-profile-photo');
    const removePageBtn = document.getElementById('btn-remove-profile-page-photo');

    const defaultSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    if (avatarData) {
      const imgHtml = `<img src="${avatarData}" alt="Profile Photo">`;
      if (headerContainer) headerContainer.innerHTML = imgHtml;
      if (profileContainer) profileContainer.innerHTML = imgHtml;
      if (profilePageContainer) profilePageContainer.innerHTML = imgHtml;
      if (settingsAvatarContainer) settingsAvatarContainer.innerHTML = imgHtml;
      if (lockContainer) lockContainer.innerHTML = imgHtml;
      if (removeBtn) removeBtn.classList.remove('hidden');
      if (removePageBtn) removePageBtn.classList.remove('hidden');
    } else {
      if (headerContainer) headerContainer.innerHTML = defaultSvg;
      if (profileContainer) profileContainer.innerHTML = defaultSvg;
      if (profilePageContainer) profilePageContainer.innerHTML = defaultSvg;
      if (settingsAvatarContainer) settingsAvatarContainer.innerHTML = defaultSvg;
      if (lockContainer) lockContainer.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;
      if (removeBtn) removeBtn.classList.add('hidden');
      if (removePageBtn) removePageBtn.classList.add('hidden');
    }
  }

  function renderProfileScreen() {
    updateAvatarUI();

    const ownerName = (appState.profile && appState.profile.ownerName) || appState.business.name || 'Owner Name';
    const bizName = appState.business.name || 'Your Business Name';

    // Displays
    const dispPageName = document.getElementById('display-profile-page-name');
    const dispPageBiz = document.getElementById('display-profile-page-biz');
    if (dispPageName) dispPageName.textContent = ownerName;
    if (dispPageBiz) dispPageBiz.textContent = bizName;

    // Inputs
    const inPageOwner = document.getElementById('input-profile-page-owner');
    const inPageBiz = document.getElementById('input-profile-page-biz');
    const inPagePhone = document.getElementById('input-profile-page-phone');
    const inPageEmail = document.getElementById('input-profile-page-email');
    const inPageAddr = document.getElementById('input-profile-page-address');

    if (inPageOwner) inPageOwner.value = (appState.profile && appState.profile.ownerName) || '';
    if (inPageBiz) inPageBiz.value = appState.business.name || '';
    if (inPagePhone) inPagePhone.value = appState.business.phone || '';
    if (inPageEmail) inPageEmail.value = (appState.profile && appState.profile.email) || '';
    if (inPageAddr) inPageAddr.value = appState.business.address || '';

    // Quick Stats
    const custStat = document.getElementById('profile-stat-customers');
    const secStat = document.getElementById('profile-stat-security');
    if (custStat) custStat.textContent = appState.customers ? appState.customers.length : 0;
    if (secStat) {
      if (appState.security && appState.security.isPasswordSet) {
        secStat.textContent = 'Protected 🔒';
        secStat.style.color = 'var(--text-green)';
      } else {
        secStat.textContent = 'Disabled';
        secStat.style.color = 'var(--text-muted)';
      }
    }

    // Lock status display on profile page
    const lockStatusEl = document.getElementById('profile-page-lock-status');
    const lockBadgeEl = document.getElementById('profile-page-lock-badge');
    if (appState.security && appState.security.isPasswordSet) {
      if (lockStatusEl) lockStatusEl.textContent = 'App Lock is Active (PIN Protected)';
      if (lockBadgeEl) {
        lockBadgeEl.textContent = 'Active 🔒';
        lockBadgeEl.className = 'badge badge-green';
      }
    } else {
      if (lockStatusEl) lockStatusEl.textContent = 'Protect app with PIN password';
      if (lockBadgeEl) {
        lockBadgeEl.textContent = 'Disabled';
        lockBadgeEl.className = 'badge';
      }
    }

    // Theme status display on profile page
    const themeStatusEl = document.getElementById('profile-page-theme-status');
    if (themeStatusEl) {
      themeStatusEl.textContent = appState.theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }

    // Sync Settings screen banner display
    const setOwner = document.getElementById('settings-display-owner');
    const setBiz = document.getElementById('settings-display-biz');
    if (setOwner) setOwner.textContent = ownerName;
    if (setBiz) setBiz.textContent = bizName;

    renderProfileModal();
  }

  function renderProfileModal() {
    updateAvatarUI();

    const ownerName = (appState.profile && appState.profile.ownerName) || appState.business.name || 'Owner Name';
    const bizName = appState.business.name || 'Your Business Name';

    const dispName = document.getElementById('display-profile-name');
    const dispBiz = document.getElementById('display-profile-biz');
    if (dispName) dispName.textContent = ownerName;
    if (dispBiz) dispBiz.textContent = bizName;

    const inOwner = document.getElementById('input-profile-owner');
    const inBiz = document.getElementById('input-profile-biz');
    const inPhone = document.getElementById('input-profile-phone');
    const inEmail = document.getElementById('input-profile-email');
    const inAddr = document.getElementById('input-profile-address');

    if (inOwner) inOwner.value = (appState.profile && appState.profile.ownerName) || '';
    if (inBiz) inBiz.value = appState.business.name || '';
    if (inPhone) inPhone.value = appState.business.phone || '';
    if (inEmail) inEmail.value = (appState.profile && appState.profile.email) || '';
    if (inAddr) inAddr.value = appState.business.address || '';

    // Lock status display
    const lockStatusEl = document.getElementById('profile-lock-status');
    const lockBadgeEl = document.getElementById('profile-lock-badge');
    if (appState.security && appState.security.isPasswordSet) {
      if (lockStatusEl) lockStatusEl.textContent = 'App Lock is Active (PIN Protected)';
      if (lockBadgeEl) {
        lockBadgeEl.textContent = 'Active 🔒';
        lockBadgeEl.className = 'badge badge-green';
      }
    } else {
      if (lockStatusEl) lockStatusEl.textContent = 'Protect app with PIN password';
      if (lockBadgeEl) {
        lockBadgeEl.textContent = 'Disabled';
        lockBadgeEl.className = 'badge';
      }
    }

    // Theme status display
    const themeStatusEl = document.getElementById('profile-theme-status');
    if (themeStatusEl) {
      themeStatusEl.textContent = appState.theme === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
  }

  function handleProfilePhotoUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        appState.profile.avatar = compressedBase64;
        saveData();
        updateAvatarUI();
        showToast('Profile photo updated');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function updateSecurityUI() {
    const isLocked = appState.security && appState.security.isPasswordSet;
    const headerEl = document.getElementById('security-status-header');
    const descEl = document.getElementById('security-status-desc');
    const iconEl = document.getElementById('security-status-icon');
    const saveBtn = document.getElementById('btn-save-password');
    const removeBox = document.getElementById('box-remove-password');
    const pinInput = document.getElementById('input-new-pin');
    const confirmPinInput = document.getElementById('input-confirm-pin');
    const answerInput = document.getElementById('input-security-a');

    if (pinInput) pinInput.value = '';
    if (confirmPinInput) confirmPinInput.value = '';

    if (isLocked) {
      if (headerEl) headerEl.textContent = 'App Lock is Active 🔒';
      if (descEl) descEl.textContent = 'Your app is protected with a PIN password.';
      if (iconEl) iconEl.classList.add('active-lock');
      if (saveBtn) saveBtn.textContent = 'Update Password / Security';
      if (removeBox) removeBox.classList.remove('hidden');
    } else {
      if (headerEl) headerEl.textContent = 'App Lock is Disabled';
      if (descEl) descEl.textContent = 'Set a PIN password to lock the app whenever it opens.';
      if (iconEl) iconEl.classList.remove('active-lock');
      if (saveBtn) saveBtn.textContent = 'Enable Password Lock';
      if (removeBox) removeBox.classList.add('hidden');
    }

    if (appState.security) {
      if (appState.security.question) {
        const qSelect = document.getElementById('select-security-q');
        if (qSelect) qSelect.value = appState.security.question;
      }
      if (appState.security.answer && answerInput) {
        answerInput.value = appState.security.answer;
      } else if (answerInput) {
        answerInput.value = '';
      }
    }
  }

  // 1. DASHBOARD
  function renderDashboard() {
    const totals = getGlobalTotals();
    const totalUdhaarEl = document.getElementById('dash-total-udhaar');
    const totalReceivedEl = document.getElementById('dash-total-received');
    const remainingEl = document.getElementById('dash-remaining');

    if (totalUdhaarEl) totalUdhaarEl.textContent = formatRs(totals.totalUdhaar);
    if (totalReceivedEl) totalReceivedEl.textContent = formatRs(totals.totalReceived);
    if (remainingEl) remainingEl.textContent = formatRs(totals.remaining);

    // Business & Profile Greeting Updates
    const ownerName = (appState.profile && appState.profile.ownerName) || (appState.business && appState.business.name) || 'User';
    const bizName = (appState.business && appState.business.name) || 'Digital Khata';
    
    const greetingEl = document.getElementById('dash-greeting-text');
    if (greetingEl) greetingEl.textContent = `Hello, ${ownerName}!`;

    const bizNameEl = document.getElementById('dash-business-name');
    if (bizNameEl) bizNameEl.textContent = bizName;

    const dateEl = document.getElementById('dash-current-date');
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // Hero Net Banner Calculations
    const netAmountEl = document.getElementById('dash-net-amount');
    const netLabelEl = document.getElementById('dash-net-status-label');
    const netBadgeEl = document.getElementById('dash-net-badge');
    const progressFill = document.getElementById('dash-net-progress-fill');
    const custCountBadge = document.getElementById('dash-active-customers-badge');
    const countBadgeEl = document.getElementById('dash-customer-count-badge');
    const udhaarProgressLabel = document.getElementById('dash-progress-udhaar-label');
    const receivedProgressLabel = document.getElementById('dash-progress-received-label');

    const custCount = appState.customers ? appState.customers.length : 0;
    if (custCountBadge) custCountBadge.textContent = `${custCount} Customers`;
    if (countBadgeEl) countBadgeEl.textContent = custCount;

    if (udhaarProgressLabel) udhaarProgressLabel.textContent = `Udhaar: ${formatRs(totals.totalUdhaar)}`;
    if (receivedProgressLabel) receivedProgressLabel.textContent = `Vasool: ${formatRs(totals.totalReceived)}`;

    const remaining = totals.remaining;
    if (remaining > 0) {
      if (netLabelEl) netLabelEl.textContent = 'Aap ne LENA hai (Net Udhaar)';
      if (netAmountEl) netAmountEl.textContent = formatRs(remaining);
      if (netBadgeEl) {
        netBadgeEl.textContent = 'Net Take';
        netBadgeEl.className = 'hero-badge badge-take';
      }
    } else if (remaining < 0) {
      if (netLabelEl) netLabelEl.textContent = 'Aap ne DENA hai (Net Advance)';
      if (netAmountEl) netAmountEl.textContent = formatRs(Math.abs(remaining));
      if (netBadgeEl) {
        netBadgeEl.textContent = 'Net Give';
        netBadgeEl.className = 'hero-badge badge-give';
      }
    } else {
      if (netLabelEl) netLabelEl.textContent = 'Baqaya Zero (Settled ✅)';
      if (netAmountEl) netAmountEl.textContent = 'Rs. 0';
      if (netBadgeEl) {
        netBadgeEl.textContent = 'Settled';
        netBadgeEl.className = 'hero-badge';
      }
    }

    // Calculate progress ratio
    const totalFlow = totals.totalUdhaar + totals.totalReceived;
    let percentage = 50;
    if (totalFlow > 0) {
      percentage = Math.min(100, Math.max(5, (totals.totalReceived / totalFlow) * 100));
    }
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
      if (remaining > 0) {
        progressFill.classList.remove('fill-danger');
      } else if (remaining < 0) {
        progressFill.classList.add('fill-danger');
      }
    }

    const searchTerm = (document.getElementById('dash-search-input')?.value || '').trim().toLowerCase();
    const dashFilter = appState.activeDashFilter || 'all';
    const emptyState = document.getElementById('dash-empty-state');
    const customerListEl = document.getElementById('dash-customer-list');

    if (appState.customers.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (customerListEl) customerListEl.classList.add('hidden');
      return;
    }

    let filtered = appState.customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm) || c.phone.includes(searchTerm)
    );

    if (dashFilter === 'due') {
      filtered = filtered.filter(c => getCustomerBalance(c.id).remaining > 0);
    } else if (dashFilter === 'paid') {
      filtered = filtered.filter(c => getCustomerBalance(c.id).remaining <= 0);
    }

    if (countBadgeEl) countBadgeEl.textContent = filtered.length;

    if (filtered.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (customerListEl) customerListEl.classList.add('hidden');
    } else {
      if (emptyState) emptyState.classList.add('hidden');
      if (customerListEl) customerListEl.classList.remove('hidden');
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

      const custTxs = appState.transactions.filter(t => t.customerId === cust.id);
      const isPaisaWasool = bal.remaining <= 0 && custTxs.length > 0;

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
          <span class="cust-status-badge ${bal.remaining > 0 ? 'badge-due' : (isPaisaWasool ? 'badge-paisa-wasool' : 'badge-paid')}">
            ${bal.remaining > 0 ? 'Due' : (isPaisaWasool ? '✓ Payment Received' : 'Paid')}
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

    const elTotalUdhaar = document.getElementById('detail-total-udhaar');
    const elTotalReceived = document.getElementById('detail-total-received');
    if (elTotalUdhaar) elTotalUdhaar.textContent = formatRs(bal.totalUdhaar);
    if (elTotalReceived) elTotalReceived.textContent = formatRs(bal.totalReceived);

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
        const isUdhaar = (t.type || '').toUpperCase() === 'UDHAAR';

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
            <div class="tx-actions-row">
              ${isUdhaar ? `<button class="tx-pay-minus-btn" title="Minus/Pay this Udhaar" data-tx-id="${t.id}">⚡ Pay / Minus</button>` : ''}
              <button class="tx-del-btn" title="Delete Transaction" data-tx-id="${t.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        `;

        if (isUdhaar) {
          const btnPayMinus = item.querySelector('.tx-pay-minus-btn');
          if (btnPayMinus) {
            btnPayMinus.addEventListener('click', (e) => {
              e.stopPropagation();
              appState.activeCustomerId = customerId;
              const pAmt = document.getElementById('payment-amount');
              const pNote = document.getElementById('payment-note');
              if (pAmt) pAmt.value = t.amount;
              if (pNote) pNote.value = `Payment for: ${t.description || 'Udhaar'}`;
              showToast(`⚡ Pre-filled ${formatRs(t.amount)} to minus from Udhaar`);
              showScreen('screen-receive-payment');
            });
          }
        }

        item.querySelector('.tx-del-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteTransaction(t.id);
        });

        txListEl.appendChild(item);
      });
    }

    // WhatsApp Reminder button styling update
    const btnWa = document.getElementById('btn-whatsapp-reminder');
    if (btnWa) {
      btnWa.style.opacity = '1';
      btnWa.disabled = false;
    }

    // Poora Paisa Wasool Button & Banner Tag update
    const btnPaisaWasool = document.getElementById('btn-paisa-wasool');
    const bannerTag = document.getElementById('paisa-wasool-banner-tag');

    if (bal.remaining <= 0 && custTxs.length > 0) {
      if (bannerTag) bannerTag.classList.remove('hidden');
      if (btnPaisaWasool) {
        btnPaisaWasool.classList.add('is-settled');
        btnPaisaWasool.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>✓ Total Payment Received (Khata Clear)</span>
        `;
      }
    } else {
      if (bannerTag) bannerTag.classList.add('hidden');
      if (btnPaisaWasool) {
        btnPaisaWasool.classList.remove('is-settled');
        btnPaisaWasool.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span>⚡ Total Payment Received</span>
        `;
      }
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
    const bizNameEl = document.getElementById('set-biz-name');
    const bizPhoneEl = document.getElementById('set-biz-phone');
    const bizAddrEl = document.getElementById('set-biz-address');
    if (bizNameEl) bizNameEl.textContent = appState.business.name || 'Your Business Name';
    if (bizPhoneEl) bizPhoneEl.textContent = appState.business.phone || '03XX-XXXXXXX';
    if (bizAddrEl) bizAddrEl.textContent = appState.business.address || 'Your Address';

    const lockSub = document.getElementById('set-lock-sublabel');
    const lockBadge = document.getElementById('set-lock-badge');
    if (appState.security && appState.security.isPasswordSet) {
      if (lockSub) lockSub.textContent = 'App Lock is Active (PIN Protected)';
      if (lockBadge) {
        lockBadge.textContent = 'Active 🔒';
        lockBadge.className = 'badge badge-green';
      }
    } else {
      if (lockSub) lockSub.textContent = 'Protect app with PIN password';
      if (lockBadge) {
        lockBadge.textContent = 'Disabled';
        lockBadge.className = 'badge';
      }
    }
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
    // Clean phone number (replace leading 0 with 92 for Pakistan standard WhatsApp links)
    let rawPhone = cust.phone.replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) {
      rawPhone = '92' + rawPhone.substring(1);
    }

    let message = '';
    if (bal.remaining > 0) {
      message = `Assalam-o-Alaikum ${cust.name},\n\nYour remaining khata balance is ${formatRs(bal.remaining)}.\n\nPlease clear the outstanding amount.\n\nThank you.`;
    } else {
      message = `Assalam-o-Alaikum ${cust.name},\n\nAap ke Khata ka poora paisa (${formatRs(bal.totalReceived)}) wasool ho chuka hai. Aapka balance ab Rs. 0 (Mukammal Clear) hai.\n\nDigital Khata par transaction ke liye shukriya! 🎉`;
    }

    const waUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  }

  // --- TOTAL PAYMENT RECEIVED CONTROLLER ---
  function openPaisaWasoolModal() {
    const cust = appState.customers.find(c => c.id === appState.activeCustomerId);
    if (!cust) {
      showToast('Please select a customer first');
      return;
    }

    const bal = getCustomerBalance(cust.id);
    if (bal.remaining <= 0) {
      showToast('✓ Iss customer ki total payment pehle hi receive ho chuki hai!');
      return;
    }

    document.getElementById('pw-modal-cust-name').textContent = cust.name;
    document.getElementById('pw-modal-balance').textContent = formatRs(bal.remaining);
    document.getElementById('pw-date').value = getTodayString();
    document.getElementById('pw-note').value = 'Total Payment Received (Full Settlement)';

    document.getElementById('modal-paisa-wasool').classList.remove('hidden');
  }

  function handlePaisaWasoolSubmit(e) {
    e.preventDefault();
    const cust = appState.customers.find(c => c.id === appState.activeCustomerId);
    if (!cust) return;

    const bal = getCustomerBalance(cust.id);
    if (bal.remaining <= 0) {
      closeAllModals();
      showToast('✓ Iss customer ka balance pehle hi clear hai!');
      return;
    }

    const settleDate = document.getElementById('pw-date').value || getTodayString();
    const note = document.getElementById('pw-note').value.trim() || 'Total Payment Received';

    const newTx = {
      id: 'tx_' + Date.now(),
      customerId: cust.id,
      type: 'PAYMENT',
      amount: bal.remaining,
      description: note,
      date: settleDate,
      createdAt: new Date().toISOString()
    };

    appState.transactions.push(newTx);
    saveData();
    closeAllModals();

    showToast(`🎉 Shabaash! ${cust.name} se total payment (${formatRs(newTx.amount)}) receive ho gayi!`);
    renderCustomerDetailsScreen(cust.id);
  }

  function handleAutoFillPaisaWasool() {
    if (!appState.activeCustomerId) {
      showToast('Please select a customer first');
      return;
    }

    const bal = getCustomerBalance(appState.activeCustomerId);
    if (bal.remaining <= 0) {
      showToast('Customer has no remaining balance');
      return;
    }

    document.getElementById('payment-amount').value = bal.remaining;
    document.getElementById('payment-note').value = 'Total Payment Received';
    showToast(`⚡ Full balance ${formatRs(bal.remaining)} auto-filled!`);
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
    document.getElementById('btn-get-started')?.addEventListener('click', () => {
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

    // Header Profile Icon click -> Open Profile Page
    document.getElementById('btn-header-profile')?.addEventListener('click', () => {
      renderProfileScreen();
      showScreen('screen-profile');
    });

    // Settings Profile Banner click
    document.getElementById('btn-settings-open-profile')?.addEventListener('click', () => {
      renderProfileScreen();
      showScreen('screen-profile');
    });

    // Profile Form submission
    document.getElementById('form-profile-info')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const ownerName = document.getElementById('input-profile-owner').value.trim();
      const bizName = document.getElementById('input-profile-biz').value.trim();
      const phone = document.getElementById('input-profile-phone').value.trim();
      const email = document.getElementById('input-profile-email').value.trim();
      const address = document.getElementById('input-profile-address').value.trim();

      appState.profile.ownerName = ownerName || 'Owner Name';
      appState.profile.email = email;
      appState.business.name = bizName || 'Your Business Name';
      appState.business.phone = phone || '03XX-XXXXXXX';
      appState.business.address = address || 'Your Address';

      saveData();
      renderAllScreens();
      renderProfileModal();
      showToast('Profile details updated');
    });

    // Profile Page Form submission
    document.getElementById('form-profile-page-info')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const ownerName = document.getElementById('input-profile-page-owner').value.trim();
      const bizName = document.getElementById('input-profile-page-biz').value.trim();
      const phone = document.getElementById('input-profile-page-phone').value.trim();
      const email = document.getElementById('input-profile-page-email').value.trim();
      const address = document.getElementById('input-profile-page-address').value.trim();

      appState.profile.ownerName = ownerName || 'Owner Name';
      appState.profile.email = email;
      appState.business.name = bizName || 'Your Business Name';
      appState.business.phone = phone || '03XX-XXXXXXX';
      appState.business.address = address || 'Your Address';

      saveData();
      renderAllScreens();
      renderProfileScreen();
      showToast('Profile details updated successfully');
    });

    // Profile Page Photo File Input & Delete
    const pagePhotoInput = document.getElementById('input-profile-page-photo');
    if (pagePhotoInput) {
      pagePhotoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleProfilePhotoUpload(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    document.getElementById('btn-remove-profile-page-photo')?.addEventListener('click', () => {
      appState.profile.avatar = '';
      saveData();
      updateAvatarUI();
      showToast('Profile photo removed');
    });

    // Security Modal Open Triggers
    ['item-open-security', 'item-profile-page-security', 'item-app-lock', 'card-stat-security-trigger'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        updateSecurityUI();
        document.getElementById('modal-security-settings')?.classList.remove('hidden');
      });
    });

    document.getElementById('item-profile-page-theme')?.addEventListener('click', () => {
      const newTheme = appState.theme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      saveData();
      renderProfileScreen();
      showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode`);
    });

    document.getElementById('item-profile-page-backup')?.addEventListener('click', () => {
      const backupBtn = document.getElementById('item-backup-data');
      if (backupBtn) backupBtn.click();
    });

    // Password Lock Form submit
    document.getElementById('form-security-password')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const pin = document.getElementById('input-new-pin').value.trim();
      const confirmPin = document.getElementById('input-confirm-pin').value.trim();
      const question = document.getElementById('select-security-q').value;
      const answer = document.getElementById('input-security-a').value.trim();

      if (pin !== confirmPin) {
        alert('PIN passwords do not match!');
        return;
      }
      if (pin.length < 4) {
        alert('PIN must be at least 4 digits long');
        return;
      }

      appState.security = {
        isPasswordSet: true,
        pin: pin,
        question: question,
        answer: answer
      };

      saveData();
      closeAllModals();
      renderAllScreens();
      renderProfileModal();
      showToast('App Password Lock Enabled 🔒');
    });

    // Remove Password Lock button
    document.getElementById('btn-remove-password')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to remove the password lock from Digital Khata?')) {
        appState.security.isPasswordSet = false;
        appState.security.pin = '';
        saveData();
        updateSecurityUI();
        renderAllScreens();
        renderProfileModal();
        showToast('App Password Lock removed');
      }
    });

    // Lock App Now button
    document.getElementById('btn-lock-now')?.addEventListener('click', () => {
      closeAllModals();
      checkAppLockOnStart();
      showToast('App Locked 🔒');
    });

    // Theme Toggle inside Profile
    const toggleThemeBtn = document.getElementById('btn-toggle-profile-theme');
    if (toggleThemeBtn) {
      toggleThemeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextTheme = appState.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        renderProfileModal();
      });
    }

    const itemProfTheme = document.getElementById('item-profile-theme');
    if (itemProfTheme) {
      itemProfTheme.addEventListener('click', () => {
        const nextTheme = appState.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        renderProfileModal();
      });
    }

    // Backup & Restore link in Profile
    document.getElementById('item-profile-backup')?.addEventListener('click', () => {
      const backupBtn = document.getElementById('item-backup-data');
      if (backupBtn) backupBtn.click();
    });

    // PIN Keypad buttons
    document.querySelectorAll('.keypad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key) handleKeypadInput(key);
      });
    });

    document.getElementById('btn-lock-clear')?.addEventListener('click', () => handleKeypadInput('clear'));
    document.getElementById('btn-lock-delete')?.addEventListener('click', () => handleKeypadInput('delete'));

    // Physical Keyboard support for Lock Screen
    window.addEventListener('keydown', (e) => {
      const lockScreen = document.getElementById('screen-app-lock');
      if (lockScreen && !lockScreen.classList.contains('hidden')) {
        if (e.key >= '0' && e.key <= '9') {
          handleKeypadInput(e.key);
        } else if (e.key === 'Backspace') {
          handleKeypadInput('delete');
        } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
          handleKeypadInput('clear');
        }
      }
    });

    // Forgot Password link & form
    document.getElementById('btn-forgot-password-link')?.addEventListener('click', () => {
      const qText = document.getElementById('forgot-q-text');
      if (qText) {
        qText.textContent = (appState.security && appState.security.question) ? appState.security.question : 'What is your shop or business name?';
      }
      document.getElementById('modal-forgot-password')?.classList.remove('hidden');
    });

    document.getElementById('form-forgot-password')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const ansInput = document.getElementById('input-forgot-answer').value.trim().toLowerCase();
      const newPin = document.getElementById('input-forgot-new-pin').value.trim();

      const storedAns = (appState.security && appState.security.answer) ? appState.security.answer.trim().toLowerCase() : '';
      const bizNameAns = (appState.business && appState.business.name) ? appState.business.name.trim().toLowerCase() : '';

      if (ansInput && (ansInput === storedAns || ansInput === bizNameAns)) {
        if (newPin.length < 4) {
          alert('New PIN must be at least 4 digits long');
          return;
        }

        appState.security.isPasswordSet = true;
        appState.security.pin = newPin;
        saveData();

        closeAllModals();
        const lockScreen = document.getElementById('screen-app-lock');
        if (lockScreen) lockScreen.classList.add('hidden');
        currentPinBuffer = '';
        updatePinDots();

        showToast('Password reset successfully! App unlocked 🔓');
      } else {
        alert('Incorrect security answer! Please check and try again.');
      }
    });

    // Floating FAB Center (+)
    document.getElementById('btn-fab-center')?.addEventListener('click', () => {
      document.getElementById('modal-action-sheet')?.classList.remove('hidden');
    });

    document.getElementById('btn-close-action-sheet')?.addEventListener('click', closeAllModals);

    // Action Sheet Items
    document.getElementById('act-add-customer')?.addEventListener('click', () => {
      closeAllModals();
      showScreen('screen-add-customer');
    });

    document.getElementById('act-add-udhaar')?.addEventListener('click', () => {
      closeAllModals();
      openCustomerPicker('udhaar');
    });

    document.getElementById('act-receive-payment')?.addEventListener('click', () => {
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
    document.getElementById('form-add-customer')?.addEventListener('submit', handleAddCustomer);
    document.getElementById('form-add-udhaar')?.addEventListener('submit', handleAddUdhaar);
    document.getElementById('form-receive-payment')?.addEventListener('submit', handleReceivePayment);

    // Set Default dates in forms
    const uDate = document.getElementById('udhaar-date');
    const pDate = document.getElementById('payment-date');
    if (uDate) uDate.value = getTodayString();
    if (pDate) pDate.value = getTodayString();

    // Customer Detail buttons
    document.getElementById('btn-add-udhaar')?.addEventListener('click', () => {
      showScreen('screen-add-udhaar');
    });

    document.getElementById('btn-receive-payment')?.addEventListener('click', () => {
      showScreen('screen-receive-payment');
    });

    document.getElementById('btn-whatsapp-reminder')?.addEventListener('click', triggerWhatsAppReminder);

    // Customer Menu button (3 dots)
    document.getElementById('btn-cust-menu')?.addEventListener('click', () => {
      const cust = appState.customers.find(c => c.id === appState.activeCustomerId);
      if (cust) {
        document.getElementById('cust-menu-title').textContent = cust.name;
        document.getElementById('modal-cust-options').classList.remove('hidden');
      }
    });

    document.getElementById('btn-close-cust-options')?.addEventListener('click', closeAllModals);

    document.getElementById('btn-paisa-wasool')?.addEventListener('click', openPaisaWasoolModal);
    document.getElementById('opt-paisa-wasool')?.addEventListener('click', () => {
      closeAllModals();
      openPaisaWasoolModal();
    });
    document.getElementById('form-paisa-wasool')?.addEventListener('submit', handlePaisaWasoolSubmit);
    document.getElementById('btn-autofill-paisa-wasool')?.addEventListener('click', handleAutoFillPaisaWasool);

    document.getElementById('opt-edit-customer')?.addEventListener('click', () => {
      closeAllModals();
      const cust = appState.customers.find(c => c.id === appState.activeCustomerId);
      if (cust) {
        document.getElementById('cust-name').value = cust.name;
        document.getElementById('cust-phone').value = cust.phone;
        document.getElementById('cust-address').value = cust.address || '';
        showScreen('screen-add-customer');
      }
    });

    document.getElementById('opt-delete-customer')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this customer and all their transactions?')) {
        deleteCustomer(appState.activeCustomerId);
      }
    });

    // Search inputs live filtering
    document.getElementById('dash-search-input')?.addEventListener('input', renderDashboard);
    document.getElementById('cust-search-input')?.addEventListener('input', renderCustomersScreen);
    document.getElementById('select-cust-search')?.addEventListener('input', renderCustomerPickerList);

    // Home Dashboard Filter Chips
    document.querySelectorAll('[data-dash-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-dash-filter]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        appState.activeDashFilter = chip.dataset.dashFilter;
        renderDashboard();
      });
    });

    // Header Search Icon Click
    document.getElementById('btn-header-search')?.addEventListener('click', () => {
      const searchInput = document.getElementById('dash-search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Target Screen Navigation Triggers
    document.querySelectorAll('[data-target-screen]').forEach(tile => {
      tile.addEventListener('click', () => {
        const targetScreen = tile.dataset.targetScreen;
        if (targetScreen) showScreen(targetScreen);
      });
    });

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

    // Theme Selection
    document.getElementById('item-theme-light')?.addEventListener('click', () => applyTheme('light'));
    document.getElementById('item-theme-dark')?.addEventListener('click', () => applyTheme('dark'));
    document.getElementById('radio-theme-light')?.addEventListener('change', () => applyTheme('light'));
    document.getElementById('radio-theme-dark')?.addEventListener('change', () => applyTheme('dark'));

    // About Digital Khata
    document.getElementById('item-about-app')?.addEventListener('click', () => {
      const aboutModal = document.getElementById('modal-about-app');
      if (aboutModal) aboutModal.classList.remove('hidden');
    });

    // Log Out Action
    document.getElementById('item-logout-app')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to log out of Digital Khata?')) {
        if (window.Auth) {
          window.Auth.logout();
        } else {
          window.location.href = 'login.html';
        }
      }
    });

    // Settings Actions - Business Edit
    const openBizModal = () => {
      document.getElementById('input-biz-name').value = appState.business.name || '';
      document.getElementById('input-biz-phone').value = appState.business.phone || '';
      document.getElementById('input-biz-address').value = appState.business.address || '';
      document.getElementById('modal-edit-business').classList.remove('hidden');
    };

    document.getElementById('item-edit-business')?.addEventListener('click', openBizModal);
    document.getElementById('item-edit-phone')?.addEventListener('click', openBizModal);
    document.getElementById('item-edit-address')?.addEventListener('click', openBizModal);

    document.getElementById('form-edit-business')?.addEventListener('submit', (e) => {
      e.preventDefault();
      appState.business.name = document.getElementById('input-biz-name').value.trim() || 'Your Business Name';
      appState.business.phone = document.getElementById('input-biz-phone').value.trim();
      appState.business.address = document.getElementById('input-biz-address').value.trim();
      saveData();
      closeAllModals();
      renderSettingsScreen();
      showToast('Business details updated');
    });

    // PWA Install triggers
    const installBtnItem = document.getElementById('item-install-app');
    if (installBtnItem) installBtnItem.addEventListener('click', handleInstallAppClick);

    const installBannerBtn = document.getElementById('btn-install-pwa-banner');
    if (installBannerBtn) installBannerBtn.addEventListener('click', handleInstallAppClick);

    const triggerBrowserInstall = document.getElementById('btn-trigger-browser-install');
    if (triggerBrowserInstall) triggerBrowserInstall.addEventListener('click', handleInstallAppClick);

    const dismissBannerBtn = document.getElementById('btn-dismiss-pwa');
    if (dismissBannerBtn) {
      dismissBannerBtn.addEventListener('click', () => {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.classList.add('hidden');
      });
    }

    // Backup Data
    const backupBtn = document.getElementById('item-backup-data');
    if (backupBtn) {
      backupBtn.addEventListener('click', () => {
        const dateStr = new Date().toISOString().slice(0, 10);
        const exportDataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", exportDataStr);
        downloadAnchor.setAttribute("download", `digital_khata_backup_${dateStr}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('Data backup downloaded');
      });
    }

    // Restore Data
    const restoreBtn = document.getElementById('item-restore-data');
    const restoreInput = document.getElementById('input-restore-file');
    if (restoreBtn && restoreInput) {
      restoreBtn.addEventListener('click', () => restoreInput.click());
      restoreInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleRestoreDataFile(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    // Clear All Data
    document.getElementById('item-clear-data')?.addEventListener('click', () => {
      document.getElementById('modal-clear-confirm')?.classList.remove('hidden');
    });

    document.getElementById('btn-cancel-clear')?.addEventListener('click', closeAllModals);

    document.getElementById('btn-confirm-clear')?.addEventListener('click', () => {
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
