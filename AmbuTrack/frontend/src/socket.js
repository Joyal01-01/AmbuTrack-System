import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
export const socket = io(BACKEND_URL, {
  autoConnect: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 10000
});

socket.on("connect", () => {
  console.log("Connected to socket server:", socket.id, '->', BACKEND_URL);
  const token = localStorage.getItem('token');
  if (token) socket.emit('identify', { token });
  try { window.dispatchEvent(new CustomEvent('socket-status', { detail: { connected: true, url: BACKEND_URL } })); } catch (e) { void e; }
});

socket.on('disconnect', (reason) => {
  console.warn('Socket disconnected:', reason);
  try { window.dispatchEvent(new CustomEvent('socket-status', { detail: { connected: false, reason } })); } catch (e) { void e; }
});

socket.on('connect_error', (err) => {
  console.error('Socket connect_error', err);
  try { window.dispatchEvent(new CustomEvent('socket-status', { detail: { connected: false, error: String(err) } })); } catch (e) { void e; }
});