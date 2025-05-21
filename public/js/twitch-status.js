// public/js/twitch-status.js
// Twitch status monitoring and management for admin panel

/**
 * Twitch Status Manager
 */
class TwitchStatusManager {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        console.error(`Container element with ID '${containerId}' not found`);
        return;
      }
      
      this.statusData = null;
      this.updateInterval = null;
      this.isVisible = false;
      
      // Initialize the UI
      this.initUI();
      
      // Load initial status
      this.loadTwitchStatus();
      
      // Set up auto-refresh every 30 seconds when visible
      this.updateInterval = setInterval(() => {
        if (this.isVisible) {
          this.loadTwitchStatus();
        }
      }, 30000);
    }
    
    /**
     * Initialize the user interface
     */
    initUI() {
      // Create the UI structure
      this.container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <i class="fas fa-broadcast-tower"></i> Twitch Connection
            </div>
            <button class="btn btn-sm" id="twitch-refresh-btn">
              <i class="fas fa-sync"></i> Refresh
            </button>
          </div>
          
          <div class="twitch-status-content">
            <div class="status-indicators">
              <div class="status-item">
                <span class="status-label">Integration:</span>
                <span class="status-value" id="twitch-integration-status">Unknown</span>
              </div>
              <div class="status-item">
                <span class="status-label">Connection:</span>
                <span class="status-value" id="twitch-connection-status">Unknown</span>
              </div>
              <div class="status-item">
                <span class="status-label">Channel:</span>
                <span class="status-value" id="twitch-channel">Not set</span>
              </div>
              <div class="status-item">
                <span class="status-label">Monitoring:</span>
                <span class="status-value" id="twitch-monitoring-status">Inactive</span>
              </div>
              <div class="status-item">
                <span class="status-label">Last Sync:</span>
                <span class="status-value" id="twitch-last-sync">Never</span>
              </div>
            </div>
            
            <div class="twitch-actions">
              <button class="btn" id="twitch-test-btn">
                <i class="fas fa-vial"></i> Test Connection
              </button>
              <button class="btn" id="twitch-sync-btn">
                <i class="fas fa-sync-alt"></i> Sync Subscriptions
              </button>
              <button class="btn" id="twitch-monitor-toggle-btn">
                <i class="fas fa-play"></i> Start Monitoring
              </button>
            </div>
            
            <div id="twitch-test-results" class="twitch-results hidden">
              <h4>Connection Test Results</h4>
              <pre id="twitch-test-output"></pre>
            </div>
          </div>
        </div>
      `;
      
      // Set up event listeners
      this.container.querySelector('#twitch-refresh-btn').addEventListener('click', () => {
        this.loadTwitchStatus();
      });
      
      this.container.querySelector('#twitch-test-btn').addEventListener('click', () => {
        this.testTwitchConnection();
      });
      
      this.container.querySelector('#twitch-sync-btn').addEventListener('click', () => {
        this.syncSubscriptions();
      });
      
      this.container.querySelector('#twitch-monitor-toggle-btn').addEventListener('click', () => {
        this.toggleMonitoring();
      });
    }
    
    /**
     * Load Twitch status from the API
     */
    loadTwitchStatus() {
      fetch('/api/twitch/status')
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          this.statusData = data;
          this.updateStatusDisplay();
        })
        .catch(error => {
          console.error('Error loading Twitch status:', error);
          this.showStatusError('Failed to load status');
        });
    }
    
    /**
     * Update the status display based on loaded data
     */
    updateStatusDisplay() {
      if (!this.statusData) return;
      
      // Update integration status
      const integrationStatus = this.container.querySelector('#twitch-integration-status');
      integrationStatus.textContent = this.statusData.enabled ? 'Enabled' : 'Disabled';
      integrationStatus.className = 'status-value ' + (this.statusData.enabled ? 'status-enabled' : 'status-disabled');
      
      // Update connection status
      const connectionStatus = this.container.querySelector('#twitch-connection-status');
      connectionStatus.textContent = this.statusData.connected ? 'Connected' : 'Disconnected';
      connectionStatus.className = 'status-value ' + (this.statusData.connected ? 'status-enabled' : 'status-disabled');
      
      // Update channel name
      const channelElement = this.container.querySelector('#twitch-channel');
      channelElement.textContent = this.statusData.channel || 'Not set';
      
      // Update monitoring status
      const monitoringStatus = this.container.querySelector('#twitch-monitoring-status');
      monitoringStatus.textContent = this.statusData.monitoring ? 'Active' : 'Inactive';
      monitoringStatus.className = 'status-value ' + (this.statusData.monitoring ? 'status-enabled' : 'status-disabled');
      
      // Update last sync time
      const lastSyncElement = this.container.querySelector('#twitch-last-sync');
      if (this.statusData.lastSync) {
        const lastSync = new Date(this.statusData.lastSync);
        const now = new Date();
        const diffMinutes = Math.round((now - lastSync) / (1000 * 60));
        
        if (diffMinutes < 1) {
          lastSyncElement.textContent = 'Just now';
        } else if (diffMinutes === 1) {
          lastSyncElement.textContent = '1 minute ago';
        } else if (diffMinutes < 60) {
          lastSyncElement.textContent = `${diffMinutes} minutes ago`;
        } else {
          const hours = Math.floor(diffMinutes / 60);
          lastSyncElement.textContent = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
      } else {
        lastSyncElement.textContent = 'Never';
      }
      
      // Update monitoring button text
      const monitorToggleBtn = this.container.querySelector('#twitch-monitor-toggle-btn');
      if (this.statusData.monitoring) {
        monitorToggleBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Monitoring';
      } else {
        monitorToggleBtn.innerHTML = '<i class="fas fa-play"></i> Start Monitoring';
      }
      
      // Enable/disable buttons based on status
      const testBtn = this.container.querySelector('#twitch-test-btn');
      const syncBtn = this.container.querySelector('#twitch-sync-btn');
      
      testBtn.disabled = !this.statusData.enabled;
      syncBtn.disabled = !this.statusData.enabled || !this.statusData.connected;
      monitorToggleBtn.disabled = !this.statusData.enabled;
    }
    
    /**
     * Test the Twitch connection
     */
    testTwitchConnection() {
      const resultsContainer = this.container.querySelector('#twitch-test-results');
      const output = this.container.querySelector('#twitch-test-output');
      
      // Show the results container with a loading message
      resultsContainer.classList.remove('hidden');
      output.textContent = 'Testing connection...';
      
      fetch('/api/twitch/test-connection')
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            output.textContent = JSON.stringify({
              status: 'Connected',
              channel: data.displayName,
              channelId: data.channelId
            }, null, 2);
            output.className = 'success';
          } else {
            output.textContent = JSON.stringify({
              status: 'Connection Failed',
              error: data.error
            }, null, 2);
            output.className = 'error';
          }
          
          // Refresh the status after testing
          this.loadTwitchStatus();
        })
        .catch(error => {
          output.textContent = `Error: ${error.message}`;
          output.className = 'error';
        });
    }
    
    /**
     * Sync Twitch subscriptions
     */
    syncSubscriptions() {
      const resultsContainer = this.container.querySelector('#twitch-test-results');
      const output = this.container.querySelector('#twitch-test-output');
      
      // Show the results container with a loading message
      resultsContainer.classList.remove('hidden');
      output.textContent = 'Syncing subscriptions...';
      
      fetch('/api/twitch/sync-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            output.textContent = JSON.stringify({
              status: 'Sync Complete',
              subscribers: data.count
            }, null, 2);
            output.className = 'success';
            
            // Show toast notification
            if (typeof showToast === 'function') {
              showToast(`Synced ${data.count} Twitch subscribers`, 'success');
            }
          } else {
            output.textContent = JSON.stringify({
              status: 'Sync Failed',
              error: data.error
            }, null, 2);
            output.className = 'error';
            
            // Show toast notification
            if (typeof showToast === 'function') {
              showToast(`Failed to sync subscribers: ${data.error}`, 'error');
            }
          }
          
          // Refresh the status after syncing
          this.loadTwitchStatus();
        })
        .catch(error => {
          output.textContent = `Error: ${error.message}`;
          output.className = 'error';
          
          // Show toast notification
          if (typeof showToast === 'function') {
            showToast(`Error syncing subscribers: ${error.message}`, 'error');
          }
        });
    }
    
    /**
     * Toggle the Twitch monitoring
     */
    toggleMonitoring() {
      if (!this.statusData) return;
      
      const action = this.statusData.monitoring ? 'stop' : 'start';
      const resultsContainer = this.container.querySelector('#twitch-test-results');
      const output = this.container.querySelector('#twitch-test-output');
      
      // Show the results container with a loading message
      resultsContainer.classList.remove('hidden');
      output.textContent = `${action === 'start' ? 'Starting' : 'Stopping'} monitoring...`;
      
      fetch(`/api/twitch/monitoring/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            output.textContent = JSON.stringify({
              status: `Monitoring ${action === 'start' ? 'Started' : 'Stopped'}`,
              monitoring: data.monitoring
            }, null, 2);
            output.className = 'success';
            
            // Show toast notification
            if (typeof showToast === 'function') {
              showToast(`Twitch monitoring ${action === 'start' ? 'started' : 'stopped'}`, 'success');
            }
          } else {
            output.textContent = JSON.stringify({
              status: `Failed to ${action} monitoring`,
              error: data.error
            }, null, 2);
            output.className = 'error';
            
            // Show toast notification
            if (typeof showToast === 'function') {
              showToast(`Failed to ${action} monitoring: ${data.error}`, 'error');
            }
          }
          
          // Refresh the status after toggling monitoring
          this.loadTwitchStatus();
        })
        .catch(error => {
          output.textContent = `Error: ${error.message}`;
          output.className = 'error';
          
          // Show toast notification
          if (typeof showToast === 'function') {
            showToast(`Error ${action}ing monitoring: ${error.message}`, 'error');
          }
        });
    }
    
    /**
     * Show a status error message
     * @param {string} message Error message to display
     */
    showStatusError(message) {
      const resultsContainer = this.container.querySelector('#twitch-test-results');
      const output = this.container.querySelector('#twitch-test-output');
      
      resultsContainer.classList.remove('hidden');
      output.textContent = `Error: ${message}`;
      output.className = 'error';
    }
    
    /**
     * Set visibility state
     * @param {boolean} visible Whether the panel is visible
     */
    setVisible(visible) {
      this.isVisible = visible;
      
      // Refresh status when becoming visible
      if (visible) {
        this.loadTwitchStatus();
      }
    }
    
    /**
     * Clean up resources
     */
    destroy() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    }
  }
  
  // Expose to global scope
  window.TwitchStatusManager = TwitchStatusManager;