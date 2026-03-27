// ─── État du jeu ────────────────────────────────────────────────

let myRole = "";
let isAlive = true;
let currentPhase = "";
let timerInterval = null;
let currentPlayers = {};

const ROLES = {
  "Loup-Garou":   { icon: "🐺", desc: "Chaque nuit, éliminez un villageois avec vos congénères. Restez discrets le jour.", color: "#e74c3c" },
  "Voyante":      { icon: "🔮", desc: "Chaque nuit, découvrez le rôle secret d'un joueur.", color: "#9b59b6" },
  "Sorciere":     { icon: "🧪", desc: "Vous avez une potion de vie et une potion de mort, chacune utilisable une seule fois.", color: "#27ae60" },
  "Cupidon":      { icon: "💘", desc: "La première nuit, liez deux joueurs. S'ils forment un couple de loup et villageois, ils jouent ensemble.", color: "#e91e63" },
  "Petite-Fille": { icon: "👧", desc: "Vous pouvez épier les loups-garous pendant leur phase, mais attention à ne pas vous faire repérer.", color: "#f39c12" },
  "Villageois":   { icon: "🏡", desc: "Vous n'avez aucun pouvoir spécial. Débusquez les loups grâce à votre sens de l'observation.", color: "#3498db" },
};

// ─── Init (room.html) ────────────────────────────────────────────

