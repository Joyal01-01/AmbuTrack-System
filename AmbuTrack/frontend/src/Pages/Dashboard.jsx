import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api";
import Navbar from '../component/NavBar';

export default function Dashboard(){

	const user = JSON.parse(localStorage.getItem("user"));
	const navigate = useNavigate();
	const [counts, setCounts] = useState({ ambulances: 0, incidents: 0 });

	function handleLogout(){
		localStorage.removeItem("user");
		navigate("/");
	}

	async function refreshCounts(){
		try{
			const res = await api.get('/ambulances');
			setCounts(c=>({ ...c, ambulances: Array.isArray(res.data)? res.data.length : 0 }))
		}catch(e){
			// ignore network errors here
		}
	}

	useEffect(()=>{ refreshCounts() },[])

	const initial = user?.name ? user.name.charAt(0).toUpperCase() : '?'

	return(
		<>
		<Navbar />
		<div className="dashboard dashboard-hero">
			<div className="card center-card">
				<div className="card-head">
					<div className="avatar">{initial}</div>
					<div className="who">
						<h1>AmbuTrack</h1>
						<div className="muted">Welcome{user?.name ? `, ${user.name}` : ''}</div>
					</div>
				</div>

				<div className="stats">
					<div className="stat">
						<div className="stat-value">{counts.ambulances}</div>
						<div className="stat-label">Active Ambulances</div>
					</div>
					<div className="stat">
						<div className="stat-value">{counts.incidents}</div>
						<div className="stat-label">Open Incidents</div>
					</div>
					<div className="stat">
						<div className="stat-value">Live</div>
						<div className="stat-label">Status</div>
					</div>
				</div>

				<div className="actions">
					<Link to="/map" className="btn">Open Map</Link>
					<button className="btn btn-outline" onClick={refreshCounts}>Refresh</button>
					<button className="btn btn-ghost" onClick={handleLogout}>Logout</button>
				</div>

			</div>
		</div>
		</>
	)

}