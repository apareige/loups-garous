# 🐺 Loup-Garou — Jeu multijoueur

## Installation

```bash
npm install
node server.js
```

Ouvrir : http://localhost:3000

---

## Bugs corrigés

### 🔴 Serveur (server.js)

| Problème original | Correction |
|---|---|
| `shuffle()` biaisé avec `.sort(() => Math.random() - 0.5)` | Algorithme Fisher-Yates correct |
| Pas de validation du pseudo | Validation + trim sur tous les inputs |
| Pas de vérification minimum joueurs | Minimum 4 joueurs pour démarrer |
| `join-room` acceptait les parties déjà commencées | Vérification `state !== "waiting"` |
| Pas de canal "morts" pour le chat | Les morts chattent entre eux uniquement |
| Vote du village sans égalité gérée | Égalité → personne éliminé |
| Pas de condition de victoire | `checkWinCondition()` après chaque mort |
| Pas de phases nuit structurées | `startNightPhase()` → `resolveNight()` → `applyNightResults()` → `startDayPhase()` |
| Sorcière sans interaction | `witch-turn` envoyé, timer 20s, actions envoyées au serveur |
| Couple Cupidon non implémenté | Mort du partenaire si l'autre meurt |
| `alive` non initialisé | `rooms[room].alive[id] = true` à chaque join |
| Rooms jamais nettoyées | Suppression si vide après disconnect |
| Pas de sécurité sur les actions | Vérifications rôle + vivant sur chaque action |

### 🟡 Front-end

| Problème original | Correction |
|---|---|
| `room` et `pseudo` perdus après redirect | Passés en paramètres URL |
| `room.html` chargeait sans se connecter | `socket.emit("join-room")` dans `game.js` au chargement |
| `#deadScreen` jamais affiché (display:none sans flex) | Overlay complet avec animation |
| Timer non synchronisé | Timer côté client basé sur la durée envoyée par le serveur |
| Vote sans feedback | Compteurs de votes mis à jour en temps réel |
| Pas de gestion de Game Over | Overlay Game Over avec résultat |
| XSS possible dans le chat | `escapeHtml()` sur tous les messages |
| Interface inutilisable sur mobile | CSS responsive avec grid adaptatif |
| Actions nuit non connectées | Loups votent, voyante consulte, sorcière agit, cupidon lie |

---

## Structure

```
loup-garou/
├── server.js          ← Serveur Node.js + Socket.io
├── package.json
└── public/
    ├── index.html     ← Page accueil
    ├── room.html      ← Interface de jeu
    ├── css/style.css  ← Style complet
    └── js/
        ├── socket.js  ← Connexion + navigation
        ├── game.js    ← Logique de jeu complète
        ├── chat.js    ← Chat temps réel
        └── ui.js      ← Helpers UI
```