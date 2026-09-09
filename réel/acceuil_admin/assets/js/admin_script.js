const socket = io("http://192.168.1.21:3000");

const secret = sessionStorage.getItem("admin_secret");

if (!secret) {
  window.location.href = '../connexion_admin/connexion_admin.html';
} else {
  socket.on("connect", () => {
    socket.emit("admin_auth", secret);
  });

  socket.on("admin_ok",     () => toast("Connecté en tant que maître du jeu"));
  socket.on("admin_refuse", () => {
    sessionStorage.removeItem("admin_secret");
    window.location.href = '../connexion_admin/connexion_admin.html';
  });
}

// ── ÉTAT DES ROOMS ──────────────────────────────────────────

socket.on("etat_rooms", (rooms) => {
  const grid  = document.getElementById("rooms-grid");
  const count = document.getElementById("rooms-count");
  count.textContent = rooms.length + " room" + (rooms.length > 1 ? "s" : "") +
                      " active" + (rooms.length > 1 ? "s" : "");

  if (rooms.length === 0) {
    grid.innerHTML = '<div class="empty-rooms">Aucune room active pour l\'instant.</div>';
    return;
  }

  grid.innerHTML = "";
  rooms.forEach(room => grid.appendChild(construireCarteRoom(room)));
});

// ── Étiquettes lisibles pour les phases ─────────────────────

function phaseLabel(phase, awaitingWitch) {
  if (phase === "night" && awaitingWitch) return "🧙 Tour sorcière";
  const labels = {
    waiting: "En attente",
    night:   "🌙 Nuit",
    day:     "☀️ Jour",
    ended:   "Terminée"
  };
  return labels[phase] || phase;
}

// ── Construction d'une carte room ───────────────────────────

function construireCarteRoom(room) {
  const card = document.createElement("div");
  card.className = "room-card " + (room.phase !== "waiting" ? room.phase : "");
  card.id = "room-" + room.code;

  // ── Header
  const header = document.createElement("div");
  header.className = "room-header";
  header.innerHTML = `
    <span class="room-code">${room.code}</span>
    <span class="room-phase ${room.phase}">${phaseLabel(room.phase, room.awaitingWitch)}</span>
  `;

  // ── Liste des joueurs
  const playersDiv = document.createElement("div");
  playersDiv.className = "room-players";

  if (room.joueurs.length === 0) {
    playersDiv.innerHTML = '<span style="color:var(--muted);font-style:italic;font-size:0.9rem">Aucun joueur</span>';
  } else {
    const ROLES = ["Loup-Garou", "Villageois", "Voyante", "Sorciere", "Cupidon", "Petite-Fille"];

    room.joueurs.forEach(j => {
      const row       = document.createElement("div");
      row.className   = "joueur-row";
      const dotClass  = !j.vivant ? "mort" : j.connecte ? "on" : "off";
      const mortClass = j.vivant ? "" : "j-mort";
      const roleLabel = j.role || "—";

      row.innerHTML = `
        <div class="joueur-row-left">
          <span class="j-dot ${dotClass}"></span>
          <span class="${mortClass}">${j.nom}</span>
          <span class="j-role ${j.role || 'none'}">${roleLabel}</span>
        </div>
        <div class="joueur-actions">
          ${j.vivant
            ? `<button class="btn btn-blood btn-sm"  onclick="tuerJoueur('${room.code}', '${j.id}')">💀 Tuer</button>`
            : `<button class="btn btn-green btn-sm"  onclick="ressusciter('${room.code}', '${j.id}')">❤️ Ressusciter</button>`
          }
          <select class="role-select" onchange="changerRole('${room.code}', '${j.id}', this.value)">
            <option value="">Rôle…</option>
            ${ROLES.map(r => `<option value="${r}" ${j.role === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
          <button class="btn btn-muted btn-sm" onclick="ejecter('${room.code}', '${j.nom}')">Éjecter</button>
        </div>
      `;
      playersDiv.appendChild(row);
    });
  }

  // ── Actions de la room
  const actions = document.createElement("div");
  actions.className = "room-actions";

  // "Suivant" n'est actif que pendant une partie en cours
  const enCours   = room.phase === "night" || room.phase === "day";
  const btnLabel  = room.awaitingWitch ? "🧙 Sorcière → Suivant" : "▶ Suivant";

  actions.innerHTML = `
    <button class="btn btn-green"
            onclick="lancerPartie('${room.code}')"
            ${room.phase !== "waiting" ? "disabled" : ""}>
      ▶ Lancer
    </button>
    <button class="btn btn-gold btn-suivant"
            onclick="suivant('${room.code}')"
            ${!enCours ? "disabled" : ""}>
      ${btnLabel}
    </button>
    <button class="btn btn-night"  onclick="changerPhase('${room.code}', 'nuit')">🌙 Forcer nuit</button>
    <button class="btn btn-day"    onclick="changerPhase('${room.code}', 'jour')">☀️ Forcer jour</button>
    <button class="btn btn-blood"  onclick="supprimerRoom('${room.code}')">✕ Fermer</button>
  `;

  card.appendChild(header);
  card.appendChild(playersDiv);
  card.appendChild(actions);
  return card;
}

// ── ACTIONS ─────────────────────────────────────────────────

function creerRoom() {
  const code = document.getElementById("new-room-code").value.trim().toUpperCase();
  if (!code) return toast("Saisis un code de room");
  socket.emit("admin_creer_room", { codePartie: code });
  document.getElementById("new-room-code").value = "";
  toast("Room " + code + " créée");
}

function lancerPartie(code) {
  if (!confirm("Lancer la partie pour la room " + code + " ?")) return;
  socket.emit("admin_lancer_partie", { codePartie: code });
  toast("Partie lancée — " + code);
}

// ── Bouton principal : résout la phase en cours et passe à la suivante
function suivant(code) {
  socket.emit("admin_suivant", { codePartie: code });
  toast("Phase résolue → passage à la suivante");
}

function changerPhase(code, phase) {
  socket.emit("admin_phase", { codePartie: code, phase });
  toast("Room " + code + " — forcée en " + phase);
}

function ejecter(code, nom) {
  if (!confirm("Éjecter " + nom + " de la room " + code + " ?")) return;
  socket.emit("admin_ejecter", { codePartie: code, nom });
  toast(nom + " éjecté");
}

function supprimerRoom(code) {
  if (!confirm("Fermer définitivement la room " + code + " ?")) return;
  socket.emit("admin_supprimer_room", { codePartie: code });
  toast("Room " + code + " fermée");
}

function tuerJoueur(code, joueurId) {
  if (!confirm("Tuer ce joueur ?")) return;
  socket.emit("admin_tuer", { codePartie: code, joueurId, cause: "admin" });
  toast("Joueur éliminé");
}

function ressusciter(code, joueurId) {
  socket.emit("admin_ressusciter", { codePartie: code, joueurId });
  toast("Joueur ressuscité");
}

function changerRole(code, joueurId, role) {
  if (!role) return;
  socket.emit("admin_changer_role", { codePartie: code, joueurId, role });
  toast("Rôle changé → " + role);
}

// ── TOAST ────────────────────────────────────────────────────

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}