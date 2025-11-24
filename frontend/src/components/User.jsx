import React, { useEffect, useState } from "react";
import axios from "axios";

export default function User() {
    const [userData, setUsers] = useState([]);
    useEffect(() => {
        axios.get('http://localhost:4000/api/users').then
        (response => {
            setUsers(response.data);
        }).catch(error => {
            console.error('There was an error fetching the user data!', error);
        });
    }, []);

    return (
        <div style={{padding:20}}>
            <h2>User List</h2>
            <ul>{userData.map(u=><li key={u.id}>{u.name} - {u.email} ({u.role})</li>)}</ul>    
        </div>
    );
}