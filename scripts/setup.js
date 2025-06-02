#!/usr/bin/env node
// scripts/setup.js - Installation et configuration automatique

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
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
  log(`\n🎮 ${message}`, 'cyan');
  log('='.repeat(message.length + 4), 'cyan');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.clear();
  title('STREAM 24H - SETUP AUTOMATIQUE');
  
  log('Bienvenue dans l\'assistant de configuration Stream 24h !', 'bright');
  log('Ce script va vous aider à configurer votre environnement Twitch OAuth.\n');

  try {
    // 1. Vérification des prérequis
    await checkPrerequisites();
    
    // 2. Configuration des dossiers
    await setupDirectories();
    
    // 3. Configuration .env
    await setupEnvironment();
    
    // 4. Initialisation des données
    await initializeData();
    
    // 5. Test de la configuration
    await testConfiguration();
    
    // 6. Instructions finales
    showFinalInstructions();
    
  } catch (err) {
    error(`Erreur durant le setup: ${err.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function checkPrerequisites() {
  title('1. Vérification des prérequis');
  
  // Vérifier Node.js
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1));
  
  if (majorVersion >= 16) {
    success(`Node.js ${nodeVersion} ✓`);
  } else {
    error(`Node.js ${nodeVersion} - Version 16+ requise`);
    process.exit(1);
  }
  
  // Vérifier npm
  try {
    const { execSync } = require('child_process');
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    success(`npm ${npmVersion} ✓`);
  } catch (err) {
    error('npm non trouvé');
    process.exit(1);
  }
  
  info('Tous les prérequis sont satisfaits !');
}

async function setupDirectories() {
  title('2. Configuration des dossiers');
  
  const directories = [
    'data',
    'data/backups',
    'public/uploads'
  ];
  
  for (const dir of directories) {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      success(`Dossier créé: ${dir}`);
    } else {
      info(`Dossier existe: ${dir}`);
    }
  }
}

async function setupEnvironment() {
  title('3. Configuration Twitch OAuth');
  
  const envPath = path.join(process.cwd(), '.env');
  let createNew = true;
  
  if (fs.existsSync(envPath)) {
    log('Un fichier .env existe déjà.', 'yellow');
    const overwrite = await question('Voulez-vous le remplacer ? (y/N): ');
    createNew = overwrite.toLowerCase() === 'y' || overwrite.toLowerCase() === 'yes';
    
    if (!createNew) {
      info('Conservation du fichier .env existant');
      return;
    }
  }
  
  log('\n📱 Configuration de votre application Twitch', 'bright');
  log('Si vous n\'avez pas encore d\'application Twitch, suivez ces étapes :\n');
  
  log('1. Allez sur: https://dev.twitch.tv/console/apps', 'cyan');
  log('2. Cliquez "Register Your Application"', 'cyan');
  log('3. Name: "Stream 24h Admin"', 'cyan');
  log('4. OAuth Redirect URLs: http://localhost:3000/auth/twitch/callback', 'cyan');
  log('5. Category: "Application Integration"', 'cyan');
  log('6. Copiez Client ID et Client Secret\n', 'cyan');
  
  const clientId = await question('🔑 Client ID Twitch: ');
  if (!clientId || clientId.length < 10) {
    error('Client ID invalide');
    process.exit(1);
  }
  
  const clientSecret = await question('🔐 Client Secret Twitch: ');
  if (!clientSecret || clientSecret.length < 10) {
    error('Client Secret invalide');
    process.exit(1);
  }
  
  const port = await question('🌐 Port du serveur (3000): ') || '3000';
  
  const envContent = `# Stream 24h - Configuration OAuth Twitch
# Généré automatiquement le ${new Date().toISOString()}

# Configuration serveur
PORT=${port}
NODE_ENV=development

# Configuration Twitch OAuth
TWITCH_CLIENT_ID=${clientId}
TWITCH_CLIENT_SECRET=${clientSecret}
TWITCH_REDIRECT_URI=http://localhost:${port}/auth/twitch/callback

# Optionnel
ADMIN_PASSWORD=stream24h-admin

# ⚠️  IMPORTANT: Ne partagez jamais ce fichier !
# Les tokens OAuth sont générés automatiquement lors de la connexion.
`;
  
  fs.writeFileSync(envPath, envContent);
  success('Fichier .env créé avec succès !');
}

async function initializeData() {
  title('4. Initialisation des données');
  
  const dataFiles = [
    {
      path: 'data/stream24h.json',
      content: {
        planning: [
          { time: "10:30", label: "🌅 Ouverture + Café communauté", checked: false },
          { time: "12:00", label: "🎮 Gaming session #1", checked: false },
          { time: "14:00", label: "💬 Interaction viewers", checked: false },
          { time: "16:00", label: "💻 Live coding", checked: false },
          { time: "18:00", label: "🍽️ Cuisine en direct", checked: false },
          { time: "20:00", label: "🎵 Session musicale", checked: false },
          { time: "22:00", label: "🎬 React aux vidéos du chat", checked: false },
          { time: "00:00", label: "🌙 Stream nocturne chill", checked: false }
        ]
      }
    },
    {
      path: 'data/status.json',
      content: {
        donation_total: 0,
        donation_goal: 1000,
        subs_total: 0,
        subs_goal: 100,
        stream_start_time: null,
        last_update: new Date().toISOString()
      }
    }
  ];
  
  for (const file of dataFiles) {
    const fullPath = path.join(process.cwd(), file.path);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, JSON.stringify(file.content, null, 2));
      success(`Fichier créé: ${file.path}`);
    } else {
      info(`Fichier existe: ${file.path}`);
    }
  }
}

async function testConfiguration() {
  title('5. Test de la configuration');
  
  try {
    // Tester le chargement des variables d'environnement
    require('dotenv').config();
    
    if (!process.env.TWITCH_CLIENT_ID) {
      throw new Error('TWITCH_CLIENT_ID manquant');
    }
    
    if (!process.env.TWITCH_CLIENT_SECRET) {
      throw new Error('TWITCH_CLIENT_SECRET manquant');
    }
    
    success('Variables d\'environnement chargées');
    
    // Tester l'accès aux fichiers de données
    const planningPath = path.join(process.cwd(), 'data/stream24h.json');
    const statusPath = path.join(process.cwd(), 'data/status.json');
    
    JSON.parse(fs.readFileSync(planningPath, 'utf8'));
    JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    
    success('Fichiers de données valides');
    
    info('Configuration testée avec succès !');
    
  } catch (err) {
    error(`Erreur de test: ${err.message}`);
    throw err;
  }
}

function showFinalInstructions() {
  title('🎉 Configuration terminée !');
  
  log('Votre environnement Stream 24h est prêt !\n', 'green');
  
  log('📋 Prochaines étapes:', 'bright');
  log('');
  log('1. Démarrer le serveur:', 'cyan');
  log('   npm start', 'yellow');
  log('');
  log('2. Ouvrir l\'interface admin:', 'cyan');
  log('   http://localhost:3000/admin.html', 'yellow');
  log('');
  log('3. Se connecter à Twitch:', 'cyan');
  log('   → Onglet "Twitch" → Bouton "Se connecter"', 'yellow');
  log('');
  log('4. Configurer les Channel Points:', 'cyan');
  log('   → Onglet "Channel Points" → Bouton "Démarrer"', 'yellow');
  log('');
  log('5. Intégrer dans OBS:', 'cyan');
  log('   → Source Navigateur → http://localhost:3000/overlay/', 'yellow');
  log('');
  
  log('🔗 Liens utiles:', 'bright');
  log('• Admin: http://localhost:3000/admin.html', 'blue');
  log('• Public: http://localhost:3000/', 'blue');
  log('• Overlay: http://localhost:3000/overlay/', 'blue');
  log('• Status: http://localhost:3000/status.html', 'blue');
  log('');
  
  log('💡 Conseils:', 'bright');
  log('• Créez des récompenses Channel Points sur dashboard.twitch.tv', 'magenta');
  log('• Testez les effets depuis l\'admin avant le stream', 'magenta');
  log('• Sauvegardez votre fichier .env en sécurité', 'magenta');
  log('');
  
  log('🆘 Besoin d\'aide ?', 'bright');
  log('• Documentation: README.md', 'blue');
  log('• Test OAuth: npm run test-oauth', 'blue');
  log('• Validation: npm run validate', 'blue');
  log('');
  
  success('Bon stream ! 🚀');
}

// Gestion des erreurs
process.on('uncaughtException', (error) => {
  error(`Erreur critique: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  error(`Promesse rejetée: ${reason}`);
  process.exit(1);
});

// Gestion de l'interruption
process.on('SIGINT', () => {
  log('\n\n👋 Setup interrompu par l\'utilisateur', 'yellow');
  rl.close();
  process.exit(0);
});

// Lancement du setup
if (require.main === module) {
  setup().catch(error => {
    console.error('Erreur setup:', error);
    process.exit(1);
  });
}

module.exports = { setup };