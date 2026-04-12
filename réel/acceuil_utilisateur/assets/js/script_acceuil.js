alert("Gardez votre role secret")

const socket = io("http://192.168.1.21:3000");
let pseudo = "";
let codePartie = "";

// Reconnexion automatique
const pseudoSauve = localStorage.getItem("lgPseudo");
const roomSauvee  = localStorage.getItem("lgRoom");
if (pseudoSauve && roomSauvee) {
  pseudo = pseudoSauve;
  codePartie = roomSauvee;
  document.getElementById("pseudo").value = pseudo;
  document.getElementById("codePartie").value = codePartie;
  socket.emit("join", { pseudo, codePartie });
}

function joinGame() {
  pseudo = document.getElementById("pseudo").value.trim();
  codePartie = document.getElementById("codePartie").value.trim().toUpperCase();
  if (!pseudo || !codePartie) return alert("Remplis les deux champs !");
  localStorage.setItem("lgPseudo", pseudo);
  localStorage.setItem("lgRoom", codePartie);
  socket.emit("join", { pseudo, codePartie });
}

socket.on("players", (liste) => {
  document.getElementById("zone-connexion").style.display = "none";
  document.getElementById("zone-jeu").style.display = "block";

  const ul = document.getElementById("players");
  const select = document.getElementById("voteTarget");
  ul.innerHTML = "";
  select.innerHTML = "";

  liste.forEach(j => {
    const li = document.createElement("li");
    if (!j.vivant) li.classList.add("mort");
    else if (!j.connecte) li.classList.add("deconnecte");

    const dot = document.createElement("span");
    dot.className = "joueur-dot " + (!j.vivant ? "mort" : j.connecte ? "vivant" : "off");

    const nom = document.createElement("span");
    nom.textContent = j.nom + (j.nom === pseudo ? " (vous)" : "");

    li.appendChild(dot);
    li.appendChild(nom);
    ul.appendChild(li);

    if (j.nom !== pseudo && j.vivant) {
      const opt = document.createElement("option");
      opt.value = j.nom;
      opt.textContent = j.nom;
      select.appendChild(opt);
    }
  });
});

socket.on("role_assigne", (role) => {
  const carte = document.getElementById("carte-role");
  const nomEl = document.getElementById("role-nom");
  const descEl = document.getElementById("role-desc");
  carte.className = role;
  if (role === "loup") {
    nomEl.textContent = "Loup-Garou";
    descEl.textContent = "Chaque nuit, désignez une victime. Restez discret le jour.";
  } else {
    nomEl.textContent = "Villageois";
    descEl.textContent = "Trouvez et éliminez les loups avant qu'ils ne vous dévorent tous.";
  }
});

socket.on("changement_phase", (phase) => {
  const dot = document.getElementById("phase-dot");
  const label = document.getElementById("phase-label");
  const zoneVote = document.getElementById("zone-vote");
  dot.className = "phase-dot " + phase;
  label.textContent = phase === "nuit" ? "La nuit tombe sur le village…" : "Le jour se lève — délibérez !";
  zoneVote.style.display = phase === "jour" ? "block" : "none";
  ajouterJournal(`— ${phase === "nuit" ? "La nuit tombe" : "Le jour se lève"} —`, "");
});

socket.on("reconnecte", ({ role, phase }) => {
  document.getElementById("zone-connexion").style.display = "none";
  document.getElementById("zone-jeu").style.display = "block";
  if (role) socket.emit("_fake_role", role); // déclenche l'affichage local
  if (phase) socket.on("changement_phase", () => {}); // sera géré par l'event normal
});

function sendVote() {
  const target = document.getElementById("voteTarget").value;
  if (!target) return;
  socket.emit("vote", target);
}

socket.on("vote-update", (data) => {
  ajouterJournal(`${data.voter} vote contre ${data.target}`, "vote");
});

socket.on("elimination", (nom) => {
  ajouterJournal(`${nom} a été éliminé par le village !`, "elimination");
});

socket.on("joueur_deconnecte", (nom) => {
  ajouterJournal(`${nom} s'est déconnecté…`, "");
});

socket.on("ejection", () => {
  localStorage.removeItem("lgPseudo");
  localStorage.removeItem("lgRoom");
  document.getElementById("notif").classList.add("visible");
});

function ajouterJournal(texte, classe) {
  const div = document.getElementById("results");
  const p = document.createElement("p");
  if (classe) p.classList.add(classe);
  p.textContent = texte;
  div.appendChild(p);
  div.scrollTop = div.scrollHeight;
}