import { useState, useEffect } from "react";
import api from "../api";
import "./Profile.css";
import { User, Mail, Shield, ShieldCheck, Phone, MapPin, Edit3, Save } from "lucide-react";

export default function Profile() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
  const [twofa, setTwofa] = useState(false);
  const [loading, setLoading] = useState(false);

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
    fetchUserData();
  }, [user.id]);

  const handleToggle2FA = async () => {
    setLoading(true);
    try {
      const res = await api.post("/api/user/2fa", { enable: !twofa, token: user.token });
      if (res.data.ok) {
        setTwofa(res.data.twofa);
        alert(`2-Step Authentication has been ${res.data.twofa ? "Enabled" : "Disabled"}.`);
      }
    } catch (err) {
      alert("Failed to toggle 2FA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar-wrapper">
            {user?.name?.charAt(0).toUpperCase() || <User size={40} />}
          </div>
          <h2>{user?.name}</h2>
          <p>{user?.role?.toUpperCase()} ACCOUNT</p>
        </div>

        <div className="profile-content">
          <div className="profile-section">
            <h3><User size={18} /> Personal Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>Full Name</label>
                <span>{user?.name}</span>
              </div>
              <div className="info-item">
                <label>Email Address</label>
                <span>{user?.email}</span>
              </div>
              <div className="info-item">
                <label>Account Status</label>
                <span style={{ color: user?.approval_status === 'approved' ? '#10b981' : '#f59e0b' }}>
                  {user?.approval_status?.toUpperCase() || 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h3><Shield size={18} /> Security Settings</h3>
            <div className="settings-card">
              <div className="settings-info">
                <h4>2-Step Authentication</h4>
                <p>Add an extra layer of security to your account by requiring an email OTP at login.</p>
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
            <button className="btn-secondary">Change Password</button>
            <button className="btn-primary"><Edit3 size={18} /> Edit Profile</button>
          </div>
        </div>
      </div>
    </div>
  );
}