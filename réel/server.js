const http = require("http").createServer();
const io = require("socket.io")(http, {
    cors: { origin: "*" }
});

// ─── Configuration ───────────────────────────────────────────────
const ADMIN_PIN    = "1234";
const ADMIN_SECRET = "tuaslebonmdp!BG!tuesunadmin";

// ─── Stockage ────────────────────────────────────────────────────
let parties = {};

// ─── Utilitaires ─────────────────────────────────────────────────

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return parties[code] ? generateRoomCode() : code;
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function generateRoles(count) {
    let roles = [];
    if (count >= 10)     roles.push("Loup-Garou", "Loup-Garou", "Loup-Garou");
    else if (count >= 6) roles.push("Loup-Garou", "Loup-Garou");
    else                 roles.push("Loup-Garou");
    roles.push("Voyante", "Sorciere");
    if (count >= 7) roles.push("Cupidon");
    if (count >= 8) roles.push("Petite-Fille");
    while (roles.length < count) roles.push("Villageois");
    return shuffle(roles);
}

function getRoomPlayers(code) {
    if (!parties[code]) return [];
    return Object.entries(parties[code].players).map(([id, pseudo]) => ({
        id,
        pseudo,
        vivant:   parties[code].alive[id] !== false,
        connecte: parties[code].connecte[id] !== false
    }));
}

function broadcastEtatRooms() {
    const etat = Object.entries(parties).map(([code, r]) => ({
        code,
        phase: r.state,
        awaitingWitch: r.awaitingWitch || false,
        joueurs: Object.entries(r.players).map(([id, pseudo]) => ({
            id,
            nom:      pseudo,
            role:     r.roles[id] || null,
            vivant:   r.alive[id] !== false,
            connecte: r.connecte[id] !== false
        }))
    }));
    io.sockets.sockets.forEach(s => {
        if (s.isAdmin) s.emit("etat_rooms", etat);
    });
}

// ─── Conditions de victoire ──────────────────────────────────────

function checkWinCondition(code) {
    const r = parties[code];
    if (!r) return true;
    const vivants    = Object.keys(r.players).filter(id => r.alive[id] !== false);
    const loups      = vivants.filter(id => r.roles[id] === "Loup-Garou");
    const villageois = vivants.filter(id => r.roles[id] !== "Loup-Garou");
    if (loups.length === 0) {
        io.to(code).emit("game-over", { winner: "village", message: "Le Village a gagné ! Tous les loups sont éliminés." });
        r.state = "ended"; broadcastEtatRooms(); return true;
    }
    if (loups.length >= villageois.length) {
        io.to(code).emit("game-over", { winner: "loups", message: "Les Loups-Garous ont gagné ! Ils dominent le village." });
        r.state = "ended"; broadcastEtatRooms(); return true;
    }
    return false;
}

// ─── Mort d'un joueur ────────────────────────────────────────────

function killPlayer(code, targetId, cause) {
    const r = parties[code];
    if (!r || r.alive[targetId] === false) return false;
    r.alive[targetId] = false;
    io.to(code).emit("player-killed", { id: targetId, pseudo: r.players[targetId], role: r.roles[targetId], cause });
    io.to(targetId).emit("you-died", { cause, role: r.roles[targetId] });
    if (r.lovers && (r.lovers[0] === targetId || r.lovers[1] === targetId)) {
        const partnerId = r.lovers[0] === targetId ? r.lovers[1] : r.lovers[0];
        if (r.alive[partnerId] !== false) setTimeout(() => killPlayer(code, partnerId, "amour"), 1000);
    }
    broadcastEtatRooms();
    return true;
}

// ─── Phases ──────────────────────────────────────────────────────

// La nuit commence — PAS de timer, l'admin clique "Suivant" pour résoudre
function startNightPhase(code) {
    const r = parties[code];
    if (!r) return;
    r.state = "night"; r.wolfVotes = {}; r.nightActions = {};
    r.awaitingWitch = false; r.wolfTarget = null;
    r.voyanteUsed = false;   // réinitialisé chaque nuit

    // On émet sans durée — le client n'affiche plus de compte à rebours
    io.to(code).emit("phase", { phase: "night" });

    const loups = Object.keys(r.players).filter(id => r.roles[id] === "Loup-Garou" && r.alive[id] !== false);
    loups.forEach(id => io.to(id).emit("wolf-team", loups.map(wid => ({ id: wid, pseudo: r.players[wid] }))));
    broadcastEtatRooms();
}

