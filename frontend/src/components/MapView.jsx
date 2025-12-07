import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import API from './api';
import 'leaflet-routing-machine';

function FitBounds({ points }) {
  const map = useMap();
  useEffect(()=> {
    if (!points || points.length===0) return;
    const bounds = L.latLngBounds(points.map(p => [p[0], p[1]]));
    map.fitBounds(bounds, { padding: [50,50] });
  }, [points, map]);
  return null;
}

export default function MapView() {
  const [ambulances, setAmbulances] = useState([]);
  const [route, setRoute] = useState([]);
  const [distance, setDistance] = useState(null);

  useEffect(()=> {
    fetchAmb();
  }, []);

  async function fetchAmb() {
    const r = await API.get('/ambulances');
    setAmbulances(r.data);
  }

  async function planRoute(a) {
    // example: route from ambulance to a fixed dest (simulate)
    const dest = { lat: 27.7069, lng: 85.3294 }; // e.g. Kathmandu
    const q = `/route?originLat=${a.lat}&originLng=${a.lng}&destLat=${dest.lat}&destLng=${dest.lng}`;
    const r = await API.get(q);
    if (r.data.polyline) {
      setRoute(r.data.polyline.map(pt => [pt[0], pt[1]]));
      setDistance(r.data.distanceKm || r.data.routes?.[0]?.distance/1000);
    } else if (r.data.routes && r.data.routes[0]) {
      // OSRM style
      const coords = r.data.routes[0].geometry || r.data.routes[0].geometry.coordinates;
      // if polyline encoded, you may decode; for simplicity assume coords array
      if (Array.isArray(coords[0])) {
        setRoute(coords.map(c => [c[1], c[0]])); // [lat,lng]
      }
      setDistance((r.data.routes[0].distance || 0) / 1000);
    }
  }

  return (
    <div style={{display:'flex'}}>
      <div style={{width:'70vw', height:'80vh'}}>
        <MapContainer center={[27.7,85.3]} zoom={12} scrollWheelZoom style={{height:'100%'}}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {ambulances.map(a => <Marker key={a.id} position={[a.lat, a.lng]} />)}
          {route.length>0 && <>
            <Polyline positions={route} />
            <FitBounds points={route} />
          </>}
        </MapContainer>
      </div>
      <div style={{padding:20, width:'30vw'}}>
        <h3>Ambulances</h3>
        {ambulances.map(a => <div key={a.id}>
          <b>{a.plate}</b> — {a.status} — {a.lat?.toFixed(4)},{a.lng?.toFixed(4)}
          <button onClick={()=>planRoute(a)}>Plan route to Kathmandu</button>
        </div>)}
        <div style={{marginTop:20}}>
          {distance && <div><b>Distance:</b> {distance.toFixed(2)} km</div>}
        </div>
      </div>
    </div>
  );
}