if (window.location.pathname.includes("room.html")) {

  const roomCode = urlParams.get("room");
  const myPseudo = decodeURIComponent(urlParams.get("pseudo") || "Anonyme");
  const isMasterParam = urlParams.get("master") === "1";

  room = roomCode || "";
  pseudo = myPseudo;

  document.getElementById("lobbyRoomCode").textContent = room;
  document.getElementById("headerRoom").textContent = room;

  if (isMasterParam) {
    document.getElementById("startBtn").style.display = "block";
    document.getElementById("waitingMsg").style.display = "none";
  }

  // Rejoindre la room Socket.io
  socket.emit("join-room", { room, pseudo });

  // ── Lobby ────────────────────────────────────────────────────

  socket.on("players-update", (players) => {
    currentPlayers = {};
    players.forEach(p => { currentPlayers[p.id] = p; });

    // Lobby
    const ul = document.getElementById("lobbyPlayers");
    if (ul) {
      ul.innerHTML = "";
      players.forEach(p => {
        const li = document.createElement("li");
        li.className = "lobby-player" + (p.alive ? "" : " dead");
        li.textContent = p.pseudo;
        ul.appendChild(li);
      });
    }

    // Jeu
    renderGamePlayers(players);
  });

  // ── Rôle ─────────────────────────────────────────────────────

  socket.on("your-role", (data) => {
    myRole = data.role;
    const info = ROLES[myRole] || { icon: "❓", desc: "", color: "#fff" };

    document.getElementById("roleIconBig").textContent = info.icon;
    document.getElementById("roleName").textContent = myRole;
    document.getElementById("roleDesc").textContent = info.desc;

    document.getElementById("myRoleTag").textContent = info.icon + " " + myRole;
    document.getElementById("myRoleTag").style.color = info.color;

    showScreen("roleReveal");
    setTimeout(() => showScreen("game"), 5000);
  });

  socket.on("wolf-team", (wolves) => {
    if (myRole !== "Loup-Garou") return;
    const box = document.getElementById("wolfTeamBox");
    const list = document.getElementById("wolfTeamList");
    box.style.display = "block";
    list.innerHTML = wolves.map(w => `<li>${w.pseudo}</li>`).join("");
  });

  // ── Game started ─────────────────────────────────────────────

  socket.on("game-started", () => {
    // Masquer le bouton start
    const btn = document.getElementById("startBtn");
    if (btn) btn.style.display = "none";
  });

  // ── Phase ─────────────────────────────────────────────────────

  socket.on("phase", ({ phase, duration }) => {
    currentPhase = phase;

    clearTimer();
    startTimer(duration, phase === "night" ? "Nuit" : "Jour");

    const badge = document.getElementById("phaseBadge");
    const overlay = document.getElementById("bgOverlay");
    const moonEl = document.getElementById("moon");

    if (phase === "night") {
      badge.textContent = "🌙 Nuit";
      badge.className = "phase-badge night";
      overlay.className = "bg-overlay night";
      moonEl.classList.add("visible");
      renderNightActions();
    } else {
      badge.textContent = "☀️ Jour";
      badge.className = "phase-badge day";
      overlay.className = "bg-overlay day";
      moonEl.classList.remove("visible");
      document.getElementById("nightActions").style.display = "none";
      renderDayVote();
    }

    showScreen("game");
  });

  // ── Actions nuit ──────────────────────────────────────────────

  socket.on("witch-turn", ({ target, targetPseudo, antidote, poison, alivePlayers }) => {
    const content = document.getElementById("nightActionContent");
    const title = document.getElementById("nightActionTitle");
    title.textContent = "🧪 Tour de la Sorcière";

    let html = `<p>Les loups veulent tuer <strong>${targetPseudo}</strong>.</p>`;

    if (antidote) {
      html += `<button class="btn btn-small btn-green" onclick="witchAntidote()">💊 Sauver ${targetPseudo}</button>`;
    }

    if (poison) {
      html += `<p>Empoisonner un joueur :</p>
      <ul class="vote-list">`;
      alivePlayers.forEach(p => {
        html += `<li><button class="vote-btn" onclick="witchPoison('${p.id}')">${p.pseudo}</button></li>`;
      });
      html += `</ul>`;
    }

    html += `<button class="btn btn-ghost" onclick="witchPass()">Passer mon tour</button>`;
    content.innerHTML = html;

    document.getElementById("nightActions").style.display = "block";
  });

  socket.on("voyante-result", ({ pseudo: targetPseudo, role }) => {
    const info = ROLES[role] || { icon: "❓" };
    addAnnouncement(`🔮 La voyante voit : <strong>${targetPseudo}</strong> est ${info.icon} <strong>${role}</strong>`, "voyante");
  });

  socket.on("you-are-lovers", ({ partner }) => {
    addAnnouncement(`💘 Cupidon t'a lié à <strong>${partner}</strong>. Vous êtes amoureux !`, "lovers");
  });

  // ── Morts ─────────────────────────────────────────────────────

  socket.on("player-killed", ({ id, pseudo: deadPseudo, role, cause }) => {
    const info = ROLES[role] || { icon: "❓" };
    const causes = {
      loups: "dévoré par les loups",
      vote: "éliminé par le village",
      poison: "empoisonné par la sorcière",
      amour: "mort de chagrin (couple)",
    };
    addAnnouncement(`💀 <strong>${deadPseudo}</strong> a été ${causes[cause] || "éliminé"}. C'était ${info.icon} <strong>${role}</strong>.`, "death");

    // Mettre à jour les joueurs morts visuellement
    if (currentPlayers[id]) {
      currentPlayers[id].alive = false;
    }
    renderGamePlayers(Object.values(currentPlayers));
  });

  socket.on("you-died", ({ cause, role }) => {
    isAlive = false;
    document.getElementById("chatLabel").textContent = "(canal des morts)";

    const overlay = document.getElementById("deadOverlay");
    const causes = {
      loups: "Vous avez été dévoré par les loups.",
      vote: "Le village vous a éliminé.",
      poison: "La sorcière vous a empoisonné.",
      amour: "Votre amour est mort... vous aussi.",
    };
    document.getElementById("deadReason").textContent = causes[cause] || "Vous avez été éliminé.";
    overlay.style.display = "flex";
  });

  socket.on("no-death-night", () => {
    addAnnouncement("🌅 La nuit s'est passée sans mort. Le village se réveille.", "neutral");
  });

  // ── Vote ──────────────────────────────────────────────────────

  socket.on("vote-update", ({ votes, players }) => {
    // Compter les votes par cible
    const count = {};
    Object.values(votes).forEach(v => { count[v] = (count[v] || 0) + 1; });

    document.querySelectorAll(".vote-btn").forEach(btn => {
      const targetId = btn.dataset.id;
      const c = count[targetId] || 0;
      btn.querySelector(".vote-count").textContent = c > 0 ? ` (${c} vote${c > 1 ? "s" : ""})` : "";
    });
  });

  socket.on("vote-result", ({ eliminated, pseudo: elPseudo, role, message }) => {
    clearTimer();
    document.getElementById("dayVote").style.display = "none";

    if (eliminated) {
      const info = ROLES[role] || { icon: "❓" };
      addAnnouncement(`🗳️ Le village a éliminé <strong>${elPseudo}</strong>. C'était ${info.icon} <strong>${role}</strong>.`, "death");
    } else {
      addAnnouncement(`🗳️ ${message}`, "neutral");
    }
  });

  // ── Game Over ─────────────────────────────────────────────────

  socket.on("game-over", ({ winner, message }) => {
    clearTimer();
    const overlay = document.getElementById("gameOverOverlay");
    document.getElementById("gameOverIcon").textContent = winner === "village" ? "🏡" : "🐺";
    document.getElementById("gameOverTitle").textContent = winner === "village" ? "Victoire du Village !" : "Victoire des Loups !";
    document.getElementById("gameOverMsg").textContent = message;
    overlay.style.display = "flex";
  });

  socket.on("error", (msg) => {
    addAnnouncement("⚠️ " + msg, "error");
  });
}

