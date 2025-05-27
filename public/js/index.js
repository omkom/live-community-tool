// public/js/index.js - Version simplifiée avec centrage forcé permanent
class StreamApp {
  constructor() {
    this.timelineManager = new TimelineManager();
    this.streamClock = new StreamClock();
    this.wsClient = new WebSocketClient();
    
    // Configuration simplifiée
    this.UPDATE_INTERVAL = 15000; // 15 secondes
    this.TIMELINE_UPDATE_INTERVAL = 30000; // 30 secondes
    
    this.init();
  }
  
  async init() {
    try {
      await this.initializeComponents();
      this.setupEventHandlers();
      this.startServices();
      await this.loadInitialData();
      
      console.log('✅ Application Stream 24h initialisée');
    } catch (error) {
      console.error('❌ Erreur d\'initialisation:', error);
      this.showError('Erreur d\'initialisation. Rechargez la page.');
    }
  }
  
  async initializeComponents() {
    await this.streamClock.initialize();
    this.setupResponsiveHandlers();
    this.setupMobileOptimizations();
    
    // Debug en développement
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      window.streamDebug = {
        centerNow: () => this.timelineManager.centerIndicatorNow(),
        forceRender: () => this.timelineManager.forceRender(),
        getCurrentItem: () => this.timelineManager.getCurrentItem()
      };
      console.log('🔧 Debug: window.streamDebug disponible');
    }
  }
  
  setupEventHandlers() {
    // WebSocket
    this.wsClient.on('connected', () => {
      console.log('🔌 WebSocket connecté');
    });
    
    this.wsClient.on('update', (data) => {
      this.handleUpdate(data);
    });
    
    this.wsClient.on('effect', (data) => {
      this.handleEffect(data);
    });
    
    this.wsClient.on('message', (data) => {
      this.handleMessage(data);
    });
    
    // Visibilité de la page
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.refreshData();
        setTimeout(() => {
          this.timelineManager.centerIndicatorNow();
        }, 500);
      }
    });
    
    // Gestionnaires d'erreurs
    window.addEventListener('error', (event) => {
      console.error('Erreur JS:', event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Promesse rejetée:', event.reason);
    });
  }
  
  setupResponsiveHandlers() {
    let resizeTimeout;
    
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.timelineManager.forceRender();
        setTimeout(() => {
          this.timelineManager.centerIndicatorNow();
        }, 100);
      }, 250);
    });
    
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.setViewportHeight();
        this.timelineManager.forceRender();
        setTimeout(() => {
          this.timelineManager.centerIndicatorNow();
        }, 200);
      }, 100);
    });
    
    this.setViewportHeight();
  }
  
  setupMobileOptimizations() {
    // Empêcher le scroll sur le body (sauf timeline)
    document.addEventListener('touchmove', (e) => {
      if (!e.target.closest('.timeline')) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // Empêcher le zoom sur double tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
  }
  
  setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  
  startServices() {
    this.wsClient.connect();
    this.startPeriodicUpdates();
  }
  
  startPeriodicUpdates() {
    // Mise à jour de l'indicateur de temps toutes les secondes
    this.timeUpdateInterval = setInterval(() => {
      this.timelineManager.updateTimeIndicator();
    }, 1000);
    
    // Mise à jour complète de la timeline toutes les 30 secondes
    this.timelineUpdateInterval = setInterval(() => {
      this.timelineManager.forceRender();
    }, this.TIMELINE_UPDATE_INTERVAL);
    
    // Rechargement des données si pas de WebSocket
    this.dataUpdateInterval = setInterval(() => {
      if (!this.wsClient.isReady()) {
        this.refreshData();
      }
    }, this.UPDATE_INTERVAL);
    
    // Centrage forcé toutes les 10 secondes pour garantir la position
    this.centerInterval = setInterval(() => {
      this.timelineManager.centerIndicatorNow();
    }, 10000);
  }
  
  pauseUpdates() {
    clearInterval(this.timeUpdateInterval);
    clearInterval(this.timelineUpdateInterval);
    clearInterval(this.dataUpdateInterval);
    clearInterval(this.centerInterval);
  }
  
  resumeUpdates() {
    this.startPeriodicUpdates();
    this.refreshData();
  }
  
  async loadInitialData() {
    try {
      await this.timelineManager.loadPlanning();
      await this.loadStatus();
      
      // Centrage initial après chargement
      setTimeout(() => {
        this.timelineManager.centerIndicatorNow();
      }, 1000);
      
    } catch (error) {
      console.error('Erreur chargement données:', error);
      throw error;
    }
  }
  
  async loadStatus() {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
      
      const statusData = await response.json();
      this.streamClock.updateStatus(statusData);
      
      return statusData;
    } catch (error) {
      console.error('Erreur chargement statut:', error);
      throw error;
    }
  }
  
  async refreshData() {
    try {
      await this.timelineManager.loadPlanning();
      await this.loadStatus();
    } catch (error) {
      console.error('Erreur rafraîchissement:', error);
    }
  }
  
  // Gestionnaires WebSocket
  async handleUpdate(data) {
    try {
      if (data.target === 'planning') {
        await this.timelineManager.loadPlanning();
      } else if (data.target === 'status') {
        await this.loadStatus();
      }
    } catch (error) {
      console.error('Erreur mise à jour:', error);
    }
  }
  
  handleEffect(data) {
    if (data.value) {
      this.triggerEffect(data.value);
    }
  }
  
  handleMessage(data) {
    if (data.value) {
      this.showMessage(data.value);
    }
  }
  
  // Effets visuels
  triggerEffect(type) {
    const effectBox = document.createElement('div');
    effectBox.className = `effect-box effect-${type}`;
    
    const content = document.createElement('div');
    content.className = 'effect-content';
    
    const effects = {
      'tada': '<i class="fas fa-star"></i> TADA <i class="fas fa-star"></i>',
      'flash': '<i class="fas fa-bolt"></i> FLASH',
      'zoom': '<i class="fas fa-search-plus"></i> ZOOM',
      'shake': '<i class="fas fa-dizzy"></i> SHAKE',
      'bounce': '<i class="fas fa-basketball-ball"></i> BOUNCE',
      'pulse': '<i class="fas fa-heartbeat"></i> PULSE'
    };
    
    content.innerHTML = effects[type] || `<i class="fas fa-magic"></i> ${type.toUpperCase()}`;
    effectBox.appendChild(content);
    document.body.appendChild(effectBox);
    
    setTimeout(() => {
      effectBox.style.opacity = '0';
      effectBox.style.transform = 'translate(-50%, -50%) scale(0.8)';
      setTimeout(() => {
        if (effectBox.parentNode) {
          document.body.removeChild(effectBox);
        }
      }, 500);
    }, 2500);
  }
  
  // Messages système
  showMessage(text, type = 'info', duration = 5000) {
    const messageBox = document.createElement('div');
    messageBox.className = `message-box message-${type}`;
    messageBox.textContent = text;
    
    document.body.appendChild(messageBox);
    
    setTimeout(() => {
      messageBox.style.opacity = '0';
      messageBox.style.transform = 'translate(-50%, 20px)';
      setTimeout(() => {
        if (messageBox.parentNode) {
          document.body.removeChild(messageBox);
        }
      }, 500);
    }, duration);
  }
  
  showError(message) {
    this.showMessage(message, 'error', 8000);
  }
  
  showSuccess(message) {
    this.showMessage(message, 'success', 3000);
  }
  
  // Méthodes utilitaires
  getCurrentItem() {
    return this.timelineManager.getCurrentItem();
  }
  
  getStreamTime() {
    return this.streamClock.getFormattedElapsedTime();
  }
  
  isConnected() {
    return this.wsClient.isReady();
  }
  
  // Nettoyage
  destroy() {
    this.pauseUpdates();
    this.wsClient.disconnect();
    this.streamClock.stop();
  }
}

// Point d'entrée simplifié
let streamApp = null;

document.addEventListener('DOMContentLoaded', () => {
  streamApp = new StreamApp();
});

window.addEventListener('beforeunload', () => {
  if (streamApp) {
    streamApp.destroy();
  }
});

// Export pour debugging
window.streamApp = streamApp;