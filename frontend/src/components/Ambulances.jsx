import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function Ambulances(){
  const [list,setList] = useState([]);
  useEffect(()=>{ axios.get('http://localhost:4000/ambulances').then(r=>setList(r.data)).catch(console.error); },[]);
  return (
    <div style={{padding:20}}>
      <h2>Ambulances</h2>
      <ul>{list.map(a => <li key={a.id}>{a.ambulance_number} — {a.status} — Driver: {a.driver_name}</li>)}</ul>
    </div>
  );
}
