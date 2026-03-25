import React, { useState, useEffect } from 'react';
import api from '../api';
import { socket } from '../socket';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Image, Moon, Sun, ShieldCheck, Trash2, LogOut, Info, CheckCircle, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import './DriverDashboard.css';

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []);
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertTriangle : Info;
  return (
    <div className={`toast ${type}`}>
      <Icon size={18} /> {message}
    </div>
  );
}

export default function Setting() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch (e) { return null }
  });
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarData, setAvatarData] = useState(user?.avatar || '');
  const [twofa, setTwofa] = useState(user?.twofa_enabled || false);
  const [esewaLinked, setEsewaLinked] = useState(localStorage.getItem(`esewa_${user?.email}`) === 'true');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [passForm, setPassForm] = useState({ current: '', new: '', confirm: '' });
  const [changingPass, setChangingPass] = useState(false);
  const navigate = useNavigate();

  const toastIdRef = React.useRef(0);
  const addToast = (message, type = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    // best-effort fetch to get current true 2fa state
    api.post('/api/user/2fa', { enable: twofa }, { headers: { 'x-auth-token': token } })
       .then((res) => setTwofa(res.data.twofa))
       .catch(() => {});
  }, []);

  function setDocumentTheme(t) {
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', t);
    setTheme(t);
  }

  function onFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarData(reader.result);
    reader.readAsDataURL(f);
  }

  async function saveProfile() {
    const token = localStorage.getItem('token');
    if (!token) return addToast('Please login', 'error');
    setSaving(true);
    try {
      const body = { name, phone, avatar: avatarData };
      await api.post('/api/user/update', body, { headers: { 'x-auth-token': token } });
      const updated = { ...(user || {}), name, phone, avatar: avatarData };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      addToast('Profile updated successfully!', 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to update profile', 'error');
    }
    setSaving(false);
  }

  async function toggle2fa() {
    const token = localStorage.getItem('token');
    if (!token) return addToast('Login required', 'error');
    try {
      const res = await api.post('/api/user/2fa', { enable: !twofa }, { headers: { 'x-auth-token': token } });
      setTwofa(res.data.twofa);
      const updated = { ...(user || {}), twofa_enabled: res.data.twofa };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      addToast(`Two-factor auth ${res.data.twofa ? 'enabled' : 'disabled'}`, 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to update 2FA', 'error');
    }
  }

  function toggleEsewa() {
    const newVal = !esewaLinked;
    setEsewaLinked(newVal);
    localStorage.setItem(`esewa_${user?.email}`, newVal ? 'true' : 'false');
    addToast(newVal ? 'eSewa account linked securely!' : 'eSewa account unlinked', 'success');
  }

  async function deleteAccount() {
    if (!confirm('Delete your account? This is irreversible and all your data will be permanently wiped.')) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await api.delete('/api/user', { headers: { 'x-auth-token': token } });
      localStorage.clear();
      try { socket.disconnect(); } catch (e) {}
      navigate('/');
    } catch (e) {
      console.error(e);
      addToast('Failed to delete account', 'error');
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try { socket.disconnect(); } catch (e) {}
    navigate('/login');
  }

  async function changePassword() {
    if (!passForm.current || !passForm.new || !passForm.confirm) return addToast('Please fill all password fields', 'error');
    if (passForm.new !== passForm.confirm) return addToast('New passwords do not match', 'error');
    if (passForm.new.length < 6) return addToast('Password must be at least 6 characters', 'error');

    const token = localStorage.getItem('token');
    setChangingPass(true);
    try {
      await api.post('/api/user/change-password', {
        currentPassword: passForm.current,
        newPassword: passForm.new
      }, { headers: { 'x-auth-token': token } });
      addToast('Password changed successfully!', 'success');
      setPassForm({ current: '', new: '', confirm: '' });
      setShowPassword(false);
    } catch (e) {
      addToast(e.response?.data || 'Failed to change password', 'error');
    }
    setChangingPass(false);
  }

  return (
    <div className="driver-dash" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="dash-header" style={{ marginBottom: 30 }}>
        <div className="dash-greeting">
          <div className="dash-info">
            <h1>Account Settings</h1>
            <div className="dash-subtitle">Manage your profile, appearance, and security preferences</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Profile Details */}
        <div className="glass-card">
          <h2 className="glass-card-title"><User size={18} /> Profile Details</h2>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div style={{ 
                width: 100, height: 100, borderRadius: 16, background: 'var(--card-border)',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {avatarData ? (
                  <img src={avatarData} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={40} color="var(--text-muted)" />
                )}
              </div>
              <label style={{ 
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: 'var(--blue)',
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6,
                background: 'var(--blue-soft)'
              }}>
                <Image size={14} /> Change Photo
                <input type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
              </label>
            </div>
            
            <div style={{ flex: 1, minWidth: 250, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your name"
                    style={{ 
                      width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8,
                      border: '1px solid var(--card-border)', background: '#fff',
                      fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                    style={{ 
                      width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8,
                      border: '1px solid var(--card-border)', background: '#fff',
                      fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
                <button 
                  onClick={saveProfile} 
                  disabled={saving}
                  style={{
                    padding: '10px 20px', background: 'var(--blue)', color: '#fff', border: 'none',
                    borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    opacity: saving ? 0.7 : 1, transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  onClick={logout}
                  style={{
                    padding: '10px 20px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--card-border)',
                    borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s'
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                  onMouseOut={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security / Appearance Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          
          <div className="glass-card">
            <h2 className="glass-card-title"><Sun size={18} /> Appearance</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Customize how AmbuTrack looks on your device.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setDocumentTheme('light')}
                style={{
                  flex: 1, padding: '12px', border: `2px solid ${theme !== 'dark' ? 'var(--blue)' : 'var(--card-border)'}`,
                  background: theme !== 'dark' ? 'var(--blue-soft)' : '#fff', color: theme !== 'dark' ? 'var(--blue)' : 'var(--text-secondary)',
                  borderRadius: 10, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.2s'
                }}
              >
                <Sun size={24} /> Light Mode
              </button>
              <button 
                onClick={() => setDocumentTheme('dark')}
                style={{
                  flex: 1, padding: '12px', border: `2px solid ${theme === 'dark' ? 'var(--blue)' : 'var(--card-border)'}`,
                  background: theme === 'dark' ? 'var(--blue-soft)' : '#fff', color: theme === 'dark' ? 'var(--blue)' : 'var(--text-secondary)',
                  borderRadius: 10, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.2s'
                }}
              >
                <Moon size={24} /> Dark Mode
              </button>
            </div>
          </div>

          <div className="glass-card">
            <h2 className="glass-card-title"><ShieldCheck size={18} /> Security</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Enhance your account security with two-factor authentication.
            </p>
            <div style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              padding: '16px', background: 'var(--dash-bg)', borderRadius: 10, border: '1px solid var(--card-border)'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Two-Factor Auth</div>
                <div style={{ fontSize: '0.75rem', color: twofa ? 'var(--green)' : 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                  Status: {twofa ? 'Enabled' : 'Disabled'}
                </div>
              </div>
              <button 
                onClick={toggle2fa}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                  background: twofa ? 'var(--card-border)' : 'var(--green)', color: twofa ? 'var(--text-secondary)' : '#fff',
                  transition: 'all 0.2s'
                }}
              >
                {twofa ? 'Disable' : 'Enable 2FA'}
              </button>
            </div>
          </div>

          <div className="glass-card">
            <h2 className="glass-card-title" style={{ display: 'flex', alignItems: 'center' }}>
              <img src="https://esewa.com.np/common/images/esewa_logo.png" alt="eSewa" style={{ height: 16, objectFit: 'contain', marginRight: 8, filter: 'grayscale(100%) opacity(0.6)' }} /> 
              Linked Accounts
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Connect your eSewa wallet for seamless one-click payments.
            </p>
            <div style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              padding: '16px', background: 'var(--dash-bg)', borderRadius: 10, border: '1px solid var(--card-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <img src="https://esewa.com.np/common/images/esewa_logo.png" alt="eSewa" style={{ height: 16 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>eSewa Wallet</div>
                  <div style={{ fontSize: '0.75rem', color: esewaLinked ? 'var(--green)' : 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                    Status: {esewaLinked ? 'Connected' : 'Not Linked'}
                  </div>
                </div>
              </div>
              <button 
                onClick={toggleEsewa}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                  background: esewaLinked ? 'var(--card-border)' : '#60bb46', color: esewaLinked ? 'var(--text-secondary)' : '#fff',
                  transition: 'all 0.2s'
                }}
              >
                {esewaLinked ? 'Unlink' : 'Link Account'}
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h2 className="glass-card-title"><Lock size={18} /> Change Password</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Keep your account secure by updating your password regularly.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input 
                type={showPassword ? "text" : "password"}
                value={passForm.current}
                onChange={e => setPassForm({...passForm, current: e.target.value})}
                placeholder="Current Password"
                style={passwordInputStyle}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input 
                type={showPassword ? "text" : "password"}
                value={passForm.new}
                onChange={e => setPassForm({...passForm, new: e.target.value})}
                placeholder="New Password"
                style={passwordInputStyle}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input 
                type={showPassword ? "text" : "password"}
                value={passForm.confirm}
                onChange={e => setPassForm({...passForm, confirm: e.target.value})}
                placeholder="Confirm New Password"
                style={passwordInputStyle}
              />
              <button 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button 
              onClick={changePassword}
              disabled={changingPass}
              style={{
                padding: '10px', background: 'var(--blue)', color: '#fff', border: 'none',
                borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                opacity: changingPass ? 0.7 : 1, transition: 'all 0.2s', marginTop: 4
              }}
            >
              {changingPass ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="glass-card" style={{ borderColor: 'var(--accent-soft)', background: 'var(--accent-soft)' }}>
          <h2 className="glass-card-title" style={{ color: 'var(--accent)' }}><Trash2 size={18} /> Danger Zone</h2>
          <p style={{ fontSize: '0.85rem', color: '#b91c1c', marginBottom: 16 }}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button 
            onClick={deleteAccount}
            style={{
              padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--accent)'}
          >
            <Trash2 size={16} /> Delete Account
          </button>
        </div>

      </div>

      {toasts.map((t) => <Toast key={t.id} message={t.message} type={t.type} onDone={() => removeToast(t.id)} />)}
    </div>
  );
}

const passwordInputStyle = {
  width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8,
  border: '1px solid var(--card-border)', background: '#fff',
  fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none'
};
