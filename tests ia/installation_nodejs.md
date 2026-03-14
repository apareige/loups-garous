# Installation de Node.js et de ses composants pour un serveur web

Ce guide a été testé sur une machine virtuelle **Linux Debian 12**. Les étapes suivantes devraient fonctionner sans problème.

## Étapes d'installation

1. **Mettre à jour les paquets** :
   ```bash
    sudo apt update
    sudo apt upgrade
2. **Installer Node.js et npm :** :
   ```bash
    sudo apt install nodejs npm
3. **Installer Socket.IO (pour la gestion des communications en temps réel)** :
   ```bash
    npm install socket.io

