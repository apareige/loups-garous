<?php
session_start(); 
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Loup Garou</title>
</head>
<body>
    <p>Bienvenue dans le village de Lannion</p>
    <?php
    if (isset($_SESSION['nom_utilisateur'])) {
        echo "<h1>Bonjour, " . $_SESSION['nom_utilisateur'] . "</h1>";
    }
    ?>





<p>En attente du maitre du jeu...</p>

<h3>Gardez votre role secret</h3>




</body>
<script src="../assets/js/script_acceuil.js"></script>
</html>