<div class="gm-container">
    <header class="gm-header">
        <div class="gm-title-group">
            <p class="gm-label">GRIMOIRE DU</p>
            <h1 class="gm-main-title">MAITRE DU JEU</h1>
        </div>
        <button class="btn-quit">QUITTER</button>
    </header>

    <section class="gm-card room-code-card">
        <div class="card-corner tl">✦</div>
        <div class="card-corner tr">✦</div>
        <div class="card-corner bl">✦</div>
        <div class="card-corner br">✦</div>
        
        <p class="card-label">CODE DE ROOM — COMMUNIQUER CE CODE AUX JOUEURS</p>
        <div class="code-display" id="roomCode">4 8 2 7</div>
        <div class="card-footer-info">
            <span>Code maître du jeu : 0000</span>
            <button class="btn-preview">Aperçu</button>
        </div>
    </section>

    <section class="gm-card status-card">
        <div class="status-header">
            <p class="card-label">ETAT DE LA PARTIE</p>
            <span class="player-count">7 joueurs</span>
        </div>
        <div class="status-indicator">
            <span class="dot"></span>
            <span class="status-text">En attente des joueurs</span>
        </div>
        
        <button class="btn btn-primary btn-large" id="startGame">LANCER LA PARTIE</button>
    </section>
</div>