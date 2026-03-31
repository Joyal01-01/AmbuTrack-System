import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation } from "react-router-dom";
import { socket } from "../socket";
import api from "../api";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Ambulance, MapPin, Navigation, Clock, CreditCard, CheckCircle, ShieldAlert, Phone, LocateFixed, Building2, Share2 } from 'lucide-react';
import '../Pages/DriverDashboard.css';
import Chatbot from '../component/Chatbot';
import NearbyHospitals from '../component/NearbyHospitals';
import NearbyAmbulances from '../component/NearbyAmbulances';
import 'leaflet-routing-machine';

// Fix typical Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const patientIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
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

// Component to dynamically set map view
function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

// Distance Calculation Helper (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Custom Route Component with persistent instance
function RoutingControl({ start, end, color = "#ef4444" }) {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!map || !start || !end || !start.lat || !end.lat) return;

    try {
      const waypoints = [
        L.latLng(parseFloat(start.lat), parseFloat(start.lng)),
        L.latLng(parseFloat(end.lat), parseFloat(end.lng))
      ];

      if (routingRef.current) {
        // Update waypoints directly without recreating the whole control
        routingRef.current.setWaypoints(waypoints);
      } else {
        // Initial creation
        routingRef.current = L.Routing.control({
          waypoints,
          routeWhileDragging: false,
          addWaypoints: false,
          fitSelectedRoutes: false,
          showAlternatives: false,
          show: false,
          createMarker: () => null,
          lineOptions: {
            styles: [{ color, weight: 6, opacity: 0.8 }]
          }
        }).addTo(map);
      }
    } catch (e) {
      console.error('Routing error:', e);
    }

    return () => {
      // Logic for cleanup handled by parent if needed, but normally handled on unmount
    };
  }, [map, start.lat, start.lng, end.lat, end.lng, color]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle unmount cleanup separately to be safe
  useEffect(() => {
    return () => {
      if (routingRef.current && map) {
        try { map.removeControl(routingRef.current); } catch { /* ignore */ }
      }
    };
  }, [map]);

  return null;
}

