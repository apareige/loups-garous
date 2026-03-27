const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

let rooms = {};

// ─── Utilitaires ────────────────────────────────────────────────

function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
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

  // Loups-garous : 1 pour 4-5, 2 pour 6-9, 3 pour 10+
  if (count >= 10) roles.push("Loup-Garou", "Loup-Garou", "Loup-Garou");
  else if (count >= 6) roles.push("Loup-Garou", "Loup-Garou");
  else roles.push("Loup-Garou");

  roles.push("Voyante");
  roles.push("Sorciere");

  if (count >= 7) roles.push("Cupidon");
  if (count >= 8) roles.push("Petite-Fille");

  while (roles.length < count) roles.push("Villageois");

  return shuffle(roles);
}

function getRoomPlayers(room) {
  return Object.entries(rooms[room].players).map(([id, pseudo]) => ({
    id,
    pseudo,
    alive: rooms[room].alive[id] !== false
  }));
}

function checkWinCondition(room) {
  const r = rooms[room];
  const alivePlayers = Object.keys(r.players).filter(id => r.alive[id] !== false);
  const aliveWolves = alivePlayers.filter(id => r.roles[id] === "Loup-Garou");
  const aliveVillagers = alivePlayers.filter(id => r.roles[id] !== "Loup-Garou");

  if (aliveWolves.length === 0) {
    io.to(room).emit("game-over", { winner: "village", message: "🎉 Le Village a gagné ! Tous les loups sont éliminés." });
    return true;
  }
  if (aliveWolves.length >= aliveVillagers.length) {
    io.to(room).emit("game-over", { winner: "loups", message: "🐺 Les Loups-Garous ont gagné ! Ils dominent le village." });
    return true;
  }
  return false;
}

function killPlayer(room, targetId, cause) {
  const r = rooms[room];
  if (!r.alive[targetId]) return false;

  r.alive[targetId] = false;
  const pseudo = r.players[targetId];
  const role = r.roles[targetId];

  io.to(room).emit("player-killed", { id: targetId, pseudo, role, cause });
  io.to(targetId).emit("you-died", { cause, role });

  // Vérifier couple Cupidon
  if (r.lovers && (r.lovers[0] === targetId || r.lovers[1] === targetId)) {
    const partnerId = r.lovers[0] === targetId ? r.lovers[1] : r.lovers[0];
    if (r.alive[partnerId]) {
      setTimeout(() => killPlayer(room, partnerId, "amour"), 1000);
    }
  }

  return true;
}

// ─── Gestion des phases ─────────────────────────────────────────

function startNightPhase(room) {
  const r = rooms[room];
  r.state = "night";
  r.nightActions = {};
  r.wolfVotes = {};

  io.to(room).emit("phase", { phase: "night", duration: 45 });

  // Informer les loups des autres loups
  const wolves = Object.keys(r.players).filter(id => r.roles[id] === "Loup-Garou" && r.alive[id] !== false);
  wolves.forEach(id => {
    io.to(id).emit("wolf-team", wolves.map(wid => ({ id: wid, pseudo: r.players[wid] })));
  });

  r.nightTimer = setTimeout(() => resolveNight(room), 45000);
}

