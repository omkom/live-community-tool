# Channel Points Administration Guide

Cette documentation décrit toutes les fonctionnalités **Channel Points** disponibles dans l'interface d'administration.

## Aperçu

L'onglet **Channel Points** se trouve dans la barre d'onglets de l'admin (après Twitch). Il permet de configurer, tester et surveiller les récompenses Twitch Channel Points.

## Sections Principales

1. **Statut & Surveillance**
   - Démarrer / Arrêter la surveillance des récompenses
   - Affiche le statut (connecté, surveillé), le nombre d'effets configurés et d'événements traités

2. **Configuration des Récompenses**
   - Liste des récompenses disponibles
   - Choix manuel de l'effet déclenché pour chaque récompense
   - Sauvegarde des mappings récompense→effet

3. **Test des Effets**
   - Tester un effet classique (perturbation, confetti, flash, zoom, etc.)
   - Tester un effet quantique (effondrement, recul temporel, collapse cognitif, etc.)

4. **Configuration Avancée**
   - **Auto-configurer** : suggestions d'effets basées sur mots-clés et coûts
   - **Configuration Rapide** : initialisation, configuration et démarrage de la surveillance en une seule action
   - **Créer Récompenses Défaut** : ajoute un jeu de récompenses prédéfini sur la chaîne

5. **Diagnostic & Métriques**
   - **Diagnostic** : état complet (OAuth Twitch, Channel Points, système)
   - **Métriques** : statistiques runtime (uptime, mémoire, CPU, intervalles de sondage...)

6. **Événements**
   - **Événements Récents** : flux live des rédemptions de Channel Points
   - **Historique Événements** : liste paginée des dernières rédemptions

## API Channel Points

| Endpoint                                   | Méthode | Description                                               |
|--------------------------------------------|--------|-----------------------------------------------------------|
| `/api/channel-points/status`               | GET    | Statut général (surveillance, configuration)              |
| `/api/channel-points/monitoring/:action`   | POST   | `start` / `stop` la surveillance                           |
| `/api/channel-points/rewards`              | GET    | Liste des récompenses                                     |
| `/api/channel-points/configure`            | POST   | Sauvegarde des mappings                                   |
| `/api/channel-points/test-effect`          | POST   | Test d'un effet classique                                 |
| `/api/channel-points/cleanup`              | POST   | Nettoyage du flux d'événements                            |
| `/api/channel-points/auto-configure`       | POST   | Configuration automatique                                  |
| `/api/channel-points/quick-setup`          | POST   | Configuration rapide (init + auto-config + start)         |
| `/api/channel-points/create-default-rewards`| POST   | Création d'un set de récompenses par défaut               |
| `/api/channel-points/events`               | GET    | Récupère l'historique (param `limit`)                     |
| `/api/channel-points/diagnostic`           | GET    | Diagnostic complet (OAuth, Channel Points, système)       |
| `/api/channel-points/metrics`              | GET    | Métriques runtime (cpu, mémoire, intervalles)             |
| `/api/channel-points/effects`              | GET    | Liste des effets classiques & quantiques                   |
| `/api/channel-points/test-quantum-effect`  | POST   | Test d'un effet quantique                                 |

_Cette documentation fait partie de l'interface d'administration. Pour plus d'informations, voir README.md._