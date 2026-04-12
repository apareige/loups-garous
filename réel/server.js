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
    // Dans serv.js (côté serveur)
    socket.on("admin_pin_attempt", (data) => {
        if (data.pin === process.env.ADMIN_PIN) {
            socket.emit("admin_pin_response", { success: true });
        } else {
            socket.emit("admin_pin_response", { success: false });
        }
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

    //room + reconnexion
    socket.on("join", ({ pseudo, codePartie }) => {
        // Crée la room si elle n'existe pas
        if (!parties[codePartie]) {
            return socket.emit("erreur", "Cette room n'existe pas.");
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




// ─── Stockage ────────────────────────────────────────────────────
// Parties[code] = {
//   players:     { socketId: pseudo }
//   roles:       { socketId: role }
//   alive:       { socketId: true/false }
//   votes:       { socketId: targetId }   (vote du jour)
//   wolfVotes:   { socketId: targetId }   (vote des loups)
//   nightActions: {}
//   witch:       { antidote: bool, poison: bool }
//   lovers:      [id1, id2] | null
//   state:       "waiting" | "night" | "day"
//   master:      socketId   (créateur de la room)
//   awaitingWitch: bool
//   wolfTarget:  socketId | null
//   nightTimer / dayTimer / witchTimer
// }


// ─── Utilitaires ─────────────────────────────────────────────────


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

  roles.push("Voyante");
  roles.push("Sorciere");
  if (count >= 7) roles.push("Cupidon");
  if (count >= 8) roles.push("Petite-Fille");
  

  while (roles.length < count) roles.push("Villageois");
  return shuffle(roles);
}

function getRoomPlayers(room) {
  if (!rooms[room]) return [];
  return Object.entries(rooms[room].players).map(([id, pseudo]) => ({
    id,
    pseudo,
    alive: rooms[room].alive[id] !== false,
    connecte: rooms[room].connecte ? rooms[room].connecte[id] !== false : true
  }));
}

// Envoie l'état de toutes les rooms à tous les admins connectés
function broadcastEtatRooms() {
  const etat = Object.entries(rooms).map(([code, r]) => ({
    code,
    phase: r.state,
    joueurs: Object.entries(r.players).map(([id, pseudo]) => ({
      id,
      nom: pseudo,
      role: r.roles[id] || null,
      vivant: r.alive[id] !== false,
      connecte: r.connecte ? r.connecte[id] !== false : true
    }))
  }));
  io.sockets.sockets.forEach(s => {
    if (s.isAdmin) s.emit("etat_rooms", etat);
  });
}

// ─── Conditions de victoire ──────────────────────────────────────

function checkWinCondition(room) {
  const r = rooms[room];
  if (!r) return true;

  const alivePlayers  = Object.keys(r.players).filter(id => r.alive[id] !== false);
  const aliveWolves   = alivePlayers.filter(id => r.roles[id] === "Loup-Garou");
  const aliveVillagers = alivePlayers.filter(id => r.roles[id] !== "Loup-Garou");

  if (aliveWolves.length === 0) {
    io.to(room).emit("game-over", {
      winner: "village",
      message: "Le Village a gagné ! Tous les loups sont éliminés."
    });
    rooms[room].state = "ended";
    broadcastEtatRooms();
    return true;
  }
  if (aliveWolves.length >= aliveVillagers.length) {
    io.to(room).emit("game-over", {
      winner: "loups",
      message: "Les Loups-Garous ont gagné ! Ils dominent le village."
    });
    rooms[room].state = "ended";
    broadcastEtatRooms();
    return true;
  }
  return false;
}

// ─── Mort d'un joueur ────────────────────────────────────────────

function killPlayer(room, targetId, cause) {
  const r = rooms[room];
  if (!r || r.alive[targetId] === false) return false;

  r.alive[targetId] = false;
  const pseudo = r.players[targetId];
  const role   = r.roles[targetId];

  io.to(room).emit("player-killed", { id: targetId, pseudo, role, cause });
  io.to(targetId).emit("you-died", { cause, role });

  // Couple Cupidon : si l'un meurt, l'autre aussi
  if (r.lovers && (r.lovers[0] === targetId || r.lovers[1] === targetId)) {
    const partnerId = r.lovers[0] === targetId ? r.lovers[1] : r.lovers[0];
    if (r.alive[partnerId] !== false) {
      setTimeout(() => killPlayer(room, partnerId, "amour"), 1000);
    }
  }

  broadcastEtatRooms();
  return true;
}

// ─── Phases ──────────────────────────────────────────────────────

function startNightPhase(room) {
  const r = rooms[room];
  if (!r) return;

  r.state      = "night";
  r.nightActions = {};
  r.wolfVotes  = {};

  io.to(room).emit("phase", { phase: "night", duration: 45 });

  // Informer les loups de leurs coéquipiers
  const wolves = Object.keys(r.players).filter(
    id => r.roles[id] === "Loup-Garou" && r.alive[id] !== false
  );
  wolves.forEach(id => {
    io.to(id).emit("wolf-team", wolves.map(wid => ({
      id: wid,
      pseudo: r.players[wid]
    })));
  });

  // Voyante : elle agit pendant la nuit côté client, pas besoin d'émission spéciale

  broadcastEtatRooms();
  r.nightTimer = setTimeout(() => resolveNight(room), 45000);
}

function resolveNight(room) {
  const r = rooms[room];
  if (!r || r.state !== "night") return;
  clearTimeout(r.nightTimer);

  // Victime des loups : vote majoritaire
  let wolfTarget = null;
  if (Object.keys(r.wolfVotes).length > 0) {
    const counts = {};
    Object.values(r.wolfVotes).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    wolfTarget = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // Tour de la sorcière
  const witchId = Object.keys(r.players).find(
    id => r.roles[id] === "Sorciere" && r.alive[id] !== false
  );

  if (witchId && wolfTarget) {
    io.to(witchId).emit("witch-turn", {
      target:       wolfTarget,
      targetPseudo: r.players[wolfTarget],
      antidote:     r.witch.antidote,
      poison:       r.witch.poison,
      alivePlayers: getRoomPlayers(room).filter(p => p.alive && p.id !== witchId)
    });
    r.awaitingWitch = true;
    r.wolfTarget    = wolfTarget;
    r.witchTimer    = setTimeout(() => applyNightResults(room, wolfTarget, null, null), 20000);
  } else {
    applyNightResults(room, wolfTarget, null, null);
  }
}

function applyNightResults(room, wolfTarget, antidoteUsed, poisonTarget) {
  const r = rooms[room];
  if (!r) return;
  clearTimeout(r.witchTimer);
  r.awaitingWitch = false;

  const deaths = [];

  if (wolfTarget && !antidoteUsed) {
    if (killPlayer(room, wolfTarget, "loups")) deaths.push(wolfTarget);
  }
  if (poisonTarget) {
    if (killPlayer(room, poisonTarget, "poison")) deaths.push(poisonTarget);
  }
  if (deaths.length === 0) {
    io.to(room).emit("no-death-night");
  }

  if (!checkWinCondition(room)) startDayPhase(room);
}

function startDayPhase(room) {
  const r = rooms[room];
  if (!r) return;

  r.state = "day";
  r.votes = {};

  io.to(room).emit("phase", { phase: "day", duration: 90 });
  io.to(room).emit("players-update", getRoomPlayers(room));

  broadcastEtatRooms();
  r.dayTimer = setTimeout(() => resolveVote(room), 90000);
}

function resolveVote(room) {
  const r = rooms[room];
  if (!r || r.state !== "day") return;
  clearTimeout(r.dayTimer);

  if (Object.keys(r.votes).length === 0) {
    io.to(room).emit("vote-result", { eliminated: null, message: "Personne n'a été éliminé." });
    if (!checkWinCondition(room)) startNightPhase(room);
    return;
  }

  const counts = {};
  Object.values(r.votes).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  // Égalité → personne éliminé
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
    io.to(room).emit("vote-result", { eliminated: null, message: "Égalité ! Personne n'est éliminé." });
    if (!checkWinCondition(room)) startNightPhase(room);
    return;
  }

  const eliminatedId = sorted[0][0];
  killPlayer(room, eliminatedId, "vote");
  io.to(room).emit("vote-result", {
    eliminated: eliminatedId,
    pseudo:     r.players[eliminatedId],
    role:       r.roles[eliminatedId],
    votes:      sorted
  });

  setTimeout(() => {
    if (!checkWinCondition(room)) startNightPhase(room);
  }, 3000);
}

// ─── Socket.io ───────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log("Connexion :", socket.id);

  // ══════════════════════════════════════════
  //  ADMIN
  // ══════════════════════════════════════════

  socket.on("admin_auth", (secret) => {
    if (secret !== ADMIN_SECRET) return socket.emit("admin_refuse");
    socket.isAdmin = true;
    socket.emit("admin_ok");
    broadcastEtatRooms();
    console.log("Admin connecté :", socket.id);
  });

  // Créer une room depuis l'admin
  socket.on("admin_creer_room", ({ codePartie }) => {
    if (!socket.isAdmin) return;
    if (!rooms[codePartie]) {
      rooms[codePartie] = {
        players: {}, roles: {}, alive: {}, connecte: {},
        votes: {}, wolfVotes: {}, nightActions: {},
        witch: { antidote: true, poison: true },
        lovers: null, state: "waiting", master: null,
        awaitingWitch: false, wolfTarget: null
      };
      console.log("Room créée par admin :", codePartie);
    }
    broadcastEtatRooms();
  });

  // Éjecter un joueur
  socket.on("admin_ejecter", ({ codePartie, nom }) => {
    if (!socket.isAdmin) return;
    const r = rooms[codePartie];
    if (!r) return;
    const [id] = Object.entries(r.players).find(([, pseudo]) => pseudo === nom) || [];
    if (id) {
      io.to(id).emit("ejection");
      io.sockets.sockets.get(id)?.leave(codePartie);
      delete r.players[id];
      delete r.roles[id];
      delete r.alive[id];
      if (r.connecte) delete r.connecte[id];
    }
    io.to(codePartie).emit("players-update", getRoomPlayers(codePartie));
    broadcastEtatRooms();
  });

  // Lancer la partie depuis l'admin
  socket.on("admin_lancer_partie", ({ codePartie }) => {
    if (!socket.isAdmin) return;
    const r = rooms[codePartie];
    if (!r) return;
    const playerIDs = Object.keys(r.players);
    if (playerIDs.length < 4) return socket.emit("error", "Il faut au moins 4 joueurs.");

    const roles = generateRoles(playerIDs.length);
    playerIDs.forEach((id, i) => {
      r.roles[id]  = roles[i];
      r.alive[id]  = true;
      io.to(id).emit("your-role", { role: roles[i] });
    });

    io.to(codePartie).emit("game-started");
    startNightPhase(codePartie);
    console.log("Partie lancée par admin :", codePartie);
  });

  // Forcer une phase depuis l'admin
  socket.on("admin_phase", ({ codePartie, phase }) => {
    if (!socket.isAdmin) return;
    const r = rooms[codePartie];
    if (!r) return;
    clearTimeout(r.nightTimer);
    clearTimeout(r.dayTimer);
    clearTimeout(r.witchTimer);
    if (phase === "nuit") startNightPhase(codePartie);
    else if (phase === "jour") startDayPhase(codePartie);
  });

  // Fermer une room depuis l'admin
  socket.on("admin_supprimer_room", ({ codePartie }) => {
    if (!socket.isAdmin) return;
    if (rooms[codePartie]) {
      io.to(codePartie).emit("ejection");
      clearTimeout(rooms[codePartie].nightTimer);
      clearTimeout(rooms[codePartie].dayTimer);
      clearTimeout(rooms[codePartie].witchTimer);
      delete rooms[codePartie];
    }
    broadcastEtatRooms();
  });

  // ══════════════════════════════════════════
  //  JOUEURS — Rejoindre / Créer une room
  // ══════════════════════════════════════════

  socket.on("create-room", (pseudo) => {
    if (!pseudo || pseudo.trim() === "") return socket.emit("error", "Pseudo requis.");
    const code = generateRoomCode();
    rooms[code] = {
      players: {}, roles: {}, alive: {}, connecte: {},
      votes: {}, wolfVotes: {}, nightActions: {},
      witch: { antidote: true, poison: true },
      lovers: null, state: "waiting", master: socket.id,
      awaitingWitch: false, wolfTarget: null
    };
    rooms[code].players[socket.id]  = pseudo.trim();
    rooms[code].alive[socket.id]    = true;
    rooms[code].connecte[socket.id] = true;
    socket.join(code);
    socket.data.room   = code;
    socket.data.pseudo = pseudo.trim();

    socket.emit("room-created", code);
    io.to(code).emit("players-update", getRoomPlayers(code));
    broadcastEtatRooms();
    console.log(pseudo, "a créé la room", code);
  });

  socket.on("join-room", ({ room, pseudo }) => {
    if (!rooms[room]) return socket.emit("error", "Room introuvable.");
    if (!pseudo || pseudo.trim() === "") return socket.emit("error", "Pseudo requis.");

    const r = rooms[room];

    // Reconnexion : le joueur était déjà dans la room
    const existingEntry = Object.entries(r.players).find(([, p]) => p === pseudo.trim());
    if (existingEntry) {
      const [oldId] = existingEntry;
      // Migrer vers le nouveau socketId
      r.players[socket.id]  = r.players[oldId];
      r.roles[socket.id]    = r.roles[oldId];
      r.alive[socket.id]    = r.alive[oldId];
      r.connecte[socket.id] = true;
      if (oldId !== socket.id) {
        delete r.players[oldId];
        delete r.roles[oldId];
        delete r.alive[oldId];
        delete r.connecte[oldId];
        if (r.master === oldId) r.master = socket.id;
        if (r.lovers) r.lovers = r.lovers.map(id => id === oldId ? socket.id : id);
        if (r.votes[oldId])     { r.votes[socket.id] = r.votes[oldId];     delete r.votes[oldId]; }
        if (r.wolfVotes[oldId]) { r.wolfVotes[socket.id] = r.wolfVotes[oldId]; delete r.wolfVotes[oldId]; }
      }
      socket.join(room);
      socket.data.room   = room;
      socket.data.pseudo = pseudo.trim();
      socket.emit("join-success", room);
      socket.emit("your-role", { role: r.roles[socket.id] });
      socket.emit("reconnecte", { role: r.roles[socket.id], phase: r.state });
      io.to(room).emit("players-update", getRoomPlayers(room));
      broadcastEtatRooms();
      console.log(pseudo, "reconnecté à la room", room);
      return;
    }

    // Nouvelle connexion
    if (r.state !== "waiting") return socket.emit("error", "Partie déjà commencée.");

    r.players[socket.id]  = pseudo.trim();
    r.alive[socket.id]    = true;
    r.connecte[socket.id] = true;
    socket.join(room);
    socket.data.room   = room;
    socket.data.pseudo = pseudo.trim();

    socket.emit("join-success", room);
    io.to(room).emit("players-update", getRoomPlayers(room));
    broadcastEtatRooms();
    console.log(pseudo, "a rejoint la room", room);
  });

  // ══════════════════════════════════════════
  //  JOUEURS — Lancer la partie (maître)
  // ══════════════════════════════════════════

  socket.on("start-game", (room) => {
    if (!rooms[room]) return;
    if (rooms[room].master !== socket.id) return socket.emit("error", "Seul le maître peut lancer.");
    const playerIDs = Object.keys(rooms[room].players);
    if (playerIDs.length < 4) return socket.emit("error", "Il faut au moins 4 joueurs.");

    const roles = generateRoles(playerIDs.length);
    playerIDs.forEach((id, i) => {
      rooms[room].roles[id] = roles[i];
      rooms[room].alive[id] = true;
      io.to(id).emit("your-role", { role: roles[i] });
    });

    io.to(room).emit("game-started");
    startNightPhase(room);
    broadcastEtatRooms();
  });

  // ══════════════════════════════════════════
  //  JOUEURS — Votes & Actions de nuit
  // ══════════════════════════════════════════

  // Vote du village (jour)
  socket.on("vote", ({ room, target }) => {
    const r = rooms[room];
    if (!r) return;
    if (r.state !== "day") return;
    if (r.alive[socket.id] === false) return;
    if (r.alive[target] === false) return;

    r.votes[socket.id] = target;
    io.to(room).emit("vote-update", { votes: r.votes, players: r.players });

    // Si tous les vivants ont voté → résoudre immédiatement
    const aliveCount = Object.keys(r.players).filter(id => r.alive[id] !== false).length;
    if (Object.keys(r.votes).length >= aliveCount) resolveVote(room);
  });

  // Vote des loups (nuit)
  socket.on("wolf-vote", ({ room, target }) => {
    const r = rooms[room];
    if (!r) return;
    if (r.state !== "night") return;
    if (r.roles[socket.id] !== "Loup-Garou") return;
    if (r.alive[socket.id] === false) return;

    r.wolfVotes[socket.id] = target;

    const aliveWolves = Object.keys(r.players).filter(
      id => r.roles[id] === "Loup-Garou" && r.alive[id] !== false
    );
    if (Object.keys(r.wolfVotes).length >= aliveWolves.length) resolveNight(room);
  });

  // Voyante
  socket.on("voyante-check", ({ room, target }) => {
    const r = rooms[room];
    if (!r) return;
    if (r.roles[socket.id] !== "Voyante") return;
    if (r.alive[socket.id] === false) return;
    socket.emit("voyante-result", {
      pseudo: r.players[target],
      role:   r.roles[target]
    });
  });

  // Cupidon
  socket.on("cupidon-link", ({ room, lovers }) => {
    const r = rooms[room];
    if (!r) return;
    if (r.roles[socket.id] !== "Cupidon") return;
    if (r.lovers) return; // déjà utilisé

    r.lovers = lovers;
    lovers.forEach(id => {
      const partnerId = lovers.find(l => l !== id);
      io.to(id).emit("you-are-lovers", { partner: r.players[partnerId] });
    });
  });

  // Sorcière
  socket.on("witch-action", ({ room, antidote, poisonTarget }) => {
    const r = rooms[room];
    if (!r) return;
    if (r.roles[socket.id] !== "Sorciere") return;
    if (!r.awaitingWitch) return;

    if (antidote && r.witch.antidote)       r.witch.antidote = false;
    if (poisonTarget && r.witch.poison)     r.witch.poison   = false;

    applyNightResults(room, r.wolfTarget, antidote, poisonTarget);
  });

 

});

