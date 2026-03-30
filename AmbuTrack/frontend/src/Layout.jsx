import React from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './component/Navbar'
import Footer from './component/Footer'
import Chatbot from './component/Chatbot'

export default function Layout(){
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
      <Chatbot role={user.role || 'patient'} />
      <Footer />
    </div>
  )
}