export default function PatientDashboard() {
  const { t } = useTranslation();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [myLocation, setMyLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('last_patient_location');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const updateLocation = (loc) => {
    setMyLocation(loc);
    localStorage.setItem('last_patient_location', JSON.stringify(loc));
  };
  const [activeAmbulances, setActiveAmbulances] = useState([]);
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const mapRef = useRef(null);
  
  // Booking State
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [requestStatus, setRequestStatus] = useState("idle"); // idle, searching, accepted, arrived, started, completed, paying
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [rating, setRating] = useState(5);
  const [notification, setNotification] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [requestId, setRequestId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [medicalNote, setMedicalNote] = useState("");
  const [showMedicalModal, setShowMedicalModal] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isSOSLoading, setIsSOSLoading] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null); // New state for destination
  
  // Real-time Interaction
  const [rideOtp, setRideOtp] = useState(null);
  const [driverContact, setDriverContact] = useState(null);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 4000);
  };

  

  useEffect(() => {
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : null;
    if (!u || u.role !== 'patient') {
      window.location.href = '/login';
      return;
    }
    setUser(u);

    // Get exact location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => updateLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          console.log('Location access not granted yet.');
          // Fallback to Kathmandu for demo
          updateLocation({ lat: 27.7172, lng: 85.3240 });
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      updateLocation({ lat: 27.7172, lng: 85.3240 });
    }

    // Connect Socket Auth
    socket.emit("identify", { token: u.token });

    // Socket Listeners
    socket.on('ride_accepted', (data) => {
      setRequestStatus("accepted");
      if (data.driver) setSelectedDriver(data.driver);
      if (data.driverPhone) setDriverContact(data.driverPhone);
      showToast(`${data.driverName || data.driver?.name || 'A driver'} accepted your request!`);
    });

   socket.on('trip_updated', (data) => {
  console.log("Trip update received:", data);

  // ✅ Always sync full status (fixes mismatch issue)
  if (data.status) {
    setRequestStatus(data.status);
  }
  // Restore OTP if backend sends it with the status update
  if (data.otp) {
    setRideOtp(data.otp);
  }
});

    socket.on('trip_completed', (data) => {
      setRequestStatus('completed');
      setActiveTrip({ id: data.id, fare: data.fare, distance: data.distance });
      setPaymentComplete(false);
      setRating(5);
      setShowPaymentModal(true);
    });

    socket.on('driver_location_update', (data) => {
      // Update specific driver location on map if trailing them
      setActiveAmbulances(prev => prev.map(d => d.driver_user_id === data.userId ? { ...d, lat: data.lat, lng: data.lng } : d));
      setSelectedDriver(prev => {
        if (prev && prev.driver_user_id === data.userId) {
          return { ...prev, lat: data.lat, lng: data.lng };
        }
        return prev;
      });
    });

    socket.on('driver_offline', (data) => {
      const offlineId = data.driverId || data.userId;
      setActiveAmbulances(prev => prev.filter(d => d.driver_user_id !== offlineId && d.driver_id !== offlineId));
      setSelectedDriver(prev => (prev && (prev.driver_user_id === offlineId || prev.driver_id === offlineId)) ? null : prev);
    });

    socket.on('ride_destination_updated', (data) => {
      console.log("Real-time destination update:", data);
      setSelectedHospital({ lat: data.lat, lng: data.lng, name: data.name });
      showToast(`Driver set destination to ${data.name}`);
    });

    fetchDrivers(u.token);
    // Poll drivers every 15s
    const pollId = setInterval(() => fetchDrivers(u.token), 15000);

    // Fetch nearby hospitals
    fetchHospitals();

    // RESTORE ACTIVE STATE
    const fetchActiveState = async () => {
      try {
        const res = await api.get('/api/patient/active-trip', { headers: { 'x-auth-token': u.token } });
        if (res.data) {
          const trip = res.data;
          setRequestId(trip.id);
          setRequestStatus(trip.status);
          if (trip.status === 'accepted') {
          // accepted state restored; UI will reflect 'accepted' status
          }
          if (trip.status === 'completed') {
            // Need to ensure fare and distance are set for the modal
            setActiveTrip({
              id: trip.id,
              fare: trip.fare || 100 + ( (trip.distance_km || 0) * 30 ), // fallback calculation
              distance: trip.distance_km || 0
            });
            setShowPaymentModal(true);
          } else if (['accepted', 'arrived', 'started'].includes(trip.status)) {
            // Restore OTP so it stays visible even after page reload or arrived event
            if (trip.otp) setRideOtp(trip.otp);
            // If we have an active driver, we might want to fetch their info too
            if (trip.accepted_by || trip.requested_driver_id) {
               // Optional: fetch driver details if needed for UI persistence
            }
          }
        }
      } catch (err) {
        console.error("Failed to restore active state", err);
      }
    };
    fetchActiveState();

    return () => {
      socket.off('ride_accepted');
      socket.off('trip_updated');
      socket.off('trip_completed');
      socket.off('driver_location_update');
      socket.off('driver_offline');
      socket.off('ride_destination_updated');
      clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request Timeout Timer
  useEffect(() => {
    let timer;
    if (requestStatus === 'searching' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && requestStatus === 'searching') {
      handleRequestTimeout();
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestStatus, timeLeft]);

  const handleRequestTimeout = async () => {
    if (!requestId) return;
    try {
      await api.post(`/api/ride-request/${requestId}/cancel`);
      setRequestStatus("idle");
      setRequestId(null);
      setShowTimeoutModal(true);
      showToast("Request timed out after 1 minute");
    } catch (err) {
      console.error("Timeout cancellation failed:", err);
      setRequestStatus("idle");
    }
  };

  const fetchDrivers = async (token) => {
    try {
      const res = await api.get('/api/patient/drivers', { headers: { 'x-auth-token': token } });
      setActiveAmbulances(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWallet = async () => {
    try {
      const res = await api.get('/api/user/wallet', { headers: { 'x-auth-token': user.token } });
      setWalletBalance(res.data.balance);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHospitals = async () => {
    const loc = myLocation || { lat: 27.7172, lng: 85.3240 };
    try {
      const res = await api.get(`/api/nearby-hospitals?lat=${loc.lat}&lng=${loc.lng}&radius=50`);
      setNearbyHospitals(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (myLocation) fetchHospitals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLocation]);

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          updateLocation(loc);
          if (mapRef.current) mapRef.current.setView([loc.lat, loc.lng], 14);
        },
        () => showToast('Could not get your location'),
        { enableHighAccuracy: true }
      );
    }
  };

  const handleViewHospitalOnMap = (lat, lng, name) => {
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 16);
      showToast(`Viewing: ${name}`);
    }
  };

  // 1. Send Request to a specific driver or broadcast
  const handleRequestAmbulance = async () => {
    if (!myLocation) return showToast('Waiting for your location...');
    
    setRequestStatus("searching");
    showToast("Requesting ambulance...");

    try {
      const payload = {
        lat: myLocation.lat,
        lng: myLocation.lng,
        driver_user_id: selectedDriver ? selectedDriver.driver_user_id : null,
        destination_lat: selectedHospital ? selectedHospital.lat : null,
        destination_lng: selectedHospital ? selectedHospital.lng : null,
        hospital_name: selectedHospital ? selectedHospital.name : null
      };
      
      const res = await api.post('/api/ride-request', payload, { headers: { 'x-auth-token': user.token } });
      setRequestId(res.data.id);
      if (res.data.otp) setRideOtp(res.data.otp);
      setTimeLeft(60); // 1 minute timeout
      setShowMedicalModal(true); // Open medical details modal after booking
      if (selectedDriver) {
        showToast(`Request sent securely to ${selectedDriver.name}`);
      } else {
        showToast(`Request broadcasted to nearby ambulances`);
      }
    } catch (err) {
      setRequestStatus("idle");
      showToast(err.response?.data || "Failed to request ambulance");
    }
  };

  const handleSOS = () => {
    if (!myLocation) return showToast('Waiting for location...');
    setShowSOSModal(true);
  };

  const confirmSOS = async () => {
    setShowSOSModal(false);
    setIsSOSLoading(true);
    try {
      await api.post('/api/sos', { lat: myLocation.lat, lng: myLocation.lng, message: 'CRITICAL EMERGENCY' }, { headers: { 'x-auth-token': user.token } });
      showToast('🆘 EMERGENCY ALERT SENT. Help is on the way.');
      if (requestStatus === 'idle') handleRequestAmbulance();
    } catch (e) {
      showToast('Failed to send SOS: ' + (e.response?.data?.error || e.message));
    } finally {
      setIsSOSLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!requestId) return;
    try {
      await api.post(`/api/ride-request/${requestId}/cancel`);
      setRequestStatus("idle");
      setRequestId(null);
      setRideOtp(null);
      setDriverContact(null);
      setTimeLeft(0);
      showToast("Ride Cancelled");
    } catch (err) {
      console.error('Cancel failed', err);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err.message;
      if (status === 409) {
        showToast(serverMsg || 'Unable to cancel ride (already in progress)');
        if (err.response?.data?.status) setRequestStatus(err.response.data.status);
        return;
      }
      showToast('Failed to cancel request: ' + (serverMsg || 'Unknown error'));
    }
  };

  const handleShareTrip = async () => {
    if (navigator.share && selectedDriver) {
      try {
        await navigator.share({
          title: 'Track My AmbuTrack Ride',
          text: `I'm currently being picked up by an AmbuTrack ambulance. Driver: ${(selectedDriver?.name || 'Assigned Driver')}, Contact: ${driverContact || 'N/A'}.`,
          url: window.location.href
        });
      } catch (err) {
        console.log("Share failed:", err);
      }
    } else {
      showToast("Native sharing not supported on this device/browser");
    }
  };

  const handlePayFare = async (method) => {
    try {
      if (method === 'esewa') {
        const transaction_uuid = `trip_${activeTrip.id}_${Date.now()}`;
        const res = await api.post('/api/payment/esewa/signature', { amount: activeTrip.fare, transaction_uuid });
        const { signature, signed_field_names, product_code } = res.data;

        // Create standard eSewa form and submit
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';

        const fields = {
          amount: activeTrip.fare,
          tax_amount: 0,
          total_amount: activeTrip.fare,
          transaction_uuid,
          product_code,
          product_service_charge: 0,
          product_delivery_charge: 0,
          success_url: `${window.location.origin}/dashboard?status=success`,
          failure_url: `${window.location.origin}/dashboard?status=failure`,
          signed_field_names,
          signature
        };

        for (const [key, val] of Object.entries(fields)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = val;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        
        // Actually mark as paid in DB as well before redirecting
        await api.post(`/api/ride-request/${activeTrip.id}/pay`, { method, amount: activeTrip.fare }, { headers: { 'x-auth-token': user.token } });
        return;
      }

      await api.post(`/api/ride-request/${activeTrip.id}/pay`, { method, amount: activeTrip.fare }, { headers: { 'x-auth-token': user.token } });
      setPaymentComplete(true);
      fetchWallet();
    } catch (e) {
      showToast(e.response?.data?.error || e.response?.data || "Payment Failed");
    }
  };

  const handleRateDriver = async () => {
    try {
      const targetDriverId = selectedDriver?.driver_user_id || selectedDriver?.id;
      if (targetDriverId) {
        await api.post('/api/driver/rate', { driverId: targetDriverId, rating }, { headers: { 'x-auth-token': user.token } });
      }
      showToast('Thank you for your feedback!');
    } catch (e) {
      console.error(e);
    }
    setShowPaymentModal(false);
    setRequestStatus("idle");
    setSelectedDriver(null);
    setActiveTrip(null);
  };

  // Determine which view to render based on route
  const pathname = location?.pathname || '';
  let view;

  // --- WALLET VIEW ---
  const [transactions, setTransactions] = useState([]);
  const [isTopupLoading, setIsTopupLoading] = useState(false);

  const fetchWalletHistory = async (u) => {
    try {
      const res = await api.get('/api/wallet/history', { headers: { 'x-auth-token': u.token } });
      setTransactions(res.data);
    } catch (e) { console.error("History Error:", e); }
  };

  useEffect(() => {
    if (user && pathname.includes('/wallet')) {
      fetchWalletHistory(user);
    }
  }, [user, pathname]);

  const handleTopup = async (amt) => {
    setIsTopupLoading(true);
    try {
      await api.post('/api/wallet/topup', { amount: amt, method: 'eSewa', description: 'Manual Top-up' }, { headers: { 'x-auth-token': user.token } });
      showToast(`Successfully added NPR ${amt} to your wallet!`);
      fetchWallet();
      fetchWalletHistory(user);
    } catch {
      showToast("Top-up failed");
    } finally {
      setIsTopupLoading(false);
    }
  };

  const WalletView = (
    <div style={{ padding: '24px var(--container-padding)', maxWidth: 'var(--container-max)', margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'var(--text)' }}>My Wallet</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>Manage your funds and view payment history</p>
        </div>
        <button onClick={fetchWallet} style={{ padding: '10px 18px', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <Clock size={18} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 32 }}>
        {/* Balance Card Section */}
        <div>
          <div style={{ 
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', 
            borderRadius: 24, padding: 32, color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: '0 20px 40px -10px rgba(79, 70, 229, 0.4)', marginBottom: 24
          }}>
            {/* Decorative circles */}
            <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', bottom: -40, left: -20, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '0.9rem', opacity: 0.8, fontWeight: 500, marginBottom: 8, letterSpacing: '0.5px' }}>AVAILABLE BALANCE</div>
              <div style={{ fontSize: '2.8rem', fontWeight: 800, marginBottom: 32 }}>NPR {Number(walletBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: 4 }}>CARD HOLDER</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase' }}>{user?.name || 'Valued Patient'}</div>
                </div>
                <div style={{ width: 48, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: 6 }} />
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem' }}>Top Up Wallet</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[500, 1000, 2000, 5000].map(amt => (
                <button 
                  key={amt} 
                  onClick={() => handleTopup(amt)}
                  disabled={isTopupLoading}
                  style={{ padding: '14px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseOver={e => e.target.style.borderColor = '#4f46e5'}
                  onMouseOut={e => e.target.style.borderColor = 'var(--border)'}
                >+ NPR {amt}</button>
              ))}
            </div>
            <button 
              disabled={isTopupLoading}
              onClick={() => handleTopup(2500)} // Custom simulation
              style={{ width: '100%', padding: '16px', background: '#60bb46', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
              <img src="https://esewa.com.np/common/images/esewa_logo.png" alt="eSewa" style={{ height: 20 }} /> 
              {isTopupLoading ? 'Processing...' : 'Add Funds with eSewa'}
            </button>
          </div>
        </div>

        {/* Transaction History Section */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 24, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="dashboard-header" style={{ padding: '16px var(--container-padding)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{t('nav_wallet')}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', background: 'var(--background)', padding: '4px 10px', borderRadius: 20 }}>{t('panel_history')}</span>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
            {transactions.length > 0 ? transactions.map((tx, i) => (
              <div key={tx.id} style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', 
                borderBottom: i === transactions.length - 1 ? 'none' : '1px solid var(--border)',
                animation: `slideUp 0.3s ease-out ${i * 0.05}s both`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ 
                    width: 44, height: 44, borderRadius: 12, 
                    background: tx.type === 'credit' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: tx.type === 'credit' ? '#22c55e' : '#ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {tx.type === 'credit' ? <CheckCircle size={20} /> : <CreditCard size={20} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem' }}>{tx.description}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{new Date(tx.created_at).toLocaleDateString()} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontWeight: 700, fontSize: '1rem', 
                    color: tx.type === 'credit' ? '#22c55e' : 'var(--text)' 
                  }}>
                    {tx.type === 'credit' ? '+' : '-'} NPR {Number(tx.amount).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{tx.type === 'credit' ? 'Received' : 'Spent'}</div>
                </div>
              </div>
            )) : (
              <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                <CreditCard size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                <p>No transactions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Home hero
  const HomeHero = (
    <div style={{ background: 'var(--background)', minHeight: 'calc(100vh - 70px)', display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center', width: '100%',
        maxWidth: 'var(--container-max)', margin: '0 auto', padding: '60px var(--container-padding)'
      }}>
        {/* Left: Copy */}
        <div style={{ color: 'var(--text)', animation: 'fadeInLeft 0.8s ease-out' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '8px 18px', borderRadius: 100, fontSize: '0.85rem', fontWeight: 700, marginBottom: 28, letterSpacing: '0.5px' }}>
            <ShieldAlert size={16} /> {t('hero_tag')}
          </div>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 3.8rem)', margin: 0, lineHeight: 1.08, fontWeight: 900, letterSpacing: '-1.5px', color: 'var(--text)' }}>
            {t('hero_title').split('Ambulance')[0]}<span style={{ color: '#ef4444' }}>Ambulance</span>{t('hero_title').split('Ambulance')[1]}
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: 24, fontSize: '1.1rem', lineHeight: 1.7, maxWidth: 500 }}>
            {t('hero_subtitle')}
          </p>

          <div style={{ display: 'flex', gap: 16, marginTop: 32, flexWrap: 'wrap' }}>
            <a href="/nearby" style={{ padding: '16px 36px', background: '#ef4444', color: '#fff', borderRadius: 14, fontWeight: 700, textDecoration: 'none', fontSize: '1rem', boxShadow: '0 10px 30px -5px rgba(239,68,68,0.45)', transition: 'all 0.2s', display: 'inline-block' }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'none'}
            >🚑 {t('btn_book_amb')}</a>
            <button onClick={() => setShowSOSModal(true)} style={{ padding: '16px 36px', background: 'var(--card-bg)', border: '2px solid #ef4444', color: '#ef4444', borderRadius: 14, fontWeight: 700, fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onMouseOver={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'var(--card-bg)'; e.currentTarget.style.color = '#ef4444'; }}
            ><ShieldAlert size={18}/> Emergency SOS</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 40 }}>
            {[
              { label: t('feat_drivers'), sub: t('feat_verified'), icon: <CheckCircle size={20} /> },
              { label: t('feat_realtime'), sub: t('feat_tracking'), icon: <Navigation size={20} /> },
              { label: t('feat_cashless'), sub: t('feat_payments'), icon: <CreditCard size={20} /> }
            ].map((f, i) => (
              <div key={i} style={{ background: 'var(--card-bg)', padding: 18, borderRadius: 16, border: '1px solid var(--border)', transition: 'transform 0.2s' }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'none'}
              >
                <div style={{ color: '#ef4444', marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)', marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{f.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Ambulance Image */}
        <div style={{ position: 'relative', height: 520, borderRadius: 32, overflow: 'hidden', animation: 'fadeInRight 0.8s ease-out', boxShadow: '0 40px 80px -20px rgba(239,68,68,0.2)' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(79,70,229,0.08) 100%)' }} />
          <img
            src="/ambulance-logo.png"
            alt="Ambulance"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&q=80'; }}
          />
          {/* Floating badge */}
          <div style={{ position: 'absolute', bottom: 32, left: 32, right: 32, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.25)' }} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{activeAmbulances.length} {t('active_vehicles')}</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{t('feat_realtime')}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const BookingView = (
    <div className="booking-view" style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 400px) 1fr', height: 'calc(100vh - 220px)', overflow: 'hidden', background: 'var(--background)' }}>
      <div style={{ background: 'var(--card-bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', overflowY: 'auto' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text)', fontWeight: 800 }}>Need an Ambulance?</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>Select an available ambulance from the map to view pricing and book immediately.</p>
        </div>
        <div style={{ padding: 24, flex: 1 }}>
          {requestStatus !== 'idle' && (
            <div style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: requestStatus === 'searching' ? 'rgba(217, 119, 6, 0.1)' : requestStatus === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(79, 70, 229, 0.1)', color: requestStatus === 'searching' ? '#d97706' : requestStatus === 'completed' ? '#22c55e' : '#4f46e5' }}>
                  {requestStatus === 'searching' ? <Navigation size={20} className="pulse" /> : requestStatus === 'completed' ? <CheckCircle size={20} /> : <Ambulance size={20} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>{requestStatus === 'searching' ? 'Finding Ambulance...' : requestStatus === 'accepted' ? 'Driver is on the way!' : requestStatus === 'arrived' ? 'Driver has arrived at your location' : requestStatus === 'started' ? 'Trip in progress' : 'Trip Completed'}</h3>
                  <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>{requestStatus === 'searching' ? 'Waiting for driver to accept' : requestStatus === 'accepted' ? 'Please be ready' : requestStatus === 'arrived' ? 'Please securely board the vehicle' : requestStatus === 'started' ? 'Heading safely to your destination' : 'Please complete your payment'}</p>
                </div>
              </div>
              
              {/* Interaction Block for Contact & OTP */}
              {(requestStatus === 'accepted' || requestStatus === 'arrived') && (
                <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {driverContact && (
                    <div style={{ textAlign: 'center', padding: '8px', background: '#f8fafc', borderRadius: 8 }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Driver Contact</div>
                      <a href={`tel:${driverContact}`} style={{ color: '#0f172a', fontWeight: 800, fontSize: '1rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Phone size={14} color="#4f46e5" /> {driverContact}
                      </a>
                    </div>
                  )}
                  {rideOtp && (
                     <div style={{ textAlign: 'center', padding: '8px', background: '#f0fdfa', borderRadius: 8, border: '1px solid #ccfbf1' }}>
                       <div style={{ fontSize: '0.75rem', color: '#115e59', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Provide OTP to Driver</div>
                       <div style={{ color: '#0f766e', fontWeight: 900, fontSize: '1.3rem', letterSpacing: '2px' }}>{rideOtp}</div>
                     </div>
                  )}
                </div>
              )}
              
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
                <div style={{ height: '100%', background: '#4f46e5', borderRadius: 6, transition: 'width 1s linear', width: `${(timeLeft / 60) * 100}%` }} />
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginTop: 4 }}>Expires in {timeLeft}s</div>
              {requestStatus === 'searching' && <button onClick={handleCancelRequest} style={{ width: '100%', marginTop: 16, padding: 12, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel Request</button>}
              
              {(requestStatus === 'accepted' || requestStatus === 'arrived') && (
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <button onClick={handleCancelRequest} style={{ flex: 1, padding: 12, background: '#fff', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cancel Ride</button>
                  <button onClick={handleShareTrip} style={{ flex: 1, padding: 12, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Share2 size={16} /> Share Trip</button>
                </div>
              )}
            </div>
          )}

          {/* If no driver selected yet: show primary Request button */}
          {requestStatus === 'idle' && !selectedDriver && (
            <div style={{ padding: 20, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--text)' }}>Ready to request an ambulance?</h3>
              <p style={{ margin: '8px 0 12px', color: 'var(--muted)' }}>Press Request Ambulance to broadcast to nearby vehicles.</p>
              <button onClick={handleRequestAmbulance} style={{ padding: '12px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Request Ambulance</button>
            </div>
          )}

          {requestStatus === 'idle' && selectedDriver && (
            <div style={{ animation: 'slideUp 0.3s ease-out' }}>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--primary-soft)', borderRadius: 16, padding: 20, boxShadow: '0 4px 20px rgba(79, 70, 229, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>{selectedDriver.name}</h3>
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600 }}>⭐ {selectedDriver.rating || '5.0'}</div>
                    </div>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><Ambulance size={14} /> {selectedDriver.vehicle_name || 'Standard Ambulance'} ({selectedDriver.vehicle_type || 'A'})</p>
                  </div>
                </div>
                {myLocation && (
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 10, display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Distance Away</div>
                      <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '1.1rem' }}>{calculateDistance(myLocation.lat, myLocation.lng, selectedDriver.lat, selectedDriver.lng).toFixed(1)} km</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>ETA</div>
                      <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '1.1rem' }}>{Math.max(2, Math.round(calculateDistance(myLocation.lat, myLocation.lng, selectedDriver.lat, selectedDriver.lng) * 2))} mins</div>
                    </div>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: '#64748b', fontSize: '0.9rem' }}>Base Fare</span><span style={{ color: '#0f172a', fontWeight: 600 }}>NPR {selectedDriver.base_fare || 100}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b', fontSize: '0.9rem' }}>Per Km Rate</span><span style={{ color: '#0f172a', fontWeight: 600 }}>NPR {selectedDriver.per_km_rate || 30}/km</span></div>
                </div>
                <button onClick={handleRequestAmbulance} style={{ width: '100%', padding: 14, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Navigation size={18} /> Book This Ambulance</button>
              </div>
            </div>
          )}

          {requestStatus === 'idle' && <NearbyAmbulances ambulances={activeAmbulances} myLocation={myLocation} onSelect={(d) => setSelectedDriver(d)} selectedId={selectedDriver?.driver_user_id} calculateDistance={calculateDistance} />}
          {requestStatus === 'idle' && selectedHospital && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 16, borderRadius: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Destination Selected</div>
                <div style={{ color: '#14532d', fontWeight: 700 }}>{selectedHospital.name}</div>
              </div>
              <button onClick={() => setSelectedHospital(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Change</button>
            </div>
          )}
          {myLocation && <NearbyHospitals lat={myLocation.lat} lng={myLocation.lng} radiusKm={50} onViewOnMap={handleViewHospitalOnMap} onSelect={setSelectedHospital} compact={requestStatus !== 'idle'} />}
        </div>
      </div>
      <div style={{ background: '#e2e8f0', position: 'relative' }}>
        {myLocation ? (
          <>
            <MapContainer center={[myLocation.lat, myLocation.lng]} zoom={14} style={{ width: '100%', height: '100%', zIndex: 1 }} zoomControl whenCreated={(m) => { mapRef.current = m; }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
              <ChangeView center={[myLocation.lat, myLocation.lng]} zoom={14} />
              <Marker position={[myLocation.lat, myLocation.lng]} icon={patientIcon}><Popup>You are here</Popup></Marker>
              {activeAmbulances.map(a => (<Marker key={a.driver_id || a.driver_user_id} position={[a.lat, a.lng]} icon={driverIcon} eventHandlers={{ click: () => { if (requestStatus === 'idle') setSelectedDriver(a); } }}><Popup><strong>{a.name}</strong><br />{a.vehicle_name || 'Ambulance'}<br />★ {a.rating || '5.0'}</Popup></Marker>))}
              
              {/* Routing Logic */}
              {/* Stable Routing Logic */}
              {['accepted', 'arrived'].includes(requestStatus) && selectedDriver && myLocation && (
                <RoutingControl 
                  start={{ lat: selectedDriver.lat, lng: selectedDriver.lng }} 
                  end={myLocation} 
                  color="#3b82f6" /* Blue for pickup */
                />
              )}
              {requestStatus === 'started' && myLocation && (selectedHospital || nearbyHospitals[0]) && (
                <RoutingControl 
                  start={myLocation} 
                  end={{ 
                    lat: selectedHospital ? selectedHospital.lat : nearbyHospitals[0].lat, 
                    lng: selectedHospital ? selectedHospital.lng : nearbyHospitals[0].lng 
                  }} 
                  color="#10b981" /* Green for hospital travel */
                />
              )}

              {selectedDriver && requestStatus === 'idle' && <Polyline positions={[[myLocation.lat, myLocation.lng], [selectedDriver.lat, selectedDriver.lng]]} color="#4f46e5" weight={4} dashArray="5,10" />}
              {selectedHospital && (
                <>
                  <Marker position={[selectedHospital.lat, selectedHospital.lng]} icon={hospitalIcon}>
                    <Popup><strong>Destination: {selectedHospital.name}</strong></Popup>
                  </Marker>
                  {requestStatus === 'idle' && <Polyline positions={[[myLocation.lat, myLocation.lng], [selectedHospital.lat, selectedHospital.lng]]} color="#ef4444" weight={4} dashArray="10,10" />}
                </>
              )}
              {nearbyHospitals.map((h, i) => (<Marker key={`hosp-${i}`} position={[h.lat, h.lng]} icon={hospitalIcon}><Popup><strong>{h.name}</strong><br />{h.type === 'hospital' ? '🏥 Hospital' : '🏨 Clinic'}{h.phone && <><br />📞 {h.phone}</>}</Popup></Marker>))}
            </MapContainer>
            <button onClick={handleLocateMe} style={{ position: 'absolute', top: 16, right: 16, zIndex: 1000, width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#4f46e5' }} title="Locate me"><LocateFixed size={18} /></button>
            <button 
              disabled={isSOSLoading}
              onClick={handleSOS} 
              style={{ 
                position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, 
                padding: '16px 32px', background: '#ef4444', color: '#fff', 
                borderRadius: 50, fontWeight: 900, cursor: 'pointer', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.4)',
                display: 'flex', alignItems: 'center', gap: 12, fontSize: '1.2rem',
                border: '4px solid rgba(255,255,255,0.2)', animation: 'pulseSOS 1.5s infinite'
              }}
            >
              <ShieldAlert size={24} /> {isSOSLoading ? 'ALERTING...' : 'SOS EMERGENCY'}
            </button>
            <style>{`
              @keyframes pulseSOS {
                0% { transform: translateX(-50%) scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                70% { transform: translateX(-50%) scale(1.05); box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
                100% { transform: translateX(-50%) scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
              }
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes fadeInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
              @keyframes fadeInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
              @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column', gap: 12 }}><Navigation size={32} className="pulse" /><span>Locating you securely...</span></div>
        )}
      </div>
    </div>
  );

  if (pathname === '/' || pathname.includes('/dashboard')) {
    view = HomeHero;
  } else if (pathname.includes('/wallet')) {
    view = WalletView;
  } else if (pathname.includes('/history')) {
    view = <PatientHistoryView user={user} />;
  } else {
    // default to booking view
    view = BookingView;
  }

  return (
    <div style={{ background: 'var(--background)', color: 'var(--text)', minHeight: 'calc(100vh - 70px)', fontFamily: 'Inter, sans-serif' }}>
      {view}

      {/* Medical Note Modal */}
      {showMedicalModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card-bg)', width: '100%', maxWidth: 450, borderRadius: 20, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={24} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)', fontWeight: 800 }}>Medical Details</h2>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>Help the driver prepare for the emergency.</p>
              </div>
            </div>
            
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Describe the condition / Special instructions</label>
              <textarea 
                value={medicalNote}
                onChange={(e) => setMedicalNote(e.target.value)}
                placeholder="e.g. Patient has high fever, unconscious, blood type A+, third floor apartment..."
                style={{ width: '100%', minHeight: 120, background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, color: 'var(--text)', fontSize: '0.9rem', resize: 'none', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => setShowMedicalModal(false)}
                style={{ flex: 1, padding: '14px', background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
              >Skip</button>
              <button 
                disabled={!medicalNote.trim() || isSubmittingNote}
                onClick={async () => {
                  if(!requestId) return;
                  setIsSubmittingNote(true);
                  try {
                    await api.patch(`/api/ride-request/${requestId}/medical-note`, { medical_note: medicalNote }, { headers: { 'x-auth-token': user.token } });
                    showToast("Medical details shared with driver");
                    setShowMedicalModal(false);
                  } catch {
                    showToast("Failed to share details");
                  } finally {
                    setIsSubmittingNote(false);
                  }
                }}
                style={{ flex: 2, padding: '14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', opacity: medicalNote.trim() ? 1 : 0.5 }}
              >
                {isSubmittingNote ? t('btn_update_pass') : t('prof_save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment & Rating Modal */}
      {showPaymentModal && activeTrip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card-bg)', width: '100%', maxWidth: 400, borderRadius: 20, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideUp 0.3s ease-out' }}>
            
            {!paymentComplete ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <CheckCircle size={32} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: 800 }}>{t('status_completed')}</h2>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>{t('nav_wallet')} / {t('nav_support')}</p>
                </div>
                <div style={{ background: 'var(--background)', border: '1px dashed var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Wallet Balance</span>
                    <span style={{ color: '#4f46e5', fontWeight: 600 }}>NPR {Number(walletBalance || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>Total Distance</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{activeTrip.distance || '0'} km</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '1.1rem' }}>Total Fare</span>
                    <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '1.2rem' }}>NPR {activeTrip.fare}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <button onClick={() => handlePayFare('cod')} style={{ width: '100%', padding: 14, background: 'var(--background)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>💵 Cash on Delivery (COD)</button>
                  <button onClick={() => handlePayFare('esewa')} style={{ width: '100%', padding: '12px 14px', background: '#60bb46', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <img src="https://esewa.com.np/common/images/esewa_logo.png" alt="eSewa" style={{ height: 20, objectFit: 'contain' }} /> Pay with eSewa
                  </button>
                  <button onClick={() => handlePayFare('token')} disabled={walletBalance < activeTrip.fare} style={{ width: '100%', padding: 14, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', opacity: walletBalance < activeTrip.fare ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>🪙 Wallet Payment {walletBalance < activeTrip.fare && '(Low Balance)'}</button>
                </div>
              </>
            ) : (
              // Rating Step
              <div style={{ textAlign: 'center', animation: 'slideUp 0.3s ease-out' }}>
                <h2 style={{ margin: '0 0 16px', fontSize: '1.4rem', color: '#0f172a', fontWeight: 800 }}>Payment Received</h2>
                <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '0.95rem' }}>How was your ride with {selectedDriver?.name || 'your driver'}?</p>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        fontSize: '2.5rem', color: star <= rating ? '#fbbf24' : '#e2e8f0',
                        transition: 'color 0.2s, transform 0.1s'
                      }}
                      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
                      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <button onClick={handleRateDriver} style={{ width: '100%', padding: 14, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}>
                  {t('prof_save')}
                </button>
                <button onClick={() => {
                  setShowPaymentModal(false); setRequestStatus("idle"); setSelectedDriver(null); setActiveTrip(null);
                }} style={{ width: '100%', marginTop: 12, padding: 14, background: 'transparent', color: '#64748b', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                  Skip
                </button>
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* Timeout Modal */}
      {showTimeoutModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card-bg)', width: '100%', maxWidth: 400, borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Clock size={32} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text)', fontWeight: 800 }}>{t('status_offline')}</h2>
            <p style={{ margin: '12px 0 24px', color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>{t('nav_support')}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowTimeoutModal(false)} style={{ flex: 1, padding: '14px', background: 'var(--background)', color: 'var(--muted)', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>{t('btn_cancel')}</button>
              <button onClick={() => { setShowTimeoutModal(false); handleRequestAmbulance(); }} style={{ flex: 1, padding: '14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}>{t('btn_accept')}</button>
            </div>
          </div>
        </div>
      )}

      {/* SOS Confirmation Modal */}
      {showSOSModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 420, borderRadius: 24, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '32px 32px 24px', textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: '4rem', marginBottom: 12 }}>🆘</div>
              <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900 }}>EMERGENCY SOS</h2>
              <p style={{ margin: '8px 0 0', opacity: 0.9, fontSize: '0.95rem' }}>{t('nav_support')}</p>
            </div>
            <div style={{ padding: '24px 32px' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 24, fontSize: '0.9rem', color: '#991b1b', lineHeight: 1.6 }}>
                ⚠️ Use ONLY for real emergencies. Your exact GPS location will be shared with all emergency responders immediately.
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setShowSOSModal(false)} style={{ flex: 1, padding: '14px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>Back</button>
                <button onClick={confirmSOS} disabled={isSOSLoading} style={{ flex: 2, padding: '14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 12px rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {isSOSLoading ? 'Sending Alert...' : `🚨 ${t('btn_accept')}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating SOS Button (always visible) */}
      {requestStatus === 'idle' && (
        <button
          onClick={handleSOS}
          disabled={isSOSLoading}
          style={{ position: 'fixed', bottom: 32, right: 32, width: 64, height: 64, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '1.4rem', fontWeight: 900, zIndex: 9000, boxShadow: '0 8px 25px rgba(239,68,68,0.5)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Emergency SOS"
        >
          🆘
        </button>
      )}

      {/* Notifications */}
      {notification && (
        <div style={{ position: 'fixed', bottom: 110, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: '#fff', padding: '12px 24px', borderRadius: 10, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', fontWeight: 500, fontSize: '0.9rem', zIndex: 10000, display: 'flex', alignItems: 'center', gap: 10, animation: 'slideUp 0.3s ease-out', whiteSpace: 'nowrap', maxWidth: '90vw' }}>
          <InfoIcon size={18} color="#cbd5e1" /> {notification}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeInLeft { from { transform: translateX(-40px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes fadeInRight { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }
        .pulse { animation: pulseAnim 2s infinite; }
        @keyframes pulseAnim { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* Chatbot */}
      <Chatbot role="patient" />
    </div>
  );
}

function PatientHistoryView({ user }) {
  const { t } = useTranslation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.token) return;
    api.get('/api/patient/trip-history', { headers: { 'x-auth-token': user.token } })
      .then(res => setTrips(res.data || []))
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, [user]);

  const statusColor = (s) => {
    if (s === 'paid') return { bg: '#f0fdf4', color: '#22c55e' };
    if (s === 'pending') return { bg: '#fef9c3', color: '#ca8a04' };
    return { bg: '#f1f5f9', color: '#64748b' };
  };

  return (
    <div style={{ padding: '32px var(--container-padding)', maxWidth: 'var(--container-max)', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)' }}>{t('nav_history')}</h2>
      <p style={{ margin: '0 0 24px', color: 'var(--muted)' }}>{t('settings_subtitle')}</p>

      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      {error && <p style={{ color: '#ef4444' }}>{typeof error === 'object' ? (error.message || JSON.stringify(error)) : String(error)}</p>}

      {!loading && !error && trips.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <Clock size={48} style={{ opacity: 0.4, marginBottom: 16 }} />
          <p style={{ margin: 0, fontSize: '1rem' }}>No completed trips yet.</p>
        </div>
      )}

      {!loading && trips.length > 0 && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--background)', borderBottom: '2px solid var(--border)' }}>
                {['Trip #', 'Date', 'Driver', 'Vehicle', 'Payment', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trips.map((t, i) => {
                const sc = statusColor(t.payment_status);
                return (
                  <tr key={t.id} style={{ borderBottom: i < trips.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text)' }}>#{t.id}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--text)' }}>{new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--text)', fontWeight: 500 }}>{t.driver_name || '—'}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--muted)' }}>{t.vehicle_name || '—'}</td>
                    <td style={{ padding: '14px 16px', color: 'var(--text)', textTransform: 'capitalize' }}>{t.payment_method || 'COD'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, background: sc.bg, color: sc.color }}>
                        {t.payment_status || 'completed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InfoIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>;
}

