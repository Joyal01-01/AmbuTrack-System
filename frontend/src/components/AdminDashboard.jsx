import React from 'react';
import { Link } from 'react-router-dom';

export default function AdminDashboard(){
  return (
    <div style={{padding:20}}>
      <h1>Admin Dashboard</h1>
      <nav>
        <Link to="/users">Users</Link> | <Link to="/requests">Requests</Link> | <Link to="/ambulances">Ambulances</Link> | <Link to="/trips">Trips</Link> | <Link to="/map">Map</Link>
      </nav>
    </div>
  );
}
