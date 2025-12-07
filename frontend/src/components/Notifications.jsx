import React, { useEffect, useState, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

const socket = io(process.env.REACT_APP_API_WS || 'http://localhost:4000');

export default function Notifications() {
  const [items, setItems] = useState([]);
  const { user } = useContext(AuthContext);
  useEffect(()=> {
    if (!user) return;
    socket.on('notification', n => {
      setItems(i => [n, ...i]);
    });
    socket.on('ambulance:update', d => {

    });
    return () => {
      socket.off('notification');
      socket.off('ambulance:update');
    };
  }, [user]);
  return <div>
    <h3>Notifications</h3>
    <ul>
      {items.map((it, i) => <li key={i}>{JSON.stringify(it)}</li>)}
    </ul>
  </div>;
}
