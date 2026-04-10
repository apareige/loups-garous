const socket = io("http://172.17.30.72:3000");
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