// Résolution de nuit déclenchée par l'admin ("Suivant")
function resolveNight(code) {
    const r = parties[code];
    if (!r || r.state !== "night") return;

    let wolfTarget = null;
    if (Object.keys(r.wolfVotes).length > 0) {
        const counts = {};
        Object.values(r.wolfVotes).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
        wolfTarget = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }

    const witchId = Object.keys(r.players).find(id => r.roles[id] === "Sorciere" && r.alive[id] !== false);

    // Si la sorcière est vivante et qu'il y a une cible, on lui passe la main
    // L'admin devra cliquer "Suivant sorcière" pour continuer
    if (witchId && wolfTarget) {
        io.to(witchId).emit("witch-turn", {
            target: wolfTarget, targetPseudo: r.players[wolfTarget],
            antidote: r.witch.antidote, poison: r.witch.poison,
            alivePlayers: getRoomPlayers(code).filter(p => p.vivant && p.id !== witchId)
        });
        r.awaitingWitch = true;
        r.wolfTarget = wolfTarget;
        broadcastEtatRooms(); // l'admin voit que awaitingWitch = true
    } else {
        applyNightResults(code, wolfTarget, null, null);
    }
}

function applyNightResults(code, wolfTarget, antidoteUsed, poisonTarget) {
    const r = parties[code];
    if (!r) return;
    r.awaitingWitch = false;

    const deaths = [];
    if (wolfTarget && !antidoteUsed) if (killPlayer(code, wolfTarget, "loups")) deaths.push(wolfTarget);
    if (poisonTarget)                if (killPlayer(code, poisonTarget, "poison")) deaths.push(poisonTarget);
    if (deaths.length === 0) io.to(code).emit("no-death-night");

    if (!checkWinCondition(code)) startDayPhase(code);
}

// Le jour commence — PAS de timer, l'admin clique "Suivant" pour résoudre le vote
function startDayPhase(code) {
    const r = parties[code];
    if (!r) return;
    r.state = "day"; r.votes = {};

    // On émet sans durée
    io.to(code).emit("phase", { phase: "day" });
    io.to(code).emit("players-update", getRoomPlayers(code));
    broadcastEtatRooms();
}

// Résolution du vote déclenchée par l'admin ("Suivant")
function resolveVote(code) {
    const r = parties[code];
    if (!r || r.state !== "day") return;

    if (Object.keys(r.votes).length === 0) {
        io.to(code).emit("vote-result", { eliminated: null, message: "Personne n'a été éliminé." });
        if (!checkWinCondition(code)) startNightPhase(code);
        return;
    }

    const counts = {};
    Object.values(r.votes).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
        io.to(code).emit("vote-result", { eliminated: null, message: "Égalité ! Personne n'est éliminé." });
        if (!checkWinCondition(code)) startNightPhase(code);
        return;
    }

    const eliminatedId = sorted[0][0];
    killPlayer(code, eliminatedId, "vote");
    io.to(code).emit("vote-result", {
        eliminated: eliminatedId,
        pseudo: r.players[eliminatedId],
        role: r.roles[eliminatedId],
        votes: sorted
    });

    setTimeout(() => { if (!checkWinCondition(code)) startNightPhase(code); }, 3000);
}

// ─── Socket.io ───────────────────────────────────────────────────

