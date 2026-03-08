import axios from 'axios';

const BASE = 'http://localhost:5001';

async function run(){
  try{
    console.log('Registering...');
    const reg = await axios.post(BASE + '/register', { name:'E2E Patient', email:'e2e_patient@test.local', password:'pass123', role:'patient' });
    console.log('Register response:', reg.data);
  }catch(e){ console.error('Register error:', e.response?.data || e.message) }

  try{
    console.log('Logging in...');
    const login = await axios.post(BASE + '/login', { email:'e2e_patient@test.local', password:'pass123' });
    console.log('Login response:', login.data);
    const token = login.data.token;

    console.log('Creating ride request...');
    const create = await axios.post(BASE + '/ride-request', { lat:27.7172, lng:85.3240 }, { headers: { 'x-auth-token': token } });
    console.log('Create response:', create.data);

    console.log('Listing ride requests...');
    const list = await axios.get(BASE + '/ride-requests');
    console.log('Ride requests:', list.data);
  }catch(e){ console.error('Error:', e.response?.data || e.message) }
}

run();
