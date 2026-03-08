import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { socket } from "../socket";
import api from '../api';
import Navbar from '../component/Navbar';

const DEFAULT_CENTER = [27.7172,85.3240]

function estimateETA(lat1, lng1, lat2, lng2){
  // haversine distance in km
  const toRad = v=> v*Math.PI/180;
  const R = 6371;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lng2-lng1);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const dist = R*c; // km
  const speedKmh = 40; // assumed average speed
  const minutes = Math.round((dist / speedKmh) * 60);
  return minutes;
}

export default function PatientDashboard(){
  const [requesting, setRequesting] = useState(false);
  const [driver, setDriver] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const watchRef = useRef(null);
  const rawUser = localStorage.getItem('user');
  const currentUser = rawUser ? JSON.parse(rawUser) : null;

  useEffect(()=>{
    const raw = localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    try{ socket.emit('identify', { role: user?.role || 'guest', token: user?.token }) }catch(e){}

    socket.on('ride_accepted', data=>{
      // driver accepted our request
      setDriver({ name: data.driverName, socketId: data.driverSocketId });
      // start sending location updates to driver
      startSharingToDriver(data.driverSocketId);
    })

    socket.on('pair_location', loc=>{
      // receive driver's location
      if(loc){ setDriver(d=>({...d, lat: loc.lat, lng: loc.lng })); }
    })

    return ()=>{
      socket.off('ride_accepted');
      socket.off('pair_location');
    }
  },[])

  async function requestAmbulance(){
    try{
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      if(user?.role !== 'patient') return alert('Only patients can request an ambulance');
      if(!navigator.geolocation) return alert('Geolocation not supported');
      setRequesting(true);
      navigator.geolocation.getCurrentPosition(async pos=>{
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setMyLocation({lat,lng});
        const raw = localStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : null;
        const token = user?.token;
        // call REST API to create ride request
        await api.post('/ride-request', { lat, lng }, { headers: { 'x-auth-token': token } });
      }, err=>{ setRequesting(false); alert('Unable to get location')}, { enableHighAccuracy:true })
    }catch(e){ setRequesting(false); alert('Request failed') }
  }

  function startSharingToDriver(driverSocketId){
    if(watchRef.current) return;
    watchRef.current = navigator.geolocation.watchPosition(pos=>{
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      setMyLocation({lat,lng});
      // send to driver
      socket.emit('pair_location', { toSocketId: driverSocketId, lat, lng });
    }, err=>{}, { enableHighAccuracy:true, maximumAge:2000 });
  }

  function stopSharing(){ if(watchRef.current){ navigator.geolocation.clearWatch(watchRef.current); watchRef.current=null } }

  return (
    <div>
      <Navbar />
      <div style={{padding:18}}>
      <h2>Patient Dashboard</h2>
      <div style={{display:'flex',gap:16}}>
        <div style={{flex:1}}>
          <div style={{marginBottom:12}}>
            <strong>Request an ambulance</strong>
            <div style={{fontSize:12,color:'#666'}}>Share your live location with the driver once accepted.</div>
          </div>
          <div>
            {currentUser?.role === 'patient' ? (
              <>
                <button onClick={requestAmbulance} disabled={requesting}>{requesting ? 'Requesting…' : 'Request Ambulance'}</button>
                <button onClick={stopSharing} style={{marginLeft:8}}>Stop sharing</button>
              </>
            ) : (
              <div style={{color:'#a00',fontSize:14}}>Only patients can request an ambulance.</div>
            )}
          </div>

          {driver && (
            <div style={{marginTop:18,padding:12,border:'1px solid #eee',borderRadius:8}}>
              <div><strong>Driver assigned:</strong> {driver.name}</div>
              <div style={{fontSize:12,color:'#666'}}>Driver location: {driver.lat ? `${driver.lat.toFixed(4)}, ${driver.lng.toFixed(4)}` : 'waiting for update'}</div>
            </div>
          )}
        </div>

        <div style={{width:420}}>
          <MapContainer center={DEFAULT_CENTER} zoom={13} style={{height:400,width:'100%'}}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {myLocation && (
              <Marker position={[myLocation.lat,myLocation.lng]}>
                <Popup>Your location</Popup>
              </Marker>
            )}

            {driver && driver.lat && (
                <>
                  <Marker position={[driver.lat, driver.lng]}>
                    <Popup>Driver: {driver.name}</Popup>
                  </Marker>
                  {myLocation && driver.lat && (
                    <Polyline positions={[[myLocation.lat, myLocation.lng],[driver.lat, driver.lng]]} color="#c62828" />
                  )}
                  {myLocation && driver.lat && (
                    <div style={{marginTop:8}}>Estimated arrival: <strong>{estimateETA(myLocation.lat,myLocation.lng,driver.lat,driver.lng)} min</strong></div>
                  )}
                </>
            )}

          </MapContainer>
        </div>
      </div>
    </div>
  </div>
  )
}
