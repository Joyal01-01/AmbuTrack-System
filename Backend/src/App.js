import React, { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("http://localhost:4000/users")
      .then(res => setUsers(res.data))
      .catch(err => {
        console.error("API error:", err);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>AmbuTrack — Users</h1>
      {users.length === 0 ? (
        <p>No users yet.</p>
      ) : (
        <ul>
          {users.map(u => (
            <li key={u.id}>
              <strong>{u.name}</strong> — {u.email} ({u.role})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
