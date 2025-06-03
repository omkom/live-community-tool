// server/services/index.js - Gestionnaire de services centralisé
const EventEmitter = require('events');
const logger = require('../logger');

// Import des services
const TwitchOAuth = require('../twitch-oauth');
const TwitchChannelPoints = require('../twitch-channel-points');
const TwitchChat = require('../twitch');

class ServiceManager extends EventEmitter {
  constructor(config, wsManager) {
    super();
    
    this.config = config;
    this.wsManager = wsManager;
    this.services = new Map();
    this.dependencies = new Map();
    this.startOrder = [];
    this.state = 'stopped'; // stopped, starting, running, stopping
    
    this.setupDependencies();
  }

  setupDependencies() {
    // Définir l'ordre de démarrage et les dépendances
    this.addService('twitchOAuth', TwitchOAuth, {
      dependencies: [],
      config: () => ({}),
      enabled: () => this.config.isTwitchConfigured(),
      autoStart: true
    });

    this.addService('channelPoints', TwitchChannelPoints, {
      dependencies: ['twitchOAuth'],
      config: () => ({}),
      enabled: () => this.config.get('features.channelPoints') && this.isServiceRunning('twitchOAuth'),
      autoStart: false // Démarré à la demande via OAuth callback
    });

    this.addService('twitchChat', TwitchChat, {
      dependencies: ['twitchOAuth'],
      config: () => ({}),
      enabled: () => this.config.get('features.chat') && this.isServiceRunning('twitchOAuth'),
      autoStart: false // Démarré à la demande via OAuth callback
    });
  }

  addService(name, ServiceClass, options = {}) {
    const service = {
      name,
      ServiceClass,
      instance: null,
      state: 'stopped',
      dependencies: options.dependencies || [],
      getConfig: options.config || (() => ({})),
      isEnabled: options.enabled || (() => true),
      retries: 0,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000
    };

    this.services.set(name, service);
    this.updateStartOrder();
  }

  updateStartOrder() {
    const visited = new Set();
    const order = [];

    const visit = (serviceName) => {
      if (visited.has(serviceName)) return;
      visited.add(serviceName);

      const service = this.services.get(serviceName);
      if (!service) return;

      // Visiter les dépendances d'abord
      service.dependencies.forEach(dep => visit(dep));
      order.push(serviceName);
    };

    this.services.forEach((_, name) => visit(name));
    this.startOrder = order;
  }

  async start() {
    if (this.state !== 'stopped') {
      throw new Error(`Impossible de démarrer les services: état actuel ${this.state}`);
    }

    this.state = 'starting';
    logger.log('🚀 Démarrage des services...');

    try {
      const results = {};
      
      for (const serviceName of this.startOrder) {
        const service = this.services.get(serviceName);
        
        if (!service.isEnabled()) {
          logger.log(`⏭️ Service ${serviceName} désactivé`);
          service.state = 'disabled';
          results[serviceName] = { status: 'disabled' };
          continue;
        }

        // Services auto-start uniquement
        if (service.autoStart === false) {
          logger.log(`⏭️ Service ${serviceName} en attente (démarrage manuel)`);
          service.state = 'waiting';
          results[serviceName] = { status: 'waiting' };
          continue;
        }

        try {
          await this.startService(service);
          results[serviceName] = { status: 'started' };
        } catch (error) {
          logger.error(`❌ Échec démarrage ${serviceName}: ${error.message}`);
          results[serviceName] = { status: 'failed', error: error.message };
          
          // Continuer avec les autres services si pas critique
          if (!this.isCriticalService(serviceName)) {
            continue;
          } else {
            throw error;
          }
        }
      }

      this.state = 'running';
      this.setupServiceEvents();
      
      logger.log('✅ Services démarrés');
      this.emit('started', results);
      
      return results;
    } catch (error) {
      this.state = 'stopped';
      logger.error(`💥 Erreur critique démarrage services: ${error.message}`);
      this.emit('error', error);
      throw error;
    }
  }

