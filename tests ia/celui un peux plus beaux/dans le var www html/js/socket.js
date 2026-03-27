// ─── État global ────────────────────────────────────────────────
const socket = io();

let room = "";
let pseudo = "";
let isMaster = false;

// Récupérer les paramètres URL
const urlParams = new URLSearchParams(window.location.search);
// NE PAS rejoindre ici si on est sur room.html — c'est game.js qui s'en charge
if (urlParams.get("room") && !window.location.pathname.includes("room.html")) {
  room = urlParams.get("room");
  pseudo = urlParams.get("pseudo") || "Anonyme";
}

// ─── Accueil : créer / rejoindre ────────────────────────────────

function createRoom() {
  pseudo = document.getElementById("pseudo")?.value?.trim();
  if (!pseudo) return showError("Entre ton pseudo !");
  socket.emit("create-room", pseudo);
}

function joinRoom() {
  pseudo = document.getElementById("pseudo")?.value?.trim();
  const code = document.getElementById("roomCode")?.value?.trim();
  if (!pseudo) return showError("Entre ton pseudo !");
  if (!code || code.length !== 4) return showError("Code de room invalide (4 chiffres).");
  room = code;
  socket.emit("join-room", { room, pseudo });
}

function showError(msg) {
  const el = document.getElementById("error-msg");
  if (el) {
    el.textContent = msg;
    setTimeout(() => { el.textContent = ""; }, 4000);
  }
}

// ─── Réponses serveur (page accueil) ────────────────────────────

socket.on("room-created", (code) => {
  room = code;
  isMaster = true;
  window.location = "room.html?room=" + code + "&pseudo=" + encodeURIComponent(pseudo) + "&master=1";
});

socket.on("join-success", (code) => {
  room = code;
  window.location = "room.html?room=" + code + "&pseudo=" + encodeURIComponent(pseudo);
});

socket.on("error", (msg) => {
  showError(msg);
});