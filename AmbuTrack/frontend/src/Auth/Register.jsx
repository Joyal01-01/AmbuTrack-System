import { useState } from "react";
import api from "../api";
import { Link, useNavigate } from "react-router-dom";
import { 
  User, Mail, Lock, ShieldCheck, ArrowRight, Activity, Send, Phone, MapPin, 
  Truck, Calendar, CreditCard, FileText, Upload, Wallet 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState('patient');
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  
  // Driver specific state
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleType, setVehicleType] = useState("Ambulance");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [licensePhoto, setLicensePhoto] = useState(null);
  const [nidNumber, setNidNumber] = useState("");
  const [nidPhoto, setNidPhoto] = useState(null);

  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [errorStr, setErrorStr] = useState("");
  const [successStr, setSuccessStr] = useState("");

  async function sendOtp() {
    setErrorStr("");
    setSuccessStr("");
    if (!email) return setErrorStr('Please enter an email address first.');
    try {
      setSending(true);
      const res = await api.post('/api/send-otp', { email });
      if (res.data) {
        if (res.data.emailed) {
          setSuccessStr(res.data.preview ? 'OTP sent (dev preview): ' + res.data.preview : 'OTP sent to ' + email + '. Check your inbox.');
          setOtpSent(true);
        } else if (res.data.otp) {
          setSuccessStr('OTP requested — check server response for dev.');
          setOtpSent(true);
        } else {
          setSuccessStr(res.data?.error || res.data?.message || 'OTP requested — check your inbox.');
        }
      }
    } catch (err) {
      setErrorStr('Failed to send OTP: ' + (err?.response?.data || err.message));
    } finally { setSending(false); }
  }

  const register = async (e) => {
    e.preventDefault();
    setErrorStr("");
    if (!name || !email || !password || !otp) return setErrorStr('Name, Email, Password, and OTP are required.');
    if (role === 'driver' && (!vehicleNumber || !licenseNumber || !nidNumber)) {
      return setErrorStr('Please fill in all driver verification details.');
    }

    try {
      setRegistering(true);
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('role', role);
      formData.append('otp', otp);
      formData.append('phone', phone);
      formData.append('address', address);

      if (role === 'driver') {
        formData.append('vehicleNumber', vehicleNumber);
        formData.append('vehicleModel', vehicleModel);
        formData.append('vehicleType', vehicleType);
        formData.append('licenseNumber', licenseNumber);
        formData.append('licenseExpiry', licenseExpiry);
        if (licensePhoto) formData.append('licensePhoto', licensePhoto);
        formData.append('nidNumber', nidNumber);
        if (nidPhoto) formData.append('nidPhoto', nidPhoto);
      }

      const res = await api.post("/api/register", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccessStr(res?.data?.message || 'Registered Successfully — you can now log in.');
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      const msg = err?.response?.data || err.message || 'Registration failed';
      setErrorStr(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally { setRegistering(false); }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10,
    border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.9rem',
    color: '#0f172a', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box'
  };

  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 6 };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: '#f1f5f9',
      alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: '#ffffff', width: '100%', maxWidth: 500, borderRadius: 20,
        boxShadow: '0 20px 50px -12px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid #e2e8f0'
      }}>
        
        <div style={{ padding: '32px 32px 24px', textAlign: 'center', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff' }}>
          <div style={{ 
            width: 56, height: 56, background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 16, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            backdropFilter: 'blur(10px)'
          }}>
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{t('reg_title')}</h2>
          <p style={{ margin: '8px 0 0', opacity: 0.9, fontSize: '0.9rem' }}>{t('reg_subtitle')}</p>
        </div>

        {errorStr && (
          <div style={{ margin: '20px 32px 0', padding: '12px 16px', background: '#fef2f2', color: '#b91c1c', borderRadius: 10, fontSize: '0.85rem', fontWeight: 500, border: '1px solid #fecaca' }}>
            {errorStr}
          </div>
        )}
        {successStr && (
          <div style={{ margin: '20px 32px 0', padding: '12px 16px', background: '#f0fdf4', color: '#15803d', borderRadius: 10, fontSize: '0.85rem', fontWeight: 500, border: '1px solid #bbf7d0' }}>
            {successStr}
          </div>
        )}

        <form onSubmit={register} style={{ padding: '24px 32px 32px' }}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{t('reg_role_prompt')}</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                type="button" 
                onClick={() => setRole('patient')}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: '2px solid',
                  borderColor: role === 'patient' ? '#4f46e5' : '#e2e8f0',
                  background: role === 'patient' ? '#eef2ff' : '#fff',
                  color: role === 'patient' ? '#4f46e5' : '#64748b',
                  fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >{t('reg_role_patient')}</button>
              <button 
                type="button" 
                onClick={() => setRole('driver')}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: '2px solid',
                  borderColor: role === 'driver' ? '#4f46e5' : '#e2e8f0',
                  background: role === 'driver' ? '#eef2ff' : '#fff',
                  color: role === 'driver' ? '#4f46e5' : '#64748b',
                  fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >{t('reg_role_driver')}</button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {/* Common Fields */}
            <div>
              <label style={labelStyle}>{t('reg_fullname')}</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 11 }} />
                <input type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>{t('reg_email')}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 11 }} />
                <input type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>{t('reg_phone')}</label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 11 }} />
                <input type="text" placeholder="+977-XXXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* OTP Section */}
            <div>
              <label style={labelStyle}>{t('reg_otp')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <ShieldCheck size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 11 }} />
                  <input type="text" placeholder={t('reg_otp_placeholder')} value={otp} onChange={(e) => setOtp(e.target.value)} style={{...inputStyle, background: '#f8fafc'}} />
                </div>
                <button type="button" onClick={sendOtp} disabled={sending} style={{
                  padding: '0 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
                }}>{sending ? '...' : (otpSent ? t('reg_otp_resend') : t('reg_otp_send'))}</button>
              </div>
            </div>

            <div>
              <label style={labelStyle}>{t('reg_pass')}</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 11 }} />
                <input type="password" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Address */}
            <div>
              <label style={labelStyle}>{t('reg_address')}</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 11 }} />
                <input type="text" placeholder="City, Ward No, Street" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Patient Wallet Details */}
            {role === 'patient' && (
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', marginTop: 8 }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: 8 }}>Wallet Details</h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Initial Balance (NPR)</label>
                    <div style={{ position: 'relative' }}>
                      <Wallet size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 10 }} />
                      <input type="number" placeholder="500" value={500} readOnly style={{...inputStyle, paddingLeft: 36, background: '#f1f5f9'}} />
                    </div>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>Standard new patient bonus included.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Driver Specific Fields */}
            {role === 'driver' && (
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', marginTop: 8 }}>
                <h4 style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: 8 }}>Ambulance & Verification Details</h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Vehicle Number</label>
                    <div style={{ position: 'relative' }}>
                      <Truck size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 10 }} />
                      <input type="text" placeholder="BA 1 PA 1234" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} style={{...inputStyle, paddingLeft: 36}} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Vehicle Type</label>
                      <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} style={{...inputStyle, paddingLeft: 12}}>
                        <option value="Ambulance">Ambulance</option>
                        <option value="Car">Car</option>
                        <option value="Heli">Heli</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Vehicle Model</label>
                      <input type="text" placeholder="Toyota Hiace" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} style={{...inputStyle, paddingLeft: 12}} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>License Number</label>
                      <div style={{ position: 'relative' }}>
                        <CreditCard size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 10 }} />
                        <input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} style={{...inputStyle, paddingLeft: 36}} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>License Expiry</label>
                      <div style={{ position: 'relative' }}>
                        <Calendar size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 10 }} />
                        <input type="date" value={licenseExpiry} onChange={e => setLicenseExpiry(e.target.value)} style={{...inputStyle, paddingLeft: 36}} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>License Photo</label>
                    <input type="file" onChange={e => setLicensePhoto(e.target.files[0])} style={{fontSize: '0.8rem', width: '100%'}} />
                  </div>
                  <div>
                    <label style={labelStyle}>NID Card Number</label>
                    <div style={{ position: 'relative' }}>
                      <FileText size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 10 }} />
                      <input type="text" value={nidNumber} onChange={e => setNidNumber(e.target.value)} style={{...inputStyle, paddingLeft: 36}} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>NID Card Photo</label>
                    <input type="file" onChange={e => setNidPhoto(e.target.files[0])} style={{fontSize: '0.8rem', width: '100%'}} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={registering}
            style={{
              width: '100%', marginTop: 24, padding: '14px', background: '#4f46e5', color: '#fff',
              border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)'
            }}
          >
            {registering ? t('reg_btn_loading') : <>{role === 'driver' ? t('reg_btn_driver') : t('reg_btn_patient')} <ArrowRight size={20} /></>}
          </button>
        </form>

        <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{t('reg_have_acc')} </span>
          <Link to="/login" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4f46e5', textDecoration: 'none' }}>{t('reg_login_link')}</Link>
        </div>
      </div>
    </div>
  );
}