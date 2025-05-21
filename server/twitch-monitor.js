// server/twitch-monitor.js
const logger = require('./logger');
const axios = require('axios');

/**
 * Monitors the Twitch connection and updates subscription information
 */
class TwitchMonitor {
  constructor(twitchModule) {
    this.twitch = twitchModule;
    this.isRunning = false;
    this.checkInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 30000; // 30 seconds initial delay
    this.checkIntervalTime = 5 * 60 * 1000; // 5 minutes
    this.lastSubscriptionSync = null;
    this.subscriptionSyncInterval = 15 * 60 * 1000; // 15 minutes
    this.eventListeners = new Map();
  }

  /**
   * Start monitoring the Twitch connection
   */
  start() {
    if (this.isRunning) return;

    logger.log('Starting Twitch connection monitor');
    this.isRunning = true;
    
    // Initial connection check
    this.checkConnection();
    
    // Set up regular check interval
    this.checkInterval = setInterval(() => {
      this.checkConnection();
    }, this.checkIntervalTime);
    
    // Emit started event
    this.emit('monitor:started');
  }

  /**
   * Stop monitoring the Twitch connection
   */
  stop() {
    if (!this.isRunning) return;
    
    logger.log('Stopping Twitch connection monitor');
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Emit stopped event
    this.emit('monitor:stopped');
  }

  /**
   * Check the Twitch connection status
   */
  async checkConnection() {
    try {
      const config = this.twitch.getConfig();
      
      // Skip if integration is disabled
      if (!config.enabled) {
        logger.log('Twitch integration is disabled, skipping connection check');
        return;
      }
      
      // Check if credentials are configured
      if (!config.twitch.clientId || !config.twitch.oauthToken || !config.twitch.channelName) {
        logger.error('Twitch credentials not fully configured');
        this.emit('connection:unconfigured');
        return;
      }
      
      // Test connection
      const connectionStatus = await this.testTwitchConnection();
      
      if (connectionStatus.connected) {
        logger.log('Twitch connection is healthy');
        this.reconnectAttempts = 0; // Reset reconnect attempts
        this.emit('connection:healthy', connectionStatus);
        
        // Check if it's time to sync subscription data
        await this.checkSubscriptionSync();
      } else {
        logger.error(`Twitch connection issue: ${connectionStatus.error}`);
        this.emit('connection:error', connectionStatus);
        
        // Attempt reconnection
        this.handleConnectionError();
      }
    } catch (error) {
      logger.error(`Error checking Twitch connection: ${error.message}`);
      this.emit('monitor:error', { error: error.message });
      
      // Attempt reconnection on exception
      this.handleConnectionError();
    }
  }

  /**
   * Test the Twitch API connection
   * @returns {Promise<Object>} Connection status object
   */
  async testTwitchConnection() {
    try {
      const config = this.twitch.getConfig();
      
      // Try to get channel info as a basic connection test
      const response = await axios.get(`https://api.twitch.tv/helix/users?login=${config.twitch.channelName}`, {
        headers: {
          'Client-ID': config.twitch.clientId,
          'Authorization': `Bearer ${config.twitch.oauthToken}`
        }
      });
      
      if (response.status === 200 && response.data && response.data.data.length > 0) {
        return {
          connected: true,
          channelId: response.data.data[0].id,
          displayName: response.data.data[0].display_name
        };
      } else {
        return {
          connected: false,
          error: 'Channel not found or invalid response'
        };
      }
    } catch (error) {
      let errorMessage = 'Unknown error';
      
      if (error.response) {
        // HTTP error response from Twitch API
        if (error.response.status === 401) {
          errorMessage = 'Authentication error (invalid or expired token)';
        } else if (error.response.status === 403) {
          errorMessage = 'Authorization error (insufficient scope or permissions)';
        } else {
          errorMessage = `HTTP error ${error.response.status}: ${error.response.statusText}`;
        }
      } else if (error.request) {
        // Request made but no response received
        errorMessage = 'Network error (no response received)';
      } else {
        // Request setup error
        errorMessage = error.message;
      }
      
      return {
        connected: false,
        error: errorMessage
      };
    }
  }

