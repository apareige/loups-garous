const socket = io("http://192.168.1.21:3000");
alert("")



let pseudo    = "";
let codePartie = "";
let monRole   = null;
let jeVisPas  = false;   // true si je suis mort
let phaseActuelle = null;

// ─── ÉTAT LOCAL SORCIÈRE ─────────────────────────────────────
let sorciereAntidote = true;
let sorcierePoison   = true;
let sorciereVictime  = null;   // id de la victime des loups cette nuit

// ─── RECONNEXION AUTO ────────────────────────────────────────
const pseudoSauve = localStorage.getItem("lgPseudo");
const roomSauvee  = localStorage.getItem("lgRoom");
if (pseudoSauve && roomSauvee) {
    pseudo     = pseudoSauve;
    codePartie = roomSauvee;
    socket.emit("join-room", { pseudo, codePartie });
}

// ─── REJOINDRE ───────────────────────────────────────────────
function joinGame() {
    alert("Les peusdo insultant seront valables d'un bannissement de la partie ! gardez votre role secret !")
    pseudo     = document.getElementById("pseudo").value.trim();
    codePartie = document.getElementById("codePartie").value.trim().toUpperCase();
    if (!pseudo || !codePartie) return alert("Pseudo et code requis !");
    localStorage.setItem("lgPseudo", pseudo);
    localStorage.setItem("lgRoom",   codePartie);
    socket.emit("join-room", { pseudo, codePartie });
}

socket.on("join-success", (code) => {
    codePartie = code;
    document.getElementById("zone-connexion").style.display = "none";
    document.getElementById("zone-jeu").style.display       = "block";
});

socket.on("error", (msg) => alert(msg));

// ─── RÔLE ────────────────────────────────────────────────────
socket.on("your-role", ({ role }) => {
    monRole = role;
    const descs = {
        "Loup-Garou":   "Chaque nuit, désignez une victime avec vos congénères.",
        "Villageois":   "Trouvez et éliminez les loups avant qu'ils ne vous dévorent.",
        "Voyante":      "Chaque nuit, découvrez le rôle secret d'un joueur.",
        "Sorciere":     "Vous avez un antidote et un poison, utilisables une fois chacun.",
        "Cupidon":      "La première nuit, désignez deux amoureux.",
        "Petite-Fille": "Vous pouvez espionner les loups pendant la nuit.",
    };
    setEl("role-nom",  role);
    setEl("role-desc", descs[role] || "");

    // Appliquer une classe CSS sur la carte pour la coloration
    const carte = document.getElementById("carte-role");
    if (carte) carte.className = role.toLowerCase().replace(/[^a-z]/g, "-");
});

// ─── JOUEURS ─────────────────────────────────────────────────
socket.on("players-update", (liste) => {
    const ul      = document.getElementById("players");
    ul.innerHTML  = "";

    // Sélecteurs communs (vote jour, voyante, poison, cupidon)
    const selectsVote    = ["voteTarget"];
    const selectsNuit    = ["wolfTarget", "voyanteCible", "poisonCible"];
    const selectsCupidon = ["cupidon1", "cupidon2"];

    [...selectsVote, ...selectsNuit, ...selectsCupidon].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
    });

    liste.forEach(j => {
        // Liste visuelle
        const li  = document.createElement("li");
        const dot = document.createElement("span");
        dot.className = "joueur-dot " + (!j.vivant ? "mort" : j.connecte ? "vivant" : "off");
        const nom = document.createElement("span");
        nom.textContent = j.pseudo + (j.pseudo === pseudo ? " (vous)" : "") + (!j.vivant ? " ☠" : "");
        if (!j.vivant) li.classList.add("mort");
        li.appendChild(dot); li.appendChild(nom);
        ul.appendChild(li);

        // Sélecteurs de vote jour (vivants sauf soi)
        if (j.pseudo !== pseudo && j.vivant) {
            addOption("voteTarget", j.id, j.pseudo);
        }

        // Sélecteurs nuit (vivants sauf soi — loups, voyante, poison)
        if (j.pseudo !== pseudo && j.vivant) {
            addOption("wolfTarget",   j.id, j.pseudo);
            addOption("voyanteCible", j.id, j.pseudo);
            addOption("poisonCible",  j.id, j.pseudo);
        }

        // Cupidon peut se lier lui-même aussi
        if (j.vivant) {
            addOption("cupidon1", j.id, j.pseudo + (j.pseudo === pseudo ? " (vous)" : ""));
            addOption("cupidon2", j.id, j.pseudo + (j.pseudo === pseudo ? " (vous)" : ""));
        }
    });
});

function addOption(selectId, value, label) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const opt = document.createElement("option");
    opt.value = value; opt.textContent = label;
    sel.appendChild(opt);
}

