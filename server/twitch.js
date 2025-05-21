// server/twitch.js - Module d'intégration Twitch et Streamlabs
const axios = require('axios');
const tmi = require('tmi.js');
const io = require('socket.io-client');
const logger = require('./logger');
const dotenv = require('dotenv');

// Chargement des variables d'environnement
dotenv.config();

// Configuration (uniquement depuis les variables d'environnement)
let config = {
  enabled: process.env.TWITCH_ENABLED === 'true',
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
    username: process.env.TWITCH_USERNAME || '',
    oauthToken: process.env.TWITCH_OAUTH_TOKEN || '',
    channelName: process.env.TWITCH_CHANNEL || '',
    webhookSecret: process.env.TWITCH_WEBHOOK_SECRET || '',
  },
  streamlabs: {
    socketToken: process.env.STREAMLABS_SOCKET_TOKEN || '',
    accessToken: process.env.STREAMLABS_ACCESS_TOKEN || '',
  }
};

// Clients
let twitchClient = null;
let streamlabsSocket = null;
let eventCallbacks = [];

/**
 * Initialiser l'intégration Twitch
 * @param {Object} options Options de configuration temporaires (session uniquement)
 * @returns {Promise<boolean>} Succès de l'initialisation
 */
async function initialize(options = {}) {
  try {
    // Mise à jour de la configuration en mémoire uniquement
    if (options.twitch) {
      config.twitch = { ...config.twitch, ...options.twitch };
    }
    if (options.streamlabs) {
      config.streamlabs = { ...config.streamlabs, ...options.streamlabs };
    }
    
    // Vérifier si l'intégration est activée
    if (!config.enabled) {
      logger.log('Intégration Twitch/Streamlabs désactivée');
      return false;
    }
    
    if (config.twitch.channelName && config.twitch.oauthToken) {
      initTwitchClient();
    } else {
      logger.error('Configuration Twitch incomplète: channelName ou oauthToken manquant');
      return false;
    }
    
    // Initialiser le client Streamlabs
    if (config.streamlabs.socketToken) {
      initStreamlabsSocket();
    } else {
      logger.error('Configuration Streamlabs incomplète');
    }
    
    logger.log('Intégration Twitch/Streamlabs initialisée avec succès');
    return true;
  } catch (error) {
    logger.error(`Erreur lors de l'initialisation Twitch/Streamlabs: ${error.message}`);
    return false;
  }
}

/**
 * Initialiser le client Twitch
 */
function initTwitchClient() {
  if (twitchClient) {
    twitchClient.disconnect();
  }

  twitchClient = new tmi.Client({
    options: { debug: true },
    identity: {
      username: config.twitch.username,
      password: config.twitch.oauthToken
    },
    channels: [config.twitch.channelName]
  });

  twitchClient.connect().catch(console.error);

  twitchClient.on('message', (channel, tags, message, self) => {
    // Handle chat messages
    logger.log(`Message reçu sur ${channel}: ${message}`);
  });

  twitchClient.on('connected', (addr, port) => {
    logger.log(`Connecté à Twitch: ${addr}:${port}`);
  });

  twitchClient.on('disconnected', (reason) => {
    logger.error(`Déconnecté de Twitch: ${reason}`);
  });
}

/**
 * Configurer les événements Twitch
 */
function setupTwitchEvents() {
  // Événement de connexion
  twitchClient.on('connected', (addr, port) => {
    logger.log(`Connecté à Twitch (${addr}:${port})`);
  });
  
  // Événement de message
  twitchClient.on('message', (channel, tags, message, self) => {
    // Ignorer les messages du bot
    if (self) return;
    
    // Journaliser le message
    logger.log(`Chat Twitch - ${tags['display-name']}: ${message}`);
    
    // Déclencher l'événement
    triggerEvent('chat', {
      platform: 'twitch',
      username: tags['display-name'],
      message,
      tags
    });
  });
  
  // Événement de nouvel abonnement
  twitchClient.on('subscription', (channel, username, method, message, userstate) => {
    logger.log(`Nouvel abonnement Twitch: ${username}`);
    
    // Déclencher l'événement
    triggerEvent('subscription', {
      platform: 'twitch',
      username,
      tier: method.plan || '1000',
      message
    });
    
    // Mettre à jour les statistiques
    updateSubscriptionStats(1);
  });
  
  // Événement de renouvellement d'abonnement
  twitchClient.on('resub', (channel, username, months, message, userstate, methods) => {
    logger.log(`Renouvellement d'abonnement Twitch: ${username} (${months} mois)`);
    
    // Déclencher l'événement
    triggerEvent('subscription', {
      platform: 'twitch',
      username,
      tier: methods.plan || '1000',
      months,
      message,
      isResub: true
    });
  });
  
  // Événement de bits (donation Twitch)
  twitchClient.on('cheer', (channel, tags, message) => {
    const bits = parseInt(tags.bits, 10);
    logger.log(`Donation de bits: ${tags['display-name']} (${bits} bits)`);
    
    // Déclencher l'événement
    triggerEvent('cheer', {
      platform: 'twitch',
      username: tags['display-name'],
      bits,
      message
    });
    
    // Mettre à jour les statistiques (1000 bits = ~$10)
    const donationAmount = bits / 100;
    updateDonationStats(donationAmount);
  });
  
  // Événement de raid
  twitchClient.on('raided', (channel, username, viewers) => {
    logger.log(`Raid de ${username} avec ${viewers} viewers`);
    
    // Déclencher l'événement
    triggerEvent('raid', {
      platform: 'twitch',
      username,
      viewers
    });
  });
}

