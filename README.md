# 🎮 Stream 24h - OAuth Twitch Intégré

Système de stream interactif avec **connexion Twitch OAuth simplifiée** et **Channel Points automatiques**.

## ⚡ Installation Rapide

### 1. Prérequis
- Node.js 16+
- Compte Twitch (Affilié/Partenaire pour Channel Points)

### 2. Installation
```bash
git clone <votre-repo>
cd stream24h
npm install
cp .env.example .env
```

### 3. Configuration Twitch App

1. **Créer une app Twitch** :
   - Aller sur [dev.twitch.tv/console](https://dev.twitch.tv/console/apps)
   - Cliquer "Register Your Application"
   - **Name** : "Stream 24h Admin"
   - **OAuth Redirect URLs** : `http://localhost:3000/auth/twitch/callback`
   - **Category** : "Application Integration"

2. **Configurer .env** :
   ```env
   TWITCH_CLIENT_ID=votre_client_id
   TWITCH_CLIENT_SECRET=votre_client_secret
   ```

### 4. Démarrage
```bash
npm start
```

**C'est tout !** Plus besoin de tokens OAuth manuels.

## 🚀 Utilisation

### Connexion Twitch
1. Ouvrir [localhost:3000/admin.html](http://localhost:3000/admin.html)
2. Onglet **"Twitch"** → **"Se connecter avec Twitch"**
3. Autoriser l'application
4. ✅ Connecté automatiquement !

### Channel Points
1. Onglet **"Channel Points"** → **"Démarrer"**
2. Configurer les effets pour vos récompenses
3. Tester avec **"Tester Effet"**
4. 🎉 Les viewers peuvent déclencher des effets !

## 🎯 Interfaces

| Interface | URL | Usage |
|-----------|-----|-------|
| **Admin** | `/admin.html` | Gestion stream + connexion Twitch |
| **Viewers** | `/` | Timeline planning public |
| **Overlay OBS** | `/overlay/` | Effets visuels |
| **Status OBS** | `/status.html` | Barres progression |

## ⚙️ Channel Points

### Effets Disponibles
- **✨ Tada** : Confettis
- **⚡ Flash** : Flash écran  
- **🔍 Zoom** : Effet zoom
- **📳 Shake** : Secoue écran
- **🏀 Bounce** : Rebond
- **💓 Pulse** : Pulsation

### Configuration Auto
Le système détecte automatiquement les effets selon :
- **Mots-clés** : "confetti" → tada, "flash" → flash, etc.
- **Coût** : ≥1000 points → tada, ≥500 → pulse, etc.
- **Manuel** : Configuration dans l'admin

### Intégration OBS
1. Source **"Navigateur"** 
2. URL : `http://localhost:3000/overlay/`
3. Taille : 1920x1080
4. CSS : `body { background: rgba(0,0,0,0); }`

Pour plus de détails et toutes les fonctionnalités Channel Points, voir la [documentation dédiée Channel Points](docs/channel-points.md).

## 🔧 API

### OAuth Twitch
```javascript
// Statut connexion
GET /auth/twitch/status

// Déconnecter
POST /auth/twitch/disconnect
```

### Channel Points  
```javascript
// Statut
GET /api/channel-points/status

// Démarrer surveillance
POST /api/channel-points/monitoring/start

// Récompenses disponibles
GET /api/channel-points/rewards

// Configurer effets
POST /api/channel-points/configure
```

### Effets & Messages
```javascript
// Déclencher effet
POST /api/effect { "type": "tada" }

// Envoyer message overlay
POST /api/message { "message": "Hello!" }
```

## 🎨 Personnalisation

### Ajouter des Effets
1. Modifier `/public/css/overlay.css`
2. Ajouter animations CSS
3. Intégrer dans `/public/js/overlay.js`

### Nouveaux Types d'Événements
1. Étendre `TwitchChannelPoints.detectEffect()`
2. Ajouter mappings dans l'admin
3. Créer animations correspondantes

## 🛠️ Développement

```bash
# Mode développement (auto-reload)
npm run dev

# Logs en temps réel
tail -f data/logs.json
```

## 🔒 Sécurité

- **OAuth 2.0** : Tokens chiffrés, refresh automatique
- **Scopes minimum** : Channel Points uniquement
- **Local Storage** : Tokens stockés localement
- **Révocation** : Possible depuis l'admin

## ⚠️ Dépannage

### Channel Points ne marchent pas
1. **Vérifier statut Twitch** : Affilié/Partenaire requis
2. **Reconnecter** : Bouton déconnecter → reconnecter
3. **Créer récompenses** : Sur dashboard.twitch.tv
4. **Vérifier permissions** : Bouton "Tester Connexion"

### Erreur connexion OAuth
1. **URL redirect** : Doit être exacte dans app Twitch
2. **Client Secret** : Vérifier qu'il est correct
3. **Firewall** : Port 3000 ouvert

## 📊 Monitoring

- **Interface Admin** : Statuts temps réel
- **Logs** : Onglet "Logs" dans admin
- **Health Check** : `/api/health`
- **Console** : `npm start` affiche l'état