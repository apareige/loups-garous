/* ============================================
   MAÎTRE DU JEU — connexion_ad_script.js
   ============================================ */

   const PIN_LENGTH = 4;
   let pin = '';
   
   const socket = io("http://192.168.1.20:3000");
   
   // --- Éléments DOM ---
   const dots      = [0,1,2,3].map(i => document.getElementById('d' + i));
   const statusMsg = document.getElementById('statusMsg');
   
   // ── Réponses serveur ─────────────────────────
   
   socket.on("admin_pin_ok", (secret) => {
     sessionStorage.setItem("admin_secret", secret);
     setStatus('Code Accepté', 'success');
     setTimeout(() => {
       window.location.href = '../acceuil_admin/admin.html'; // adapte le chemin si besoin
     }, 600);
   });
   
   socket.on("admin_pin_refuse", () => {
     setStatus('Code Incorrect', 'fail');
     updateDots('error');
     setTimeout(() => {
       pin = '';
       updateDots();
       clearStatus();
     }, 900);
   });
   
   // ── Affichage ────────────────────────────────
   
   function updateDots(state = 'normal') {
     dots.forEach((el, i) => {
       el.querySelector('span').textContent = '';
       el.className = 'pin-dot';
       if (state === 'error') {
         if (pin[i]) { el.querySelector('span').textContent = pin[i]; el.classList.add('error'); }
       } else if (i < pin.length) {
         el.querySelector('span').textContent = pin[i];
         el.classList.add('filled');
       } else if (i === pin.length) {
         el.classList.add('active');
       }
     });
   }
   
   function setStatus(msg, type) {
     statusMsg.textContent = msg;
     statusMsg.className = 'status-msg show ' + type;
   }
   
   function clearStatus() {
     statusMsg.className = 'status-msg';
   }
   
   // ── Saisie ───────────────────────────────────
   
   function handleInput(val) {
     if (pin.length >= PIN_LENGTH) return;
     pin += val;
     updateDots();
     clearStatus();
     if (pin.length === PIN_LENGTH) setTimeout(validate, 180);
   }
   
   function handleDelete() {
     if (!pin.length) return;
     pin = pin.slice(0, -1);
     updateDots();
     clearStatus();
   }
   
   // ── Validation — maintenant via le serveur ───
   
   function validate() {
     socket.emit("admin_pin", pin); // Le serveur répond admin_pin_ok ou admin_pin_refuse
   }
   
   // ── Événements ───────────────────────────────
   
   document.querySelectorAll('.key[data-val]').forEach(btn => {
     btn.addEventListener('click', () => handleInput(btn.dataset.val));
   });
   
   document.getElementById('btnSuppr').addEventListener('click', handleDelete);
   
   document.addEventListener('keydown', e => {
     if (e.key >= '0' && e.key <= '9') handleInput(e.key);
     else if (e.key === 'Backspace' || e.key === 'Delete') handleDelete();
   });
   
   document.getElementById('backLink').addEventListener('click', () => {
     window.location.href = '/'; // adapte si besoin
   });
   
   updateDots(); // init