const socket = io("http://192.168.1.21:3000");
let pseudo = "";
let codePartie = "";

// ─── REJOINDRE ────────────────────────────────────────────────

function joinGame() {
    pseudo     = document.getElementById("pseudo").value.trim();
    codePartie = document.getElementById("codePartie").value.trim().toUpperCase();
    if (!pseudo || !codePartie) return alert("Pseudo et code de room requis !");
    localStorage.setItem("lgPseudo", pseudo);
    localStorage.setItem("lgRoom",   codePartie);
    socket.emit("join-room", { pseudo, codePartie }); // ← corrigé
}

// Reconnexion automatique
const pseudoSauve = localStorage.getItem("lgPseudo");
const roomSauvee  = localStorage.getItem("lgRoom");
if (pseudoSauve && roomSauvee) {
    pseudo     = pseudoSauve;
    codePartie = roomSauvee;
    socket.emit("join-room", { pseudo, codePartie }); // ← corrigé
}

// ─── CONFIRMATION CONNEXION ───────────────────────────────────

socket.on("join-success", (code) => {
    codePartie = code;
    document.getElementById("zone-connexion").style.display = "none";
    document.getElementById("zone-jeu").style.display       = "block";
});

socket.on("error", (msg) => {
    alert(msg);
});

// ─── JOUEURS ─────────────────────────────────────────────────

socket.on("players-update", (liste) => { // ← corrigé
    const ul     = document.getElementById("players");
    const select = document.getElementById("voteTarget");
    ul.innerHTML = "";
    if (select) select.innerHTML = "";

    liste.forEach(j => {
        const li = document.createElement("li");
        li.textContent = j.pseudo
            + (j.pseudo === pseudo ? " (vous)" : "")
            + (!j.connecte ? " (déconnecté)" : "")
            + (!j.vivant   ? " ☠" : "");
        if (!j.vivant) li.classList.add("mort");
        ul.appendChild(li);

        if (select && j.pseudo !== pseudo && j.vivant) {
            const opt = document.createElement("option");
            opt.value       = j.id;      // ← id socket, pas le nom
            opt.textContent = j.pseudo;
            select.appendChild(opt);
        }
    });
});

// ─── RÔLE ────────────────────────────────────────────────────

socket.on("your-role", ({ role }) => { // ← corrigé
    const roleEl = document.getElementById("role-nom");
    if (roleEl) roleEl.textContent = "Ton rôle : " + role;

    const descEl = document.getElementById("role-desc");
    if (descEl) {
        const descs = {
            "Loup-Garou":   "Chaque nuit, désignez une victime avec vos congénères.",
            "Villageois":   "Trouvez et éliminez les loups avant qu'ils ne vous dévorent.",
            "Voyante":      "Chaque nuit, découvrez le rôle d'un joueur.",
            "Sorciere":     "Vous avez un antidote et un poison à utiliser une fois chacun.",
            "Cupidon":      "La première nuit, désignez deux amoureux.",
            "Petite-Fille": "Vous pouvez espionner les loups la nuit.",
        };
        descEl.textContent = descs[role] || "";
    }
});

// ─── PHASES ──────────────────────────────────────────────────

socket.on("phase", ({ phase, duration }) => { // ← corrigé
    const phaseEl  = document.getElementById("phase");
    const zoneVote = document.getElementById("zoneVote") || document.getElementById("zone-vote");

    if (phaseEl) phaseEl.textContent = "Phase : " + phase;
    if (zoneVote) zoneVote.style.display = phase === "day" ? "block" : "none";

    ajouterJournal(`— ${phase === "night" ? "La nuit tombe" : "Le jour se lève"} (${duration}s) —`, "phase");
});

// ─── RECONNEXION ─────────────────────────────────────────────

socket.on("reconnecte", ({ role, phase }) => {
    document.getElementById("zone-connexion").style.display = "none";
    document.getElementById("zone-jeu").style.display       = "block";
    // your-role et phase arrivent séparément via leurs propres events
});

// ─── VOTE ────────────────────────────────────────────────────

