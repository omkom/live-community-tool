# 🎬 Stream 24h – Système interactif en temps réel pour Twitch

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Twitch](https://img.shields.io/badge/Twitch-Channel%20Points-9146ff.svg)

Un système complet et modulaire pour gérer des streams événementiels de longue durée sur Twitch (24h, marathon, anniversaire, passage affilié...) avec support des **Channel Points interactifs**.

## ✨ Caractéristiques

- 📊 **Interface admin complète**  
  Gestion intuitive du planning, suivi des dons et des abonnements, déclenchement d'effets visuels.

- 💎 **Channel Points Twitch intégrés** *(NOUVEAU)*  
  Vos viewers peuvent dépenser leurs points de chaîne pour déclencher des effets visuels en temps réel !

- 🔄 **Temps réel via WebSocket**  
  Synchronisation instantanée entre l'admin et les overlays OBS.

- 📱 **Interfaces responsives**  
  Adaptées à tous les appareils (ordinateur, tablette, mobile).

- 🎨 **Animations et effets visuels avancés**  
  Confettis, flash, zoom, et autres effets pour maintenir l'engagement des viewers.

- 📈 **Suivi des métriques**  
  Progression des dons et des abonnements avec barres visuelles.

- 📝 **Journalisation complète**  
  Historique des actions et des événements dans l'interface admin.

## 🚀 Guide de démarrage

### Prérequis
- Node.js 16.x ou supérieur
- npm ou yarn
- **Compte Twitch Affilié ou Partenaire** (pour les Channel Points)

### Installation

1. **Clonez ce dépôt :**
   ```bash
   git clone https://github.com/votre-username/stream24h.git
   cd stream24h
   ```

2. **Installez les dépendances :**
   ```bash
   npm install
   ```

3. **Configurez vos variables d'environnement :**
   ```bash
   cp .env.example .env
   # Éditez le fichier .env avec vos informations Twitch
   ```

4. **Validez votre configuration :**
   ```bash
   npm run validate-config
   ```

5. **Démarrez le serveur :**
   ```bash
   npm start
   # ou en mode développement
   npm run dev
   ```

6. **Accédez aux différentes interfaces :**
   - **Administration** : http://localhost:3000/admin.html
   - **Page viewers** : http://localhost:3000/
   - **Overlay (OBS)** : http://localhost:3000/overlay/
   - **Statut dons (OBS)** : http://localhost:3000/status.html

## 💎 Configuration Channel Points

### 1. Prérequis Twitch

Pour utiliser les Channel Points, vous devez :
- Être **Affilié ou Partenaire** Twitch
- Avoir créé des **récompenses Channel Points** sur votre dashboard
- Configurer un **token OAuth** avec les bonnes permissions

### 2. Configuration rapide

1. **Obtenez vos identifiants Twitch :**
   - Client ID/Secret : [dev.twitch.tv/console](https://dev.twitch.tv/console/apps)
   - Token OAuth : [twitchtokengenerator.com](https://twitchtokengenerator.com/)

2. **Configurez votre .env :**
   ```env
   TWITCH_ENABLED=true
   TWITCH_CLIENT_ID=votre_client_id
   TWITCH_OAUTH_TOKEN=oauth:votre_token
   TWITCH_CHANNEL=votre_chaine
   ```

3. **Validez la configuration :**
   ```bash
   npm run validate-config
   ```

### 3. Création des récompenses

Créez des récompenses sur [dashboard.twitch.tv](https://dashboard.twitch.tv) :

| Nom de la Récompense | Coût | Effet |
|---------------------|------|-------|
| ✨ Confetti Party | 100 points | Confettis à l'écran |
| ⚡ Screen Flash | 50 points | Flash lumineux |
| 📳 Shake Screen | 75 points | Secoue l'écran |
| 🔍 Zoom Effect | 80 points | Effet de zoom |

### 4. Configuration dans l'admin

1. Ouvrez l'interface admin
2. Allez dans l'onglet **"💎 Channel Points"**
3. Cliquez sur **"Démarrer"** pour activer la surveillance
4. Configurez les effets pour chaque récompense
5. Testez avec le bouton **"Tester Effet"**

📖 **Guide détaillé** : [CHANNEL_POINTS_GUIDE.md](./CHANNEL_POINTS_GUIDE.md)

## 📂 Structure du projet

```
/stream24h/
  /public/           # Contenu statique accessible au client
    /css/            # Feuilles de style
      admin.css      # Interface admin
      channel-points.css  # Styles Channel Points (NOUVEAU)
    /js/             # Scripts JavaScript côté client
      channel-points-admin.js  # Admin Channel Points (NOUVEAU)
    admin.html       # Interface de gestion pour le streamer
    index.html       # Page principale pour les viewers (planning timeline)
    overlay/         # Overlay d'effets visuels (à intégrer dans OBS)
    status.html      # Overlay de statut des dons (à intégrer dans OBS)
  /server/           # Modules serveur
    logger.js        # Système de journalisation
    validator.js     # Validation des données
    twitch.js        # Intégration Twitch avec Channel Points
    twitch-channel-points.js  # Gestionnaire Channel Points (NOUVEAU)
  /scripts/          # Scripts utilitaires
    validate-config.js  # Validation de configuration (NOUVEAU)
  /data/             # Stockage des données JSON
    stream24h.json   # Données du planning
    status.json      # Données des dons et abonnements
    logs.json        # Historique des actions
  server.js          # Point d'entrée du serveur
  package.json       # Dépendances du projet
  .env.example       # Exemple de configuration
  CHANNEL_POINTS_GUIDE.md  # Guide Channel Points (NOUVEAU)
```

## 🧩 Intégration avec OBS

### Pour les overlays existants

Si vous avez déjà configuré les overlays, **aucune modification n'est nécessaire** ! Les effets Channel Points utilisent le même système que les effets manuels.

### Nouvelle installation

1. Ajoutez une source **Navigateur** dans votre scène OBS
2. URL : `http://localhost:3000/overlay/`
3. Dimensions : 1920x1080
4. CSS personnalisé : `body { background-color: rgba(0, 0, 0, 0); margin: 0px; }`

## 🛠️ Utilisation des interfaces

### Interface Admin

- **Onglet Planning** : Gérez les moments du stream, leur statut (fait/à faire), et visualisez une timeline
- **Onglet Channel Points** *(NOUVEAU)* : Configurez et surveillez les effets des Channel Points
- **Onglet Cagnotte** : Suivez et mettez à jour les dons et abonnements reçus
- **Onglet Interactions** : Déclenchez des effets visuels et envoyez des messages à l'écran
- **Onglet Logs** : Consultez l'historique des actions et événements

### Overlays OBS

- **overlay/** : Affiche les effets visuels (tada, flash, etc.) et les messages déclenchés depuis l'admin ou par Channel Points
- **status.html** : Affiche les barres de progression des dons et abonnements

## 🎮 Effets disponibles

| Effet | Description | Utilisation |
|-------|-------------|-------------|
| ✨ **Tada** | Confettis + animation célébration | Gros événements, objectifs atteints |
| ⚡ **Flash** | Flash blanc sur l'écran | Moments de surprise |
| 📳 **Shake** | Secoue l'écran du streamer | Effets comiques |
| 🔍 **Zoom** | Effet de zoom sur l'overlay | Mise en avant |
| 🏀 **Bounce** | Effet de rebond | Animations ludiques |
| 💓 **Pulse** | Effet de pulsation | Moments émotionnels |

## 📡 Architecture technique

Le système utilise :

- **Express.js** pour le serveur HTTP et les API REST
- **WebSocket** pour les communications en temps réel
- **API Twitch Helix** pour les Channel Points *(NOUVEAU)*
- **Vanilla JavaScript** pour les interfaces clients (sans dépendances lourdes)
- **Système modulaire** pour une maintenance et évolution facilitées

### Communication en temps réel

Toutes les mises à jour sont propagées instantanément à tous les clients connectés (admin, viewers, overlays OBS) via WebSocket. Les événements Channel Points sont traités en temps réel et déclenchent immédiatement les effets visuels.

## 🔧 Scripts utilitaires

```bash
# Valider la configuration Twitch
npm run validate-config

# Démarrer en mode développement
npm run dev

# Configuration complète (installation + validation)
npm run setup
```

## ⚠️ Dépannage

### Channel Points ne fonctionnent pas

1. **Vérifiez votre statut Twitch** : Vous devez être Affilié ou Partenaire
2. **Validez votre configuration** : `npm run validate-config`
3. **Vérifiez les permissions** : Token OAuth avec scope `channel:read:redemptions`
4. **Créez des récompenses** : Sur dashboard.twitch.tv

### Erreurs communes

- **"Channel Points non initialisé"** → Vérifiez `TWITCH_ENABLED=true`
- **"Permissions insuffisantes"** → Régénérez votre token OAuth
- **"Aucune récompense trouvée"** → Créez des récompenses sur Twitch

### Le serveur ne démarre pas

- Vérifiez qu'aucun autre service n'utilise le port 3000
- Assurez-vous que les permissions sont correctes pour accéder aux fichiers
- Vérifiez que Node.js version 16+ est installé

## 🎯 Exemples d'utilisation

### Stream Marathon 24h

- **Channel Points pour interaction** : Les viewers dépensent des points pour déclencher des effets
- **Planning dynamique** : Suivi en temps réel des activités prévues
- **Objectifs visuels** : Barres de progression pour dons et abonnements

### Événement communautaire

- **Effets collaboratifs** : Les viewers participent avec leurs Channel Points
- **Timeline interactive** : Planification visible par tous
- **Statistiques en direct** : Suivi des métriques importantes

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Forkez le projet
2. Créez une branche pour votre fonctionnalité
3. Committez vos changements
4. Poussez vers la branche
5. Ouvrez une Pull Request

## 📝 Changelog

### Version 1.1.0 (Nouvelle version)

- ✅ **Channel Points Twitch intégrés**
- ✅ Interface admin dédiée aux Channel Points
- ✅ Détection automatique des effets basée sur les noms de récompenses
- ✅ Script de validation de configuration
- ✅ Guide d'utilisation détaillé
- ✅ Support des permissions OAuth avancées

### Version 1.0.0

- Interface admin complète
- Système d'overlays OBS
- WebSocket temps réel
- Planning interactif
- Suivi des métriques

## 📄 Licence

Ce projet est distribué sous licence MIT. Voir le fichier `LICENSE` pour plus d'informations.

## 🙏 Remerciements

- Merci à la communauté Twitch pour l'inspiration
- API Twitch Helix pour les Channel Points
- Toutes les icônes proviennent de Font Awesome
- L'animation de confettis utilise confetti-js

---

**Créez des streams interactifs inoubliables avec les Channel Points ! 🎉💎**