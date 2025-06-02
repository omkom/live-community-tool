# 💎 Guide Channel Points Twitch

Ce guide explique comment configurer et utiliser le système de Channel Points Twitch pour déclencher des effets visuels sur votre stream.

## 🚀 Configuration Initiale

### 1. Prérequis Twitch

Avant de commencer, vous devez avoir :

- **Un compte Twitch avec le statut Affilié ou Partenaire** (requis pour les Channel Points)
- **Des récompenses Channel Points créées** sur votre dashboard Twitch
- **Un token OAuth Twitch avec les bonnes permissions**

### 2. Permissions Requises

Votre token OAuth Twitch doit avoir les scopes suivants :
- `channel:read:redemptions` - Pour lire les rachats de Channel Points
- `channel:manage:redemptions` - Pour gérer les récompenses (optionnel)
- `user:read:email` - Pour l'authentification de base

### 3. Configuration du Fichier .env

Mettez à jour votre fichier `.env` avec vos informations Twitch :

```env
# Configuration Twitch
TWITCH_ENABLED=true
TWITCH_CLIENT_ID=votre_client_id
TWITCH_CLIENT_SECRET=votre_client_secret
TWITCH_USERNAME=votre_nom_utilisateur
TWITCH_OAUTH_TOKEN=oauth:votre_token_oauth
TWITCH_CHANNEL=votre_chaine
```

> **Important** : Le token OAuth doit commencer par `oauth:` (ex: `oauth:abc123def456`)

## 🎮 Création des Récompenses sur Twitch

### 1. Accéder au Dashboard

