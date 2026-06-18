const http = require('http');

const loginData = JSON.stringify({
  email: 'admin@bpo.com', // Assuming standard admin email, adjust if necessary
  password: 'admin' // Adjust if necessary
});

const loginReq = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    if (!parsed.token) {
      console.log('Login failed:', parsed);
      return;
    }
    const token = parsed.token;
    
    // Now get evaluations
    http.get({
      hostname: 'localhost',
      port: 5000,
      path: '/api/evaluations',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res2) => {
      let data2 = '';
      res2.on('data', d => data2 += d);
      res2.on('end', () => {
        console.log('Evaluations Response:', data2);
      });
    });
  });
});

loginReq.write(loginData);
loginReq.end();
