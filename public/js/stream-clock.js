// public/js/stream-clock.js - Version optimisée pour le centrage
class StreamClock {
    constructor() {
      this.streamStartTime = null;
      this.clockInterval = null;
      this.statusData = null;
      this.isRunning = false;
      this.lastUpdateTime = null;
      
      // Configuration par défaut
      this.DEFAULT_START_HOUR = 10;
      this.DEFAULT_START_MINUTE = 30;
      
      // Callbacks pour les changements d'heure
      this.timeChangeCallbacks = [];
    }
    
    // === INITIALISATION ===
    
    async initialize() {
      try {
        console.log('⏰ Initialisation de l\'horloge du stream...');
        
        await this.loadStatus();
        this.start();
        
        console.log('✅ Horloge du stream initialisée');
        return true;
        
      } catch (error) {
        console.error('❌ Erreur d\'initialisation de l\'horloge:', error);
        
        // Démarrer avec l'heure par défaut
        this.setDefaultStartTime();
        this.start();
        
        console.warn('⚠️ Horloge démarrée avec heure par défaut');
        return false;
      }
    }
    
    async loadStatus() {
      try {
        const response = await fetch('/api/status');
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}`);
        }
        
        this.statusData = await response.json();
        
        if (this.statusData.stream_start_time) {
          this.streamStartTime = new Date(this.statusData.stream_start_time);
          console.log('⏰ Heure de début chargée:', this.streamStartTime.toLocaleString());
        } else {
          this.setDefaultStartTime();
          console.log('⏰ Heure par défaut utilisée:', this.streamStartTime.toLocaleString());
        }
        
      } catch (error) {
        console.error('❌ Erreur chargement statut pour horloge:', error);
        throw error;
      }
    }
    
    setDefaultStartTime() {
      const now = new Date();
      this.streamStartTime = new Date();
      
      // Si on est avant l'heure de début habituelle, on considère que le stream a commencé hier
      if (now.getHours() < this.DEFAULT_START_HOUR || 
          (now.getHours() === this.DEFAULT_START_HOUR && now.getMinutes() < this.DEFAULT_START_MINUTE)) {
        this.streamStartTime.setDate(now.getDate() - 1);
      }
      
      this.streamStartTime.setHours(this.DEFAULT_START_HOUR, this.DEFAULT_START_MINUTE, 0, 0);
      
      console.log('⏰ Heure par défaut définie:', this.streamStartTime.toLocaleString());
    }
    
    // === CONTRÔLE DE L'HORLOGE ===
    
    start() {
      if (this.isRunning) {
        console.warn('⚠️ Horloge déjà en cours d\'exécution');
        return;
      }
      
      console.log('▶️ Démarrage de l\'horloge du stream');
      this.isRunning = true;
      
      // Mise à jour immédiate
      this.updateClock();
      
      // Mise à jour chaque seconde
      this.clockInterval = setInterval(() => {
        this.updateClock();
      }, 1000);
    }
    
    stop() {
      if (!this.isRunning) {
        console.warn('⚠️ Horloge déjà arrêtée');
        return;
      }
      
      console.log('⏸️ Arrêt de l\'horloge du stream');
      
      if (this.clockInterval) {
        clearInterval(this.clockInterval);
        this.clockInterval = null;
      }
      
      this.isRunning = false;
    }
    
    restart() {
      console.log('🔄 Redémarrage de l\'horloge');
      this.stop();
      this.start();
    }
    
    // === MISE À JOUR DE L'HORLOGE ===
    
    updateClock() {
      if (!this.streamStartTime) {
        this.setDefaultStartTime();
      }
      
      const now = new Date();
      const diff = now - this.streamStartTime;
      
      // Éviter les valeurs négatives
      const positiveDiff = Math.max(0, diff);
      
      // Calculer le temps écoulé
      const totalHours = Math.floor(positiveDiff / (1000 * 60 * 60));
      const minutes = Math.floor((positiveDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((positiveDiff % (1000 * 60)) / 1000);
      
      // Limiter l'affichage pour éviter les problèmes d'UI
      const displayHours = Math.min(totalHours, 999);
      
      // Formater l'affichage
      const formattedTime = `${displayHours.toString().padStart(3, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Mettre à jour l'élément DOM
      const streamTimeElement = document.getElementById('stream-time');
      if (streamTimeElement) {
        // Vérifier si le temps a changé pour éviter les mises à jour inutiles
        if (streamTimeElement.textContent !== formattedTime) {
          streamTimeElement.textContent = formattedTime;
          
          // Déclencher les callbacks de changement d'heure
          this.triggerTimeChange();
        }
      }
      
      // Stocker la dernière mise à jour
      this.lastUpdateTime = now;
    }
    
    // === GESTION DES CALLBACKS ===
    
    onTimeChange(callback) {
      if (typeof callback === 'function') {
        this.timeChangeCallbacks.push(callback);
      }
    }
    
    offTimeChange(callback) {
      const index = this.timeChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.timeChangeCallbacks.splice(index, 1);
      }
    }
    
    triggerTimeChange() {
      const timeData = this.getFormattedElapsedTime();
      
      // Exécuter tous les callbacks
      this.timeChangeCallbacks.forEach(callback => {
        try {
          callback(timeData);
        } catch (error) {
          console.error('❌ Erreur dans callback de changement d\'heure:', error);
        }
      });
    }
    
    // === GETTERS ET UTILITAIRES ===
    
    updateStartTime(newStartTime) {
      let startTime;
      
      if (newStartTime instanceof Date) {
        startTime = newStartTime;
      } else if (typeof newStartTime === 'string') {
        startTime = new Date(newStartTime);
      } else {
        console.error('❌ Format d\'heure de début invalide:', newStartTime);
        return false;
      }
      
      // Valider la date
      if (isNaN(startTime.getTime())) {
        console.error('❌ Date invalide:', newStartTime);
        return false;
      }
      
      const oldStartTime = this.streamStartTime;
      this.streamStartTime = startTime;
      
      console.log('⏰ Heure de début mise à jour:', {
        ancienne: oldStartTime ? oldStartTime.toLocaleString() : 'aucune',
        nouvelle: startTime.toLocaleString()
      });
      
      // Forcer une mise à jour immédiate
      this.updateClock();
      
      return true;
    }
    
    getElapsedTime() {
      if (!this.streamStartTime) return 0;
      
      const now = new Date();
      return Math.max(0, now - this.streamStartTime);
    }
    
    getFormattedElapsedTime() {
      const elapsed = this.getElapsedTime();
      
      const totalHours = Math.floor(elapsed / (1000 * 60 * 60));
      const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
      
      // Limiter l'affichage
      const displayHours = Math.min(totalHours, 999);
      
      return {
        hours: displayHours,
        minutes,
        seconds,
        totalMinutes: Math.floor(elapsed / (1000 * 60)),
        totalSeconds: Math.floor(elapsed / 1000),
        formatted: `${displayHours.toString().padStart(3, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        raw: elapsed
      };
    }
    
    getStartTime() {
      return this.streamStartTime;
    }
    
    getCurrentStreamMinutes() {
      const elapsed = this.getElapsedTime();
      const startMinutes = this.DEFAULT_START_HOUR * 60 + this.DEFAULT_START_MINUTE;
      const elapsedMinutes = Math.floor(elapsed / (1000 * 60));
      
      return startMinutes + elapsedMinutes;
    }
    
    isActive() {
      return this.isRunning;
    }
    
    // === MISE À JOUR DES DONNÉES DE STATUT ===
    
    updateStatus(statusData) {
      if (!statusData) {
        console.warn('⚠️ Données de statut nulles reçues');
        return false;
      }
      
      const oldStatusData = this.statusData;
      this.statusData = statusData;
      
      // Vérifier si l'heure de début a changé
      let startTimeChanged = false;
      
      if (statusData.stream_start_time) {
        const newStartTime = new Date(statusData.stream_start_time);
        
        // Comparer avec l'heure actuelle
        if (!this.streamStartTime || newStartTime.getTime() !== this.streamStartTime.getTime()) {
          this.updateStartTime(newStartTime);
          startTimeChanged = true;
        }
      } else if (this.streamStartTime) {
        // Si plus d'heure de début dans les données, utiliser la valeur par défaut
        console.log('⚠️ Heure de début supprimée, utilisation de la valeur par défaut');
        this.setDefaultStartTime();
        startTimeChanged = true;
      }
      
      if (startTimeChanged) {
        console.log('⏰ Heure de début du stream mise à jour via statut');
      }
      
      return true;
    }
    
    async refreshStatus() {
      try {
        await this.loadStatus();
        console.log('✅ Statut de l\'horloge actualisé');
        return true;
        
      } catch (error) {
        console.error('❌ Erreur lors de l\'actualisation du statut de l\'horloge:', error);
        return false;
      }
    }
    
    // === MÉTHODES DE DEBUG ===
    
    getDebugInfo() {
      return {
        isRunning: this.isRunning,
        streamStartTime: this.streamStartTime ? this.streamStartTime.toISOString() : null,
        elapsedTime: this.getFormattedElapsedTime(),
        lastUpdateTime: this.lastUpdateTime ? this.lastUpdateTime.toISOString() : null,
        statusData: this.statusData,
        callbackCount: this.timeChangeCallbacks.length
      };
    }
    
    // Synchroniser avec l'heure du serveur
    async syncWithServer() {
      try {
        console.log('🔄 Synchronisation avec le serveur...');
        
        const startTime = Date.now();
        const response = await fetch('/api/status');
        const endTime = Date.now();
        const networkDelay = (endTime - startTime) / 2;
        
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}`);
        }
        
        const statusData = await response.json();
        this.updateStatus(statusData);
        
        console.log(`✅ Synchronisation terminée (délai réseau: ${networkDelay}ms)`);
        return true;
        
      } catch (error) {
        console.error('❌ Erreur de synchronisation avec le serveur:', error);
        return false;
      }
    }
    
    // === NETTOYAGE ===
    
    destroy() {
      console.log('🧹 Nettoyage de l\'horloge du stream...');
      
      this.stop();
      
      // Nettoyer les callbacks
      this.timeChangeCallbacks = [];
      
      // Réinitialiser les données
      this.statusData = null;
      this.streamStartTime = null;
      this.lastUpdateTime = null;
      
      console.log('✅ Horloge du stream nettoyée');
    }
  }