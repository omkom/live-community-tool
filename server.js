// server.js - Point d'entrée serveur unifié (Express + WebSocket)
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Modules serveur
const logger = require('./server/logger');
const validate = require('./server/validator');
const twitch = require('./server/twitch');

const TwitchMonitor = require('./server/twitch-monitor');
const TwitchApiController = require('./server/controllers/twitch-api');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// Configuration des chemins de données
const DATA_DIR = path.join(__dirname, 'data');
const STREAM_DATA_PATH = path.join(DATA_DIR, 'stream24h.json');
const STATUS_DATA_PATH = path.join(DATA_DIR, 'status.json');

// Créer le dossier data s'il n'existe pas
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialiser les fichiers s'ils n'existent pas
if (!fs.existsSync(STREAM_DATA_PATH)) {
  fs.writeFileSync(STREAM_DATA_PATH, JSON.stringify({
    planning: []
  }, null, 2));
}

if (!fs.existsSync(STATUS_DATA_PATH)) {
  fs.writeFileSync(STATUS_DATA_PATH, JSON.stringify({
    donation_total: 0,
    donation_goal: 1000,
    subs_total: 0,
    subs_goal: 50,
    last_update: new Date().toISOString()
  }, null, 2));
}

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Stocke les connexions WebSocket
let connections = new Map();

// Gestion des WebSockets
wss.on('connection', (ws, req) => {
  const id = Date.now();
  const clientIp = req.socket.remoteAddress;
  const clientType = req.url.includes('type=') 
    ? new URLSearchParams(req.url.slice(req.url.indexOf('?'))).get('type') 
    : 'unknown';
  
  // Enregistrement du client
  connections.set(id, { ws, type: clientType });
  logger.log(`Nouvelle connexion WebSocket: ${clientType} (${clientIp})`);
  
  // Envoyer les données initiales
  sendInitialData(ws);
  
  ws.on('close', () => {
    connections.delete(id);
    logger.log(`Déconnexion WebSocket: ${clientType} (${clientIp})`);
  });
});

// Envoi des données initiales à un client
function sendInitialData(ws) {
  try {
    ws.send(JSON.stringify({ type: 'init', status: 'connected' }));
  } catch (err) {
    logger.error(`Erreur d'envoi des données initiales: ${err.message}`);
  }
}

// Diffusion aux clients WebSocket
function broadcast(data, filterType = null) {
  const message = typeof data === 'string' ? data : JSON.stringify(data);
  let count = 0;
  
  connections.forEach((client) => {
    if (!filterType || client.type === filterType) {
      try {
        client.ws.send(message);
        count++;
      } catch (err) {
        logger.error(`Erreur de diffusion: ${err.message}`);
      }
    }
  });
  
  logger.log(`Message diffusé à ${count} clients: ${typeof data === 'string' ? data.substring(0, 30) : JSON.stringify(data).substring(0, 30)}...`);
}

// Create a new section in server.js before the routes section:
// ======= TWITCH INTEGRATION =======

// Initialize the Twitch Monitor
const twitchMonitor = new TwitchMonitor(twitch);

// Initialize the Twitch API controller
const twitchApiController = new TwitchApiController(twitch, twitchMonitor);

// Register Twitch API routes
twitchApiController.registerRoutes(app);

// Monitor event handling
twitchMonitor.on('connection:error', (data) => {
  logger.error(`Twitch connection error: ${data.error}`);
});

twitchMonitor.on('subscriptions:synced', (data) => {
  logger.log(`Twitch subscriptions synced: ${data.count} total subs`);
});

// Start monitoring if Twitch integration is enabled
if (twitch.getConfig().enabled) {
  twitchMonitor.start();
}

// Add subscription sync handling to the existing Twitch events
twitch.on('subscription', async (data) => {
  // This code should be added to the existing subscription handler in server.js
  // Update the subscription count
  try {
    const statusPath = STATUS_DATA_PATH;
    let status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    
    // Increment subscription count
    status.subs_total = (parseInt(status.subs_total) || 0) + 1;
    status.last_update = new Date().toISOString();
    
    // Save updated status
    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
    
    // Notify clients
    broadcast({ type: 'update', target: 'status' });
    
    // Log the event
    logger.log(`New subscription from ${data.username}, updated total: ${status.subs_total}`);
    
    // Additional event handling logic can remain the same...
  } catch (err) {
    logger.error(`Error updating subscription count: ${err.message}`);
  }
});

// ======= ROUTES API =======