/**
 * Initialiser le socket Streamlabs
 */
function initStreamlabsSocket() {
  try {
    // Déconnecter le socket existant s'il y en a un
    if (streamlabsSocket) {
      streamlabsSocket.disconnect();
    }
    
    // Créer le socket
    streamlabsSocket = io(`https://sockets.streamlabs.com?token=${config.streamlabs.socketToken}`, {
      transports: ['websocket']
    });
    
    // Événement de connexion
    streamlabsSocket.on('connect', () => {
      logger.log('Connecté à Streamlabs Socket API');
    });
    
    // Événement de déconnexion
    streamlabsSocket.on('disconnect', () => {
      logger.log('Déconnecté de Streamlabs Socket API');
    });
    
    // Événement d'erreur
    streamlabsSocket.on('error', (error) => {
      logger.error(`Erreur Streamlabs Socket: ${error.message}`);
    });
    
    // Événement de donation
    streamlabsSocket.on('event', (eventData) => {
      if (!eventData.type) return;
      
      // Traiter différents types d'événements
      switch (eventData.type) {
        case 'donation':
          handleStreamlabsDonation(eventData);
          break;
          
        case 'follow':
          handleStreamlabsFollow(eventData);
          break;
          
        case 'subscription':
          handleStreamlabsSubscription(eventData);
          break;
          
        default:
          logger.log(`Événement Streamlabs non géré: ${eventData.type}`);
      }
    });
  } catch (error) {
    logger.error(`Erreur d'initialisation du socket Streamlabs: ${error.message}`);
  }
}

/**
 * Gérer les donations Streamlabs
 * @param {Object} eventData Données de l'événement
 */
function handleStreamlabsDonation(eventData) {
  try {
    if (!eventData.message || !eventData.message.length) return;
    
    const donation = eventData.message[0];
    const amount = parseFloat(donation.amount);
    const name = donation.name || 'Anonymous';
    
    logger.log(`Donation Streamlabs: ${name} (${amount} ${donation.currency})`);
    
    // Déclencher l'événement
    triggerEvent('donation', {
      platform: 'streamlabs',
      username: name,
      amount,
      currency: donation.currency,
      message: donation.message
    });
    
    // Convertir en euros si nécessaire
    if (donation.currency === 'EUR') {
      updateDonationStats(amount);
    } else {
      // Conversion simple (à remplacer par une API de conversion de devises)
      const conversionRates = {
        USD: 0.85,
        GBP: 1.15,
        CAD: 0.65,
        AUD: 0.60,
        // Ajouter d'autres devises selon les besoins
      };
      
      const rate = conversionRates[donation.currency] || 1;
      const euroAmount = amount * rate;
      updateDonationStats(euroAmount);
    }
  } catch (error) {
    logger.error(`Erreur de traitement de donation Streamlabs: ${error.message}`);
  }
}

/**
 * Gérer les follows Streamlabs
 * @param {Object} eventData Données de l'événement
 */
function handleStreamlabsFollow(eventData) {
  try {
    if (!eventData.message || !eventData.message.length) return;
    
    // Pour chaque nouvel abonné
    eventData.message.forEach(follow => {
      logger.log(`Nouveau follow: ${follow.name}`);
      
      // Déclencher l'événement
      triggerEvent('follow', {
        platform: 'streamlabs',
        username: follow.name
      });
    });
  } catch (error) {
    logger.error(`Erreur de traitement de follow Streamlabs: ${error.message}`);
  }
}