// ─── Actions joueurs ─────────────────────────────────────────────

function startGame() {
  socket.emit("start-game", room);
}

function sendVote(targetId) {
  if (!isAlive) return;
  socket.emit("vote", { room, target: targetId });
  // Désactiver mes boutons après vote
  document.querySelectorAll(".vote-btn").forEach(btn => btn.disabled = true);
  document.querySelectorAll(".vote-btn[data-id='" + targetId + "']").forEach(btn => {
    btn.classList.add("voted");
  });
}

function sendWolfVote(targetId) {
  socket.emit("wolf-vote", { room, target: targetId });
  document.querySelectorAll(".vote-btn").forEach(btn => btn.disabled = true);
}

function voyanteCheck(targetId) {
  socket.emit("voyante-check", { room, target: targetId });
  document.querySelectorAll(".vote-btn").forEach(btn => btn.disabled = true);
}

function witchAntidote() {
  socket.emit("witch-action", { room, antidote: true, poisonTarget: null });
  document.getElementById("nightActions").style.display = "none";
  addAnnouncement("🧪 Tu as utilisé ta potion de vie.", "neutral");
}

function witchPoison(targetId) {
  socket.emit("witch-action", { room, antidote: false, poisonTarget: targetId });
  document.getElementById("nightActions").style.display = "none";
  addAnnouncement("🧪 Tu as utilisé ta potion de mort.", "neutral");
}

function witchPass() {
  socket.emit("witch-action", { room, antidote: false, poisonTarget: null });
  document.getElementById("nightActions").style.display = "none";
}

// ─── UI helpers ──────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

function startTimer(seconds, label) {
  const el = document.getElementById("timerBadge");
  let t = seconds;

  function update() {
    const m = Math.floor(t / 60).toString().padStart(2, "0");
    const s = (t % 60).toString().padStart(2, "0");
    el.textContent = `${label} ${m}:${s}`;
    el.className = "timer-badge" + (t <= 10 ? " urgent" : "");
  }

  update();
  timerInterval = setInterval(() => {
    t--;
    update();
    if (t <= 0) clearTimer();
  }, 1000);
}

function clearTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function renderGamePlayers(players) {
  const ul = document.getElementById("gamePlayers");
  if (!ul) return;
  ul.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.className = "game-player-item" + (p.alive ? "" : " dead");
    li.textContent = (p.alive ? "" : "💀 ") + p.pseudo;
    ul.appendChild(li);
  });
}

