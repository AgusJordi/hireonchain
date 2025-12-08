const http = require('http');

const data = JSON.stringify({
  username: "vladyweb3",
  email: "viktortrynovp@gmail.com",
  password: "IX8FZJ0n!",
  walletAddress: "45fRF3tyy2Gu5k8VdZPdRWnHJFGZEUJGFKzB9EFBZ8AF",
  role: "freelancer",
  skills: ["JavaScript", "React", "Node.js"],
  bio: "Test user"
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/users',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();