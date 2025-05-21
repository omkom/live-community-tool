// server/n8n.js - Module pour l'intégration avec N8N
const axios = require('axios');
const crypto = require('crypto');
const express = require('express');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'n8n_config.json');
let config = {
  enabled: false,
  webhookSecret: process.env.N8N_WEBHOOK_SECRET || '',
  n8nUrl: process.env.N8N_URL || 'http://localhost:5678',
  apiKey: process.env.N8N_API_KEY || '',
  webhooks: {
    streamStart: '/webhook/stream-start',
    streamEnd: '/webhook/stream-end',
    donation: '/webhook/donation',
    subscription: '/webhook/subscription',
    chat: '/webhook/chat'
  }
};

// Chargement de la configuration existante
try {
  if (fs.existsSync(CONFIG_PATH)) {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config = { ...config, ...savedConfig };
  }
} catch (error) {
  logger.error(`Erreur lors du chargement de la configuration N8N: ${error.message}`);
}

/**
 * Sauvegarder la configuration
 */
function saveConfig() {
  try {
    // Créer le dossier data s'il n'existe pas
    const dataDir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Sauvegarder la configuration
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    logger.log('Configuration N8N sauvegardée');
  } catch (error) {
    logger.error(`Erreur lors de la sauvegarde de la configuration N8N: ${error.message}`);
  }
}

/**
 * Initialiser les routes webhook pour N8N
 * @param {express.Router} router Router Express
 */
