import { useEffect, useState } from "react";
import api from "../api";
import { Users, ShieldPlus, CheckCircle, XCircle } from 'lucide-react';

export default function AdminPortal() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('approvals'); // Default to approvals for Portal
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState("");

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  useEffect(() => {
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : null;
    if (!u || u.role !== 'admin') {
      window.location.href = '/login';
      return;
    }
    setUser(u);
    fetchData('approvals');
  }, []);

  useEffect(() => {
    if (user) fetchData(activeTab);
  }, [activeTab, user]);

  const fetchData = async (tab) => {
    if (!user || !user.token) return;
    setLoading(true);
    try {
      if (tab === 'approvals') {
        const res = await api.get('/api/admin/drivers/pending', { headers: { 'x-auth-token': user.token } });
        setPendingDrivers(res.data || []);
      } else if (tab === 'users') {
        const res = await api.get('/api/admin/users', { headers: { 'x-auth-token': user.token } });
        setAllUsers(res.data || []);
      }
    } catch (err) {
      console.error(err);
      showToast("Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (driverId, action) => {
    try {
      await api.post(`/api/admin/drivers/${driverId}/${action}`, {}, { headers: { 'x-auth-token': user.token } });
      showToast(`Driver successfully ${action}ed`);
      fetchData('approvals');
    } catch (err) {
      showToast(`Failed to ${action} driver`);
    }
  };

  // Add Admin State
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminName || !newAdminEmail || !newAdminPassword) return showToast("Fill all fields");
    try {
      await api.post('/api/register', 
        { name: newAdminName, email: newAdminEmail, password: newAdminPassword, role: 'admin', otp: '123456' }, // Mock OTP for internal admin creation if backend requires it
        { headers: { 'x-auth-token': user.token } }
      );
      showToast("Administrator Account Created!");
      setNewAdminName(""); setNewAdminEmail(""); setNewAdminPassword("");
      fetchData('users');
    } catch (err) {
      showToast(err.response?.data || "Failed to create admin");
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#0f172a', fontWeight: 800 }}>Admin Portal</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.95rem' }}>User Management & Driver Verification</p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setActiveTab('approvals')} style={activeTab === 'approvals' ? activeTabStyle : inactiveTabStyle}>
            <CheckCircle size={18} /> Pending Approvals
          </button>
          <button onClick={() => setActiveTab('users')} style={activeTab === 'users' ? activeTabStyle : inactiveTabStyle}>
            <Users size={18} /> Users & Admins
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading portal data...</div>
        ) : (
          <>
            {activeTab === 'approvals' && (
              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem' }}>Driver Verification Queue</h3>
                {pendingDrivers.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 12 }}>
                    No pending applications. All drivers are verified.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {pendingDrivers.map(driver => (
                      <div key={driver.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>{driver.name}</h4>
                          <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>{driver.email} • Joined {new Date(driver.createdAt).toLocaleDateString()}</p>
                          <p style={{ margin: '4px 0 0', color: '#4f46e5', fontWeight: 600, fontSize: '0.8rem' }}>{driver.vehicle_name || 'Vehicle details pending'}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => handleApproval(driver.id, 'approve')} style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
                          <button onClick={() => handleApproval(driver.id, 'reject')} style={{ padding: '8px 16px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
                <div style={cardStyle}>
                  <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem' }}>System Directory</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
                        <tr>
                          <th style={{ padding: 12 }}>User</th>
                          <th style={{ padding: 12 }}>Role</th>
                          <th style={{ padding: 12 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allUsers.map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: 12 }}><strong>{u.name}</strong><br/><span style={{ fontSize: '0.8rem', color: '#64748b' }}>{u.email}</span></td>
                            <td style={{ padding: 12 }}><span style={{ textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700, color: u.role === 'admin' ? '#4f46e5' : '#64748b' }}>{u.role}</span></td>
                            <td style={{ padding: 12, color: '#64748b' }}>{u.role === 'driver' ? u.approval_status : 'Active'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={cardStyle}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldPlus size={18} color="#4f46e5" /> New Admin
                  </h3>
                  <form onSubmit={handleAddAdmin}>
                    <input type="text" placeholder="Full Name" value={newAdminName} onChange={e=>setNewAdminName(e.target.value)} style={inputStyle} />
                    <input type="email" placeholder="Email" value={newAdminEmail} onChange={e=>setNewAdminEmail(e.target.value)} style={inputStyle} />
                    <input type="password" placeholder="Password" value={newAdminPassword} onChange={e=>setNewAdminPassword(e.target.value)} style={inputStyle} />
                    <button type="submit" style={{ width: '100%', padding: 12, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Create Admin Account</button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {notification && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0f172a', color: '#fff', padding: '12px 24px', borderRadius: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', fontWeight: 500, fontSize: '0.9rem', zIndex: 1000, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={18} color="#22c55e" /> {notification}
        </div>
      )}
    </div>
  );
}

const activeTabStyle = { padding: '10px 18px', background: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };
const inactiveTabStyle = { padding: '10px 18px', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };
const cardStyle = { background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' };
const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1', marginBottom: 12, outline: 'none', boxSizing: 'border-box' };
