<?php 


$catalogBaseUrl = "http://www2.biusante.parisdescartes.fr/theses/index.las";

$url = $catalogBaseUrl . '?' . $_SERVER['QUERY_STRING'];

// echo $url;

$responseString = file_get_contents($url); 

echo $responseString;
?>