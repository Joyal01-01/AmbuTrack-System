import { useEffect, useState } from "react";
import api from "../api";
import Navbar from '../component/Navbar';

export default function AdminDashboard(){
  const [ambulances, setAmbulances] = useState([]);
  const [incidents, setIncidents] = useState([]);

  useEffect(()=>{
    const raw = localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    api.get('/admin/ambulances', { headers: { 'x-auth-token': user?.token } }).then(res=>setAmbulances(res.data||[])).catch(()=>{});
    api.get('/admin/ride-requests', { headers: { 'x-auth-token': user?.token } }).then(res=>setIncidents(res.data||[])).catch(()=>{});
  },[])

  return (
    <div>
      <Navbar />
      <div style={{padding:18}}>
        <h2>Admin Dashboard</h2>
        <div style={{marginTop:12}}>
          <strong>Open Emergencies</strong>
          <ul>
            {incidents.length ? incidents.map((it)=>(
              <li key={it.id}>#{it.id} — user:{it.user_id} — {it.lat},{it.lng} — status:{it.status}</li>
            )) : <li>No open emergencies</li>}
          </ul>
        </div>

        <div style={{marginTop:12}}>
          <strong>Ambulances</strong>
          <ul>
            {ambulances.length ? ambulances.map((a,i)=>(
              <li key={i}>{a.driver || 'Unknown'} — {a.lat},{a.lng} — status: {a.status || 'unknown'}</li>
            )) : <li>No ambulances listed</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}