  /**
   * Handle Twitch connection errors and attempt reconnection
   */
  async handleConnectionError() {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      // Calculate exponential backoff delay (30s, 60s, 120s, 240s, 480s)
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      logger.log(`Scheduling Twitch reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay/1000}s`);
      
      setTimeout(async () => {
        logger.log(`Attempting Twitch reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        try {
          // Re-initialize Twitch integration
          const success = await this.twitch.initialize();
          
          if (success) {
            logger.log('Twitch reconnection successful');
            this.emit('connection:reconnected');
            this.reconnectAttempts = 0;
          } else {
            logger.error('Twitch reconnection failed');
            this.emit('connection:reconnect_failed');
          }
        } catch (error) {
          logger.error(`Twitch reconnection error: ${error.message}`);
          this.emit('connection:reconnect_error', { error: error.message });
        }
      }, delay);
      
      this.emit('connection:reconnect_scheduled', { 
        attempt: this.reconnectAttempts, 
        maxAttempts: this.maxReconnectAttempts,
        delay: delay
      });
    } else {
      logger.error(`Maximum Twitch reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('connection:reconnect_max_attempts');
    }
  }

  /**
   * Check if it's time to sync subscription data and do so if needed
   */
  async checkSubscriptionSync() {
    const now = Date.now();
    
    // Skip if we've synced recently
    if (this.lastSubscriptionSync && now - this.lastSubscriptionSync < this.subscriptionSyncInterval) {
      return;
    }
    
    // Sync subscription data
    await this.syncSubscriptionData();
    
    // Update last sync time
    this.lastSubscriptionSync = now;
  }

  /**
   * Sync subscription data from Twitch API
   */
  async syncSubscriptionData() {
    try {
      logger.log('Syncing Twitch subscription data');
      
      const config = this.twitch.getConfig();
      
      // Get channel ID
      const userResponse = await axios.get(`https://api.twitch.tv/helix/users?login=${config.twitch.channelName}`, {
        headers: {
          'Client-ID': config.twitch.clientId,
          'Authorization': `Bearer ${config.twitch.oauthToken}`
        }
      });
      
      if (!userResponse.data || !userResponse.data.data || userResponse.data.data.length === 0) {
        throw new Error('Channel not found');
      }
      
      const channelId = userResponse.data.data[0].id;
      
      // Get subscription counts
      const subsResponse = await axios.get(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${channelId}`, {
        headers: {
          'Client-ID': config.twitch.clientId,
          'Authorization': `Bearer ${config.twitch.oauthToken}`
        }
      });
      
      if (!subsResponse.data) {
        throw new Error('Failed to retrieve subscription data');
      }
      
      const subsData = subsResponse.data;
      
      // Update subscription counts
      const totalSubs = subsData.total;
      
      logger.log(`Retrieved ${totalSubs} subscriptions from Twitch API`);
      
      // Update subscription stats in the system
      await this.twitch.updateSubscriptionStats(totalSubs, true);
      
      // Emit subscription sync event
      this.emit('subscriptions:synced', { 
        count: totalSubs,
        points: subsData.points,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        count: totalSubs
      };
    } catch (error) {
      logger.error(`Error syncing subscription data: ${error.message}`);
      
      this.emit('subscriptions:sync_error', { 
        error: error.message 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Force a manual sync of subscription data
   */
  async forceSubscriptionSync() {
    const result = await this.syncSubscriptionData();
    this.lastSubscriptionSync = Date.now();
    return result;
  }

  /**
   * Add an event listener
   * @param {string} event Event name
   * @param {Function} callback Callback function
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Emit an event
   * @param {string} event Event name
   * @param {any} data Event data
   */
  emit(event, data = {}) {
    if (this.eventListeners.has(event)) {
      for (const callback of this.eventListeners.get(event)) {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in ${event} event listener: ${error.message}`);
        }
      }
    }
    
    // Also emit a 'all' event for any listeners that want all events
    if (event !== 'all' && this.eventListeners.has('all')) {
      for (const callback of this.eventListeners.get('all')) {
        try {
          callback({ event, data });
        } catch (error) {
          logger.error(`Error in 'all' event listener: ${error.message}`);
        }
      }
    }
  }

  /**
   * Get statistics about the monitor
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      reconnectAttempts: this.reconnectAttempts,
      lastSubscriptionSync: this.lastSubscriptionSync,
      checkIntervalTime: this.checkIntervalTime,
      subscriptionSyncInterval: this.subscriptionSyncInterval
    };
  }
}

module.exports = TwitchMonitor;