/**
 * Gérer les abonnements Streamlabs
 * @param {Object} eventData Données de l'événement
 */
function handleStreamlabsSubscription(eventData) {
  try {
    if (!eventData.message || !eventData.message.length) return;
    
    // Pour chaque abonnement
    eventData.message.forEach(sub => {
      logger.log(`Abonnement Streamlabs: ${sub.name}, tier: ${sub.sub_plan}`);
      
      // Déclencher l'événement
      triggerEvent('subscription', {
        platform: 'streamlabs',
        username: sub.name,
        tier: sub.sub_plan || '1000',
        message: sub.message,
        months: sub.months || 1,
        isResub: sub.months > 1
      });
      
      // Ne mettre à jour les stats que pour les nouveaux abonnements
      if (!sub.months || sub.months <= 1) {
        updateSubscriptionStats(1);
      }
    });
  } catch (error) {
    logger.error(`Erreur de traitement d'abonnement Streamlabs: ${error.message}`);
  }
}

/**
 * Mettre à jour les statistiques de donations
 * @param {number} amount Montant en euros
 */
async function updateDonationStats(amount) {
  try {
    // Récupérer les statistiques actuelles
    const statusPath = path.join(__dirname, '..', 'data', 'status.json');
    let status;
    
    try {
      const statusData = fs.readFileSync(statusPath, 'utf8');
      status = JSON.parse(statusData);
    } catch (error) {
      // Créer un fichier de statut par défaut si inexistant
      status = {
        donation_total: 0,
        donation_goal: 1000,
        subs_total: 0,
        subs_goal: 50,
        last_update: new Date().toISOString()
      };
    }
    
    // Mettre à jour les statistiques
    status.donation_total = (parseFloat(status.donation_total) || 0) + amount;
    status.last_update = new Date().toISOString();
    
    // Sauvegarder les statistiques
    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
    
    // Notifier les clients connectés via API
    const response = await axios.post('http://localhost:3000/api/status', status);
    logger.log(`Mise à jour des statistiques de donations: +${amount}€ (Total: ${status.donation_total}€)`);
    
    return response.data;
  } catch (error) {
    logger.error(`Erreur de mise à jour des statistiques de donations: ${error.message}`);
    return null;
  }
}

/**
 * Mettre à jour les statistiques d'abonnements
 * @param {number} count Nombre d'abonnements
 */
async function updateSubscriptionStats(count) {
  try {
    // Récupérer les statistiques actuelles
    const statusPath = path.join(__dirname, '..', 'data', 'status.json');
    let status;
    
    try {
      const statusData = fs.readFileSync(statusPath, 'utf8');
      status = JSON.parse(statusData);
    } catch (error) {
      // Créer un fichier de statut par défaut si inexistant
      status = {
        donation_total: 0,
        donation_goal: 1000,
        subs_total: 0,
        subs_goal: 50,
        last_update: new Date().toISOString()
      };
    }
    
    // Mettre à jour les statistiques
    status.subs_total = (parseInt(status.subs_total) || 0) + count;
    status.last_update = new Date().toISOString();
    
    // Sauvegarder les statistiques
    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
    
    // Notifier les clients connectés via API
    const response = await axios.post('http://localhost:3000/api/status', status);
    logger.log(`Mise à jour des statistiques d'abonnements: +${count} (Total: ${status.subs_total})`);
    
    return response.data;
  } catch (error) {
    logger.error(`Erreur de mise à jour des statistiques d'abonnements: ${error.message}`);
    return null;
  }
}

/**
 * Envoyer un message dans le chat Twitch
 * @param {string} message Message à envoyer
 * @returns {Promise<boolean>} Succès de l'envoi
 */
async function sendTwitchMessage(message) {
  try {
    if (!twitchClient || !config.twitch.channelName) {
      logger.error('Client Twitch non initialisé ou nom de chaîne manquant');
      return false;
    }
    
    // Envoyer le message
    await twitchClient.say(config.twitch.channelName, message);
    logger.log(`Message envoyé sur Twitch: ${message}`);
    return true;
  } catch (error) {
    logger.error(`Erreur d'envoi de message Twitch: ${error.message}`);
    return false;
  }
}

/**
 * Déclencher un effet sur Streamlabs
 * @param {string} type Type d'effet (alert, media, sound)
 * @param {Object} data Données de l'effet
 * @returns {Promise<boolean>} Succès du déclenchement
 */
