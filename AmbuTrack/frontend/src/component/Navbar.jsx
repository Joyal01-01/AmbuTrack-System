import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { socket } from '../socket';
import { 
  LogOut, Settings, ShieldCheck, LayoutDashboard, Ambulance, Users, 
  Wallet, History, MapPin, User, ChevronDown, Bell, Search, DollarSign, BarChart, HelpCircle, Menu, X
} from 'lucide-react';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const token = user?.token;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync user state on route change
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      const u = raw ? JSON.parse(raw) : null;
      setUser(u);
    } catch { setUser(null); }
  }, [location.pathname]);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    try { socket.disconnect(); } catch (e) { }
    navigate('/login');
  }

  const isActive = (path) => location.pathname === path;

  const NavLink = ({ to, icon: Icon, children }) => (
    <Link to={to} style={{
      ...navLinkStyle,
      color: isActive(to) ? '#4f46e5' : '#64748b',
      background: isActive(to) ? '#f5f3ff' : 'transparent',
    }}>
      <Icon size={18} strokeWidth={2} />
      <span>{children}</span>
    </Link>
  );

  return (
    <nav style={{
      height: '70px',
      background: scrolled ? 'rgba(255, 255, 255, 0.8)' : '#ffffff',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: '1px solid #e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 40px',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      fontFamily: 'Inter, sans-serif',
      boxShadow: scrolled ? '0 4px 20px -5px rgba(0,0,0,0.05)' : 'none',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div style={{
            width: 40, height: 40, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
          }}>
            <Ambulance size={22} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.04em' }}>
            AmbuTrack<span style={{ color: '#ef4444' }}>.</span>
          </h2>
        </Link>

        {token && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20 }}>
            {user?.role === 'patient' && (
              <>
                <NavLink to="/dashboard" icon={LayoutDashboard}>Home</NavLink>
                <NavLink to="/nearby" icon={MapPin}>Book</NavLink>
                <NavLink to="/wallet" icon={Wallet}>Wallet</NavLink>
                <NavLink to="/history" icon={History}>History</NavLink>
              </>
            )}
            {user?.role === 'driver' && (
              <>
                <NavLink to="/driver-dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
                <NavLink to="/requests" icon={Ambulance}>Requests</NavLink>
                <NavLink to="/earnings" icon={DollarSign}>Earnings</NavLink>
                <NavLink to="/settings" icon={Settings}>Settings</NavLink>
              </>
            )}
            {user?.role === 'admin' && (
              <>
                <NavLink to="/manage-users" icon={BarChart}>Monitoring</NavLink>
                <NavLink to="/admin-portal" icon={ShieldCheck}>Portal</NavLink>
                <NavLink to="/manage-drivers" icon={Ambulance}>Drivers</NavLink>
              </>
            )}
          </div>
        )}
      </div>
      {/* Mobile menu toggle */}
      {token && isMobile && (
        <div style={{ marginLeft: 12 }}>
          <button onClick={() => setMobileOpen(o => !o)} style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {!token ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/login" style={{
              ...navLinkStyle, color: '#1e293b', fontWeight: 700
            }}>Login</Link>
            <Link to="/register" style={{
              padding: '10px 22px', background: '#1e293b', color: '#fff', 
              borderRadius: 12, fontWeight: 700, textDecoration: 'none', 
              fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(30, 41, 59, 0.2)',
              transition: 'all 0.2s'
            }}>Join Now</Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={iconButtonStyle}><Search size={20} /></button>
              <button style={iconButtonStyle}><Bell size={20} /></button>
            </div>
            
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc',
                  border: '1px solid #e2e8f0', padding: '6px 12px 6px 6px', borderRadius: 30,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{
                  width: 32, height: 32, background: '#e2e8f0', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b'
                }}>
                  <User size={18} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{user?.name ? user.name.split(' ')[0] : 'User'}</div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>{user?.role}</div>
                </div>
                <ChevronDown size={14} color="#94a3b8" />
              </button>

              {isProfileOpen && (
                <div style={{
                  position: 'absolute', top: '120%', right: 0, width: 200, background: '#fff',
                  borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  padding: '8px', overflow: 'hidden'
                }}>
                  <Link to="/profile" style={dropdownItemStyle}><User size={16} /> Profile Settings</Link>
                  <Link to="/settings" style={dropdownItemStyle}><Settings size={16} /> Account Security</Link>
                  <Link to="/support" style={dropdownItemStyle}><HelpCircle size={16} /> Help & Support</Link>
                  <div style={{ height: '1px', background: '#f1f5f9', margin: '8px 0' }} />
                  <button onClick={logout} style={{ ...dropdownItemStyle, color: '#ef4444' }}>
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {token && isMobile && mobileOpen && (
        <div style={{ position: 'absolute', top: 70, right: 16, width: 260, background: '#fff', border: '1px solid #e6e6e6', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', overflow: 'hidden', zIndex: 1200 }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: 8 }}>
            {user?.role === 'patient' && (
              <>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>Home</Link>
                <Link to="/nearby" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>Book</Link>
                <Link to="/wallet" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>Wallet</Link>
                <Link to="/history" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>History</Link>
              </>
            )}
            {user?.role === 'driver' && (
              <>
                <Link to="/driver-dashboard" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>Dashboard</Link>
                <Link to="/requests" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>Requests</Link>
                <Link to="/earnings" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>Earnings</Link>
                <Link to="/settings" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>Settings</Link>
              </>
            )}
            {user?.role === 'admin' && (
              <>
                <Link to="/manage-users" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>Monitoring</Link>
                <Link to="/admin-portal" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>Portal</Link>
                <Link to="/manage-drivers" onClick={() => setMobileOpen(false)} style={{ ...navLinkStyle, padding: '10px 12px' }}>Drivers</Link>
              </>
            )}
            <div style={{ height: 1, background: '#f1f5f9', margin: '8px 0' }} />
            <button onClick={() => { setMobileOpen(false); logout(); }} style={{ padding: 12, border: 'none', background: 'transparent', textAlign: 'left', width: '100%', fontWeight: 700, color: '#ef4444' }}>Sign Out</button>
          </div>
        </div>
      )}
    </nav>
  );
}

const navLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  textDecoration: 'none',
  fontSize: '0.9rem',
  fontWeight: 700,
  padding: '10px 16px',
  borderRadius: '12px',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
};

const iconButtonStyle = {
  width: 40, height: 40, borderRadius: 12, border: '1px solid #e2e8f0',
  background: '#fff', color: '#64748b', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
};

const dropdownItemStyle = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  borderRadius: 10, textDecoration: 'none', color: '#475569', fontSize: '0.85rem',
  fontWeight: 600, transition: 'background 0.2s', border: 'none', background: 'none',
  width: '100%', textAlign: 'left', cursor: 'pointer'
};