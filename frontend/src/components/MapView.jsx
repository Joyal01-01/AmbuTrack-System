import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

export default function MapView() {
    const [ambulances, setAmbulances] = useState([]);
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        axios.get('http://localhost:4000/ambulances')
            .then(response => setAmbulances(response.data))
            .catch(error => console.error('Error fetching ambulances:', error));

        axios.get('http://localhost:4000/requests')
            .then(response => setRequests(response.data))
            .catch(error => console.error('Error fetching requests:', error));
    }, []); 

    return (
        <div style={{height: '80vh',width:'100%'}}>
            <MapContainer center={[27,7,85,3]} zoom={12} style={{height: '100%'}}> 
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />       
            {ambulances.map(amb => amb.latitude && amb.longitude && <Marker key={amb.id} position={[amb.latitude, amb.longitude]}><Popup><strong>Ambulance:</strong> {amb.ambulance_number} - {amb.status}</Popup></Marker>)}
            {requests.map(req => req.latitude && req.longitude && <Marker key={req.id} position={[req.latitude, req.longitude]}><Popup><strong>Request:</strong> {req.patient_name} - {req.status}</Popup></Marker>)}
            </MapContainer>
        </div>
    );
}