1. Allez sur [dashboard.twitch.tv](https://dashboard.twitch.tv)
2. Sélectionnez **"Paramètres" > "Points de chaîne"**
3. Cliquez sur **"Ajouter une nouvelle récompense personnalisée"**

### 2. Exemples de Récompenses Recommandées

| Nom de la Récompense | Coût | Effet Suggéré | Description |
|---------------------|------|---------------|-------------|
| ✨ Confetti Party | 100 | `tada` | Déclenche des confettis à l'écran |
| ⚡ Screen Flash | 50 | `flash` | Flash lumineux sur l'écran |
| 📳 Shake Screen | 75 | `shake` | Secoue l'écran du streamer |
| 🔍 Zoom Effect | 80 | `zoom` | Effet de zoom sur l'overlay |
| 🏀 Bounce | 60 | `bounce` | Effet de rebond |
| 💓 Pulse | 90 | `pulse` | Effet de pulsation |

### 3. Paramètres Recommandés

- **Temps de recharge** : 30-60 secondes
- **Limite d'utilisateur** : 1 fois par stream ou par heure
- **Ignorer les demandes en file d'attente** : Activé
- **Nécessite une saisie de texte** : Optionnel

## ⚙️ Configuration dans l'Interface Admin

### 1. Accéder à l'Onglet Channel Points

1. Ouvrez l'interface admin : `http://localhost:3000/admin.html`
2. Cliquez sur l'onglet **"💎 Channel Points"**

### 2. Démarrer la Surveillance

1. Vérifiez que le statut indique **"Configuré"**
2. Cliquez sur **"🚀 Démarrer"** pour activer la surveillance
3. Le statut devrait passer à **"Actif"**

### 3. Configurer les Effets

1. Cliquez sur **"🔄 Actualiser"** pour charger vos récompenses Twitch
2. Pour chaque récompense, sélectionnez l'effet à déclencher :
   - **✨ Tada** : Confettis + animation célébration
   - **⚡ Flash** : Flash blanc sur l'écran
   - **🔍 Zoom** : Effet de zoom
   - **📳 Shake** : Secousse de l'écran
   - **🏀 Bounce** : Effet de rebond
   - **💓 Pulse** : Pulsation
3. Cliquez sur **"💾 Sauvegarder Configuration"**

## 🧪 Test des Effets

### 1. Test Manuel

Dans l'onglet Channel Points :

1. Sélectionnez un effet dans la liste déroulante
2. Entrez un nom d'utilisateur de test
3. Entrez un nom de récompense
4. Cliquez sur **"▶️ Tester Effet"**

L'effet devrait apparaître sur votre overlay OBS et dans votre interface viewer.

### 2. Test en Direct

1. Demandez à un viewer de racheter une récompense
2. Vérifiez que l'effet se déclenche automatiquement
3. L'événement devrait apparaître dans les **"Événements Récents"**

## 🎨 Intégration avec OBS

### 1. Ajouter l'Overlay

Si ce n'est pas déjà fait :

1. Ajoutez une source **"Navigateur"** dans OBS
2. URL : `http://localhost:3000/overlay/`
3. Largeur : 1920, Hauteur : 1080
4. CSS personnalisé : `body { background-color: rgba(0, 0, 0, 0); }`

### 2. Configuration de la Source

- **Actualiser la page navigateur quand la scène devient active** : ✅
- **Contrôler l'audio via OBS** : ✅
- **Fermer la source quand non visible** : ❌

## 🔧 Détection Automatique des Effets

Le système détecte automatiquement les effets basés sur le nom des récompenses :

### Mots-clés pour Tada (Confettis)
- `confetti`, `celebration`, `fête`, `bravo`, `tada`

### Mots-clés pour Flash
- `flash`, `éclair`, `lumière`, `light`

### Mots-clés pour Zoom
- `zoom`, `focus`, `loupe`

### Mots-clés pour Shake
- `shake`, `tremble`, `secoue`

### Mots-clés pour Bounce
- `bounce`, `rebond`, `saut`

### Mots-clés pour Pulse
- `pulse`, `battement`, `coeur`

### Détection par Coût

Si aucun mot-clé n'est trouvé :
- **≥ 1000 points** → Tada
- **≥ 500 points** → Pulse
- **≥ 100 points** → Bounce
- **< 100 points** → Flash

## 📊 Surveillance et Logs

### 1. Statut de Surveillance

L'interface admin affiche :
- **Surveillance** : Actif/Inactif
- **Effets configurés** : Nombre de mappings
- **Événements traités** : Nombre d'événements récents

### 2. Journal des Événements

Chaque rachat Channel Points est enregistré avec :
- **Type** : LIVE ou TEST
- **Utilisateur** : Nom du viewer
- **Récompense** : Nom de la récompense
- **Effet** : Effet déclenché
- **Heure** : Timestamp

### 3. Nettoyage

Cliquez sur **"🗑️ Nettoyer"** pour supprimer les anciens événements et libérer la mémoire.

## ⚠️ Dépannage

### Problème : "Channel Points non initialisé"

**Solutions :**
1. Vérifiez que `TWITCH_ENABLED=true` dans le `.env`
2. Vérifiez vos `TWITCH_CLIENT_ID` et `TWITCH_OAUTH_TOKEN`
3. Redémarrez le serveur

### Problème : "Permissions insuffisantes"

**Solutions :**
1. Vérifiez que votre token OAuth a les bons scopes
2. Régénérez le token sur [twitchtokengenerator.com](https://twitchtokengenerator.com)
3. Assurez-vous d'être Affilié/Partenaire Twitch

### Problème : "Aucune récompense trouvée"

**Solutions :**
1. Créez des récompenses sur dashboard.twitch.tv
2. Activez les récompenses créées
3. Vérifiez que le nom de chaîne est correct dans la config

### Problème : Les effets ne se déclenchent pas

**Solutions :**
1. Vérifiez que la surveillance est active
2. Testez manuellement depuis l'admin
3. Vérifiez les logs du serveur
4. Assurez-vous que l'overlay OBS est configuré

## 🔄 Fréquence de Vérification

Le système vérifie les nouveaux rachats toutes les **5 secondes**. Les effets sont déclenchés immédiatement après détection.

## 📈 Optimisation

### Performances

- Les événements sont nettoyés automatiquement (max 1000 en mémoire)
- Le polling s'arrête si Twitch est désactivé
- Les requêtes API sont limitées pour éviter le rate limiting

### Personnalisation

Vous pouvez modifier les mappings automatiques dans le code :
```javascript
// Dans server/twitch-channel-points.js, ligne ~75
this.rewardEffects = new Map([
  ['votre-mot-cle', 'effet-souhaite'],
  // Ajoutez vos mappings personnalisés
]);
```

## 🎯 Bonnes Pratiques

1. **Coûts équilibrés** : Ne rendez pas les effets trop chers ou trop bon marché
2. **Cooldowns** : Utilisez des temps de recharge pour éviter le spam
3. **Limites** : Limitez l'usage par utilisateur
4. **Tests réguliers** : Testez avant chaque stream
5. **Modération** : Surveillez l'usage et ajustez si nécessaire

## 🆘 Support

En cas de problème :

1. Vérifiez les logs serveur
2. Testez la connexion Twitch dans l'onglet **"Twitch"**
3. Utilisez l'outil de test d'effets
4. Consultez la documentation Twitch API

---

**Profitez de vos Channel Points interactifs ! 🎉**