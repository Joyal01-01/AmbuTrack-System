import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import App from './App'
import DriverDashboard from './Pages/DriverDashboard.jsx'
import PatientDashboard from './Pages/PatientDashboard.jsx'
import AdminDashboard from './Pages/AdminDashboard.jsx'
import Login from './Auth/Login.jsx'
import Register from './Auth/Register.jsx'
import ForgotPassword from './Auth/ForgotPassword.jsx'
import Setting from './Pages/Setting.jsx'
import Profile from './Pages/Profile.jsx'
import Support from './Pages/Support.jsx'
import Legal from './Pages/Legal.jsx'
import Layout from './Layout'
import { ThemeProvider } from './component/ThemeContext'
import 'leaflet/dist/leaflet.css'
import './Style.css'
import './i18n'

function RequireAuth({ children, role }){
  try {
    const raw = localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    if(!user || !user.token) return <Navigate to="/login" replace />;
    if(role && user.role !== role) return <Navigate to="/dashboard" replace />;
    return children;
  } catch(e) {
    return <Navigate to="/login" replace />;
  }
}

function DashboardWrapper(){
  try {
    const raw = localStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
    if(!user) return <Navigate to="/login" replace />;
    
    if(user.role === 'driver') return <DriverDashboard />;
    if(user.role === 'admin') return <AdminDashboard />; // The new comprehensive Admin Dashboard
    return <PatientDashboard />;
  } catch(e) {
    return <Navigate to="/login" replace />;
  }
}

const router = createBrowserRouter(
  [
    { 
      path: '/', 
      element: <Layout />, 
      children: [
        { index: true, element: <DashboardWrapper /> },
        { path: 'dashboard', element: <DashboardWrapper /> },
        { path: 'admin-dashboard', element: <RequireAuth role="admin"><AdminDashboard /></RequireAuth> },
        { path: 'manage-users', element: <RequireAuth role="admin"><AdminDashboard /></RequireAuth> },
        { path: 'manage-drivers', element: <RequireAuth role="admin"><AdminDashboard /></RequireAuth> },
        { path: 'reports', element: <RequireAuth role="admin"><AdminDashboard /></RequireAuth> },
        { path: 'driver-dashboard', element: <RequireAuth role="driver"><DriverDashboard /></RequireAuth> },
        { path: 'requests', element: <RequireAuth role="driver"><DriverDashboard /></RequireAuth> },
        { path: 'earnings', element: <RequireAuth role="driver"><DriverDashboard /></RequireAuth> },
        { path: 'nearby', element: <RequireAuth role="patient"><PatientDashboard /></RequireAuth> },
        { path: 'wallet', element: <RequireAuth role="patient"><PatientDashboard /></RequireAuth> },
        { path: 'history', element: <RequireAuth role="patient"><PatientDashboard /></RequireAuth> },
        { path: 'login', element: <Login /> },
        { path: 'register', element: <Register /> },
        { path: 'forgot-password', element: <ForgotPassword /> },
        { path: 'settings', element: <RequireAuth><Setting /></RequireAuth> },
        { path: 'profile', element: <RequireAuth><Profile /></RequireAuth> },
        { path: 'support', element: <Support /> },
        { path: 'about', element: <Legal title="About Us" /> },
        { path: 'privacy', element: <Legal title="Privacy Policy" /> },
        { path: 'terms', element: <Legal title="Terms of Service" /> },
        { path: '*', element: <Navigate to="/dashboard" replace /> },
      ]
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>
)