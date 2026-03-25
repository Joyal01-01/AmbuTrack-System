import { useState } from "react";
import { socket } from "../socket";
import api from "../api";
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Activity, ShieldCheck, Smartphone } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorStr, setErrorStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [tempEmail, setTempEmail] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setErrorStr("");
    if (!email || !password) return setErrorStr('Please enter both email and password.');
    setLoading(true);
    try {
      const res = await api.post("/api/login", { email, password });
      
      if (res.data.twofa) {
        setTempEmail(email);
        setShowOtp(true);
        setLoading(false);
        return;
      }

      const user = res.data;
      if (!user || !user.token) {
        setErrorStr('Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }
      completeLogin(user);
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.response?.data || "Login failed. Please check your credentials.";
      setErrorStr(typeof errorMessage === 'string' ? errorMessage : "Login failed. Please check your credentials.");
      setLoading(false); 
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setErrorStr("");
    if (!otp) return setErrorStr('Please enter the OTP sent to your email.');
    setLoading(true);
    try {
      const res = await api.post("/api/login-verify", { email: tempEmail, otp });
      const user = res.data;
      if (!user || !user.token) {
        setErrorStr('Verification failed. Invalid OTP.');
        setLoading(false);
        return;
      }
      completeLogin(user);
    } catch (err) {
      setErrorStr(err.response?.data || 'Verification failed.');
      setLoading(false);
    }
  }

  function completeLogin(user) {
    // Check driver approval status
    if (user.role === 'driver') {
      if (user.approval_status === 'pending') {
        setErrorStr('Your driver application is still pending admin approval.');
        setLoading(false);
        return;
      }
      if (user.approval_status === 'rejected') {
        setErrorStr('Your driver application was rejected by an administrator.');
        setLoading(false);
        return;
      }
    }

    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", user.token);
    localStorage.setItem("userId", String(user.id));

    socket.emit("identify", { token: user.token });
    window.location.href = '/dashboard'; 
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: 'var(--dash-bg, #f8fafc)',
      alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: '#ffffff', width: '100%', maxWidth: 420, borderRadius: 16,
        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', overflow: 'hidden', border: '1px solid #e2e8f0'
      }}>
        
        {/* Header Section */}
        <div style={{ padding: '32px 32px 24px', textAlign: 'center' }}>
          <div style={{ 
            width: 48, height: 48, background: showOtp ? '#ecfdf5' : '#fee2e2', color: showOtp ? '#10b981' : '#ef4444', borderRadius: 14, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' 
          }}>
            {showOtp ? <ShieldCheck size={24} strokeWidth={2.5} /> : <Activity size={24} strokeWidth={2.5} />}
          </div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: 800 }}>
            {showOtp ? 'Two-Step Verification' : 'Welcome Back'}
          </h2>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            {showOtp ? `We've sent a 6-digit code to ${tempEmail}` : 'Enter your credentials to access AmbuTrack'}
          </p>
        </div>

        {/* Error Message */}
        {errorStr && (
          <div style={{ margin: '0 32px 16px', padding: '10px 14px', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500, border: '1px solid #fecaca' }}>
            {errorStr}
          </div>
        )}

        {/* Form Section */}
        {!showOtp ? (
          <form onSubmit={handleLogin} style={{ padding: '0 32px 32px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 12 }} />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10,
                    border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.9rem',
                    color: '#0f172a', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => { e.target.style.borderColor = '#ef4444'; e.target.style.boxShadow = '0 0 0 3px #fee2e2'; }}
                  onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ef4444', textDecoration: 'none' }}>Forgot password?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 12 }} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10,
                    border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.9rem',
                    color: '#0f172a', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => { e.target.style.borderColor = '#ef4444'; e.target.style.boxShadow = '0 0 0 3px #fee2e2'; }}
                  onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%', padding: '12px', background: '#ef4444', color: '#fff', border: 'none',
                borderRadius: 10, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.7 : 1, transition: 'background 0.2s, transform 0.1s',
                boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)'
              }}
            >
              {loading ? 'Signing in...' : (
                <>Sign in to Dashboard <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ padding: '0 32px 32px' }}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>One-Time Code</label>
              <div style={{ position: 'relative' }}>
                <Smartphone size={16} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 12 }} />
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10,
                    border: '1px solid #cbd5e1', background: '#fff', fontSize: '1.1rem',
                    textAlign: 'center', letterSpacing: '4px', fontWeight: 700,
                    color: '#0f172a', outline: 'none', transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 3px #d1fae5'; }}
                  onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%', padding: '12px', background: '#10b981', color: '#fff', border: 'none',
                borderRadius: 10, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.7 : 1, transition: 'background 0.2s, transform 0.1s',
                boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
              }}
            >
              {loading ? 'Verifying...' : (
                <>Verify Account <ArrowRight size={16} /></>
              )}
            </button>
            <button
               type="button"
               onClick={() => setShowOtp(false)}
               style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
            >
               Back to Login
            </button>
          </form>
        )}

        {/* Footer Section */}
        <div style={{ padding: '20px 32px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Don't have an account? </span>
          <Link to="/register" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444', textDecoration: 'none' }}>
            Create one now
          </Link>
        </div>

      </div>
    </div>
  );
}