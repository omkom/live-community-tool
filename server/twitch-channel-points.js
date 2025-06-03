// server/twitch-channel-points.js - Version avec nouveaux effets quantiques
const axios = require('axios');
const EventEmitter = require('events');
const logger = require('./logger');

class TwitchChannelPoints extends EventEmitter {
  constructor(twitchOAuth) {
    super();
    this.twitchOAuth = twitchOAuth;
    this.isMonitoring = false;
    this.pollInterval = null;
    this.processedRedemptions = new Set();
    this.rewardEffects = new Map();
    this.lastPollTime = Date.now();
    this.hasPartnerStatus = false;
    this.statusChecked = false;
    
    // Configuration des nouveaux effets quantiques
    this.setQuantumEffects();
  }

  setQuantumEffects() {
    // NOUVEAUX EFFETS QUANTIQUES
    this.rewardEffects.set('effondrement', 'quantum_collapse');
    this.rewardEffects.set('fonction d\'onde', 'quantum_collapse');
    this.rewardEffects.set('collapse', 'quantum_collapse');
    this.rewardEffects.set('question', 'quantum_collapse');
    
    this.rewardEffects.set('recul temporel', 'temporal_rewind');
    this.rewardEffects.set('temporel', 'temporal_rewind');
    this.rewardEffects.set('rewind', 'temporal_rewind');
    this.rewardEffects.set('temps', 'temporal_rewind');
    
    this.rewardEffects.set('cognitif', 'cognitive_collapse');
    this.rewardEffects.set('expliquer', 'cognitive_collapse');
    this.rewardEffects.set('enfant', 'cognitive_collapse');
    this.rewardEffects.set('concept', 'cognitive_collapse');
    
    this.rewardEffects.set('papillon', 'butterfly_effect');
    this.rewardEffects.set('mutation', 'butterfly_effect');
    this.rewardEffects.set('background', 'butterfly_effect');
    this.rewardEffects.set('changement', 'butterfly_effect');
    
    this.rewardEffects.set('conscience', 'quantum_consciousness');
    this.rewardEffects.set('citation', 'quantum_consciousness');
    this.rewardEffects.set('mystérieuse', 'quantum_consciousness');
    this.rewardEffects.set('poésie', 'quantum_consciousness');

    // EFFETS CLASSIQUES (réduits)
    this.rewardEffects.set('perturbation', 'perturbation');
    this.rewardEffects.set('confetti', 'tada');
    this.rewardEffects.set('flash', 'flash');
    this.rewardEffects.set('pulse', 'pulse');
  }

