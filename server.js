// server.js - Point d'entrée refactorisé
const express = require('express');
const http = require('http');
const path = require('path');

// Modules
const { createConfig } = require('./server/config');
const WebSocketManager = require('./server/websocket/manager');
const ServiceManager = require('./server/services');
const RouterManager = require('./server/routes');
const logger = require('./server/logger');

class StreamServer {
  constructor() {
    this.config = null;
    this.app = null;
    this.server = null;
    this.wsManager = null;
    this.serviceManager = null;
    this.routerManager = null;
  }

  async initialize() {
    try {
      // Configuration
      this.config = createConfig();
      logger.log('✅ Configuration initialisée');

      // Express app
      this.app = express();
      this.server = http.createServer(this.app);
      
      // Middleware de base
      this.setupMiddleware();
      
      // WebSocket Manager
      this.wsManager = new WebSocketManager(this.server, this.config);
      
      // Service Manager
      this.serviceManager = new ServiceManager(this.config, this.wsManager);
      
      // Router Manager
      this.routerManager = new RouterManager(this.config, this.serviceManager, this.wsManager);
      
      // Initialiser les données par défaut
      this.initializeDefaultData();
      
      // Routes
      this.setupRoutes();
      
      // Gestion des erreurs
      this.setupErrorHandling();
      
      logger.log('✅ Serveur initialisé');
      
    } catch (error) {
      logger.error(`💥 Erreur initialisation: ${error.message}`);
      throw error;
    }
  }

  setupMiddleware() {
    this.app.use(express.static(this.config.get('paths.publicDir')));
    this.app.use(express.json());

    this.app.use((req, res, next) => {
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('X-Frame-Options', 'DENY');
      res.header('X-XSS-Protection', '1; mode=block');
      next();
    });

    const adminUser = this.config.get('security.adminUser');
    const adminPassword = this.config.get('security.adminPassword');
    if (adminPassword) {
      this.app.use((req, res, next) => {
        const isProtected =
          req.path.startsWith('/admin.html') ||
          req.path.startsWith('/api/') ||
          req.path.startsWith('/auth/twitch');
        if (!isProtected) {
          return next();
        }
        const auth = req.headers.authorization && req.headers.authorization.split(' ');
        if (!auth || auth[0] !== 'Basic' || auth.length !== 2) {
          res.set('WWW-Authenticate', 'Basic realm="Admin area"');
          return res.status(401).send('Authentication required.');
        }
        const [user, pass] = Buffer.from(auth[1], 'base64').toString().split(':');
        if (user === adminUser && pass === adminPassword) {
          return next();
        }
        res.set('WWW-Authenticate', 'Basic realm="Admin area"');
        return res.status(401).send('Authentication required.');
      });
    }
  }

  setupRoutes() {
    // Routes du RouterManager
    this.app.use(this.routerManager.getRouter());
    
    // Route 404
    this.app.use('*', (req, res) => {
      if (req.originalUrl.startsWith('/api/')) {
        res.status(404).json({ error: 'Route API introuvable' });
      } else {
        res.status(404).sendFile(path.join(this.config.get('paths.publicDir'), 'index.html'));
      }
    });
  }

  setupErrorHandling() {
    // Gestion des erreurs Express
    this.app.use((error, req, res, next) => {
      logger.error(`Erreur Express: ${error.message}`);
      
      if (req.originalUrl.startsWith('/api/')) {
        res.status(500).json({ error: 'Erreur serveur interne' });
      } else {
        res.status(500).send('Erreur serveur');
      }
    });

    // Erreurs non capturées
    process.on('uncaughtException', (error) => {
      logger.error(`Erreur non capturée: ${error.message}`);
      console.error('Stack:', error.stack);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error(`Promesse rejetée: ${reason}`);
    });

    // Arrêt gracieux
    const signals = ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
      process.on(signal, () => {
        logger.log(`Signal ${signal} reçu, arrêt en cours...`);
        this.shutdown();
      });
    });
  }

  initializeDefaultData() {
    const fs = require('fs');
    const { dataDir, streamDataPath, statusDataPath } = this.config.get('paths');

    // Créer dossier data
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Planning par défaut
    if (!fs.existsSync(streamDataPath)) {
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
      fs.writeFileSync(streamDataPath, JSON.stringify(defaultPlanning, null, 2));
    }

    // Status par défaut
    if (!fs.existsSync(statusDataPath)) {
      const defaultStatus = {
        donation_total: 0,
        donation_goal: 1000,
        subs_total: 0,
        subs_goal: 50,
        stream_start_time: null,
        last_update: new Date().toISOString()
      };
      fs.writeFileSync(statusDataPath, JSON.stringify(defaultStatus, null, 2));
    }
  }

  async start() {
    try {
      await this.initialize();
      
      // Démarrer les services
      await this.serviceManager.start();
      
      // Démarrer le serveur HTTP
      const port = this.config.get('server.port');
      
      this.server.listen(port, () => {
        this.logStartupInfo(port);
      });
      
    } catch (error) {
      logger.error(`💥 Erreur démarrage: ${error.message}`);
      process.exit(1);
    }
  }

  logStartupInfo(port) {
    const twitchOAuth = this.serviceManager.getTwitchOAuth();
    const channelPoints = this.serviceManager.getChannelPoints();
    
    logger.log(`✨ Serveur Stream 24h démarré sur le port ${port}`);
    logger.log(`🌐 Interface publique: http://localhost:${port}`);
    logger.log(`⚙️  Interface admin: http://localhost:${port}/admin.html`);
    logger.log(`📺 Overlay OBS: http://localhost:${port}/overlay/`);
    logger.log(`📊 Status OBS: http://localhost:${port}/status.html`);
    logger.log(`💬 WebSocket: ${this.wsManager.getStats().currentConnections} connexions`);
    logger.log(`🎮 Twitch OAuth: ${twitchOAuth?.isConnected() ? 'Connecté' : 'Déconnecté'}`);
    logger.log(`💎 Channel Points: ${channelPoints ? 'Initialisé' : 'Non initialisé'}`);
    
    if (this.config.isDevelopment()) {
      logger.log(`🔧 Mode développement actif`);
      logger.log(`📋 Config: ${JSON.stringify(this.config.export(), null, 2)}`);
    }
  }

  async shutdown() {
    logger.log('🔌 Arrêt du serveur...');

    try {
      // Arrêter les services
      if (this.serviceManager) {
        await this.serviceManager.stop();
      }

      // Arrêter WebSocket
      if (this.wsManager) {
        this.wsManager.shutdown();
      }

      // Arrêter serveur HTTP
      if (this.server) {
        this.server.close();
      }

      // Nettoyer config
      if (this.config) {
        this.config.destroy();
      }

      logger.log('✅ Serveur arrêté proprement');
      process.exit(0);

    } catch (error) {
      logger.error(`Erreur arrêt: ${error.message}`);
      process.exit(1);
    }
  }
}

// Démarrage
const server = new StreamServer();
server.start().catch(error => {
  console.error('💥 Échec critique:', error);
  process.exit(1);
});