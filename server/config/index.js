// server/config/index.js - Configuration centralisée
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('../logger');

class ConfigManager {
  constructor() {
    this.config = {};
    this.watchers = new Map();
    this.subscribers = new Set();
    
    this.load();
    this.setupFileWatching();
  }

  load() {
    // Charger les variables d'environnement
    dotenv.config();
    
    this.config = {
      server: {
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || 'localhost',
        env: process.env.NODE_ENV || 'development'
      },
      
      paths: {
        dataDir: path.join(__dirname, '../../data'),
        publicDir: path.join(__dirname, '../../public'),
        streamDataPath: path.join(__dirname, '../../data/stream24h.json'),
        statusDataPath: path.join(__dirname, '../../data/status.json'),
        tokensPath: path.join(__dirname, '../../data/twitch_tokens.json')
      },
      
      twitch: {
        clientId: process.env.TWITCH_CLIENT_ID || '',
        clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
        redirectUri: process.env.TWITCH_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/auth/twitch/callback`,
        scopes: [
          'channel:read:redemptions',
          'channel:manage:redemptions', 
          'user:read:email',
          'channel:read:subscriptions'
        ]
      },
      
      websocket: {
        heartbeatInterval: 30000,
        reconnectDelay: 3000,
        maxConnections: 100,
        messageThrottle: 100
      },
      
      channelPoints: {
        pollInterval: 8000,
        maxReconnectAttempts: 5,
        reconnectDelay: 30000,
        maxProcessedEvents: 1000
      },
      
      features: {
        channelPoints: true,
        chat: true,
        webhooks: process.env.ENABLE_WEBHOOKS === 'true',
        autoReconnect: true
      },
      
      security: {
        adminUser: process.env.ADMIN_USER || 'admin',
        adminPassword: process.env.ADMIN_PASSWORD,
        rateLimitWindow: 15 * 60 * 1000,
        rateLimitMax: 100
      }
    };
    
    this.validate();
    logger.log('✅ Configuration chargée et validée');
  }

  validate() {
    const errors = [];
    
    // Validation Twitch
    if (this.config.features.channelPoints && !this.config.twitch.clientId) {
      errors.push('TWITCH_CLIENT_ID requis pour Channel Points');
    }
    
    if (this.config.features.channelPoints && !this.config.twitch.clientSecret) {
      errors.push('TWITCH_CLIENT_SECRET requis pour Channel Points');
    }
    
    // Validation serveur
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('PORT invalide (1-65535)');
    }
    
    // Validation chemins
    if (!fs.existsSync(path.dirname(this.config.paths.dataDir))) {
      try {
        fs.mkdirSync(this.config.paths.dataDir, { recursive: true });
      } catch (error) {
        errors.push(`Impossible de créer le dossier data: ${error.message}`);
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Erreurs de configuration:\n${errors.join('\n')}`);
    }
  }

  setupFileWatching() {
    if (this.config.server.env === 'development') {
      const envPath = path.join(__dirname, '../../.env');
      
      if (fs.existsSync(envPath)) {
        try {
          fs.watchFile(envPath, (curr, prev) => {
            logger.log('📁 Fichier .env modifié, rechargement...');
            this.reload();
          });
          
          logger.log('👁️ Surveillance du fichier .env activée');
        } catch (error) {
          logger.error(`Erreur surveillance .env: ${error.message}`);
        }
      }
    }
  }

  reload() {
    try {
      const oldConfig = { ...this.config };
      this.load();
      
      // Notifier les subscribers du changement
      this.notifySubscribers(oldConfig, this.config);
      
      logger.log('🔄 Configuration rechargée');
    } catch (error) {
      logger.error(`Erreur rechargement config: ${error.message}`);
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(oldConfig, newConfig) {
    this.subscribers.forEach(callback => {
      try {
        callback(newConfig, oldConfig);
      } catch (error) {
        logger.error(`Erreur callback config: ${error.message}`);
      }
    });
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => {
      if (!obj[key]) obj[key] = {};
      return obj[key];
    }, this.config);
    
    target[lastKey] = value;
  }

  getAll() {
    return { ...this.config };
  }

  // Méthodes spécialisées pour faciliter l'usage
  isTwitchConfigured() {
    return !!(this.config.twitch.clientId && this.config.twitch.clientSecret);
  }

  isProduction() {
    return this.config.server.env === 'production';
  }

  isDevelopment() {
    return this.config.server.env === 'development';
  }

  getServerUrl() {
    const { host, port } = this.config.server;
    return `http://${host}:${port}`;
  }

  getTwitchRedirectUri() {
    return this.config.twitch.redirectUri.replace(
      'localhost:3000', 
      `${this.config.server.host}:${this.config.server.port}`
    );
  }

  // Exportation pour les logs/debug
  export() {
    const exported = { ...this.config };
    
    // Masquer les secrets
    if (exported.twitch) {
      exported.twitch.clientSecret = exported.twitch.clientSecret ? '***' : '';
    }
    if (exported.security) {
      exported.security.adminPassword = exported.security.adminPassword ? '***' : '';
    }
    
    return exported;
  }

  destroy() {
    // Arrêter la surveillance des fichiers
    this.watchers.forEach((watcher, path) => {
      fs.unwatchFile(path);
    });
    
    this.watchers.clear();
    this.subscribers.clear();
    
    logger.log('🧹 ConfigManager détruit');
  }
}

// Instance singleton
let instance = null;

function createConfig() {
  if (!instance) {
    instance = new ConfigManager();
  }
  return instance;
}

function getConfig() {
  if (!instance) {
    throw new Error('ConfigManager non initialisé. Appelez createConfig() d\'abord.');
  }
  return instance;
}

module.exports = {
  createConfig,
  getConfig,
  ConfigManager
};