import { Routes,Route } from "react-router-dom";

import Login from "./Auth/Login";
import Register from "./Auth/Register";
import Dashboard from "./Pages/Dashboard";
import Map from "./Pages/Map";
import DriverDashboard from "./Pages/DriverDashboard";
import PatientDashboard from "./Pages/PatientDashboard";
import AdminDashboard from "./Pages/AdminDashboard";
import { Navigate } from "react-router-dom";

function DashboardRouter(){
	const raw = localStorage.getItem('user');
	const user = raw ? JSON.parse(raw) : null;
	if(!user) return <Navigate to="/" replace />;
	if(user.role === 'driver') return <Navigate to="/dashboard/driver" replace />;
	if(user.role === 'admin') return <Navigate to="/dashboard/admin" replace />;
	return <Navigate to="/dashboard/patient" replace />;
}

function App(){

return(

<Routes>

<Route path="/" element={<Login/>}/>
<Route path="/register" element={<Register/>}/>
<Route path="/dashboard" element={<DashboardRouter/>}/>
<Route path="/dashboard/driver" element={<DriverDashboard/>} />
<Route path="/dashboard/patient" element={<PatientDashboard/>} />
<Route path="/dashboard/admin" element={<AdminDashboard/>} />
<Route path="/map" element={<Map/>} />

</Routes>

)

}

export default App