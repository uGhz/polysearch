<?php 


$catalogBaseUrl = "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp";

$url = $catalogBaseUrl . '?' . $_SERVER['QUERY_STRING'];

// echo $url;

$responseString = file_get_contents($url); 

echo $responseString;
?>