  async startService(service) {
    try {
      service.state = 'starting';
      logger.log(`🔄 Démarrage ${service.name}...`);

      // Vérifier les dépendances
      const missingDeps = service.dependencies.filter(dep => !this.isServiceRunning(dep));
      if (missingDeps.length > 0) {
        throw new Error(`Dépendances manquantes: ${missingDeps.join(', ')}`);
      }

      // Créer l'instance avec injection de dépendances
      const dependencies = this.resolveDependencies(service.dependencies);
      const config = service.getConfig();
      
      // Injection spécifique selon le service
      if (service.name === 'channelPoints') {
        service.instance = new service.ServiceClass(dependencies.twitchOAuth);
      } else if (service.name === 'twitchChat') {
        service.instance = new service.ServiceClass(dependencies.twitchOAuth);
      } else {
        service.instance = new service.ServiceClass(dependencies, config);
      }

      // Initialiser si la méthode existe
      if (typeof service.instance.initialize === 'function') {
        await service.instance.initialize();
      }

      service.state = 'running';
      service.retries = 0;
      
      logger.log(`✅ ${service.name} démarré`);
      this.emit('serviceStarted', { name: service.name, instance: service.instance });

    } catch (error) {
      service.state = 'failed';
      throw new Error(`Erreur ${service.name}: ${error.message}`);
    }
  }

  async stop() {
    if (this.state === 'stopped') return;

    this.state = 'stopping';
    logger.log('⏹️ Arrêt des services...');

    try {
      // Arrêter dans l'ordre inverse
      const stopOrder = [...this.startOrder].reverse();
      
      for (const serviceName of stopOrder) {
        const service = this.services.get(serviceName);
        
        if (service.state === 'running' && service.instance) {
          try {
            await this.stopService(service);
          } catch (error) {
            logger.error(`Erreur arrêt ${serviceName}: ${error.message}`);
          }
        }
      }

      this.state = 'stopped';
      logger.log('✅ Services arrêtés');
      this.emit('stopped');

    } catch (error) {
      logger.error(`Erreur arrêt services: ${error.message}`);
      this.emit('error', error);
    }
  }

  async stopService(service) {
    try {
      service.state = 'stopping';
      logger.log(`⏹️ Arrêt ${service.name}...`);

      if (service.instance) {
        // Méthode graceful shutdown
        if (typeof service.instance.shutdown === 'function') {
          await service.instance.shutdown();
        } else if (typeof service.instance.stop === 'function') {
          await service.instance.stop();
        } else if (typeof service.instance.destroy === 'function') {
          await service.instance.destroy();
        }

        service.instance = null;
      }

      service.state = 'stopped';
      logger.log(`✅ ${service.name} arrêté`);
      this.emit('serviceStopped', { name: service.name });

    } catch (error) {
      service.state = 'failed';
      throw error;
    }
  }

  async restart(serviceName = null) {
    if (serviceName) {
      return this.restartService(serviceName);
    } else {
      await this.stop();
      return this.start();
    }
  }

