// server.js - Serveur avec OAuth Twitch intégré
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const TwitchChat = require('./server/twitch');

// Variable globale pour le chat
let twitchChat = null;

// Modules serveur
const logger = require('./server/logger');
const validate = require('./server/validator');
const TwitchOAuth = require('./server/twitch-oauth');
const TwitchChannelPoints = require('./server/twitch-channel-points');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// Configuration des chemins de données
const DATA_DIR = path.join(__dirname, 'data');
const STREAM_DATA_PATH = path.join(DATA_DIR, 'stream24h.json');
const STATUS_DATA_PATH = path.join(DATA_DIR, 'status.json');

// Instances globales
let twitchOAuth = null;
let channelPointsManager = null;
let connections = new Map();

// Créer le dossier data s'il n'existe pas
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  logger.log('Dossier data créé');
}

// Initialiser les fichiers de données
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

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialisation
initializeDataFiles();

// ======= INITIALISATION OAUTH TWITCH =======

function initializeTwitchOAuth() {
  try {
    twitchOAuth = new TwitchOAuth();
    twitchOAuth.setupRoutes(app);
    
    // Initialiser le chat ET Channel Points si connecté
    if (twitchOAuth.isConnected()) {
      initializeTwitchChat();     // AJOUTER
      initializeChannelPoints();
      setupTwitchChatEvents();    // AJOUTER
    }
    
    logger.log('✅ OAuth Twitch initialisé');
  } catch (error) {
    logger.error(`Erreur initialisation OAuth Twitch: ${error.message}`);
  }
}

function initializeTwitchChat() {
  try {
    const tokens = twitchOAuth.getCurrentTokens();
    if (!tokens) {
      logger.log('Pas de tokens pour le chat Twitch');
      return false;
    }

    // Configurer le chat avec les tokens OAuth
    const chatConfig = {
      enabled: true,
      twitch: {
        clientId: process.env.TWITCH_CLIENT_ID,
        username: tokens.login,
        oauthToken: tokens.access_token,
        channelName: tokens.login
      }
    };

    // Initialiser le module chat
    twitchChat = TwitchChat;
    twitchChat.initialize();
    
    logger.log('✅ Chat Twitch initialisé');
    return true;
  } catch (error) {
    logger.error(`Erreur initialisation chat Twitch: ${error.message}`);
    return false;
  }
}

// Fonction pour écouter les événements de chat
function setupTwitchChatEvents() {
  if (!twitchChat) return;

  // Mots-clés pour déclencher des effets
  const chatEffectKeywords = {
    'perturbation': 'perturbation',
    'perturbation quantique': 'perturbation', 
    '!perturbation': 'perturbation',
    'confetti': 'tada',
    '!confetti': 'tada',
    'flash': 'flash',
    '!flash': 'flash',
    'zoom': 'zoom',
    '!zoom': 'zoom',
    'shake': 'shake',
    '!shake': 'shake',
    'bounce': 'bounce',
    '!bounce': 'bounce',
    'pulse': 'pulse',
    '!pulse': 'pulse'
  };

  // Écouter les événements chat
  twitchChat.on('chat', (data) => {
    const message = data.message.toLowerCase().trim();
    const username = data.username;
    
    logger.log(`Chat reçu: ${username}: ${message}`);
    
    // Chercher un mot-clé dans le message
    for (const [keyword, effect] of Object.entries(chatEffectKeywords)) {
      if (message.includes(keyword)) {
        logger.log(`🎯 Effet chat détecté: ${keyword} → ${effect} par ${username}`);
        
        // Déclencher l'effet via WebSocket
        broadcast({ type: 'effect', value: effect });
        
        // Message de confirmation
        setTimeout(() => {
          broadcast({ 
            type: 'message', 
            value: `${username} a déclenché ${effect} !` 
          });
        }, 1000);
        
        // Événement pour l'admin
        broadcast({ 
          type: 'chat_effect_triggered', 
          data: {
            user: username,
            message: message,
            keyword: keyword,
            effect: effect,
            timestamp: new Date().toISOString()
          }
        });
        
        break;
      }
    }
  });

  logger.log('✅ Écoute des effets chat configurée');
}

