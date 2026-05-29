const http = require('http');

const payload = JSON.stringify({
  firstName: 'Test',
  lastName: 'User',
  email: 'copilot-test-6@example.com',
  password: 'StrongP@ss123!',
  confirmPassword: 'StrongP@ss123!',
  userType: 'guest',
});

const req = http.request('http://127.0.0.1:3001/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}, (res) => {
  let data = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('BODY', data);
  });
});

req.setTimeout(35000, () => {
  console.error('TIMEOUT');
  req.destroy();
});
req.on('error', (err) => {
  console.error('ERR', err);
  process.exitCode = 1;
});
req.write(payload);
req.end();
