import React from 'react';
import { Link } from 'react-router-dom';
import { Ambulance, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin, Github } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={footerStyle}>
      <div style={containerStyle}>
        <div style={gridStyle}>
          {/* Brand Section */}
          <div style={sectionStyle}>
            <Link to="/" style={brandStyle}>
              <div style={logoIconStyle}>
                <Ambulance size={20} />
              </div>
              <h2 style={brandTextStyle}>
                AmbuTrack<span style={{ color: '#ef4444' }}>.</span>
              </h2>
            </Link>
            <p style={descriptionStyle}>
              Providing fast, reliable, and life-saving ambulance tracking services across the region. Your safety is our priority.
            </p>
            <div style={socialLinksStyle}>
              <a href="#" style={socialIconStyle}><Facebook size={18} /></a>
              <a href="#" style={socialIconStyle}><Twitter size={18} /></a>
              <a href="#" style={socialIconStyle}><Instagram size={18} /></a>
              <a href="#" style={socialIconStyle}><Linkedin size={18} /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div style={sectionStyle}>
            <h3 style={sectionHeaderStyle}>Quick Links</h3>
            <ul style={listStyle}>
              <li><Link to="/dashboard" style={linkStyle}>Home</Link></li>
              <li><Link to="/nearby" style={linkStyle}>Book Ambulance</Link></li>
              <li><Link to="/support" style={linkStyle}>Help & Support</Link></li>
              <li><Link to="/profile" style={linkStyle}>Account Settings</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div style={sectionStyle}>
            <h3 style={sectionHeaderStyle}>Company</h3>
            <ul style={listStyle}>
              <li><Link to="/about" style={linkStyle}>About Us</Link></li>
              <li><Link to="/privacy" style={linkStyle}>Privacy Policy</Link></li>
              <li><Link to="/terms" style={linkStyle}>Terms of Service</Link></li>
              <li><Link to="/careers" style={linkStyle}>Careers</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div style={sectionStyle}>
            <h3 style={sectionHeaderStyle}>Contact Us</h3>
            <div style={contactItemStyle}>
              <Mail size={16} color="#ef4444" />
              <span style={contactTextStyle}>support@ambutrack.com</span>
            </div>
            <div style={contactItemStyle}>
              <Phone size={16} color="#ef4444" />
              <span style={contactTextStyle}>+1 (555) 123-4567</span>
            </div>
            <div style={contactItemStyle}>
              <MapPin size={16} color="#ef4444" />
              <span style={contactTextStyle}>123 Rescue Way, Med City, NY</span>
            </div>
          </div>
        </div>

        <div style={bottomBarStyle}>
          <p style={copyrightStyle}>
            &copy; {currentYear} AmbuTrack System. All rights reserved.
          </p>
          <div style={githubLinkStyle}>
            <Github size={16} />
            <span>Built with passion for emergency care</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

const footerStyle = {
  background: '#1e293b',
  color: '#cbd5e1',
  padding: '80px 0 40px 0',
  fontFamily: 'Inter, sans-serif',
  position: 'relative',
  zIndex: 10,
};

const containerStyle = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '0 40px',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '40px',
  marginBottom: '60px',
};

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '15px',
};

const brandStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  textDecoration: 'none',
  marginBottom: '10px',
};

const logoIconStyle = {
  width: '32px',
  height: '32px',
  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
};

const brandTextStyle = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 900,
  color: '#fff',
  letterSpacing: '-0.04em',
};

const descriptionStyle = {
  fontSize: '0.9rem',
  lineHeight: '1.6',
  color: '#94a3b8',
  maxWidth: '280px',
};

const socialLinksStyle = {
  display: 'flex',
  gap: '12px',
  marginTop: '10px',
};

const socialIconStyle = {
  width: '36px',
  height: '36px',
  background: 'rgba(255,255,255,0.05)',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#cbd5e1',
  textDecoration: 'none',
  transition: 'all 0.2s ease',
  border: '1px solid rgba(255,255,255,0.1)',
};

const sectionHeaderStyle = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#fff',
  marginBottom: '10px',
  position: 'relative',
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const linkStyle = {
  color: '#94a3b8',
  textDecoration: 'none',
  fontSize: '0.9rem',
  transition: 'color 0.2s',
  '&:hover': {
    color: '#fff',
  },
};

const contactItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const contactTextStyle = {
  fontSize: '0.9rem',
  color: '#94a3b8',
};

const bottomBarStyle = {
  paddingTop: '30px',
  borderTop: '1px solid rgba(255,255,255,0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '20px',
};

const copyrightStyle = {
  fontSize: '0.85rem',
  margin: 0,
};

const githubLinkStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.85rem',
  color: '#64748b',
};
