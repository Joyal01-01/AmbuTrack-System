import React, {useEffect, useState} from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function RequestsList() {
    const [reqs, setReqs] = useState([]);

    useEffect(() => {axios.get('http://localhost:4000/api/requests').then (response => setReqs(response.data)).catch(console.error );}, []);
    return (
        <div style={{padding:20}}>
            <h2>Requests List</h2>
            <Link to="/requests/new">Create New Request</Link>
            <ul>{reqs.map(r =>(
                <li key ={r.id}>#{r.id} - {r.location} - {r.emergency_level} -{r.status} {r.user_name ?`-${r.user_name}` : ''}</li>))}
                </ul>
        </div>
    );
}