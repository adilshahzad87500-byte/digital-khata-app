// Vercel Serverless Function: Send 6-Digit SMS OTP for Forgot Password
// Route: /api/send-otp

const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

// Initialize Supabase admin client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Initialize Twilio client if keys are present
const twilioSid = process.env.TWILIO_ACCOUNT_SID || '';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '';
const twilioClient = twilioSid && twilioAuthToken ? twilio(twilioSid, twilioAuthToken) : null;

// Helper: Normalize Phone Number to international format
function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('03')) {
    cleaned = '+92' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

module.exports = async function handler(req, res) {
  // CORS & Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number.' });
    }

    const normalizedPhone = normalizePhone(phone);

    // 1. Check user existence in database if Supabase is connected
    if (supabase) {
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, phone')
        .eq('phone', phone)
        .maybeSingle();

      if (userError) {
        console.error('Database query error:', userError);
      }

      if (!user) {
        // Also check with normalized phone
        const { data: userNorm } = await supabase
          .from('profiles')
          .select('id, phone')
          .eq('phone', normalizedPhone)
          .maybeSingle();

        if (!userNorm) {
          return res.status(404).json({
            success: false,
            message: 'Phone number is not registered. Please check the number or sign up for a new account.'
          });
        }
      }
    }

    // 2. Generate 6-Digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

    // 3. Rate limiting check & save OTP record in DB
    if (supabase) {
      // Check last sent OTP timestamp for cooldown (60 seconds)
      const { data: recentOtp } = await supabase
        .from('phone_otps')
        .select('created_at')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentOtp && recentOtp.created_at) {
        const timeDiffSec = (Date.now() - new Date(recentOtp.created_at).getTime()) / 1000;
        if (timeDiffSec < 60) {
          const remainingSec = Math.ceil(60 - timeDiffSec);
          return res.status(429).json({
            success: false,
            message: `Please wait ${remainingSec} seconds before requesting a new OTP.`
          });
        }
      }

      // Upsert/Insert OTP into DB
      const { error: otpDbErr } = await supabase
        .from('phone_otps')
        .insert({
          phone: phone,
          otp_code: otpCode,
          expires_at: expiresAt,
          attempts: 0,
          verified: false,
          created_at: new Date().toISOString()
        });

      if (otpDbErr) {
        console.error('Failed to store OTP in DB:', otpDbErr);
      }
    }

    // 4. Send Real SMS via Twilio if configured
    let smsSent = false;
    if (twilioClient && twilioPhone) {
      try {
        await twilioClient.messages.create({
          body: `[Digital Khata] Your password reset verification code is: ${otpCode}. Valid for 5 minutes. Do NOT share this code with anyone.`,
          from: twilioPhone,
          to: normalizedPhone
        });
        smsSent = true;
      } catch (smsErr) {
        console.error('Twilio SMS sending error:', smsErr);
      }
    }

    // Return success response to frontend
    return res.status(200).json({
      success: true,
      message: smsSent
        ? 'Verification code sent to your phone via SMS.'
        : 'Verification code generated successfully. Please enter the 6-digit code.',
      expiresInSeconds: 300,
      cooldownSeconds: 60,
      // Note: If DEMO_OTP_MODE is true or Twilio is unconfigured, return code for testing
      demoCode: (process.env.DEMO_OTP_MODE === 'true' || !smsSent) ? otpCode : undefined
    });

  } catch (err) {
    console.error('Send OTP Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error generating OTP. Please try again.'
    });
  }
};