function sendVote() {
    const target = document.getElementById("voteTarget").value;
    if (!target) return;
    socket.emit("vote", { room: codePartie, target }); // ← corrigé : objet + room
}

socket.on("vote-update", ({ votes, players }) => { // ← corrigé
    // Affiche un résumé des votes en cours
    const counts = {};
    Object.entries(votes).forEach(([voterId, targetId]) => {
        const voterPseudo = players[voterId]  || voterId;
        const targetPseudo = players[targetId] || targetId;
        counts[targetPseudo] = (counts[targetPseudo] || 0) + 1;
        ajouterJournal(`${voterPseudo} vote contre ${targetPseudo}`, "vote");
    });
});

socket.on("vote-result", ({ eliminated, pseudo: elimPseudo, role, message }) => { // ← corrigé
    if (eliminated) {
        ajouterJournal(`${elimPseudo} (${role}) a été éliminé par le village !`, "elimination");
    } else {
        ajouterJournal(message || "Personne n'est éliminé.", "");
    }
});

// ─── MORT / GAME OVER ────────────────────────────────────────

socket.on("player-killed", ({ pseudo: nomMort, role, cause }) => {
    const causes = { loups: "dévoré par les loups", poison: "empoisonné", vote: "lynché", amour: "mort de chagrin", admin: "retiré du jeu" };
    ajouterJournal(`${nomMort} (${role}) a été ${causes[cause] || "éliminé"}.`, "elimination");
});

socket.on("you-died", ({ cause, role }) => {
    ajouterJournal("Vous êtes mort… Vous pouvez continuer à observer.", "elimination");
});

socket.on("game-over", ({ winner, message }) => {
    ajouterJournal("═══ FIN DE PARTIE ═══", "phase");
    ajouterJournal(message, winner === "village" ? "vote" : "elimination");
});

socket.on("no-death-night", () => {
    ajouterJournal("La nuit s'est passée sans victime.", "");
});

// ─── ÉVÉNEMENTS DIVERS ───────────────────────────────────────

socket.on("joueur_deconnecte", (nom) => {
    ajouterJournal(`${nom} s'est déconnecté…`, "");
});

socket.on("ejection", () => {
    localStorage.removeItem("lgPseudo");
    localStorage.removeItem("lgRoom");
    alert("Tu as été éjecté de la partie.");
    location.href = "/";
});

// ─── LOUPS — actions spéciales ────────────────────────────────

socket.on("wolf-team", (loups) => {
    const noms = loups.map(l => l.pseudo).join(", ");
    ajouterJournal(`Vos congénères loups : ${noms}`, "vote");
});

function sendWolfVote() {
    const target = document.getElementById("wolfTarget")?.value;
    if (!target) return;
    socket.emit("wolf-vote", { room: codePartie, target });
}

// ─── VOYANTE ─────────────────────────────────────────────────

function voyanteCheck() {
    const target = document.getElementById("voyanteCible")?.value;
    if (!target) return;
    socket.emit("voyante-check", { room: codePartie, target });
}

socket.on("voyante-result", ({ pseudo: nomCible, role }) => {
    ajouterJournal(`La voyante : ${nomCible} est ${role}.`, "vote");
});

// ─── SORCIÈRE ────────────────────────────────────────────────

socket.on("witch-turn", ({ target, targetPseudo, antidote, poison, alivePlayers }) => {
    ajouterJournal(`La sorcière : les loups visent ${targetPseudo}.`, "");
    // À adapter selon ton UI sorcière
});

function witchAction(useAntidote, poisonTargetId) {
    socket.emit("witch-action", { room: codePartie, antidote: useAntidote, poisonTarget: poisonTargetId || null });
}

// ─── JOURNAL ─────────────────────────────────────────────────

function ajouterJournal(texte, classe) {
    const div = document.getElementById("results");
    if (!div) return;
    const p = document.createElement("p");
    if (classe) p.classList.add(classe);
    p.textContent = texte;
    div.appendChild(p);
    div.scrollTop = div.scrollHeight;
}