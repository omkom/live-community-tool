// public/js/index.js - Script principal optimisé
class StreamApp {
  constructor() {
    this.timelineManager = new TimelineManager();
    this.streamClock = new StreamClock();
    this.wsClient = new WebSocketClient();
    this.updateInterval = null;
    
    // Configuration
    this.UPDATE_INTERVAL = 15000; // Mise à jour périodique toutes les 15 secondes
    this.TIMELINE_UPDATE_INTERVAL = 30000; // Mise à jour timeline toutes les 30 secondes
    
    this.init();
  }
  
  async init() {
    try {
      // Initialiser les composants
      await this.initializeComponents();
      
      // Configurer les gestionnaires d'événements
      this.setupEventHandlers();
      
      // Démarrer les services
      this.startServices();
      
      // Charger les données initiales
      await this.loadInitialData();
      
      console.log('Application Stream 24h initialisée avec succès');
    } catch (error) {
      console.error('Erreur d\'initialisation de l\'application:', error);
      this.showError('Erreur d\'initialisation. Rechargez la page.');
    }
  }
  
  async initializeComponents() {
    // Initialiser l'horloge du stream
    await this.streamClock.initialize();
    
    // Gérer le redimensionnement
    this.setupResponsiveHandlers();
    
    // Empêcher le zoom et le scroll indésirable sur mobile
    this.setupMobileOptimizations();
  }
  
  setupEventHandlers() {
    // Gestionnaires WebSocket
    this.wsClient.on('connected', () => {
      console.log('WebSocket connecté');
    });
    
    this.wsClient.on('disconnected', () => {
      console.log('WebSocket déconnecté');
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
    
    // Gestionnaire de visibilité de la page
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseUpdates();
      } else {
        this.resumeUpdates();
      }
    });
    
    // Gestionnaire d'erreurs globales
    window.addEventListener('error', (event) => {
      console.error('Erreur JavaScript:', event.error);
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
      }, 250);
    });
    
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.setViewportHeight();
        this.timelineManager.forceRender();
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
    // Démarrer la connexion WebSocket
    this.wsClient.connect();
    
    // Démarrer les mises à jour périodiques
    this.startPeriodicUpdates();
  }
  
  startPeriodicUpdates() {
    // Mise à jour de l'indicateur de temps et du statut toutes les secondes
    this.timeUpdateInterval = setInterval(() => {
      this.timelineManager.updateTimeIndicator();
    }, 1000);
    
    // Mise à jour complète de la timeline toutes les 30 secondes
    this.timelineUpdateInterval = setInterval(() => {
      this.timelineManager.forceRender();
    }, this.TIMELINE_UPDATE_INTERVAL);
    
    // Rechargement des données toutes les 15 secondes (si pas de WebSocket)
    this.dataUpdateInterval = setInterval(() => {
      if (!this.wsClient.isReady()) {
        this.refreshData();
      }
    }, this.UPDATE_INTERVAL);
  }
  
  pauseUpdates() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
    if (this.timelineUpdateInterval) {
      clearInterval(this.timelineUpdateInterval);
      this.timelineUpdateInterval = null;
    }
    if (this.dataUpdateInterval) {
      clearInterval(this.dataUpdateInterval);
      this.dataUpdateInterval = null;
    }
  }
  
  resumeUpdates() {
    if (!this.timeUpdateInterval) {
      this.startPeriodicUpdates();
    }
    // Forcer une mise à jour immédiate
    this.refreshData();
  }
  
  async loadInitialData() {
    try {
      // Charger le planning
      await this.timelineManager.loadPlanning();
      
      // Charger le statut
      await this.loadStatus();
      
    } catch (error) {
      console.error('Erreur de chargement des données initiales:', error);
      throw error;
    }
  }
  
  async loadStatus() {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      
      const statusData = await response.json();
      
      // Mettre à jour l'horloge du stream
      this.streamClock.updateStatus(statusData);
      
      return statusData;
    } catch (error) {
      console.error('Erreur lors du chargement du statut:', error);
      throw error;
    }
  }
  
  async refreshData() {
    try {
      // Recharger le planning
      await this.timelineManager.loadPlanning();
      
      // Recharger le statut
      await this.loadStatus();
      
    } catch (error) {
      console.error('Erreur de rafraîchissement des données:', error);
    }
  }
  
  // Gestionnaires d'événements WebSocket
  async handleUpdate(data) {
    try {
      if (data.target === 'planning') {
        await this.timelineManager.loadPlanning();
      } else if (data.target === 'status') {
        await this.loadStatus();
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
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
    
    // Animation de sortie
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
  
  // Nettoyage lors de la fermeture
  destroy() {
    this.pauseUpdates();
    this.wsClient.disconnect();
    this.streamClock.stop();
  }
}

// Point d'entrée de l'application
let streamApp = null;

document.addEventListener('DOMContentLoaded', () => {
  streamApp = new StreamApp();
});

// Nettoyage lors de la fermeture de la page
window.addEventListener('beforeunload', () => {
  if (streamApp) {
    streamApp.destroy();
  }
});

// Export pour debugging
window.streamApp = streamApp;