// server/twitch-oauth.js - Système OAuth Twitch intégré
const axios = require('axios');
const crypto = require('crypto');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

class TwitchOAuth {
  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID || '';
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
    this.redirectUri = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/twitch/callback';
    
    // Stockage temporaire des tokens (en production, utiliser une base de données)
    this.tokensFile = path.join(__dirname, '..', 'data', 'twitch_tokens.json');
    this.currentTokens = this.loadTokens();
    
    // States OAuth en cours
    this.pendingStates = new Map();
  }

  /**
   * Charger les tokens sauvegardés
   */
  loadTokens() {
    try {
      if (fs.existsSync(this.tokensFile)) {
        const data = fs.readFileSync(this.tokensFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error(`Erreur chargement tokens: ${error.message}`);
    }
    return null;
  }

  /**
   * Sauvegarder les tokens
   */
  saveTokens(tokens) {
    try {
      const dataDir = path.dirname(this.tokensFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(this.tokensFile, JSON.stringify({
        ...tokens,
        saved_at: new Date().toISOString()
      }, null, 2));
      
      this.currentTokens = tokens;
      logger.log('Tokens Twitch sauvegardés');
    } catch (error) {
      logger.error(`Erreur sauvegarde tokens: ${error.message}`);
    }
  }

  /**
   * Générer l'URL d'autorisation Twitch
   */
  generateAuthUrl() {
    const state = crypto.randomBytes(16).toString('hex');
    const scopes = [
      'channel:read:redemptions',
      'channel:manage:redemptions',
      'user:read:email',
      'channel:read:subscriptions'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      state: state
    });

    // Stocker le state temporairement (expire après 10 minutes)
    this.pendingStates.set(state, {
      created: Date.now(),
      expires: Date.now() + 10 * 60 * 1000
    });

    // Nettoyer les anciens states
    this.cleanExpiredStates();

    return {
      url: `https://id.twitch.tv/oauth2/authorize?${params.toString()}`,
      state: state
    };
  }

  /**
   * Échanger le code contre des tokens
   */
  async exchangeCodeForTokens(code, state) {
    try {
      // Vérifier le state
      if (!this.pendingStates.has(state)) {
        throw new Error('State OAuth invalide ou expiré');
      }

      const stateData = this.pendingStates.get(state);
      if (Date.now() > stateData.expires) {
        this.pendingStates.delete(state);
        throw new Error('State OAuth expiré');
      }

      // Échanger le code contre des tokens
      const response = await axios.post('https://id.twitch.tv/oauth2/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri
      });

      const tokens = response.data;
      
      // Valider les tokens et récupérer les infos utilisateur
      const userInfo = await this.validateTokens(tokens);
      
      const tokenData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        expires_at: Date.now() + (tokens.expires_in * 1000),
        scope: tokens.scope,
        user_id: userInfo.user_id,
        login: userInfo.login,
        display_name: userInfo.display_name,
        created_at: new Date().toISOString()
      };

      // Sauvegarder les tokens
      this.saveTokens(tokenData);
      
      // Nettoyer le state utilisé
      this.pendingStates.delete(state);

      logger.log(`Connexion Twitch réussie pour ${userInfo.display_name}`);
      
      return tokenData;

    } catch (error) {
      logger.error(`Erreur échange code OAuth: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valider les tokens et récupérer les infos utilisateur
   */
  async validateTokens(tokens) {
    try {
      const response = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `OAuth ${tokens.access_token}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Validation tokens échouée: ${error.message}`);
    }
  }

  /**
   * Rafraîchir les tokens
   */
  async refreshTokens() {
    try {
      if (!this.currentTokens || !this.currentTokens.refresh_token) {
        throw new Error('Aucun refresh token disponible');
      }

      const response = await axios.post('https://id.twitch.tv/oauth2/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.currentTokens.refresh_token,
        grant_type: 'refresh_token'
      });

      const newTokens = response.data;
      
      const tokenData = {
        ...this.currentTokens,
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || this.currentTokens.refresh_token,
        expires_in: newTokens.expires_in,
        expires_at: Date.now() + (newTokens.expires_in * 1000),
        refreshed_at: new Date().toISOString()
      };

      this.saveTokens(tokenData);
      
      logger.log('Tokens Twitch rafraîchis');
      
      return tokenData;

    } catch (error) {
      logger.error(`Erreur rafraîchissement tokens: ${error.message}`);
      throw error;
    }
  }

  /**
   * Vérifier si les tokens sont valides et les rafraîchir si nécessaire
   */
  async ensureValidTokens() {
    if (!this.currentTokens) {
      return null;
    }

    // Vérifier si le token expire bientôt (dans les 5 minutes)
    const expiresIn = this.currentTokens.expires_at - Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresIn < fiveMinutes) {
      try {
        return await this.refreshTokens();
      } catch (error) {
        logger.error('Impossible de rafraîchir les tokens, reconnexion requise');
        this.clearTokens();
        return null;
      }
    }

    return this.currentTokens;
  }

  /**
   * Effacer les tokens
   */
  clearTokens() {
    try {
      if (fs.existsSync(this.tokensFile)) {
        fs.unlinkSync(this.tokensFile);
      }
      this.currentTokens = null;
      logger.log('Tokens Twitch effacés');
    } catch (error) {
      logger.error(`Erreur effacement tokens: ${error.message}`);
    }
  }

  /**
   * Révoquer les tokens
   */
  async revokeTokens() {
    try {
      if (!this.currentTokens) {
        return;
      }

      await axios.post('https://id.twitch.tv/oauth2/revoke', {
        client_id: this.clientId,
        token: this.currentTokens.access_token
      });

      this.clearTokens();
      logger.log('Tokens Twitch révoqués');

    } catch (error) {
      logger.error(`Erreur révocation tokens: ${error.message}`);
      // Effacer quand même les tokens localement
      this.clearTokens();
    }
  }

  /**
   * Obtenir les tokens actuels
   */
  getCurrentTokens() {
    return this.currentTokens;
  }

  /**
   * Vérifier si l'utilisateur est connecté
   */
  isConnected() {
    return this.currentTokens && this.currentTokens.access_token;
  }

  /**
   * Nettoyer les states expirés
   */
  cleanExpiredStates() {
    const now = Date.now();
    for (const [state, data] of this.pendingStates) {
      if (now > data.expires) {
        this.pendingStates.delete(state);
      }
    }
  }

  /**
   * Obtenir les informations de connexion
   */
  getConnectionInfo() {
    if (!this.currentTokens) {
      return {
        connected: false,
        user: null,
        scopes: []
      };
    }

    return {
      connected: true,
      user: {
        id: this.currentTokens.user_id,
        login: this.currentTokens.login,
        display_name: this.currentTokens.display_name
      },
      scopes: this.currentTokens.scope,
      expires_at: this.currentTokens.expires_at,
      created_at: this.currentTokens.created_at
    };
  }

  /**
   * Configurer les routes Express
   */
  setupRoutes(app) {
    // Route pour initier la connexion
    app.get('/auth/twitch/connect', (req, res) => {
      try {
        const authData = this.generateAuthUrl();
        res.json({
          success: true,
          auth_url: authData.url,
          state: authData.state
        });
      } catch (error) {
        logger.error(`Erreur génération URL auth: ${error.message}`);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Route de callback OAuth
    app.get('/auth/twitch/callback', async (req, res) => {
        try {
            const { code, state, error } = req.query;
        
            if (error) {
                throw new Error(`Erreur OAuth Twitch: ${error}`);
            }
        
            if (!code || !state) {
             throw new Error('Code ou state manquant');
            }
        
            const tokens = await this.exchangeCodeForTokens(code, state);
            
            // NOUVEAU: Déclencher la réinitialisation des services après connexion
            setTimeout(() => {
                if (global.reinitializeServicesAfterOAuth) {
                logger.log('🔄 Déclenchement réinitialisation services post-OAuth...');
                global.reinitializeServicesAfterOAuth();
                }
            }, 1000); // Délai pour s'assurer que les tokens sont bien sauvés
            
            res.redirect('/admin.html?twitch_connected=true');
        
        } catch (error) {
            logger.error(`Erreur callback OAuth: ${error.message}`);
            res.redirect('/admin.html?twitch_error=' + encodeURIComponent(error.message));
        }
    });

    // Route pour vérifier le statut de connexion
    app.get('/auth/twitch/status', async (req, res) => {
      try {
        const tokens = await this.ensureValidTokens();
        const info = this.getConnectionInfo();
        
        res.json({
          success: true,
          ...info,
          tokens_valid: !!tokens
        });
      } catch (error) {
        res.json({
          success: false,
          connected: false,
          error: error.message
        });
      }
    });

    // Route pour déconnecter
    app.post('/auth/twitch/disconnect', async (req, res) => {
      try {
        await this.revokeTokens();
        res.json({
          success: true,
          message: 'Déconnexion Twitch réussie'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Route pour rafraîchir manuellement les tokens
    app.post('/auth/twitch/refresh', async (req, res) => {
      try {
        const tokens = await this.refreshTokens();
        res.json({
          success: true,
          message: 'Tokens rafraîchis',
          expires_at: tokens.expires_at
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }
}

module.exports = TwitchOAuth;