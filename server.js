const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3000;

// Middleware pour servir les fichiers statiques (index.html, script.js, etc.)
app.use(express.static(__dirname));
app.use(express.json());

// Route pour récupérer le fichier JSON
app.get('/stream24h.json', (req, res) => {
  fs.readFile('./stream24h.json', 'utf8', (err, data) => {
    if (err) return res.status(500).send('Erreur lecture JSON');
    res.send(data);
  });
});

// Route pour mettre à jour le fichier JSON
app.post('/stream24h.json', (req, res) => {
  const json = JSON.stringify(req.body, null, 2);
  fs.writeFile('./stream24h.json', json, 'utf8', (err) => {
    if (err) return res.status(500).send('Erreur écriture JSON');
    res.send({ status: 'ok' });
  });
});

// Route POST pour mettre à jour le statut
app.post('/status.json', (req, res) => {
    const json = JSON.stringify(req.body, null, 2);
    fs.writeFile('./status.json', json, 'utf8', (err) => {
      if (err) return res.status(500).send('Erreur écriture status.json');
      sockets.forEach(ws => ws.send('update')); // Pour le refresh live si besoin
      res.send({ status: 'ok' });
    });
  });

app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