  async restartService(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service inconnu: ${serviceName}`);
    }

    logger.log(`🔄 Redémarrage ${serviceName}...`);

    try {
      // Arrêter les services dépendants d'abord
      const dependents = this.findDependents(serviceName);
      for (const depName of dependents.reverse()) {
        const depService = this.services.get(depName);
        if (depService.state === 'running') {
          await this.stopService(depService);
        }
      }

      // Arrêter le service principal
      if (service.state === 'running') {
        await this.stopService(service);
      }

      // Redémarrer le service principal
      if (service.isEnabled()) {
        await this.startService(service);
      }

      // Redémarrer les dépendants
      for (const depName of dependents) {
        const depService = this.services.get(depName);
        if (depService.isEnabled()) {
          await this.startService(depService);
        }
      }

      logger.log(`✅ ${serviceName} redémarré`);
      this.emit('serviceRestarted', { name: serviceName });

    } catch (error) {
      logger.error(`Erreur redémarrage ${serviceName}: ${error.message}`);
      throw error;
    }
  }

  setupServiceEvents() {
    // Écouter les événements OAuth pour réinitialisation auto
    const oauthService = this.getService('twitchOAuth');
    if (oauthService?.instance) {
      // Setup OAuth callback pour réinitialiser les services dépendants
      global.reinitializeServicesAfterOAuth = async () => {
        logger.log('🔄 Réinitialisation services post-OAuth...');
        
        try {
          // Redémarrer les services dépendants de OAuth
          const oauthDependents = this.findDependents('twitchOAuth');
          
          for (const serviceName of oauthDependents) {
            const service = this.services.get(serviceName);
            if (service && service.state === 'stopped' && service.isEnabled()) {
              await this.startService(service);
              logger.log(`✅ ${serviceName} réinitialisé`);
            }
          }

          // Configuration automatique Channel Points
          await this.autoConfigureChannelPoints();

          this.emit('servicesReinitialized', { trigger: 'oauth' });
          
        } catch (error) {
          logger.error(`Erreur réinitialisation: ${error.message}`);
        }
      };
    }

    // Écouter les événements des services pour broadcasting
    this.services.forEach((service, name) => {
      if (service.instance && typeof service.instance.on === 'function') {
        this.setupServiceEventForwarding(service);
      }
    });
  }

  setupServiceEventForwarding(service) {
    const { name, instance } = service;

    // Events Channel Points
    if (name === 'channelPoints') {
      instance.on('redemption', (data) => {
        this.handleChannelPointsRedemption(data);
      });

      instance.on('monitoring:started', () => {
        this.wsManager.broadcast({ 
          type: 'channel_points_status', 
          data: { monitoring: true, timestamp: new Date().toISOString() }
        });
      });

      instance.on('monitoring:stopped', () => {
        this.wsManager.broadcast({ 
          type: 'channel_points_status', 
          data: { monitoring: false, timestamp: new Date().toISOString() }
        });
      });

      instance.on('error', (error) => {
        this.wsManager.broadcast({ 
          type: 'channel_points_error', 
          data: { error: error.message, timestamp: new Date().toISOString() }
        });
      });
    }

    // Events Chat
    if (name === 'twitchChat') {
      instance.on('chat', (data) => {
        this.handleChatMessage(data);
      });
    }
  }

  handleChannelPointsRedemption(data) {
    logger.log(`💎 Channel Points: ${data.reward.title} par ${data.user.display_name}`);

    // Déclencher l'effet avec données enrichies
    if (data.effect) {
      const effectData = {
        userInput: data.redemption.user_input || null,
        userName: data.user.display_name,
        rewardTitle: data.reward.title,
        cost: data.reward.cost,
        timestamp: new Date().toISOString()
      };

      this.wsManager.sendToType({
        type: 'effect',
        value: data.effect,
        data: effectData
      }, 'overlay');

      // Message de confirmation
      setTimeout(() => {
        let message = `${data.user.display_name} a utilisé "${data.reward.title}"`;
        const quantumMessages = {
          'quantum_collapse': ' - Réponse instantanée requise !',
          'temporal_rewind': ' - Répète ta dernière phrase !',
          'cognitive_collapse': ' - Explique comme à un enfant !',
          'butterfly_effect': ' - Effet Papillon activé pour 5 minutes !',
          'quantum_consciousness': ' - Citation mystérieuse révélée !'
        };
        message += (quantumMessages[data.effect] || ' !');
        this.wsManager.sendToType({ type: 'message', value: message }, 'overlay');
      }, 1500);
    }

    // Event pour admin
    this.wsManager.sendToType({
      type: 'channel_points_event',
      data: {
        reward: data.reward.title,
        user: data.user.display_name,
        cost: data.reward.cost,
        effect: data.effect,
        user_input: data.redemption.user_input,
        timestamp: new Date().toISOString(),
        event_type: 'live'
      }
    }, 'admin');
  }

  handleChatMessage(data) {
    const chatEffectKeywords = {
      'perturbation': 'perturbation',
      'perturbation quantique': 'perturbation',
      '!perturbation': 'perturbation',
      'confetti': 'tada',
      '!confetti': 'tada',
      'flash': 'flash',
      '!flash': 'flash'
    };

    const message = data.message.toLowerCase().trim();
    const username = data.username;

    // Chercher mots-clés pour effets
    for (const [keyword, effect] of Object.entries(chatEffectKeywords)) {
      if (message.includes(keyword)) {
        logger.log(`🎯 Effet chat: ${keyword} → ${effect} par ${username}`);
        
        this.wsManager.broadcast({ type: 'effect', value: effect });
        
        setTimeout(() => {
          this.wsManager.broadcast({ 
            type: 'message', 
            value: `${username} a déclenché ${keyword} !` 
          });
        }, 1000);
        
        break;
      }
    }
  }

  async autoConfigureChannelPoints() {
    const channelPointsService = this.getService('channelPoints');
    if (!channelPointsService?.instance) return;

    try {
      const rewards = await channelPointsService.instance.getAvailableRewards();
      if (rewards.length === 0) return;

      const autoMappings = {};
      rewards.forEach(reward => {
        if (reward.suggestedEffect && reward.suggestedEffect !== 'pulse') {
          autoMappings[reward.title.toLowerCase()] = reward.suggestedEffect;
        }
      });

      if (Object.keys(autoMappings).length > 0) {
        channelPointsService.instance.configureRewardEffects(autoMappings);
        logger.log(`🎯 Auto-config Channel Points: ${Object.keys(autoMappings).length} effets`);
      }
    } catch (error) {
      logger.error(`Erreur auto-config Channel Points: ${error.message}`);
    }
  }

  // ======= MÉTHODES UTILITAIRES =======

  resolveDependencies(depNames) {
    const resolved = {};
    depNames.forEach(name => {
      const service = this.services.get(name);
      if (service?.instance) {
        resolved[name] = service.instance;
      }
    });
    return resolved;
  }

  findDependents(serviceName) {
    const dependents = [];
    this.services.forEach((service, name) => {
      if (service.dependencies.includes(serviceName)) {
        dependents.push(name);
      }
    });
    return dependents;
  }

  isCriticalService(serviceName) {
    return ['twitchOAuth'].includes(serviceName);
  }

  // ======= MÉTHODES PUBLIQUES =======

  getService(name) {
    return this.services.get(name);
  }

  getServiceInstance(name) {
    const service = this.services.get(name);
    return service?.instance || null;
  }

  isServiceRunning(name) {
    const service = this.services.get(name);
    return service?.state === 'running';
  }

  isServiceEnabled(name) {
    const service = this.services.get(name);
    return service?.isEnabled() || false;
  }

  getStatus() {
    const services = {};
    this.services.forEach((service, name) => {
      services[name] = {
        state: service.state,
        enabled: service.isEnabled(),
        retries: service.retries,
        hasInstance: !!service.instance
      };
    });

    return {
      manager: this.state,
      services,
      dependencies: Array.from(this.dependencies.entries()),
      startOrder: this.startOrder
    };
  }

  async enableService(name) {
    const service = this.services.get(name);
    if (!service) throw new Error(`Service inconnu: ${name}`);

    if (service.state === 'disabled' && service.isEnabled()) {
      await this.startService(service);
      logger.log(`✅ Service ${name} activé`);
    }
  }

  async disableService(name) {
    const service = this.services.get(name);
    if (!service) throw new Error(`Service inconnu: ${name}`);

    if (service.state === 'running') {
      await this.stopService(service);
      service.state = 'disabled';
      logger.log(`⏹️ Service ${name} désactivé`);
    }
  }

  // Méthodes de convenance pour les services spécifiques
  getTwitchOAuth() {
    return this.getServiceInstance('twitchOAuth');
  }

  getChannelPoints() {
    return this.getServiceInstance('channelPoints');
  }

  getTwitchChat() {
    return this.getServiceInstance('twitchChat');
  }

  async destroy() {
    await this.stop();
    this.services.clear();
    this.dependencies.clear();
    this.removeAllListeners();
    logger.log('🧹 ServiceManager détruit');
  }
}

module.exports = ServiceManager;