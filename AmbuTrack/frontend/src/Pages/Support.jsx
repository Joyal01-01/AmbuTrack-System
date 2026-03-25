import React, { useState, useMemo } from 'react';
import { 
  Search, HelpCircle, MessageSquare, Phone, Mail, 
  ChevronDown, ChevronUp, Send, Shield, Clock, Heart,
  CheckCircle, AlertCircle, Loader
} from 'lucide-react';

const ALL_FAQS = [
  {
    question: "How do I book an ambulance?",
    answer: "Navigate to 'Nearby' on your patient dashboard. Select an ambulance on the map to see their pricing, then click 'Book This Ambulance'. Alternatively, press 'Request Ambulance' to auto-broadcast to all nearby drivers."
  },
  {
    question: "How can I track my ambulance in real-time?",
    answer: "Once your booking is accepted, the driver appears as a blue moving marker on your map. The status bar at the bottom updates in real-time: En Route → Arrived → Trip Started → Completed."
  },
  {
    question: "What are the payment methods available?",
    answer: "After your trip completes, a payment modal appears. You can pay via Cash on Delivery (COD), eSewa (mock), or Token Wallet if you have sufficient balance."
  },
  {
    question: "How do I register as a driver?",
    answer: "On the registration page, select 'Driver' as your role and fill in your vehicle details, license, and NID. After submitting, your account enters 'Pending' status until an admin approves it."
  },
  {
    question: "Is AmbuTrack available 24/7?",
    answer: "The platform is always available. Driver availability depends on which drivers are currently online in your area."
  },
  {
    question: "Can I cancel a request?",
    answer: "Yes — while your request shows 'Searching', a Cancel Request button appears on the dashboard. Once a driver has accepted, please contact them directly."
  },
  {
    question: "How are fares calculated?",
    answer: "Each driver sets their own Base Fare and Per-KM Rate, visible before you book. Your total = Base Fare + (Distance × Per-KM Rate). Distance is calculated from pickup to destination."
  },
  {
    question: "What if no driver accepts my request?",
    answer: "Requests automatically timeout after 1 minute. You'll see a Timeout modal with an option to Retry, which rebroadcasts your request immediately."
  },
  {
    question: "How do I find nearby hospitals?",
    answer: "Hospitals and clinics within 5 km appear as green markers on your map and in the sidebar list. Click 'View on Map' to zoom to any facility."
  },
  {
    question: "How do I update my profile?",
    answer: "Go to Settings via the navbar. You can update your name, phone, avatar, toggle 2FA, change your password, or delete your account."
  }
];

