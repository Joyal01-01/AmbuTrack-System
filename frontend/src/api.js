import axios from "axios";

// Default candidate URLs to try. If you run the backend on a different port,
// set `window.__BACKEND_URL__` before the app loads (e.g. in index.html).
const DEFAULT_CANDIDATES = [
	(typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : null,
	'http://localhost:5001',
	'http://localhost:5002',
	'http://localhost:5003'
].filter(Boolean);

const api = axios.create({ baseURL: DEFAULT_CANDIDATES[0] });

// Helper to update baseURL at runtime
export function setBackendUrl(url){
	api.defaults.baseURL = url;
}

// Probe function: try /ambulances on candidate hosts and switch to the first that responds
async function probeBackend(){
	const timeoutMs = 1000;
	for(const candidate of DEFAULT_CANDIDATES){
		try{
			const controller = new AbortController();
			const id = setTimeout(()=>controller.abort(), timeoutMs);
			const res = await fetch(candidate + '/ambulances', { method: 'GET', signal: controller.signal, mode: 'cors' });
			clearTimeout(id);
			if(res && res.ok){
				// found a working backend
				api.defaults.baseURL = candidate;
				return;
			}
		}catch(e){
			// ignore and try next
		}
	}
}

// Run probe in background; don't block module initialization
probeBackend().catch(()=>{});

export default api;