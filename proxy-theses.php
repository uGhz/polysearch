<?php 


// $catalogBaseUrl = "http://www2.biusante.parisdescartes.fr/theses/index.las";
$catalogBaseUrl = "http://www.biusante.parisdescartes.fr/chercher/theses/medecine.php";


$url = $catalogBaseUrl . '?' . $_SERVER['QUERY_STRING'];

// echo $url;

$responseString = file_get_contents($url); 

echo $responseString;
?>