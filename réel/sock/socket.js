const socket = io("http://192.168.1.21:3000");
let pseudo = "";
let codePartie = "";

// ─── REJOINDRE ────────────────────────────────────────────────

function joinGame() {
    pseudo = document.getElementById("pseudo").value.trim();
    codePartie = document.getElementById("codePartie").value.trim().toUpperCase();
    if (!pseudo || !codePartie) return alert("Pseudo et code de room requis !");

    // Sauvegarde pour la reconnexion automatique
    localStorage.setItem("lgPseudo", pseudo);
    localStorage.setItem("lgRoom", codePartie);

    socket.emit("join", { pseudo, codePartie });
}

// Reconnexion automatique au rechargement de page
const pseudoSauve = localStorage.getItem("lgPseudo");
const roomSauvee = localStorage.getItem("lgRoom");
if (pseudoSauve && roomSauvee) {
    pseudo = pseudoSauve;
    codePartie = roomSauvee;
    socket.emit("join", { pseudo, codePartie });
}

// ─── RÉCEPTION JOUEURS ────────────────────────────────────────

socket.on("players", (liste) => {
    const ul = document.getElementById("players");
    const select = document.getElementById("voteTarget");
    ul.innerHTML = "";
    if (select) select.innerHTML = "";

    liste.forEach(j => {
        // Liste des joueurs
        const li = document.createElement("li");
        li.textContent = j.nom + (j.connecte ? "" : " (déconnecté)") + (j.vivant ? "" : " ☠");
        ul.appendChild(li);

        // Menu de vote (uniquement les autres joueurs vivants)
        if (select && j.nom !== pseudo && j.vivant) {
            const opt = document.createElement("option");
            opt.value = j.nom;
            opt.textContent = j.nom;
            select.appendChild(opt);
        }
    });
});

// ─── RÔLE & PHASES ───────────────────────────────────────────

socket.on("role_assigne", (role) => {
    document.getElementById("role").textContent = "Ton rôle : " + role;
});

socket.on("changement_phase", (phase) => {
    document.getElementById("phase").textContent = "Phase : " + phase;
    // Cache/affiche les actions selon la phase
    const zoneVote = document.getElementById("zoneVote");
    if (zoneVote) zoneVote.style.display = phase === "jour" ? "block" : "none";
});

socket.on("reconnecte", ({ role, phase, joueurs }) => {
    console.log("Reconnecté ! Rôle :", role, "Phase :", phase);
    if (role) document.getElementById("role").textContent = "Ton rôle : " + role;
    document.getElementById("phase").textContent = "Phase : " + phase;
});

// ─── VOTE ────────────────────────────────────────────────────

function sendVote() {
    const target = document.getElementById("voteTarget").value;
    socket.emit("vote", target);
}

socket.on("vote-update", (data) => {
    document.getElementById("results").innerHTML +=
        `<p>${data.voter} a voté pour ${data.target}</p>`;
});

socket.on("elimination", (nom) => {
    document.getElementById("results").innerHTML +=
        `<p><strong>${nom} a été éliminé !</strong></p>`;
});

// ─── ÉVÉNEMENTS DIVERS ───────────────────────────────────────

socket.on("joueur_deconnecte", (nom) => {
    console.log(nom, "s'est déconnecté");
});

socket.on("ejection", () => {
    localStorage.removeItem("lgPseudo");
    localStorage.removeItem("lgRoom");
    alert("Tu as été éjecté de la partie.");
    location.href = "/"; // redirige vers l'accueil
});