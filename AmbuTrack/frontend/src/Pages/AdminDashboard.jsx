import { useEffect, useState } from "react";
import api from "../api";
import { socket } from "../socket";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Activity, Ambulance, MapPin, CheckCircle, Users, Building2, History, X, Clock, Navigation } from 'lucide-react';

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
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ totalAmbulances: 0, onlineAmbulances: 0, activeTrips: 0, completedTrips: 0 });
  const [ambulances, setAmbulances] = useState([]);
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [showHospitals, setShowHospitals] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [notification, setNotification] = useState(null);

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
    fetchHospitals();

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
    }, 10000);

    return () => {
      socket.off('driver_location_update');
      socket.off('new_driver_pending');
      clearInterval(interval);
    };
  }, []);

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
      const res = await api.get('/api/admin/all-drivers', { headers: { 'x-auth-token': token } });
      setAmbulances(res.data || []);
    } catch (e) {
      console.error(e);
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

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999, background: '#fff', borderLeft: '4px solid #3b82f6',
          padding: '16px 20px', borderRadius: 8, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', display: 'flex',
          alignItems: 'center', gap: 12, minWidth: 300, animation: 'slideIn 0.3s ease-out forwards'
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', fontWeight: 600, flex: 1 }}>{notification}</p>
          <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', flex: 1 }}>
        
        {/* SIDEBAR: System Overview */}
        <div style={{ background: '#fff', borderRight: '1px solid #e2e8f0', padding: 24, overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: 800 }}>Admin Dashboard</h1>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Live System Monitoring</p>
              <button 
                onClick={fetchTripHistory}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, 
                  background: 'var(--blue-soft)', color: 'var(--blue)', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' 
                }}
              >
                <History size={14} /> Watch History
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { label: 'Total Fleet', value: stats.totalAmbulances, icon: <Ambulance size={18} />, bg: '#fef2f2', color: '#ef4444' },
              { label: 'Online Now', value: stats.onlineAmbulances, icon: <Activity size={18} />, bg: '#f0fdf4', color: '#22c55e' },
              { label: 'Active Trips', value: stats.activeTrips, icon: <MapPin size={18} />, bg: '#e0e7ff', color: '#4f46e5' },
              { label: 'Finished Today', value: stats.completedTrips, icon: <CheckCircle size={18} />, bg: '#f8fafc', color: '#475569' }
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 16, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.icon}
                  </div>
                  <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32, padding: 20, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#0f172a' }}>Online Drivers List</h4>
            {ambulances.length === 0 ? (
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>No drivers currently online.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ambulances.map(a => (
                  <div key={a.driver_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{a.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{a.vehicle_name || 'Ambulance'} • {a.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Map Controls */}
          <div style={{ marginTop: 24, padding: 20, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '1rem', color: '#0f172a' }}>Map Layers</h4>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Building2 size={16} color="#64748b" />
                <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 500 }}>Hospitals & Clinics</span>
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
          </div>
        </div>

        {/* MAIN: Live Map */}
        <div style={{ position: 'relative' }}>
          <MapContainer center={[27.7172, 85.3240]} zoom={8} style={{ height: '100%', width: '100%' }} zoomControl={true}>
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
          
          <div style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 1000, background: '#fff', padding: '10px 16px', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
             Live System Monitoring Active
          </div>
        </div>
      </div>

      {showHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '90%', maxWidth: 800, maxHeight: '80vh', borderRadius: 20, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: 800 }}>Trip History</h2>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
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
    </div>
  );
}
