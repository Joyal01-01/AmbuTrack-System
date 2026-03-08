import axios from "axios";

const api = axios.create({

baseURL: (typeof window !== 'undefined' && window.__BACKEND_URL__) ? window.__BACKEND_URL__ : "http://localhost:5001"

})

export default api;