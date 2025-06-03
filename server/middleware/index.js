// server/middleware/index.js - Middlewares centralisés
const logger = require('../logger');

class MiddlewareManager {
  constructor(config) {
    this.config = config;
  }

  // Rate limiting basique
  rateLimiter() {
    const attempts = new Map();
    const windowMs = this.config.get('security.rateLimitWindow');
    const maxAttempts = this.config.get('security.rateLimitMax');

    return (req, res, next) => {
      const key = req.ip;
      const now = Date.now();
      
      const userAttempts = attempts.get(key) || { count: 0, resetTime: now + windowMs };
      
      if (now > userAttempts.resetTime) {
        userAttempts.count = 0;
        userAttempts.resetTime = now + windowMs;
      }
      
      userAttempts.count++;
      attempts.set(key, userAttempts);
      
      if (userAttempts.count > maxAttempts) {
        logger.log(`Rate limit dépassé pour ${key}`);
        return res.status(429).json({ 
          error: 'Trop de requêtes',
          retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000)
        });
      }
      
      next();
    };
  }

  // Logging des requêtes
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const method = req.method;
        const url = req.originalUrl;
        const status = res.statusCode;
        const ip = req.ip;
        
        if (this.config.isDevelopment() || status >= 400) {
          logger.log(`${method} ${url} - ${status} (${duration}ms) [${ip}]`);
        }
      });
      
      next();
    };
  }

  // Validation admin (si mot de passe défini)
  adminAuth() {
    const adminPassword = this.config.get('security.adminPassword');
    
    if (!adminPassword) {
      return (req, res, next) => next(); // Pas de protection
    }

    return (req, res, next) => {
      if (req.path === '/admin.html' || req.path.startsWith('/api/admin/')) {
        const auth = req.headers.authorization;
        
        if (!auth || auth !== `Bearer ${adminPassword}`) {
          return res.status(401).json({ error: 'Authentification requise' });
        }
      }
      
      next();
    };
  }

  // Validation JSON
  validateJSON() {
    return (req, res, next) => {
      if (req.method === 'POST' && req.is('application/json')) {
        if (!req.body || Object.keys(req.body).length === 0) {
          return res.status(400).json({ error: 'Corps JSON requis' });
        }
      }
      next();
    };
  }

  // Headers de sécurité
  securityHeaders() {
    return (req, res, next) => {
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('X-Frame-Options', 'DENY');
      res.header('X-XSS-Protection', '1; mode=block');
      res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      if (this.config.get('server.env') === 'production') {
        res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
      
      next();
    };
  }

  // CORS configuré
  cors() {
    return (req, res, next) => {
      const origin = req.headers.origin;
      const allowedOrigins = [this.config.getServerUrl()];
      
      if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      
      next();
    };
  }

  // Middleware de maintenance
  maintenance() {
    const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
    
    return (req, res, next) => {
      if (maintenanceMode && !req.path.startsWith('/api/health')) {
        return res.status(503).json({
          error: 'Service en maintenance',
          message: 'Le service est temporairement indisponible pour maintenance.',
          retryAfter: 300
        });
      }
      
      next();
    };
  }

  // Middleware d'erreur async
  asyncErrorHandler() {
    return (fn) => (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Gestion des erreurs
  errorHandler() {
    return (error, req, res, next) => {
      logger.error(`Erreur ${req.method} ${req.path}: ${error.message}`);
      
      // Erreurs de validation
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Données invalides',
          details: error.message
        });
      }
      
      // Erreurs de parsing JSON
      if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({
          error: 'JSON invalide'
        });
      }
      
      // Erreur par défaut
      const status = error.statusCode || 500;
      const message = this.config.isDevelopment() ? error.message : 'Erreur serveur interne';
      
      res.status(status).json({
        error: message,
        ...(this.config.isDevelopment() && { stack: error.stack })
      });
    };
  }

  // Applique tous les middlewares de base
  applyBasicMiddleware(app) {
    app.use(this.requestLogger());
    app.use(this.securityHeaders());
    app.use(this.cors());
    app.use(this.maintenance());
    app.use(this.validateJSON());
    
    if (this.config.get('security.rateLimitMax')) {
      app.use('/api', this.rateLimiter());
    }
    
    if (this.config.get('security.adminPassword')) {
      app.use(this.adminAuth());
    }
  }

  // Applique le gestionnaire d'erreurs (à la fin)
  applyErrorHandling(app) {
    app.use(this.errorHandler());
  }
}

module.exports = MiddlewareManager;