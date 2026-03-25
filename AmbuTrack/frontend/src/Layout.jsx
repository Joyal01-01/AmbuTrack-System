import React from 'react'
import { Outlet } from 'react-router-dom'
import NavBar from './component/NavBar'
import Footer from './component/Footer'

export default function Layout(){
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <NavBar />
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}
