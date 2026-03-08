import { Link, useNavigate } from 'react-router-dom'

export default function Navbar(){
  const user = JSON.parse(localStorage.getItem('user'))
  const navigate = useNavigate();

  function logout(){
    localStorage.removeItem('user');
    navigate('/');
    window.location.reload();
  }

  return (
    <header style={{padding:12,display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fff',borderBottom:'1px solid #eee'}}>
      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        <Link to="/dashboard" style={{textDecoration:'none',color:'#c62828',fontWeight:700}}>AmbuTrack</Link>
        <nav style={{display:'flex',gap:10,alignItems:'center'}}>
          <Link to="/dashboard/patient">Patient</Link>
          <Link to="/dashboard/driver">Driver</Link>
          {user?.role==='admin' && <Link to="/dashboard/admin">Admin</Link>}
        </nav>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <div style={{color:'#667'}}>{user?.name || user?.email || 'Guest'}</div>
        <button className="btn btn-outline" onClick={logout}>Logout</button>
      </div>
    </header>
  )
}