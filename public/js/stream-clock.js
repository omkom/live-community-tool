// public/js/stream-clock.js - Gestion de l'horloge du stream
class StreamClock {
    constructor() {
      this.streamStartTime = null;
      this.clockInterval = null;
      this.statusData = null;
      this.isRunning = false;
    }
    
    // Initialiser l'horloge avec les données de statut
    async initialize() {
      try {
        await this.loadStatus();
        this.start();
        return true;
      } catch (error) {
        console.error('Erreur d\'initialisation de l\'horloge:', error);
        // Démarrer avec l'heure par défaut (minuit du jour actuel)
        this.setDefaultStartTime();
        this.start();
        return false;
      }
    }
    
    // Charger les données de statut pour obtenir l'heure de début
    async loadStatus() {
      const response = await fetch('/api/status');
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      
      this.statusData = await response.json();
      
      if (this.statusData.stream_start_time) {
        this.streamStartTime = new Date(this.statusData.stream_start_time);
      } else {
        this.setDefaultStartTime();
      }
    }
    
    // Définir l'heure de début par défaut (hier à 10h30)
    setDefaultStartTime() {
      const now = new Date();
      this.streamStartTime = new Date();
      
      // Si on est avant 10h30, on considère que le stream a commencé hier à 10h30
      if (now.getHours() < 10 || (now.getHours() === 10 && now.getMinutes() < 30)) {
        this.streamStartTime.setDate(now.getDate() - 1);
      }
      
      this.streamStartTime.setHours(10, 30, 0, 0);
    }
    
    // Démarrer l'horloge
    start() {
      if (this.isRunning) return;
      
      this.isRunning = true;
      this.updateClock();
      this.clockInterval = setInterval(() => this.updateClock(), 1000);
    }
    
    // Arrêter l'horloge
    stop() {
      if (this.clockInterval) {
        clearInterval(this.clockInterval);
        this.clockInterval = null;
      }
      this.isRunning = false;
    }
    
    // Mettre à jour l'affichage de l'horloge
    updateClock() {
      if (!this.streamStartTime) {
        this.setDefaultStartTime();
      }
      
      const now = new Date();
      const diff = now - this.streamStartTime;
      
      // Éviter les valeurs négatives
      const positiveDiff = Math.max(0, diff);
      
      // Calculer heures, minutes, secondes écoulées
      const totalHours = Math.floor(positiveDiff / (1000 * 60 * 60));
      const minutes = Math.floor((positiveDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((positiveDiff % (1000 * 60)) / 1000);
      
      // Limiter à 999:59:59 pour éviter l'overflow d'affichage
      const displayHours = Math.min(totalHours, 999);
      
      // Formater l'affichage
      const formattedTime = `${displayHours.toString().padStart(3, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      const streamTimeElement = document.getElementById('stream-time');
      if (streamTimeElement) {
        streamTimeElement.textContent = formattedTime;
      }
    }
    
    // Mettre à jour l'heure de début du stream
    updateStartTime(newStartTime) {
      if (newStartTime instanceof Date) {
        this.streamStartTime = newStartTime;
      } else if (typeof newStartTime === 'string') {
        this.streamStartTime = new Date(newStartTime);
      }
      
      // Forcer une mise à jour immédiate
      this.updateClock();
    }
    
    // Obtenir le temps écoulé en millisecondes
    getElapsedTime() {
      if (!this.streamStartTime) return 0;
      const now = new Date();
      return Math.max(0, now - this.streamStartTime);
    }
    
    // Obtenir le temps écoulé formaté
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
        formatted: `${displayHours.toString().padStart(3, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      };
    }
    
    // Obtenir l'heure de début du stream
    getStartTime() {
      return this.streamStartTime;
    }
    
    // Vérifier si l'horloge fonctionne
    isActive() {
      return this.isRunning;
    }
    
    // Mettre à jour les données de statut (appelé par le WebSocket)
    updateStatus(statusData) {
      this.statusData = statusData;
      
      // Mettre à jour l'heure de début si elle a changé
      if (statusData.stream_start_time) {
        const newStartTime = new Date(statusData.stream_start_time);
        if (!this.streamStartTime || newStartTime.getTime() !== this.streamStartTime.getTime()) {
          this.updateStartTime(newStartTime);
        }
      }
    }
    
    // Recharger les données de statut
    async refreshStatus() {
      try {
        await this.loadStatus();
      } catch (error) {
        console.error('Erreur lors du rechargement du statut:', error);
      }
    }
  }