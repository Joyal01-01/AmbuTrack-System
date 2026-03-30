import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import api from "../api";
import { useTheme } from "../component/ThemeContext";
import { socket } from "../socket";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Activity, Ambulance, MapPin, CheckCircle, Users, Building2, History, X, Clock, Navigation, FileText, FileDown, ShieldPlus } from 'lucide-react';

// Fix Leaflet Icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ totalAmbulances: 0, onlineAmbulances: 0, activeTrips: 0, completedTrips: 0 });
  const [ambulances, setAmbulances] = useState([]);
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [showHospitals, setShowHospitals] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [adminCreating, setAdminCreating] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [activeTab, setActiveTab] = useState('map'); // 'map', 'approvals', 'users', 'reports'
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [verifyingDriverId, setVerifyingDriverId] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const { darkMode } = useTheme();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/manage-users') setActiveTab('users');
    else if (location.pathname === '/manage-drivers') setActiveTab('approvals');
    else if (location.pathname === '/reports') setActiveTab('reports');
    else setActiveTab('map');
  }, [location.pathname]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : null;
    if (!u || u.role !== 'admin') {
      window.location.href = '/login';
      return;
    }
    setUser(u);
    
    // Initial fetch
    fetchStats(u.token);
    fetchLiveDrivers(u.token);
    fetchPendingDrivers(u.token);
    fetchHospitals();
    fetchAllUsers(u.token);

    // Socket listeners for real-time updates
    socket.emit("identify", { token: u.token });
    
    socket.on('driver_location_update', (data) => {
      setAmbulances(prev => prev.map(d => d.driver_user_id === data.userId ? { ...d, lat: data.lat, lng: data.lng } : d));
    });

    socket.on('new_driver_pending', (data) => {
      setNotification(`New driver registered: ${data.name}. Awaiting approval from Portal.`);
      // Auto-hide after 8 seconds
      setTimeout(() => setNotification(null), 8000);
    });

    const interval = setInterval(() => {
      fetchStats(u.token);
      fetchLiveDrivers(u.token);
    }, showLive ? 3000 : 10000);

    return () => {
      socket.off('driver_location_update');
      socket.off('new_driver_pending');
      clearInterval(interval);
    };
  }, [showLive]);

  const fetchStats = async (token) => {
    try {
      const res = await api.get('/api/admin/stats', { headers: { 'x-auth-token': token } });
      setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveDrivers = async (token) => {
    try {
      const res = await api.get('/api/admin/drivers/online', { headers: { 'x-auth-token': token } });
      setAmbulances(res.data || []);
    } catch (e) {
      console.error("Failed to fetch live drivers", e);
    }
  };

  const fetchPendingDrivers = async (token) => {
    try {
      const res = await api.get('/api/admin/drivers/pending', { headers: { 'x-auth-token': token } });
      setPendingDrivers(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };
  
  const fetchAllUsers = async (token) => {
    try {
      const res = await api.get('/api/admin/users', { headers: { 'x-auth-token': token } });
      setAllUsers(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/api/admin/drivers/${id}/approve`, {}, { headers: { 'x-auth-token': user.token } });
      setNotification("Driver approved successfully");
      fetchPendingDrivers(user.token);
      fetchStats(user.token);
    } catch (e) {
      setNotification("Approval failed");
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/api/admin/drivers/${id}/reject`, {}, { headers: { 'x-auth-token': user.token } });
      setNotification("Driver rejected");
      fetchPendingDrivers(user.token);
    } catch (e) {
      setNotification("Rejection failed");
    }
  };

  const handleRunOCR = async (id) => {
    setOcrLoading(true);
    setVerifyingDriverId(id);
    try {
      const res = await api.post(`/api/admin/drivers/${id}/run-ocr`, {}, { headers: { 'x-auth-token': user.token } });
      setNotification(res.data.flagged ? "OCR completed with warnings" : "OCR verified successfully");
      fetchPendingDrivers(user.token);
    } catch (e) {
      setNotification("OCR failed");
    } finally {
      setOcrLoading(false);
    }
  };

  const fetchTripHistory = async () => {
    if (!user?.token) return;
    try {
      const res = await api.get('/api/admin/trip-history', { headers: { 'x-auth-token': user.token } });
      setHistoryData(res.data || []);
      setShowHistory(true);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHospitals = async () => {
    try {
      // Increase radius to 100km to cover a significant part of Nepal from KTM
      const res = await api.get(`/api/nearby-hospitals?lat=27.7172&lng=85.3240&radius=100`);
      setNearbyHospitals(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setAdminCreating(true);
    try {
      await api.post('/api/admin/create-admin', adminForm, { headers: { 'x-auth-token': user.token } });
      setNotification("New admin created successfully!");
      setShowAdminModal(false);
      setAdminForm({ name: '', email: '', phone: '', password: '' });
    } catch (err) {
      setNotification("Failed to create admin: " + (err.response?.data?.error || err.message));
    } finally {
      setAdminCreating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column', color: 'var(--text)' }}>
      
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999, background: 'var(--card-bg)', borderLeft: '4px solid #3b82f6',
          padding: '16px 20px', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', display: 'flex',
          alignItems: 'center', gap: 12, minWidth: 300, animation: 'slideIn 0.3s ease-out forwards'
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600, flex: 1 }}>{notification}</p>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 350px) 1fr', gap: 24, flex: 1, padding: '24px var(--container-padding)', maxWidth: 'var(--container-max)', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* SIDEBAR: System Overview */}
        <div className="admin-sidebar" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, height: 'fit-content' }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text)', fontWeight: 800 }}>Admin Dashboard</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: 'var(--background)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
                <button onClick={() => setActiveTab('map')} style={{ padding: '8px', borderRadius: 8, border: 'none', background: activeTab === 'map' ? '#3b82f6' : 'transparent', color: activeTab === 'map' ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>{t('tab_map')}</button>
                <button onClick={() => setActiveTab('approvals')} style={{ padding: '8px', borderRadius: 8, border: 'none', background: activeTab === 'approvals' ? '#3b82f6' : 'transparent', color: activeTab === 'approvals' ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', position: 'relative' }}>
                  {t('tab_verif')} {pendingDrivers.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: 10 }}>{pendingDrivers.length}</span>}
                </button>
                <button onClick={() => setActiveTab('users')} style={{ padding: '8px', borderRadius: 8, border: 'none', background: activeTab === 'users' ? '#3b82f6' : 'transparent', color: activeTab === 'users' ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>{t('tab_users')}</button>
                <button onClick={() => setActiveTab('reports')} style={{ padding: '8px', borderRadius: 8, border: 'none', background: activeTab === 'reports' ? '#3b82f6' : 'transparent', color: activeTab === 'reports' ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>{t('tab_reports')}</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>{activeTab === 'map' ? 'Live System Monitoring' : 'Driver Verifications'}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={fetchTripHistory}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, 
                      background: darkMode ? '#1e293b' : '#f1f5f9', color: darkMode ? '#f1f5f9' : '#475569', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' 
                    }}
                  >
                    <History size={14} /> History
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { label: t('stat_fleet'), value: stats.totalAmbulances, icon: <Ambulance size={18} />, bg: '#fef2f2', color: '#ef4444' },
              { label: t('stat_online_now'), value: stats.onlineAmbulances, icon: <Activity size={18} />, bg: '#f0fdf4', color: '#22c55e' },
              { label: t('stat_active_trips'), value: stats.activeTrips, icon: <MapPin size={18} />, bg: '#e0e7ff', color: '#4f46e5' },
              { label: t('stat_finished'), value: stats.completedTrips, icon: <CheckCircle size={18} />, bg: '#f8fafc', color: '#475569' }
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.icon}
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32, padding: 20, background: 'var(--background)', borderRadius: 16, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '1rem', color: 'var(--text)' }}>Online Drivers List</h4>
            {ambulances.length === 0 ? (
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>No drivers currently online.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ambulances.map(a => (
                  <div key={a.driver_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{a.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{a.vehicle_name || 'Ambulance'} • {a.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Map Controls */}
          <div style={{ marginTop: 24, padding: 20, background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '1rem', color: 'var(--text)' }}>Map Layers</h4>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={16} color="#64748b" />
                <span style={{ fontSize: '0.9rem', color: darkMode ? '#cbd5e1' : '#475569', fontWeight: 500 }}>{t('btn_find_hosp')}</span>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                <input 
                  type="checkbox" 
                  checked={showHospitals} 
                  onChange={(e) => setShowHospitals(e.target.checked)} 
                  style={{ opacity: 0, width: 0, height: 0 }} 
                />
                <span style={{ 
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                  backgroundColor: showHospitals ? '#22c55e' : '#cbd5e1', 
                  transition: '.4s', borderRadius: 24 
                }}>
                  <span style={{ 
                    position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, 
                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                    transform: showHospitals ? 'translateX(20px)' : 'translateX(0)'
                  }} />
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Ambulance size={16} color="#22c55e" />
                <span style={{ fontSize: '0.9rem', color: darkMode ? '#cbd5e1' : '#475569', fontWeight: 500 }}>{t('status_online')} (3s)</span>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                <input 
                  type="checkbox" 
                  checked={showLive} 
                  onChange={(e) => setShowLive(e.target.checked)} 
                  style={{ opacity: 0, width: 0, height: 0 }} 
                />
                <span style={{ 
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                  backgroundColor: showLive ? '#4f46e5' : '#cbd5e1', 
                  transition: '.4s', borderRadius: 24 
                }}>
                  <span style={{ 
                    position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, 
                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                    transform: showLive ? 'translateX(20px)' : 'translateX(0)'
                  }} />
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div style={{ position: 'relative', height: 600, borderRadius: 24, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card-bg)' }}>
          {activeTab === 'map' ? (
            <>
              <MapContainer center={[27.7172, 85.3240]} zoom={8} style={{ height: '100%', width: '100%', zIndex: 1 }} zoomControl={true}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
                
                {ambulances.map(a => (
                  <Marker key={a.driver_id} position={[a.lat, a.lng]} icon={driverIcon}>
                    <Popup>
                      <strong>{a.name}</strong><br/>
                      Vehicle: {a.vehicle_name}<br/>
                      Type: {a.vehicle_type}<br/>
                      Status: {a.status}
                    </Popup>
                  </Marker>
                ))}

                {showHospitals && nearbyHospitals.map((h, i) => (
                  <Marker key={`hosp-${i}`} position={[h.lat, h.lng]} icon={hospitalIcon}>
                    <Popup>
                      <strong>{h.name}</strong><br/>
                      {h.type === 'hospital' ? '🏥 Hospital' : '🏨 Clinic'}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
              
              <div style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 1000, background: 'var(--card-bg)', padding: '10px 16px', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>
                 {t('tab_map')} Monitoring
              </div>
            </>
          ) : activeTab === 'users' ? (
            <div style={{ height: '100%', overflowY: 'auto', padding: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{t('tab_users')}</h2>
                <button onClick={() => setShowAdminModal(true)} style={{ padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>+ Admin</button>
              </div>
              <div style={{ background: 'var(--background)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead style={{ background: 'rgba(0,0,0,0.02)', textAlign: 'left' }}>
                    <tr>
                      <th style={{ padding: '16px 20px', color: 'var(--muted)' }}>{t('reg_fullname')}</th>
                      <th style={{ padding: '16px 20px', color: 'var(--muted)' }}>Role</th>
                      <th style={{ padding: '16px 20px', color: 'var(--muted)' }}>{t('tab_verif')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map(u => (
                      <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 700 }}>{u.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: u.role === 'admin' ? '#4f46e5' : 'var(--text)' }}>{u.role}</span>
                        </td>
                        <td style={{ padding: '16px 20px', color: 'var(--muted)' }}>
                          {u.role === 'driver' ? u.approval_status : 'Active'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'reports' ? (
            <div style={{ height: '100%', overflowY: 'auto', padding: 32 }}>
               <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 800 }}>Export System Reports</h2>
               <p style={{ margin: '0 0 32px', color: 'var(--muted)' }}>Download comprehensive data for audits and performance reviews.</p>
               
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                  <div style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 20, background: 'var(--background)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={22} color="#ef4444" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>PDF Report</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>System summary & driver statistics</div>
                      </div>
                    </div>
                    <a href={`${api.defaults.baseURL || ''}/api/admin/reports/pdf?token=${user?.token}`} download style={{ display: 'block', textAlign: 'center', padding: '12px', background: '#ef4444', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>Download PDF</a>
                  </div>

                  <div style={{ padding: 24, border: '1px solid var(--border)', borderRadius: 20, background: 'var(--background)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 44, height: 44, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileDown size={22} color="#22c55e" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Excel / CSV</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Raw trip data for data analysis</div>
                      </div>
                    </div>
                    <a href={`${api.defaults.baseURL || ''}/api/admin/reports/csv?token=${user?.token}`} download style={{ display: 'block', textAlign: 'center', padding: '12px', background: '#22c55e', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>Download CSV</a>
                  </div>
               </div>
            </div>
          ) : (
            <div style={{ height: '100%', overflowY: 'auto', padding: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{t('tab_verif')}</h2>
                <button onClick={() => fetchPendingDrivers(user.token)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>Refresh List</button>
              </div>

              {pendingDrivers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--muted)' }}>
                  <CheckCircle size={64} style={{ opacity: 0.2, marginBottom: 16 }} />
                  <p style={{ margin: 0, fontSize: '1.1rem' }}>Great! No pending driver applications.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 20 }}>
                  {pendingDrivers.map(d => (
                    <div key={d.id} style={{ background: 'var(--background)', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{d.name}</h3>
                            <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 10, background: '#fef3c7', color: '#d97706', fontWeight: 700 }}>{d.approval_status.toUpperCase()}</span>
                          </div>
                          <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '0.9rem' }}>{d.email} • {d.phone || 'No phone'}</p>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <div style={{ background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>Vehicle Info</span>
                              <div style={{ fontWeight: 600 }}>{d.vehicle_name || 'N/A'}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{d.vehicle_type} • {d.vehicle_number}</div>
                            </div>
                            <div style={{ background: 'var(--card-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>Registration Date</span>
                              <div style={{ fontWeight: 600 }}>{new Date(d.createdAt).toLocaleDateString()}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{new Date(d.createdAt).toLocaleTimeString()}</div>
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>AI Document Verification</h4>
                              <button 
                                onClick={() => handleRunOCR(d.id)}
                                disabled={ocrLoading}
                                style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', opacity: ocrLoading ? 0.7 : 1 }}
                              >
                                {ocrLoading && verifyingDriverId === d.id ? 'Analyzing...' : 'Run Discovery OCR'}
                              </button>
                            </div>
                            {d.ocr_flags ? (
                              <div style={{ fontSize: '0.85rem', color: d.ocr_flags.includes('✅') ? '#059669' : '#dc2626', background: d.ocr_flags.includes('✅') ? '#ecfdf5' : '#fef2f2', padding: 12, borderRadius: 8, border: '1px solid ' + (d.ocr_flags.includes('✅') ? '#10b98133' : '#ef444433'), lineHeight: 1.5 }}>
                                <strong>System Note:</strong> {d.ocr_flags}
                              </div>
                            ) : (
                              <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>OCR analysis has not been run for this application yet.</p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Document Photos</span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                             <div 
                               onClick={() => d.license_photo && window.open(`${api.defaults.baseURL}${d.license_photo}`, '_blank')}
                               style={{ flex: 1, height: 100, background: '#f1f5f9', borderRadius: 8, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
                             >
                               {d.license_photo ? <img src={`${api.defaults.baseURL}${d.license_photo}`} alt="License" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.7rem', color: '#64748b' }}>No License</span>}
                             </div>
                             <div 
                               onClick={() => d.nid_photo && window.open(`${api.defaults.baseURL}${d.nid_photo}`, '_blank')}
                               style={{ flex: 1, height: 100, background: '#f1f5f9', borderRadius: 8, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
                             >
                               {d.nid_photo ? <img src={`${api.defaults.baseURL}${d.nid_photo}`} alt="NID" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '0.7rem', color: '#64748b' }}>No NID</span>}
                             </div>
                          </div>

                          <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
                            <button onClick={() => handleApprove(d.id)} style={{ width: '100%', padding: '12px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>{t('btn_accept').toUpperCase()}</button>
                            <button onClick={() => handleReject(d.id)} style={{ width: '100%', padding: '12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>{t('btn_reject').toUpperCase()}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card-bg)', width: '90%', maxWidth: 800, maxHeight: '80vh', borderRadius: 20, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text)', fontWeight: 800 }}>{t('nav_history')}</h2>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Trip ID</th>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Time</th>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>#{h.id}</td>
                      <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.9rem' }}>{new Date(h.created_at).toLocaleString()}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: '#f0fdf4', color: '#22c55e' }}>{h.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.85rem' }}>
                        <MapPin size={12} style={{ marginRight: 4 }} /> {h.lat?.toFixed(4)}, {h.lng?.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                  {historyData.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        <Clock size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                        <p>No trip history available yet.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card-bg)', width: '100%', maxWidth: 450, borderRadius: 24, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text)', fontWeight: 800 }}>{t('login_create_acc')} (Admin)</h2>
              <button onClick={() => setShowAdminModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateAdmin} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>Full Name</label>
                <input 
                  type="text" required value={adminForm.name} onChange={e => setAdminForm({...adminForm, name: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                  placeholder="Admin Name"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>Email Address</label>
                <input 
                  type="email" required value={adminForm.email} onChange={e => setAdminForm({...adminForm, email: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>Phone Number</label>
                <input 
                  type="text" value={adminForm.phone} onChange={e => setAdminForm({...adminForm, phone: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                  placeholder="+977-XXXXXXXXXX"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>Password</label>
                <input 
                  type="password" required value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.95rem' }}
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit" disabled={adminCreating}
                style={{ 
                  marginTop: 8, padding: '14px', background: '#0f172a', color: '#fff', 
                  border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer',
                  opacity: adminCreating ? 0.7 : 1
                }}
              >
                {adminCreating ? "Creating..." : "Create Admin Account"}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
