import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorStr, setErrorStr] = useState('');
  const [msg, setMsg] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return setErrorStr('Please enter your email.');
    setLoading(true);
    setErrorStr('');
    setMsg('');
    try {
      const res = await api.post('/api/auth/forgot-password', { email });
      setMsg(res.data.message || 'OTP sent to your email.');
      setStep(2);
    } catch (err) {
      setErrorStr(err.response?.data?.error || err.response?.data || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword) return setErrorStr('Please enter OTP and new password.');
    setLoading(true);
    setErrorStr('');
    try {
      const res = await api.post('/api/auth/reset-password', { email, otp, newPassword });
      setMsg(res.data.message || 'Password reset successful!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setErrorStr(err.response?.data?.error || err.response?.data || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: '#f8fafc',
      alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: '#ffffff', width: '100%', maxWidth: 420, borderRadius: 16,
        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', overflow: 'hidden', border: '1px solid #e2e8f0'
      }}>
        <div style={{ padding: '32px 32px 24px', textAlign: 'center' }}>
          <div style={{ 
            width: 48, height: 48, background: '#e0f2fe', color: '#0ea5e9', borderRadius: 14, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' 
          }}>
            <ShieldCheck size={24} strokeWidth={2.5} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: 800 }}>
            Reset Password
          </h2>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            {step === 1 ? "Enter your email to receive a reset code." : "Enter the code and your new password."}
          </p>
        </div>

        {errorStr && (
          <div style={{ margin: '0 32px 16px', padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} /> {errorStr}
          </div>
        )}
        {msg && (
          <div style={{ margin: '0 32px 16px', padding: '10px 14px', background: '#f0fdf4', color: '#15803d', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500, border: '1px solid #bbf7d0' }}>
            {msg}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} style={{ padding: '0 32px 32px' }}>
            <div style={{ marginBottom: 24 }}>
               <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>Email Address</label>
               <div style={{ position: 'relative' }}>
                 <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 12 }} />
                 <input
                   type="email"
                   value={email}
                   onChange={e => setEmail(e.target.value)}
                   placeholder="you@example.com"
                   style={{
                     width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10,
                     border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.9rem',
                     outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                   }}
                 />
               </div>
            </div>
            <button 
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '12px', background: '#0ea5e9', color: '#fff', border: 'none',
                borderRadius: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Sending...' : <>Get Reset Code <ArrowRight size={16}/></>}
            </button>
            <Link to="/login" style={{ display: 'block', textAlign: 'center', marginTop: 16, color: '#64748b', fontSize: '0.85rem', textDecoration: 'none' }}>Back to Login</Link>
          </form>
        ) : (
          <form onSubmit={handleReset} style={{ padding: '0 32px 32px' }}>
            <div style={{ marginBottom: 16 }}>
               <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>Reset Code</label>
               <input
                 type="text"
                 value={otp}
                 onChange={e => setOtp(e.target.value.toUpperCase())}
                 placeholder="6-digit code"
                 style={{
                   width: '100%', padding: '10px 14px', borderRadius: 10, letterSpacing: 2, textAlign: 'center',
                   border: '1px solid #cbd5e1', background: '#fff', fontSize: '1rem', fontWeight: 600,
                   outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                 }}
               />
            </div>
            <div style={{ marginBottom: 24 }}>
               <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>New Password</label>
               <div style={{ position: 'relative' }}>
                 <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 12 }} />
                 <input
                   type="password"
                   value={newPassword}
                   onChange={e => setNewPassword(e.target.value)}
                   placeholder="••••••••"
                   style={{
                     width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10,
                     border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.9rem',
                     outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                   }}
                 />
               </div>
            </div>
            <button 
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '12px', background: '#10b981', color: '#fff', border: 'none',
                borderRadius: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Resetting...' : <>Reset Password <ArrowRight size={16}/></>}
            </button>
            <button type="button" onClick={() => setStep(1)} style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}>Change Email</button>
          </form>
        )}
      </div>
    </div>
  );
}