export default function Support() {
  const [activeFaq, setActiveFaq] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [formState, setFormState] = useState('idle'); // idle | submitting | success | error
  const [formError, setFormError] = useState('');

  // Fuzzy-filter FAQ items based on search
  const filteredFaqs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return ALL_FAQS;
    return ALL_FAQS.filter(f =>
      f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormState('submitting');
    setFormError('');
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Server error');
      }
      setFormState('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setFormError(err.message || 'Failed to send. Please try again.');
      setFormState('error');
    }
  };

  return (
    <div style={pageStyle}>
      {/* Hero Section */}
      <section style={heroStyle}>
        <div style={containerStyle}>
          <h1 style={heroTitleStyle}>How can we <span style={{ color: '#ef4444' }}>help you?</span></h1>
          <p style={heroSubStyle}>Search our knowledge base or get in touch with our support team.</p>
          <div style={searchContainerStyle}>
            <Search style={searchIconStyle} size={20} />
            <input
              type="text"
              placeholder="Search for answers..."
              style={searchInputStyle}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setActiveFaq(null); }}
            />
          </div>
        </div>
      </section>

      {/* Quick Access Cards */}
      <section style={sectionStyle}>
        <div style={containerStyle}>
          <div style={cardGridStyle}>
            <div style={supportCardStyle}>
              <div style={{ ...iconBoxStyle, background: '#fee2e2', color: '#ef4444' }}>
                <Phone size={24} />
              </div>
              <h3 style={cardTitleStyle}>Emergency</h3>
              <p style={cardTextStyle}>Nepal Ambulance Emergency Line</p>
              <a href="tel:102" style={cardLinkStyle}>📞 102</a>
            </div>
            <div style={supportCardStyle}>
              <div style={{ ...iconBoxStyle, background: '#e0f2fe', color: '#0ea5e9' }}>
                <Mail size={24} />
              </div>
              <h3 style={cardTitleStyle}>Email Support</h3>
              <p style={cardTextStyle}>Send us an email anytime for assistance.</p>
              <a href="mailto:ambutrack.system.noreply@gmail.com" style={cardLinkStyle}>Send Email</a>
            </div>
            <div style={supportCardStyle}>
              <div style={{ ...iconBoxStyle, background: '#f0fdf4', color: '#22c55e' }}>
                <MessageSquare size={24} />
              </div>
              <h3 style={cardTitleStyle}>Live Chat</h3>
              <p style={cardTextStyle}>Use the chatbot on your dashboard for instant answers.</p>
              <span style={cardLinkStyle}>Available on Dashboard</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: FAQ & Form */}
      <section style={{ ...sectionStyle, background: '#f8fafc' }}>
        <div style={containerStyle}>
          <div style={contentGridStyle}>
            {/* FAQ Section */}
            <div>
              <h2 style={sectionTitleStyle}>Frequently Asked Questions</h2>
              {searchQuery && (
                <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.9rem' }}>
                  {filteredFaqs.length} result{filteredFaqs.length !== 1 ? 's' : ''} for "<strong>{searchQuery}</strong>"
                </p>
              )}
              <div style={faqListStyle}>
                {filteredFaqs.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>
                    <HelpCircle size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <p>No results found for "{searchQuery}"</p>
                  </div>
                ) : filteredFaqs.map((faq, index) => (
                  <div key={index} style={faqItemStyle}>
                    <button
                      onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                      style={faqHeaderStyle}
                    >
                      <span style={faqQuestionStyle}>{faq.question}</span>
                      {activeFaq === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    {activeFaq === index && (
                      <div style={faqAnswerStyle}>{faq.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Form */}
            <div style={contactFormContainerStyle}>
              <h2 style={sectionTitleStyle}>Send us a Message</h2>

              {formState === 'success' ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <CheckCircle size={48} color="#22c55e" style={{ marginBottom: 16 }} />
                  <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>Message Sent!</h3>
                  <p style={{ color: '#64748b', margin: 0 }}>Our support team will get back to you soon.</p>
                  <button
                    onClick={() => setFormState('idle')}
                    style={{ marginTop: 24, padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Send Another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={formStyle}>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Full Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} style={inputStyle} placeholder="Your name" required />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Email Address</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} style={inputStyle} placeholder="you@example.com" required />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Subject</label>
                    <input type="text" name="subject" value={formData.subject} onChange={handleInputChange} style={inputStyle} placeholder="How can we help?" required />
                  </div>
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Message</label>
                    <textarea name="message" value={formData.message} onChange={handleInputChange} style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} placeholder="Tell us more about your issue..." required />
                  </div>

                  {formState === 'error' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: '0.875rem', padding: '10px 14px', background: '#fef2f2', borderRadius: 8 }}>
                      <AlertCircle size={16} /> {formError}
                    </div>
                  )}

                  <button type="submit" disabled={formState === 'submitting'} style={{ ...submitButtonStyle, opacity: formState === 'submitting' ? 0.7 : 1, cursor: formState === 'submitting' ? 'wait' : 'pointer' }}>
                    {formState === 'submitting' ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</> : <><Send size={18} /> Send Message</>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section style={sectionStyle}>
        <div style={containerStyle}>
          <div style={trustGridStyle}>
            <div style={trustItemStyle}>
              <Shield size={32} color="#ef4444" />
              <h4 style={trustTitleStyle}>Secure Data</h4>
              <p style={trustTextStyle}>Your privacy and data security are our top priority.</p>
            </div>
            <div style={trustItemStyle}>
              <Clock size={32} color="#ef4444" />
              <h4 style={trustTitleStyle}>24/7 Availability</h4>
              <p style={trustTextStyle}>Round-the-clock emergency support for everyone.</p>
            </div>
            <div style={trustItemStyle}>
              <Heart size={32} color="#ef4444" />
              <h4 style={trustTitleStyle}>Patient Centric</h4>
              <p style={trustTextStyle}>Designed with the care and comfort of patients in mind.</p>
            </div>
          </div>
        </div>
      </section>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Styles
const pageStyle = { fontFamily: 'Inter, sans-serif', color: '#1e293b', backgroundColor: '#fff' };
const containerStyle = { maxWidth: '1200px', margin: '0 auto', padding: '0 20px' };
const sectionStyle = { padding: '80px 0' };
const heroStyle = { background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: '100px 0', textAlign: 'center' };
const heroTitleStyle = { fontSize: '3rem', fontWeight: 900, marginBottom: '20px', letterSpacing: '-0.04em' };
const heroSubStyle = { fontSize: '1.25rem', color: '#94a3b8', marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px' };
const searchContainerStyle = { position: 'relative', maxWidth: '600px', margin: '0 auto' };
const searchIconStyle = { position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' };
const searchInputStyle = { width: '100%', padding: '20px 20px 20px 55px', borderRadius: '16px', border: 'none', fontSize: '1rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', outline: 'none', boxSizing: 'border-box' };
const cardGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px' };
const supportCardStyle = { padding: '40px', borderRadius: '24px', background: '#fff', border: '1px solid #e2e8f0', textAlign: 'center' };
const iconBoxStyle = { width: '60px', height: '60px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' };
const cardTitleStyle = { fontSize: '1.25rem', fontWeight: 800, marginBottom: '10px' };
const cardTextStyle = { fontSize: '0.95rem', color: '#64748b', marginBottom: '20px' };
const cardLinkStyle = { color: '#ef4444', fontWeight: 700, fontSize: '1rem', textDecoration: 'none' };
const contentGridStyle = { display: 'grid', gridTemplateColumns: '1fr 450px', gap: '60px', alignItems: 'start' };
const sectionTitleStyle = { fontSize: '2rem', fontWeight: 900, marginBottom: '30px', letterSpacing: '-0.02em' };
const faqListStyle = { display: 'flex', flexDirection: 'column', gap: '15px' };
const faqItemStyle = { background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' };
const faqHeaderStyle = { width: '100%', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' };
const faqQuestionStyle = { fontSize: '1rem', fontWeight: 700, color: '#1e293b' };
const faqAnswerStyle = { padding: '0 25px 20px', color: '#64748b', lineHeight: '1.6', fontSize: '0.95rem' };
const contactFormContainerStyle = { background: '#fff', padding: '40px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '20px' };
const formGroupStyle = { display: 'flex', flexDirection: 'column', gap: '8px' };
const labelStyle = { fontSize: '0.9rem', fontWeight: 700, color: '#475569' };
const inputStyle = { padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', fontFamily: 'Inter, sans-serif' };
const submitButtonStyle = { padding: '14px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '10px' };
const trustGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px', textAlign: 'center' };
const trustItemStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' };
const trustTitleStyle = { fontSize: '1.2rem', fontWeight: 800, margin: 0 };
const trustTextStyle = { fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5' };
