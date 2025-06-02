// server/twitch-channel-points.js - Gestion des points de chaîne Twitch
const axios = require('axios');
const logger = require('./logger');

class TwitchChannelPoints {
  constructor(twitchModule) {
    this.twitch = twitchModule;
    this.eventSubscriptions = new Map();
    this.isMonitoring = false;
    this.pollInterval = null;
    this.lastEventId = null;
    
    // Configuration des récompenses et leurs effets
    this.rewardEffects = new Map([
      // Effets par défaut - peuvent être configurés via l'admin
      ['effect-tada', 'tada'],
      ['effect-flash', 'flash'],
      ['effect-zoom', 'zoom'],
      ['effect-shake', 'shake'],
      ['effect-bounce', 'bounce'],
      ['effect-pulse', 'pulse'],
      ['confetti', 'tada'],
      ['flash-screen', 'flash'],
      ['screen-shake', 'shake']
    ]);
  }

  /**
   * Démarrer la surveillance des Channel Points
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.log('Surveillance des Channel Points déjà active');
      return true;
    }

    try {
      const config = this.twitch.getConfig();
      
      if (!config.enabled || !config.twitch.clientId || !config.twitch.oauthToken) {
        logger.error('Configuration Twitch incomplète pour les Channel Points');
        return false;
      }

      logger.log('Démarrage de la surveillance des Channel Points...');
      
      // Vérifier les permissions du token
      const hasPermissions = await this.checkTokenPermissions();
      if (!hasPermissions) {
        logger.error('Token Twitch sans permissions suffisantes pour les Channel Points');
        return false;
      }

      // Démarrer le polling des événements
      this.startEventPolling();
      
      this.isMonitoring = true;
      logger.log('✅ Surveillance des Channel Points démarrée');
      
      return true;
      
    } catch (error) {
      logger.error(`Erreur démarrage surveillance Channel Points: ${error.message}`);
      return false;
    }
  }

  /**
   * Arrêter la surveillance des Channel Points
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      logger.log('Surveillance des Channel Points déjà arrêtée');
      return;
    }

    logger.log('Arrêt de la surveillance des Channel Points...');

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isMonitoring = false;
    logger.log('✅ Surveillance des Channel Points arrêtée');
  }

  /**
   * Vérifier les permissions du token OAuth
   */
  async checkTokenPermissions() {
    try {
      const config = this.twitch.getConfig();
      
      const response = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
          'Client-ID': config.twitch.clientId,
          'Authorization': `Bearer ${config.twitch.oauthToken}`
        }
      });

      if (response.status === 200) {
        logger.log('Token Twitch valide pour les Channel Points');
        return true;
      }
      
      return false;
      
    } catch (error) {
      if (error.response?.status === 401) {
        logger.error('Token Twitch expiré ou invalide');
      } else {
        logger.error(`Erreur vérification token: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Démarrer le polling des événements Channel Points
   */
  startEventPolling() {
    // Vérifier les événements toutes les 5 secondes
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollChannelPointsEvents();
      } catch (error) {
        logger.error(`Erreur polling Channel Points: ${error.message}`);
      }
    }, 5000);

    logger.log('Polling des événements Channel Points démarré');
  }

  /**
   * Récupérer les événements de Channel Points récents
   */
  async pollChannelPointsEvents() {
    try {
      const config = this.twitch.getConfig();
      
      // Obtenir l'ID du broadcaster
      const broadcasterResponse = await axios.get(`https://api.twitch.tv/helix/users?login=${config.twitch.channelName}`, {
        headers: {
          'Client-ID': config.twitch.clientId,
          'Authorization': `Bearer ${config.twitch.oauthToken}`
        }
      });

      if (!broadcasterResponse.data.data.length) {
        logger.error('Broadcaster introuvable pour les Channel Points');
        return;
      }

      const broadcasterId = broadcasterResponse.data.data[0].id;

      // Récupérer les récompenses personnalisées
      const rewardsResponse = await axios.get(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${broadcasterId}&only_manageable_rewards=true`, {
        headers: {
          'Client-ID': config.twitch.clientId,
          'Authorization': `Bearer ${config.twitch.oauthToken}`
        }
      });

      // Pour chaque récompense, vérifier les rachats récents
      for (const reward of rewardsResponse.data.data) {
        await this.checkRewardRedemptions(broadcasterId, reward);
      }

    } catch (error) {
      if (error.response?.status === 403) {
        logger.error('Permissions insuffisantes pour accéder aux Channel Points');
      } else if (error.response?.status === 401) {
        logger.error('Token Twitch invalide pour les Channel Points');
      } else {
        logger.error(`Erreur polling Channel Points: ${error.message}`);
      }
    }
  }

  /**
   * Vérifier les rachats d'une récompense spécifique
   */
  async checkRewardRedemptions(broadcasterId, reward) {
    try {
      const config = this.twitch.getConfig();
      
      // Récupérer les rachats récents (dernières 5 minutes)
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const redemptionsResponse = await axios.get(
        `https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${broadcasterId}&reward_id=${reward.id}&status=FULFILLED&sort=NEWEST&first=10&started_at=${since}`,
        {
          headers: {
            'Client-ID': config.twitch.clientId,
            'Authorization': `Bearer ${config.twitch.oauthToken}`
          }
        }
      );

      // Traiter chaque rachat
      for (const redemption of redemptionsResponse.data.data) {
        // Éviter de traiter le même événement plusieurs fois
        const eventKey = `${redemption.id}`;
        if (this.eventSubscriptions.has(eventKey)) {
          continue;
        }

        this.eventSubscriptions.set(eventKey, true);
        
        // Traiter le rachat
        await this.handleChannelPointRedemption(reward, redemption);
      }

    } catch (error) {
      logger.error(`Erreur vérification rachats pour ${reward.title}: ${error.message}`);
    }
  }

  /**
   * Gérer un rachat de Channel Points
   */
  async handleChannelPointRedemption(reward, redemption) {
    try {
      logger.log(`Channel Points rachetés: ${reward.title} par ${redemption.user_name} (${reward.cost} points)`);

      // Détecter l'effet à déclencher
      const effectType = this.detectEffectFromReward(reward);
      
      if (effectType) {
        // Déclencher l'effet via le système existant
        await this.triggerChannelPointEffect(effectType, {
          rewardTitle: reward.title,
          userName: redemption.user_name,
          userInput: redemption.user_input,
          cost: reward.cost,
          redemptionId: redemption.id
        });
      }

      // Déclencher l'événement pour les autres modules
      this.twitch.triggerEvent('channel_points', {
        platform: 'twitch',
        type: 'channel_points_redemption',
        reward: {
          id: reward.id,
          title: reward.title,
          cost: reward.cost,
          prompt: reward.prompt
        },
        redemption: {
          id: redemption.id,
          userName: redemption.user_name,
          userDisplayName: redemption.user_display_name,
          userInput: redemption.user_input,
          redeemedAt: redemption.redeemed_at
        },
        effect: effectType
      });

    } catch (error) {
      logger.error(`Erreur traitement rachat Channel Points: ${error.message}`);
    }
  }

  /**
   * Détecter l'effet à déclencher basé sur la récompense
   */
  detectEffectFromReward(reward) {
    const title = reward.title.toLowerCase();
    const prompt = (reward.prompt || '').toLowerCase();
    
    // Rechercher dans les mappings configurés
    for (const [keyword, effect] of this.rewardEffects) {
      if (title.includes(keyword) || prompt.includes(keyword)) {
        return effect;
      }
    }

    // Détection automatique par mots-clés
    const effectKeywords = {
      'tada': ['confetti', 'celebration', 'fête', 'bravo'],
      'flash': ['flash', 'éclair', 'lumière', 'light'],
      'zoom': ['zoom', 'focus', 'loupe'],
      'shake': ['shake', 'tremble', 'secoue'],
      'bounce': ['bounce', 'rebond', 'saut'],
      'pulse': ['pulse', 'battement', 'coeur']
    };

    for (const [effect, keywords] of Object.entries(effectKeywords)) {
      for (const keyword of keywords) {
        if (title.includes(keyword) || prompt.includes(keyword)) {
          return effect;
        }
      }
    }

    // Effet par défaut basé sur le coût
    if (reward.cost >= 1000) return 'tada';
    if (reward.cost >= 500) return 'pulse';
    if (reward.cost >= 100) return 'bounce';
    
    return 'flash'; // Effet par défaut
  }

  /**
   * Déclencher un effet via l'API existante
   */
  async triggerChannelPointEffect(effectType, eventData) {
    try {
      // Envoyer l'effet via l'API locale
      const response = await axios.post('http://localhost:3000/api/effect', {
        type: effectType
      });

      // Envoyer un message optionnel
      if (eventData.userInput && eventData.userInput.trim()) {
        setTimeout(async () => {
          await axios.post('http://localhost:3000/api/message', {
            message: `${eventData.userName}: ${eventData.userInput}`
          });
        }, 1000);
      } else {
        setTimeout(async () => {
          await axios.post('http://localhost:3000/api/message', {
            message: `${eventData.userName} a utilisé "${eventData.rewardTitle}" !`
          });
        }, 1000);
      }

      logger.log(`Effet Channel Points déclenché: ${effectType} pour ${eventData.userName}`);

    } catch (error) {
      logger.error(`Erreur déclenchement effet Channel Points: ${error.message}`);
    }
  }

  /**
   * Configurer les mappings récompenses -> effets
   */
  configureRewardEffects(mappings) {
    this.rewardEffects.clear();
    
    for (const [keyword, effect] of Object.entries(mappings)) {
      this.rewardEffects.set(keyword.toLowerCase(), effect);
    }
    
    logger.log(`Configuration des effets Channel Points mise à jour: ${this.rewardEffects.size} mappings`);
  }

  /**
   * Obtenir les récompenses disponibles
   */
  async getAvailableRewards() {
    try {
      const config = this.twitch.getConfig();
      
      if (!config.enabled || !config.twitch.clientId || !config.twitch.oauthToken) {
        return [];
      }

      // Obtenir l'ID du broadcaster
      const broadcasterResponse = await axios.get(`https://api.twitch.tv/helix/users?login=${config.twitch.channelName}`, {
        headers: {
          'Client-ID': config.twitch.clientId,
          'Authorization': `Bearer ${config.twitch.oauthToken}`
        }
      });

      if (!broadcasterResponse.data.data.length) {
        return [];
      }

      const broadcasterId = broadcasterResponse.data.data[0].id;

      // Récupérer les récompenses
      const rewardsResponse = await axios.get(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${broadcasterId}`, {
        headers: {
          'Client-ID': config.twitch.clientId,
          'Authorization': `Bearer ${config.twitch.oauthToken}`
        }
      });

      return rewardsResponse.data.data.map(reward => ({
        id: reward.id,
        title: reward.title,
        cost: reward.cost,
        prompt: reward.prompt,
        isEnabled: reward.is_enabled,
        isPaused: reward.is_paused,
        suggestedEffect: this.detectEffectFromReward(reward)
      }));

    } catch (error) {
      logger.error(`Erreur récupération récompenses: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtenir le statut de la surveillance
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      rewardEffectsCount: this.rewardEffects.size,
      lastEventId: this.lastEventId,
      eventSubscriptionsCount: this.eventSubscriptions.size
    };
  }

  /**
   * Nettoyer les anciens événements pour éviter l'accumulation en mémoire
   */
  cleanupOldEvents() {
    if (this.eventSubscriptions.size > 1000) {
      // Garder seulement les 500 événements les plus récents
      const entries = Array.from(this.eventSubscriptions.entries());
      const toKeep = entries.slice(-500);
      
      this.eventSubscriptions.clear();
      toKeep.forEach(([key, value]) => {
        this.eventSubscriptions.set(key, value);
      });
      
      logger.log(`Nettoyage des anciens événements Channel Points: ${entries.length - toKeep.length} supprimés`);
    }
  }
}

module.exports = TwitchChannelPoints;