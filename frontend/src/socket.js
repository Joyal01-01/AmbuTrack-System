import { io } from "socket.io-client";

const BACKEND = (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : "http://localhost:5001";

function createSocket(){
	try{
		const raw = localStorage.getItem('user');
		const user = raw ? JSON.parse(raw) : null;
		const token = user?.token;
		// pass token via auth so backend can verify at connect time
		return io(BACKEND, { auth: { token } });
	}catch(e){
		return io(BACKEND);
	}
}

export const socket = createSocket();