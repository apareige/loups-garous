/* ============================================
   MAÎTRE DU JEU — script.js
   ============================================ */

// --- Configuration ---
const CORRECT_CODE = '1234'; // ← Changez ce code PIN
const PIN_LENGTH = 4;

// --- État ---
let pin = '';

// --- Éléments DOM ---
const chars = [
  document.getElementById('d0'),
  document.getElementById('d1'),
  document.getElementById('d2'),
  document.getElementById('d3'),
];
const statusMsg = document.getElementById('statusMsg');
const overlay   = document.getElementById('successOverlay');

// ============================================
// Mise à jour de l'affichage des chiffres
// ============================================
function updateDots(state = 'normal') {
  chars.forEach((el, i) => {
    el.className = 'pin-char';
    el.textContent = '';

    if (state === 'error') {
      el.textContent = pin[i] || '';
      if (pin[i]) el.classList.add('error');
    } else if (i < pin.length) {
      el.textContent = pin[i];
      el.classList.add('filled');
    } else if (i === pin.length) {
      el.classList.add('active');
    }
  });
}

// ============================================
// Gestion du message de statut
// ============================================
function setStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = 'status-msg show ' + type;
}

function clearStatus() {
  statusMsg.className = 'status-msg';
}

// ============================================
// Saisie d'un chiffre
// ============================================
function handleInput(val) {
  if (pin.length >= PIN_LENGTH) return;
  pin += val;
  updateDots();
  clearStatus();

  if (pin.length === PIN_LENGTH) {
    setTimeout(validate, 180);
  }
}

// ============================================
// Suppression du dernier chiffre
// ============================================
function handleDelete() {
  if (pin.length === 0) return;
  pin = pin.slice(0, -1);
  updateDots();
  clearStatus();
}

// ============================================
// Validation du code PIN
// ============================================
function validate() {
  if (pin === CORRECT_CODE) {
    setStatus('Code Accepté', 'success');
    setTimeout(() => {
      window.location.href = '../acceuil_admin/admin.html';
    }, 600);
  } else {
    setStatus('Code Incorrect', 'fail');
    updateDots('error');
    setTimeout(() => {
      pin = '';
      updateDots();
      clearStatus();
    }, 900);
  }
}

// ============================================
// Effet ripple sur les touches
// ============================================
function addRipple(btn, e) {
  const r    = document.createElement('span');
  r.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x    = (e.clientX - rect.left) - size / 2;
  const y    = (e.clientY - rect.top)  - size / 2;
  r.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ============================================
// Événements — Touches du clavier numérique
// ============================================
document.querySelectorAll('.key[data-val]').forEach(btn => {
  btn.addEventListener('click', e => {
    addRipple(btn, e);
    handleInput(btn.dataset.val);
  });
});

document.getElementById('btnSuppr').addEventListener('click', e => {
  addRipple(document.getElementById('btnSuppr'), e);
  handleDelete();
});

// ============================================
// Événements — Clavier physique
// ============================================
document.addEventListener('keydown', e => {
  if (e.key >= '0' && e.key <= '9') {
    handleInput(e.key);
  } else if (e.key === 'Backspace' || e.key === 'Delete') {
    handleDelete();
  }
});

// ============================================
// Événements — Lien retour
// ============================================
document.getElementById('backLink').addEventListener('click', () => {
  // Remplacez par : window.location.href = '/';
  pin = '';
  updateDots();
  clearStatus();
  alert("Retour à l'accueil (à personnaliser)");
});

// ============================================
// Événements — Fermer l'overlay de succès
// ============================================
overlay.addEventListener('click', () => {
  overlay.classList.remove('active');
  pin = '';
  updateDots();
  clearStatus();
});