async function triggerStreamlabsEffect(type, data) {
  try {
    if (!config.streamlabs.accessToken) {
      logger.error('Token d\'accès Streamlabs manquant');
      return false;
    }
    
    // Construire l'URL de l'API Streamlabs
    const url = 'https://streamlabs.com/api/v1.0/alerts';
    
    // Construire les données de la requête
    const requestData = {
      access_token: config.streamlabs.accessToken,
      type,
      ...data
    };
    
    // Envoyer la requête
    const response = await axios.post(url, requestData);
    logger.log(`Effet Streamlabs déclenché: ${type}`);
    return true;
  } catch (error) {
    logger.error(`Erreur de déclenchement d'effet Streamlabs: ${error.message}`);
    return false;
  }
}

/**
 * Ajouter un callback pour un événement
 * @param {string} event Nom de l'événement
 * @param {Function} callback Fonction de callback
 */
function on(event, callback) {
  eventCallbacks.push({ event, callback });
  logger.log(`Callback ajouté pour l'événement ${event}`);
}

/**
 * Déclencher un événement
 * @param {string} event Nom de l'événement
 * @param {Object} data Données de l'événement
 */
function triggerEvent(event, data) {
  // Ajouter l'horodatage
  data.timestamp = new Date().toISOString();
  
  // Appeler les callbacks
  eventCallbacks
    .filter(cb => cb.event === event || cb.event === '*')
    .forEach(cb => {
      try {
        cb.callback(data);
      } catch (error) {
        logger.error(`Erreur dans le callback pour l'événement ${event}: ${error.message}`);
      }
    });
}

/**
 * Obtenir les informations sur le stream
 * @returns {Promise<Object>} Informations sur le stream
 */
async function getStreamInfo() {
  try {
    if (!config.twitch.clientId || !config.twitch.clientSecret || !config.twitch.channelName) {
      logger.error('Configuration Twitch incomplète');
      return null;
    }
    
    // Obtenir un token d'accès
    const tokenResponse = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${config.twitch.clientId}&client_secret=${config.twitch.clientSecret}&grant_type=client_credentials`);
    const accessToken = tokenResponse.data.access_token;
    
    // Obtenir les informations sur le stream
    const streamResponse = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${config.twitch.channelName}`, {
      headers: {
        'Client-ID': config.twitch.clientId,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // Vérifier si le stream est en ligne
    if (!streamResponse.data.data || streamResponse.data.data.length === 0) {
      return { isLive: false };
    }
    
    // Obtenir des informations supplémentaires sur l'utilisateur
    const userResponse = await axios.get(`https://api.twitch.tv/helix/users?login=${config.twitch.channelName}`, {
      headers: {
        'Client-ID': config.twitch.clientId,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // Combiner les données
    const streamData = streamResponse.data.data[0];
    const userData = userResponse.data.data[0];
    
    return {
      isLive: true,
      id: streamData.id,
      title: streamData.title,
      viewers: streamData.viewer_count,
      startedAt: streamData.started_at,
      gameName: streamData.game_name,
      thumbnailUrl: streamData.thumbnail_url.replace('{width}', '1280').replace('{height}', '720'),
      username: userData.display_name,
      profileImageUrl: userData.profile_image_url
    };
  } catch (error) {
    logger.error(`Erreur de récupération des informations du stream: ${error.message}`);
    return null;
  }
}

/**
 * Activer/désactiver l'intégration
 * @param {boolean} enabled État d'activation
 */
function setEnabled(enabled) {
    config.enabled = !!enabled;
    
    if (config.enabled) {
      initialize();
    } else {
      // Déconnecter le client Twitch
      if (twitchClient) {
        twitchClient.disconnect();
        twitchClient = null;
      }
      
      // Déconnecter le socket Streamlabs
      if (streamlabsSocket) {
        streamlabsSocket.disconnect();
        streamlabsSocket = null;
      }
    }
    
    logger.log(`Intégration Twitch/Streamlabs ${config.enabled ? 'activée' : 'désactivée'}`);
    return config.enabled;
  }
  
  /**
   * Obtenir la configuration actuelle
   * @returns {Object} Configuration
   */
  function getConfig() {
    return { ...config };
  }
  
  // Exposer les fonctions
  module.exports = {
    initialize,
    sendTwitchMessage,
    triggerStreamlabsEffect,
    on,
    getStreamInfo,
    setEnabled,
    getConfig,
    updateDonationStats,
    updateSubscriptionStats
  };