function renderNightActions() {
  const box = document.getElementById("nightActions");
  const content = document.getElementById("nightActionContent");
  const title = document.getElementById("nightActionTitle");

  if (!isAlive) {
    box.style.display = "none";
    return;
  }

  document.getElementById("dayVote").style.display = "none";

  const alivePlayers = Object.values(currentPlayers).filter(p => p.alive && p.id !== socket.id);

  if (myRole === "Loup-Garou") {
    title.textContent = "🐺 Vote des loups";
    content.innerHTML = `<p>Choisissez votre victime :</p>
    <ul class="vote-list">${alivePlayers
      .filter(p => {
        const r = p.role; // loups ne voient pas le rôle sauf les leurs
        return true;
      })
      .map(p => `<li><button class="vote-btn" data-id="${p.id}" onclick="sendWolfVote('${p.id}')">${p.pseudo}<span class="vote-count"></span></button></li>`)
      .join("")}
    </ul>`;
    box.style.display = "block";

  } else if (myRole === "Voyante") {
    title.textContent = "🔮 Pouvoir de la Voyante";
    content.innerHTML = `<p>Révélez le rôle d'un joueur :</p>
    <ul class="vote-list">${alivePlayers
      .map(p => `<li><button class="vote-btn" data-id="${p.id}" onclick="voyanteCheck('${p.id}')">${p.pseudo}<span class="vote-count"></span></button></li>`)
      .join("")}
    </ul>`;
    box.style.display = "block";

  } else if (myRole === "Cupidon" && !window.cupidonUsed) {
    title.textContent = "💘 Pouvoir de Cupidon";
    window.cupidonSelected = [];
    content.innerHTML = `<p>Choisissez 2 joueurs à lier :</p>
    <ul class="vote-list" id="cupidonList">${Object.values(currentPlayers)
      .filter(p => p.alive)
      .map(p => `<li><button class="vote-btn" data-id="${p.id}" onclick="cupidonSelect('${p.id}', this)">${p.pseudo}<span class="vote-count"></span></button></li>`)
      .join("")}
    </ul>
    <button class="btn btn-small" id="cupidonConfirm" onclick="cupidonConfirm()" style="display:none">💘 Lier ces deux joueurs</button>`;
    box.style.display = "block";

  } else {
    title.textContent = "🌙 Nuit...";
    content.innerHTML = `<p class="italic-hint">Dormez paisiblement... ou faites semblant.</p>`;
    box.style.display = "block";
  }
}

function cupidonSelect(id, btn) {
  if (!window.cupidonSelected) window.cupidonSelected = [];

  const idx = window.cupidonSelected.indexOf(id);
  if (idx > -1) {
    window.cupidonSelected.splice(idx, 1);
    btn.classList.remove("selected");
  } else if (window.cupidonSelected.length < 2) {
    window.cupidonSelected.push(id);
    btn.classList.add("selected");
  }

  document.getElementById("cupidonConfirm").style.display =
    window.cupidonSelected.length === 2 ? "inline-block" : "none";
}

function cupidonConfirm() {
  if (window.cupidonSelected?.length === 2) {
    socket.emit("cupidon-link", { room, lovers: window.cupidonSelected });
    window.cupidonUsed = true;
    document.getElementById("nightActions").style.display = "none";
    addAnnouncement("💘 Tu as lié deux joueurs.", "neutral");
  }
}

function renderDayVote() {
  const box = document.getElementById("dayVote");

  if (!isAlive) {
    box.style.display = "none";
    return;
  }

  const alivePlayers = Object.values(currentPlayers).filter(p => p.alive && p.id !== socket.id);

  document.getElementById("voteList").innerHTML = alivePlayers
    .map(p => `<li><button class="vote-btn" data-id="${p.id}" onclick="sendVote('${p.id}')">${p.pseudo}<span class="vote-count"></span></button></li>`)
    .join("");

  box.style.display = "block";
}

function addAnnouncement(html, type = "neutral") {
  const el = document.getElementById("announcements");
  if (!el) return;
  const div = document.createElement("div");
  div.className = `announcement ${type}`;
  div.innerHTML = html;
  el.prepend(div);
  setTimeout(() => div.classList.add("fadeout"), 8000);
  setTimeout(() => div.remove(), 9000);
}