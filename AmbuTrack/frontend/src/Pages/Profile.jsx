import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import api from "../api";
import "./Profile.css";
import { User, Mail, Shield, ShieldCheck, Phone, MapPin, Edit3, Save, CheckCircle, AlertTriangle, Info, Lock, Camera } from "lucide-react";

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertTriangle : Info;
  return (
    <div className={`toast ${type}`} style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: 'var(--card-bg)', borderLeft: `4px solid ${type === 'success' ? '#10b981' : '#ef4444'}`,
      padding: '12px 20px', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text)', animation: 'slideUp 0.3s ease-out'
    }}>
      <Icon size={18} color={type === 'success' ? '#10b981' : '#ef4444'} />
      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{message}</span>
    </div>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const [user] = useState(() => { try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null } });
  const [twofa, setTwofa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const addToast = (message, type = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));


  useEffect(() => {
    // Fetch latest user data including 2FA status
    const fetchUserData = async () => {
      try {
        const res = await api.get('/api/user/profile');
        if (res.data) {
          setTwofa(!!res.data.twofa_enabled);
        }
      } catch (err) {
        console.error("Failed to fetch user profile", err);
      }
    };
    if (user?.id) fetchUserData();
  }, [user?.id]);

  const handleToggle2FA = async () => {
    setLoading(true);
    try {
      const res = await api.post("/api/user/2fa", { enable: !twofa });
      setTwofa(res.data.twofa);
      addToast(`2-Step Authentication has been ${res.data.twofa ? "Enabled" : "Disabled"}.`, "success");
    } catch {
      addToast("Failed to toggle 2FA", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("profile_picture", file);
    setLoading(true);

    try {
      const res = await api.post("/api/user/profile-picture", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data.ok) {
        const updatedUser = { ...user, profile_picture: res.data.profile_picture };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        window.location.reload(); // Refresh to update all dashboard headers
      }
    } catch {
      addToast("Failed to upload profile picture", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container" style={{ minHeight: '100vh', background: 'var(--background)', padding: '2rem var(--container-padding)' }}>
      {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onDone={() => removeToast(t.id)} />)}
      <div className="profile-card" style={{ maxWidth: 780, margin: '0 auto' }}>
        <div className="profile-header">
          <div 
            className="profile-avatar-wrapper" 
            onClick={() => document.getElementById('profile-file-input').click()}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            {user?.profile_picture ? (
              <img 
                src={`${api.defaults.baseURL || ''}${user.profile_picture}`} 
                alt="Profile" 
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
              />
            ) : (
              user?.name?.charAt(0).toUpperCase() || <User size={40} />
            )}
            <div className="avatar-overlay">
              <Camera size={20} />
            </div>
          </div>
          <input 
            type="file" 
            id="profile-file-input" 
            style={{ display: 'none' }} 
            onChange={handleFileChange}
            accept="image/*"
          />
          <h2>{user?.name}</h2>
          <p>{user?.role?.toUpperCase()} {t('nav_dashboard')}</p>
        </div>

        <div className="profile-content">
          <div className="profile-section">
            <h3><User size={18} /> {t('prof_details')}</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>{t('prof_name')}</label>
                <span>{user?.name}</span>
              </div>
              <div className="info-item">
                <label>{t('reg_email')}</label>
                <span>{user?.email}</span>
              </div>
              <div className="info-item">
                <label>{t('tab_verif')}</label>
                <span style={{ color: user?.approval_status === 'approved' ? '#10b981' : '#f59e0b' }}>
                  {user?.approval_status?.toUpperCase() || 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h3><Shield size={18} /> {t('sec_title')}</h3>
            <div className="settings-card">
              <div className="settings-info">
                <h4>{t('sec_2fa')}</h4>
                <p>{t('sec_2fa_desc')}</p>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={twofa} 
                  onChange={handleToggle2FA} 
                  disabled={loading}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          <div className="profile-actions">
            <button className="btn-secondary">{t('change_pass')}</button>
            <button className="btn-primary"><Edit3 size={18} /> {t('prof_save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}