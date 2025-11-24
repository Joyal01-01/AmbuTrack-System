import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function Trips(){
  const [trips,setTrips] = useState([]);
  useEffect(()=>{ axios.get('http://localhost:4000/trips').then(r=>setTrips(r.data)).catch(console.error); },[]);
  return (
    <div style={{padding:20}}>
      <h2>Trips</h2>
      <ul>{trips.map(t=> <li key={t.id}>Request {t.request_id} — {t.status}</li>)}</ul>
    </div>
  );
}
