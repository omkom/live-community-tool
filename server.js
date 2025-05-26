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
  logger.log('Dossier data créé');
}

// Initialiser les fichiers s'ils n'existent pas
function initializeDataFiles() {
  if (!fs.existsSync(STREAM_DATA_PATH)) {
    const defaultPlanning = {
      planning: [
        { time: "10:30", label: "Ouverture + café avec la commu", checked: false },
        { time: "12:00", label: "Jeu co-streamé #1", checked: false },
        { time: "14:00", label: "Moment #1 : Le chat décide !", checked: false },
        { time: "16:00", label: "Dev en live avec la commu", checked: false },
        { time: "18:00", label: "Cuisine du soir + échanges", checked: false },
        { time: "20:00", label: "Stream musical", checked: false }
      ]
    };
    fs.writeFileSync(STREAM_DATA_PATH, JSON.stringify(defaultPlanning, null, 2));
    logger.log('Fichier de planning initialisé');
  }

  if (!fs.existsSync(STATUS_DATA_PATH)) {
    const defaultStatus = {
      donation_total: 0,
      donation_goal: 1000,
      subs_total: 0,
      subs_goal: 50,
      stream_start_time: null,
      last_update: new Date().toISOString()
    };
    fs.writeFileSync(STATUS_DATA_PATH, JSON.stringify(defaultStatus, null, 2));
    logger.log('Fichier de statut initialisé');
  }
}

// Initialiser les fichiers de données
initializeDataFiles();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Stocke les connexions WebSocket
let connections = new Map();

// Gestion des WebSockets
wss.on('connection', (ws, req) => {
  const id = Date.now() + Math.random();
  const clientIp = req.socket.remoteAddress;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientType = url.searchParams.get('type') || 'unknown';
  
  // Enregistrement du client
  connections.set(id, { ws, type: clientType });
  logger.log(`Nouvelle connexion WebSocket: ${clientType} (${clientIp})`);
  
  // Envoyer les données initiales
  sendInitialData(ws);
  
  ws.on('close', () => {
    connections.delete(id);
    logger.log(`Déconnexion WebSocket: ${clientType} (${clientIp})`);
  });
  
  ws.on('error', (error) => {
    logger.error(`Erreur WebSocket ${clientType}: ${error.message}`);
    connections.delete(id);
  });
});

// Envoi des données initiales à un client
function sendInitialData(ws) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'init', status: 'connected' }));
    }
  } catch (err) {
    logger.error(`Erreur d'envoi des données initiales: ${err.message}`);
  }
}

// Diffusion aux clients WebSocket
function broadcast(data, filterType = null) {
  const message = typeof data === 'string' ? data : JSON.stringify(data);
  let count = 0;
  
  connections.forEach((client, id) => {
    if (!filterType || client.type === filterType) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message);
          count++;
        } else {
          // Nettoyer les connexions fermées
          connections.delete(id);
        }
      } catch (err) {
        logger.error(`Erreur de diffusion: ${err.message}`);
        connections.delete(id);
      }
    }
  });
  
  if (count > 0) {
    const preview = typeof data === 'string' ? data.substring(0, 50) : JSON.stringify(data).substring(0, 50);
    logger.log(`Message diffusé à ${count} clients: ${preview}...`);
  }
}

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
twitch.initialize().then(success => {
  if (success && twitch.getConfig().enabled) {
    twitchMonitor.start();
    logger.log('Twitch monitor démarré');
  } else {
    logger.log('Intégration Twitch non initialisée ou désactivée');
  }
}).catch(error => {
  logger.error(`Erreur d'initialisation Twitch: ${error.message}`);
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
    logger.error(`Erreur récupération logs: ${err.message}`);
    res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
  }
});

// Configuration des événements Twitch
twitch.on('donation', (data) => {
  // Déclencher un effet et un message
  broadcast({ type: 'effect', value: 'tada' });
  broadcast({ type: 'message', value: `${data.username} a donné ${data.amount}${data.currency}!` });
  
  // Log de l'événement
  logger.activity('twitch_donation', data);
});

twitch.on('subscription', (data) => {
  // Déclencher effet et message
  broadcast({ type: 'effect', value: 'pulse' });
  broadcast({ type: 'message', value: `${data.username} s'est abonné${data.isResub ? ' pour ' + data.months + ' mois' : ''}!` });
  
  // Mettre à jour les statistiques
  try {
    const status = JSON.parse(fs.readFileSync(STATUS_DATA_PATH, 'utf8'));
    status.subs_total = (parseInt(status.subs_total) || 0) + 1;
    status.last_update = new Date().toISOString();
    
    fs.writeFileSync(STATUS_DATA_PATH, JSON.stringify(status, null, 2));
    broadcast({ type: 'update', target: 'status' });
    
    logger.log(`Nouveau abonnement, total: ${status.subs_total}`);
  } catch (err) {
    logger.error(`Erreur mise à jour abonnements: ${err.message}`);
  }
  
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

// Route de test pour vérifier que le serveur fonctionne
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    connections: connections.size,
    uptime: process.uptime()
  });
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error(`Erreur non capturée: ${error.message}`);
  console.error('Stack trace:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Promesse rejetée non gérée: ${reason}`);
  console.error('Promise:', promise);
});

// Démarrage du serveur
server.listen(PORT, () => {
  logger.log(`✨ Serveur Stream 24h démarré`);
  logger.log(`🌐 Interface publique: http://localhost:${PORT}`);
  logger.log(`⚙️  Interface admin: http://localhost:${PORT}/admin.html`);
  logger.log(`📺 Overlay OBS: http://localhost:${PORT}/overlay/`);
  logger.log(`📊 Status OBS: http://localhost:${PORT}/status.html`);
  logger.log(`💬 WebSocket actif avec ${connections.size} connexions`);
});