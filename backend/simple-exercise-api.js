const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.url === '/api/exercises' && req.method === 'GET') {
    try {
      const jsonPath = path.join(__dirname, 'exercises.json');
      const jsonData = fs.readFileSync(jsonPath, 'utf8');
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(jsonData);
      console.log('Served exercises data');
    } catch (error) {
      console.error('Error serving exercises:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load exercises' }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Exercise API server running on port ${PORT}`);
});
