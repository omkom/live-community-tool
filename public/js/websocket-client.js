// public/js/websocket-client.js - Client WebSocket optimisé
class WebSocketClient {
    constructor() {
      this.ws = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 3000;
      this.heartbeatInterval = null;
      this.eventHandlers = new Map();
      
      // Auto-bind methods
      this.handleOpen = this.handleOpen.bind(this);
      this.handleClose = this.handleClose.bind(this);
      this.handleError = this.handleError.bind(this);
      this.handleMessage = this.handleMessage.bind(this);
    }
    
    // Initialiser la connexion WebSocket
    connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}?type=viewer`;
      
      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.onopen = this.handleOpen;
        this.ws.onclose = this.handleClose;
        this.ws.onerror = this.handleError;
        this.ws.onmessage = this.handleMessage;
      } catch (error) {
        console.error('Erreur de création WebSocket:', error);
        this.scheduleReconnect();
      }
    }
    
    // Gérer l'ouverture de la connexion
    handleOpen() {
      console.log('Connexion WebSocket établie');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.updateConnectionStatus('connected');
      this.startHeartbeat();
      this.emit('connected');
    }
    
    // Gérer la fermeture de la connexion
    handleClose(event) {
      console.log('Connexion WebSocket fermée:', event.code, event.reason);
      this.isConnected = false;
      this.updateConnectionStatus('disconnected');
      this.stopHeartbeat();
      this.emit('disconnected', { code: event.code, reason: event.reason });
      
      // Tentative de reconnexion si pas fermé intentionnellement
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    }
    
    // Gérer les erreurs
    handleError(error) {
      console.error('Erreur WebSocket:', error);
      this.updateConnectionStatus('error');
      this.emit('error', error);
    }
    
    // Gérer les messages reçus
    handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        console.log('Message WebSocket reçu:', data);
        
        // Émettre l'événement correspondant
        if (data.type) {
          this.emit(data.type, data);
          this.emit('message', data);
        }
      } catch (error) {
        console.error('Erreur de parsing WebSocket:', error, event.data);
      }
    }
    
    // Programmer une reconnexion
    scheduleReconnect() {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Nombre maximum de tentatives de reconnexion atteint');
        this.updateConnectionStatus('failed');
        this.emit('reconnectFailed');
        return;
      }
      
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      
      console.log(`Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${delay}ms`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, delay);
    }
    
    // Démarrer le heartbeat pour maintenir la connexion
    startHeartbeat() {
      this.heartbeatInterval = setInterval(() => {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
          this.send({ type: 'ping' });
        }
      }, 30000); // Ping toutes les 30 secondes
    }
    
    // Arrêter le heartbeat
    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    }
    
    // Envoyer un message
    send(data) {
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(data));
          return true;
        } catch (error) {
          console.error('Erreur d\'envoi WebSocket:', error);
          return false;
        }
      }
      return false;
    }
    
    // Fermer la connexion
    disconnect() {
      this.stopHeartbeat();
      if (this.ws) {
        this.ws.close(1000, 'Déconnexion intentionnelle');
        this.ws = null;
      }
      this.isConnected = false;
    }
    
    // Mettre à jour l'indicateur de statut de connexion
    updateConnectionStatus(status) {
      const statusIndicator = document.getElementById('connection-status');
      if (!statusIndicator) return;
      
      statusIndicator.className = `connection-status ${status}`;
      
      const titles = {
        'connected': 'Connecté au serveur',
        'disconnected': 'Déconnecté du serveur',
        'error': 'Erreur de connexion',
        'failed': 'Connexion échouée'
      };
      
      statusIndicator.title = titles[status] || 'Statut inconnu';
    }
    
    // Ajouter un gestionnaire d'événement
    on(event, handler) {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, []);
      }
      this.eventHandlers.get(event).push(handler);
    }
    
    // Supprimer un gestionnaire d'événement
    off(event, handler) {
      if (this.eventHandlers.has(event)) {
        const handlers = this.eventHandlers.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }
    
    // Émettre un événement
    emit(event, data = null) {
      if (this.eventHandlers.has(event)) {
        this.eventHandlers.get(event).forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            console.error(`Erreur dans le gestionnaire d'événement ${event}:`, error);
          }
        });
      }
    }
    
    // Obtenir l'état de la connexion
    getConnectionState() {
      return {
        isConnected: this.isConnected,
        readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED,
        reconnectAttempts: this.reconnectAttempts,
        maxReconnectAttempts: this.maxReconnectAttempts
      };
    }
    
    // Vérifier si la connexion est prête
    isReady() {
      return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }
  }