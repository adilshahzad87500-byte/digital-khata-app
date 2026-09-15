// Vercel Serverless Function: Verify 6-Digit SMS OTP
// Route: /api/verify-otp

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    const { phone, otp } = req.body || {};

    if (!phone || !otp || otp.toString().trim().length !== 6) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit verification code.' });
    }

    const cleanOtp = otp.toString().trim();

    if (supabase) {
      // Find latest OTP for this phone
      const { data: record, error } = await supabase
        .from('phone_otps')
        .select('*')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !record) {
        return res.status(400).json({ success: false, message: 'No active OTP request found for this phone number.' });
      }

      // 1. Check maximum attempts (limit 5 attempts)
      if (record.attempts >= 5) {
        return res.status(429).json({
          success: false,
          message: 'Too many failed OTP attempts. Please request a new verification code.'
        });
      }

      // 2. Check Expiration (5 min)
      if (new Date() > new Date(record.expires_at)) {
        return res.status(400).json({
          success: false,
          message: 'Verification code has expired. Please request a new one.'
        });
      }

      // 3. Verify OTP code match
      if (record.otp_code !== cleanOtp) {
        // Increment attempt count
        await supabase
          .from('phone_otps')
          .update({ attempts: record.attempts + 1 })
          .eq('id', record.id);

        const remainingAttempts = 4 - record.attempts;
        return res.status(400).json({
          success: false,
          message: `Incorrect verification code. ${remainingAttempts > 0 ? remainingAttempts + ' attempts remaining.' : 'Please request a new code.'}`
        });
      }

      // Generate single-use reset token
      const resetToken = crypto.randomBytes(24).toString('hex');

      // Update record as verified and store reset_token
      await supabase
        .from('phone_otps')
        .update({
          verified: true,
          reset_token: resetToken,
          verified_at: new Date().toISOString()
        })
        .eq('id', record.id);

      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully. You may now create a new password.',
        resetToken: resetToken
      });
    }

    // Fallback if DB is not configured (Local testing fallback)
    const mockResetToken = crypto.randomBytes(24).toString('hex');
    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      resetToken: mockResetToken
    });

  } catch (err) {
    console.error('Verify OTP Error:', err);
    return res.status(500).json({ success: false, message: 'Server error verifying OTP. Please try again.' });
  }
};
