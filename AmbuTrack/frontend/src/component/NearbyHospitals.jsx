// src/component/NearbyHospitals.jsx
import { useState, useEffect } from "react";
import { Building2, MapPin, Navigation, ChevronDown, ChevronUp, RefreshCw, Loader, CheckCircle } from "lucide-react";
import api from "../api";
import "./NearbyHospitals.css";

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NearbyHospitals({ lat, lng, radiusKm = 50, onViewOnMap, onSelect, compact = false }) {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(!compact);

  const fetchHospitals = async () => {
    if (!lat || !lng) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/nearby-hospitals?lat=${lat}&lng=${lng}&radius=${radiusKm}`);
      const data = (res.data || []).map(h => ({
        ...h,
        distance: haversine(lat, lng, h.lat, h.lng)
      })).sort((a, b) => a.distance - b.distance);
      setHospitals(data);
    } catch (e) {
      console.error("Failed to fetch hospitals:", e);
      setError("Could not load nearby facilities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, [lat, lng, radiusKm]);

  return (
    <div className="nearby-hospitals">
      <div className="nh-header" onClick={() => setExpanded(!expanded)}>
        <div className="nh-header-left">
          <div className="nh-header-icon">
            <Building2 size={16} />
          </div>
          <div>
            <div className="nh-header-title">Nearby Hospitals & Clinics</div>
            <div className="nh-header-subtitle">
              {loading ? "Searching..." : `${hospitals.length} found within ${radiusKm}km`}
            </div>
          </div>
        </div>
        <div className="nh-header-actions">
          <button className="nh-refresh" onClick={(e) => { e.stopPropagation(); fetchHospitals(); }} title="Refresh">
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {expanded && (
        <div className="nh-body">
          {loading && (
            <div className="nh-loading">
              <Loader size={24} className="spin" />
              <span>Finding nearby facilities...</span>
            </div>
          )}

          {error && !loading && (
            <div className="nh-error">
              <span>{error}</span>
              <button onClick={fetchHospitals}>Retry</button>
            </div>
          )}

          {!loading && !error && hospitals.length === 0 && (
            <div className="nh-empty">
              <Building2 size={32} />
              <div>No facilities found nearby</div>
              <div className="nh-empty-sub">Try increasing the search radius</div>
            </div>
          )}

          {!loading && hospitals.length > 0 && (
            <div className="nh-list">
              {hospitals.map((h, i) => (
                <div key={i} className="nh-card">
                  <div className="nh-card-left">
                    <div className={`nh-card-icon ${h.type === "hospital" ? "hospital" : "clinic"}`}>
                      <Building2 size={14} />
                    </div>
                    <div className="nh-card-info">
                      <div className="nh-card-name">{h.name || 'Unnamed Facility'}</div>
                      <div className="nh-card-meta">
                        <span className={`nh-type-badge ${h.type}`}>{h.type === "hospital" ? "Hospital" : "Clinic"}</span>
                        <span className="nh-dist">
                          <MapPin size={11} /> {h.distance.toFixed(1)} km
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {onViewOnMap && (
                      <button className="nh-view-btn" onClick={() => onViewOnMap(h.lat, h.lng, h.name)}>
                        <Navigation size={12} /> View
                      </button>
                    )}
                    {onSelect && (
                      <button 
                        className="nh-select-btn" 
                        onClick={() => onSelect(h)}
                        style={{
                          padding: '6px 12px',
                          background: '#4f46e5',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <CheckCircle size={12} /> Select
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
