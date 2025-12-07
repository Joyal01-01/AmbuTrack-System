import React, { useState, useContext } from 'react';
import API from './api';
import { AuthContext } from './AuthContext';
export default function Login() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');
  async function submit(e){
    e.preventDefault();
    try {
      const r = await API.post('/auth/login', { email, password });
      login(r.data.token, r.data.user);
      window.location.href = '/';
    } catch (e) {
      setErr(e.response?.data?.message || 'Login failed');
    }
  }
  return <div>
    <h2>Login</h2>
    {err && <div style={{color:'red'}}>{err}</div>}
    <form onSubmit={submit}>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" /><br/>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" /><br/>
      <button>Login</button>
    </form>
  </div>;
}
