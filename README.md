# 🎬 Stream 24h – Système interactif en temps réel pour Twitch

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Un système complet et modulaire pour gérer des streams événementiels de longue durée sur Twitch (24h, marathon, anniversaire, passage affilié...).

## ✨ Caractéristiques

- 📊 **Interface admin complète**  
  Gestion intuitive du planning, suivi des dons et des abonnements, déclenchement d'effets visuels.

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

## 📂 Structure du projet

```
/stream24h/
  /public/           # Contenu statique accessible au client
    /css/            # Feuilles de style
    /js/             # Scripts JavaScript côté client
    admin.html       # Interface de gestion pour le streamer
    index.html       # Page principale pour les viewers (planning timeline)
    overlay.html     # Overlay d'effets visuels (à intégrer dans OBS)
    status.html      # Overlay de statut des dons (à intégrer dans OBS)
  /server/           # Modules serveur
    logger.js        # Système de journalisation
    validator.js     # Validation des données
  /data/             # Stockage des données JSON
    stream24h.json   # Données du planning
    status.json      # Données des dons et abonnements
    logs.json        # Historique des actions
  server.js          # Point d'entrée du serveur
  package.json       # Dépendances du projet
  .gitignore         # Fichiers exclus du contrôle de version
  README.md          # Ce fichier de documentation
```

## 🚀 Guide de démarrage

### Prérequis
- Node.js 16.x ou supérieur
- npm ou yarn

### Installation

1. Clonez ce dépôt :
   ```bash
   git clone https://github.com/votre-username/stream24h.git
   cd stream24h
   ```

2. Installez les dépendances :
   ```bash
   npm install
   # ou avec yarn
   yarn install
   ```

3. Démarrez le serveur :
   ```bash
   npm start
   # ou en mode développement
   npm run dev
   ```

4. Accédez aux différentes interfaces :
   - **Administration** : http://localhost:3000/admin.html
   - **Page viewers** : http://localhost:3000/
   - **Overlay (OBS)** : http://localhost:3000/overlay.html
   - **Statut dons (OBS)** : http://localhost:3000/status.html

## 🧩 Intégration avec OBS

Pour intégrer les overlays dans OBS Studio :

1. Ajoutez une source **Navigateur** dans votre scène
2. Entrez l'URL correspondante (http://localhost:3000/overlay.html ou http://localhost:3000/status.html)
3. Définissez la largeur et hauteur correspondant à votre résolution de stream
4. Cochez **CSS personnalisé** et ajoutez : `body { background-color: rgba(0, 0, 0, 0); margin: 0px; }`

## 🛠️ Utilisation des interfaces

### Interface Admin

- **Onglet Planning** : Gérez les moments du stream, leur statut (fait/à faire), et visualisez une timeline
- **Onglet Cagnotte** : Suivez et mettez à jour les dons et abonnements reçus
- **Onglet Interactions** : Déclenchez des effets visuels et envoyez des messages à l'écran
- **Onglet Logs** : Consultez l'historique des actions et événements

### Overlays OBS

- **overlay.html** : Affiche les effets visuels (tada, flash, etc.) et les messages déclenchés depuis l'admin
- **status.html** : Affiche les barres de progression des dons et abonnements

## 📡 Architecture technique

Le système utilise :

- **Express.js** pour le serveur HTTP et les API REST
- **WebSocket** pour les communications en temps réel
- **Vanilla JavaScript** pour les interfaces clients (sans dépendances lourdes)
- **Système modulaire** pour une maintenance et évolution facilitées

### Communication en temps réel

Toutes les mises à jour sont propagées instantanément à tous les clients connectés (admin, viewers, overlays OBS) via WebSocket. Chaque client s'identifie avec un type (`admin`, `viewer`, `overlay`, `status`) pour recevoir uniquement les messages pertinents.

### Stockage des données

Les données sont stockées localement dans des fichiers JSON :
- `stream24h.json` : Planning du stream
- `status.json` : État des dons et abonnements
- `logs.json` : Journal des événements

## 🔧 Personnalisation

### Ajouter de nouveaux effets visuels

1. Ajoutez l'effet dans `public/css/overlay.css` avec une nouvelle animation keyframe
2. Créez un nouveau bouton dans `public/admin.html` dans la grille d'effets
3. Ajoutez la logique dans `public/js/overlay.js` pour gérer cet effet

### Étendre les données du planning

Pour ajouter de nouveaux champs aux éléments du planning :

1. Modifiez la structure dans `server/validator.js` pour inclure le nouveau champ
2. Adaptez l'interface admin dans `public/admin.html` et `public/js/admin.js`
3. Mettez à jour l'affichage dans `public/index.html` et `public/js/index.js`

## 🔍 Dépannage

### Le serveur ne démarre pas

- Vérifiez qu'aucun autre service n'utilise déjà le port 3000
- Assurez-vous que les permissions sont correctes pour accéder aux fichiers

### Les mises à jour ne sont pas visibles dans les overlays

- Vérifiez la connexion WebSocket dans la console du navigateur
- Assurez-vous que les fichiers JSON sont accessibles en écriture

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Forkez le projet
2. Créez une branche pour votre fonctionnalité
3. Committez vos changements
4. Poussez vers la branche
5. Ouvrez une Pull Request

## 📝 Licence

Ce projet est distribué sous licence MIT. Voir le fichier `LICENSE` pour plus d'informations.

## 🙏 Remerciements

- Merci à la communauté Twitch pour l'inspiration
- Toutes les icônes proviennent de Font Awesome
- L'animation de confettis utilise confetti-js