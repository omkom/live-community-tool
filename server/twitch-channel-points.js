// server/twitch-channel-points.js - Version corrigée avec gestion d'erreurs
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
    this.hasPartnerStatus = false; // Nouveau : tracker le statut
    this.statusChecked = false;    // Nouveau : éviter les vérifications répétées
    
    // Configuration des effets par défaut
    this.setDefaultEffects();
  }

  setDefaultEffects() {
    this.rewardEffects.set('confetti', 'tada');
    this.rewardEffects.set('celebration', 'tada');
    this.rewardEffects.set('perturbation', 'perturbation');
    this.rewardEffects.set('flash', 'flash');
    this.rewardEffects.set('éclair', 'flash');
    this.rewardEffects.set('zoom', 'zoom');
    this.rewardEffects.set('shake', 'shake');
    this.rewardEffects.set('secoue', 'shake');
    this.rewardEffects.set('bounce', 'bounce');
    this.rewardEffects.set('rebond', 'bounce');
    this.rewardEffects.set('pulse', 'pulse');
    this.rewardEffects.set('coeur', 'pulse');
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      logger.log('Surveillance Channel Points déjà active');
      return true;
    }

    try {
      // Vérifier que OAuth est connecté
      if (!this.twitchOAuth.isConnected()) {
        throw new Error('OAuth Twitch non connecté');
      }

      // Vérifier les tokens
      const tokens = await this.twitchOAuth.ensureValidTokens();
      if (!tokens) {
        throw new Error('Tokens Twitch invalides');
      }

      // Vérifier le statut du streamer
      const statusCheck = await this.checkStreamerStatus();
      if (!statusCheck.success) {
        throw new Error(statusCheck.error);
      }

      this.isMonitoring = true;
      this.startPolling();
      
      logger.log('✅ Surveillance Channel Points démarrée');
      this.emit('monitoring:started');
      
      return true;

    } catch (error) {
      logger.error(`Erreur démarrage Channel Points: ${error.message}`);
      this.emit('error', error);
      return false;
    }
  }

  // NOUVEAU : Vérifier le statut du streamer
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

      // Vérifier les informations du broadcaster
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

        logger.log(`Statut vérifié : ${user.broadcaster_type} - Channel Points disponibles`);
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

    logger.log('✅ Surveillance Channel Points arrêtée');
    this.emit('monitoring:stopped');
  }

  startPolling() {
    // Polling toutes les 10 secondes (réduit la fréquence)
    this.pollInterval = setInterval(async () => {
      try {
        await this.checkForNewRedemptions();
      } catch (error) {
        // AMÉLIORÉ : Gestion d'erreur plus granulaire
        if (error.response?.status === 403) {
          logger.error('Erreur 403 - Arrêt de la surveillance Channel Points');
          this.stopMonitoring();
          this.emit('error', new Error('Permissions insuffisantes pour Channel Points'));
        } else {
          logger.error(`Erreur polling Channel Points: ${error.message}`);
        }
      }
    }, 10000); // Changé de 5000 à 10000ms

    logger.log('Polling Channel Points démarré');
  }

  async testTwitchAPI() {
    try {
      const tokens = await this.twitchOAuth.ensureValidTokens();
      if (!tokens) {
        return { success: false, error: 'Tokens non disponibles' };
      }

      // Test avec l'API Users
      const response = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
          'Client-ID': this.twitchOAuth.clientId,
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      if (response.status === 200 && response.data.data.length > 0) {
        return { 
          success: true, 
          user: response.data.data[0] 
        };
      } else {
        return { success: false, error: 'Réponse API invalide' };
      }

    } catch (error) {
      let errorMsg = 'Erreur inconnue';
      
      if (error.response?.status === 401) {
        errorMsg = 'Token expiré ou invalide';
      } else if (error.response?.status === 403) {
        errorMsg = 'Permissions insuffisantes';
      } else {
        errorMsg = error.message;
      }

      return { success: false, error: errorMsg };
    }
  }

  async checkForNewRedemptions() {
    try {
      const tokens = await this.twitchOAuth.ensureValidTokens();
      if (!tokens) {
        logger.error('Tokens non disponibles pour Channel Points');
        return;
      }

      // Obtenir l'ID utilisateur
      const userInfo = this.twitchOAuth.getConnectionInfo();
      if (!userInfo.connected || !userInfo.user) {
        logger.error('Informations utilisateur non disponibles');
        return;
      }

      const broadcasterId = userInfo.user.id;

      // Récupérer les récompenses personnalisées avec gestion d'erreur
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
          // AMÉLIORÉ : Log plus informatif et arrêt gracieux
          logger.error('Erreur 403 - Accès Channel Points refusé. Vérifiez :');
          logger.error('1. Statut Affilié/Partenaire Twitch');
          logger.error('2. Client ID correspond à l\'app qui a créé les récompenses');
          logger.error('3. Permissions OAuth (channel:read:redemptions)');
          
          // Arrêter la surveillance pour éviter le spam d'erreurs
          this.stopMonitoring();
          this.emit('error', new Error('Accès Channel Points refusé - Surveillance arrêtée'));
        }
        throw rewardError;
      }

      // Vérifier les rachats pour chaque récompense
      for (const reward of rewardsResponse.data.data) {
        await this.checkRewardRedemptions(broadcasterId, reward, tokens);
      }

      this.lastPollTime = Date.now();

    } catch (error) {
      if (error.response?.status === 401) {
        logger.error('Token expiré, reconnexion requise');
        this.emit('error', new Error('Token expiré'));
      } else if (error.response?.status === 403) {
        // Déjà géré au-dessus
        return;
      } else {
        logger.error(`Erreur vérification rachats: ${error.message}`);
      }
    }
  }

  async checkRewardRedemptions(broadcasterId, reward, tokens) {
    try {
      // Récupérer les rachats récents (depuis le dernier poll)
      const since = new Date(Date.now() - 60000).toISOString(); // Dernière minute
      
      const redemptionsResponse = await axios.get(
        `https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${broadcasterId}&reward_id=${reward.id}&status=FULFILLED&sort=NEWEST&first=20&started_at=${since}`,
        {
          headers: {
            'Client-ID': this.twitchOAuth.clientId,
            'Authorization': `Bearer ${tokens.access_token}`
          }
        }
      );

      // Traiter les nouveaux rachats
      for (const redemption of redemptionsResponse.data.data) {
        const redemptionKey = `${redemption.id}`;
        
        // Éviter le traitement en double
        if (this.processedRedemptions.has(redemptionKey)) {
          continue;
        }

        this.processedRedemptions.add(redemptionKey);
        await this.handleRedemption(reward, redemption);
      }

      // Nettoyer les anciens rachats traités (garder 1000 max)
      if (this.processedRedemptions.size > 1000) {
        const entries = Array.from(this.processedRedemptions);
        this.processedRedemptions.clear();
        entries.slice(-500).forEach(id => this.processedRedemptions.add(id));
      }

    } catch (error) {
      // AMÉLIORÉ : Ne pas logger l'erreur 403 répétitivement
      if (error.response?.status !== 403) {
        logger.error(`Erreur rachats pour ${reward.title}: ${error.message}`);
      }
      // Ne plus logger les détails JSON pour réduire le spam
    }
  }

  async handleRedemption(reward, redemption) {
    try {
      logger.log(`Channel Points: ${redemption.user_name} → ${reward.title} (${reward.cost} points)`);

      // Détecter l'effet
      const effect = this.detectEffect(reward);
      
      // Émettre l'événement de rachat
      this.emit('redemption', {
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
          user_input: redemption.user_input,
          redeemed_at: redemption.redeemed_at
        },
        effect: effect
      });

    } catch (error) {
      logger.error(`Erreur traitement rachat: ${error.message}`);
    }
  }

  detectEffect(reward) {
    const title = reward.title.toLowerCase();
    const prompt = (reward.prompt || '').toLowerCase();
    
    // Rechercher dans les mappings configurés
    for (const [keyword, effect] of this.rewardEffects) {
      if (title.includes(keyword) || prompt.includes(keyword)) {
        return effect;
      }
    }

    // Détection par coût si aucun mot-clé trouvé
    if (reward.cost >= 1000) return 'tada';
    if (reward.cost >= 500) return 'pulse';
    if (reward.cost >= 100) return 'bounce';
    
    return 'flash'; // Effet par défaut
  }

  configureRewardEffects(mappings) {
    this.rewardEffects.clear();
    this.setDefaultEffects(); // Garder les mappings par défaut
    
    // Ajouter les mappings personnalisés
    for (const [keyword, effect] of Object.entries(mappings)) {
      this.rewardEffects.set(keyword.toLowerCase(), effect);
    }
    
    logger.log(`Channel Points configuré: ${this.rewardEffects.size} mappings`);
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

      // Vérifier d'abord le statut
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
        suggestedEffect: this.detectEffect(reward)
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
      statusChecked: this.statusChecked
    };
  }

  cleanupOldEvents() {
    const oldSize = this.processedRedemptions.size;
    this.processedRedemptions.clear();
    
    logger.log(`Nettoyage Channel Points: ${oldSize} événements supprimés`);
  }
}

module.exports = TwitchChannelPoints;