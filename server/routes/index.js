// server/routes/index.js - Routeur principal
const express = require('express');
const path = require('path');
const logger = require('../logger');
const validate = require('../validator');
const { setupChannelPointsRoutes } = require('./channel-points');

class RouterManager {
  constructor(config, serviceManager, wsManager) {
    this.config = config;
    this.serviceManager = serviceManager;
    this.wsManager = wsManager;
    this.router = express.Router();
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Middleware de logging pour API
    this.router.use('/api', (req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });

    // Routes principales
    this.setupDataRoutes();
    this.setupTwitchRoutes();
    this.setupChannelPointsRoutes();
    this.setupEffectRoutes();
    this.setupSystemRoutes();
    this.setupWebhookRoutes();
  }

  setupDataRoutes() {
    const { streamDataPath, statusDataPath } = this.config.get('paths');

    // Planning
    this.router.get('/api/planning', this.handleGetPlanning.bind(this));
    this.router.post('/api/planning', this.handlePostPlanning.bind(this));

    // Status
    this.router.get('/api/status', this.handleGetStatus.bind(this));
    this.router.post('/api/status', this.handlePostStatus.bind(this));

    // Logs
    this.router.get('/api/logs', (req, res) => {
      try {
        const logs = logger.getLogs();
        res.json({ logs });
      } catch (error) {
        res.status(500).json({ error: 'Erreur logs' });
      }
    });
  }

  setupTwitchRoutes() {
    // OAuth routes sont gérées par TwitchOAuth directement
    
    // Status routes
    this.router.get('/api/twitch/status', (req, res) => {
      const twitchOAuth = this.serviceManager.getTwitchOAuth();
      const connected = twitchOAuth?.isConnected() || false;
      res.json({ connected });
    });

    this.router.get('/api/streamlabs/status', (req, res) => {
      const connected = false; // TODO: Implement if needed
      res.json({ connected });
    });

    // Test connexion
    this.router.post('/api/twitch/test', this.handleTwitchTest.bind(this));

    // Config (compatibility)
    this.router.get('/api/twitch/config', this.handleGetTwitchConfig.bind(this));
    this.router.post('/api/twitch/config', this.handlePostTwitchConfig.bind(this));
  }

  setupChannelPointsRoutes() {
    const twitchOAuth = this.serviceManager.getTwitchOAuth();
    const channelPoints = this.serviceManager.getChannelPoints();
    
    if (twitchOAuth) {
      setupChannelPointsRoutes(this.router, twitchOAuth, channelPoints, this.wsManager.broadcast.bind(this.wsManager));
    }

    // Routes de base Channel Points
    this.router.get('/api/channel-points/status', this.handleChannelPointsStatus.bind(this));
    this.router.post('/api/channel-points/monitoring/:action', this.handleChannelPointsMonitoring.bind(this));
    this.router.get('/api/channel-points/rewards', this.handleChannelPointsRewards.bind(this));
    this.router.post('/api/channel-points/configure', this.handleChannelPointsConfigure.bind(this));
    this.router.post('/api/channel-points/test-effect', this.handleChannelPointsTest.bind(this));
    this.router.post('/api/channel-points/cleanup', this.handleChannelPointsCleanup.bind(this));
    
    // Setup rapide
    this.router.post('/api/channel-points/quick-setup', this.handleChannelPointsQuickSetup.bind(this));
    this.router.post('/api/channel-points/create-default-rewards', this.handleCreateDefaultRewards.bind(this));
  }

  setupEffectRoutes() {
    this.router.post('/api/effect', (req, res) => {
      try {
        const { type } = req.body;
        
        if (!type || typeof type !== 'string') {
          return res.status(400).json({ error: 'Type effet manquant' });
        }
        
        const validEffects = ['perturbation', 'tada', 'flash', 'zoom', 'shake', 'bounce', 'pulse'];
        if (!validEffects.includes(type)) {
          return res.status(400).json({ error: 'Type effet invalide' });
        }
        
        this.wsManager.broadcast({ type: 'effect', value: type });
        
        logger.log(`Effet déclenché: ${type}`);
        res.json({ status: 'triggered' });
      } catch (error) {
        res.status(500).json({ error: 'Erreur effet' });
      }
    });

    this.router.post('/api/message', (req, res) => {
      try {
        const { message } = req.body;
        
        if (!message || typeof message !== 'string' || message.length > 200) {
          return res.status(400).json({ error: 'Message invalide' });
        }
        
        this.wsManager.broadcast({ type: 'message', value: message });
        
        logger.log(`Message envoyé: ${message.substring(0, 30)}...`);
        res.json({ status: 'sent' });
      } catch (error) {
        res.status(500).json({ error: 'Erreur message' });
      }
    });
  }

