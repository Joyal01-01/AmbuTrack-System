import axios from 'axios';

const BASE = 'http://localhost:5001';

async function run(){
  try{
    console.log('Registering driver...');
    await axios.post(BASE + '/register', { name:'E2E Driver', email:'e2e_driver@test.local', password:'driverpass', role:'driver' });
  }catch(e){ console.error('Driver register error (ok if exists):', e.response?.data || e.message) }

  try{
    console.log('Logging in driver...');
    const login = await axios.post(BASE + '/login', { email:'e2e_driver@test.local', password:'driverpass' });
    console.log('Driver login:', login.data);
    const token = login.data.token;

    // fetch pending requests
    const list = await axios.get(BASE + '/ride-requests');
    console.log('Pending requests:', list.data);
    if(!list.data.length){ console.log('No pending requests to accept'); return }
    const req = list.data[0];
    console.log('Accepting request id', req.id);
    const accept = await axios.post(`${BASE}/ride-request/${req.id}/accept`, {}, { headers: { 'x-auth-token': token } });
    console.log('Accept response:', accept.data);

    // re-list
    const after = await axios.get(BASE + '/ride-requests');
    console.log('After accept, pending:', after.data);
  }catch(e){ console.error('Error:', e.response?.data || e.message) }
}

run();
