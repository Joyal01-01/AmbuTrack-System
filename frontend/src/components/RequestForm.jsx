import React, {useState} from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function RequestForm() {
    const [location, setLocation] = useState('');
    const [emergencyLevel, setEmergencyLevel] = useState('Low');
    const navigate = useNavigate();
    const [lat,setLat] = useState('');
    const [lng,setLng] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:4000/api/requests', {
                location,
                emergency_level: emergencyLevel, latitude: lat||null, longitude: lng ||null
            });
            navigate('/requests');
        } catch (error) {
            console.error('There was an error creating the request!', error);
            alert('Error creating request. Please try again.');
        }
    };

    return (
        <div style={{padding:20}}>
            <h2>Create New Request</h2>
            <form onSubmit={submit}>
                <div><label>Location: </label><br/>
                <input value={location} onChange={e => setLocation(e.target.value)} required/></div>
                <div><label>Emergency Level: </label><br/>
                <select value={emergencyLevel} onChange={e => setEmergencyLevel(e.target.value)}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                </select></div>
                <div><label>Lat</label><br/><input value={lat} onChange={e=>setLat(e.target.value)}/></div>
                <div><label>Lng</label><br/><input value={lng} onChange={e=>setLng(e.target.value)}/></div>
                <button type="submit">Submit Request</button>
            </form>
        </div>
    );
}