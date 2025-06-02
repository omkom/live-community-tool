#!/usr/bin/env node

// scripts/validate-config.js - Script de validation de la configuration Channel Points
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

console.log('🔍 Validation de la configuration Channel Points Twitch...\n');

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
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

async function validateConfig() {
  let hasErrors = false;
  let hasWarnings = false;

  // 1. Vérification du fichier .env
  log('\n📋 1. Vérification du fichier .env', 'cyan');
  
  if (!fs.existsSync('.env')) {
    error('Fichier .env manquant');
    info('Copiez .env.example vers .env et configurez vos variables');
    hasErrors = true;
  } else {
    success('Fichier .env trouvé');
  }

  // 2. Vérification des variables d'environnement
  log('\n🔧 2. Vérification des variables Twitch', 'cyan');
  
  const requiredVars = [
    'TWITCH_ENABLED',
    'TWITCH_CLIENT_ID', 
    'TWITCH_CLIENT_SECRET',
    'TWITCH_USERNAME',
    'TWITCH_OAUTH_TOKEN',
    'TWITCH_CHANNEL'
  ];

  const config = {};
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
      error(`Variable ${varName} manquante`);
      hasErrors = true;
    } else if (value.includes('votre_') || value.includes('your_')) {
      error(`Variable ${varName} non configurée (contient encore un placeholder)`);
      hasErrors = true;
    } else {
      success(`Variable ${varName} configurée`);
      config[varName] = value;
    }
  }

  // 3. Vérification de l'activation Twitch
  log('\n🎮 3. Vérification de l\'activation Twitch', 'cyan');
  
  if (process.env.TWITCH_ENABLED !== 'true') {
    warning('TWITCH_ENABLED n\'est pas défini à "true"');
    info('Les Channel Points nécessitent TWITCH_ENABLED=true');
    hasWarnings = true;
  } else {
    success('Intégration Twitch activée');
  }

  // 4. Vérification du format du token OAuth
  log('\n🔐 4. Vérification du token OAuth', 'cyan');
  
  if (config.TWITCH_OAUTH_TOKEN) {
    if (!config.TWITCH_OAUTH_TOKEN.startsWith('oauth:')) {
      error('Le token OAuth doit commencer par "oauth:"');
      info('Format correct : oauth:abc123def456');
      hasErrors = true;
    } else if (config.TWITCH_OAUTH_TOKEN.length < 40) {
      warning('Le token OAuth semble trop court');
      hasWarnings = true;
    } else {
      success('Format du token OAuth valide');
    }
  }

  // 5. Test de connexion à l'API Twitch
  if (!hasErrors && config.TWITCH_CLIENT_ID && config.TWITCH_OAUTH_TOKEN) {
    log('\n🌐 5. Test de connexion à l\'API Twitch', 'cyan');
    
    try {
      // Nettoyer le token OAuth
      const cleanToken = config.TWITCH_OAUTH_TOKEN.replace('oauth:', '');
      
      // Test de validation du token
      const validateResponse = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `OAuth ${cleanToken}`
        }
      });

      if (validateResponse.status === 200) {
        success('Token OAuth valide');
        
        const tokenData = validateResponse.data;
        info(`Utilisateur : ${tokenData.login}`);
        info(`Client ID : ${tokenData.client_id}`);
        info(`Scopes : ${tokenData.scopes.join(', ')}`);

        // Vérifier les scopes requis
        const requiredScopes = ['channel:read:redemptions'];
        const hasRequiredScopes = requiredScopes.every(scope => 
          tokenData.scopes.includes(scope)
        );

        if (hasRequiredScopes) {
          success('Scopes requis présents');
        } else {
          error('Scopes manquants pour les Channel Points');
          info('Scopes requis : channel:read:redemptions');
          info('Générez un nouveau token sur https://twitchtokengenerator.com/');
          hasErrors = true;
        }

      } else {
        error('Token OAuth invalide');
        hasErrors = true;
      }

    } catch (apiError) {
      if (apiError.response?.status === 401) {
        error('Token OAuth invalide ou expiré');
        info('Générez un nouveau token sur https://twitchtokengenerator.com/');
      } else {
        error(`Erreur API Twitch : ${apiError.message}`);
      }
      hasErrors = true;
    }

    // 6. Test de récupération du channel
    if (!hasErrors) {
      log('\n📺 6. Test de récupération des informations de chaîne', 'cyan');
      
      try {
        const userResponse = await axios.get(`https://api.twitch.tv/helix/users?login=${config.TWITCH_CHANNEL}`, {
          headers: {
            'Client-ID': config.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${cleanToken}`
          }
        });

        if (userResponse.data.data.length > 0) {
          const user = userResponse.data.data[0];
          success(`Chaîne trouvée : ${user.display_name}`);
          info(`ID Broadcaster : ${user.id}`);
          info(`Type : ${user.broadcaster_type || 'Normal'}`);

          // Vérifier si Affilié/Partenaire
          if (!user.broadcaster_type) {
            warning('Chaîne non Affiliée/Partenaire - Channel Points non disponibles');
            info('Vous devez être Affilié ou Partenaire pour utiliser les Channel Points');
            hasWarnings = true;
          } else {
            success('Chaîne éligible aux Channel Points');
          }

        } else {
          error(`Chaîne "${config.TWITCH_CHANNEL}" introuvable`);
          hasErrors = true;
        }

      } catch (channelError) {
        error(`Erreur récupération chaîne : ${channelError.message}`);
        hasErrors = true;
      }
    }
  }

  // 7. Vérification des récompenses Channel Points
  if (!hasErrors) {
    log('\n💎 7. Vérification des récompenses Channel Points', 'cyan');
    
    try {
      const userResponse = await axios.get(`https://api.twitch.tv/helix/users?login=${config.TWITCH_CHANNEL}`, {
        headers: {
          'Client-ID': config.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${cleanToken}`
        }
      });

      if (userResponse.data.data.length > 0) {
        const broadcasterId = userResponse.data.data[0].id;
        
        const rewardsResponse = await axios.get(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${broadcasterId}`, {
          headers: {
            'Client-ID': config.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${cleanToken}`
          }
        });

        const rewards = rewardsResponse.data.data;
        
        if (rewards.length > 0) {
          success(`${rewards.length} récompense(s) Channel Points trouvée(s)`);
          
          rewards.forEach((reward, index) => {
            const status = reward.is_enabled ? (reward.is_paused ? 'En pause' : 'Active') : 'Désactivée';
            info(`  ${index + 1}. ${reward.title} (${reward.cost} points) - ${status}`);
          });
          
        } else {
          warning('Aucune récompense Channel Points trouvée');
          info('Créez des récompenses sur dashboard.twitch.tv');
          hasWarnings = true;
        }
      }

    } catch (rewardsError) {
      if (rewardsError.response?.status === 403) {
        error('Permissions insuffisantes pour accéder aux récompenses Channel Points');
        info('Vérifiez que votre token a le scope "channel:read:redemptions"');
      } else {
        warning(`Impossible de récupérer les récompenses : ${rewardsError.message}`);
      }
      hasWarnings = true;
    }
  }

  // 8. Vérification des dépendances
  log('\n📦 8. Vérification des dépendances', 'cyan');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = ['axios', 'express', 'ws', 'tmi.js', 'socket.io-client'];
    
    for (const dep of requiredDeps) {
      if (packageJson.dependencies[dep]) {
        success(`Dépendance ${dep} présente`);
      } else {
        error(`Dépendance ${dep} manquante`);
        hasErrors = true;
      }
    }
  } catch (pkgError) {
    error('Impossible de lire package.json');
    hasErrors = true;
  }

  // 9. Résumé
  log('\n📊 Résumé de la validation', 'cyan');
  
  if (hasErrors) {
    error('Configuration invalide - Des erreurs doivent être corrigées');
    info('Consultez le guide : CHANNEL_POINTS_GUIDE.md');
    process.exit(1);
  } else if (hasWarnings) {
    warning('Configuration partiellement valide - Des avertissements à vérifier');
    info('La fonctionnalité devrait fonctionner mais pourrait avoir des limitations');
  } else {
    success('Configuration valide ! 🎉');
    info('Votre configuration Channel Points est prête à être utilisée');
  }

  log('\n🚀 Prochaines étapes :', 'cyan');
  info('1. Démarrez le serveur : npm start');
  info('2. Ouvrez l\'admin : http://localhost:3000/admin.html');
  info('3. Allez dans l\'onglet "Channel Points"');
  info('4. Cliquez sur "Démarrer" pour activer la surveillance');
  info('5. Configurez les effets pour vos récompenses');
  info('6. Testez avec un viewer !');
}

// Gestion des erreurs
process.on('unhandledRejection', (error) => {
  log(`\n💥 Erreur inattendue : ${error.message}`, 'red');
  process.exit(1);
});

// Lancement de la validation
validateConfig().catch(error => {
  log(`\n💥 Erreur de validation : ${error.message}`, 'red');
  process.exit(1);
});