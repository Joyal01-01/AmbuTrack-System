// src/Pages/DriverDashboard.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { socket } from "../socket";
import api from "../api";
import { Link } from "react-router-dom";
import {
  Ambulance, Wallet, Star, Clock, Play, Pause,
  MapPin, Navigation, Ruler, Timer, Inbox, CheckCircle,
  AlertTriangle, Wifi, WifiOff, Settings, RefreshCw,
  LocateFixed, TrendingUp, ClipboardList, Zap, CircleDot,
  Phone, ArrowRight, Info, X, ChevronRight
} from "lucide-react";
import "./DriverDashboard.css";
import Chatbot from "../component/Chatbot";
import NearbyHospitals from "../component/NearbyHospitals";

const DEFAULT_CENTER = [27.7172, 85.324];

// Fix typical Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtMins(mins) {
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center]);
  return null;
}

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []);
  const Icon = type === "success" ? CheckCircle : type === "error" ? AlertTriangle : Info;
  return (
    <div className={`toast ${type}`}>
      <Icon size={16} /> {message}
    </div>
  );
}

export default function DriverDashboard() {
  const getUserData = useCallback(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [requests, setRequests] = useState([]);
  const [pairedPatient, setPairedPatient] = useState(null);
  const [myLocation, setMyLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('last_driver_location');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const updateLocation = (loc) => {
    setMyLocation(loc);
    localStorage.setItem('last_driver_location', JSON.stringify(loc));
  };
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState({
    totalTrips: 0, todayTrips: 0, todayEarnings: 0,
    totalEarnings: 0, rating: 5.0, driverName: "",
    driverEmail: "", onlineSince: null,
  });
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripHistory, setTripHistory] = useState([]);
  const [socketConnected, setSocketConnected] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [onlineTime, setOnlineTime] = useState("0h 0m");
  const [nearbyHospitals, setNearbyHospitals] = useState([]);

  const patientRef = useRef(null);
  const intervalRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const onlineTimerRef = useRef(null);
  const toastIdRef = useRef(0);

  useEffect(() => { patientRef.current = pairedPatient; }, [pairedPatient]);

  const addToast = useCallback((message, type = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const user = getUserData();
      if (!user?.token) return;
      const res = await api.get("/api/driver/stats", { headers: { "x-auth-token": user.token } });
      if (res.data) setStats(res.data);
    } catch {}
  }, [getUserData]);

  const fetchActiveTrip = useCallback(async () => {
    try {
      const user = getUserData();
      if (!user?.token) return;
      const res = await api.get("/api/driver/active-trip", { headers: { "x-auth-token": user.token } });
      setActiveTrip(res.data || null);
    } catch {}
  }, [getUserData]);

  const fetchTripHistory = useCallback(async () => {
    try {
      const user = getUserData();
      if (!user?.token) return;
      const res = await api.get("/api/driver/trip-history", { headers: { "x-auth-token": user.token } });
      setTripHistory(res.data || []);
    } catch {}
  }, [getUserData]);

  useEffect(() => {
    if (isOnline) {
      const startTime = stats.onlineSince ? new Date(stats.onlineSince).getTime() : Date.now();
      const update = () => {
        const diff = Date.now() - startTime;
        const totalMins = Math.floor(diff / 60000);
        setOnlineTime(`${Math.floor(totalMins / 60)}h ${totalMins % 60}m`);
      };
      update();
      onlineTimerRef.current = setInterval(update, 30000);
      return () => clearInterval(onlineTimerRef.current);
    } else {
      setOnlineTime("0h 0m");
    }
  }, [isOnline, stats.onlineSince]);

  const fetchHospitals = useCallback(async () => {
    if (!myLocation) return;
    try {
      const res = await api.get(`/api/nearby-hospitals?lat=${myLocation.lat}&lng=${myLocation.lng}&radius=50`);
      setNearbyHospitals(res.data || []);
    } catch {}
  }, [myLocation]);

  useEffect(() => {
    fetchHospitals();
  }, [myLocation, fetchHospitals]);

  useEffect(() => {
    const user = getUserData();
    if (user?.token) socket.emit("identify", { role: "driver", token: user.token });

    function onRequest(r) {
      const requestWithTime = { ...r, timestamp: Date.now() };
      setRequests((prev) => (prev.find((p) => p.id === r.id) ? prev : [requestWithTime, ...prev]));
    }
    socket.on("ride_request", onRequest);
    // Remove request when server notifies it's cancelled/claimed
    socket.on('ride_cancelled', (data) => {
      if(!data || !data.id) return;
      setRequests(prev => prev.filter(r => r.id !== data.id));
    });

    const purgeInterval = setInterval(() => {
      setRequests((prev) => prev.filter((r) => Date.now() - (r.timestamp || 0) < 60000));
    }, 5000);

    return () => {
      socket.off("ride_request", onRequest);
      socket.off("ride_cancelled");
      clearInterval(purgeInterval);
    };

    async function loadPending() {
      try { 
        const res = await api.get("/api/ride-requests"); 
        const now = Date.now();
        const updated = (res.data || []).map(r => ({ ...r, timestamp: r.timestamp || now }));
        setRequests(updated); 
      } catch {}
    }
    loadPending();
    const poll = setInterval(loadPending, 5000);

    // Request expiry timer
    const expiryInterval = setInterval(() => {
      const now = Date.now();
      setRequests(prev => prev.filter(r => !r.timestamp || (now - r.timestamp) < 60000));
    }, 5000);

    fetchStats(); fetchActiveTrip(); fetchTripHistory();
    statsIntervalRef.current = setInterval(() => { fetchStats(); fetchActiveTrip(); }, 15000);

    socket.on("ride_confirmed", (data) => {
      setPairedPatient({ socketId: data.patientSocketId });
      fetchActiveTrip();
      addToast("Ride confirmed! Navigate to patient.", "success");
    });
    socket.on("pair_location", (loc) => {
      if (!loc) return;
      setPairedPatient((prev) =>
        prev && prev.socketId === loc.from ? { ...prev, lat: loc.lat, lng: loc.lng } : prev
      );
    });

    return () => {
      socket.off("ride_request", onRequest);
      socket.off("ride_confirmed");
      socket.off("pair_location");
      socket.off("pair_location");
      clearInterval(poll);
      clearInterval(expiryInterval);
      clearInterval(statsIntervalRef.current);
      try { goOffline(); } catch {}
    };
  }, []);

  useEffect(() => {
    function onStatus(e) {
      const connected = !!e.detail?.connected;
      setSocketConnected(connected);
      setShowBanner(true);
      if (connected) setTimeout(() => setShowBanner(false), 3000);
    }
    window.addEventListener("socket-status", onStatus);
    return () => window.removeEventListener("socket-status", onStatus);
  }, []);

  async function acceptRequest(req) {
    if (!isOnline) return addToast("Go online first to accept requests", "error");
    if (pairedPatient || activeTrip) return addToast("Complete your current trip first", "error");
    try {
      const user = getUserData();
      await api.post(`/api/ride-request/${req.id}/accept`, {}, { headers: { "x-auth-token": user?.token } });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      addToast("Request accepted!", "success");
      fetchActiveTrip(); fetchStats();
    } catch (err) {
      const msg = err?.response?.data || err?.message || 'Failed to accept request';
      addToast(String(msg), "error");
    }
  }

  async function markArrived(tripId) {
    try {
      const user = getUserData();
      await api.post(`/api/driver/trip/${tripId}/arrived`, {}, { headers: { "x-auth-token": user?.token } });
      addToast("Marked as arrived", "success");
      fetchActiveTrip();
    } catch { addToast("Failed to update", "error"); }
  }

  async function startTrip(tripId) {
    try {
      const user = getUserData();
      await api.post(`/api/driver/trip/${tripId}/start`, {}, { headers: { "x-auth-token": user?.token } });
      addToast("Trip started", "success");
      fetchActiveTrip();
    } catch { addToast("Failed to start trip", "error"); }
  }

  async function completeTrip(tripId) {
    try {
      const user = getUserData();
      let distanceKm = 0;
      if (myLocation && activeTrip) {
        const pLat = activeTrip.patient_lat || activeTrip.lat;
        const pLng = activeTrip.patient_lng || activeTrip.lng;
        if (pLat && pLng) distanceKm = haversine(pLat, pLng, myLocation.lat, myLocation.lng);
      }
      const res = await api.post(`/api/driver/trip/${tripId}/complete`, { distance_km: distanceKm.toFixed(2) }, { headers: { "x-auth-token": user?.token } });
      addToast(`Trip completed! Fare: NPR ${res.data.fare}`, "success");
      setActiveTrip(null); setPairedPatient(null);
      fetchStats(); fetchTripHistory();
    } catch { addToast("Failed to complete trip", "error"); }
  }

  function goOnline() {
    if (isOnline) return;
    if (!navigator.geolocation) return addToast("Geolocation not supported", "error");
    setIsOnline(true);
    const user = getUserData();
    socket.emit("identify", { role: "driver", token: user?.token });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.post("/api/driver/online", { lat: pos.coords.latitude, lng: pos.coords.longitude }, { headers: { "x-auth-token": user?.token } });
          fetchStats();
        } catch {}
      }, () => {}, { enableHighAccuracy: true }
    );
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        updateLocation({ lat, lng });
        socket.emit("sendLocation", { driverId: user?.id || user?.userId || null, lat, lng });
        const patient = patientRef.current;
        if (patient?.socketId) socket.emit("pair_location", { toSocketId: patient.socketId, lat, lng });
      }, () => {}, { enableHighAccuracy: true });
    }, 2000);
    addToast("You are now online", "success");
  }

  function goOffline() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsOnline(false);
    const user = getUserData();
    try { api.post("/api/driver/offline", {}, { headers: { "x-auth-token": user?.token } }); } catch {}
    socket.emit("driver_offline", { driverId: user?.id || user?.userId || null });
  }

  const user = getUserData();
  const driverName = stats.driverName || user?.name || "Driver";
  const initials = driverName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="driver-dash">
      {showBanner && (
        <div className={`connection-banner ${socketConnected ? "connected" : "disconnected"}`}>
          {socketConnected ? <><Wifi size={14} /> Connected</> : <><WifiOff size={14} /> Reconnecting…</>}
        </div>
      )}

      {/* Header */}
      <div className="dash-header">
        <div className="dash-greeting">
          <div className="dash-avatar">{initials}</div>
          <div className="dash-info">
            <h1>
              {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 18 ? "Good Afternoon" : "Good Evening"}, {driverName.split(" ")[0]}
            </h1>
            <div className="dash-subtitle">
              <span className="role-badge"><Ambulance size={11} /> Driver</span>
              <span className={`status-dot ${isOnline ? "online" : "offline"}`} />
              <span>{isOnline ? "Online" : "Offline"}</span>
              {isOnline && <span className="online-timer">· {onlineTime}</span>}
            </div>
          </div>
        </div>
        <button className={`toggle-btn ${isOnline ? "go-offline" : "go-online"}`} onClick={isOnline ? goOffline : goOnline}>
          {isOnline ? <><Pause size={15} /> Go Offline</> : <><Play size={15} /> Go Online</>}
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon-wrap red"><Ambulance size={18} /></div>
          <div className="stat-val">{stats.totalTrips}</div>
          <div className="stat-lbl">Total Trips</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap green"><Wallet size={18} /></div>
          <div className="stat-val">NPR {stats.todayEarnings?.toLocaleString() || 0}</div>
          <div className="stat-lbl">Today's Earnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap yellow"><Star size={18} /></div>
          <div className="stat-val">{stats.rating?.toFixed(1) || "5.0"}</div>
          <div className="stat-lbl">Rating</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap blue"><Clock size={18} /></div>
          <div className="stat-val">{isOnline ? onlineTime : "—"}</div>
          <div className="stat-lbl">Online Time</div>
        </div>
      </div>

      {/* Active Trip */}
      {activeTrip && (
        <div className="glass-card active-trip-panel">
          <div className="glass-card-title">
            <CircleDot size={16} style={{ color: "var(--accent)" }} /> Active Trip
            <span className={`trip-status-badge ${activeTrip.status}`}>
              {activeTrip.status === "accepted" ? "En Route" : activeTrip.status === "arrived" ? "At Pickup" : activeTrip.status === "started" ? "In Progress" : activeTrip.status}
            </span>
          </div>
          <div className="trip-patient-info">
            <div className="trip-patient-avatar">{(activeTrip.patient_name || "P")[0].toUpperCase()}</div>
            <div>
              <div className="name">{activeTrip.patient_name || "Patient"}</div>
              <div className="coords">
                <MapPin size={12} />
                {(activeTrip.patient_lat || activeTrip.lat || 0).toFixed(4)}, {(activeTrip.patient_lng || activeTrip.lng || 0).toFixed(4)}
              </div>
            </div>
          </div>
          <div className="trip-actions">
            {activeTrip.status === "accepted" && (
              <button className="trip-action-btn primary" onClick={() => markArrived(activeTrip.id)}>
                <MapPin size={14} /> Mark Arrived
              </button>
            )}
            {activeTrip.status === "arrived" && (
              <button className="trip-action-btn primary" onClick={() => startTrip(activeTrip.id)}>
                <Navigation size={14} /> Start Trip
              </button>
            )}
            {activeTrip.status === "started" && (
              <button className="trip-action-btn primary" onClick={() => completeTrip(activeTrip.id)}>
                <CheckCircle size={14} /> Complete Trip
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="dash-grid">
        <div className="glass-card">
          <div className="glass-card-title">
            <Inbox size={16} /> Incoming Requests
            {requests.length > 0 && <span className="count-badge">{requests.length}</span>}
          </div>
          {requests.length > 0 ? (
            <div className="request-list">
              {requests.map((r) => {
                const dist = myLocation ? haversine(myLocation.lat, myLocation.lng, r.lat, r.lng) : null;
                const eta = dist ? Math.round((dist / 40) * 60) : null;
                return (
                  <div className="request-card" key={r.id}>
                    <div className="request-header">
                      <span className="request-name">{r.name || "Patient"}</span>
                      <span className="request-time">#{r.id}</span>
                    </div>
                    <div className="request-details">
                      <span><MapPin size={13} /> {r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}</span>
                      {dist !== null && <span><Ruler size={13} /> {dist.toFixed(1)} km</span>}
                      {eta !== null && <span><Timer size={13} /> ~{fmtMins(eta)}</span>}
                    </div>
                    <button className="accept-btn" onClick={() => acceptRequest(r)} disabled={!isOnline || !!pairedPatient || !!activeTrip}>
                      {!isOnline ? "Go Online to Accept" : pairedPatient || activeTrip ? "Complete Current Trip" : "Accept Request"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Inbox size={36} />
              <p>No incoming requests</p>
              <p className="sub">{isOnline ? "Waiting for ride requests…" : "Go online to start receiving"}</p>
            </div>
          )}
        </div>

        <div className="glass-card dash-map-section">
          <div className="glass-card-title"><Navigation size={16} /> Live Map</div>
          <div style={{ position: 'relative' }}>
            <MapContainer
              center={myLocation ? [myLocation.lat, myLocation.lng] : DEFAULT_CENTER}
              zoom={14}
              zoomControl={true}
              style={{ height: 400, width: "100%", borderRadius: 12, border: "1px solid var(--card-border)", zIndex: 10 }}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
            {myLocation && <MapController center={[myLocation.lat, myLocation.lng]} />}
            {myLocation && <Marker position={[myLocation.lat, myLocation.lng]}><Popup>Your Location</Popup></Marker>}
            {pairedPatient?.lat && (
              <>
                <Marker position={[pairedPatient.lat, pairedPatient.lng]}><Popup>Patient</Popup></Marker>
                {myLocation && (
                  <Polyline positions={[[myLocation.lat, myLocation.lng], [pairedPatient.lat, pairedPatient.lng]]} color="#e53935" weight={3} dashArray="6 4" />
                )}
              </>
            )}
            {requests.map((r) => r.lat && r.lng && (
              <Marker key={r.id} position={[r.lat, r.lng]}><Popup>{r.name || "Patient"} (#{r.id})</Popup></Marker>
            ))}
            {nearbyHospitals.map((h, i) => (
              <Marker key={`hosp-${i}`} position={[h.lat, h.lng]} icon={hospitalIcon}>
                <Popup>
                  <strong>{h.name}</strong><br/>
                  {h.type === 'hospital' ? '🏥 Hospital' : '🏨 Clinic'}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => updateLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => addToast("Location denied", "error"), { enableHighAccuracy: true }
                );
              }
            }}
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 1000, width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#4f46e5' }}
            title="Locate me"
          >
            <LocateFixed size={18} />
          </button>
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="dash-bottom-grid">
        <div className="glass-card">
          <div className="glass-card-title"><ClipboardList size={16} /> Recent Trips</div>
          {tripHistory.length > 0 ? (
            <table className="history-table">
              <thead><tr><th>Patient</th><th>Distance</th><th>Fare</th><th>Status</th></tr></thead>
              <tbody>
                {tripHistory.slice(0, 8).map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{t.patient_name || "Patient"}</td>
                    <td>{t.distance_km ? `${parseFloat(t.distance_km).toFixed(1)} km` : "—"}</td>
                    <td>{t.fare ? <span className="fare-badge">NPR {parseFloat(t.fare).toLocaleString()}</span> : "—"}</td>
                    <td><span className={`status-badge-small ${t.status}`}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <ClipboardList size={32} />
              <p>No trip history yet</p>
            </div>
          )}
        </div>

        <div className="glass-card">
          <div className="glass-card-title"><Zap size={16} /> Quick Actions</div>
          <div className="quick-actions">
            <Link to="/settings" className="quick-action-btn"><Settings size={14} /> Settings</Link>
            <button className="quick-action-btn" onClick={() => { fetchStats(); fetchTripHistory(); fetchActiveTrip(); addToast("Dashboard refreshed", "info"); }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="quick-action-btn" onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => { updateLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); addToast("Location updated", "info"); },
                  () => addToast("Location denied", "error"), { enableHighAccuracy: true }
                );
              }
            }}>
              <LocateFixed size={14} /> Location
            </button>
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="glass-card-title"><TrendingUp size={16} /> Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="summary-box">
                <div className="summary-val green">NPR {stats.todayEarnings?.toLocaleString() || 0}</div>
                <div className="summary-lbl">Today</div>
              </div>
              <div className="summary-box">
                <div className="summary-val blue">NPR {stats.totalEarnings?.toLocaleString() || 0}</div>
                <div className="summary-lbl">All Time</div>
              </div>
              <div className="summary-box">
                <div className="summary-val">{stats.todayTrips || 0}</div>
                <div className="summary-lbl">Trips Today</div>
              </div>
              <div className="summary-box">
                <div className="summary-val">{requests.length}</div>
                <div className="summary-lbl">Pending</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toasts.map((t) => <Toast key={t.id} message={t.message} type={t.type} onDone={() => removeToast(t.id)} />)}
      <Chatbot role="driver" />
    </div>
  );
}