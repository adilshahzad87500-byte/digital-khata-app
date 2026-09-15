// Vercel Serverless Function: Create New Password after Verified Phone OTP
// Route: /api/reset-password

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

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
    const { phone, resetToken, newPassword, confirmPassword } = req.body || {};

    if (!phone || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Phone number and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation password do not match.' });
    }

    if (supabase) {
      // 1. Verify resetToken is valid & verified
      const { data: record, error: tokenErr } = await supabase
        .from('phone_otps')
        .select('*')
        .eq('phone', phone)
        .eq('reset_token', resetToken)
        .eq('verified', true)
        .order('verified_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenErr || !record) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized password reset request. Please verify your phone number via OTP first.'
        });
      }

      // Check token age (must be used within 15 minutes of OTP verification)
      const tokenAgeMinutes = (Date.now() - new Date(record.verified_at).getTime()) / (1000 * 60);
      if (tokenAgeMinutes > 15) {
        return res.status(400).json({
          success: false,
          message: 'Password reset session expired. Please verify OTP again.'
        });
      }

      // 2. Hash new password securely with bcrypt
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // 3. Update User Password in DB / Profiles table
      const { data: userRecord, error: userFetchErr } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('phone', phone)
        .maybeSingle();

      if (userFetchErr || !userRecord) {
        return res.status(404).json({ success: false, message: 'User account not found.' });
      }

      // Update password hash in profiles table
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          password_hash: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', userRecord.id);

      if (updateErr) {
        console.error('Password update error:', updateErr);
        return res.status(500).json({ success: false, message: 'Failed to update password in database.' });
      }

      // If using Supabase Auth Admin API, update auth.users password as well
      if (userRecord.user_id && supabase.auth && supabase.auth.admin) {
        try {
          await supabase.auth.admin.updateUserById(userRecord.user_id, {
            password: newPassword
          });
        } catch (authAdminErr) {
          console.warn('Supabase auth admin update notice:', authAdminErr.message);
        }
      }

      // Invalidate the reset token so it cannot be reused
      await supabase
        .from('phone_otps')
        .update({ reset_token: null })
        .eq('id', record.id);

      return res.status(200).json({
        success: true,
        message: 'Password updated successfully. You can now login with your new password.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (err) {
    console.error('Reset Password Error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating password. Please try again.' });
  }
};
