const http = require('http');
const https = require('https');

const PORT = 8080;
const OLLAMA_URL = 'http://localhost:11434';

const server = http.createServer((req, res) => {
  // Enable CORS for Chrome extensions
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`${req.method} ${req.url}`);
  
  // Forward request to Ollama
  const options = {
    hostname: 'localhost',
    port: 11434,
    path: req.url,
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    // Forward response headers
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Forward response body
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    console.error('Proxy request error:', err);
    res.writeHead(500);
    res.end('Proxy error');
  });
  
  // Forward request body
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`Ollama proxy server running on http://localhost:${PORT}`);
  console.log('This proxy forwards requests to Ollama at http://localhost:11434');
  console.log('Use this proxy from your Chrome extension to avoid CORS issues');
});
