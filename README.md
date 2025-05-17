# 🎬 Stream 24h – Système interactif en temps réel pour Twitch

Bienvenue sur le dépôt du **système de gestion de stream 24h interactif**, utilisé pour animer et structurer un live Twitch événementiel (passage affilié, marathon, anniversaire, etc.).

Ce projet a été conçu pour permettre à un streamer de :
- Planifier et visualiser chaque moment du live,
- Gérer une cagnotte en temps réel (dons & subs),
- Interagir avec les viewers via des effets visuels et des messages dynamiques,
- Garder une trace claire de l'évolution du stream.

---

## 🧱 Fonctionnalités principales

### 🧠 Planning du stream
- Interface admin complète (heure, nom, statut)
- Ajout / suppression de lignes dynamiquement
- Synchronisation en temps réel avec l’overlay OBS

### 💰 Gestion de cagnotte
- Montant de dons & objectif
- Nombre de subs & objectif
- Mise à jour via interface admin
- Affichage live dans OBS via `status.html`

### ⚡ Interactions en direct
- Envoi de messages à l’écran (type "Merci les viewers !")
- Déclenchement d’effets visuels (flash, tada, boom, etc.)
- Réception dans `overlay.html` via WebSocket

---

## 📂 Arborescence

