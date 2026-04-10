const http = require("http").createServer();
const io = require("socket.io")(http, {
    cors: { origin: "*" } //autorise les connexion depuis n'importe quel domaine
});

let players = {}; // Liste des joueurs connectés

io.on("connection", (socket) => {
    console.log("Un joueur est connecté :", socket.id);

    // Quand un joueur entre avec son pseudo
    socket.on("join", (pseudo) => {
        players[socket.id] = pseudo;
        console.log(pseudo + " a rejoint la partie.");

        // Envoie la liste mise à jour à tout le monde
        io.emit("players", players);
    });

    // Quand un joueur vote
    socket.on("vote", (target) => {
        console.log(players[socket.id], "vote pour", target);
        io.emit("vote-update", {
            voter: players[socket.id],
            target: target
        });
    });

    // Déconnexion
    socket.on("disconnect", () => {
        console.log(players[socket.id], "a quitté.");
        delete players[socket.id];
        io.emit("players", players);
    });
});

http.listen(3000, () => {
    console.log("Serveur Socket.io lancé sur http://172.17.30.72:3000");
});





