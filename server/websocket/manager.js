// server/websocket/manager.js - Gestionnaire WebSocket optimisé
const WebSocket = require('ws');
const EventEmitter = require('events');
const logger = require('../logger');

class WebSocketManager extends EventEmitter {
  constructor(server, config) {
    super();
    
    this.server = server;
    this.config = config;
    this.wss = null;
    this.connections = new Map();
    this.stats = {
      totalConnections: 0,
      currentConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      startTime: Date.now()
    };
    
    // Intervals de maintenance
    this.cleanupInterval = null;
    this.heartbeatInterval = null;
    this.statsInterval = null;
    
    this.initialize();
  }

  initialize() {
    try {
      // Créer le serveur WebSocket
      this.wss = new WebSocket.Server({ 
        server: this.server,
        perMessageDeflate: false,
        maxPayload: 1024 * 1024, // 1MB max
        clientTracking: false // On gère nous-mêmes
      });

      this.setupEvents();
      this.startMaintenance();
      
      logger.log('✅ WebSocket Manager initialisé');
    } catch (error) {
      logger.error(`Erreur initialisation WebSocket: ${error.message}`);
      throw error;
    }
  }

  setupEvents() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error(`Erreur serveur WebSocket: ${error.message}`);
      this.emit('error', error);
    });

    // Événements de processus pour nettoyage
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  handleConnection(ws, req) {
    const connectionId = this.generateConnectionId();
    const clientInfo = this.extractClientInfo(req);
    
    // Vérifier les limites
    if (this.connections.size >= this.config.get('websocket.maxConnections')) {
      logger.log(`Connexion refusée: limite atteinte (${this.connections.size})`);
      ws.close(1013, 'Server overloaded');
      return;
    }

    // Créer l'objet connexion
    const connection = {
      id: connectionId,
      ws,
      type: clientInfo.type,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      messageCount: 0,
      isAlive: true
    };

    // Enregistrer la connexion
    this.connections.set(connectionId, connection);
    this.updateStats('connection');

    logger.log(`📡 Nouvelle connexion WebSocket: ${clientInfo.type} (${clientInfo.ip}) - Total: ${this.connections.size}`);

    // Configurer les événements de la connexion
    this.setupConnectionEvents(connection);
    
    // Envoyer les données initiales
    this.sendInitialData(connection);
    
    // Émettre l'événement
    this.emit('connection', connection);
  }

  setupConnectionEvents(connection) {
    const { ws, id } = connection;

    // Message reçu
    ws.on('message', (data) => {
      this.handleMessage(connection, data);
    });

    // Ping/Pong pour heartbeat
    ws.on('pong', () => {
      connection.isAlive = true;
      connection.lastSeen = Date.now();
    });

    // Fermeture de connexion
    ws.on('close', (code, reason) => {
      this.handleDisconnection(connection, code, reason);
    });

    // Erreur de connexion
    ws.on('error', (error) => {
      logger.error(`Erreur connexion WebSocket ${id}: ${error.message}`);
      this.handleDisconnection(connection, 1006, 'Connection error');
    });
  }

  handleMessage(connection, rawData) {
    try {
      connection.messageCount++;
      connection.lastSeen = Date.now();
      this.updateStats('messageReceived');

      // Limiter la taille des messages
      if (rawData.length > 10240) { // 10KB max
        logger.log(`Message trop volumineux de ${connection.id}: ${rawData.length} bytes`);
        return;
      }

      // Parser le message
      let message;
      try {
        message = JSON.parse(rawData.toString());
      } catch (parseError) {
        logger.log(`Message JSON invalide de ${connection.id}: ${parseError.message}`);
        return;
      }

      // Throttling des messages
      const now = Date.now();
      if (!connection.lastMessageTime) {
        connection.lastMessageTime = now;
      } else if (now - connection.lastMessageTime < this.config.get('websocket.messageThrottle')) {
        logger.log(`Message throttlé de ${connection.id}`);
        return;
      }
      connection.lastMessageTime = now;

      // Traiter le message
      this.processMessage(connection, message);

    } catch (error) {
      logger.error(`Erreur traitement message WebSocket: ${error.message}`);
    }
  }

  processMessage(connection, message) {
    // Messages système
    if (message.type === 'ping') {
      this.sendToConnection(connection, { type: 'pong', timestamp: Date.now() });
      return;
    }

    if (message.type === 'subscribe') {
      connection.subscriptions = connection.subscriptions || new Set();
      if (message.channel) {
        connection.subscriptions.add(message.channel);
        logger.log(`${connection.id} souscrit à ${message.channel}`);
      }
      return;
    }

    if (message.type === 'unsubscribe') {
      if (connection.subscriptions && message.channel) {
        connection.subscriptions.delete(message.channel);
        logger.log(`${connection.id} désabonné de ${message.channel}`);
      }
      return;
    }

    // Émettre le message vers l'application
    this.emit('message', {
      connection,
      message,
      timestamp: Date.now()
    });
  }

  handleDisconnection(connection, code, reason) {
    try {
      const { id, type, ip } = connection;
      
      this.connections.delete(id);
      this.updateStats('disconnection');
      
      const duration = Date.now() - connection.connectedAt;
      logger.log(`📡 Déconnexion WebSocket: ${type} (${ip}) - Durée: ${Math.round(duration/1000)}s - Total: ${this.connections.size}`);
      
      this.emit('disconnection', { connection, code, reason });
    } catch (error) {
      logger.error(`Erreur gestion déconnexion: ${error.message}`);
    }
  }

  sendInitialData(connection) {
    try {
      const initData = {
        type: 'init',
        status: 'connected',
        connectionId: connection.id,
        serverTime: Date.now()
      };

      this.sendToConnection(connection, initData);
    } catch (error) {
      logger.error(`Erreur envoi données initiales: ${error.message}`);
    }
  }

  // ======= MÉTHODES DE DIFFUSION =======

  broadcast(data, filter = null) {
    const message = this.prepareMessage(data);
    let count = 0;
    const failures = [];

    this.connections.forEach((connection, id) => {
      if (this.shouldSendToConnection(connection, filter)) {
        if (this.sendToConnection(connection, message)) {
          count++;
        } else {
          failures.push(id);
        }
      }
    });

    // Nettoyer les connexions en échec
    failures.forEach(id => {
      const connection = this.connections.get(id);
      if (connection) {
        this.handleDisconnection(connection, 1006, 'Send failed');
      }
    });

    if (count > 0) {
      this.updateStats('messageSent', count);
      logger.log(`📢 Message diffusé à ${count} clients${failures.length > 0 ? ` (${failures.length} échecs)` : ''}`);
    }

    return { sent: count, failed: failures.length };
  }

  sendToType(data, clientType) {
    return this.broadcast(data, { type: clientType });
  }

  sendToChannel(data, channel) {
    return this.broadcast(data, { channel });
  }

  sendToConnection(connection, data) {
    try {
      if (connection.ws.readyState !== WebSocket.OPEN) {
        return false;
      }

      const message = this.prepareMessage(data);
      connection.ws.send(message);
      return true;
    } catch (error) {
      logger.error(`Erreur envoi à ${connection.id}: ${error.message}`);
      return false;
    }
  }

  // ======= MÉTHODES UTILITAIRES =======

  prepareMessage(data) {
    if (typeof data === 'string') {
      return data;
    }
    
    try {
      return JSON.stringify(data);
    } catch (error) {
      logger.error(`Erreur sérialisation message: ${error.message}`);
      return JSON.stringify({ type: 'error', message: 'Serialization failed' });
    }
  }

  shouldSendToConnection(connection, filter) {
    if (!filter) return true;

    // Filter par type de client
    if (filter.type && connection.type !== filter.type) {
      return false;
    }

    // Filter par canal d'abonnement
    if (filter.channel) {
      if (!connection.subscriptions || !connection.subscriptions.has(filter.channel)) {
        return false;
      }
    }

    // Filter custom
    if (filter.custom && typeof filter.custom === 'function') {
      return filter.custom(connection);
    }

    return true;
  }

  generateConnectionId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  extractClientInfo(req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    return {
      type: url.searchParams.get('type') || 'unknown',
      ip: req.socket.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    };
  }

  // ======= MAINTENANCE ET MONITORING =======

  startMaintenance() {
    // Heartbeat pour détecter les connexions mortes
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, this.config.get('websocket.heartbeatInterval'));

    // Nettoyage périodique
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60000); // 1 minute

    // Stats périodiques
    if (this.config.isDevelopment()) {
      this.statsInterval = setInterval(() => {
        this.logStats();
      }, 300000); // 5 minutes
    }

    logger.log('🔧 Maintenance WebSocket démarrée');
  }

  performHeartbeat() {
    const now = Date.now();
    const staleConnections = [];

    this.connections.forEach((connection, id) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        if (connection.isAlive === false) {
          // Connexion morte détectée
          staleConnections.push(id);
        } else {
          // Envoyer ping
          connection.isAlive = false;
          try {
            connection.ws.ping();
          } catch (error) {
            staleConnections.push(id);
          }
        }
      } else {
        staleConnections.push(id);
      }
    });

    // Nettoyer les connexions mortes
    staleConnections.forEach(id => {
      const connection = this.connections.get(id);
      if (connection) {
        logger.log(`🧹 Nettoyage connexion morte: ${id}`);
        this.handleDisconnection(connection, 1006, 'Heartbeat failed');
      }
    });

    if (staleConnections.length > 0) {
      logger.log(`❤️ Heartbeat: ${staleConnections.length} connexions nettoyées`);
    }
  }

  performCleanup() {
    // Nettoyer les connexions avec readyState incorrect
    const toClean = [];
    
    this.connections.forEach((connection, id) => {
      if (connection.ws.readyState === WebSocket.CLOSED || 
          connection.ws.readyState === WebSocket.CLOSING) {
        toClean.push(id);
      }
    });

    toClean.forEach(id => {
      this.connections.delete(id);
    });

    if (toClean.length > 0) {
      logger.log(`🧹 Nettoyage: ${toClean.length} connexions fermées`);
    }

    // Forcer garbage collection si trop de connexions inactives
    if (global.gc && this.connections.size < this.stats.totalConnections * 0.1) {
      global.gc();
    }
  }

  logStats() {
    const uptime = Date.now() - this.stats.startTime;
    const avgConnectionTime = this.connections.size > 0 ? 
      Array.from(this.connections.values())
        .reduce((sum, conn) => sum + (Date.now() - conn.connectedAt), 0) / this.connections.size :
      0;

    logger.log(`📊 WebSocket Stats - Connexions: ${this.connections.size} | Messages: ${this.stats.messagesSent}↗/${this.stats.messagesReceived}↙ | Uptime: ${Math.round(uptime/1000)}s | Avg durée: ${Math.round(avgConnectionTime/1000)}s`);
  }

  updateStats(type, count = 1) {
    switch (type) {
      case 'connection':
        this.stats.totalConnections += count;
        this.stats.currentConnections = this.connections.size;
        break;
      case 'disconnection':
        this.stats.currentConnections = this.connections.size;
        break;
      case 'messageSent':
        this.stats.messagesSent += count;
        break;
      case 'messageReceived':
        this.stats.messagesReceived += count;
        break;
    }
  }

  // ======= MÉTHODES PUBLIQUES =======

  getStats() {
    return {
      ...this.stats,
      currentConnections: this.connections.size,
      uptime: Date.now() - this.stats.startTime
    };
  }

  getConnections() {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      type: conn.type,
      ip: conn.ip,
      connectedAt: conn.connectedAt,
      messageCount: conn.messageCount,
      isAlive: conn.isAlive
    }));
  }

  getConnectionsByType() {
    const types = {};
    this.connections.forEach(conn => {
      types[conn.type] = (types[conn.type] || 0) + 1;
    });
    return types;
  }

  closeConnection(connectionId, code = 1000, reason = '') {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.close(code, reason);
      return true;
    }
    return false;
  }

  shutdown() {
    logger.log('🔌 Arrêt du WebSocket Manager...');

    // Arrêter les intervals
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.statsInterval) clearInterval(this.statsInterval);

    // Fermer toutes les connexions proprement
    this.connections.forEach((connection, id) => {
      try {
        connection.ws.close(1001, 'Server shutdown');
      } catch (error) {
        // Ignorer les erreurs de fermeture
      }
    });

    // Fermer le serveur WebSocket
    if (this.wss) {
      this.wss.close();
    }

    this.connections.clear();
    logger.log('✅ WebSocket Manager arrêté');
  }
}

module.exports = WebSocketManager;