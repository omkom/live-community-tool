// public/js/twitch-oauth-client.js - Client OAuth Twitch
class TwitchOAuthClient {
    constructor() {
      this.isConnected = false;
      this.userInfo = null;
      this.checkInterval = null;
      
      this.init();
    }
  
    async init() {
      console.log('🎮 Initialisation du client OAuth Twitch...');
      
      this.setupEventListeners();
      await this.checkConnectionStatus();
      
      // Vérifier le statut toutes les 30 secondes
      this.checkInterval = setInterval(() => {
        this.checkConnectionStatus();
      }, 30000);
      
      console.log('✅ Client OAuth Twitch initialisé');
    }
  
    setupEventListeners() {
      // Bouton de connexion
      const connectBtn = document.getElementById('connect-twitch-btn');
      if (connectBtn) {
        connectBtn.addEventListener('click', () => {
          this.connectToTwitch();
        });
      }
  
      // Bouton de déconnexion
      const disconnectBtn = document.getElementById('disconnect-twitch-btn');
      if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => {
          this.disconnectFromTwitch();
        });
      }
  
      // Bouton de rafraîchissement du token
      const refreshBtn = document.getElementById('refresh-twitch-token');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          this.refreshToken();
        });
      }
  
      // Bouton de test de connexion
      const testBtn = document.getElementById('test-twitch-connection');
      if (testBtn) {
        testBtn.addEventListener('click', () => {
          this.testConnection();
        });
      }
    }
  
    async checkConnectionStatus() {
      try {
        const response = await fetch('/auth/twitch/status');
        const status = await response.json();
        
        this.isConnected = status.connected;
        this.userInfo = status.user;
        
        this.updateUI(status);
        
      } catch (error) {
        console.error('Erreur vérification statut Twitch:', error);
        this.updateConnectionBadge('error', 'Erreur de connexion');
      }
    }
  
    updateUI(status) {
      const disconnectedState = document.getElementById('twitch-disconnected-state');
      const connectedState = document.getElementById('twitch-connected-state');
      
      if (status.connected) {
        // Afficher l'état connecté
        disconnectedState.style.display = 'none';
        connectedState.style.display = 'block';
        
        // Mettre à jour les informations utilisateur
        this.updateUserInfo(status);
        this.updateConnectionBadge('connected', 'Connecté');
        
      } else {
        // Afficher l'état déconnecté
        disconnectedState.style.display = 'block';
        connectedState.style.display = 'none';
        
        this.updateConnectionBadge('disconnected', 'Non connecté');
      }
    }
  
    updateUserInfo(status) {
      // Nom d'affichage
      const displayNameEl = document.getElementById('twitch-display-name');
      if (displayNameEl && status.user) {
        displayNameEl.textContent = status.user.display_name;
      }
  
      // Nom d'utilisateur
      const usernameEl = document.getElementById('twitch-username');
      if (usernameEl && status.user) {
        usernameEl.textContent = `@${status.user.login}`;
      }
  
      // Date de connexion
      const connectedSinceEl = document.getElementById('twitch-connected-since');
      if (connectedSinceEl && status.created_at) {
        const date = new Date(status.created_at);
        connectedSinceEl.textContent = this.formatRelativeTime(date);
      }
  
      // Expiration du token
      const tokenExpiresEl = document.getElementById('twitch-token-expires');
      if (tokenExpiresEl && status.expires_at) {
        const date = new Date(status.expires_at);
        tokenExpiresEl.textContent = this.formatRelativeTime(date, true);
      }
  
      // Nombre de permissions
      const permissionsCountEl = document.getElementById('twitch-permissions-count');
      if (permissionsCountEl && status.scopes) {
        const scopesArray = Array.isArray(status.scopes) ? status.scopes : status.scopes.split(' ');
        permissionsCountEl.textContent = `${scopesArray.length} permissions`;
      }
    }
  
    updateConnectionBadge(status, text) {
      const badge = document.getElementById('twitch-connection-status');
      if (!badge) return;
  
      badge.className = `status-badge ${status}`;
      
      const icons = {
        connected: '<i class="fas fa-check-circle"></i>',
        disconnected: '<i class="fas fa-times-circle"></i>',
        loading: '<i class="fas fa-spinner fa-spin"></i>',
        error: '<i class="fas fa-exclamation-triangle"></i>'
      };
  
      badge.innerHTML = `${icons[status] || ''} ${text}`;
    }
  
    async connectToTwitch() {
      try {
        this.updateConnectionBadge('loading', 'Connexion...');
        
        const response = await fetch('/auth/twitch/connect');
        const data = await response.json();
        
        if (data.success) {
          // Ouvrir la fenêtre d'autorisation Twitch
          const popup = window.open(
            data.auth_url,
            'twitch-auth',
            'width=500,height=700,scrollbars=yes,resizable=yes'
          );
          
          // Surveiller la fermeture de la popup
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed);
              // Vérifier le statut après fermeture de la popup
              setTimeout(() => {
                this.checkConnectionStatus();
              }, 1000);
            }
          }, 1000);
          
          this.showSuccess('Fenêtre d\'autorisation Twitch ouverte');
          
        } else {
          throw new Error(data.error || 'Erreur lors de la génération de l\'URL d\'autorisation');
        }
        
      } catch (error) {
        console.error('Erreur connexion Twitch:', error);
        this.showError(`Erreur de connexion: ${error.message}`);
        this.updateConnectionBadge('error', 'Erreur');
      }
    }
  
    async disconnectFromTwitch() {
      try {
        const confirm = window.confirm('Êtes-vous sûr de vouloir vous déconnecter de Twitch ?');
        if (!confirm) return;
  
        this.updateConnectionBadge('loading', 'Déconnexion...');
        
        const response = await fetch('/auth/twitch/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.showSuccess('Déconnexion Twitch réussie');
          await this.checkConnectionStatus();
        } else {
          throw new Error(data.error);
        }
        
      } catch (error) {
        console.error('Erreur déconnexion Twitch:', error);
        this.showError(`Erreur de déconnexion: ${error.message}`);
      }
    }
  
    async refreshToken() {
      try {
        this.updateConnectionBadge('loading', 'Rafraîchissement...');
        
        const response = await fetch('/auth/twitch/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
          this.showSuccess('Token Twitch rafraîchi');
          await this.checkConnectionStatus();
        } else {
          throw new Error(data.error);
        }
        
      } catch (error) {
        console.error('Erreur rafraîchissement token:', error);
        this.showError(`Erreur de rafraîchissement: ${error.message}`);
        this.updateConnectionBadge('error', 'Erreur');
      }
    }
  
    async testConnection() {
      try {
        const resultsContainer = document.getElementById('twitch-test-results');
        const output = document.getElementById('twitch-test-output');
        
        if (!resultsContainer || !output) return;
  
        // Afficher le conteneur de résultats
        resultsContainer.classList.remove('hidden');
        output.textContent = 'Test de connexion en cours...';
        output.className = '';
        
        const response = await fetch('/auth/twitch/status');
        const status = await response.json();
        
        if (status.connected) {
          const testResults = {
            status: 'Connexion active',
            user: status.user?.display_name || 'Inconnu',
            user_id: status.user?.id || 'Inconnu',
            permissions: Array.isArray(status.scopes) ? 
              status.scopes : status.scopes?.split(' ') || [],
            token_valid: status.tokens_valid,
            expires_at: status.expires_at ? 
              new Date(status.expires_at).toLocaleString() : 'Inconnu'
          };
          
          output.textContent = JSON.stringify(testResults, null, 2);
          output.className = 'success';
          
          this.showSuccess('Test de connexion réussi');
          
        } else {
          output.textContent = JSON.stringify({
            status: 'Non connecté',
            error: status.error || 'Aucune connexion active'
          }, null, 2);
          output.className = 'error';
          
          this.showError('Test de connexion échoué');
        }
        
      } catch (error) {
        console.error('Erreur test connexion:', error);
        
        const output = document.getElementById('twitch-test-output');
        if (output) {
          output.textContent = `Erreur: ${error.message}`;
          output.className = 'error';
        }
        
        this.showError(`Erreur de test: ${error.message}`);
      }
    }
  
    formatRelativeTime(date, future = false) {
      const now = new Date();
      const diff = future ? date - now : now - date;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
  
      if (future && diff < 0) {
        return 'Expiré';
      }
  
      if (days > 0) {
        return `${days} jour${days > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        return `${hours} heure${hours > 1 ? 's' : ''}`;
      } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else {
        return future ? 'Bientôt' : 'À l\'instant';
      }
    }
  
    // Méthodes utilitaires pour les notifications
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
  
    showInfo(message) {
      if (typeof showToast === 'function') {
        showToast(message, 'info');
      } else {
        console.info('ℹ️', message);
      }
    }
  
    // Getters publics
    getConnectionStatus() {
      return {
        connected: this.isConnected,
        user: this.userInfo
      };
    }
  
    isUserConnected() {
      return this.isConnected;
    }
  
    getUserInfo() {
      return this.userInfo;
    }
  
    // Nettoyage
    destroy() {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }
  }
  
  // Export pour utilisation globale
  window.TwitchOAuthClient = TwitchOAuthClient;