function initializeChannelPoints() {
  try {
    if (!twitchOAuth || !twitchOAuth.isConnected()) {
      logger.log('OAuth Twitch non connecté, Channel Points non initialisé');
      return false;
    }

    // Créer le gestionnaire Channel Points avec les tokens OAuth
    channelPointsManager = new TwitchChannelPoints(twitchOAuth);
    
    // Configurer les événements Channel Points
    setupChannelPointsEvents();
    
    logger.log('✅ Channel Points initialisé');
    return true;
  } catch (error) {
    logger.error(`Erreur initialisation Channel Points: ${error.message}`);
    return false;
  }
}

function setupChannelPointsEvents() {
  if (!channelPointsManager) return;

  // Événement de rachat Channel Points
  channelPointsManager.on('redemption', (data) => {
    logger.log(`Channel Points rachetés: ${data.reward.title} par ${data.user.display_name}`);
    
    // Déclencher l'effet correspondant
    if (data.effect) {
      broadcast({ type: 'effect', value: data.effect });
      
      // Envoyer un message après l'effet
      setTimeout(() => {
        broadcast({ 
          type: 'message', 
          value: `${data.user.display_name} a utilisé "${data.reward.title}" !` 
        });
      }, 1000);
    }
    
    // Diffuser l'événement aux clients WebSocket
    broadcast({ 
      type: 'channel_points_event', 
      data: {
        reward: data.reward.title,
        user: data.user.display_name,
        cost: data.reward.cost,
        effect: data.effect,
        timestamp: new Date().toISOString()
      }
    });
  });

  // Événement d'erreur Channel Points
  channelPointsManager.on('error', (error) => {
    logger.error(`Erreur Channel Points: ${error.message}`);
  });
}

function setupTwitchChatEvents() {
  if (!twitchOAuth || !twitchOAuth.isConnected()) {
    return;
  }

  // Mots-clés pour déclencher des effets
  const chatEffectKeywords = {
    'perturbation': 'perturbation',
    'perturbation quantique': 'perturbation', 
    '!perturbation': 'perturbation',
    'confetti': 'tada',
    '!confetti': 'tada',
    'flash': 'flash',
    '!flash': 'flash',
    'zoom': 'zoom',
    '!zoom': 'zoom',
    'shake': 'shake',
    '!shake': 'shake',
    'bounce': 'bounce',
    '!bounce': 'bounce',
    'pulse': 'pulse',
    '!pulse': 'pulse'
  };

  // Écouteur d'événements chat depuis le module Twitch
  const twitch = require('./server/twitch');
  
  twitch.on('chat', (data) => {
    const message = data.message.toLowerCase().trim();
    const username = data.username;
    
    // Chercher un mot-clé dans le message
    for (const [keyword, effect] of Object.entries(chatEffectKeywords)) {
      if (message.includes(keyword)) {
        logger.log(`Effet chat détecté: ${keyword} → ${effect} par ${username}`);
        
        // Déclencher l'effet
        broadcast({ type: 'effect', value: effect });
        
        // Message de confirmation après l'effet
        setTimeout(() => {
          broadcast({ 
            type: 'message', 
            value: `${username} a déclenché ${keyword} !` 
          });
        }, 1000);
        
        // Ne déclencher qu'un seul effet par message
        break;
      }
    }
  });
}

// Initialiser OAuth au démarrage
initializeTwitchOAuth();

// ======= WEBSOCKET =======

