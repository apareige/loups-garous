# Cahier des Charges – Loup-Garou Web en Local

**Projet :** Jeu Loup-Garou en ligne via site web multiplateforme, hébergé en interne  
**Porté par :** Ivan Pilorget  
**Date :** 13/03/2026

---

## Table des matières

1. [Contexte & Objectifs](#1-contexte--objectifs)
2. [Périmètre Fonctionnel](#2-périmètre-fonctionnel)
3. [Périmètre Technique](#3-périmètre-technique)
4. [Livrables Attendus](#4-livrables-attendus)
5. [Schéma Réseau](#5-schéma-réseau)
6. [Planning Prévisionnel](#6-planning-prévisionnel)
7. [Risques & Contraintes](#7-risques--contraintes)

---

## 1. Contexte & Objectifs

**Problématique :** Permettre aux joueurs de jouer au Loup-Garou en face-à-face, en utilisant un site web mobile-friendly pour la distribution des rôles et les actions nocturnes, sans rester scotchés à leur écran.

**Objectifs :**

- Site web responsive (PC, tablette, smartphone) pour gérer les parties.
- Hébergement interne : serveur local + point d'accès Wi-Fi.
- Interaction humaine : débat et votes à l'oral, seul le site gère les rôles (informations et actions) et les actions secrètes.

---

## 2. Périmètre Fonctionnel

### A. Site Web (multiplateforme)

| Fonctionnalité | Description |
|---|---|
| Création de parties | L'administrateur crée une partie, ajoute les joueurs, choisit les rôles. |
| Distribution des rôles | Attribution aléatoire et secrète des rôles aux joueurs connectés. |
| Affichage du rôle | Chaque joueur voit uniquement son rôle sur son appareil. |
| Actions nocturnes | Interface pour les rôles actifs (loup-garou, voyante, etc.) pendant la nuit. |
| Historique des actions | Suivi des victimes, votes, et événements de la partie. |
| Tableau de bord admin | Gestion des parties en cours, des joueurs, et des rôles. |
| Mode spectateur | Affichage public (vidéoprojecteur/TV) pour suivre la partie en direct. |

---

## 3. Périmètre Technique

### A. Technologies

| Composant | Technologie(s) proposée(s) |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (React ou Vue.js) — servi via Apache2 |
| Backend | Node.js (Express) |
| Base de données | MariaDB |
| Communication | WebSocket (Socket.io) pour le temps réel |
| Hébergement | PC avec une machine virtuelle Debian 12 |
| Réseau | Point d'accès Wi-Fi dédié pour isoler le jeu du réseau principal |

### B. Matériel

| Élément | Spécifications recommandées |
|---|---|
| Serveur | Raspberry Pi 4 (4 Go RAM) ou mini-PC sous Linux |
| Point d'accès Wi-Fi | Routeur dédié (ex : TP-Link, Netgear) ou mode point d'accès du serveur |
| Stockage | Carte SD (Raspberry) ou SSD (PC) |

### C. Architecture

- **Frontend :** Site web responsive, compatible tous navigateurs modernes, servi via Apache2.
- **Backend :** Node.js + Socket.io pour la communication temps réel.
- **Base de données :** MariaDB pour stocker les parties, joueurs et rôles.
- **Réseau :** Le serveur et le point d'accès Wi-Fi forment un réseau local dédié au jeu.

---

## 4. Livrables Attendus

- **Site web :** Accessible via navigateur sur le réseau local (adresse IP ou nom de domaine local).
- **Documentation :** Guide d'installation, manuel utilisateur, schémas réseau.
- **Code source :** Dépôt Git avec le code commenté.
- **Script de déploiement :** Pour installer facilement le site sur le serveur.

---

## 5. Schéma Réseau

[Voir le schéma réseau (Google Drive)](https://drive.google.com/file/d/1xF7j5Pa6w38LRumt-0bvtAgWB4EczpEt/view?usp=sharing)

---

## 6. Planning Prévisionnel

| Étape | Durée estimée | Livrable |
|---|---|---|
| Spécifications détaillées | 1 semaine | Cahier des charges finalisé |
| Setup serveur & réseau | 2 jours | Serveur + Wi-Fi opérationnels |
| Développement backend | 2 semaines | API Node.js + base de données |
| Développement frontend | 3 semaines | Site web responsive |
| Tests & corrections | 1 semaine | Version stable |

---

## 7. Risques & Contraintes

### Risques

- Latence réseau si trop de joueurs connectés simultanément.
- Gestion des reconnexions en cas de perte de signal Wi-Fi.

### Contraintes

- Nécessité d'un point d'accès Wi-Fi performant pour éviter les coupures.
- Compatibilité navigateurs : tester sur Chrome, Firefox, Safari.
