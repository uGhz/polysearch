// Using the module pattern for a jQuery feature
$( document ).ready(function() {
    var feature = (function() {
        
        /**
            Eléments utiles à stocker :
            - Pointeur vers le formulaire
            - Pointeur vers le conteneur englobant le formulaire et la zone d'affichage des résultats
            - L'URL de base permettant les requêtes
        
        
        
        */
        var searchForm              = $( "#hipSearchForm" );
        var searchAreaContainer     = $( ".searchWrapper" );
        var searchResultsContainer  = null;
        var baseUrl = "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp";
        
        var init = function() {
            // Attacher à l'évènement "submit" du formulaire de recherche le gestionnaire approprié.
            searchForm.submit(function (event) {
                console.log("Form submitted. !");
                event.preventDefault();
                
                searchForm.prop("data-current-search-url", "proxy.php?DonneXML=true&" + searchForm.serialize());            
                    launchSearch(searchForm.prop("data-current-search-url"));
            });
        }
        
        var launchSearch = function(urlParam) {
            // Récupérer les données saisies par l'utilisateur
            // Invoquer et paramétrer Ajax
            
            // $(".searchWrapper>.dimmer").addClass("active");
            setLoadingStateOn();
                            
            console.log("requestSearchResults. urlParam : " + urlParam);
                            
            $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: urlParam,
                
                // Whether this is a POST or GET request
                type: "GET",
                
                // The type of data we expect back
                dataType: "xml",

                // Code to run if the request succeeds;
                // the response is passed to the function
                success: handleResults,

                // Code to run if the request fails; the raw request and
                // status codes are passed to the function
                error: null,

                // Code to run regardless of success or failure
                complete: function (xhr, status) {
                    // alert( "The request is complete!" );
                    setLoadingStateOff();
                }
            });
            
        }
        
        var handleResults = function( response ) {
            // Effacer les résultats précédents s'ils existent
            // Effacer les statistiques de recherche précédentes si elles existent
            // Afficher un loader
            // Lancer la requête Ajax
            // Traiter la réponse du catalogue
            //   - Mettre à jour les statistiques
            //   - Créer si besoin  un conteneur de résultats
            //   - Créer si besoin les items de résultats
            // Ôter le loader
            
            
            
             console.log("Results handled !");
            // console.log(response);
            // var baseUrl = "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp";
            var listRoot = $("<div class='ui items'></div>");

            var vNResults           = $(response).find('searchresponse>yoursearch>hits').text();
            var vCurrentPageIndex   = $(response).find('searchresponse>yoursearch>view>currpage').text();

            $(response).find('searchresponse>summary>searchresults>results>row').each(function () {
                var vTitle = $(this).find('TITLE>data>text').text();
                var vAuthor = $(this).find('AUTHOR>data>text').text();
                var vPublisher = $(this).find('PUBLISHER>data>text').text();
                var vPublishedDate = $(this).find('PUBDATE>data>text').text();
                var vSourceId = $(this).find('sourceid').text();
                var vFunc = $(this).find('TITLE>data>link>func').text();
                var vDocumentType = $(this).find('cell:nth-of-type(14)>data>text').text();

                if (vDocumentType) {
                    vDocumentType = vDocumentType.slice(vDocumentType.lastIndexOf(' ') + 1, vDocumentType.length - "$html$".length);
                }

                // Création de l'objet "Item".
                var currentItem = $("<div class='ui item segment'></div>");
                $("<div class='ui inverted dimmer'><div class='ui loader'></div></div>").appendTo(currentItem);
                $("<div class='ui tiny image'><img src='images/image.png'></div>").appendTo(currentItem);

                var currentContent = $("<div class='content'></div>");
                // currentItem.append(listRoot);
                $("<a class='header' href='" + baseUrl + "?uri=" + vFunc + "&amp;source=" + vSourceId + "'>" + vTitle + "</a>").on("click", launchDetailsRetrieval).appendTo(currentContent);

                var currentDescription = (vAuthor ? "<em>" + vAuthor + "</em><br />" : "") + vPublisher + ", " + vPublishedDate + ".";
                currentDescription = "<p>" + currentDescription + "</p>";
                $("<div class='description'></div>")
                    .html(currentDescription)
                    .appendTo(currentContent);

                currentContent.appendTo(currentItem);
                currentItem.appendTo(listRoot);


            });

            $(".searchWrapper>.statistic").empty();
            $("<div class='value'>" + vNResults + "</div>").appendTo(".searchWrapper>.statistic");
            $("<div class='label'>Résultats</div>").appendTo(".searchWrapper>.statistic");

            $("#hipSearchResults").find("button.more-results").remove();
            console.log("Math.ceil(vNResults / 20) : " + Math.ceil(vNResults / 20));
            console.log("vCurrentPageIndex : " + vCurrentPageIndex);
            if (Math.ceil(vNResults / 20) > vCurrentPageIndex) {
                console.log("There are more results to fetch.");
                $("<button class='fluid ui button more-results'>Plus de résultats</button>")
                    .click(function () {
                        var chosenPage = parseInt($("#hipSearchResults").attr("data-current-page"), 10) + 1;
                        var url = $("#hipSearchForm").prop("data-current-search-url") + "&page=" + chosenPage;
                        requestSearchResults(url);        
                    })
                    .appendTo(listRoot);
            } else {
                console.log("No more results to fetch.");  
            }

            // $(".searchWrapper>.statistic>.value").html(vNResults).css("display", "block");
            if (vCurrentPageIndex < 2) {
                $("#hipSearchResults").empty();
                if (vNResults > 0) {
                    $("#hipSearchResults").append($("<div class='ui divider'></div>"));
                }
            }

            $("#hipSearchResults").append(listRoot);
            $("#hipSearchResults").attr("data-current-page", vCurrentPageIndex);

            // $(".searchWrapper>.dimmer").removeClass("active");
            // listRoot.appendTo("#hipSearchResults");

            
            
        }
        
        var setStats = function( nResults ) {
            // Créer au besoin les éléments nécessaires à l'affichage des stats
            // Mettre à jour ces éléments
        }
            
        var setLoadingStateOn = function() {
            searchAreaContainer.children(".dimmer").addClass("active");
        }
        
        var setLoadingStateOff = function() {
            searchAreaContainer.children(".dimmer").removeClass("active");
        }
        
        var newResultItem = function() {
            
        }
        
        
        var launchDetailsRetrieval = function( event ) {
            event.preventDefault();
            console.log("requestDetails called ! URL : " + this.href);
            $(this).closest(".item").find(".dimmer").addClass("active");
            requestDetails(this);
        }
        
        var requestDetails = function( element ) {

            var queryString = element.href;
            queryString = queryString.slice(queryString.indexOf("?") + 1);
            console.log("Query String : " + queryString);
            $.ajax({

                // The URL for the request
                url: "proxy.php?DonneXML=true&" + queryString,

                // Whether this is a POST or GET request
                type: "GET",

                // The type of data we expect back
                dataType: "xml",

                context: element,

                // Code to run if the request succeeds;
                // the response is passed to the function
                success: handleDetails,

                // Code to run if the request fails; the raw request and
                // status codes are passed to the function
                error: null,

                // Code to run regardless of success or failure
                complete: function (xhr, status) {
                    console.log("The request for details is complete!");
                }
            });

        }
        
        
        var handleDetails = function( response ) {
            console.log("handleDetails is called !");
            console.log("this : " + this);
            //$(this).closest(".item").css({ "background-color": "#fed", "border-left": "5px solid #ccc" });
            var targetUrl = this.href;
            var currentItem = $(this).closest(".item");

            // $(this).closest(".item").find(".dimmer").addClass("active");


            var currentContainer = currentItem.find(".content");

            // if (!currentContainer.find(".extra")) {
                currentContainer.find(".extra").remove();
            // }
            var extraElement = $("<div class='extra'></div>");

            $(response).find('searchresponse>items>searchresults>results>row').each(function () {
                var vLibrary = $(this).find('LOCALLOCATION>data>text').text();
                if (vLibrary.indexOf("Médecine") != -1) {
                    vLibrary = "Médecine";
                } else if (vLibrary.indexOf("Pharmacie") != -1) {
                    vLibrary = "Pharmacie";
                } else {
                    vLibrary = "";
                }
                var vPrecisePlace = $(this).find('TEMPORARYLOCATION:first-of-type>data>text').text();
                var vCote = $(this).find('CALLNUMBER>data>text').text();
                var vConditions = $(this).find('cell:nth-of-type(5)>data>text').text();

                $("<span class='detail'>Cote : " + vCote + "</span>").appendTo($("<span class='ui label'>" + vLibrary + "</span>").appendTo(extraElement));

                console.log("Details added !");
            });

            var catalogButton = $("<button class='ui tiny right floated button'>Voir dans le catalogue<i class='right chevron icon'></i></button>");
            catalogButton.click(function () {
                window.location.href = targetUrl;
            });
            catalogButton.appendTo(extraElement);
            extraElement.appendTo(currentContainer);

            currentItem.find(".dimmer").removeClass("active");
            console.log("handleDetails is finished !");

        }
        
        /*
        var items = $( "#myFeature li" );
        var container = $( "<div class='container'></div>" );
        var currentItem = null;
        var urlBase = "/foo.php?item=";
 
        var createContainer = function() {
            var item = $( this );
            var _container = container.clone().appendTo( item );
            item.data( "container", _container );
        };
 
        var buildUrl = function() {
            return urlBase + currentItem.attr( "id" );
        };
 
        var showItem = function() {
            currentItem = $( this );
            getContent( showContent );
        };
 
        var showItemByIndex = function( idx ) {
            $.proxy( showItem, items.get( idx ) );
        };
 
        var getContent = function( callback ) {
            currentItem.data( "container" ).load( buildUrl(), callback );
        };
 
        var showContent = function() {
            currentItem.data( "container" ).show();
            hideContent();
        };
 
        var hideContent = function() {
            currentItem.siblings().each(function() {
                $( this ).data( "container" ).hide();
            });
        };
 
        items.each( createContainer ).click( showItem );
 
        return {
            showItemByIndex: showItemByIndex
        };
        */
        
        init();
    })();
 
    // feature.showItemByIndex( 0 );
});