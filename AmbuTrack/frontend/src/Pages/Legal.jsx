import React from 'react';

const Legal = ({ title }) => {
  return (
    <div style={{ padding: '60px 20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1e293b', marginBottom: '24px' }}>{title}</h1>
      <div style={{ lineHeight: '1.8', color: '#475569', fontSize: '1.1rem' }}>
        <p>Welcome to the official <strong>{title}</strong> for AmbuTrack. As a professional emergency coordination platform, we prioritize transparency and user safety.</p>
        
        <h2 style={{ marginTop: '40px', color: '#1e293b' }}>1. Overview</h2>
        <p>AmbuTrack is dedicated to connecting patients with life-saving ambulance services in record time. Our platform uses real-time GPS tracking and AI-driven document verification to ensure a secure environment for both drivers and patients.</p>

        <h2 style={{ marginTop: '40px', color: '#1e293b' }}>2. Important Notice</h2>
        <p>This is a demonstration version of the AmbuTrack system. While all features are fully functional (Wallet, SMS, Ride Requests), this platform is currently in a "Beta" or "Evaluation" phase. Do not use this for actual life-threatening emergencies unless officially deployed in your region.</p>

        <h2 style={{ marginTop: '40px', color: '#1e293b' }}>3. Data Privacy</h2>
        <p>We take your privacy seriously. All documents uploaded (License, NID) are processed securely using AI (OCR) and are only accessible by authorized administrators. Your location data is only shared with drivers when a ride is active.</p>

        <div style={{ marginTop: '60px', padding: '24px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Need further clarification?</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>Contact our support team at <a href="mailto:info@ambutrack.com" style={{ color: '#3b82f6' }}>info@ambutrack.com</a> or visit our office in <strong>Itahari, Sunsari</strong>.</p>
        </div>
      </div>
    </div>
  );
};

export default Legal;
