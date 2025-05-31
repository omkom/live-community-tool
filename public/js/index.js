// public/js/index.js - Version corrigée avec centrage optimisé
class StreamApp {
  constructor() {
    this.timelineManager = new TimelineManager();
    this.streamClock = new StreamClock();
    this.wsClient = new WebSocketClient();
    
    // Configuration optimisée
    this.UPDATE_INTERVAL = 15000; // 15 secondes
    this.TIMELINE_UPDATE_INTERVAL = 30000; // 30 secondes
    this.STATUS_UPDATE_INTERVAL = 5000; // 5 secondes pour le statut
    
    // Flags d'état
    this.isInitialized = false;
    this.isVisible = true;
    
    this.init();
  }
  
  async init() {
    try {
      console.log('🚀 Initialisation de l\'application Stream 24h...');
      
      await this.initializeComponents();
      this.setupEventHandlers();
      this.setupResponsiveHandlers();
      this.setupMobileOptimizations();
      this.startServices();
      await this.loadInitialData();
      
      this.isInitialized = true;
      console.log('✅ Application Stream 24h initialisée avec succès');
      
      // Debug en développement
      this.setupDebugTools();
      
    } catch (error) {
      console.error('❌ Erreur d\'initialisation:', error);
      this.showError('Erreur d\'initialisation. Rechargez la page.');
    }
  }
  
  async initializeComponents() {
    console.log('⚙️ Initialisation des composants...');
    
    // Initialiser l'horloge du stream
    await this.streamClock.initialize();
    
    // Configurer la hauteur viewport
    this.setViewportHeight();
    
    console.log('✅ Composants initialisés');
  }
  
  setupEventHandlers() {
    console.log('🔗 Configuration des gestionnaires d\'événements...');
    
    // WebSocket Events
    this.wsClient.on('connected', () => {
      console.log('🔌 WebSocket connecté');
      this.showMessage('Connexion établie', 'success', 2000);
    });
    
    this.wsClient.on('disconnected', () => {
      console.log('🔌 WebSocket déconnecté');
      this.showMessage('Connexion perdue', 'error', 3000);
    });
    
    this.wsClient.on('reconnectFailed', () => {
      console.log('🔌 Reconnexion WebSocket échouée');
      this.showError('Impossible de se reconnecter au serveur');
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
      this.isVisible = !document.hidden;
      
      if (this.isVisible) {
        console.log('👁️ Page visible - Actualisation des données');
        this.refreshData();
        // Forcer le centrage après le retour de visibilité
        setTimeout(() => {
          this.timelineManager.centerIndicatorNow(false);
        }, 500);
      } else {
        console.log('👁️ Page cachée');
      }
    });
    
    // Gestionnaires d'erreurs globales
    window.addEventListener('error', (event) => {
      console.error('💥 Erreur JS:', event.error);
      this.showError('Une erreur est survenue');
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('💥 Promesse rejetée:', event.reason);
      event.preventDefault(); // Empêche l'affichage dans la console
    });
    
    console.log('✅ Gestionnaires d\'événements configurés');
  }
  
  setupResponsiveHandlers() {
    console.log('📱 Configuration de la responsivité...');
    
    let resizeTimeout;
    let orientationTimeout;
    
    // Redimensionnement de la fenêtre
    window.addEventListener('resize', () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      
      resizeTimeout = setTimeout(() => {
        console.log('📐 Redimensionnement détecté');
        this.setViewportHeight();
        this.timelineManager.forceRender();
        
        // Re-centrer après le redimensionnement
        setTimeout(() => {
          this.timelineManager.centerIndicatorNow(false);
        }, 200);
      }, 250);
    });
    
    // Changement d'orientation
    window.addEventListener('orientationchange', () => {
      if (orientationTimeout) clearTimeout(orientationTimeout);
      
      orientationTimeout = setTimeout(() => {
        console.log('🔄 Changement d\'orientation détecté');
        this.setViewportHeight();
        this.timelineManager.forceRender();
        
        // Re-centrer après le changement d'orientation
        setTimeout(() => {
          this.timelineManager.centerIndicatorNow(false);
        }, 300);
      }, 150);
    });
    
