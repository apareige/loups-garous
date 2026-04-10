alert("Les peusdo insultant seront valables d'un bannissement de la partie")
function joinGame() {
    const pseudo = document.getElementById('pseudo').value;

    fetch('http://172.30.17.72', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: pseudo })
    });
