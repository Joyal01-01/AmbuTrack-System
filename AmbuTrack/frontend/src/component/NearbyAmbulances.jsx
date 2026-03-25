import React from 'react';
import { Ambulance, Star, Navigation, Ruler, Timer } from 'lucide-react';

const NearbyAmbulances = ({ ambulances, myLocation, onSelect, selectedId, calculateDistance }) => {
  if (!ambulances || ambulances.length === 0) {
    return (
      <div className="nearby-ambulances-empty" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
        <Ambulance size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
        <p style={{ fontSize: '0.9rem' }}>No ambulances online nearby right now.</p>
      </div>
    );
  }

  return (
    <div className="nearby-ambulances-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>Nearby Ambulances</h3>
      <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: '#64748b' }}>{ambulances.length} available online</p>
      
      {ambulances.map((amb) => {
        const dist = myLocation ? calculateDistance(myLocation.lat, myLocation.lng, amb.lat, amb.lng) : null;
        const eta = dist ? Math.max(2, Math.round(dist * 2)) : null;
        const isSelected = selectedId === amb.driver_user_id;

        return (
          <div 
            key={amb.driver_id}
            onClick={() => onSelect(amb)}
            style={{
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: isSelected ? '#4f46e5' : '#e2e8f0',
              background: isSelected ? '#f5f3ff' : '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isSelected ? '0 4px 12px rgba(79, 70, 229, 0.1)' : 'none'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>{amb.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{amb.vehicle_name || 'Ambulance'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fef2f2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                <Star size={10} fill="#ef4444" /> {amb.rating || '5.0'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#64748b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Ruler size={12} /> {dist !== null ? `${dist.toFixed(1)} km` : '--'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Timer size={12} /> {eta !== null ? `${eta} min` : '--'}
              </div>
            </div>
            
            {isSelected && (
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#4f46e5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Navigation size={12} /> Selected for booking
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default NearbyAmbulances;