  setupSystemRoutes() {
    this.router.get('/api/health', (req, res) => {
      const twitchOAuth = this.serviceManager.getTwitchOAuth();
      const channelPoints = this.serviceManager.getChannelPoints();
      
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        connections: this.wsManager.getStats().currentConnections,
        uptime: process.uptime(),
        services: this.serviceManager.getStatus(),
        twitch: {
          oauth_connected: twitchOAuth?.isConnected() || false,
          channel_points: {
            initialized: !!channelPoints,
            monitoring: channelPoints?.getStatus()?.isMonitoring || false
          }
        }
      });
    });

    this.router.get('/api/system/status', (req, res) => {
      const twitchOAuth = this.serviceManager.getTwitchOAuth();
      
      res.json({
        timestamp: new Date().toISOString(),
        server: {
          uptime: process.uptime(),
          connections: this.wsManager.getStats().currentConnections,
          memory: process.memoryUsage()
        },
        services: this.serviceManager.getStatus(),
        websocket: this.wsManager.getStats(),
        twitch: twitchOAuth ? {
          connected: twitchOAuth.isConnected(),
          info: twitchOAuth.getConnectionInfo()
        } : null
      });
    });

    this.router.post('/api/system/reinitialize', async (req, res) => {
      try {
        await this.serviceManager.restart();
        res.json({
          success: true,
          message: 'Services réinitialisés',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
  }

  setupWebhookRoutes() {
    if (!this.config.get('features.webhooks')) return;

    this.router.post('/webhooks/channel-points', (req, res) => {
      try {
        const { reward, user, effect } = req.body;
        
        if (!reward || !user || !effect) {
          return res.status(400).json({ error: 'Données manquantes' });
        }

        this.wsManager.broadcast({ type: 'effect', value: effect });
        
        setTimeout(() => {
          this.wsManager.broadcast({ 
            type: 'message', 
            value: `🌐 WEBHOOK: ${user} a déclenché ${effect}` 
          });
        }, 1000);

        res.json({ success: true, message: 'Effet déclenché via webhook' });
        logger.log(`Webhook Channel Points: ${effect} par ${user}`);

      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // ======= HANDLERS PLANNING/STATUS =======

  handleGetPlanning(req, res) {
    try {
      const fs = require('fs');
      const data = fs.readFileSync(this.config.get('paths.streamDataPath'), 'utf8');
      res.json(JSON.parse(data));
    } catch (error) {
      logger.error(`Erreur lecture planning: ${error.message}`);
      res.status(500).json({ error: 'Erreur lecture planning' });
    }
  }

  handlePostPlanning(req, res) {
    try {
      const fs = require('fs');
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
      fs.writeFileSync(this.config.get('paths.streamDataPath'), JSON.stringify(data, null, 2));
      
      this.wsManager.broadcast({ type: 'update', target: 'planning' });
      
      logger.log('Planning mis à jour');
      res.json({ status: 'success' });
    } catch (error) {
      logger.error(`Erreur planning: ${error.message}`);
      res.status(500).json({ error: 'Erreur mise à jour planning' });
    }
  }

  handleGetStatus(req, res) {
    try {
      const fs = require('fs');
      const data = fs.readFileSync(this.config.get('paths.statusDataPath'), 'utf8');
      res.json(JSON.parse(data));
    } catch (error) {
      logger.error(`Erreur lecture statut: ${error.message}`);
      res.status(500).json({ error: 'Erreur lecture statut' });
    }
  }

  handlePostStatus(req, res) {
    try {
      const fs = require('fs');
      const data = req.body;
      
      if (!validate.statusData(data)) {
        return res.status(400).json({ error: 'Format invalide' });
      }
      
      data.last_update = new Date().toISOString();
      fs.writeFileSync(this.config.get('paths.statusDataPath'), JSON.stringify(data, null, 2));
      
      this.wsManager.broadcast({ type: 'update', target: 'status' });
      
      logger.log('Statut mis à jour');
      res.json({ status: 'success' });
    } catch (error) {
      logger.error(`Erreur statut: ${error.message}`);
      res.status(500).json({ error: 'Erreur mise à jour statut' });
    }
  }

  // ======= HANDLERS TWITCH =======

  async handleTwitchTest(req, res) {
    try {
      const twitchOAuth = this.serviceManager.getTwitchOAuth();
      if (!twitchOAuth?.isConnected()) {
        return res.json({
          success: false,
          message: 'OAuth Twitch non connecté'
        });
      }

      const channelPoints = this.serviceManager.getChannelPoints();
      if (channelPoints) {
        const testResult = await channelPoints.testTwitchAPI();
        res.json({
          success: testResult.success,
          message: testResult.success ? 'Connexion Twitch réussie' : testResult.error,
          data: testResult.user || null
        });
      } else {
        const tokens = await twitchOAuth.ensureValidTokens();
        if (!tokens) {
          return res.json({
            success: false,
            message: 'Tokens Twitch invalides'
          });
        }

        const userInfo = twitchOAuth.getConnectionInfo();
        res.json({
          success: true,
          message: 'Connexion OAuth valide',
          data: {
            user: userInfo.user,
            scopes: userInfo.scopes,
            expires_at: userInfo.expires_at
          }
        });
      }
    } catch (error) {
      logger.error(`Erreur test connexion Twitch: ${error.message}`);
      res.json({
        success: false,
        message: error.message
      });
    }
  }

  handleGetTwitchConfig(req, res) {
    try {
      const twitchOAuth = this.serviceManager.getTwitchOAuth();
      if (!twitchOAuth) {
        return res.json({
          enabled: false,
          connected: false,
          config: null
        });
      }

      const info = twitchOAuth.getConnectionInfo();
      res.json({
        enabled: true,
        connected: info.connected,
        config: info.connected ? {
          user: info.user,
          scopes: info.scopes,
          expires_at: info.expires_at
        } : null
      });
    } catch (error) {
      logger.error(`Erreur config Twitch: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  handlePostTwitchConfig(req, res) {
    try {
      res.json({
        success: true,
        message: 'Avec OAuth, utilisez la connexion Twitch pour configurer',
        config: this.serviceManager.getTwitchOAuth()?.getConnectionInfo() || null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ======= HANDLERS CHANNEL POINTS =======

  handleChannelPointsStatus(req, res) {
    try {
      const twitchOAuth = this.serviceManager.getTwitchOAuth();
      const channelPoints = this.serviceManager.getChannelPoints();

      if (!twitchOAuth?.isConnected()) {
        return res.json({
          enabled: false,
          monitoring: false,
          message: 'Twitch non connecté'
        });
      }

      if (!channelPoints) {
        return res.json({
          enabled: true,
          monitoring: false,
          message: 'Channel Points non initialisé'
        });
      }
      
      const status = channelPoints.getStatus();
      res.json({
        enabled: true,
        monitoring: status.isMonitoring,
        rewardEffectsCount: status.rewardEffectsCount,
        eventSubscriptionsCount: status.eventSubscriptionsCount,
        lastEventId: status.lastEventId
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async handleChannelPointsMonitoring(req, res) {
    try {
      const { action } = req.params;
      const twitchOAuth = this.serviceManager.getTwitchOAuth();
      
      if (!twitchOAuth?.isConnected()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Twitch non connecté' 
        });
      }

      let channelPoints = this.serviceManager.getChannelPoints();
      if (!channelPoints && action === 'start') {
        await this.serviceManager.enableService('channelPoints');
        channelPoints = this.serviceManager.getChannelPoints();
      }

      if (!channelPoints) {
        return res.status(400).json({ 
          success: false, 
          error: 'Impossible d\'initialiser Channel Points' 
        });
      }
      
      let result = false;
      
      if (action === 'start') {
        result = await channelPoints.startMonitoring();
      } else if (action === 'stop') {
        channelPoints.stopMonitoring();
        result = true;
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'Action invalide' 
        });
      }
      
      const status = channelPoints.getStatus();
      res.json({
        success: result,
        monitoring: status.isMonitoring,
        message: result ? 
          `Surveillance ${action === 'start' ? 'démarrée' : 'arrêtée'}` :
          `Impossible de ${action === 'start' ? 'démarrer' : 'arrêter'} la surveillance`
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  async handleChannelPointsRewards(req, res) {
    try {
      const channelPoints = this.serviceManager.getChannelPoints();
      if (!channelPoints) {
        return res.json({ success: true, rewards: [], count: 0 });
      }
      
      const rewards = await channelPoints.getAvailableRewards();
      res.json({
        success: true,
        rewards: rewards,
        count: rewards.length
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message,
        rewards: []
      });
    }
  }

  handleChannelPointsConfigure(req, res) {
    try {
      const { rewardEffects } = req.body;
      const channelPoints = this.serviceManager.getChannelPoints();
      
      if (!channelPoints) {
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
      
      channelPoints.configureRewardEffects(rewardEffects);
      
      res.json({
        success: true,
        message: 'Configuration mise à jour',
        mappingsCount: Object.keys(rewardEffects).length
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  async handleChannelPointsTest(req, res) {
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
      
      this.wsManager.broadcast({ type: 'effect', value: effectType });
      
      setTimeout(() => {
        this.wsManager.broadcast({ 
          type: 'message', 
          value: `🧪 TEST: ${userName} a utilisé "${rewardTitle}" !` 
        });
      }, 1000);
      
      res.json({
        success: true,
        message: `Effet "${effectType}" déclenché`,
        effect: effectType
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  handleChannelPointsCleanup(req, res) {
    try {
      const channelPoints = this.serviceManager.getChannelPoints();
      if (channelPoints) {
        channelPoints.cleanupOldEvents();
      }
      
      res.json({
        success: true,
        message: 'Nettoyage effectué'
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  async handleChannelPointsQuickSetup(req, res) {
    try {
      const twitchOAuth = this.serviceManager.getTwitchOAuth();
      if (!twitchOAuth?.isConnected()) {
        return res.status(400).json({
          success: false,
          error: 'Connexion Twitch OAuth requise',
          step: 'oauth'
        });
      }

      let channelPoints = this.serviceManager.getChannelPoints();
      if (!channelPoints) {
        await this.serviceManager.enableService('channelPoints');
        channelPoints = this.serviceManager.getChannelPoints();
        
        if (!channelPoints) {
          return res.status(400).json({
            success: false,
            error: 'Impossible d\'initialiser Channel Points',
            step: 'initialization'
          });
        }
      }

      const statusCheck = await channelPoints.checkStreamerStatus();
      if (!statusCheck.success) {
        return res.status(400).json({
          success: false,
          error: statusCheck.error,
          step: 'status_check'
        });
      }

      const rewards = await channelPoints.getAvailableRewards();
      const autoMappings = {};
      let configuredCount = 0;

      rewards.forEach(reward => {
        if (reward.suggestedEffect && reward.suggestedEffect !== 'pulse') {
          autoMappings[reward.title.toLowerCase()] = reward.suggestedEffect;
          configuredCount++;
        }
      });

      if (configuredCount > 0) {
        channelPoints.configureRewardEffects(autoMappings);
      }

      const monitoringStarted = await channelPoints.startMonitoring();

      res.json({
        success: true,
        message: 'Configuration rapide terminée',
        setup: {
          oauth_connected: true,
          channel_points_initialized: true,
          partner_status: statusCheck.success,
          rewards_found: rewards.length,
          effects_configured: configuredCount,
          monitoring_started: monitoringStarted
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        step: 'execution'
      });
    }
  }

  async handleCreateDefaultRewards(req, res) {
    try {
      const axios = require('axios');
      const twitchOAuth = this.serviceManager.getTwitchOAuth();
      
      if (!twitchOAuth?.isConnected()) {
        return res.status(400).json({
          success: false,
          error: 'OAuth Twitch requis'
        });
      }

      const tokens = await twitchOAuth.ensureValidTokens();
      const userInfo = twitchOAuth.getConnectionInfo();
      
      const defaultRewards = [
        {
          title: '🌀 Perturbation Quantique',
          cost: 500,
          prompt: 'Déclenche une perturbation visuelle mystérieuse',
          background_color: 'BLUE'
        },
        {
          title: '⚡ Effondrement Fonction d\'Onde',
          cost: 750,
          prompt: 'Demande une réponse instantanée du streamer',
          background_color: 'PURPLE'
        },
        {
          title: '🔄 Recul Temporel Localisé',
          cost: 1000,
          prompt: 'Le streamer doit répéter sa dernière phrase',
          background_color: 'GREEN'
        },
        {
          title: '🧠 Collapse Cognitif',
          cost: 1500,
          prompt: 'Expliquer un concept complexe comme à un enfant',
          background_color: 'PINK'
        },
        {
          title: '🦋 Effet Papillon',
          cost: 1200,
          prompt: 'Mutations visuelles pendant 5 minutes',
          background_color: 'ORANGE'
        }
      ];

      const createdRewards = [];
      const errors = [];

      for (const reward of defaultRewards) {
        try {
          const response = await axios.post(
            `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${userInfo.user.id}`,
            {
              ...reward,
              is_enabled: true,
              is_user_input_required: false
            },
            {
              headers: {
                'Client-ID': twitchOAuth.clientId,
                'Authorization': `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          createdRewards.push(response.data.data[0]);
          logger.log(`Récompense créée: ${reward.title}`);

        } catch (error) {
          errors.push({
            reward: reward.title,
            error: error.response?.data?.message || error.message
          });
        }
      }

      res.json({
        success: createdRewards.length > 0,
        message: `${createdRewards.length} récompenses créées`,
        created: createdRewards.length,
        total: defaultRewards.length,
        errors: errors
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = RouterManager;