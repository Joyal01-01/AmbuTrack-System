// src/Pages/DriverDashboard.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import { socket } from "../socket";
import api from "../api";
import { Link } from "react-router-dom";
import {
  Ambulance, Wallet, Star, Clock, Play, Pause,
  MapPin, Navigation, Ruler, Timer, Inbox, CheckCircle,
  AlertTriangle, Wifi, WifiOff, Settings, RefreshCw,
  LocateFixed, TrendingUp, ClipboardList, Zap, CircleDot,
  Phone, ArrowRight, Info, X, ChevronRight, Activity
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
  }, [center, map]);
  return null;
}

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  const Icon = type === "success" ? CheckCircle : type === "error" ? AlertTriangle : Info;
  return (
    <div className={`toast ${type}`}>
      <Icon size={16} /> {message}
    </div>
  );
}

// Custom Route Component
function RoutingControl({ start, end }) {
  const map = useMap();

  useEffect(() => {
    if (!start || !end || !start.lat || !end.lat) return;
    
    try {
      const routingControl = L.Routing.control({
        waypoints: [
          L.latLng(start.lat, start.lng),
          L.latLng(end.lat, end.lng)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
        show: false,
        createMarker: () => null,
        lineOptions: {
          styles: [{ color: "#3b82f6", weight: 6 }]
        }
      }).addTo(map);

      return () => {
        try { map.removeControl(routingControl); } catch (err) { console.warn(err); }
      };
    } catch(e) {
      console.error(e);
    }
  }, [map, start, end]);

  return null;
}

export default function DriverDashboard() {
  const { t } = useTranslation();
  const location = useLocation();
  const activeTab = useMemo(() => {
    if (location.pathname === "/requests") return "requests";
    if (location.pathname === "/earnings") return "earnings";
    return "overview";
  }, [location.pathname]);
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
  const [isOnline, setIsOnline] = useState(() => localStorage.getItem('driver_online_status') === 'true');
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
  
  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [tripOtp, setTripOtp] = useState("");


  const patientRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const onlineTimerRef = useRef(null);
  const toastIdRef = useRef(0);
  const watchIdRef = useRef(null);

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
    } catch (err) { console.error(err); }
  }, [getUserData]);

  const fetchActiveTrip = useCallback(async () => {
    try {
      const user = getUserData();
      if (!user?.token) return;
      const res = await api.get("/api/driver/active-trip", { headers: { "x-auth-token": user.token } });
      const trip = res.data || null;
      setActiveTrip(trip);
      if (trip && trip.lat && trip.lng) {
        setPairedPatient(prev => ({ ...prev, lat: trip.lat, lng: trip.lng }));
      }
    } catch (err) { console.error(err); }
  }, [getUserData]);

  const fetchTripHistory = useCallback(async () => {
    try {
      const user = getUserData();
      if (!user?.token) return;
      const res = await api.get("/api/driver/trip-history", { headers: { "x-auth-token": user.token } });
      setTripHistory(res.data || []);
    } catch (err) { console.error(err); }
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
      setTimeout(() => setOnlineTime("0h 0m"), 0);
    }
  }, [isOnline, stats.onlineSince]);

  const fetchHospitals = useCallback(async () => {
    if (!myLocation) return;
    try {
      const res = await api.get(`/api/nearby-hospitals?lat=${myLocation.lat}&lng=${myLocation.lng}&radius=50`);
      setNearbyHospitals(res.data || []);
    } catch (err) { console.error(err); }
  }, [myLocation]);

  useEffect(() => {
    Promise.resolve().then(fetchHospitals);
  }, [myLocation, fetchHospitals]);

  // Removed OSRM route fetch in favor of leaflet-routing-machine

  useEffect(() => {
    const user = getUserData();
    if (user?.token) socket.emit("identify", { role: "driver", token: user.token });

    // Auto-re-sync online status on mount/refresh if already online
    if (isOnline && user?.token) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await api.post("/api/driver/online", { lat: pos.coords.latitude, lng: pos.coords.longitude }, { headers: { "x-auth-token": user?.token } });
            fetchStats();
          } catch (err) { console.error(err); }
        }, () => {}, { enableHighAccuracy: true }
      );
    }

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

    async function loadPending() {
      try {
        const res = await api.get("/api/ride-requests");
        const now = Date.now();
        const updated = (res.data || []).map(r => ({ ...r, timestamp: r.timestamp || now }));
        setRequests(updated);
      } catch (err) { console.error(err); }
    }
    loadPending();
    const poll = setInterval(loadPending, 5000);

    // Request expiry timer
    const expiryInterval = setInterval(() => {
      const now = Date.now();
      setRequests(prev => prev.filter(r => !r.timestamp || (now - r.timestamp) < 60000));
    }, 5000);

    Promise.resolve().then(() => { fetchStats(); fetchActiveTrip(); fetchTripHistory(); });
    statsIntervalRef.current = setInterval(() => { fetchStats(); fetchActiveTrip(); }, 15000);

    socket.on("ride_confirmed", (data) => {
      setPairedPatient({ 
        socketId: data.patientSocketId,
        patientContact: data.patientPhone 
      });
      fetchActiveTrip();
      addToast("Ride confirmed! Navigate to patient.", "success");
    });
    socket.on("pair_location", (loc) => {
      if (!loc) return;
      setPairedPatient((prev) =>
        prev && prev.socketId === loc.from ? { ...prev, lat: loc.lat, lng: loc.lng } : prev
      );
    });

    socket.on("medical_note_update", (data) => {
      if (!data) return;
      // Update pending requests list
      setRequests(prev => prev.map(r => r.id == data.requestId ? { ...r, medical_note: data.medicalNote } : r));
      // Update active trip
      setActiveTrip(prev => {
        if (prev && prev.id == data.requestId) {
          addToast(`Medical update from ${data.patientName}`, "info");
          return { ...prev, medical_note: data.medicalNote };
        }
        return prev;
      });
    });

    return () => {
      socket.off("ride_request", onRequest);
      socket.off("ride_confirmed");
      socket.off("pair_location");
      socket.off("medical_note_update");
      clearInterval(poll);
      clearInterval(expiryInterval);
      clearInterval(purgeInterval);
      clearInterval(statsIntervalRef.current);
    };
  }, [addToast, fetchActiveTrip, fetchStats, fetchTripHistory, getUserData, isOnline]);

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

  // Unified Persistent Geolocation Tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      addToast("Geolocation not supported by this browser.", "error");
      return;
    }

    const onLocationSuccess = (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      updateLocation({ lat, lng });

      // Only emit to server/socket if driver is online
      if (isOnline) {
        const user = getUserData();
        socket.emit("sendLocation", { 
          driverId: user?.id || user?.userId || null, 
          lat, 
          lng 
        });
        
        const patient = patientRef.current;
        if (patient?.socketId) {
          socket.emit("pair_location", { 
            toSocketId: patient.socketId, 
            lat, 
            lng 
          });
        }
      }
    };

    const onLocationError = (err) => {
      console.error("Geolocation Error:", err);
      // addToast("Location tracking error", "error");
    };

    const options = {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onLocationSuccess,
      onLocationError,
      options
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isOnline, addToast, getUserData]);

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

  async function cancelTrip(tripId) {
    if (!window.confirm("Are you sure you want to cancel this emergency trip? This should only be done for valid reasons.")) return;
    try {
      const user = getUserData();
      await api.post(`/api/driver/trip/${tripId}/cancel`, {}, { headers: { "x-auth-token": user?.token } });
      addToast("Trip cancelled successfully", "info");
      setActiveTrip(null);
      setPairedPatient(null);
      fetchStats();
    } catch { 
      addToast("Failed to cancel trip", "error"); 
    }
  }

  async function startTrip() {
    setShowOtpModal(true);
  }

  async function submitStartTripOtp() {
    if (!tripOtp || tripOtp.length !== 4) return addToast("Please enter a valid 4-digit OTP", "error");
    try {
      const user = getUserData();
      await api.post(`/api/ride-request/${activeTrip.id}/start-with-otp`, { otp: tripOtp }, { headers: { "x-auth-token": user?.token } });
      addToast("Trip started", "success");
      setShowOtpModal(false);
      setTripOtp("");
      fetchActiveTrip();
    } catch(err) { 
      const msg = err?.response?.data || "Failed to start trip / Invalid OTP";
      addToast(msg, "error"); 
    }
  }

  async function completeTrip(tripId) {
    try {
      const user = getUserData();
      let distanceKm = 0;
      if (myLocation && activeTrip) {
        const pLat = activeTrip.patient_lat || activeTrip.pickup_lat || activeTrip.lat;
        const pLng = activeTrip.patient_lng || activeTrip.pickup_lng || activeTrip.lng;
        if (pLat && pLng) distanceKm = haversine(pLat, pLng, myLocation.lat, myLocation.lng);
      }
      const res = await api.post(`/api/driver/trip/${tripId}/complete`, { distance_km: distanceKm.toFixed(2) }, { headers: { "x-auth-token": user?.token } });
      addToast(`Trip completed! Fare: NPR ${res.data.fare}`, "success");
      setActiveTrip(null); setPairedPatient(null);
      fetchStats(); fetchTripHistory();
    } catch { addToast("Failed to complete trip", "error"); }
  }

  function goOnline() {
    if (isOnline) {
      // Still ensure we are online in localStorage and re-sync if called manually
      localStorage.setItem('driver_online_status', 'true');
      return;
    }
    if (!navigator.geolocation) return addToast("Geolocation not supported", "error");
    setIsOnline(true);
    localStorage.setItem('driver_online_status', 'true');
    const user = getUserData();
    socket.emit("identify", { role: "driver", token: user?.token });
    
    // Immediate server update for presence
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.post("/api/driver/online", { lat: pos.coords.latitude, lng: pos.coords.longitude }, { headers: { "x-auth-token": user?.token } });
          fetchStats();
        } catch (err) { console.error(err); }
      }, () => {}, { enableHighAccuracy: true }
    );
    
    addToast("You are now online", "success");
  }

  function goOffline() {
    setIsOnline(false);
    localStorage.setItem('driver_online_status', 'false');
    const user = getUserData();
    try { api.post("/api/driver/offline", {}, { headers: { "x-auth-token": user?.token } }); } catch (err) { console.warn(err); }
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
              <span>{isOnline ? t('status_online') : t('status_offline')}</span>
              {isOnline && <span className="online-timer">· {onlineTime}</span>}
            </div>
          </div>
        </div>
        <button className={`toggle-btn ${isOnline ? "go-offline" : "go-online"}`} onClick={isOnline ? goOffline : goOnline}>
          {isOnline ? <><Pause size={15} /> {t('btn_go_offline')}</> : <><Play size={15} /> {t('btn_go_online')}</>}
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon-wrap red"><Ambulance size={18} /></div>
          <div className="stat-val">{stats.totalTrips}</div>
          <div className="stat-lbl">{t('stat_total_trips')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap green"><Wallet size={18} /></div>
          <div className="stat-val">NPR {stats.todayEarnings?.toLocaleString() || 0}</div>
          <div className="stat-lbl">{t('stat_today_earnings')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap yellow"><Star size={18} /></div>
          <div className="stat-val">{stats.rating?.toFixed(1) || "5.0"}</div>
          <div className="stat-lbl">{t('stat_rating')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrap blue"><Clock size={18} /></div>
          <div className="stat-val">{isOnline ? onlineTime : "—"}</div>
          <div className="stat-lbl">{t('stat_online_time')}</div>
        </div>
      </div>

      {/* Dashboard Overview - only show if on overview tab */}
      {(activeTab === "overview" || activeTab === "requests") && (
        <div className={`glass-card active-trip-panel ${activeTrip ? "visible" : "hidden"}`}>
          {activeTrip ? (
            <>
              <div className="glass-card-title">
                <CircleDot size={16} style={{ color: "var(--accent)" }} /> {t('panel_active_trip')}
                <span className={`trip-status-badge ${activeTrip.status}`}>
                  {activeTrip.status === "accepted" ? t('status_accepted') : activeTrip.status === "arrived" ? t('btn_arrived') : activeTrip.status === "started" ? t('status_started') : activeTrip.status}
                </span>
              </div>
              <div className="trip-patient-info">
                <div className="trip-patient-avatar">{(activeTrip.patient_name || "P")[0].toUpperCase()}</div>
                <div>
                  <div className="name">{activeTrip.patient_name || "Patient"}</div>
                  <div className="coords">
                    <MapPin size={12} />
                    {(activeTrip.patient_lat || activeTrip.pickup_lat || activeTrip.lat || 0).toFixed(4)}, {(activeTrip.patient_lng || activeTrip.pickup_lng || activeTrip.lng || 0).toFixed(4)}
                  </div>
                  {(pairedPatient?.patientContact || activeTrip.patient_phone) && (
                    <a href={`tel:${pairedPatient?.patientContact || activeTrip.patient_phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, color: '#3b82f6', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                      <Phone size={14} /> Call {pairedPatient?.patientContact || activeTrip.patient_phone}
                    </a>
                  )}
                </div>
              </div>
              {activeTrip.medical_note && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '12px 14px', margin: '0 20px 16px', borderRadius: '0 8px 8px 0', fontSize: '0.85rem' }}>
                  <div style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><Activity size={14} /> Emergency Details</div>
                  <div style={{ color: 'var(--text)', lineHeight: 1.4 }}>{activeTrip.medical_note}</div>
                </div>
              )}
              <div className="trip-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                {activeTrip.status === "accepted" && (
                  <button className="trip-action-btn primary" onClick={() => markArrived(activeTrip.id)}>
                    <MapPin size={14} /> {t('btn_arrived')}
                  </button>
                )}
                {activeTrip.status === "arrived" && (
                  <button className="trip-action-btn primary" onClick={startTrip} style={{ gridColumn: '1 / -1' }}>
                    <Navigation size={14} /> {t('btn_start_trip')}
                  </button>
                )}
                {activeTrip.status === "started" && (
                  <button className="trip-action-btn primary" onClick={() => completeTrip(activeTrip.id)} style={{ gridColumn: '1 / -1' }}>
                    <CheckCircle size={14} /> {t('btn_end_trip')}
                  </button>
                )}
                {(activeTrip.status === "accepted" || activeTrip.status === "arrived") && (
                  <>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${activeTrip.patient_lat || activeTrip.pickup_lat || activeTrip.lat},${activeTrip.patient_lng || activeTrip.pickup_lng || activeTrip.lng}`} target="_blank" rel="noopener noreferrer" className="trip-action-btn" style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Navigation size={14} color="#3b82f6" /> Navigate
                    </a>
                    <button className="trip-action-btn" onClick={() => cancelTrip(activeTrip.id)} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}>
                      <X size={14} /> Cancel
                    </button>
                  </>
                )}
              </div>
            </>
          ) : activeTab === "requests" ? (
             <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>
               <Inbox size={32} style={{ marginBottom: 10, opacity: 0.5 }} />
               <p>No active trip. Accept a request below.</p>
             </div>
          ) : null}
        </div>
      )}

      {/* Main Content Sections */}
      <div className="dash-sections">
        {activeTab !== "earnings" && (
          <div className="dash-grid">
            <div className="glass-card">
              <div className="glass-card-title">
                <Inbox size={16} /> {t('panel_requests')}
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
                        {r.medical_note && (
                          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '6px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                            <Activity size={12} /> Medical Info Available
                          </div>
                        )}
                        <button className="accept-btn" onClick={() => acceptRequest(r)} disabled={!isOnline || !!pairedPatient || !!activeTrip}>
                          {!isOnline ? t('btn_go_online') : pairedPatient || activeTrip ? t('panel_active_trip') : t('btn_accept')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <Inbox size={36} />
                  <p>{t('panel_requests')}</p>
                  <p className="sub">{isOnline ? t('status_online') : t('status_offline')}</p>
                </div>
              )}
            </div>

            <div className="glass-card dash-map-section">
              <div className="glass-card-title"><Navigation size={16} /> {t('panel_map')}</div>
              <div style={{ position: 'relative' }}>
                <MapContainer
                  center={myLocation ? [myLocation.lat, myLocation.lng] : DEFAULT_CENTER}
                  zoom={14}
                  zoomControl={true}
                  style={{ height: 400, width: "100%", borderRadius: 12, border: "1px solid var(--card-border)", zIndex: 10 }}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
                  {myLocation && <MapController center={[myLocation.lat, myLocation.lng]} />}
                  {myLocation && <Marker position={[myLocation.lat, myLocation.lng]}><Popup>{t('nav_home')}</Popup></Marker>}
                  {pairedPatient?.lat && (
                    <>
                      <Marker position={[pairedPatient.lat, pairedPatient.lng]}><Popup>Patient</Popup></Marker>
                      {myLocation && (
                        <RoutingControl 
                          start={myLocation} 
                          end={{ lat: pairedPatient.lat, lng: pairedPatient.lng }} 
                        />
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
                  style={{ position: 'absolute', top: 16, right: 16, zIndex: 1000, width: 40, height: 40, borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: 'var(--primary)' }}
                  title="Locate me"
                >
                  <LocateFixed size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History / Earnings Section */}
        {activeTab !== "requests" && (
          <div className="dash-bottom-grid">
            <div className="glass-card">
              <div className="glass-card-title"><ClipboardList size={16} /> {t('panel_history')}</div>
              {tripHistory.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="history-table">
                    <thead><tr><th>{t('reg_role_patient')}</th><th>{t('feat_realtime')}</th><th>{t('nav_wallet')}</th><th>{t('tab_verif')}</th></tr></thead>
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
                </div>
              ) : (
                <div className="empty-state">
                  <ClipboardList size={32} />
                  <p>{t('panel_history')}</p>
                </div>
              )}
            </div>

            <div className="glass-card">
              {activeTab === "overview" && (
                <>
                  <div className="glass-card-title"><Zap size={16} /> {t('panel_actions')}</div>
                  <div className="quick-actions">
                    <Link to="/settings" className="quick-action-btn"><Settings size={14} /> {t('settings_title')}</Link>
                    <button className="quick-action-btn" onClick={() => { fetchStats(); fetchTripHistory(); fetchActiveTrip(); addToast("Dashboard refreshed", "info"); }}>
                      <RefreshCw size={14} /> {t('btn_update_pass')}
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
                </>
              )}

              <div style={{ marginTop: activeTab === "overview" ? 20 : 0 }}>
                <div className="glass-card-title"><TrendingUp size={16} /> {activeTab === "earnings" ? t('stat_today_earnings') : t('tab_reports')}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="summary-box">
                    <div className="summary-val green">NPR {stats.todayEarnings?.toLocaleString() || 0}</div>
                    <div className="summary-lbl">{t('stat_today_earnings')}</div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-val blue">NPR {stats.totalEarnings?.toLocaleString() || 0}</div>
                    <div className="summary-lbl">{t('stat_total_trips')}</div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-val">{stats.todayTrips || 0}</div>
                    <div className="summary-lbl">{t('stat_today_earnings')}</div>
                  </div>
                  <div className="summary-box">
                    <div className="summary-val">{requests.length}</div>
                    <div className="summary-lbl">{t('panel_requests')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {toasts.map((t) => <Toast key={t.id} message={t.message} type={t.type} onDone={() => removeToast(t.id)} />)}
      
      {/* OTP Modal */}
      {showOtpModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card-bg)', width: '100%', maxWidth: 350, borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideUp 0.3s ease-out' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', color: 'var(--text)', fontWeight: 800 }}>Start Trip</h2>
            <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: '0.95rem' }}>Ask the patient for their 4-digit ride OTP to formally begin the trip.</p>
            <input 
              type="text" 
              maxLength="4" 
              placeholder="0000"
              value={tripOtp}
              onChange={(e) => setTripOtp(e.target.value.replace(/\D/g, ''))}
              style={{ width: '100%', padding: '16px', fontSize: '2rem', textAlign: 'center', letterSpacing: '8px', fontWeight: 800, background: 'var(--background)', color: 'var(--text)', border: '2px solid var(--border)', borderRadius: 12, marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => { setShowOtpModal(false); setTripOtp(""); }} 
                style={{ flex: 1, padding: '14px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
              >Cancel</button>
              <button 
                onClick={submitStartTripOtp} 
                className="pulse"
                style={{ flex: 1, padding: '14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', opacity: tripOtp.length === 4 ? 1 : 0.5 }}
                disabled={tripOtp.length !== 4}
              >Verify & Start</button>
            </div>
          </div>
        </div>
      )}

      <Chatbot role="driver" />
    </div>
  );
}