function resolveNight(room) {
  const r = rooms[room];
  if (r.state !== "night") return;

  clearTimeout(r.nightTimer);

  // Victime des loups (vote majoritaire)
  let wolfTarget = null;
  if (Object.keys(r.wolfVotes).length > 0) {
    const voteCounts = {};
    Object.values(r.wolfVotes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
    wolfTarget = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // Sorcière peut sauver / tuer
  const witchId = Object.keys(r.players).find(id => r.roles[id] === "Sorciere" && r.alive[id] !== false);
  if (witchId && wolfTarget) {
    io.to(witchId).emit("witch-turn", {
      target: wolfTarget,
      targetPseudo: r.players[wolfTarget],
      antidote: r.witch.antidote,
      poison: r.witch.poison,
      alivePlayers: getRoomPlayers(room).filter(p => p.alive && p.id !== witchId)
    });

    r.witchTimer = setTimeout(() => {
      applyNightResults(room, wolfTarget, null, null);
    }, 20000);

    r.awaitingWitch = true;
    r.wolfTarget = wolfTarget;
  } else {
    applyNightResults(room, wolfTarget, null, null);
  }
}

function applyNightResults(room, wolfTarget, antidoteUsed, poisonTarget) {
  const r = rooms[room];
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

  if (!checkWinCondition(room)) {
    startDayPhase(room);
  }
}

function startDayPhase(room) {
  const r = rooms[room];
  r.state = "day";
  r.votes = {};

  io.to(room).emit("phase", { phase: "day", duration: 90 });
  io.to(room).emit("players-update", getRoomPlayers(room));

  r.dayTimer = setTimeout(() => resolveVote(room), 90000);
}

function resolveVote(room) {
  const r = rooms[room];
  if (r.state !== "day") return;

  clearTimeout(r.dayTimer);

  if (Object.keys(r.votes).length === 0) {
    io.to(room).emit("vote-result", { eliminated: null, message: "Personne n'a été éliminé." });
    if (!checkWinCondition(room)) startNightPhase(room);
    return;
  }

  const voteCounts = {};
  Object.values(r.votes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
  const sorted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);

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
    pseudo: r.players[eliminatedId],
    role: r.roles[eliminatedId],
    votes: sorted
  });

  setTimeout(() => {
    if (!checkWinCondition(room)) startNightPhase(room);
  }, 3000);
}

// ─── Événements Socket ──────────────────────────────────────────