function setupRoutes(router) {
  // Middleware pour vérifier la signature des webhooks
  const validateWebhook = (req, res, next) => {
    if (!config.enabled) {
      return res.status(503).json({ error: 'N8N integration is disabled' });
    }
    
    if (!config.webhookSecret) {
      // Bypass validation if no secret is set (development)
      return next();
    }
    
    const signature = req.headers['x-n8n-signature'];
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    const payload = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', config.webhookSecret);
    const digest = hmac.update(payload).digest('hex');
    
    if (signature !== digest) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    next();
  };
  
  // Route pour recevoir les webhooks entrants de N8N
  router.post('/n8n/webhook', validateWebhook, (req, res) => {
    try {
      const { event, data } = req.body;
      
      if (!event) {
        return res.status(400).json({ error: 'Missing event type' });
      }
      
      logger.log(`Webhook N8N reçu: ${event}`);
      logger.activity('n8n_webhook', { event, data });
      
      // Traiter l'événement
      switch (event) {
        case 'stream_trigger':
          handleStreamTrigger(data);
          break;
          
        case 'audience_update':
          handleAudienceUpdate(data);
          break;
          
        case 'schedule_update':
          handleScheduleUpdate(data);
          break;
          
        case 'marketing_action':
          handleMarketingAction(data);
          break;
          
        default:
          logger.log(`Événement N8N non géré: ${event}`);
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error(`Erreur de traitement de webhook N8N: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Route pour vérifier l'état de l'intégration
  router.get('/n8n/status', (req, res) => {
    res.json({
      enabled: config.enabled,
      connected: config.enabled && !!config.n8nUrl,
      webhooks: config.webhooks
    });
  });
  
  // Route pour configurer l'intégration
  router.post('/n8n/config', (req, res) => {
    try {
      const { enabled, n8nUrl, apiKey, webhookSecret, webhooks } = req.body;
      
      // Mise à jour de la configuration
      if (typeof enabled === 'boolean') config.enabled = enabled;
      if (n8nUrl) config.n8nUrl = n8nUrl;
      if (apiKey) config.apiKey = apiKey;
      if (webhookSecret) config.webhookSecret = webhookSecret;
      if (webhooks) config.webhooks = { ...config.webhooks, ...webhooks };
      
      // Sauvegarder la configuration
      saveConfig();
      
      res.json({
        success: true,
        config: {
          enabled: config.enabled,
          n8nUrl: config.n8nUrl,
          webhooks: config.webhooks
        }
      });
    } catch (error) {
      logger.error(`Erreur de configuration N8N: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });
}

/**
 * Gérer un déclenchement de stream (début/fin)
 * @param {Object} data Données du stream
 */
function handleStreamTrigger(data) {
  try {
    if (!data || !data.action) {
      logger.error('Données de déclenchement de stream invalides');
      return;
    }
    
    const { action } = data;
    
    // Selon l'action
    switch (action) {
      case 'start':
        logger.log('Démarrage de stream via N8N');
        // Mettre à jour l'heure de début du stream
        updateStreamStartTime();
        break;
        
      case 'end':
        logger.log('Fin de stream via N8N');
        break;
        
      default:
        logger.log(`Action de stream non reconnue: ${action}`);
    }
  } catch (error) {
    logger.error(`Erreur de traitement de déclenchement de stream: ${error.message}`);
  }
}

/**
 * Mettre à jour l'heure de début du stream
 */
function updateStreamStartTime() {
  try {
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
    
    // Mettre à jour l'heure de début du stream
    status.stream_start_time = new Date().toISOString();
    status.last_update = new Date().toISOString();
    
    // Sauvegarder les statistiques
    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
    
    // Notifier les clients connectés via API
    axios.post('http://localhost:3000/api/status', status)
      .then(() => {
        logger.log('Heure de début du stream mise à jour');
      })
      .catch((error) => {
        logger.error(`Erreur de notification de mise à jour de l'heure de début: ${error.message}`);
      });
  } catch (error) {
    logger.error(`Erreur de mise à jour de l'heure de début du stream: ${error.message}`);
  }
}

/**
 * Gérer une mise à jour d'audience
 * @param {Object} data Données d'audience
 */
function handleAudienceUpdate(data) {
  try {
    if (!data) {
      logger.error('Données de mise à jour d\'audience invalides');
      return;
    }
    
    logger.log(`Mise à jour d'audience via N8N: ${JSON.stringify(data)}`);
    
    // Mise à jour des statistiques selon les données
    if (data.viewers) {
      // Enregistrement des statistiques de viewers (à implémenter)
    }
    
    if (data.followers) {
      // Enregistrement des statistiques de followers (à implémenter)
    }
  } catch (error) {
    logger.error(`Erreur de traitement de mise à jour d'audience: ${error.message}`);
  }
}

/**
 * Gérer une mise à jour de planning
 * @param {Object} data Données de planning
 */
function handleScheduleUpdate(data) {
  try {
    if (!data || !data.items) {
      logger.error('Données de mise à jour de planning invalides');
      return;
    }
    
    logger.log(`Mise à jour de planning via N8N: ${data.items.length} éléments`);
    
    // Charger le planning actuel
    const planningPath = path.join(__dirname, '..', 'data', 'stream24h.json');
    let planning;
    
    try {
      const planningData = fs.readFileSync(planningPath, 'utf8');
      planning = JSON.parse(planningData);
    } catch (error) {
      planning = { planning: [] };
    }
    
    // Mettre à jour ou ajouter les éléments du planning
    data.items.forEach(item => {
      if (!item.time || !item.label) return;
      
      // Chercher un élément existant avec la même heure
      const existingIndex = planning.planning.findIndex(p => p.time === item.time);
      
      if (existingIndex >= 0) {
        // Mettre à jour l'élément existant
        planning.planning[existingIndex] = {
          ...planning.planning[existingIndex],
          ...item
        };
      } else {
        // Ajouter un nouvel élément
        planning.planning.push({
          time: item.time,
          label: item.label,
          checked: item.checked || false
        });
      }
    });
    
    // Sauvegarder le planning
    fs.writeFileSync(planningPath, JSON.stringify(planning, null, 2));
    
    // Notifier les clients connectés via API
    axios.post('http://localhost:3000/api/planning', planning)
      .then(() => {
        logger.log('Planning mis à jour');
      })
      .catch((error) => {
        logger.error(`Erreur de notification de mise à jour du planning: ${error.message}`);
      });
  } catch (error) {
    logger.error(`Erreur de traitement de mise à jour de planning: ${error.message}`);
  }
}

/**
 * Gérer une action marketing
 * @param {Object} data Données de l'action
 */
function handleMarketingAction(data) {
  try {
    if (!data || !data.type) {
      logger.error('Données d\'action marketing invalides');
      return;
    }
    
    logger.log(`Action marketing via N8N: ${data.type}`);
    
    // Selon le type d'action
    switch (data.type) {
      case 'effect':
        // Déclencher un effet visuel
        if (data.effect) {
          axios.post('http://localhost:3000/api/effect', { type: data.effect })
            .then(() => {
              logger.log(`Effet ${data.effect} déclenché`);
            })
            .catch((error) => {
              logger.error(`Erreur de déclenchement d'effet: ${error.message}`);
            });
        }
        break;
        
      case 'message':
        // Envoyer un message à l'overlay
        if (data.message) {
          axios.post('http://localhost:3000/api/message', { message: data.message })
            .then(() => {
              logger.log(`Message envoyé: ${data.message}`);
            })
            .catch((error) => {
              logger.error(`Erreur d'envoi de message: ${error.message}`);
            });
        }
        break;
        
      case 'social_push':
        // Gérer une notification pour les réseaux sociaux
        logger.log(`Push social: ${data.platform} - ${data.message}`);
        break;
        
      case 'email':
        // Gérer un envoi d'email
        logger.log(`Email: ${data.subject} - ${data.recipients?.length || 0} destinataires`);
        break;
        
      default:
        logger.log(`Type d'action marketing non reconnu: ${data.type}`);
    }
  } catch (error) {
    logger.error(`Erreur de traitement d'action marketing: ${error.message}`);
  }
}

/**
 * Envoyer un événement à N8N
 * @param {string} eventType Type d'événement
 * @param {Object} data Données de l'événement
 */
async function sendEvent(eventType, data) {
  try {
    if (!config.enabled || !config.n8nUrl) {
      logger.error('Intégration N8N désactivée ou URL non configurée');
      return false;
    }
    
    // Obtenir l'URL du webhook pour ce type d'événement
    const webhookPath = config.webhooks[eventType];
    if (!webhookPath) {
      logger.error(`Pas de webhook configuré pour l'événement ${eventType}`);
      return false;
    }
    
    // Construire l'URL complète
    const webhookUrl = `${config.n8nUrl}${webhookPath}`;
    
    // Ajouter des métadonnées à l'événement
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data
    };
    
    // Ajouter une signature si un secret est configuré
    const headers = {};
    if (config.webhookSecret) {
      const hmac = crypto.createHmac('sha256', config.webhookSecret);
      const signature = hmac.update(JSON.stringify(payload)).digest('hex');
      headers['x-webhook-signature'] = signature;
    }
    
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }
    
    // Envoyer la requête
    const response = await axios.post(webhookUrl, payload, { headers });
    logger.log(`Événement ${eventType} envoyé à N8N avec succès`);
    
    return response.data;
  } catch (error) {
    logger.error(`Erreur d'envoi d'événement à N8N: ${error.message}`);
    return false;
  }
}

/**
 * Activer/désactiver l'intégration N8N
 * @param {boolean} enabled État d'activation
 */
function setEnabled(enabled) {
  config.enabled = !!enabled;
  saveConfig();
  logger.log(`Intégration N8N ${config.enabled ? 'activée' : 'désactivée'}`);
  return config.enabled;
}

/**
 * Tester la connexion avec N8N
 * @returns {Promise<boolean>} Résultat du test
 */
async function testConnection() {
  try {
    if (!config.n8nUrl) {
      return false;
    }
    
    // Tester la connexion en faisant une requête simple
    const response = await axios.get(`${config.n8nUrl}/healthz`);
    return response.status === 200;
  } catch (error) {
    logger.error(`Erreur de test de connexion N8N: ${error.message}`);
    return false;
  }
}

/**
 * Obtenir la configuration actuelle
 * @returns {Object} Configuration
 */
function getConfig() {
  return {
    enabled: config.enabled,
    n8nUrl: config.n8nUrl,
    webhooks: config.webhooks
  };
}

// Exposer les fonctions
module.exports = {
  setupRoutes,
  sendEvent,
  setEnabled,
  testConnection,
  getConfig
};