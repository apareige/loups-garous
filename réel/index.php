<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Mini Loup-Garou</title>
</head>
<body>
    <h1>Mini Loup-Garou – Exemple Temps Réel</h1>

    <label>Pseudo :</label>
    <input type="text" id="pseudo">
    <button onclick="joinGame()">Rejoindre</button>

    <h2>Joueurs connectés :</h2>
    <ul id="players"></ul>

    <h2>Vote :sudo mysql -u root -p </h2>
    <select id="voteTarget"></select>
    <button onclick="sendVote()">Voter</button>

    <h3>Résultat en direct :</h3>
    <div id="results"></div>

    <!-- Socket.io client -->
    <script src="http://192.168.1.21:3000/socket.io/socket.io.js"></script>

    <script>
        const socket = io("http://192.168.1.21:3000");
        let pseudo = "";

        function joinGame() {
            pseudo = document.getElementById("pseudo").value;
            socket.emit("join", pseudo);
        }

        socket.on("players", (list) => {
            const ul = document.getElementById("players");
            const select = document.getElementById("voteTarget");

            ul.innerHTML = "";
            select.innerHTML = "";

            for (let id in list) {
                let li = document.createElement("li");
                li.textContent = list[id];
                ul.appendChild(li);

                let opt = document.createElement("option");
                opt.value = list[id];
                opt.textContent = list[id];
                select.appendChild(opt);
            }
        });

        function sendVote() {
            let target = document.getElementById("voteTarget").value;
            socket.emit("vote", target);
        }

        socket.on("vote-update", (data) => {
            document.getElementById("results").innerHTML +=
                `<p>${data.voter} a voté pour ${data.target}</p>`;
        });
    </script>
</body>
</html>