    // Configuration initiale
    this.setViewportHeight();
    
    console.log('✅ Responsivité configurée');
  }
  
  setupMobileOptimizations() {
    console.log('📱 Configuration des optimisations mobiles...');
    
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
    
    // Optimisation des performances tactiles
    document.addEventListener('touchstart', () => {}, { passive: true });
    
    console.log('✅ Optimisations mobiles configurées');
  }
  
  setViewportHeight() {
    // Calcul de la hauteur viewport réelle pour mobile
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    // Log pour debug
    console.log('📏 Hauteur viewport mise à jour:', window.innerHeight + 'px');
  }
  
  startServices() {
    console.log('🛜 Démarrage des services...');
    
    // Connexion WebSocket
    this.wsClient.connect();
    
    // Démarrage des mises à jour périodiques
    this.startPeriodicUpdates();
    
    console.log('✅ Services démarrés');
  }
  
  startPeriodicUpdates() {
    console.log('⏰ Démarrage des mises à jour périodiques...');
    
    // Mise à jour de l'indicateur de temps chaque seconde
    this.timeUpdateInterval = setInterval(() => {
      if (this.isVisible) {
        this.timelineManager.updateTimeIndicator();
      }
    }, 1000);
    
    // Mise à jour complète de la timeline toutes les 30 secondes
    this.timelineUpdateInterval = setInterval(() => {
      if (this.isVisible) {
        console.log('🔄 Mise à jour périodique de la timeline');
        this.timelineManager.forceRender();
      }
    }, this.TIMELINE_UPDATE_INTERVAL);
    
    // Rechargement des données si pas de WebSocket actif
    this.dataUpdateInterval = setInterval(() => {
      if (this.isVisible && !this.wsClient.isReady()) {
        console.log('🔄 Rechargement des données (WebSocket inactif)');
        this.refreshData();
      }
    }, this.UPDATE_INTERVAL);
    
    // Mise à jour du statut plus fréquente
    this.statusUpdateInterval = setInterval(() => {
      if (this.isVisible) {
        this.timelineManager.checkAndUpdateCurrentItem();
      }
    }, this.STATUS_UPDATE_INTERVAL);
    
    console.log('✅ Mises à jour périodiques démarrées');
  }
  
  pauseUpdates() {
    console.log('⏸️ Pause des mises à jour...');
    
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
    
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }
  
  resumeUpdates() {
    console.log('▶️ Reprise des mises à jour...');
    this.startPeriodicUpdates();
    this.refreshData();
  }
  
  async loadInitialData() {
    console.log('📊 Chargement des données initiales...');
    
    try {
      // Chargement du planning
      await this.timelineManager.loadPlanning();
      console.log('✅ Planning chargé');
      
      // Chargement du statut
      await this.loadStatus();
      console.log('✅ Statut chargé');
      
      // Centrage initial après chargement complet
      setTimeout(() => {
        console.log('🎯 Centrage initial de la timeline');
        this.timelineManager.centerIndicatorNow(false);
      }, 1000);
      
      // Second centrage pour s'assurer de la position
      setTimeout(() => {
        console.log('🎯 Centrage de confirmation');
        this.timelineManager.centerIndicatorNow(true);
      }, 2000);
      
    } catch (error) {
      console.error('❌ Erreur chargement données initiales:', error);
      this.showError('Erreur de chargement des données');
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
      console.error('❌ Erreur chargement statut:', error);
      throw error;
    }
  }
  
  async refreshData() {
    if (!this.isInitialized) return;
    
    try {
      console.log('🔄 Actualisation des données...');
      
      // Charger les données en parallèle
      const [planning, status] = await Promise.allSettled([
        this.timelineManager.loadPlanning(),
        this.loadStatus()
      ]);
      
      if (planning.status === 'rejected') {
        console.error('❌ Erreur refresh planning:', planning.reason);
      }
      
      if (status.status === 'rejected') {
        console.error('❌ Erreur refresh statut:', status.reason);
      }
      
      console.log('✅ Données actualisées');
      
    } catch (error) {
      console.error('❌ Erreur actualisation globale:', error);
    }
  }
  
  // === GESTIONNAIRES WEBSOCKET ===
  
  async handleUpdate(data) {
    try {
      console.log('📡 Mise à jour WebSocket reçue:', data.target);
      
      if (data.target === 'planning') {
        await this.timelineManager.loadPlanning();
        console.log('✅ Planning mis à jour via WebSocket');
        
        // Re-centrer après mise à jour du planning
        setTimeout(() => {
          this.timelineManager.centerIndicatorNow(true);
        }, 500);
        
      } else if (data.target === 'status') {
        await this.loadStatus();
        console.log('✅ Statut mis à jour via WebSocket');
      }
      
    } catch (error) {
      console.error('❌ Erreur mise à jour WebSocket:', error);
    }
  }
  
  handleEffect(data) {
    if (data.value) {
      console.log('✨ Effet reçu:', data.value);
      this.triggerEffect(data.value);
    }
  }
  
  handleMessage(data) {
    if (data.value) {
      console.log('💬 Message reçu:', data.value);
      this.showMessage(data.value, 'info', 4000);
    }
  }
  
  // === EFFETS VISUELS ===
  
  triggerEffect(type) {
    console.log('🎭 Déclenchement effet:', type);
    
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
    
    // Suppression automatique après animation
    setTimeout(() => {
      if (effectBox.parentNode) {
        effectBox.style.opacity = '0';
        effectBox.style.transform = 'translate(-50%, -50%) scale(0.8)';
        setTimeout(() => {
          if (effectBox.parentNode) {
            document.body.removeChild(effectBox);
          }
        }, 500);
      }
    }, 2500);
  }
  
  // === SYSTÈME DE MESSAGES ===
  
  showMessage(text, type = 'info', duration = 4000) {
    console.log(`📢 Message ${type}:`, text);
    
    const messageBox = document.createElement('div');
    messageBox.className = `message-box message-${type}`;
    messageBox.textContent = text;
    
    document.body.appendChild(messageBox);
    
    // Animation de sortie
    setTimeout(() => {
      if (messageBox.parentNode) {
        messageBox.style.opacity = '0';
        messageBox.style.transform = 'translate(-50%, 20px)';
        setTimeout(() => {
          if (messageBox.parentNode) {
            document.body.removeChild(messageBox);
          }
        }, 500);
      }
    }, duration);
  }
  
  showError(message) {
    this.showMessage(message, 'error', 8000);
  }
  
  showSuccess(message) {
    this.showMessage(message, 'success', 3000);
  }
  
  showWarning(message) {
    this.showMessage(message, 'warning', 5000);
  }
  
  // === OUTILS DE DEBUG ===
  
  setupDebugTools() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      window.streamDebug = {
        // Timeline
        centerNow: () => {
          console.log('🔧 DEBUG: Centrage forcé');
          return this.timelineManager.centerIndicatorNow(true);
        },
        forceRender: () => {
          console.log('🔧 DEBUG: Rendu forcé');
          this.timelineManager.forceRender();
        },
        getCurrentItem: () => {
          const item = this.timelineManager.getCurrentItem();
          console.log('🔧 DEBUG: Item actuel:', item);
          return item;
        },
        
        // Application
        refreshData: () => {
          console.log('🔧 DEBUG: Actualisation des données');
          return this.refreshData();
        },
        getStreamTime: () => {
          const time = this.streamClock.getFormattedElapsedTime();
          console.log('🔧 DEBUG: Temps de stream:', time);
          return time;
        },
        
        // WebSocket
        wsStatus: () => {
          const status = this.wsClient.getConnectionState();
          console.log('🔧 DEBUG: État WebSocket:', status);
          return status;
        },
        reconnectWs: () => {
          console.log('🔧 DEBUG: Reconnexion WebSocket');
          this.wsClient.disconnect();
          setTimeout(() => this.wsClient.connect(), 1000);
        },
        
        // Tests
        testEffect: (type = 'tada') => {
          console.log('🔧 DEBUG: Test effet:', type);
          this.triggerEffect(type);
        },
        testMessage: (text = 'Message de test', type = 'info') => {
          console.log('🔧 DEBUG: Test message:', text, type);
          this.showMessage(text, type);
        },
        
        // Timeline Manager
        enableAutoScroll: () => {
          console.log('🔧 DEBUG: Activation centrage auto');
          this.timelineManager.enableAutoScroll();
        },
        disableAutoScroll: () => {
          console.log('🔧 DEBUG: Désactivation centrage auto');
          this.timelineManager.disableAutoScroll();
        }
      };
      
      console.log('🔧 Outils de debug disponibles: window.streamDebug');
      console.log('🔧 Essayez: streamDebug.centerNow(), streamDebug.testEffect(), etc.');
    }
  }
  
  // === MÉTHODES PUBLIQUES ===
  
  getCurrentItem() {
    return this.timelineManager.getCurrentItem();
  }
  
  getStreamTime() {
    return this.streamClock.getFormattedElapsedTime();
  }
  
  isConnected() {
    return this.wsClient.isReady();
  }
  
  getConnectionState() {
    return {
      websocket: this.wsClient.getConnectionState(),
      isVisible: this.isVisible,
      isInitialized: this.isInitialized
    };
  }
  
  // Force le centrage de la timeline
  centerTimeline() {
    return this.timelineManager.centerIndicatorNow(true);
  }
  
  // === NETTOYAGE ===
  
  destroy() {
    console.log('🧹 Nettoyage de l\'application...');
    
    // Arrêter les mises à jour
    this.pauseUpdates();
    
    // Fermer la connexion WebSocket
    this.wsClient.disconnect();
    
    // Arrêter l'horloge
    this.streamClock.stop();
    
    // Nettoyer le timeline manager
    if (this.timelineManager.destroy) {
      this.timelineManager.destroy();
    }
    
    // Nettoyer les outils de debug
    if (window.streamDebug) {
      delete window.streamDebug;
    }
    
    console.log('✅ Application nettoyée');
  }
}

