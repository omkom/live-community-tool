// server/routes/channel-points.js - Routes API complètes pour Channel Points
const express = require('express');
const logger = require('../logger');

function setupChannelPointsRoutes(app, twitchOAuth, channelPointsManager, broadcast) {
  
  // ======= ROUTES DIAGNOSTICS ET STATUS =======
  
  // GET - Diagnostic complet du système
  app.get('/api/channel-points/diagnostic', async (req, res) => {
    try {
      const diagnostic = {
        timestamp: new Date().toISOString(),
        oauth: {
          connected: twitchOAuth?.isConnected() || false,
          user: null,
          scopes: null,
          expires_at: null
        },
        channel_points: {
          initialized: !!channelPointsManager,
          monitoring: false,
          status_checked: false,
          partner_status: false,
          rewards_count: 0,
          effects_configured: 0
        },
        system: {
          node_version: process.version,
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      };

      if (twitchOAuth?.isConnected()) {
        const info = twitchOAuth.getConnectionInfo();
        diagnostic.oauth.user = info.user;
        diagnostic.oauth.scopes = info.scopes;
        diagnostic.oauth.expires_at = info.expires_at;
      }

      if (channelPointsManager) {
        const status = channelPointsManager.getStatus();
        diagnostic.channel_points = {
          ...diagnostic.channel_points,
          monitoring: status.isMonitoring,
          status_checked: status.statusChecked,
          partner_status: status.hasPartnerStatus,
          effects_configured: status.rewardEffectsCount,
          events_processed: status.eventSubscriptionsCount
        };

        // Tester l'accès aux récompenses
        try {
          const rewards = await channelPointsManager.getAvailableRewards();
          diagnostic.channel_points.rewards_count = rewards.length;
          diagnostic.channel_points.rewards_access = 'success';
        } catch (error) {
          diagnostic.channel_points.rewards_access = 'error';
          diagnostic.channel_points.rewards_error = error.message;
        }
      }

      res.json(diagnostic);

    } catch (error) {
      logger.error(`Erreur diagnostic Channel Points: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // POST - Test de configuration automatique
  app.post('/api/channel-points/auto-configure', async (req, res) => {
    try {
      if (!channelPointsManager) {
        return res.status(400).json({
          success: false,
          error: 'Channel Points non initialisé'
        });
      }

      const rewards = await channelPointsManager.getAvailableRewards();
      const autoMappings = {};
      let configuredCount = 0;

      // Configuration automatique basée sur les mots-clés
      rewards.forEach(reward => {
        const suggestedEffect = reward.suggestedEffect;
        if (suggestedEffect && suggestedEffect !== 'pulse') {
          autoMappings[reward.title.toLowerCase()] = suggestedEffect;
          configuredCount++;
        }
      });

      // Appliquer la configuration
      if (configuredCount > 0) {
        channelPointsManager.configureRewardEffects(autoMappings);
      }

      res.json({
        success: true,
        message: `Configuration automatique terminée`,
        rewards_analyzed: rewards.length,
        effects_configured: configuredCount,
        mappings: autoMappings
      });

      logger.log(`Configuration automatique: ${configuredCount} effets configurés`);

    } catch (error) {
      logger.error(`Erreur configuration automatique: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ======= ROUTES GESTION AVANCÉE =======

  // GET - Historique des événements
  app.get('/api/channel-points/events', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      
      if (!channelPointsManager) {
        return res.json({ events: [], count: 0 });
      }

      // Simuler un historique (à implémenter selon vos besoins)
      const mockEvents = [
        {
          id: 'event_1',
          type: 'redemption',
          reward: 'Perturbation Quantique',
          user: 'ViewerTest',
          effect: 'perturbation',
          timestamp: new Date(Date.now() - 300000).toISOString()
        }
      ];

      res.json({
        events: mockEvents.slice(0, limit),
        count: mockEvents.length,
        limit: limit
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST - Créer une récompense de test
  app.post('/api/channel-points/create-test-reward', async (req, res) => {
    try {
      if (!twitchOAuth?.isConnected()) {
        return res.status(400).json({
          success: false,
          error: 'OAuth Twitch requis'
        });
      }

      const { title, cost, effect } = req.body;

      if (!title || !cost || !effect) {
        return res.status(400).json({
          success: false,
          error: 'Titre, coût et effet requis'
        });
      }

      const tokens = await twitchOAuth.ensureValidTokens();
      const userInfo = twitchOAuth.getConnectionInfo();
      
      // Créer la récompense via l'API Twitch
      const response = await axios.post(
        `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${userInfo.user.id}`,
        {
          title: title,
          cost: parseInt(cost),
          prompt: `Effet: ${effect}`,
          is_enabled: true,
          is_user_input_required: false,
          background_color: effect === 'perturbation' ? 'BLUE' : 'PURPLE'
        },
        {
          headers: {
            'Client-ID': twitchOAuth.clientId,
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.json({
        success: true,
        message: 'Récompense de test créée',
        reward: response.data.data[0]
      });

      logger.log(`Récompense de test créée: ${title} (${cost} points)`);

    } catch (error) {
      logger.error(`Erreur création récompense test: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ======= ROUTES MONITORING AVANCÉ =======

  // GET - Métriques en temps réel
  app.get('/api/channel-points/metrics', (req, res) => {
    try {
      if (!channelPointsManager) {
        return res.json({ 
          metrics: null,
          message: 'Channel Points non initialisé'
        });
      }

      const status = channelPointsManager.getStatus();
      const metrics = {
        monitoring: {
          active: status.isMonitoring,
          uptime: status.isMonitoring ? Date.now() - status.lastEventId : 0
        },
        rewards: {
          effects_configured: status.rewardEffectsCount,
          quantum_effects: ['quantum_collapse', 'temporal_rewind', 'cognitive_collapse', 'butterfly_effect', 'quantum_consciousness'].length
        },
        events: {
          processed_total: status.eventSubscriptionsCount,
          last_poll: status.lastEventId,
          poll_interval: 8000
        },
        performance: {
          memory_usage: process.memoryUsage(),
          cpu_usage: process.cpuUsage()
        }
      };

      res.json({ metrics });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST - Redémarrer la surveillance avec diagnostic
  app.post('/api/channel-points/restart-monitoring', async (req, res) => {
    try {
      if (!channelPointsManager) {
        return res.status(400).json({
          success: false,
          error: 'Channel Points non initialisé'
        });
      }

      // Arrêter la surveillance actuelle
      channelPointsManager.stopMonitoring();
      
      // Attendre 2 secondes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redémarrer
      const result = await channelPointsManager.startMonitoring();
      
      const status = channelPointsManager.getStatus();

      res.json({
        success: result,
        message: result ? 'Surveillance redémarrée avec succès' : 'Échec du redémarrage',
        status: {
          monitoring: status.isMonitoring,
          partner_status: status.hasPartnerStatus,
          effects_count: status.rewardEffectsCount
        }
      });

      logger.log(`Surveillance Channel Points redémarrée: ${result ? 'succès' : 'échec'}`);

    } catch (error) {
      logger.error(`Erreur redémarrage surveillance: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ======= ROUTES EFFETS QUANTIQUES =======

  // GET - Liste des effets disponibles avec descriptions
  app.get('/api/channel-points/effects', (req, res) => {
    try {
      const effects = {
        quantum_effects: [
          {
            id: 'quantum_collapse',
            name: 'Effondrement Quantique',
            description: 'Demande une réponse instantanée du chat',
            duration: 8000,
            keywords: ['effondrement', 'collapse', 'question'],
            cost_suggestion: 750
          },
          {
            id: 'temporal_rewind',
            name: 'Recul Temporel',
            description: 'Le streamer doit répéter sa dernière phrase',
            duration: 6000,
            keywords: ['recul', 'temporel', 'rewind', 'temps'],
            cost_suggestion: 1000
          },
          {
            id: 'cognitive_collapse',
            name: 'Collapse Cognitif',
            description: 'Expliquer un concept complexe comme à un enfant de 5 ans',
            duration: 10000,
            keywords: ['cognitif', 'expliquer', 'enfant', 'concept'],
            cost_suggestion: 1500
          },
          {
            id: 'butterfly_effect',
            name: 'Effet Papillon',
            description: 'Mutations visuelles pendant 5 minutes',
            duration: 300000,
            keywords: ['papillon', 'mutation', 'background'],
            cost_suggestion: 1200
          },
          {
            id: 'quantum_consciousness',
            name: 'Conscience Quantique',
            description: 'Affiche une citation mystérieuse',
            duration: 7000,
            keywords: ['conscience', 'citation', 'mystérieuse'],
            cost_suggestion: 800
          }
        ],
        classic_effects: [
          {
            id: 'perturbation',
            name: 'Perturbation Visuelle',
            description: 'Effet visuel de perturbation',
            duration: 5000,
            keywords: ['perturbation'],
            cost_suggestion: 500
          },
          {
            id: 'tada',
            name: 'Confetti',
            description: 'Confettis et célébration',
            duration: 3000,
            keywords: ['confetti', 'tada'],
            cost_suggestion: 100
          },
          {
            id: 'flash',
            name: 'Flash',
            description: 'Flash lumineux',
            duration: 1000,
            keywords: ['flash'],
            cost_suggestion: 50
          },
          {
            id: 'pulse',
            name: 'Pulsation',
            description: 'Effet de pulsation',
            duration: 3000,
            keywords: ['pulse'],
            cost_suggestion: 200
          }
        ]
      };

      res.json(effects);

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST - Tester un effet quantique spécifique
  app.post('/api/channel-points/test-quantum-effect', async (req, res) => {
    try {
      const { effectType, userInput, userName = 'QuantumTester' } = req.body;

      const quantumEffects = [
        'quantum_collapse', 'temporal_rewind', 'cognitive_collapse', 
        'butterfly_effect', 'quantum_consciousness'
      ];

      if (!quantumEffects.includes(effectType)) {
        return res.status(400).json({
          success: false,
          error: `Effet quantique invalide. Disponibles: ${quantumEffects.join(', ')}`
        });
      }

      // Données enrichies pour les effets quantiques
      const effectData = {
        userInput: userInput || null,
        userName: userName,
        timestamp: new Date().toISOString()
      };

      // Déclencher l'effet avec données
      broadcast({ 
        type: 'effect', 
        value: effectType, 
        data: effectData 
      });

      // Message de confirmation après délai
      setTimeout(() => {
        broadcast({ 
          type: 'message', 
          value: `🔮 TEST QUANTIQUE: ${userName} a activé ${effectType}` 
        });
      }, 1500);

      res.json({
        success: true,
        message: `Effet quantique "${effectType}" déclenché`,
        effect: effectType,
        data: effectData
      });

      logger.log(`Test effet quantique: ${effectType} par ${userName}`);

    } catch (error) {
      logger.error(`Erreur test effet quantique: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  logger.log('✅ Routes Channel Points complètes configurées');
}

module.exports = { setupChannelPointsRoutes }