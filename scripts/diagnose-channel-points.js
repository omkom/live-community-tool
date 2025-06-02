#!/usr/bin/env node
// scripts/diagnose-channel-points.js - Diagnostic Channel Points

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

function success(message) { log(`✅ ${message}`, 'green'); }
function error(message) { log(`❌ ${message}`, 'red'); }
function warning(message) { log(`⚠️  ${message}`, 'yellow'); }
function info(message) { log(`ℹ️  ${message}`, 'blue'); }

async function diagnoseChannelPoints() {
  log('\n🔍 Diagnostic Channel Points Twitch', 'cyan');
  log('=' .repeat(40), 'cyan');

  try {
    // 1. Vérifier les tokens OAuth
    log('\n📋 1. Vérification des tokens OAuth', 'cyan');
    
    const tokensPath = path.join(__dirname, '..', 'data', 'twitch_tokens.json');
    if (!fs.existsSync(tokensPath)) {
      error('Fichier twitch_tokens.json introuvable');
      error('Solution: Connectez-vous via l\'interface admin');
      return;
    }

    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
    success('Tokens OAuth trouvés');

    // 2. Vérifier la validité du token
    log('\n🔐 2. Validation du token', 'cyan');
    
    const validateResponse = await axios.get('https://id.twitch.tv/oauth2/validate', {
      headers: { 'Authorization': `OAuth ${tokens.access_token}` }
    });

    if (validateResponse.status === 200) {
      const tokenData = validateResponse.data;
      success(`Token valide pour: ${tokenData.login}`);
      info(`Client ID: ${tokenData.client_id}`);
      info(`Scopes: ${tokenData.scopes.join(', ')}`);

      // Vérifier les scopes requis
      const requiredScopes = ['channel:read:redemptions'];
      const hasRequiredScopes = requiredScopes.every(scope => 
        tokenData.scopes.includes(scope)
      );

      if (hasRequiredScopes) {
        success('Scopes Channel Points présents');
      } else {
        error('Scopes manquants pour Channel Points');
        error('Scope requis: channel:read:redemptions');
        info('Solution: Reconnectez-vous avec les bonnes permissions');
        return;
      }
    }

    // 3. Vérifier les informations utilisateur
    log('\n👤 3. Informations du broadcaster', 'cyan');
    
    const userResponse = await axios.get(`https://api.twitch.tv/helix/users?login=${tokenData.login}`, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (userResponse.data.data.length > 0) {
      const user = userResponse.data.data[0];
      success(`Broadcaster: ${user.display_name}`);
      info(`ID: ${user.id}`);
      info(`Type: ${user.broadcaster_type || 'Normal'}`);

      // DIAGNOSTIC PRINCIPAL : Statut Affilié/Partenaire
      if (!user.broadcaster_type || user.broadcaster_type === '') {
        error('🚨 PROBLÈME IDENTIFIÉ: Statut broadcaster insuffisant');
        error('Votre compte n\'est ni Affilié ni Partenaire');
        error('Les Channel Points nécessitent le statut Affilié ou Partenaire');
        
        log('\n💡 SOLUTIONS:', 'yellow');
        warning('1. Devenez Affilié Twitch (50 followers, 8h stream sur 30 jours, etc.)');
        warning('2. Utilisez le système de test intégré en attendant');
        warning('3. Désactivez temporairement Channel Points');
        
        return;
      } else {
        success(`Statut suffisant: ${user.broadcaster_type}`);
      }
    }

    // 4. Tester l'accès aux récompenses Channel Points
    log('\n💎 4. Test accès aux récompenses', 'cyan');
    
    try {
      const rewardsResponse = await axios.get(
        `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${user.id}`,
        {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${tokens.access_token}`
          }
        }
      );

      success('Accès aux récompenses Channel Points réussi');
      const rewards = rewardsResponse.data.data;
      
      if (rewards.length > 0) {
        success(`${rewards.length} récompense(s) trouvée(s):`);
        rewards.forEach((reward, i) => {
          const status = reward.is_enabled ? (reward.is_paused ? 'En pause' : 'Active') : 'Désactivée';
          info(`  ${i+1}. ${reward.title} (${reward.cost} pts) - ${status}`);
        });
      } else {
        warning('Aucune récompense Channel Points trouvée');
        info('Créez des récompenses sur dashboard.twitch.tv');
      }

    } catch (rewardError) {
      if (rewardError.response?.status === 403) {
        error('🚨 ERREUR 403: Accès aux récompenses refusé');
        
        const errorDetails = rewardError.response.data;
        error(`Détails: ${errorDetails.message}`);
        
        if (errorDetails.message.includes('Client-Id header must match')) {
          error('❌ Client ID ne correspond pas');
          log('\n💡 SOLUTIONS Client ID:', 'yellow');
          warning('1. Vérifiez que TWITCH_CLIENT_ID dans .env correspond à votre app');
          warning('2. Utilisez la même app Twitch pour OAuth et Channel Points');
          warning('3. Créez les récompenses avec la même app Twitch');
        }
        
        if (errorDetails.message.includes('partner or affiliate')) {
          error('❌ Statut broadcaster insuffisant (déjà vérifié au-dessus)');
        }
        
        return;
      } else {
        throw rewardError;
      }
    }

    // 5. Tester l'accès aux rachats
    log('\n🎯 5. Test accès aux rachats', 'cyan');
    
    if (rewards.length > 0) {
      const testReward = rewards[0];
      try {
        const redemptionsResponse = await axios.get(
          `https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${user.id}&reward_id=${testReward.id}&status=FULFILLED&first=1`,
          {
            headers: {
              'Client-ID': process.env.TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${tokens.access_token}`
            }
          }
        );

        success('Accès aux rachats Channel Points réussi');
        const redemptions = redemptionsResponse.data.data;
        info(`${redemptions.length} rachat(s) récent(s) trouvé(s)`);

      } catch (redemptionError) {
        if (redemptionError.response?.status === 403) {
          error('Erreur 403 sur l\'accès aux rachats');
          error('Même problème que pour les récompenses');
        } else {
          warning(`Erreur rachats: ${redemptionError.message}`);
        }
      }
    }

    // 6. Résumé et recommandations
    log('\n📊 RÉSUMÉ', 'cyan');
    success('✅ Diagnostic terminé avec succès');
    success('✅ Configuration Channel Points valide');
    
    log('\n🚀 Prochaines étapes:', 'cyan');
    info('1. Redémarrez le serveur : npm start');
    info('2. Testez via l\'admin : onglet Channel Points');
    info('3. Utilisez le bouton "Tester Effet" avant le stream');

  } catch (error) {
    if (error.response?.status === 401) {
      error('Token OAuth expiré ou invalide');
      error('Solution: Reconnectez-vous via l\'interface admin');
    } else {
      error(`Erreur diagnostic: ${error.message}`);
      if (error.response) {
        error(`Status: ${error.response.status}`);
        error(`Détails: ${JSON.stringify(error.response.data)}`);
      }
    }
  }
}

// Lancement
if (require.main === module) {
  diagnoseChannelPoints().catch(console.error);
}

module.exports = { diagnoseChannelPoints };