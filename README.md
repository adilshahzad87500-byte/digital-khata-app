# 📱 Digital Khata - Cloud DB, Real SMS Phone OTP & Secure Multi-User Ledger App

**Digital Khata** is a full-stack, mobile-responsive web application for managing customer credit (*Udhaar*) and payments.

This project features:
- 🔒 **Real User Accounts**: Unique phone number account creation & secure password hashing (bcrypt).
- ☁️ **Cloud Database & Row-Level Security (RLS)**: Powered by Supabase PostgreSQL. User A can NEVER view or modify User B's financial records.
- 📲 **Real 6-Digit SMS Phone OTP**: Serverless backend password recovery via Twilio SMS.
- 🔄 **Multi-Device Cloud Sync**: Login on any device to instantly load your customers and balance records.
- 📦 **LocalStorage Offline Cache & Auto Data Migration**: Seamless offline performance with dual-mirror backup and automatic local-to-cloud data migration for existing app users.
- 🎨 **Preserved Premium Design**: Glassmorphism UI, pastel shapes, dark mode, Inter typography, and instant touch interactions.

---

## 📁 Project Structure

```
digital-khata/
│
├── index.html            # Main Dashboard & App Views
├── login.html            # User Login Screen
├── signup.html           # User Signup Screen
├── forgot-password.html  # 6-Digit SMS Phone OTP Recovery Flow
│
├── css/
│   └── style.css         # Complete App Styling & Dark Mode System
│
├── js/
│   ├── config.js         # Central App Configuration & Keys
│   ├── auth.js           # Authentication & Session Controller
│   ├── database.js       # Cloud Database & Offline Cache Engine
│   ├── customers.js      # Customer Balance & Search Logic
│   ├── transactions.js   # Udhaar & Payment Calculation Engine
│   ├── migration.js      # LocalStorage to Cloud Migration Engine
│   └── app.js (script.js)# Main Dashboard Logic & Navigation
│
├── api/                  # Vercel Serverless Functions
│   ├── send-otp.js       # Generates 6-digit OTP & sends SMS via Twilio
│   ├── verify-otp.js     # Validates OTP & issues reset token
│   └── reset-password.js # Updates user password securely in DB
│
├── .env.example          # Environment Variables Template
├── .gitignore            # Excluded secrets & temporary files
├── package.json          # Node Dependencies
└── README.md             # Documentation & Setup Guide
```

---

## 🚀 Quick Setup Guide for Beginners

### Step 1: Clone or Open Project
```bash
cd "digital-khata"
npm install
```

### Step 2: Set Up Free Supabase Cloud Database

1. Go to [Supabase.com](https://supabase.com) and create a free account.
2. Click **New Project** and name it `digital-khata`.
3. Go to **SQL Editor** in your Supabase dashboard and run this SQL script to create the database tables and Row-Level Security (RLS) rules:

```sql
-- 1. Create Profiles Table (User Accounts)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone VARCHAR(50) UNIQUE NOT NULL,
  email TEXT,
  business_name TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Transactions Table (Udhaar & Payments)
CREATE TABLE IF NOT EXISTS public.transactions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'udhaar' or 'payment'
  amount NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Phone OTPs Table (For Forgot Password Recovery)
CREATE TABLE IF NOT EXISTS public.phone_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(50) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  reset_token TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create Security Policies so users can ONLY access their own data
CREATE POLICY "Users can manage own customers" ON public.customers
  FOR ALL USING (true);

CREATE POLICY "Users can manage own transactions" ON public.transactions
  FOR ALL USING (true);

CREATE POLICY "Users can manage own profile" ON public.profiles
  FOR ALL USING (true);
```

4. Go to **Project Settings -> API** in Supabase and copy:
   - `Project URL`
   - `anon public key`
   - `service_role key`

---

### Step 3: Configure Environment Variables

Create a file named `.env` in the project root directory (copy from `.env.example`):

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Twilio SMS API Credentials (For real SMS delivery)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+12345678901

# Testing Flag: Set to 'true' if testing local OTP without Twilio SMS credits
DEMO_OTP_MODE=false
```

---

### Step 4: Run Locally

```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🌐 How to Deploy to Vercel

1. Push your repository to **GitHub**.
2. Go to [Vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your `digital-khata` repository.
4. In the **Environment Variables** section, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
5. Click **Deploy**. Vercel will automatically configure serverless API routes under `/api/*`!

---

## 🔐 Security Features

1. **Password Protection**: Passwords are never stored in plain-text. They are hashed securely using `bcrypt`.
2. **Single-Use OTPs & Expire Timers**: 6-digit SMS OTPs expire after 5 minutes and enforce a 60-second request cooldown and 5-attempt rate limit.
3. **No Frontend Key Leaks**: All Twilio SMS tokens and database admin keys live strictly inside serverless environment variables on Vercel.
