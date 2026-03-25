

async function testLogin() {
  const res = await fetch('http://localhost:5000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@test.com', password: 'password' })
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
}

testLogin();
