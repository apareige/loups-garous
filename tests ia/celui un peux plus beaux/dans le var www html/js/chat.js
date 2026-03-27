function sendChat() {
    const input = document.getElementById("chatInput");
    const msg = input?.value?.trim();
    if (!msg) return;
    socket.emit("chat-message", { room, msg });
    input.value = "";
  }
  
  // Envoyer avec Entrée
  document.getElementById("chatInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
  });
  
  socket.on("chat-message", ({ pseudo: from, msg, dead }) => {
    const div = document.getElementById("messages");
    if (!div) return;
  
    const p = document.createElement("p");
    p.className = "chat-msg" + (dead ? " chat-dead" : "");
    p.innerHTML = `<span class="chat-name">${escapeHtml(from)}</span> ${escapeHtml(msg)}`;
    div.appendChild(p);
    div.scrollTop = div.scrollHeight;
  });
  
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }