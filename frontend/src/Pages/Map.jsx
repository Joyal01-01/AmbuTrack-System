import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { Link } from "react-router-dom";
import api from "../api";
import { socket } from "../socket";

const DEFAULT_CENTER = [27.7172,85.3240]

export default function Map(){

  const [ambulances, setAmbulances] = useState([])
  const [query, setQuery] = useState('')
  const [userLocation, setUserLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef(null)

  useEffect(()=>{
    api.get('/ambulances')
      .then(res=> setAmbulances(res.data || []))
      .catch(()=>{})

    socket.on('receiveLocation', data => {
      setAmbulances(prev=>{
        if(!data || data.lat==null) return prev
        const found = prev.findIndex(p=>p.id && data.id && p.id === data.id)
        if(found >= 0){ const copy = [...prev]; copy[found] = data; return copy }
        return [...prev, data]
      })
    })

    return ()=>{ socket.off && socket.off('receiveLocation') }
  },[])

  function whenCreated(map){ mapRef.current = map; setMapReady(true) }

  function handleLocate(){
    if(!navigator.geolocation) return alert('Geolocation not supported')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat = pos.coords.latitude, lng = pos.coords.longitude
      setUserLocation({lat,lng})
      try{ if(mapRef.current) mapRef.current.setView([lat,lng],13) }catch(e){}
      setLocating(false)
    }, err=>{
      setLocating(false)
      alert('Unable to get location: ' + (err?.message || 'permission denied'))
    }, { enableHighAccuracy:true, timeout:10000 })
  }

  useEffect(()=>{
    if(mapRef.current && userLocation){
      try{ mapRef.current.setView([userLocation.lat, userLocation.lng], 13) }catch(e){}
    }
  },[mapRef.current, userLocation])

  const filtered = query.trim() ? ambulances.filter(a=> (a.driver||'').toLowerCase().includes(query.toLowerCase())) : ambulances

  return (
    <div className="map-page">
      <header className="map-header">
        <h2>Ambulance Map</h2>
        <div className="header-actions">
          <button className="btn btn-small" onClick={handleLocate} disabled={locating || !mapReady}>{locating ? 'Locating…' : (mapReady ? 'Locate Me' : 'Map loading...')}</button>
          <Link to="/dashboard" className="btn btn-small">Back</Link>
        </div>
      </header>

      <div className="map-container">

        <div className="map-area">
          <MapContainer center={DEFAULT_CENTER} zoom={13} className="leaflet-map" whenCreated={whenCreated}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {filtered.map((a,index)=>(
              <Marker key={a.id || index} position={[a.lat,a.lng]}>
                <Popup>
                  <strong>{a.driver}</strong><br/>
                  {a.status || 'On duty'}
                </Popup>
              </Marker>
            ))}

            {userLocation && (
              <>
                <Marker position={[userLocation.lat, userLocation.lng]}>
                  <Popup>You are here</Popup>
                </Marker>
                <Circle center={[userLocation.lat, userLocation.lng]} radius={50} pathOptions={{color:'#2f6fed', opacity:0.2}} />
              </>
            )}

          </MapContainer>

          <div className="map-controls">
            <input placeholder="Search driver..." value={query} onChange={e=>setQuery(e.target.value)} />
            <button title="Zoom to fit" onClick={()=>{ if (!mapRef.current) return; const group = filtered.map(a=>[a.lat,a.lng]); if(group.length) mapRef.current.fitBounds(group,{padding:[40,40]}) }}>Fit All</button>
            <div className="map-debug">Map ready: {mapReady ? 'yes' : 'no'}</div>
          </div>
        </div>

        <aside className="panel">
          <h4>Active Ambulances ({filtered.length})</h4>
          <ul>
            {filtered.length ? filtered.map((a,i)=>(
              <li key={a.id || i} className="ambulance-item" onClick={()=>{ if(mapRef.current) mapRef.current.setView([a.lat,a.lng],15) }}>
                <div className="dot" />
                <div className="meta">
                  <div className="driver">{a.driver || 'Unknown'}</div>
                  <div className="coords">{a.lat?.toFixed(4)}, {a.lng?.toFixed(4)}</div>
                </div>
              </li>
            )) : <li className="empty">No ambulances available</li>}
          </ul>
        </aside>

      </div>
    </div>
  )
}