wss.on('connection', (ws, req) => {
  const id = Date.now() + Math.random();
  const clientIp = req.socket.remoteAddress;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientType = url.searchParams.get('type') || 'unknown';
  
  connections.set(id, { ws, type: clientType });
  logger.log(`Nouvelle connexion WebSocket: ${clientType} (${clientIp})`);
  
  sendInitialData(ws);
  
  ws.on('close', () => {
    connections.delete(id);
    logger.log(`Déconnexion WebSocket: ${clientType}`);
  });
  
  ws.on('error', (error) => {
    logger.error(`Erreur WebSocket ${clientType}: ${error.message}`);
    connections.delete(id);
  });
});

function sendInitialData(ws) {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'init', status: 'connected' }));
    }
  } catch (err) {
    logger.error(`Erreur envoi données initiales: ${err.message}`);
  }
}

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
          connections.delete(id);
        }
      } catch (err) {
        logger.error(`Erreur diffusion: ${err.message}`);
        connections.delete(id);
      }
    }
  });
  
  if (count > 0) {
    const preview = typeof data === 'string' ? data.substring(0, 50) : JSON.stringify(data).substring(0, 50);
    logger.log(`Message diffusé à ${count} clients: ${preview}...`);
  }
}

// ======= ROUTES API CHANNEL POINTS =======

