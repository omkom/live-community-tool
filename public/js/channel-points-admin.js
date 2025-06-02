// public/js/channel-points-admin.js
class ChannelPointsAdmin {
    constructor() {
      this.isMonitoring = false;
      this.rewards = [];
      this.currentMappings = {};
      this.updateInterval = null;
      
      this.init();
    }
    
    async init() {
      console.log('🎯 Initialisation de l\'admin Channel Points...');
      
      this.createUI();
      this.setupEventListeners();
      await this.loadStatus();
      await this.loadRewards();
      
      // Mise à jour automatique toutes les 30 secondes
      this.updateInterval = setInterval(() => {
        this.loadStatus();
      }, 30000);
      
      console.log('✅ Admin Channel Points initialisé');
    }
    
    createUI() {
      const container = document.getElementById('channel-points-container');
      if (!container) {
        console.error('Container #channel-points-container introuvable');
        return;
      }
      
      container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <i class="fas fa-gem"></i> Channel Points Twitch
            </div>
            <div class="channel-points-status">
              <span id="cp-status-badge" class="status-badge">Chargement...</span>
              <button class="btn btn-sm" id="cp-toggle-monitoring">
                <i class="fas fa-play"></i> <span>Démarrer</span>
              </button>
            </div>
          </div>
          
          <div class="channel-points-content">
            <!-- Statut -->
            <div class="cp-section">
              <h4><i class="fas fa-info-circle"></i> Statut</h4>
              <div class="cp-stats">
                <div class="cp-stat">
                  <span class="cp-stat-label">Surveillance:</span>
                  <span id="cp-monitoring-status" class="cp-stat-value">Inactif</span>
                </div>
                <div class="cp-stat">
                  <span class="cp-stat-label">Effets configurés:</span>
                  <span id="cp-effects-count" class="cp-stat-value">0</span>
                </div>
                <div class="cp-stat">
                  <span class="cp-stat-label">Événements traités:</span>
                  <span id="cp-events-count" class="cp-stat-value">0</span>
                </div>
              </div>
            </div>
            
            <!-- Configuration des récompenses -->
            <div class="cp-section">
              <h4>
                <i class="fas fa-cog"></i> Configuration des Récompenses
                <button class="btn btn-sm" id="cp-refresh-rewards">
                  <i class="fas fa-sync"></i> Actualiser
                </button>
              </h4>
              <div id="cp-rewards-container" class="cp-rewards">
                <div class="cp-loading">
                  <i class="fas fa-spinner fa-spin"></i> Chargement des récompenses...
                </div>
              </div>
              <div class="cp-actions">
                <button class="btn" id="cp-save-config">
                  <i class="fas fa-save"></i> Sauvegarder Configuration
                </button>
              </div>
            </div>
            
            <!-- Test des effets -->
            <div class="cp-section">
              <h4><i class="fas fa-vial"></i> Test des Effets</h4>
              <div class="cp-test-controls">
                <select id="cp-test-effect" class="cp-select">
                  <option value="perturbation">🌀 Perturbation Visuelle</option>
                  <option value="tada">✨ Tada (Confetti)</option>
                  <option value="flash">⚡ Flash</option>
                  <option value="zoom">🔍 Zoom</option>
                  <option value="shake">📳 Shake</option>
                  <option value="bounce">🏀 Bounce</option>
                  <option value="pulse">💓 Pulse</option>
                </select>
                <input type="text" id="cp-test-user" placeholder="Nom utilisateur" value="TestUser" class="cp-input">
                <input type="text" id="cp-test-reward" placeholder="Nom récompense" value="Test Reward" class="cp-input">
                <button class="btn" id="cp-test-button">
                  <i class="fas fa-play"></i> Tester Effet
                </button>
              </div>
            </div>
            
            <!-- Logs des événements -->
            <div class="cp-section">
              <h4>
                <i class="fas fa-list"></i> Événements Récents
                <button class="btn btn-sm" id="cp-clear-events">
                  <i class="fas fa-trash"></i> Nettoyer
                </button>
              </h4>
              <div id="cp-events-log" class="cp-events-log">
                <div class="cp-no-events">Aucun événement Channel Points récent</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    setupEventListeners() {
      // Toggle monitoring
      document.getElementById('cp-toggle-monitoring').addEventListener('click', () => {
        this.toggleMonitoring();
      });
      
      // Refresh rewards
      document.getElementById('cp-refresh-rewards').addEventListener('click', () => {
        this.loadRewards();
      });
      
      // Save configuration
      document.getElementById('cp-save-config').addEventListener('click', () => {
        this.saveConfiguration();
      });
      
      // Test effect
      document.getElementById('cp-test-button').addEventListener('click', () => {
        this.testEffect();
      });
      
      // Clear events
      document.getElementById('cp-clear-events').addEventListener('click', () => {
        this.clearEvents();
      });
    }
    
    async loadStatus() {
      try {
        const response = await fetch('/api/channel-points/status');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const status = await response.json();
        this.updateStatusDisplay(status);
        
      } catch (error) {
        console.error('Erreur chargement statut Channel Points:', error);
        this.showError('Erreur de chargement du statut');
      }
    }
    
    updateStatusDisplay(status) {
      const badge = document.getElementById('cp-status-badge');
      const monitoringStatus = document.getElementById('cp-monitoring-status');
      const effectsCount = document.getElementById('cp-effects-count');
      const eventsCount = document.getElementById('cp-events-count');
      const toggleBtn = document.getElementById('cp-toggle-monitoring');
      
      this.isMonitoring = status.monitoring;
      
      // Badge de statut
      if (status.enabled && status.monitoring) {
        badge.textContent = 'Actif';
        badge.className = 'status-badge status-enabled';
      } else if (status.enabled) {
        badge.textContent = 'Configuré';
        badge.className = 'status-badge';
      } else {
        badge.textContent = 'Désactivé';
        badge.className = 'status-badge status-disabled';
      }
      
      // Statut de surveillance
      monitoringStatus.textContent = status.monitoring ? 'Actif' : 'Inactif';
      monitoringStatus.className = 'cp-stat-value ' + (status.monitoring ? 'status-enabled' : 'status-disabled');
      
      // Compteurs
      effectsCount.textContent = status.rewardEffectsCount || 0;
      eventsCount.textContent = status.eventSubscriptionsCount || 0;
      
      // Bouton toggle
      const btnIcon = toggleBtn.querySelector('i');
      const btnText = toggleBtn.querySelector('span');
      
      if (status.monitoring) {
        btnIcon.className = 'fas fa-stop';
        btnText.textContent = 'Arrêter';
        toggleBtn.classList.add('btn-danger');
      } else {
        btnIcon.className = 'fas fa-play';
        btnText.textContent = 'Démarrer';
        toggleBtn.classList.remove('btn-danger');
      }
      
      toggleBtn.disabled = !status.enabled;
    }
    
    async loadRewards() {
      try {
        const container = document.getElementById('cp-rewards-container');
        container.innerHTML = '<div class="cp-loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';
        
        const response = await fetch('/api/channel-points/rewards');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        this.rewards = data.rewards || [];
        this.renderRewards();
        
      } catch (error) {
        console.error('Erreur chargement récompenses:', error);
        document.getElementById('cp-rewards-container').innerHTML = 
          '<div class="cp-error">Erreur de chargement des récompenses</div>';
      }
    }
    
    renderRewards() {
      const container = document.getElementById('cp-rewards-container');
      
      if (this.rewards.length === 0) {
        container.innerHTML = `
          <div class="cp-no-rewards">
            <i class="fas fa-gem"></i>
            <p>Aucune récompense Channel Points trouvée</p>
            <small>Créez des récompenses sur votre dashboard Twitch</small>
          </div>
        `;
        return;
      }
      
      const rewardsHtml = this.rewards.map(reward => `
        <div class="cp-reward-item ${!reward.isEnabled ? 'disabled' : ''} ${reward.isPaused ? 'paused' : ''}">
          <div class="cp-reward-header">
            <div class="cp-reward-info">
              <h5 class="cp-reward-title">${this.escapeHtml(reward.title)}</h5>
              <div class="cp-reward-meta">
                <span class="cp-reward-cost">${reward.cost} points</span>
                ${!reward.isEnabled ? '<span class="cp-reward-badge disabled">Désactivée</span>' : ''}
                ${reward.isPaused ? '<span class="cp-reward-badge paused">En pause</span>' : ''}
              </div>
            </div>
          </div>
          
          ${reward.prompt ? `<div class="cp-reward-prompt">${this.escapeHtml(reward.prompt)}</div>` : ''}
          
          <div class="cp-reward-config">
            <label class="cp-reward-label">Effet à déclencher:</label>
            <select class="cp-effect-select" data-reward-id="${reward.id}">
              <option value="">Aucun effet</option>
              <option value="perturbation" ${reward.suggestedEffect === 'perturbation' ? 'selected' : ''}>🌀 Perturbation Visuelle</option>
              <option value="tada" ${reward.suggestedEffect === 'tada' ? 'selected' : ''}>✨ Tada (Confetti)</option>
              <option value="flash" ${reward.suggestedEffect === 'flash' ? 'selected' : ''}>⚡ Flash</option>
              <option value="zoom" ${reward.suggestedEffect === 'zoom' ? 'selected' : ''}>🔍 Zoom</option>
              <option value="shake" ${reward.suggestedEffect === 'shake' ? 'selected' : ''}>📳 Shake</option>
              <option value="bounce" ${reward.suggestedEffect === 'bounce' ? 'selected' : ''}>🏀 Bounce</option>
              <option value="pulse" ${reward.suggestedEffect === 'pulse' ? 'selected' : ''}>💓 Pulse</option>
            </select>
          </div>
        </div>
      `).join('');
      
      container.innerHTML = rewardsHtml;
      
      // Charger la configuration existante
      this.loadCurrentMappings();
    }
    
    loadCurrentMappings() {
      // Récupérer les mappings depuis le localStorage
      const saved = localStorage.getItem('channelPointsEffects');
      if (saved) {
        try {
          this.currentMappings = JSON.parse(saved);
          
          // Appliquer aux selects
          document.querySelectorAll('.cp-effect-select').forEach(select => {
            const rewardId = select.dataset.rewardId;
            const reward = this.rewards.find(r => r.id === rewardId);
            if (reward && this.currentMappings[reward.title.toLowerCase()]) {
              select.value = this.currentMappings[reward.title.toLowerCase()];
            }
          });
        } catch (e) {
          console.warn('Erreur chargement mappings Channel Points:', e);
        }
      }
    }
    
    async saveConfiguration() {
      try {
        const mappings = {};
        
        document.querySelectorAll('.cp-effect-select').forEach(select => {
          const rewardId = select.dataset.rewardId;
          const effect = select.value;
          
          if (effect) {
            const reward = this.rewards.find(r => r.id === rewardId);
            if (reward) {
              mappings[reward.title.toLowerCase()] = effect;
            }
          }
        });
        
        // Sauvegarder localement
        localStorage.setItem('channelPointsEffects', JSON.stringify(mappings));
        this.currentMappings = mappings;
        
        // Envoyer au serveur
        const response = await fetch('/api/channel-points/configure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rewardEffects: mappings })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        
        if (result.success) {
          this.showSuccess(`Configuration sauvegardée: ${result.mappingsCount} effets configurés`);
          await this.loadStatus(); // Rafraîchir le statut
        } else {
          throw new Error(result.error);
        }
        
      } catch (error) {
        console.error('Erreur sauvegarde configuration:', error);
        this.showError(`Erreur de sauvegarde: ${error.message}`);
      }
    }
    
    async toggleMonitoring() {
      try {
        const action = this.isMonitoring ? 'stop' : 'start';
        const response = await fetch(`/api/channel-points/monitoring/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        
        if (result.success) {
          this.showSuccess(result.message);
          await this.loadStatus();
        } else {
          throw new Error(result.error);
        }
        
      } catch (error) {
        console.error('Erreur toggle monitoring:', error);
        this.showError(`Erreur: ${error.message}`);
      }
    }
    
    async testEffect() {
      try {
        const effectType = document.getElementById('cp-test-effect').value;
        const userName = document.getElementById('cp-test-user').value || 'TestUser';
        const rewardTitle = document.getElementById('cp-test-reward').value || 'Test Reward';
        
        const response = await fetch('/api/channel-points/test-effect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectType,
            userName,
            rewardTitle,
            cost: 100
          })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        
        if (result.success) {
          this.showSuccess(`Effet de test "${effectType}" déclenché !`);
          this.addEventToLog({
            type: 'TEST',
            reward: rewardTitle,
            user: userName,
            effect: effectType,
            timestamp: new Date().toISOString()
          });
        } else {
          throw new Error(result.error);
        }
        
      } catch (error) {
        console.error('Erreur test effet:', error);
        this.showError(`Erreur de test: ${error.message}`);
      }
    }
    
    async clearEvents() {
      try {
        const response = await fetch('/api/channel-points/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        
        if (result.success) {
          this.showSuccess('Événements nettoyés');
          document.getElementById('cp-events-log').innerHTML = 
            '<div class="cp-no-events">Aucun événement Channel Points récent</div>';
          await this.loadStatus();
        } else {
          throw new Error(result.error);
        }
        
      } catch (error) {
        console.error('Erreur nettoyage événements:', error);
        this.showError(`Erreur: ${error.message}`);
      }
    }
    
    addEventToLog(event) {
      const logContainer = document.getElementById('cp-events-log');
      
      // Créer l'élément d'événement
      const eventElement = document.createElement('div');
      eventElement.className = `cp-event-item ${event.type.toLowerCase()}`;
      
      const time = new Date(event.timestamp).toLocaleTimeString();
      const typeIcon = event.type === 'TEST' ? '🧪' : '💎';
      
      eventElement.innerHTML = `
        <div class="cp-event-header">
          <span class="cp-event-type">${typeIcon} ${event.type}</span>
          <span class="cp-event-time">${time}</span>
        </div>
        <div class="cp-event-details">
          <strong>${event.user}</strong> → "${event.reward}" 
          ${event.effect ? `<span class="cp-event-effect">(${event.effect})</span>` : ''}
        </div>
      `;
      
      // Remplacer le message "aucun événement" s'il existe
      const noEvents = logContainer.querySelector('.cp-no-events');
      if (noEvents) {
        logContainer.removeChild(noEvents);
      }
      
      // Ajouter en haut de la liste
      logContainer.insertBefore(eventElement, logContainer.firstChild);
      
      // Limiter à 10 événements
      const events = logContainer.querySelectorAll('.cp-event-item');
      if (events.length > 10) {
        logContainer.removeChild(events[events.length - 1]);
      }
      
      // Animation d'apparition
      eventElement.style.opacity = '0';
      eventElement.style.transform = 'translateY(-10px)';
      
      setTimeout(() => {
        eventElement.style.transition = 'all 0.3s ease';
        eventElement.style.opacity = '1';
        eventElement.style.transform = 'translateY(0)';
      }, 50);
    }
    
    // Méthode pour recevoir les événements WebSocket
    handleChannelPointsEvent(data) {
      this.addEventToLog({
        type: 'LIVE',
        reward: data.reward,
        user: data.user,
        effect: data.effect,
        timestamp: data.timestamp
      });
      
      // Rafraîchir le statut
      setTimeout(() => this.loadStatus(), 1000);
    }
    
    // Utilitaires
    escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    showSuccess(message) {
      if (typeof showToast === 'function') {
        showToast(message, 'success');
      } else {
        console.log('✅', message);
      }
    }
    
    showError(message) {
      if (typeof showToast === 'function') {
        showToast(message, 'error');
      } else {
        console.error('❌', message);
      }
    }
    
    destroy() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }
    }
  }
  
  // Initialisation globale
  let channelPointsAdmin = null;
  
  // Export pour usage global
  window.ChannelPointsAdmin = ChannelPointsAdmin;