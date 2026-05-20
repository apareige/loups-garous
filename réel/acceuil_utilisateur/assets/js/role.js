
// ── Données des rôles ─────────────────────────────────────────

const ROLES = {
    village: [
      {
        id: "villageois",
        icon: "🧑‍🌾",
        nom: "Villageois",
        hint: "Force du nombre",
        camp: "village",
        badge: "badge-village",
        campLabel: "Camp du Village",
        description: "Le villageois est le cœur du village. Sans pouvoir particulier, sa force réside dans son instinct, sa capacité à observer et à convaincre ses voisins lors des délibérations.",
        pouvoirs: [
          { titre: "Vote", desc: "Participe aux votes d'élimination du jour. Sa voix compte autant que celle des autres." },
          { titre: "Observation", desc: "Peut tenter de repérer les comportements suspects des loups lors des échanges." },
        ]
      },
      {
        id: "voyante",
        icon: "🔮",
        nom: "Voyante",
        hint: "Voit dans les âmes",
        camp: "village",
        badge: "badge-village",
        campLabel: "Camp du Village",
        description: "Chaque nuit, la voyante peut lever le voile sur l'identité secrète d'un joueur. Elle seule sait qui est réellement loup — mais révéler son identité la mettrait en grand danger.",
        pouvoirs: [
          { titre: "Inspection nocturne", desc: "Une fois par nuit, choisit un joueur et découvre son rôle exact." },
          { titre: "Guide discret", desc: "Peut orienter les votes du village sans révéler son identité." },
        ]
      },
      {
        id: "sorciere",
        icon: "🧪",
        nom: "Sorcière",
        hint: "Antidote & poison",
        camp: "village",
        badge: "badge-village",
        campLabel: "Camp du Village",
        description: "La sorcière possède deux potions redoutables, chacune utilisable une seule fois dans toute la partie. Elle peut sauver une vie… ou en prendre une.",
        pouvoirs: [
          { titre: "Antidote", desc: "Sauve la victime désignée par les loups cette nuit. Utilisable une seule fois." },
          { titre: "Poison", desc: "Élimine n'importe quel joueur vivant cette même nuit. Utilisable une seule fois." },
        ]
      },
      {
        id: "cupidon",
        icon: "💘",
        nom: "Cupidon",
        hint: "Lie deux destins",
        camp: "village",
        badge: "badge-village",
        campLabel: "Camp du Village",
        description: "La première nuit, Cupidon désigne deux joueurs qui tomberont amoureux. Leur destin est désormais lié : si l'un meurt, l'autre le suit dans la mort par chagrin.",
        pouvoirs: [
          { titre: "Lien amoureux", desc: "La première nuit uniquement, choisit deux joueurs qui deviennent amoureux." },
          { titre: "Destin partagé", desc: "Si l'un des amoureux meurt, l'autre meurt automatiquement de chagrin." },
        ]
      },
      {
        id: "petite-fille",
        icon: "👁️",
        nom: "Petite-Fille",
        hint: "Espion de la nuit",
        camp: "village",
        badge: "badge-village",
        campLabel: "Camp du Village",
        description: "La petite-fille ose entrevoir la nuit des loups. Elle peut espionner discrètement mais si les loups la surprennent, ils peuvent choisir de l'éliminer en priorité.",
        pouvoirs: [
          { titre: "Espionnage", desc: "Peut observer discrètement les loups durant leur phase nocturne." },
          { titre: "Risque", desc: "Si elle est repérée par les loups, elle devient une cible prioritaire." },
        ]
      },
    ],
  
    loups: [
      {
        id: "loup-garou",
        icon: "🐺",
        nom: "Loup-Garou",
        hint: "Prédateur du village",
        camp: "loups",
        badge: "badge-loups",
        campLabel: "Camp des Loups",
        description: "Le loup-garou se fond parmi les villageois le jour, jouant l'innocent. La nuit, il se réunit en meute avec ses congénères pour désigner une victime à dévorer.",
        pouvoirs: [
          { titre: "Vote nocturne", desc: "Chaque nuit, vote avec les autres loups pour éliminer un villageois." },
          { titre: "Connaissance de la meute", desc: "Connaît l'identité de tous ses alliés loups dès le début de la partie." },
          { titre: "Dissimulation", desc: "Le jour, vote comme un villageois ordinaire pour détourner les soupçons." },
        ]
      },
    ],
  
    solitaire: [
      {
        id: "amoureux",
        icon: "💞",
        nom: "Les Amoureux",
        hint: "Victoire à deux",
        camp: "solitaire",
        badge: "badge-solitaire",
        campLabel: "Destin Solitaire",
        description: "Désignés par Cupidon, les amoureux ne vivent que l'un pour l'autre. Si l'un est un loup et l'autre un villageois, ils peuvent gagner ensemble en étant les deux derniers survivants.",
        pouvoirs: [
          { titre: "Condition de victoire unique", desc: "Si les deux amoureux sont les deux derniers survivants, ils gagnent ensemble — peu importe leur camp d'origine." },
          { titre: "Lien fatal", desc: "La mort de l'un entraîne immédiatement la mort de l'autre." },
        ]
      },
    ]
  };
  
  // ── Rendu ─────────────────────────────────────────────────────
  
  let actifId = null;
  let actifCamp = null;
  
  function buildGrid(camp, roles) {
    const grid   = document.getElementById("grid-" + camp);
    const detail = document.getElementById("detail-" + camp);
    grid.innerHTML = "";
  
    roles.forEach((role, i) => {
      const card = document.createElement("div");
      card.className = "role-card";
      card.style.animationDelay = (i * 0.06) + "s";
      card.id = "card-" + role.id;
      card.innerHTML = `
        <span class="role-card-icon">${role.icon}</span>
        <div class="role-card-name">${role.nom}</div>
        <div class="role-card-hint">${role.hint}</div>
      `;
      card.addEventListener("click", () => afficherDetail(role, camp, card));
      grid.appendChild(card);
    });
  }
  
  function afficherDetail(role, camp, card) {
    const detail = document.getElementById("detail-" + camp);
  
    // Si on reclique sur le même : fermer
    if (actifId === role.id && actifCamp === camp) {
      card.classList.remove("active");
      detail.classList.remove("visible");
      actifId = null; actifCamp = null;
      return;
    }
  
    // Désactiver l'ancien actif
    if (actifId) {
      document.getElementById("card-" + actifId)?.classList.remove("active");
      if (actifCamp !== camp) {
        document.getElementById("detail-" + actifCamp)?.classList.remove("visible");
      }
    }
  
    // Activer le nouveau
    card.classList.add("active");
    actifId   = role.id;
    actifCamp = camp;
  
    // Construire le contenu
    const pouvoirs = role.pouvoirs.map(p => `
      <div class="power-item">
        <div class="power-dot"></div>
        <p><strong>${p.titre}</strong> — ${p.desc}</p>
      </div>
    `).join("");
  
    detail.innerHTML = `
      <div class="detail-header">
        <div class="detail-icon">${role.icon}</div>
        <div>
          <div class="detail-title">${role.nom}</div>
          <span class="detail-camp-badge ${role.badge}">${role.campLabel}</span>
        </div>
      </div>
      <div class="detail-body">
        <p>${role.description}</p>
        <div class="detail-powers">
          <div class="detail-powers-title">Pouvoirs & règles</div>
          ${pouvoirs}
        </div>
      </div>
    `;
  
    detail.classList.remove("visible");
    void detail.offsetWidth; // reflow pour relancer l'animation
    detail.classList.add("visible");
  
    // Scroll vers la fiche
    setTimeout(() => detail.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
  }
  
  // ── Init ──────────────────────────────────────────────────────
  buildGrid("village",   ROLES.village);
  buildGrid("loups",     ROLES.loups);
  buildGrid("solitaire", ROLES.solitaire);
  
  // ── Ouverture / fermeture ──────────────────────────────────────
  function ouvrirRoles() {
    document.getElementById("roles-overlay").classList.add("visible");
    document.getElementById("btn-close-roles").classList.add("visible");
    document.getElementById("btn-open-roles").style.display = "none";
  }
  
  function fermerRoles() {
    document.getElementById("roles-overlay").classList.remove("visible");
    document.getElementById("btn-close-roles").classList.remove("visible");
    document.getElementById("btn-open-roles").style.display = "flex";
  }
  
  // Fermer avec Échap
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") fermerRoles();
  });
  