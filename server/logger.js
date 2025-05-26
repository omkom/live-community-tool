// server/logger.js
const fs = require('fs');
const path = require('path');

// Configuration
const MAX_LOGS = 100; // Nombre maximum de logs à conserver
const LOG_FILE = path.join(__dirname, '..', 'data', 'logs.json');

// Initialisation
let logs = [];

// Charger les logs existants
try {
  if (fs.existsSync(LOG_FILE)) {
    logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  }
} catch (error) {
  console.error('Erreur lors du chargement des logs:', error);
}

/**
 * Ajoute un log standard
 * @param {string} message Message du log
 */
function log(message) {
  addLogEntry('INFO', message);
}

/**
 * Ajoute un log d'erreur
 * @param {string} message Message d'erreur
 */
function error(message) {
  addLogEntry('ERROR', message);
}

/**
 * Ajoute un log d'activité utilisateur
 * @param {string} action Action effectuée
 * @param {Object} details Détails supplémentaires
 */
function activity(action, details) {
  addLogEntry('ACTION', `${action}: ${JSON.stringify(details)}`);
}

/**
 * Enregistre une entrée de log
 * @param {string} type Type de log (INFO, ERROR, ACTION)
 * @param {string} message Message du log
 */
function addLogEntry(type, message) {
  const timestamp = new Date().toISOString();
  const entry = { type, timestamp, message };
  
  // Ajouter au début pour avoir les plus récents en premier
  logs.unshift(entry);
  
  // Limiter le nombre de logs
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(0, MAX_LOGS);
  }
  
  // Log dans la console
  const colors = {
    INFO: '\x1b[32m',    // Vert
    ERROR: '\x1b[31m',   // Rouge
    ACTION: '\x1b[36m',  // Cyan
    RESET: '\x1b[0m'     // Reset
  };
  
  console.log(`${colors[type]}[${type}] ${timestamp}: ${message}${colors.RESET}`);
  
  // Sauvegarder dans le fichier (de façon asynchrone)
  saveLogsToFile();
}

/**
 * Sauvegarde les logs dans le fichier
 */
function saveLogsToFile() {
  // Utilisation d'un timeout pour éviter trop d'écritures disque
  if (this.saveTimeout) {
    clearTimeout(this.saveTimeout);
  }
  
  this.saveTimeout = setTimeout(() => {
    try {
      // Créer le dossier data s'il n'existe pas
      const dataDir = path.dirname(LOG_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    } catch (err) {
      console.error('Erreur lors de la sauvegarde des logs:', err);
    }
  }, 1000);
}

/**
 * Récupère tous les logs
 * @returns {Array} Liste des logs
 */
function getLogs() {
  return logs;
}

module.exports = {
  log,
  error,
  activity,
  getLogs
};