io.on("connection", (socket) => {
    console.log("Connexion :", socket.id);

    // ── Auth admin ────────────────────────────

    socket.on("admin_pin", (pin) => {
        if (String(pin).trim() !== String(ADMIN_PIN).trim()) return socket.emit("admin_pin_refuse");
        socket.emit("admin_pin_ok", ADMIN_SECRET);
    });

    socket.on("admin_auth", (secret) => {
        if (secret !== ADMIN_SECRET) return socket.emit("admin_refuse");
        socket.isAdmin = true;
        socket.emit("admin_ok");
        broadcastEtatRooms();
        console.log("Admin authentifié :", socket.id);
    });

    // ── Actions admin ─────────────────────────

    socket.on("admin_creer_room", ({ codePartie }) => {
        if (!socket.isAdmin) return;
        if (!parties[codePartie]) {
            parties[codePartie] = {
                players: {}, roles: {}, alive: {}, connecte: {},
                votes: {}, wolfVotes: {}, nightActions: {},
                witch: { antidote: true, poison: true },
                lovers: null, state: "waiting", master: null,
                awaitingWitch: false, wolfTarget: null
            };
        }
        broadcastEtatRooms();
    });

    socket.on("admin_ejecter", ({ codePartie, nom }) => {
        if (!socket.isAdmin) return;
        const r = parties[codePartie];
        if (!r) return;
        const entry = Object.entries(r.players).find(([, p]) => p === nom);
        if (entry) {
            const [id] = entry;
            io.to(id).emit("ejection");
            io.sockets.sockets.get(id)?.leave(codePartie);
            delete r.players[id]; delete r.roles[id]; delete r.alive[id]; delete r.connecte[id];
        }
        io.to(codePartie).emit("players-update", getRoomPlayers(codePartie));
        broadcastEtatRooms();
    });

    socket.on("admin_lancer_partie", ({ codePartie }) => {
        if (!socket.isAdmin) return;
        const r = parties[codePartie];
        if (!r) return;
        const playerIDs = Object.keys(r.players);
        if (playerIDs.length < 4) return socket.emit("error", "Il faut au moins 4 joueurs.");
        const roles = generateRoles(playerIDs.length);
        playerIDs.forEach((id, i) => {
            r.roles[id] = roles[i];
            r.alive[id] = true;
            io.to(id).emit("your-role", { role: roles[i] });
        });
        io.to(codePartie).emit("game-started");
        startNightPhase(codePartie);
    });

    // ── "Suivant" — résout la phase en cours et passe à la suivante ──
    socket.on("admin_suivant", ({ codePartie }) => {
        if (!socket.isAdmin) return;
        const r = parties[codePartie];
        if (!r) return;

        if (r.state === "night") {
            // Si la sorcière attend encore, on skip son tour et on applique
            if (r.awaitingWitch) {
                applyNightResults(codePartie, r.wolfTarget, null, null);
            } else {
                resolveNight(codePartie);
            }
        } else if (r.state === "day") {
            resolveVote(codePartie);
        }
    });

    // Forcer une phase spécifique (override manuel)
    socket.on("admin_phase", ({ codePartie, phase }) => {
        if (!socket.isAdmin) return;
        const r = parties[codePartie];
        if (!r) return;
        if (phase === "nuit") startNightPhase(codePartie);
        else if (phase === "jour") startDayPhase(codePartie);
    });

    socket.on("admin_tuer", ({ codePartie, joueurId, cause }) => {
        if (!socket.isAdmin) return;
        killPlayer(codePartie, joueurId, cause || "admin");
        if (!checkWinCondition(codePartie)) broadcastEtatRooms();
    });

    socket.on("admin_ressusciter", ({ codePartie, joueurId }) => {
        if (!socket.isAdmin) return;
        const r = parties[codePartie];
        if (!r) return;
        r.alive[joueurId] = true;
        io.to(codePartie).emit("players-update", getRoomPlayers(codePartie));
        broadcastEtatRooms();
    });

    socket.on("admin_changer_role", ({ codePartie, joueurId, role }) => {
        if (!socket.isAdmin) return;
        const r = parties[codePartie];
        if (!r) return;
        r.roles[joueurId] = role;
        io.to(joueurId).emit("your-role", { role });
        broadcastEtatRooms();
    });

    // Passer le tour de la sorcière manuellement (alias de admin_suivant quand awaitingWitch)
    socket.on("admin_skip_sorciere", ({ codePartie }) => {
        if (!socket.isAdmin) return;
        const r = parties[codePartie];
        if (!r || !r.awaitingWitch) return;
        applyNightResults(codePartie, r.wolfTarget, null, null);
    });

    socket.on("admin_supprimer_room", ({ codePartie }) => {
        if (!socket.isAdmin) return;
        if (parties[codePartie]) {
            io.to(codePartie).emit("ejection");
            delete parties[codePartie];
        }
        broadcastEtatRooms();
    });

    // ── Joueurs ───────────────────────────────

    socket.on("create-room", (pseudo) => {
        if (!pseudo?.trim()) return socket.emit("error", "Pseudo requis.");
        const code = generateRoomCode();
        parties[code] = {
            players: {}, roles: {}, alive: {}, connecte: {},
            votes: {}, wolfVotes: {}, nightActions: {},
            witch: { antidote: true, poison: true },
            lovers: null, state: "waiting", master: socket.id,
            awaitingWitch: false, wolfTarget: null
        };
        parties[code].players[socket.id]  = pseudo.trim();
        parties[code].alive[socket.id]    = true;
        parties[code].connecte[socket.id] = true;
        socket.join(code); socket.data.room = code; socket.data.pseudo = pseudo.trim();
        socket.emit("room-created", code);
        io.to(code).emit("players-update", getRoomPlayers(code));
        broadcastEtatRooms();
    });

    socket.on("join-room", ({ codePartie, pseudo }) => {
        if (!parties[codePartie]) return socket.emit("error", "Room introuvable.");
        if (!pseudo?.trim())      return socket.emit("error", "Pseudo requis.");
        const r = parties[codePartie];
        const existing = Object.entries(r.players).find(([, p]) => p === pseudo.trim());
        if (existing) {
            const [oldId] = existing;
            r.players[socket.id]  = r.players[oldId];
            r.roles[socket.id]    = r.roles[oldId];
            r.alive[socket.id]    = r.alive[oldId];
            r.connecte[socket.id] = true;
            if (oldId !== socket.id) {
                delete r.players[oldId]; delete r.roles[oldId]; delete r.alive[oldId]; delete r.connecte[oldId];
                if (r.master === oldId) r.master = socket.id;
                if (r.lovers) r.lovers = r.lovers.map(id => id === oldId ? socket.id : id);
                if (r.votes[oldId])     { r.votes[socket.id] = r.votes[oldId]; delete r.votes[oldId]; }
                if (r.wolfVotes[oldId]) { r.wolfVotes[socket.id] = r.wolfVotes[oldId]; delete r.wolfVotes[oldId]; }
            }
            socket.join(codePartie); socket.data.room = codePartie; socket.data.pseudo = pseudo.trim();
            socket.emit("join-success", codePartie);
            socket.emit("your-role", { role: r.roles[socket.id] });
            socket.emit("reconnecte", { role: r.roles[socket.id], phase: r.state });
            io.to(codePartie).emit("players-update", getRoomPlayers(codePartie));
            broadcastEtatRooms(); return;
        }
        if (r.state !== "waiting") return socket.emit("error", "Partie déjà commencée.");
        r.players[socket.id]  = pseudo.trim();
        r.alive[socket.id]    = true;
        r.connecte[socket.id] = true;
        socket.join(codePartie); socket.data.room = codePartie; socket.data.pseudo = pseudo.trim();
        socket.emit("join-success", codePartie);
        io.to(codePartie).emit("players-update", getRoomPlayers(codePartie));
        broadcastEtatRooms();
    });

    socket.on("check-room", (code) => {
        if (parties[code]) socket.emit("room-valid");
        else               socket.emit("room-invalid");
    });

    socket.on("vote", ({ room, target }) => {
        const r = parties[room];
        if (!r || r.state !== "day" || r.alive[socket.id] === false || r.alive[target] === false) return;
        r.votes[socket.id] = target;
        io.to(room).emit("vote-update", { votes: r.votes, players: r.players });
        // On ne résout plus automatiquement — l'admin décide avec "Suivant"
    });

    socket.on("wolf-vote", ({ room, target }) => {
        const r = parties[room];
        if (!r || r.state !== "night" || r.roles[socket.id] !== "Loup-Garou" || r.alive[socket.id] === false) return;
        r.wolfVotes[socket.id] = target;
        // On n'auto-résout plus — l'admin décide avec "Suivant"
        io.to(room).emit("wolf-vote-update", {
            votesCount: Object.keys(r.wolfVotes).length,
            wolvesCount: Object.keys(r.players).filter(id => r.roles[id] === "Loup-Garou" && r.alive[id] !== false).length
        });
    });

    socket.on("voyante-check", ({ room, target }) => {
        const r = parties[room];
        if (!r || r.roles[socket.id] !== "Voyante" || r.alive[socket.id] === false) return;
        if (r.voyanteUsed) return socket.emit("error", "Tu as déjà utilisé ton pouvoir cette nuit.");
        if (!r.players[target] || r.alive[target] === false) return socket.emit("error", "Cible invalide.");
        r.voyanteUsed = true;
        socket.emit("voyante-result", { pseudo: r.players[target], role: r.roles[target] });
    });

    socket.on("cupidon-link", ({ room, lovers }) => {
        const r = parties[room];
        if (!r || r.roles[socket.id] !== "Cupidon" || r.lovers) return;
        r.lovers = lovers;
        lovers.forEach(id => {
            const partnerId = lovers.find(l => l !== id);
            io.to(id).emit("you-are-lovers", { partner: r.players[partnerId] });
        });
    });

    socket.on("witch-action", ({ room, antidote, poisonTarget }) => {
        const r = parties[room];
        if (!r || r.roles[socket.id] !== "Sorciere" || !r.awaitingWitch) return;
        // Vérifier que les potions demandées sont encore disponibles
        if (antidote && !r.witch.antidote) return socket.emit("error", "L'antidote a déjà été utilisé.");
        if (poisonTarget && !r.witch.poison) return socket.emit("error", "Le poison a déjà été utilisé.");
        // Consommer immédiatement pour bloquer tout doublon
        r.awaitingWitch = false;
        if (antidote)    r.witch.antidote = false;
        if (poisonTarget) r.witch.poison  = false;
        applyNightResults(room, r.wolfTarget, antidote, poisonTarget);
    });

    socket.on("disconnect", () => {
        for (const code in parties) {
            const r = parties[code];
            if (r.players[socket.id]) {
                r.connecte[socket.id] = false;
                io.to(code).emit("joueur_deconnecte", r.players[socket.id]);
                broadcastEtatRooms(); break;
            }
        }
    });
});

http.listen(3000, () => {
    console.log("Serveur lancé sur http://192.168.1.21:3000");
});