import React, { useState } from 'react';
import API from './api';

export default function SearchAmbulance({ onResults }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('');

  async function search(e) {
    e.preventDefault();
    const params = {};
    if (q) params.q = q;
    if (status) params.status = status;
    if (lat && lng && radius) {
      params.lat = lat; params.lng = lng; params.radius_km = radius;
    }
    const r = await API.get('/ambulances', { params });
    onResults(r.data);
  }

  return <form onSubmit={search}>
    <input placeholder="plate or q" value={q} onChange={e=>setQ(e.target.value)} />
    <select value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="">Any</option>
      <option value="available">available</option>
      <option value="on_trip">on_trip</option>
      <option value="maintenance">maintenance</option>
    </select>
    <div>
      <input placeholder="lat" value={lat} onChange={e=>setLat(e.target.value)} />
      <input placeholder="lng" value={lng} onChange={e=>setLng(e.target.value)} />
      <input placeholder="radius km" value={radius} onChange={e=>setRadius(e.target.value)} />
    </div>
    <button>Search</button>
  </form>;
}