// === POINT D'ENTRÉE ===

let streamApp = null;

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
  console.log('🌟 Démarrage de l\'application Stream 24h');
  streamApp = new StreamApp();
});

// Nettoyage avant fermeture
window.addEventListener('beforeunload', () => {
  if (streamApp) {
    console.log('👋 Fermeture de l\'application');
    streamApp.destroy();
  }
});

// Gestion de la pause/reprise selon la visibilité
document.addEventListener('visibilitychange', () => {
  if (streamApp) {
    if (document.hidden) {
      console.log('💤 Application en pause (page cachée)');
      streamApp.pauseUpdates();
    } else {
      console.log('👁️ Application reprise (page visible)');
      streamApp.resumeUpdates();
      
      // Forcer un centrage après retour de visibilité
      setTimeout(() => {
        streamApp.centerTimeline();
      }, 1000);
    }
  }
});

// Export global pour debugging et intégration
window.streamApp = streamApp;

// Gestion des erreurs non capturées spécifiques à l'application
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('streamApp')) {
    console.error('💥 Erreur critique de l\'application:', event.error);
    
    if (streamApp) {
      streamApp.showError('Une erreur critique est survenue. Rechargement recommandé.');
    }
  }
});

// Performance monitoring en mode debug
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  // Mesure du temps de chargement
  window.addEventListener('load', () => {
    const loadTime = performance.now();
    console.log(`⚡ Application chargée en ${loadTime.toFixed(2)}ms`);
  });
  
  // Monitoring des performances
  let lastFrameTime = performance.now();
  function measureFrameRate() {
    const now = performance.now();
    const deltaTime = now - lastFrameTime;
    lastFrameTime = now;
    
    if (deltaTime > 50) { // Frame rate < 20 FPS
      console.warn(`🐌 Frame lent détecté: ${deltaTime.toFixed(2)}ms`);
    }
    
    requestAnimationFrame(measureFrameRate);
  }
  
  // Démarrer le monitoring après initialisation
  setTimeout(() => {
    requestAnimationFrame(measureFrameRate);
  }, 5000);
}

console.log('📱 Application Stream 24h - Chargement terminé');