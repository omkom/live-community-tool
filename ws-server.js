const express = require('express');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const PORT = 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
let sockets = [];

app.use(express.static(__dirname));
app.use(express.json());

app.get('/stream24h.json', (req, res) => {
  fs.readFile('./stream24h.json', 'utf8', (err, data) => {
    if (err) return res.status(500).send('Erreur lecture JSON');
    res.send(data);
  });
});

app.post('/stream24h.json', (req, res) => {
  const json = JSON.stringify(req.body, null, 2);
  fs.writeFile('./stream24h.json', json, 'utf8', (err) => {
    if (err) return res.status(500).send('Erreur écriture JSON');
    sockets.forEach(ws => ws.send('update'));
    res.send({ status: 'ok' });
  });
});

app.post('/status.json', (req, res) => {
    const json = JSON.stringify(req.body, null, 2);
    fs.writeFile('./status.json', json, 'utf8', (err) => {
      if (err) return res.status(500).send('Erreur écriture status.json');
      sockets.forEach(ws => ws.send('update'));
      res.send({ status: 'ok' });
    });
  });

  app.post('/effect', (req, res) => {
    const { type } = req.body;
    sockets.forEach(ws => ws.send(JSON.stringify({ type: 'effect', value: type })));
    res.send({ status: 'triggered' });
  });
  
  app.post('/message', (req, res) => {
    const { message } = req.body;
    sockets.forEach(ws => ws.send(JSON.stringify({ type: 'message', value: message })));
    res.send({ status: 'sent' });
  });
  

wss.on('connection', (ws) => {
  sockets.push(ws);
  ws.on('close', () => sockets = sockets.filter(s => s !== ws));
});

server.listen(PORT, () => {
  console.log(`✅ Serveur WebSocket + Express actif sur http://localhost:${PORT}`);
});
