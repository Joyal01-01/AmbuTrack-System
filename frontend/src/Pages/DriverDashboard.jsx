import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { socket } from "../socket";
import api from "../api";
import Navbar from "../component/Navbar";

const DEFAULT_CENTER = [27.7172, 85.3240];

export default function DriverDashboard() {
  const [requests, setRequests] = useState([]);
  const [pairedPatient, setPairedPatient] = useState(null);
  const [myLocation, setMyLocation] = useState(null);

  const watchIdRef = useRef(null);
  const patientRef = useRef(null);

  // keep ref synced with state
  useEffect(() => {
    patientRef.current = pairedPatient;
  }, [pairedPatient]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      const user = raw ? JSON.parse(raw) : null;
      socket.emit("identify", { role: "driver", token: user?.token });
    } catch (e) {}

    function onRequest(r) {
      setRequests((prev) => {
        if (prev.find((p) => p.id === r.id)) return prev;
        return [r, ...prev];
      });
    }

    socket.on("ride_request", onRequest);

    async function loadPending() {
      try {
        const res = await api.get("/ride-requests");
        setRequests(res.data || []);
      } catch (e) {}
    }

    loadPending();
    const poll = setInterval(loadPending, 5000);

    socket.on("ride_confirmed", (data) => {
      setPairedPatient({ socketId: data.patientSocketId });
      startSharing();
    });

    socket.on("pair_location", (loc) => {
      if (!loc) return;

      setPairedPatient((prev) => {
        if (prev && prev.socketId === loc.from) {
          return { ...prev, lat: loc.lat, lng: loc.lng };
        }
        return prev;
      });
    });

    return () => {
      socket.off("ride_request", onRequest);
      socket.off("ride_confirmed");
      socket.off("pair_location");
      clearInterval(poll);
      stopSharing();
    };
  }, []);

  async function acceptRequest(req) {
    try {
      const raw = localStorage.getItem("user");
      const user = raw ? JSON.parse(raw) : null;

      await api.post(
        `/ride-request/${req.id}/accept`,
        {},
        { headers: { "x-auth-token": user?.token } }
      );

      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (e) {
      alert("Accept failed");
    }
  }

  function startSharing() {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    if (watchIdRef.current) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setMyLocation({ lat, lng });

        const patient = patientRef.current;

        if (patient && patient.socketId) {
          socket.emit("pair_location", {
            toSocketId: patient.socketId,
            lat,
            lng,
          });
        }
      },
      (err) => console.log(err),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
  }

  function stopSharing() {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  return (
    <div>
      <Navbar />

      <div style={{ padding: 18 }}>
        <h2>Driver Dashboard</h2>

        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 12 }}>
              <strong>Incoming requests</strong>
              <div style={{ fontSize: 12, color: "#666" }}>Tap to accept</div>
            </div>

            {requests.length ? (
              requests.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: 12,
                    border: "1px solid #eee",
                    marginBottom: 8,
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <strong>{r.name || "Patient"}</strong>
                  </div>

                  <div style={{ fontSize: 12, color: "#666" }}>
                    {r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => acceptRequest(r)}>Accept</button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "#667" }}>No requests</div>
            )}

            <div style={{ marginTop: 18 }}>
              <button onClick={startSharing}>Start sharing location</button>
              <button onClick={stopSharing} style={{ marginLeft: 8 }}>
                Stop
              </button>
            </div>
          </div>

          <div style={{ width: 420 }}>
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={13}
              style={{ height: 400, width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {myLocation && (
                <Marker position={[myLocation.lat, myLocation.lng]}>
                  <Popup>Your location</Popup>
                </Marker>
              )}

              {pairedPatient && pairedPatient.lat && (
                <>
                  <Marker position={[pairedPatient.lat, pairedPatient.lng]}>
                    <Popup>Patient</Popup>
                  </Marker>

                  {myLocation && (
                    <Polyline
                      positions={[
                        [myLocation.lat, myLocation.lng],
                        [pairedPatient.lat, pairedPatient.lng],
                      ]}
                      color="#c62828"
                    />
                  )}
                </>
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}