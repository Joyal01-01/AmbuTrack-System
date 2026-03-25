import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { socket } from "../socket";
import api from "../api";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Ambulance, MapPin, Navigation, Clock, CreditCard, CheckCircle, ShieldAlert, Phone, LocateFixed, Building2 } from 'lucide-react';
import '../Pages/DriverDashboard.css';
import Chatbot from '../component/Chatbot';
import NearbyHospitals from '../component/NearbyHospitals';
import NearbyAmbulances from '../component/NearbyAmbulances';

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

function PatientDashboard() {
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
        (err) => {
          showToast("Please enable Location Services to book an ambulance");
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
      showToast(`${data.driverName || 'A driver'} accepted your request!`);
    });

    socket.on('trip_updated', (data) => {
      if(data.status === 'arrived') setRequestStatus('arrived');
      if(data.status === 'started') setRequestStatus('started');
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
    });

    socket.on('driver_offline', (data) => {
      const offlineId = data.driverId || data.userId;
      setActiveAmbulances(prev => prev.filter(d => d.driver_user_id !== offlineId && d.driver_id !== offlineId));
      setSelectedDriver(prev => (prev && (prev.driver_user_id === offlineId || prev.driver_id === offlineId)) ? null : prev);
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
          if (trip.status === 'completed') {
            // Need to ensure fare and distance are set for the modal
            // These might need to be calculated or fetched from a 'trips' table if moving beyond ride_requests
            setActiveTrip({
              id: trip.id,
              fare: trip.fare || 100 + ( (trip.distance_km || 0) * 30 ), // fallback calculation
              distance: trip.distance_km || 0
            });
            setShowPaymentModal(true);
          } else if (['accepted', 'arrived', 'started'].includes(trip.status)) {
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
      clearInterval(pollId);
    };
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
        driver_user_id: selectedDriver ? selectedDriver.driver_user_id : null
      };
      
      const res = await api.post('/api/ride-request', payload, { headers: { 'x-auth-token': user.token } });
      setRequestId(res.data.id);
      setTimeLeft(60); // 1 minute timeout
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

  const handleCancelRequest = async () => {
    if (!requestId) return setRequestStatus("idle");
    try {
      await api.post(`/api/ride-request/${requestId}/cancel`);
      setRequestStatus("idle");
      setRequestId(null);
      setTimeLeft(0);
      showToast("Request Cancelled");
    } catch (err) {
      showToast("Failed to cancel: " + (err.response?.data || err.message));
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
  let view = null;

  // Home hero (no map) with Request button that navigates to /nearby
  const HomeHero = (
    <div className="home-hero">
      <div className="home-hero-grid">
        <div style={{ color: '#0f172a' }}>
          <h1 style={{ fontSize: '2.4rem', margin: 0, lineHeight: 1.05 }}>
            Fast, Reliable Ambulance On-Demand
          </h1>
          <p style={{ color: '#64748b', marginTop: 12, fontSize: '1rem' }}>
            AmbuTrack connects you to nearby ambulances within minutes — track the vehicle, get ETA, and pay securely.
          </p>

          <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
            <a href="/nearby" style={{ padding: '12px 20px', background: '#ef4444', color: '#fff', borderRadius: 12, fontWeight: 700, textDecoration: 'none' }}>Request Ambulance</a>
            <a href="/nearby" style={{ padding: '12px 20px', border: '1px solid #e2e8f0', color: '#475569', borderRadius: 12, fontWeight: 700, textDecoration: 'none' }}>Book Now</a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 28 }}>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #f1f5f9' }}>
              <h4 style={{ margin: 0 }}>24/7 Coverage</h4>
              <p style={{ margin: '8px 0 0', color: '#64748b' }}>Always available ambulances nearby.</p>
            </div>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #f1f5f9' }}>
              <h4 style={{ margin: 0 }}>Real-time Tracking</h4>
              <p style={{ margin: '8px 0 0', color: '#64748b' }}>Follow the vehicle live until arrival.</p>
            </div>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #f1f5f9' }}>
              <h4 style={{ margin: 0 }}>Secure Payments</h4>
              <p style={{ margin: '8px 0 0', color: '#64748b' }}>Multiple payment options and receipts.</p>
            </div>
          </div>

          <div style={{ marginTop: 28, color: '#475569' }}>
            <h3 style={{ margin: 0 }}>Why AmbuTrack?</h3>
            <ul style={{ marginTop: 8, paddingLeft: 18, color: '#64748b' }}>
              <li>Fast dispatch to the nearest ambulance</li>
              <li>Verified drivers and equipped vehicles</li>
              <li>Transparent fares and easy payments</li>
            </ul>
          </div>
        </div>

        <div className="home-hero-image-wrap">
          <img className="hero-image" src="/assets/ambulance-hero.png" alt="Ambulance" onError={(e)=>{ e.target.style.display='none'; }} />
        </div>
      </div>
    </div>
  );

  const BookingView = (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 420px) 1fr', flex: 1, overflow: 'hidden' }}>
      <div style={{ background: '#fff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflowY: 'auto' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: 800 }}>Need an Ambulance?</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>Select an available ambulance from the map to view pricing and book immediately.</p>
        </div>
        <div style={{ padding: 24, flex: 1 }}>
          {requestStatus !== 'idle' && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: requestStatus === 'searching' ? '#fef3c7' : requestStatus === 'completed' ? '#f0fdf4' : '#e0e7ff', color: requestStatus === 'searching' ? '#d97706' : requestStatus === 'completed' ? '#22c55e' : '#4f46e5' }}>
                  {requestStatus === 'searching' ? <Navigation size={20} className="pulse" /> : requestStatus === 'completed' ? <CheckCircle size={20} /> : <Ambulance size={20} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{requestStatus === 'searching' ? 'Finding Ambulance...' : requestStatus === 'accepted' ? 'Driver is on the way!' : requestStatus === 'arrived' ? 'Driver has arrived at your location' : requestStatus === 'started' ? 'Trip in progress' : 'Trip Completed'}</h3>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.85rem' }}>{requestStatus === 'searching' ? 'Waiting for driver to accept' : requestStatus === 'accepted' ? 'Please be ready' : requestStatus === 'arrived' ? 'Please securely board the vehicle' : requestStatus === 'started' ? 'Heading safely to your destination' : 'Please complete your payment'}</p>
                </div>
              </div>
              <div style={{ height: 6, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
                <div style={{ height: '100%', background: '#4f46e5', borderRadius: 6, transition: 'width 1s linear', width: `${(timeLeft / 60) * 100}%` }} />
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginTop: 4 }}>Expires in {timeLeft}s</div>
              {requestStatus === 'searching' && <button onClick={handleCancelRequest} style={{ width: '100%', marginTop: 16, padding: 12, background: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel Request</button>}
            </div>
          )}

          {/* If no driver selected yet: show primary Request button */}
          {requestStatus === 'idle' && !selectedDriver && (
            <div style={{ padding: 20, borderRadius: 12, background: '#fff', border: '1px solid #e6e6e6', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Ready to request an ambulance?</h3>
              <p style={{ margin: '8px 0 12px', color: '#64748b' }}>Press Request Ambulance to broadcast to nearby vehicles.</p>
              <button onClick={handleRequestAmbulance} style={{ padding: '12px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Request Ambulance</button>
            </div>
          )}

          {requestStatus === 'idle' && selectedDriver && (
            <div style={{ animation: 'slideUp 0.3s ease-out' }}>
              <div style={{ background: '#fff', border: '1px solid #c7d2fe', borderRadius: 16, padding: 20, boxShadow: '0 4px 20px rgba(79, 70, 229, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>{selectedDriver.name}</h3>
                      <div style={{ background: '#fef2f2', color: '#ef4444', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600 }}>⭐ {selectedDriver.rating || '5.0'}</div>
                    </div>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}><Ambulance size={14} /> {selectedDriver.vehicle_name || 'Standard Ambulance'} ({selectedDriver.vehicle_type || 'A'})</p>
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
          {myLocation && <NearbyHospitals lat={myLocation.lat} lng={myLocation.lng} radiusKm={50} onViewOnMap={handleViewHospitalOnMap} compact={requestStatus !== 'idle'} />}
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
              {selectedDriver && requestStatus === 'idle' && <Polyline positions={[[myLocation.lat, myLocation.lng], [selectedDriver.lat, selectedDriver.lng]]} color="#4f46e5" weight={4} dashArray="5,10" />}
              {nearbyHospitals.map((h, i) => (<Marker key={`hosp-${i}`} position={[h.lat, h.lng]} icon={hospitalIcon}><Popup><strong>{h.name}</strong><br />{h.type === 'hospital' ? '🏥 Hospital' : '🏨 Clinic'}{h.phone && <><br />📞 {h.phone}</>}</Popup></Marker>))}
            </MapContainer>
            <button onClick={handleLocateMe} style={{ position: 'absolute', top: 16, right: 16, zIndex: 1000, width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#4f46e5' }} title="Locate me"><LocateFixed size={18} /></button>
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
    view = (
      <div style={{ padding: 24 }}>
        <h2>Wallet</h2>
        <p>Balance: NPR {Number(walletBalance || 0).toFixed(2)}</p>
        <button onClick={fetchWallet} style={{ padding: 8, background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8 }}>Refresh Wallet</button>
      </div>
    );
  } else if (pathname.includes('/history')) {
    view = <PatientHistoryView user={user} />;
  } else {
    // default to booking view
    view = BookingView;
  }

  return (
    <div className="patient-dashboard" style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      {view}

      {/* Payment & Rating Modal */}
      {showPaymentModal && activeTrip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 20, padding: 32, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideUp 0.3s ease-out' }}>
            
            {!paymentComplete ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <CheckCircle size={32} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: 800 }}>Trip Completed</h2>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>Please complete your payment.</p>
                </div>
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Wallet Balance</span>
                    <span style={{ color: '#4f46e5', fontWeight: 600 }}>NPR {Number(walletBalance || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ color: '#64748b' }}>Total Distance</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{activeTrip.distance || '0'} km</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                    <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '1.1rem' }}>Total Fare</span>
                    <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '1.2rem' }}>NPR {activeTrip.fare}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <button onClick={() => handlePayFare('cod')} style={{ width: '100%', padding: 14, background: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>💵 Cash on Delivery (COD)</button>
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
                  Submit Rating
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
          <div style={{ background: '#fff', width: '100%', maxWidth: 400, borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff7ed', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Clock size={32} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: 800 }}>Request Timed Out</h2>
            <p style={{ margin: '12px 0 24px', color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5 }}>No drivers were available to accept your request within the last minute. Please try again or book a different ambulance.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowTimeoutModal(false)} style={{ flex: 1, padding: '14px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Close</button>
              <button onClick={() => { setShowTimeoutModal(false); handleRequestAmbulance(); }} style={{ flex: 1, padding: '14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}>Retry Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: '#fff', padding: '12px 24px', borderRadius: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', fontWeight: 500, fontSize: '0.9rem', zIndex: 10000, display: 'flex', alignItems: 'center', gap: 10, animation: 'slideUp 0.3s ease-out' }}>
          <InfoIcon size={18} color="#cbd5e1" /> {notification}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .pulse { animation: pulseAnim 2s infinite; }
        @keyframes pulseAnim { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* Chatbot */}
      <Chatbot role="patient" />
    </div>
  );
}

function PatientHistoryView({ user }) {
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
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>Ride History</h2>
      <p style={{ margin: '0 0 24px', color: '#64748b' }}>Your completed ambulance trips.</p>

      {loading && <p style={{ color: '#64748b' }}>Loading…</p>}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      {!loading && !error && trips.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <Clock size={48} style={{ opacity: 0.4, marginBottom: 16 }} />
          <p style={{ margin: 0, fontSize: '1rem' }}>No completed trips yet.</p>
        </div>
      )}

      {!loading && trips.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Trip #', 'Date', 'Driver', 'Vehicle', 'Payment', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trips.map((t, i) => {
                const sc = statusColor(t.payment_status);
                return (
                  <tr key={t.id} style={{ borderBottom: i < trips.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a' }}>#{t.id}</td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>{new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '14px 16px', color: '#0f172a', fontWeight: 500 }}>{t.driver_name || '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>{t.vehicle_name || '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#475569', textTransform: 'capitalize' }}>{t.payment_method || 'COD'}</td>
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

export default PatientDashboard;