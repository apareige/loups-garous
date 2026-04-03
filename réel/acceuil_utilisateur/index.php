<?php

session_start();

$_SESSION['nom_utilisateur']="nom";

header('Location: front_end/acceuil_utilisateur.php');


?>






