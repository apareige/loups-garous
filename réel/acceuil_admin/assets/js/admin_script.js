const socket = io("http://192.168.1.21:3000");


const secret = sessionStorage.getItem("admin_secret");

if (!secret) {
  window.location.href = '../pin/pin.html'; // adapte le chemin
} else {
  socket.on("connect", () => {
    socket.emit("admin_auth", secret);
  });

  socket.on("admin_ok",     () => toast("Connecté en tant que maître du jeu"));
  socket.on("admin_refuse", () => {
    sessionStorage.removeItem("admin_secret");
    window.location.href = '../pin/pin.html';
  });
}
// ── ÉTAT DES ROOMS ──────────────────────────────────────────

socket.on("etat_rooms", (rooms) => {
  const grid = document.getElementById("rooms-grid");
  const count = document.getElementById("rooms-count");
  count.textContent = rooms.length + " room" + (rooms.length > 1 ? "s" : "") + " active" + (rooms.length > 1 ? "s" : "");

  if (rooms.length === 0) {
    grid.innerHTML = '<div class="empty-rooms">Aucune room active pour l\'instant.</div>';
    return;
  }

  grid.innerHTML = "";
  rooms.forEach(room => {
    grid.appendChild(construireCarteRoom(room));
  });
});

function construireCarteRoom(room) {
  const card = document.createElement("div");
  card.className = "room-card " + (room.phase !== "attente" ? room.phase : "");
  card.id = "room-" + room.code;

  // Header
  const header = document.createElement("div");
  header.className = "room-header";
  header.innerHTML = `
    <span class="room-code">${room.code}</span>
    <span class="room-phase ${room.phase}">${room.phase}</span>
  `;

  // Joueurs
  const playersDiv = document.createElement("div");
  playersDiv.className = "room-players";

  if (room.joueurs.length === 0) {
    playersDiv.innerHTML = '<span style="color:var(--muted);font-style:italic;font-size:0.9rem">Aucun joueur</span>';
  } else {
    room.joueurs.forEach(j => {
      const row = document.createElement("div");
      row.className = "joueur-row";

      const dotClass = !j.vivant ? "mort" : j.connecte ? "on" : "off";
      const roleClass = j.role || "none";
      const roleLabel = j.role || "—";
      const mortClass = j.vivant ? "" : "j-mort";

      row.innerHTML = `
        <div class="joueur-row-left">
          <span class="j-dot ${dotClass}"></span>
          <span class="${mortClass}">${j.nom}</span>
          <span class="j-role ${roleClass}">${roleLabel}</span>
        </div>
        <button class="btn btn-muted" onclick="ejecter('${room.code}', '${j.nom}')">Éjecter</button>
      `;
      playersDiv.appendChild(row);
    });
  }

  // Actions
  const actions = document.createElement("div");
  actions.className = "room-actions";
  actions.innerHTML = `
    <button class="btn btn-green" onclick="lancerPartie('${room.code}')" ${room.phase !== 'attente' ? 'disabled' : ''}>
      Lancer la partie
    </button>
    <button class="btn btn-night" onclick="changerPhase('${room.code}', 'nuit')">
      Nuit
    </button>
    <button class="btn btn-day" onclick="changerPhase('${room.code}', 'jour')">
      Jour
    </button>
    <button class="btn btn-blood" onclick="supprimerRoom('${room.code}')">
      Fermer
    </button>
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

function changerPhase(code, phase) {
  socket.emit("admin_phase", { codePartie: code, phase });
  toast("Room " + code + " — " + phase);
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

// ── TOAST ────────────────────────────────────────────────────

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}