// ─── PHASES ──────────────────────────────────────────────────
socket.on("phase", ({ phase }) => {
    phaseActuelle = phase;

    // Bandeau
    const dot   = document.getElementById("phase-dot");
    const label = document.getElementById("phase-label");
    if (dot)   dot.className   = "phase-dot " + phase;
    if (label) label.textContent = phase === "night" ? "🌙 La nuit tombe sur le village…" : "☀️ Le jour se lève — délibérez !";

    // Masquer toutes les zones d'action
    const zonesNuit = ["zone-loups", "zone-voyante", "zone-sorciere", "zone-cupidon", "zone-petite-fille"];
    zonesNuit.forEach(id => hide(id));
    hide("zone-vote");

    // Réinitialiser résultat voyante
    hide("voyante-result-text");

    if (jeVisPas) {
        ajouterJournal(`— ${phase === "night" ? "Nuit" : "Jour"} —`, "phase");
        return; // mort : pas d'actions
    }

    if (phase === "night") {
        afficherActionsNuit();
        ajouterJournal("— La nuit tombe —", "phase");
    } else if (phase === "day") {
        show("zone-vote");
        ajouterJournal("— Le jour se lève —", "phase");
    }
});

function afficherActionsNuit() {
    if (!monRole) return;
    switch (monRole) {
        case "Loup-Garou":   show("zone-loups");        break;
        case "Voyante":      show("zone-voyante");       break;
        case "Sorciere":     afficherZoneSorciere();     break;
        case "Cupidon":      afficherZoneCupidon();      break;
        case "Petite-Fille": show("zone-petite-fille");  break;
        // Villageois : rien la nuit
    }
}

// ─── LOUPS ───────────────────────────────────────────────────
socket.on("wolf-team", (loups) => {
    const div = document.getElementById("wolf-team-list");
    if (div) {
        div.innerHTML = "<strong>Vos congénères :</strong> " + loups.map(l => l.pseudo).join(", ");
    }
    ajouterJournal("Vos congénères loups : " + loups.map(l => l.pseudo).join(", "), "vote");
});

socket.on("wolf-vote-update", ({ votesCount, wolvesCount }) => {
    const el = document.getElementById("wolf-vote-status");
    if (el) el.textContent = `${votesCount} / ${wolvesCount} loup(s) ont voté.`;
});

function sendWolfVote() {
    const target = document.getElementById("wolfTarget")?.value;
    if (!target) return;
    socket.emit("wolf-vote", { room: codePartie, target });
    toast("Vote envoyé");
}

// ─── VOYANTE ─────────────────────────────────────────────────
function voyanteCheck() {
    const target = document.getElementById("voyanteCible")?.value;
    if (!target) return;
    socket.emit("voyante-check", { room: codePartie, target });
}

socket.on("voyante-result", ({ pseudo: nomCible, role }) => {
    const el = document.getElementById("voyante-result-text");
    if (el) { el.textContent = `${nomCible} est : ${role}`; show("voyante-result-text"); }
    ajouterJournal(`La voyante : ${nomCible} est ${role}.`, "vote");
});

// ─── SORCIÈRE ────────────────────────────────────────────────
function afficherZoneSorciere() {
    show("zone-sorciere");
    // Antidote et poison affichés selon disponibilité — sera mis à jour par witch-turn
}

socket.on("witch-turn", ({ target, targetPseudo, antidote, poison, alivePlayers }) => {
    sorciereVictime  = target;
    sorciereAntidote = antidote;
    sorcierePoison   = poison;

    show("zone-sorciere");

    const vicEl = document.getElementById("sorciere-victime");
    if (vicEl) vicEl.textContent = `Les loups ont attaqué : ${targetPseudo}`;

    // Bouton antidote
    const btnA = document.getElementById("btn-antidote");
    if (btnA) btnA.style.display = antidote ? "block" : "none";

    // Zone poison
    const zonePoison = document.getElementById("zone-poison");
    const btnP       = document.getElementById("btn-poison");
    if (zonePoison) zonePoison.style.display = poison ? "block" : "none";
    if (btnP)       btnP.style.display       = poison ? "block" : "none";

    // Remplir le sélecteur poison avec les vivants (sans la victime des loups)
    const selPoison = document.getElementById("poisonCible");
    if (selPoison) {
        selPoison.innerHTML = "";
        alivePlayers.forEach(j => {
            if (j.id !== target) addOption("poisonCible", j.id, j.pseudo);
        });
    }
});

function witchSave() {
    socket.emit("witch-action", { room: codePartie, antidote: true, poisonTarget: null });
    sorciereAntidote = false;
    hide("btn-antidote");
    hide("zone-poison"); // une seule action par nuit
    hide("btn-passer");
    toast("Antidote utilisé !");
}

function witchPoison() {
    const target = document.getElementById("poisonCible")?.value;
    if (!target) return;
    socket.emit("witch-action", { room: codePartie, antidote: false, poisonTarget: target });
    sorcierePoison = false;
    hide("zone-poison");
    hide("btn-antidote");
    hide("btn-passer");
    toast("Poison utilisé !");
}

