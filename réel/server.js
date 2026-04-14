const http = require("http").createServer();
const io = require("socket.io")(http, {
    cors: { origin: "*" }
});

const ADMIN_SECRET = "1234";

// Structure : on garde ton players{} mais on migre vers des rooms
let parties = {};
// Ex: parties["ABC"] = { joueurs: [], phase: "attente", votes: {} }

// Utilitaire : trouver la room d'un socket
function trouverRoom(socketId) {
    for (const code in parties) {
        const j = parties[code].joueurs.find(j => j.socketId === socketId);
        if (j) return { code, joueur: j };
    }
    return null;
}

// Utilitaire : envoyer l'état de toutes les rooms aux admins
function broadcastEtatRooms() {
    const etat = Object.entries(parties).map(([code, p]) => ({
        code,
        phase: p.phase,
        joueurs: p.joueurs.map(j => ({
            nom: j.nom,
            connecte: j.connecte,
            vivant: j.vivant,
            role: j.role
        }))
    }));
    io.sockets.sockets.forEach(s => {
        if (s.isAdmin) s.emit("etat_rooms", etat);
    });
}

io.on("connection", (socket) => {
    console.log("Connexion :", socket.id);

    // ─── ADMIN ────────────────────────────────────────────────

    socket.on("admin_auth", (secret) => {
        if (secret !== ADMIN_SECRET) return socket.emit("admin_refuse");
        socket.isAdmin = true;
        socket.emit("admin_ok");
        broadcastEtatRooms();
        console.log("Admin connecté");
    });

    socket.on("admin_ejecter", ({ codePartie, nom }) => {
        if (!socket.isAdmin) return;
        const partie = parties[codePartie];
        if (!partie) return;
        const joueur = partie.joueurs.find(j => j.nom === nom);
        if (joueur) {
            io.to(joueur.socketId).emit("ejection");
            io.sockets.sockets.get(joueur.socketId)?.leave(codePartie);
            partie.joueurs = partie.joueurs.filter(j => j.nom !== nom);
        }
        io.to(codePartie).emit("players", partie.joueurs);
        broadcastEtatRooms();
    });

    socket.on("admin_lancer_partie", ({ codePartie }) => {
        if (!socket.isAdmin) return;
        const partie = parties[codePartie];
        if (!partie || partie.joueurs.length < 2) return;
        // Attribution des rôles (1 loup pour 3 joueurs)
        const roles = ["loup"];
        while (roles.length < partie.joueurs.length) roles.push("villageois");
        roles.sort(() => Math.random() - 0.5);
        partie.joueurs.forEach((j, i) => j.role = roles[i]);
        partie.phase = "nuit";
        // Chaque joueur reçoit son rôle en privé
        partie.joueurs.forEach(j => {
            io.to(j.socketId).emit("role_assigne", j.role);
        });
        io.to(codePartie).emit("changement_phase", "nuit");
        broadcastEtatRooms();
        console.log("Partie lancée :", codePartie);
    });

    socket.on("admin_phase", ({ codePartie, phase }) => {
        if (!socket.isAdmin) return;
        const partie = parties[codePartie];
        if (!partie) return;
        partie.phase = phase;
        partie.votes = {}; // reset votes à chaque phase
        io.to(codePartie).emit("changement_phase", phase);
        broadcastEtatRooms();
    });

    socket.on("admin_supprimer_room", ({ codePartie }) => {
        if (!socket.isAdmin) return;
        io.to(codePartie).emit("ejection");
        delete parties[codePartie];
        broadcastEtatRooms();
    });

    socket.on("admin_creer_room", ({ codePartie }) => {
        if (!socket.isAdmin) return;
        if (!parties[codePartie]) {
            parties[codePartie] = { joueurs: [], phase: "attente", votes: {} };
            console.log("Room créée par l'admin :", codePartie);
        }
        broadcastEtatRooms();
    });

    // ─── JOUEURS ──────────────────────────────────────────────

    // Remplace ton ancien "join" — maintenant avec room + reconnexion
    socket.on("join", ({ pseudo, codePartie }) => {
        // Crée la room si elle n'existe pas
        if (!parties[codePartie]) {
            parties[codePartie] = { joueurs: [], phase: "attente", votes: {} };
        }
        const partie = parties[codePartie];

        // Reconnexion : le joueur existait déjà ?
        const existant = partie.joueurs.find(j => j.nom === pseudo);
        if (existant) {
            existant.socketId = socket.id;
            existant.connecte = true;
            socket.join(codePartie);
            socket.emit("reconnecte", {
                role: existant.role,
                phase: partie.phase,
                joueurs: partie.joueurs.map(j => ({ nom: j.nom, vivant: j.vivant, connecte: j.connecte }))
            });
            console.log(pseudo, "s'est reconnecté");
        } else {
            // Nouveau joueur
            partie.joueurs.push({
                nom: pseudo,
                socketId: socket.id,
                role: null,
                vivant: true,
                connecte: true
            });
            socket.join(codePartie);
            console.log(pseudo, "a rejoint la room", codePartie);
        }

        io.to(codePartie).emit("players", partie.joueurs);
        broadcastEtatRooms();
    });

    // Ton vote existant — adapté aux rooms
    socket.on("vote", (target) => {
        const found = trouverRoom(socket.id);
        if (!found) return;
        const { code, joueur } = found;
        const partie = parties[code];

        partie.votes[joueur.nom] = target;
        console.log(joueur.nom, "vote pour", target);

        io.to(code).emit("vote-update", {
            voter: joueur.nom,
            target: target
        });

        // Si tout le monde a voté, on annonce le résultat
        const vivants = partie.joueurs.filter(j => j.vivant);
        if (Object.keys(partie.votes).length >= vivants.length) {
            // Compte les votes
            const comptage = {};
            for (const v of Object.values(partie.votes)) {
                comptage[v] = (comptage[v] || 0) + 1;
            }
            const elimine = Object.entries(comptage).sort((a, b) => b[1] - a[1])[0][0];
            const joueurElimine = partie.joueurs.find(j => j.nom === elimine);
            if (joueurElimine) joueurElimine.vivant = false;

            io.to(code).emit("elimination", elimine);
            partie.votes = {};
            broadcastEtatRooms();
        }
    });

    // Déconnexion
    socket.on("disconnect", () => {
        const found = trouverRoom(socket.id);
        if (found) {
            found.joueur.connecte = false;
            console.log(found.joueur.nom, "s'est déconnecté");
            io.to(found.code).emit("joueur_deconnecte", found.joueur.nom);
            broadcastEtatRooms();
        }
    });
});

http.listen(3000, () => {
    console.log("Serveur Socket.io lancé sur http://192.168.1.21:3000");
});