io.on("connection", (socket) => {

  console.log("connect:", socket.id);

  socket.on("create-room", (pseudo) => {
    if (!pseudo || pseudo.trim() === "") return socket.emit("error", "Pseudo requis.");

    const room = generateRoomCode();
    rooms[room] = {
      players: {},
      roles: {},
      alive: {},
      votes: {},
      wolfVotes: {},
      nightActions: {},
      witch: { antidote: true, poison: true },
      lovers: null,
      state: "waiting",
      master: socket.id,
      awaitingWitch: false,
      wolfTarget: null
    };

    rooms[room].players[socket.id] = pseudo.trim();
    rooms[room].alive[socket.id] = true;
    socket.join(room);
    socket.data.room = room;
    socket.data.pseudo = pseudo.trim();

    socket.emit("room-created", room);
    io.to(room).emit("players-update", getRoomPlayers(room));
  });

  socket.on("join-room", ({ room, pseudo }) => {
    if (!rooms[room]) return socket.emit("error", "Room introuvable.");
    if (!pseudo || pseudo.trim() === "") return socket.emit("error", "Pseudo requis.");
    if (rooms[room].state !== "waiting" && !rooms[room].players[socket.id]) {
      return socket.emit("error", "Partie déjà commencée.");
    }

    // Si déjà dans la room (ex: créateur qui arrive sur room.html), juste re-sync
    if (rooms[room].players[socket.id]) {
      socket.join(room);
      socket.data.room = room;
      socket.emit("join-success", room);
      io.to(room).emit("players-update", getRoomPlayers(room));
      return;
    }

    rooms[room].players[socket.id] = pseudo.trim();
    rooms[room].alive[socket.id] = true;
    socket.join(room);
    socket.data.room = room;
    socket.data.pseudo = pseudo.trim();

    socket.emit("join-success", room);
    io.to(room).emit("players-update", getRoomPlayers(room));
  });

  socket.on("start-game", (room) => {
    if (!rooms[room]) return;
    if (rooms[room].master !== socket.id) return socket.emit("error", "Seul le maître peut lancer.");

    const playerIDs = Object.keys(rooms[room].players);
    if (playerIDs.length < 4) return socket.emit("error", "Il faut au moins 4 joueurs.");

    const roles = generateRoles(playerIDs.length);

    playerIDs.forEach((id, index) => {
      rooms[room].roles[id] = roles[index];
      rooms[room].alive[id] = true;
      io.to(id).emit("your-role", { role: roles[index] });
    });

    io.to(room).emit("game-started");
    startNightPhase(room);
  });

  // Vote du village
  socket.on("vote", ({ room, target }) => {
    if (!rooms[room]) return;
    if (rooms[room].state !== "day") return;
    if (rooms[room].alive[socket.id] === false) return;
    if (rooms[room].alive[target] === false) return;

    rooms[room].votes[socket.id] = target;
    io.to(room).emit("vote-update", {
      votes: rooms[room].votes,
      players: rooms[room].players
    });

    // Si tout le monde a voté → résoudre
    const aliveCount = Object.keys(rooms[room].players).filter(id => rooms[room].alive[id] !== false).length;
    if (Object.keys(rooms[room].votes).length >= aliveCount) {
      resolveVote(room);
    }
  });

  // Vote des loups
  socket.on("wolf-vote", ({ room, target }) => {
    if (!rooms[room]) return;
    if (rooms[room].state !== "night") return;
    if (rooms[room].roles[socket.id] !== "Loup-Garou") return;
    if (rooms[room].alive[socket.id] === false) return;

    rooms[room].wolfVotes[socket.id] = target;

    // Si tous les loups ont voté
    const aliveWolves = Object.keys(rooms[room].players).filter(
      id => rooms[room].roles[id] === "Loup-Garou" && rooms[room].alive[id] !== false
    );
    if (Object.keys(rooms[room].wolfVotes).length >= aliveWolves.length) {
      resolveNight(room);
    }
  });

  // Voyante
  socket.on("voyante-check", ({ room, target }) => {
    if (!rooms[room]) return;
    if (rooms[room].roles[socket.id] !== "Voyante") return;
    if (rooms[room].alive[socket.id] === false) return;

    socket.emit("voyante-result", {
      pseudo: rooms[room].players[target],
      role: rooms[room].roles[target]
    });
  });

  // Cupidon
  socket.on("cupidon-link", ({ room, lovers }) => {
    if (!rooms[room]) return;
    if (rooms[room].roles[socket.id] !== "Cupidon") return;
    if (rooms[room].lovers) return; // déjà utilisé

    rooms[room].lovers = lovers;
    lovers.forEach(id => {
      const partnerId = lovers.find(l => l !== id);
      io.to(id).emit("you-are-lovers", { partner: rooms[room].players[partnerId] });
    });
  });

  // Sorcière
  socket.on("witch-action", ({ room, antidote, poisonTarget }) => {
    if (!rooms[room]) return;
    if (rooms[room].roles[socket.id] !== "Sorciere") return;
    if (!rooms[room].awaitingWitch) return;

    if (antidote && rooms[room].witch.antidote) {
      rooms[room].witch.antidote = false;
    }
    if (poisonTarget && rooms[room].witch.poison) {
      rooms[room].witch.poison = false;
    }

    applyNightResults(room, rooms[room].wolfTarget, antidote, poisonTarget);
  });

  // Chat (mort → canal des morts, vivants → tout le monde)
  socket.on("chat-message", ({ room, msg }) => {
    if (!rooms[room]) return;
    if (!msg || msg.trim() === "") return;

    const isDead = rooms[room].alive[socket.id] === false;
    const data = {
      pseudo: rooms[room].players[socket.id],
      msg: msg.trim().substring(0, 200),
      dead: isDead
    };

    if (isDead) {
      // Envoyer uniquement aux morts
      Object.keys(rooms[room].players).forEach(id => {
        if (rooms[room].alive[id] === false) io.to(id).emit("chat-message", data);
      });
    } else {
      io.to(room).emit("chat-message", data);
    }
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    if (room && rooms[room]) {
      delete rooms[room].players[socket.id];
      delete rooms[room].alive[socket.id];

      io.to(room).emit("players-update", getRoomPlayers(room));

      // Nettoyer si room vide
      if (Object.keys(rooms[room].players).length === 0) {
        delete rooms[room];
      }
    }
  });

});

server.listen(3000, () => {
  console.log("🐺 Serveur Loup-Garou lancé sur http://localhost:3000");
});