// GET - Statut des Channel Points
app.get('/api/channel-points/status', (req, res) => {
  try {
    if (!twitchOAuth || !twitchOAuth.isConnected()) {
      return res.json({
        enabled: false,
        monitoring: false,
        message: 'Twitch non connecté'
      });
    }

    if (!channelPointsManager) {
      return res.json({
        enabled: true,
        monitoring: false,
        message: 'Channel Points non initialisé'
      });
    }
    
    const status = channelPointsManager.getStatus();
    
    res.json({
      enabled: true,
      monitoring: status.isMonitoring,
      rewardEffectsCount: status.rewardEffectsCount,
      eventSubscriptionsCount: status.eventSubscriptionsCount,
      lastEventId: status.lastEventId
    });
  } catch (error) {
    logger.error(`Erreur statut Channel Points: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// POST - Démarrer/Arrêter surveillance Channel Points
app.post('/api/channel-points/monitoring/:action', async (req, res) => {
  try {
    const { action } = req.params;
    
    if (!twitchOAuth || !twitchOAuth.isConnected()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Twitch non connecté' 
      });
    }

    // Initialiser Channel Points si nécessaire
    if (!channelPointsManager) {
      const initialized = initializeChannelPoints();
      if (!initialized) {
        return res.status(400).json({ 
          success: false, 
          error: 'Impossible d\'initialiser Channel Points' 
        });
      }
    }
    
    let result = false;
    
    if (action === 'start') {
      result = await channelPointsManager.startMonitoring();
    } else if (action === 'stop') {
      channelPointsManager.stopMonitoring();
      result = true;
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Action invalide' 
      });
    }
    
    const status = channelPointsManager.getStatus();
    
    res.json({
      success: result,
      monitoring: status.isMonitoring,
      message: result ? 
        `Surveillance ${action === 'start' ? 'démarrée' : 'arrêtée'}` :
        `Impossible de ${action === 'start' ? 'démarrer' : 'arrêter'} la surveillance`
    });
    
    logger.log(`Channel Points monitoring ${action}: ${result ? 'succès' : 'échec'}`);
    
  } catch (error) {
    logger.error(`Erreur ${req.params.action} monitoring: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET - Récompenses disponibles
app.get('/api/channel-points/rewards', async (req, res) => {
  try {
    if (!channelPointsManager) {
      return res.json({ success: true, rewards: [], count: 0 });
    }
    
    const rewards = await channelPointsManager.getAvailableRewards();
    
    res.json({
      success: true,
      rewards: rewards,
      count: rewards.length
    });
    
  } catch (error) {
    logger.error(`Erreur récupération récompenses: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      rewards: []
    });
  }
});

// POST - Configurer mappings effets
app.post('/api/channel-points/configure', (req, res) => {
  try {
    const { rewardEffects } = req.body;
    
    if (!channelPointsManager) {
      return res.status(400).json({ 
        success: false, 
        error: 'Channel Points non initialisé' 
      });
    }
    
    if (!rewardEffects || typeof rewardEffects !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Configuration invalide' 
      });
    }
    
    channelPointsManager.configureRewardEffects(rewardEffects);
    
    res.json({
      success: true,
      message: 'Configuration mise à jour',
      mappingsCount: Object.keys(rewardEffects).length
    });
    
    logger.log(`Channel Points configuré: ${Object.keys(rewardEffects).length} mappings`);
    
  } catch (error) {
    logger.error(`Erreur configuration: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST - Test effet
app.post('/api/channel-points/test-effect', async (req, res) => {
  try {
    const { effectType, userName = 'TestUser', rewardTitle = 'Test' } = req.body;
    
    if (!effectType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Type d\'effet requis' 
      });
    }
    
    const validEffects = ['perturbation', 'tada', 'flash', 'zoom', 'shake', 'bounce', 'pulse'];
    if (!validEffects.includes(effectType)) {
      return res.status(400).json({ 
        success: false, 
        error: `Effet invalide: ${validEffects.join(', ')}` 
      });
    }
    
    // Déclencher l'effet
    broadcast({ type: 'effect', value: effectType });
    
    setTimeout(() => {
      broadcast({ 
        type: 'message', 
        value: `🧪 TEST: ${userName} a utilisé "${rewardTitle}" !` 
      });
    }, 1000);
    
    res.json({
      success: true,
      message: `Effet "${effectType}" déclenché`,
      effect: effectType
    });
    
    logger.log(`Test effet: ${effectType} pour ${userName}`);
    
  } catch (error) {
    logger.error(`Erreur test effet: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST - Nettoyer événements
app.post('/api/channel-points/cleanup', (req, res) => {
  try {
    if (channelPointsManager) {
      channelPointsManager.cleanupOldEvents();
    }
    
    res.json({
      success: true,
      message: 'Nettoyage effectué'
    });
    
    logger.log('Nettoyage manuel Channel Points');
    
  } catch (error) {
    logger.error(`Erreur nettoyage: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ======= ROUTES API STANDARD =======

// Planning
app.get('/api/planning', (req, res) => {
  try {
    const data = fs.readFileSync(STREAM_DATA_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    logger.error(`Erreur lecture planning: ${err.message}`);
    res.status(500).json({ error: 'Erreur lecture planning' });
  }
});

app.post('/api/planning', (req, res) => {
  try {
    const data = req.body;
    
    if (!data.planning || !Array.isArray(data.planning)) {
      return res.status(400).json({ error: 'Format invalide' });
    }
    
    for (const item of data.planning) {
      if (!validate.planningItem(item)) {
        return res.status(400).json({ error: 'Élément invalide' });
      }
    }

    data.planning.sort((a, b) => a.time.localeCompare(b.time));
    fs.writeFileSync(STREAM_DATA_PATH, JSON.stringify(data, null, 2));
    
    broadcast({ type: 'update', target: 'planning' });
    
    logger.log('Planning mis à jour');
    res.json({ status: 'success' });
  } catch (err) {
    logger.error(`Erreur planning: ${err.message}`);
    res.status(500).json({ error: 'Erreur mise à jour planning' });
  }
});

// Statut
app.get('/api/status', (req, res) => {
  try {
    const data = fs.readFileSync(STATUS_DATA_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    logger.error(`Erreur lecture statut: ${err.message}`);
    res.status(500).json({ error: 'Erreur lecture statut' });
  }
});

app.post('/api/status', (req, res) => {
  try {
    const data = req.body;
    
    if (!validate.statusData(data)) {
      return res.status(400).json({ error: 'Format invalide' });
    }
    
    data.last_update = new Date().toISOString();
    fs.writeFileSync(STATUS_DATA_PATH, JSON.stringify(data, null, 2));
    
    broadcast({ type: 'update', target: 'status' });
    
    logger.log('Statut mis à jour');
    res.json({ status: 'success' });
  } catch (err) {
    logger.error(`Erreur statut: ${err.message}`);
    res.status(500).json({ error: 'Erreur mise à jour statut' });
  }
});

// ======= ROUTES API TWITCH/STREAMLABS =======

// GET - Statut connexion Twitch  
app.get('/api/twitch/status', (req, res) => {
  try {
    const connected = twitchOAuth && twitchOAuth.isConnected();
    res.json({ connected });
  } catch (error) {
    res.status(500).json({ connected: false, error: error.message });
  }
});

// GET - Statut connexion Streamlabs
app.get('/api/streamlabs/status', (req, res) => {
  try {
    // Basé sur la présence de tokens Streamlabs dans la config
    const tokens = twitchOAuth ? twitchOAuth.getCurrentTokens() : null;
    const connected = tokens && process.env.STREAMLABS_SOCKET_TOKEN;
    res.json({ connected: !!connected });
  } catch (error) {
    res.status(500).json({ connected: false, error: error.message });
  }
});

// Effets
app.post('/api/effect', (req, res) => {
  try {
    const { type } = req.body;
    
    if (!type || typeof type !== 'string') {
      return res.status(400).json({ error: 'Type effet manquant' });
    }
    
    const validEffects = ['perturbation', 'tada', 'flash', 'zoom', 'shake', 'bounce', 'pulse'];
    if (!validEffects.includes(type)) {
      return res.status(400).json({ error: 'Type effet invalide' });
    }
    
    broadcast({ type: 'effect', value: type });
    
    logger.log(`Effet déclenché: ${type}`);
    res.json({ status: 'triggered' });
  } catch (err) {
    logger.error(`Erreur effet: ${err.message}`);
    res.status(500).json({ error: 'Erreur effet' });
  }
});

// Messages
app.post('/api/message', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string' || message.length > 200) {
      return res.status(400).json({ error: 'Message invalide' });
    }
    
    broadcast({ type: 'message', value: message });
    
    logger.log(`Message envoyé: ${message.substring(0, 30)}...`);
    res.json({ status: 'sent' });
  } catch (err) {
    logger.error(`Erreur message: ${err.message}`);
    res.status(500).json({ error: 'Erreur message' });
  }
});

// Logs
app.get('/api/logs', (req, res) => {
  try {
    const logs = logger.getLogs();
    res.json({ logs });
  } catch (err) {
    logger.error(`Erreur logs: ${err.message}`);
    res.status(500).json({ error: 'Erreur logs' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    connections: connections.size,
    uptime: process.uptime(),
    twitch: {
      oauth_connected: twitchOAuth ? twitchOAuth.isConnected() : false,
      channel_points: {
        initialized: !!channelPointsManager,
        monitoring: channelPointsManager ? channelPointsManager.getStatus().isMonitoring : false
      }
    }
  });
});

// Gestion des erreurs
process.on('uncaughtException', (error) => {
  logger.error(`Erreur non capturée: ${error.message}`);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Promesse rejetée: ${reason}`);
});

// Démarrage du serveur
server.listen(PORT, () => {
  logger.log(`✨ Serveur Stream 24h démarré sur le port ${PORT}`);
  logger.log(`🌐 Interface publique: http://localhost:${PORT}`);
  logger.log(`⚙️  Interface admin: http://localhost:${PORT}/admin.html`);
  logger.log(`📺 Overlay OBS: http://localhost:${PORT}/overlay/`);
  logger.log(`📊 Status OBS: http://localhost:${PORT}/status.html`);
  logger.log(`💬 WebSocket: ${connections.size} connexions`);
  logger.log(`🎮 Twitch OAuth: ${twitchOAuth ? (twitchOAuth.isConnected() ? 'Connecté' : 'Déconnecté') : 'Non initialisé'}`);
  logger.log(`💎 Channel Points: ${channelPointsManager ? 'Initialisé' : 'Non initialisé'}`);
});