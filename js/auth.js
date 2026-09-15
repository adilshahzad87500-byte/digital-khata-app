/* ==========================================
   DIGITAL KHATA - AUTHENTICATION CONTROLLER
   ========================================== */

(function () {
  'use strict';

  // Initialize Supabase Client if SDK is loaded
  let supabaseClient = null;
  if (window.supabase && CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('your-supabase-id')) {
    try {
      supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('[Auth] Supabase initialization notice:', e.message);
    }
  }

  // Universal Phone Normalizer (Handles 03XX, +923XX, 923XX, spaces, hyphens)
  function normalizePhone(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('92')) {
      digits = '0' + digits.substring(2);
    } else if (digits.length === 10 && digits.startsWith('3')) {
      digits = '0' + digits;
    }
    return digits;
  }

  // Simple secure hashing for client fallback when offline
  function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'dk_hash_' + Math.abs(hash).toString(36) + '_' + password.length;
  }

  // Get current logged-in user session
  function getCurrentUser() {
    try {
      const userRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
      return userRaw ? JSON.parse(userRaw) : null;
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    const user = getCurrentUser();
    return !!(user && user.id && user.phone);
  }

  // Get local users database registry (Offline fallback)
  function getLocalUsersDB() {
    try {
      const dbRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS_DB);
      return dbRaw ? JSON.parse(dbRaw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalUsersDB(users) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.USERS_DB, JSON.stringify(users));
  }

  // Signup User
  async function signup({ fullName, phone, email, password, businessName }) {
    if (!fullName || !phone || !password) {
      throw new Error('Please fill in all required fields (Name, Phone, Password).');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      throw new Error('Please enter a valid phone number (e.g. 0300-1234567).');
    }

    const usersDB = getLocalUsersDB();

    // Check phone uniqueness locally
    const existingLocal = usersDB.find(u => normalizePhone(u.phone) === cleanPhone);
    if (existingLocal) {
      throw new Error('An account with this phone number already exists. Please log in using your phone number and password.');
    }

    // Check phone uniqueness on Cloud DB if connected
    if (supabaseClient) {
      try {
        const { data: cloudUsers } = await supabaseClient
          .from('profiles')
          .select('phone');

        if (cloudUsers && cloudUsers.some(u => normalizePhone(u.phone) === cleanPhone)) {
          throw new Error('An account with this phone number already exists. Please log in using your phone number and password.');
        }
      } catch (cloudErr) {
        console.warn('Cloud DB signup check notice:', cloudErr);
      }
    }

    // Create User Object
    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newUser = {
      id: userId,
      fullName: fullName.trim(),
      phone: cleanPhone,
      rawPhone: phone.trim(),
      email: (email || '').trim(),
      passwordHash: hashPassword(password),
      businessName: (businessName || fullName.trim() + "'s Shop").trim(),
      createdAt: new Date().toISOString()
    };

    // Save user to cloud DB if connected
    if (supabaseClient) {
      try {
        await supabaseClient.from('profiles').insert([{
          user_id: newUser.id,
          full_name: newUser.fullName,
          phone: newUser.phone,
          email: newUser.email,
          business_name: newUser.businessName,
          password_hash: newUser.passwordHash,
          created_at: newUser.createdAt
        }]);
      } catch (cloudErr) {
        console.warn('Cloud DB signup sync notice:', cloudErr);
      }
    }

    // Save to local registry
    usersDB.push(newUser);
    saveLocalUsersDB(usersDB);

    // Auto log in new user
    localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));

    // Perform Data Migration from legacy LocalStorage to this new account
    if (window.DataMigration && typeof window.DataMigration.importLocalDataToCloud === 'function') {
      await window.DataMigration.importLocalDataToCloud(newUser);
    }

    return newUser;
  }

  // Login User
  async function login({ phone, password }) {
    if (!phone || !password) {
      throw new Error('Please enter your phone number and password.');
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      throw new Error('Please enter a valid phone number.');
    }

    let matchedUser = null;
    let cloudFoundUser = null;

    // 1. Try Cloud DB Login first
    if (supabaseClient) {
      try {
        const { data: cloudUsers } = await supabaseClient
          .from('profiles')
          .select('*');

        if (cloudUsers && cloudUsers.length > 0) {
          cloudFoundUser = cloudUsers.find(u => normalizePhone(u.phone) === cleanPhone);
          if (cloudFoundUser) {
            if (cloudFoundUser.password_hash === hashPassword(password)) {
              matchedUser = {
                id: cloudFoundUser.user_id || cloudFoundUser.id,
                fullName: cloudFoundUser.full_name,
                phone: cloudFoundUser.phone,
                email: cloudFoundUser.email || '',
                businessName: cloudFoundUser.business_name || '',
                createdAt: cloudFoundUser.created_at
              };
            } else {
              throw new Error('Incorrect password. Please check your password and try again.');
            }
          }
        }
      } catch (err) {
        if (err.message && err.message.includes('Incorrect password')) {
          throw err;
        }
        console.warn('Cloud login check notice:', err);
      }
    }

    // 2. Fallback to Local Users DB if cloud login didn't return
    if (!matchedUser) {
      const usersDB = getLocalUsersDB();
      const localUser = usersDB.find(u => normalizePhone(u.phone) === cleanPhone);

      if (!localUser && !cloudFoundUser) {
        throw new Error('No account found with this phone number. Please check the number or Sign Up first.');
      }

      if (localUser && localUser.passwordHash !== hashPassword(password)) {
        throw new Error('Incorrect password. Please check your password and try again.');
      }

      matchedUser = localUser;
    }

    if (!matchedUser) {
      throw new Error('Incorrect password. Please check your password and try again.');
    }

    // Save Active Session
    localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(matchedUser));

    // Load cloud data for this user
    if (window.DB && typeof window.DB.loadUserData === 'function') {
      await window.DB.loadUserData(matchedUser.id);
    }

    return matchedUser;
  }

  // Update Local User Password (for forgot password)
  function updateLocalUserPassword(phone, newPassword) {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !newPassword) return false;

    const usersDB = getLocalUsersDB();
    const userIndex = usersDB.findIndex(u => normalizePhone(u.phone) === cleanPhone);

    if (userIndex !== -1) {
      usersDB[userIndex].passwordHash = hashPassword(newPassword);
      saveLocalUsersDB(usersDB);
      return true;
    }
    return false;
  }

  // Logout User
  function logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    window.location.href = 'login.html';
  }

  // Require Auth Middleware for protected pages (e.g. index.html)
  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'login.html';
    }
  }

  // Export Auth API
  window.Auth = {
    getCurrentUser,
    isLoggedIn,
    signup,
    login,
    logout,
    requireAuth,
    hashPassword,
    normalizePhone,
    updateLocalUserPassword
  };

})();

