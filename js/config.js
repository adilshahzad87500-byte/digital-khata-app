/* ==========================================
   DIGITAL KHATA - APPLICATION CONFIGURATION
   ========================================== */

const CONFIG = {
  APP_NAME: 'Digital Khata',
  APP_VERSION: '2.0.0',
  
  // Supabase Configuration (Will load from env or fallback to LocalStorage engine)
  SUPABASE_URL: window.ENV_SUPABASE_URL || 'https://your-supabase-id.supabase.co',
  SUPABASE_ANON_KEY: window.ENV_SUPABASE_ANON_KEY || 'your-anon-key',

  // LocalStorage Keys (Preserved for compatibility and offline caching)
  STORAGE_KEYS: {
    CURRENT_USER: 'digital_khata_user_session',
    USERS_DB: 'digital_khata_users_db',
    ONBOARDED: 'digital_khata_onboarded',
    BUSINESS: 'digital_khata_business',
    CUSTOMERS: 'digital_khata_customers',
    TRANSACTIONS: 'digital_khata_transactions',
    SHADOW_BACKUP: 'digital_khata_shadow_backup',
    THEME: 'digital_khata_theme',
    PROFILE: 'digital_khata_profile',
    SECURITY: 'digital_khata_security',
    OFFLINE_QUEUE: 'digital_khata_offline_queue'
  },

  // API Endpoints
  API: {
    SEND_OTP: '/api/send-otp',
    VERIFY_OTP: '/api/verify-otp',
    RESET_PASSWORD: '/api/reset-password'
  }
};

window.CONFIG = CONFIG;
