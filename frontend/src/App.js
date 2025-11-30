import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminDashboard from "./components/AdminDashboard";
import Users from "./components/Users";
import RequestList from "./components/RequestList";
import RequestForm from "./components/RequestForm";
import Ambulances from "./components/Ambulances";
import Trips from "./components/Trips";
import MapView from "./components/MapView";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/requests" element={<RequestList />} />
        <Route path="/requests/new" element={<RequestForm />} />
        <Route path="/ambulances" element={<Ambulances />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/map" element={<MapView />} />
    </Routes>
    </BrowserRouter>
  );
}
    