// GET planning
app.get('/api/planning', (req, res) => {
  try {
    const data = fs.readFileSync(STREAM_DATA_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    logger.error(`Erreur lecture planning: ${err.message}`);
    res.status(500).json({ error: 'Erreur lors de la lecture du planning' });
  }
});

// POST planning
app.post('/api/planning', (req, res) => {
  try {
    const data = req.body;
    
    // Validation des données
    if (!data.planning || !Array.isArray(data.planning)) {
      return res.status(400).json({ error: 'Format de données invalide' });
    }
    
    // Validation de chaque élément
    for (const item of data.planning) {
      if (!validate.planningItem(item)) {
        return res.status(400).json({ 
          error: 'Format d\'élément invalide', 
          details: 'Chaque élément doit avoir time, label et checked' 
        });
      }
    }

    // Trier par heure
    data.planning.sort((a, b) => a.time.localeCompare(b.time));
    
    fs.writeFileSync(STREAM_DATA_PATH, JSON.stringify(data, null, 2));
    
    // Notifier tous les clients
    broadcast({ type: 'update', target: 'planning' });
    
    logger.log('Planning mis à jour');
    res.json({ status: 'success' });
  } catch (err) {
    logger.error(`Erreur mise à jour planning: ${err.message}`);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du planning' });
  }
});

// GET status
app.get('/api/status', (req, res) => {
  try {
    const data = fs.readFileSync(STATUS_DATA_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    logger.error(`Erreur lecture status: ${err.message}`);
    res.status(500).json({ error: 'Erreur lors de la lecture du statut' });
  }
});

// POST status
app.post('/api/status', (req, res) => {
  try {
    const data = req.body;
    
    // Validation des données
    if (!validate.statusData(data)) {
      return res.status(400).json({ error: 'Format de données invalide' });
    }
    
    // Mettre à jour la date
    data.last_update = new Date().toISOString();
    
    fs.writeFileSync(STATUS_DATA_PATH, JSON.stringify(data, null, 2));
    
    // Notifier tous les clients
    broadcast({ type: 'update', target: 'status' });
    
    logger.log('Statut mis à jour');
    res.json({ status: 'success' });
  } catch (err) {
    logger.error(`Erreur mise à jour statut: ${err.message}`);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

// POST effect
app.post('/api/effect', (req, res) => {
  try {
    const { type } = req.body;
    
    if (!type || typeof type !== 'string') {
      return res.status(400).json({ error: 'Type d\'effet manquant ou invalide' });
    }
    
    // Valider le type d'effet
    const validEffects = ['tada', 'flash', 'zoom', 'shake', 'bounce', 'pulse'];
    if (!validEffects.includes(type)) {
      return res.status(400).json({ 
        error: 'Type d\'effet non supporté',
        valid: validEffects.join(', ')
      });
    }
    
    // Diffuser l'effet
    broadcast({ type: 'effect', value: type });
    
    logger.log(`Effet déclenché: ${type}`);
    res.json({ status: 'triggered' });
  } catch (err) {
    logger.error(`Erreur déclenchement effet: ${err.message}`);
    res.status(500).json({ error: 'Erreur lors du déclenchement de l\'effet' });
  }
});

// POST message
app.post('/api/message', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string' || message.length > 200) {
      return res.status(400).json({ 
        error: 'Message manquant ou invalide',
        details: 'Le message doit être une chaîne de moins de 200 caractères'
      });
    }
    
    // Diffuser le message
    broadcast({ type: 'message', value: message });
    
    logger.log(`Message envoyé: ${message.substring(0, 30)}...`);
    res.json({ status: 'sent' });
  } catch (err) {
    logger.error(`Erreur envoi message: ${err.message}`);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

// GET logs
app.get('/api/logs', (req, res) => {
  try {
    const logs = logger.getLogs();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
  }
});

// Routes Twitch
app.get('/api/twitch/status', (req, res) => {
  res.json({
    enabled: twitch.getConfig().enabled,
    connected: twitch.getConfig().enabled && twitch.getConfig().twitch.channelName
  });
});

app.post('/api/twitch/config', (req, res) => {
  try {
    const { enabled, ...config } = req.body;
    
    if (typeof enabled === 'boolean') {
      twitch.setEnabled(enabled);
    }
    
    if (Object.keys(config).length > 0) {
      twitch.initialize(config);
    }
    
    res.json({
      success: true,
      config: twitch.getConfig()
    });
  } catch (err) {
    logger.error(`Erreur de configuration Twitch: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Configurer les événements Twitch
twitch.on('donation', (data) => {
  // Déclencher un effet et un message
  broadcast({ type: 'effect', value: 'tada' });
  broadcast({ type: 'message', value: `${data.username} a donné ${data.amount}${data.currency}!` });
  
  // Log de l'événement
  logger.activity('twitch_donation', data);
});

twitch.on('subscription', (data) => {
  broadcast({ type: 'effect', value: 'pulse' });
  broadcast({ type: 'message', value: `${data.username} s'est abonné${data.isResub ? ' pour ' + data.months + ' mois' : ''}!` });
  
  logger.activity('twitch_subscription', data);
});

twitch.on('follow', (data) => {
  broadcast({ type: 'message', value: `${data.username} suit maintenant la chaîne!` });
  
  logger.activity('twitch_follow', data);
});

twitch.on('cheer', (data) => {
  broadcast({ type: 'effect', value: 'bounce' });
  broadcast({ type: 'message', value: `${data.username} a donné ${data.bits} bits!` });
  
  logger.activity('twitch_cheer', data);
});

// Initialiser l'intégration Twitch
twitch.initialize().then(success => {
  if (success) {
    logger.log('Intégration Twitch initialisée');
  } else {
    logger.log('Intégration Twitch non initialisée ou désactivée');
  }
});

// Démarrage du serveur
server.listen(PORT, () => {
  logger.log(`✨ Serveur démarré sur http://localhost:${PORT}`);
});