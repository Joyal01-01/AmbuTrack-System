// src/Pages/Map.jsx
import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { socket } from "../socket";
import api from "../api";

// Fix default leaflet icons
// Fix default leaflet icons (Vite/ESM-compatible)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

const DEFAULT_CENTER = [27.7172, 85.3240]; // Kathmandu

const FitMapTo = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length) map.setView(coords, 14);
  }, [coords]);
  return null;
};

function haversine([lat1, lon1], [lat2, lon2]){
  const toRad = v => v * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const MapPage = () => {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [patientPos, setPatientPos] = useState(null);
  const [ambulances, setAmbulances] = useState([]);
  const [status, setStatus] = useState('idle');
  const [assignedDriver, setAssignedDriver] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [socketConnected, setSocketConnected] = useState(true);
  const [backendReachable, setBackendReachable] = useState(true);
  const [geoDenied, setGeoDenied] = useState(false);
  const tripRef = useRef(null);
  const geoRequestedRef = useRef(false);

  useEffect(()=>{
    // helper to request geolocation so we can retry from UI
    function requestGeolocation(){
      if(!navigator.geolocation) return fetchAmbulances(DEFAULT_CENTER);
      navigator.geolocation.getCurrentPosition(pos=>{
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setPatientPos(coords);
        setCenter(coords);
        setGeoDenied(false);
        setStatus('idle');
        fetchAmbulances(coords);
      }, err=>{
        console.warn('geolocation failed', err);
        if(err && err.code === 1){ // PERMISSION_DENIED
          setGeoDenied(true);
          setStatus('Location access denied');
        }
        fetchAmbulances(DEFAULT_CENTER);
      }, { enableHighAccuracy: true, timeout: 8000 });
    }

    // initial attempt (guarded to avoid duplicate prompts in StrictMode)
    if (!geoRequestedRef.current) {
      geoRequestedRef.current = true;
      requestGeolocation();
    }

    // expose retry to window so buttons can call it without re-render issues
    window.__AmbuTrack_requestGeolocation = requestGeolocation;

    return ()=>{ try{ delete window.__AmbuTrack_requestGeolocation }catch(e){} };
  },[]);

  useEffect(()=>{
    // socket listeners
    socket.on('ride_accepted', data => {
      // data: { tripId, driverId, driverName }
      setStatus('Driver Accepted');
      setAssignedDriver({ id: data.driverId, name: data.driverName });
      tripRef.current = data.tripId;
    });

    socket.on('pair_location', payload => {
      // payload: { from, lat, lng }
      if(payload && payload.lat && payload.lng){
        setDriverPos([payload.lat, payload.lng]);
      }
    });

    socket.on('receiveLocation', data => {
      // some drivers emit sendLocation -> backend forwards via receiveLocation
      // if the message contains driverId and lat/lng, update
      if(data && data.driverId && data.lat && data.lng){
        if(assignedDriver && data.driverId === assignedDriver.id){
          setDriverPos([data.lat, data.lng]);
        }
      }
    });

    return ()=>{
      socket.off('ride_accepted');
      socket.off('pair_location');
      socket.off('receiveLocation');
    };
  },[assignedDriver]);

  useEffect(()=>{
    function onStatus(e){ 
      const connected = !!e.detail?.connected;
      setSocketConnected(connected);
      if(connected) setBackendReachable(true);
    }
    window.addEventListener('socket-status', onStatus);
    return ()=> window.removeEventListener('socket-status', onStatus);
  },[]);

  async function fetchAmbulances(myCoords){
    try{
      const res = await api.get('/ambulances');
      const list = (res.data || []).map(a=>({ ...a, distance: haversine(myCoords, [a.lat, a.lng]) }));
      // show only within 10 km
      setAmbulances(list.filter(x=>x.distance < 10).sort((a,b)=>a.distance-b.distance));
      setBackendReachable(true);
    }catch(e){ console.warn(e); }
  }

  function requestAmbulance(){
    if(!patientPos) return alert('Waiting for location');
    setStatus('Requesting');
    // emit via socket to let drivers receive in real-time
    socket.emit('ride_request', { lat: patientPos[0], lng: patientPos[1], name: 'Patient' });
  }

  return (
    <div className="map-page">
      <div className="map-header">
        <h3>AmbuTrack — Request Ambulance</h3>
        <div className="header-actions">
          <button onClick={()=>{ if(patientPos) fetchAmbulances(patientPos); }}>Refresh Nearby</button>
        </div>
      </div>

      <div className="map-container">
        <div className="map-area leaflet-map">
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            {patientPos && <Marker position={patientPos}><Popup>You are here</Popup></Marker>}
            {ambulances.map(a=> (
              <Marker key={a.id} position={[a.lat, a.lng]}>
                <Popup>{a.driver || `Ambulance ${a.id}`} — {(a.distance||0).toFixed(2)} km</Popup>
              </Marker>
            ))}
            {driverPos && <Marker position={driverPos}><Popup>Driver</Popup></Marker>}
            {driverPos && patientPos && <Polyline positions={[driverPos, patientPos]} color="blue" />}
            <FitMapTo coords={driverPos || patientPos || center} />
          </MapContainer>

          <div className="map-controls" style={{ right:12, position:'absolute', top:12, zIndex:1000 }}>
            <button onClick={requestAmbulance} style={{ background:'#e53935', zIndex:1001 }}>Request Ambulance</button>
          </div>

          {(!socketConnected || !backendReachable) && (
            <div style={{ position:'absolute', top:12, left:12, background:'#fff3f3', color:'#8a1f1f', padding:8, borderRadius:8, boxShadow:'0 6px 18px rgba(0,0,0,0.06)' }}>
              Backend not reachable — {import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}
              <div style={{ fontSize:12, color:'#8a1f1f', marginTop:6 }}>Check backend is running or set VITE_BACKEND_URL in frontend/.env</div>
            </div>
          )}

          {geoDenied && (
            <div style={{ position:'absolute', top:72, left:12, background:'#fff8e1', color:'#6b4f00', padding:12, borderRadius:8, boxShadow:'0 6px 18px rgba(0,0,0,0.03)' }}>
              <div style={{ fontWeight:700, marginBottom:6 }}>Location access denied</div>
              <div style={{ marginBottom:8 }}>Allow location in your browser to use nearby features, or use a mock location below.</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>{ try{ window.__AmbuTrack_requestGeolocation && window.__AmbuTrack_requestGeolocation(); }catch(e){ console.warn(e) } }}>Retry location</button>
                <button onClick={()=>{ setPatientPos(DEFAULT_CENTER); setCenter(DEFAULT_CENTER); fetchAmbulances(DEFAULT_CENTER); setGeoDenied(false); setStatus('Using default location'); }}>Use default location</button>
                <button onClick={()=>{
                  const v = prompt('Enter coordinates as lat,lng','27.7172,85.3240');
                  if(!v) return; const parts = v.split(',').map(s=>parseFloat(s.trim()));
                  if(parts.length===2 && !isNaN(parts[0]) && !isNaN(parts[1])){ setPatientPos([parts[0], parts[1]]); setCenter([parts[0], parts[1]]); fetchAmbulances([parts[0], parts[1]]); setGeoDenied(false); setStatus('Using custom location'); }
                }}>Enter coords</button>
              </div>
            </div>
          )}

          <div style={{ position:'absolute', left:12, bottom:12, right:12, pointerEvents:'auto', zIndex:1000 }}>
            <div style={{ maxWidth:560, margin:'auto', background:'rgba(255,255,255,0.95)', borderRadius:12, padding:12, boxShadow:'0 8px 20px rgba(0,0,0,0.08)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:14, color:'#666' }}>Status</div>
                  <div style={{ fontSize:18, fontWeight:700 }}>{status}</div>
                </div>
                <div>
                  {assignedDriver ? (
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontWeight:700 }}>{assignedDriver.name || `Driver ${assignedDriver.id}`}</div>
                      <div style={{ color:'#666' }}>ETA: calculating...</div>
                    </div>
                  ) : (
                    <div style={{ color:'#666' }}>{ambulances.length} nearby ambulances</div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="panel">
          <h4>Nearby Ambulances</h4>
          <ul>
            {ambulances.length===0 && <div className="empty">No ambulances nearby</div>}
            {ambulances.map(a=> (
              <li key={a.id} className="ambulance-item">
                <div style={{ display:'flex', justifyContent:'space-between', width:'100%' }}>
                  <div>
                    <div className="driver">{a.driver || `Ambulance ${a.id}`}</div>
                    <div className="coords">{a.lat.toFixed(4)}, {a.lng.toFixed(4)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700 }}>{a.distance.toFixed(2)} km</div>
                    <button onClick={()=>{ setCenter([a.lat,a.lng]); }}>View</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MapPage;