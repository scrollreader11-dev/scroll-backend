import { createServer } from 'node:http';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';

const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Scroll Unblocker Backend — online');
});

httpServer.on('upgrade', (req, socket, head) => {
  wisp.routeRequest(req, socket, head);
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Scroll Unblocker backend running on port ${PORT}`);
});
