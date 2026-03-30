import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { socket } from '../socket';
import { 
  LogOut, Settings, ShieldCheck, LayoutDashboard, Ambulance, Users, 
  Wallet, History, MapPin, User, ChevronDown, Bell, Search, DollarSign, BarChart, HelpCircle, Menu, X, Sun, Moon, Monitor
} from 'lucide-react';

export default function Navbar() {
  const { darkMode, toggleDarkMode } = useTheme();
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const { t, i18n } = useTranslation();
  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ne' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('ambutrack_lang', newLang);
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      const u = raw ? JSON.parse(raw) : null;
      setUser(u);
    } catch { setUser(null); }
  }, [location.pathname]);

  useEffect(() => {
    if (token) {
      fetchNotifications();
      socket.on('new_notification', (n) => {
        setNotifications(prev => [n, ...prev]);
      });
    }
    return () => socket.off('new_notification');
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/notifications', { headers: { 'x-auth-token': token } });
      setNotifications(res.data || []);
    } catch (e) { /* silent */ }
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`, {}, { headers: { 'x-auth-token': token } });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) { /* silent */ }
  };

  const clearNotifications = async () => {
    try {
      await Promise.all(notifications.filter(n => !n.is_read).map(n => 
        api.put(`/api/notifications/${n.id}/read`, {}, { headers: { 'x-auth-token': token } })
      ));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) { /* silent */ }
  };

  const handleSearch = async (term) => {
    setSearchTerm(term);
    if (!term.trim()) { setSearchResults([]); return; }
    try {
      const hospRes = await api.get(`/api/nearby-hospitals?lat=27.7172&lng=85.3240&radius=50`);
      const results = (hospRes.data || [])
        .map(h => ({ ...h, type: 'hospital' }))
        .filter(item => item.name.toLowerCase().includes(term.toLowerCase()));
      setSearchResults(results.slice(0, 10));
    } catch (e) { /* silent */ }
  };

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    try { socket.disconnect(); } catch (e) { }
    navigate('/login');
  }

  const isActive = (path) => location.pathname === path;

  const iconButtonStyle = {
    width: 38, 
    height: 38, 
    borderRadius: 12, 
    border: '1px solid var(--border)',
    background: darkMode ? 'rgba(255,255,255,0.05)' : 'var(--background)', 
    color: 'var(--text)', 
    cursor: 'pointer', 
    display: 'flex',
    alignItems: 'center', 
    justifyContent: 'center', 
    transition: 'all 0.2s', 
    position: 'relative'
  };

  const NavLink = ({ to, icon: Icon, children }) => (
    <Link to={to} style={{
      ...navLinkStyle,
      color: isActive(to) ? '#ef4444' : 'var(--muted)',
      background: isActive(to) ? 'rgba(239,68,68,0.08)' : 'transparent',
    }}>
      <Icon size={16} strokeWidth={2} />
      <span>{children}</span>
    </Link>
  );

  return (
    <>
      <nav style={{
        height: '70px',
        background: scrolled ? 'var(--card-bg)' : 'var(--background)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        fontFamily: 'Inter, sans-serif',
        boxShadow: scrolled ? '0 4px 20px -5px rgba(0,0,0,0.08)' : 'none',
        transition: 'all 0.3s ease'
      }}>
        {/* Inner container with max-width */}
        <div style={{
          maxWidth: 'var(--container-max)',
          margin: '0 auto',
          padding: '0 var(--container-padding)',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          {/* LEFT: Logo + Nav Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', flexShrink: 0 }}>
              <img src="/ambulance-logo.png" alt="AmbuTrack Logo" style={{ height: 40, borderRadius: 8 }} onError={(e) => { e.target.style.display='none'; }} />
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.04em' }}>
                AmbuTrack<span style={{ color: '#ef4444' }}>.</span>
              </h2>
            </Link>

            {token && !isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                    <NavLink to="/admin-dashboard" icon={Monitor}>Dashboard</NavLink>
                    <NavLink to="/manage-users" icon={Users}>Users</NavLink>
                    <NavLink to="/reports" icon={BarChart}>Reports</NavLink>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {!token ? (
              <>
                <button onClick={toggleDarkMode} style={iconButtonStyle} title="Toggle Dark Mode">
                  {darkMode ? <Sun size={20} color="#fbbf24" /> : <Moon size={20} />}
                </button>
                <button style={iconButtonStyle} onClick={toggleLanguage} title="Change Language">
                  {i18n.language === 'en' ? '🇳🇵' : '🇬🇧'}
                </button>
                <Link to="/login" style={{ ...navLinkStyle, color: 'var(--text)', fontWeight: 700 }}>{t('nav_login')}</Link>
                <Link to="/register" style={{
                  padding: '9px 20px', background: '#ef4444', color: '#fff', 
                  borderRadius: 10, fontWeight: 700, textDecoration: 'none', 
                  fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                  transition: 'all 0.2s'
                }}>{t('nav_join')}</Link>
              </>
            ) : (
              <>
                {/* Mobile hamburger */}
                {isMobile && (
                  <button onClick={() => setMobileOpen(o => !o)} style={iconButtonStyle} aria-label="menu">
                    {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                  </button>
                )}

                {/* Language */}
                <button style={iconButtonStyle} onClick={toggleLanguage} title="Change Language">
                  {i18n.language === 'en' ? '🇳🇵' : '🇬🇧'}
                </button>

                {/* Dark Mode */}
                <button onClick={toggleDarkMode} style={iconButtonStyle} title="Toggle Theme">
                  {darkMode ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} />}
                </button>

                {/* Search */}
                {!isMobile && (
                  <div style={{ position: 'relative' }}>
                    <button style={iconButtonStyle} onClick={() => setIsSearchOpen(!isSearchOpen)}>
                      <Search size={18} />
                    </button>
                    {isSearchOpen && (
                      <div style={{ position: 'absolute', top: '120%', right: 0, width: 300, background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', padding: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 1100 }}>
                        <input 
                          type="text" autoFocus placeholder="Search hospitals..."
                          value={searchTerm} onChange={e => handleSearch(e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text)', boxSizing: 'border-box' }}
                        />
                        <div style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto' }}>
                          {searchResults.map((r, i) => (
                            <div key={i} onClick={() => { navigate('/nearby'); setIsSearchOpen(false); }} style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text)' }}>
                              <strong>{r.name}</strong><br/><span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{r.type}</span>
                            </div>
                          ))}
                          {searchTerm && searchResults.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--muted)', textAlign: 'center', padding: 8 }}>No results found</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notifications */}
                <div style={{ position: 'relative' }}>
                  <button style={iconButtonStyle} onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}>
                    <Bell size={18} />
                    {notifications.some(n => !n.is_read) && (
                      <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#ef4444', borderRadius: '50%', border: '2px solid var(--background)' }} />
                    )}
                  </button>
                  {isNotificationsOpen && (
                    <div style={{ position: 'absolute', top: '120%', right: 0, width: 320, background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', padding: '12px 0', boxShadow: '0 10px 25px rgba(0,0,0,0.12)', zIndex: 1100 }}>
                      <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text)' }}>Notifications</span>
                        {notifications.some(n => !n.is_read) && (
                          <button onClick={clearNotifications} style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>
                        )}
                      </div>
                      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>No new notifications</div>
                        ) : (
                          notifications.map(n => (
                            <div key={n.id} onClick={() => markAsRead(n.id)} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: n.is_read ? 'transparent' : 'rgba(239,68,68,0.04)', cursor: 'pointer' }}>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 4 }}>{n.message}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{new Date(n.created_at).toLocaleTimeString()}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Dropdown */}
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, background: 'var(--background)',
                      border: '1px solid var(--border)', padding: '6px 10px 6px 6px', borderRadius: 30,
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      width: 30, height: 30, background: '#ef4444', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                      fontSize: '0.8rem', fontWeight: 800
                    }}>
                      {user?.name?.charAt(0).toUpperCase() || <User size={16} />}
                    </div>
                    {!isMobile && (
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{user?.name?.split(' ')[0] || 'User'}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{user?.role}</div>
                      </div>
                    )}
                    <ChevronDown size={14} color="var(--muted)" />
                  </button>

                  {isProfileOpen && (
                    <div style={{
                      position: 'absolute', top: '120%', right: 0, width: 210, background: 'var(--card-bg)',
                      borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                      padding: '8px', overflow: 'hidden', zIndex: 1100
                    }}>
                      <Link to="/profile" style={dropdownItemStyle} onClick={() => setIsProfileOpen(false)}><User size={16} /> Profile Settings</Link>
                      <Link to="/settings" style={dropdownItemStyle} onClick={() => setIsProfileOpen(false)}><Settings size={16} /> Account Security</Link>
                      <Link to="/support" style={dropdownItemStyle} onClick={() => setIsProfileOpen(false)}><HelpCircle size={16} /> Help & Support</Link>
                      <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
                      <button onClick={logout} style={{ ...dropdownItemStyle, color: '#ef4444', width: '100%', textAlign: 'left' }}>
                        <LogOut size={16} /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {token && isMobile && mobileOpen && (
          <div style={{ position: 'absolute', top: 70, left: 0, right: 0, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', zIndex: 999 }}>
            <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 16px' }}>
              {user?.role === 'patient' && (
                <>
                  <Link to="/dashboard" onClick={() => setMobileOpen(false)} style={mobileNavLink}>Home</Link>
                  <Link to="/nearby" onClick={() => setMobileOpen(false)} style={mobileNavLink}>Book Ambulance</Link>
                  <Link to="/wallet" onClick={() => setMobileOpen(false)} style={mobileNavLink}>Wallet</Link>
                  <Link to="/history" onClick={() => setMobileOpen(false)} style={mobileNavLink}>Trip History</Link>
                </>
              )}
              {user?.role === 'driver' && (
                <>
                  <Link to="/driver-dashboard" onClick={() => setMobileOpen(false)} style={mobileNavLink}>Dashboard</Link>
                  <Link to="/requests" onClick={() => setMobileOpen(false)} style={mobileNavLink}>Requests</Link>
                  <Link to="/earnings" onClick={() => setMobileOpen(false)} style={mobileNavLink}>Earnings</Link>
                  <Link to="/settings" onClick={() => setMobileOpen(false)} style={mobileNavLink}>Settings</Link>
                </>
              )}
              {user?.role === 'admin' && (
                <>
                  <Link to="/admin-dashboard" onClick={() => setMobileOpen(false)} style={mobileNavLink}>Admin Dashboard</Link>
                </>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <button onClick={() => { setMobileOpen(false); logout(); }} style={{ ...mobileNavLink, color: '#ef4444', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Bottom Nav */}
      {token && isMobile && (
        <div className="mobile-bottom-nav">
          {user?.role === 'patient' && (
            <>
              <Link to="/dashboard" className={`bottom-nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
                <LayoutDashboard size={22} /> <span>Home</span>
              </Link>
              <Link to="/nearby" className={`bottom-nav-item ${isActive('/nearby') ? 'active' : ''}`}>
                <MapPin size={22} /> <span>Book</span>
              </Link>
              <Link to="/wallet" className={`bottom-nav-item ${isActive('/wallet') ? 'active' : ''}`}>
                <Wallet size={22} /> <span>Wallet</span>
              </Link>
              <Link to="/history" className={`bottom-nav-item ${isActive('/history') ? 'active' : ''}`}>
                <History size={22} /> <span>Activity</span>
              </Link>
            </>
          )}
          {user?.role === 'driver' && (
            <>
              <Link to="/driver-dashboard" className={`bottom-nav-item ${isActive('/driver-dashboard') ? 'active' : ''}`}>
                <LayoutDashboard size={22} /> <span>Panel</span>
              </Link>
              <Link to="/requests" className={`bottom-nav-item ${isActive('/requests') ? 'active' : ''}`}>
                <Ambulance size={22} /> <span>Requests</span>
              </Link>
              <Link to="/earnings" className={`bottom-nav-item ${isActive('/earnings') ? 'active' : ''}`}>
                <DollarSign size={22} /> <span>Earnings</span>
              </Link>
              <Link to="/settings" className={`bottom-nav-item ${isActive('/settings') ? 'active' : ''}`}>
                <Settings size={22} /> <span>Menu</span>
              </Link>
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <Link to="/admin-dashboard" className={`bottom-nav-item ${isActive('/admin-dashboard') ? 'active' : ''}`}>
                <Monitor size={22} /> <span>Live</span>
              </Link>
              <Link to="/admin-dashboard" className={`bottom-nav-item`}>
                <Users size={22} /> <span>Users</span>
              </Link>
              <Link to="/admin-dashboard" className={`bottom-nav-item`}>
                <BarChart size={22} /> <span>Reports</span>
              </Link>
              <Link to="/support" className={`bottom-nav-item`}>
                <HelpCircle size={22} /> <span>Help</span>
              </Link>
            </>
          )}
        </div>
      )}
    </>
  );
}

const navLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  textDecoration: 'none',
  fontSize: '0.88rem',
  fontWeight: 600,
  padding: '8px 14px',
  borderRadius: '10px',
  transition: 'all 0.2s ease',
  color: 'var(--muted)',
};

const mobileNavLink = {
  display: 'block',
  padding: '12px 8px',
  color: 'var(--text)',
  fontWeight: 600,
  fontSize: '0.95rem',
  textDecoration: 'none',
  borderBottom: '1px solid var(--border)',
};



const dropdownItemStyle = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  borderRadius: 10, textDecoration: 'none', color: 'var(--muted)', fontSize: '0.85rem',
  fontWeight: 600, transition: 'background 0.2s', border: 'none', background: 'none',
  cursor: 'pointer'
};