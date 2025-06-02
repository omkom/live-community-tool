#!/usr/bin/env node
// scripts/test-oauth.js - Test de configuration OAuth Twitch

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function title(message) {
  log(`\n🔍 ${message}`, 'cyan');
  log('='.repeat(message.length + 4), 'cyan');
}

async function testOAuth() {
  console.clear();
  title('TEST OAUTH TWITCH - STREAM 24H');
  
  let hasErrors = false;
  let hasWarnings = false;

  try {
    // 1. Test des variables d'environnement
    title('1. Variables d\'environnement');
    
    const requiredVars = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'];
    const config = {};
    
    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value) {
        error(`Variable ${varName} manquante`);
        hasErrors = true;
      } else if (value.includes('votre_') || value.length < 10) {
        error(`Variable ${varName} non configurée correctement`);
        hasErrors = true;
      } else {
        success(`Variable ${varName} configurée`);
        config[varName] = value;
      }
    }

    // Variables optionnelles
    const optionalVars = ['PORT', 'TWITCH_REDIRECT_URI'];
    for (const varName of optionalVars) {
      const value = process.env[varName];
      if (value) {
        success(`Variable ${varName}: ${value}`);
        config[varName] = value;
      } else {
        info(`Variable ${varName} utilise la valeur par défaut`);
      }
    }

    if (hasErrors) {
      error('Configuration .env invalide - Arrêt du test');
      process.exit(1);
    }

    // 2. Test de l'URL de redirection
    title('2. URL de redirection');
    
    const redirectUri = config.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/twitch/callback';
    if (redirectUri.includes('localhost')) {
      success(`URL de redirection: ${redirectUri}`);
    } else {
      warning('URL de redirection non-localhost - Assurez-vous qu\'elle est accessible');
      hasWarnings = true;
    }

    // 3. Test de connexion à l'API Twitch
    title('3. Test API Twitch (sans authentification)');
    
    try {
      // Test basique avec l'API Twitch (endpoint public)
      const response = await axios.get('https://api.twitch.tv/helix/games/top?first=1', {
        headers: {
          'Client-ID': config.TWITCH_CLIENT_ID
        },
        timeout: 10000
      });

      if (response.status === 200) {
        success('API Twitch accessible');
        success(`Client ID valide: ${config.TWITCH_CLIENT_ID.substring(0, 8)}...`);
      } else {
        error(`API Twitch: Statut ${response.status}`);
        hasErrors = true;
      }

    } catch (apiError) {
      if (apiError.response?.status === 401) {
        error('Client ID invalide ou expiré');
        hasErrors = true;
      } else if (apiError.code === 'ENOTFOUND') {
        error('Impossible de joindre l\'API Twitch - Vérifiez votre connexion internet');
        hasErrors = true;
      } else {
        error(`Erreur API Twitch: ${apiError.message}`);
        hasErrors = true;
      }
    }

    // 4. Test de génération d'URL OAuth
    title('4. Génération URL OAuth');
    
    try {
      const scopes = [
        'channel:read:redemptions',
        'channel:manage:redemptions', 
        'user:read:email'
      ];
      
      const state = 'test-state-123';
      const params = new URLSearchParams({
        client_id: config.TWITCH_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        state: state
      });

      const authUrl = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
      
      success('URL OAuth générée avec succès');
      info(`Scopes: ${scopes.join(', ')}`);
      info(`URL: ${authUrl.substring(0, 80)}...`);
      
    } catch (urlError) {
      error(`Erreur génération URL OAuth: ${urlError.message}`);
      hasErrors = true;
    }

    // 5. Test des fichiers de données
    title('5. Fichiers de données');
    
    const dataFiles = [
      { path: 'data/stream24h.json', required: false },
      { path: 'data/status.json', required: false },
      { path: 'data/twitch_tokens.json', required: false }
    ];

    for (const file of dataFiles) {
      const fullPath = path.join(process.cwd(), file.path);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          JSON.parse(content);
          success(`Fichier valide: ${file.path}`);
        } catch (parseError) {
          error(`Fichier corrompu: ${file.path}`);
          hasErrors = true;
        }
      } else if (file.required) {
        error(`Fichier manquant: ${file.path}`);
        hasErrors = true;
      } else {
        info(`Fichier optionnel absent: ${file.path}`);
      }
    }

    // 6. Test de structure des dossiers
    title('6. Structure des dossiers');
    
    const requiredDirs = ['data', 'public', 'server'];
    const optionalDirs = ['public/css', 'public/js', 'public/overlay'];
    
    for (const dir of requiredDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        success(`Dossier présent: ${dir}`);
      } else {
        error(`Dossier manquant: ${dir}`);
        hasErrors = true;
      }
    }

    for (const dir of optionalDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        success(`Dossier optionnel présent: ${dir}`);
      } else {
        info(`Dossier optionnel absent: ${dir}`);
      }
    }

    // 7. Test de la configuration serveur
    title('7. Configuration serveur');
    
    const port = config.PORT || 3000;
    info(`Port configuré: ${port}`);
    
    // Vérifier que le port n'est pas utilisé (test basique)
    try {
      const { createServer } = require('http');
      const testServer = createServer();
      
      await new Promise((resolve, reject) => {
        testServer.listen(port, (err) => {
          if (err) {
            if (err.code === 'EADDRINUSE') {
              warning(`Port ${port} déjà utilisé`);
              hasWarnings = true;
            } else {
              reject(err);
            }
          } else {
            success(`Port ${port} disponible`);
          }
          testServer.close();
          resolve();
        });
      });
      
    } catch (portError) {
      error(`Erreur test port: ${portError.message}`);
      hasWarnings = true;
    }

    // 8. Vérification des dépendances
    title('8. Dépendances Node.js');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const requiredDeps = ['express', 'ws', 'axios', 'dotenv'];
        
        for (const dep of requiredDeps) {
          if (packageJson.dependencies && packageJson.dependencies[dep]) {
            success(`Dépendance ${dep}: ${packageJson.dependencies[dep]}`);
          } else {
            error(`Dépendance manquante: ${dep}`);
            hasErrors = true;
          }
        }
      } catch (parseError) {
        error('Erreur lecture package.json');
        hasErrors = true;
      }
    } else {
      error('Fichier package.json manquant');
      hasErrors = true;
    }

    // 9. Résumé et recommandations
    title('9. Résumé et recommandations');
    
    if (hasErrors) {
      error('Configuration invalide - Des erreurs doivent être corrigées');
      log('\n🔧 Actions recommandées:', 'bright');
      log('• Exécuter: npm run setup', 'yellow');
      log('• Vérifier les variables dans .env', 'yellow');
      log('• Installer les dépendances: npm install', 'yellow');
      process.exit(1);
      
    } else if (hasWarnings) {
      warning('Configuration fonctionnelle avec des avertissements');
      log('\n⚠️  Points d\'attention:', 'bright');
      log('• Vérifier les avertissements ci-dessus', 'yellow');
      log('• Tester la connexion en conditions réelles', 'yellow');
      
    } else {
      success('Configuration parfaite ! 🎉');
      log('\n🚀 Prêt pour le démarrage:', 'bright');
      log('• npm start', 'green');
      log('• Ouvrir http://localhost:3000/admin.html', 'green');
      log('• Se connecter avec Twitch', 'green');
    }

    // 10. Prochaines étapes
    log('\n📋 Prochaines étapes:', 'bright');
    log('1. Démarrer le serveur: npm start', 'cyan');
    log('2. Ouvrir l\'admin: http://localhost:3000/admin.html', 'cyan');
    log('3. Onglet Twitch → Se connecter', 'cyan');
    log('4. Onglet Channel Points → Démarrer surveillance', 'cyan');
    log('5. Configurer les effets pour vos récompenses', 'cyan');
    log('6. Tester les effets avant le stream', 'cyan');

  } catch (error) {
    error(`Erreur durant les tests: ${error.message}`);
    process.exit(1);
  }
}

// Point d'entrée
if (require.main === module) {
  testOAuth().catch(error => {
    console.error('Erreur test OAuth:', error);
    process.exit(1);
  });
}

module.exports = { testOAuth };