function witchPass() {
    socket.emit("witch-action", { room: codePartie, antidote: false, poisonTarget: null });
    hide("zone-sorciere");
    toast("Tour passé");
}

// ─── CUPIDON ─────────────────────────────────────────────────
function afficherZoneCupidon() {
    // N'afficher que si les amoureux ne sont pas encore liés
    show("zone-cupidon");
}

function cupidonLink() {
    const id1 = document.getElementById("cupidon1")?.value;
    const id2 = document.getElementById("cupidon2")?.value;
    if (!id1 || !id2 || id1 === id2) return toast("Choisis deux joueurs différents !");
    socket.emit("cupidon-link", { room: codePartie, lovers: [id1, id2] });
    hide("zone-cupidon");
    toast("Amoureux liés !");
}

socket.on("you-are-lovers", ({ partner }) => {
    show("zone-amoureux");
    const el = document.querySelector("#zone-amoureux #amoureux-partner strong");
    if (el) el.textContent = partner;
    ajouterJournal(`💘 Vous êtes amoureux de ${partner}.`, "vote");
});

// ─── VOTE JOUR ───────────────────────────────────────────────
function sendVote() {
    const target = document.getElementById("voteTarget")?.value;
    if (!target) return;
    socket.emit("vote", { room: codePartie, target });
    toast("Vote envoyé");
}

socket.on("vote-update", ({ votes, players }) => {
    // Éviter les doublons dans le journal — on affiche juste le récap
    const recap = document.getElementById("vote-recap");
    if (!recap) return;
    const counts = {};
    Object.values(votes).forEach(id => {
        const p = players[id] || id;
        counts[p] = (counts[p] || 0) + 1;
    });
    recap.innerHTML = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([nom, n]) => `<span>${nom} : ${n} vote${n > 1 ? "s" : ""}</span>`)
        .join("");
});

socket.on("vote-result", ({ eliminated, pseudo: elimPseudo, role, message }) => {
    if (eliminated) {
        ajouterJournal(`${elimPseudo} (${role}) a été éliminé par le village !`, "elimination");
    } else {
        ajouterJournal(message || "Personne n'est éliminé.", "");
    }
});

// ─── MORT ────────────────────────────────────────────────────
socket.on("player-killed", ({ pseudo: nomMort, role, cause }) => {
    const causes = {
        loups:  "dévoré par les loups",
        poison: "empoisonné par la sorcière",
        vote:   "lynché par le village",
        amour:  "mort de chagrin",
        admin:  "retiré du jeu"
    };
    ajouterJournal(`${nomMort} (${role}) a été ${causes[cause] || "éliminé"}.`, "elimination");
});

socket.on("you-died", ({ cause }) => {
    jeVisPas = true;
    // Masquer toutes les actions
    ["zone-loups","zone-voyante","zone-sorciere","zone-cupidon","zone-petite-fille","zone-vote"]
        .forEach(id => hide(id));
    ajouterJournal("Vous êtes mort. Vous pouvez continuer à observer.", "elimination");
    toast("Vous êtes éliminé…");
});

socket.on("no-death-night", () => {
    ajouterJournal("La nuit s'est passée sans victime.", "");
});

socket.on("game-over", ({ winner, message }) => {
    ajouterJournal("═══ FIN DE PARTIE ═══", "phase");
    ajouterJournal(message, winner === "village" ? "vote" : "elimination");
    ["zone-loups","zone-voyante","zone-sorciere","zone-cupidon","zone-petite-fille","zone-vote"]
        .forEach(id => hide(id));
});

// ─── RECONNEXION ─────────────────────────────────────────────
socket.on("reconnecte", ({ role, phase }) => {
    document.getElementById("zone-connexion").style.display = "none";
    document.getElementById("zone-jeu").style.display       = "block";
    // your-role et phase arrivent via leurs propres events
});

// ─── DIVERS ──────────────────────────────────────────────────
socket.on("joueur_deconnecte", (nom) => {
    ajouterJournal(`${nom} s'est déconnecté…`, "");
});

socket.on("ejection", () => {
    localStorage.removeItem("lgPseudo");
    localStorage.removeItem("lgRoom");
    document.getElementById("notif").classList.add("visible");
});

socket.on("game-started", () => {
    ajouterJournal("La partie commence !", "phase");
});

// ─── UTILITAIRES ─────────────────────────────────────────────
function show(id) { const el = document.getElementById(id); if (el) el.style.display = "block"; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = "none";  }
function setEl(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

function ajouterJournal(texte, classe) {
    const div = document.getElementById("results");
    if (!div) return;
    const p = document.createElement("p");
    if (classe) p.classList.add(classe);
    p.textContent = texte;
    div.appendChild(p);
    div.scrollTop = div.scrollHeight;
}

function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2500);
}