  async testTwitchAPI() {
    try {
      const tokens = await this.twitchOAuth.ensureValidTokens();
      if (!tokens) {
        return { success: false, error: 'Tokens invalides' };
      }
      const userInfo = this.twitchOAuth.getConnectionInfo();
      if (!userInfo.connected || !userInfo.user) {
        return { success: false, error: 'Informations utilisateur non disponibles' };
      }
      const response = await axios.get(
        `https://api.twitch.tv/helix/users?id=${userInfo.user.id}`,
        {
          headers: {
            'Client-ID': this.twitchOAuth.clientId,
            Authorization: `Bearer ${tokens.access_token}`
          }
        }
      );
      const data = response.data.data;
      if (data && data.length > 0) {
        return { success: true, user: data[0] };
      }
      return { success: false, error: 'Utilisateur introuvable' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      logger.log('Surveillance Channel Points déjà active');
      return true;
    }

    try {
      if (!this.twitchOAuth.isConnected()) {
        throw new Error('OAuth Twitch non connecté');
      }

      const tokens = await this.twitchOAuth.ensureValidTokens();
      if (!tokens) {
        throw new Error('Tokens Twitch invalides');
      }

      const statusCheck = await this.checkStreamerStatus();
      if (!statusCheck.success) {
        throw new Error(statusCheck.error);
      }

      this.isMonitoring = true;
      this.startPolling();
      
      logger.log('✅ Surveillance Channel Points quantiques démarrée');
      this.emit('monitoring:started');
      
      return true;

    } catch (error) {
      logger.error(`Erreur démarrage Channel Points: ${error.message}`);
      this.emit('error', error);
      return false;
    }
  }

  async checkStreamerStatus() {
    if (this.statusChecked) {
      return { success: this.hasPartnerStatus };
    }

    try {
      const tokens = await this.twitchOAuth.ensureValidTokens();
      const userInfo = this.twitchOAuth.getConnectionInfo();
      
      if (!userInfo.connected || !userInfo.user) {
        return { success: false, error: 'Informations utilisateur non disponibles' };
      }

      const response = await axios.get(`https://api.twitch.tv/helix/users?id=${userInfo.user.id}`, {
        headers: {
          'Client-ID': this.twitchOAuth.clientId,
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      if (response.data.data.length > 0) {
        const user = response.data.data[0];
        this.hasPartnerStatus = ['affiliate', 'partner'].includes(user.broadcaster_type);
        this.statusChecked = true;

        if (!this.hasPartnerStatus) {
          return { 
            success: false, 
            error: `Statut insuffisant : "${user.broadcaster_type || 'normal'}". Channel Points nécessite le statut Affilié ou Partenaire.` 
          };
        }

        logger.log(`Statut vérifié : ${user.broadcaster_type} - Channel Points quantiques disponibles`);
        return { success: true };
      }

      return { success: false, error: 'Impossible de vérifier le statut du broadcaster' };

    } catch (error) {
      logger.error(`Erreur vérification statut : ${error.message}`);
      return { success: false, error: `Erreur API : ${error.message}` };
    }
  }

  stopMonitoring() {
    if (!this.isMonitoring) {
      logger.log('Surveillance Channel Points déjà arrêtée');
      return;
    }

    this.isMonitoring = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    logger.log('✅ Surveillance Channel Points quantiques arrêtée');
    this.emit('monitoring:stopped');
  }

  startPolling() {
    this.pollInterval = setInterval(async () => {
      try {
        await this.checkForNewRedemptions();
      } catch (error) {
        if (error.response?.status === 403) {
          logger.error('Erreur 403 - Arrêt de la surveillance Channel Points');
          this.stopMonitoring();
          this.emit('error', new Error('Permissions insuffisantes pour Channel Points'));
        } else {
          logger.error(`Erreur polling Channel Points: ${error.message}`);
        }
      }
    }, 8000); // 8 secondes pour réduire la charge

    logger.log('Polling Channel Points quantiques démarré');
  }

  async checkForNewRedemptions() {
    try {
      const tokens = await this.twitchOAuth.ensureValidTokens();
      if (!tokens) {
        logger.error('Tokens non disponibles pour Channel Points');
        return;
      }

      const userInfo = this.twitchOAuth.getConnectionInfo();
      if (!userInfo.connected || !userInfo.user) {
        logger.error('Informations utilisateur non disponibles');
        return;
      }

      const broadcasterId = userInfo.user.id;

      let rewardsResponse;
      try {
        rewardsResponse = await axios.get(
          `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${broadcasterId}`,
          {
            headers: {
              'Client-ID': this.twitchOAuth.clientId,
              'Authorization': `Bearer ${tokens.access_token}`
            }
          }
        );
      } catch (rewardError) {
        if (rewardError.response?.status === 403) {
          logger.error('Erreur 403 - Accès Channel Points refusé');
          this.stopMonitoring();
          this.emit('error', new Error('Accès Channel Points refusé - Surveillance arrêtée'));
        }
        throw rewardError;
      }

      for (const reward of rewardsResponse.data.data) {
        await this.checkRewardRedemptions(broadcasterId, reward, tokens);
      }

      this.lastPollTime = Date.now();

    } catch (error) {
      if (error.response?.status === 401) {
        logger.error('Token expiré, reconnexion requise');
        this.emit('error', new Error('Token expiré'));
      } else if (error.response?.status === 403) {
        return;
      } else {
        logger.error(`Erreur vérification rachats: ${error.message}`);
      }
    }
  }

  async checkRewardRedemptions(broadcasterId, reward, tokens) {
    try {
      const since = new Date(Date.now() - 90000).toISOString(); // Dernières 90 secondes
      
      const redemptionsResponse = await axios.get(
        `https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${broadcasterId}&reward_id=${reward.id}&status=FULFILLED&sort=NEWEST&first=20&started_at=${since}`,
        {
          headers: {
            'Client-ID': this.twitchOAuth.clientId,
            'Authorization': `Bearer ${tokens.access_token}`
          }
        }
      );

      for (const redemption of redemptionsResponse.data.data) {
        const redemptionKey = `${redemption.id}`;
        
        if (this.processedRedemptions.has(redemptionKey)) {
          continue;
        }

        this.processedRedemptions.add(redemptionKey);
        await this.handleRedemption(reward, redemption);
      }

      if (this.processedRedemptions.size > 1000) {
        const entries = Array.from(this.processedRedemptions);
        this.processedRedemptions.clear();
        entries.slice(-500).forEach(id => this.processedRedemptions.add(id));
      }

    } catch (error) {
      if (error.response?.status !== 403) {
        logger.error(`Erreur rachats pour ${reward.title}: ${error.message}`);
      }
    }
  }

  async handleRedemption(reward, redemption) {
    try {
      logger.log(`🔮 Channel Points Quantique: ${redemption.user_name} → ${reward.title} (${reward.cost} points)`);

      const effect = this.detectQuantumEffect(reward);
      
      // Données enrichies pour les nouveaux effets
      const eventData = {
        reward: {
          id: reward.id,
          title: reward.title,
          cost: reward.cost,
          prompt: reward.prompt
        },
        user: {
          id: redemption.user_id,
          login: redemption.user_login,
          display_name: redemption.user_name
        },
        redemption: {
          id: redemption.id,
          user_input: redemption.user_input, // Important pour les nouveaux effets
          redeemed_at: redemption.redeemed_at
        },
        effect: effect
      };

      this.emit('redemption', eventData);

    } catch (error) {
      logger.error(`Erreur traitement rachat quantique: ${error.message}`);
    }
  }

  detectQuantumEffect(reward) {
    const title = reward.title.toLowerCase();
    const prompt = (reward.prompt || '').toLowerCase();
    
    // Recherche spécifique pour les nouveaux effets quantiques
    for (const [keyword, effect] of this.rewardEffects) {
      if (title.includes(keyword) || prompt.includes(keyword)) {
        return effect;
      }
    }

    // Détection par coût avec nouveaux seuils
    if (reward.cost >= 1500) return 'cognitive_collapse';
    if (reward.cost >= 1200) return 'butterfly_effect';
    if (reward.cost >= 1000) return 'temporal_rewind';
    if (reward.cost >= 800) return 'quantum_consciousness';
    if (reward.cost >= 750) return 'quantum_collapse';
    if (reward.cost >= 500) return 'perturbation';
    
    return 'pulse'; // Effet par défaut léger
  }

  configureRewardEffects(mappings) {
    this.rewardEffects.clear();
    this.setQuantumEffects(); // Garder les mappings quantiques
    
    for (const [keyword, effect] of Object.entries(mappings)) {
      this.rewardEffects.set(keyword.toLowerCase(), effect);
    }
    
    logger.log(`Channel Points quantiques configurés: ${this.rewardEffects.size} mappings`);
  }

  async getAvailableRewards() {
    try {
      const tokens = await this.twitchOAuth.ensureValidTokens();
      if (!tokens) {
        return [];
      }

      const userInfo = this.twitchOAuth.getConnectionInfo();
      if (!userInfo.connected || !userInfo.user) {
        return [];
      }

      const statusCheck = await this.checkStreamerStatus();
      if (!statusCheck.success) {
        logger.error(`Impossible de récupérer les récompenses: ${statusCheck.error}`);
        return [];
      }

      const broadcasterId = userInfo.user.id;

      const response = await axios.get(
        `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${broadcasterId}`,
        {
          headers: {
            'Client-ID': this.twitchOAuth.clientId,
            'Authorization': `Bearer ${tokens.access_token}`
          }
        }
      );

      return response.data.data.map(reward => ({
        id: reward.id,
        title: reward.title,
        cost: reward.cost,
        prompt: reward.prompt,
        isEnabled: reward.is_enabled,
        isPaused: reward.is_paused,
        suggestedEffect: this.detectQuantumEffect(reward)
      }));

    } catch (error) {
      if (error.response?.status === 403) {
        logger.error('Accès aux récompenses Channel Points refusé');
        return [];
      }
      logger.error(`Erreur récupération récompenses: ${error.message}`);
      return [];
    }
  }

  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      rewardEffectsCount: this.rewardEffects.size,
      eventSubscriptionsCount: this.processedRedemptions.size,
      lastEventId: this.lastPollTime,
      hasPartnerStatus: this.hasPartnerStatus,
      statusChecked: this.statusChecked,
      quantumEffectsEnabled: true
    };
  }

  cleanupOldEvents() {
    const oldSize = this.processedRedemptions.size;
    this.processedRedemptions.clear();
    
    logger.log(`Nettoyage Channel Points quantiques: ${oldSize} événements supprimés`);
  }
}

module.exports = TwitchChannelPoints;