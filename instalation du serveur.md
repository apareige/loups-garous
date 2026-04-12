# Installation du serveur web

## Installation d'Apache2 et PHP

```bash
apt install apache2 php
```

## Installation de Node.js et npm

```bash
apt install nodejs npm
```

## Installation de socket.io pour le temps réel

```bash
npm install socket.io
```

## Mise en place des fichiers (HTML, CSS, ...)

Tous les fichiers sont à mettre dans `/var/www/` et pour un gain de temps nous allons réutiliser le fichier de configuration par défaut d'Apache2 `000-default.conf`, donc la page principale doit s'appeler `index.html`. Si le fichier principal est en PHP, il est possible de mettre à jour le fichier de configuration par défaut :

```bash
nano /etc/apache2/sites-available/000-default.conf
```

```bash
<VirtualHost *:80>
        #ServerName www.example.com

        ServerAdmin webmaster@localhost
        DocumentRoot /var/www/html
        DirectoryIndex index.php # <-- ligne à ajouter

        ErrorLog ${APACHE_LOG_DIR}/error.log
        CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

Pour que les fichiers aient bien les bons droits :

```bash
chown -R www-data:www-data /var/www/html
```

Pour le serveur Node.js, le fichier serveur doit se trouver dans le dossier du projet, et pour lancer le serveur :

```bash
nodejs fichier_serveur.js
```
