// server/controllers/twitch-api.js
const logger = require('../logger');
//const TwitchApiController = require('./twitch-api-controller');

/**
 * Twitch API Controller
 */
class TwitchApiController {
  constructor(twitchModule, twitchMonitor) {
    this.twitch = twitchModule;
    this.monitor = twitchMonitor;
  }

  /**
   * Get Twitch status
   * @param {Request} req Express request
   * @param {Response} res Express response
   */
  getStatus(req, res) {
    try {
      const config = this.twitch.getConfig();
      const monitorStats = this.monitor ? this.monitor.getStats() : null;
      
      res.json({
        enabled: config.enabled,
        connected: config.enabled && config.twitch.channelName,
        monitoring: monitorStats ? monitorStats.isRunning : false,
        channel: config.twitch.channelName || null,
        lastSync: monitorStats ? monitorStats.lastSubscriptionSync : null
      });
    } catch (error) {
      logger.error(`Error getting Twitch status: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Configure Twitch integration
   * @param {Request} req Express request
   * @param {Response} res Express response
   */
  updateConfig(req, res) {
    try {
      const { enabled, ...config } = req.body;
      
      if (typeof enabled === 'boolean') {
        this.twitch.setEnabled(enabled);
        
        // Start/stop monitor based on enabled state
        if (this.monitor) {
          if (enabled && !this.monitor.isRunning) {
            this.monitor.start();
          } else if (!enabled && this.monitor.isRunning) {
            this.monitor.stop();
          }
        }
      }
      
      if (Object.keys(config).length > 0) {
        this.twitch.initialize(config);
      }
      
      res.json({
        success: true,
        config: this.twitch.getConfig(),
        monitoring: this.monitor ? this.monitor.isRunning : false
      });
    } catch (error) {
      logger.error(`Error updating Twitch config: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Test Twitch connection
   * @param {Request} req Express request
   * @param {Response} res Express response
   */
  async testConnection(req, res) {
    try {
      if (!this.monitor) {
        return res.status(500).json({ 
          success: false, 
          error: 'Twitch monitor not initialized' 
        });
      }
      
      const result = await this.monitor.testTwitchConnection();
      
      res.json({
        success: result.connected,
        ...result
      });
    } catch (error) {
      logger.error(`Error testing Twitch connection: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Force a subscription sync
   * @param {Request} req Express request
   * @param {Response} res Express response
   */
  async syncSubscriptions(req, res) {
    try {
      if (!this.monitor) {
        return res.status(500).json({ 
          success: false, 
          error: 'Twitch monitor not initialized' 
        });
      }
      
      const result = await this.monitor.forceSubscriptionSync();
      
      res.json(result);
    } catch (error) {
      logger.error(`Error syncing subscriptions: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Start monitoring
   * @param {Request} req Express request
   * @param {Response} res Express response
   */
  startMonitoring(req, res) {
    try {
      if (!this.monitor) {
        return res.status(500).json({ 
          success: false, 
          error: 'Twitch monitor not initialized' 
        });
      }
      
      if (!this.twitch.getConfig().enabled) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot start monitoring while Twitch integration is disabled' 
        });
      }
      
      this.monitor.start();
      
      res.json({
        success: true,
        monitoring: true,
        stats: this.monitor.getStats()
      });
    } catch (error) {
      logger.error(`Error starting Twitch monitoring: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  /**
   * Stop monitoring
   * @param {Request} req Express request
   * @param {Response} res Express response
   */
  stopMonitoring(req, res) {
    try {
      if (!this.monitor) {
        return res.status(500).json({ 
          success: false, 
          error: 'Twitch monitor not initialized' 
        });
      }
      
      this.monitor.stop();
      
      res.json({
        success: true,
        monitoring: false,
        stats: this.monitor.getStats()
      });
    } catch (error) {
      logger.error(`Error stopping Twitch monitoring: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  async getTwitchStatus(req, res) {
    try {
      const config = this.twitch.getConfig();
      res.json({
        connected: config.enabled && config.twitch.channelName
      });
    } catch (error) {
      logger.error(`Error getting Twitch status: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  async getStreamlabsStatus(req, res) {
    try {
      const config = this.twitch.getConfig();
      res.json({
        connected: config.enabled && config.streamlabs.socketToken
      });
    } catch (error) {
      logger.error(`Error getting Streamlabs status: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Register API routes
   * @param {Express} app Express application instance
   */
  registerRoutes(app) {

    app.get('/api/twitch/status', this.getTwitchStatus.bind(this));
    app.get('/api/streamlabs/status', this.getStreamlabsStatus.bind(this));
    app.post('/api/twitch/config', this.updateConfig.bind(this));
    app.get('/api/twitch/test-connection', this.testConnection.bind(this));
    app.post('/api/twitch/sync-subscriptions', this.syncSubscriptions.bind(this));
    app.post('/api/twitch/monitoring/start', this.startMonitoring.bind(this));
    app.post('/api/twitch/monitoring/stop', this.stopMonitoring.bind(this));
  }
}

module.exports = TwitchApiController;