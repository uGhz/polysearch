/*jslint browser: true*/
/*global  $*/
// Using the module pattern for a jQuery feature
$(document).ready(function () {
    "use strict";

    function GoogleBooksDataProvider() {

    }
    
    GoogleBooksDataProvider.prototype = {
        
        /**
        getThumbnailsUrl récupère les URL des thumbnails correspondant à des ISBN
        
        @param Un tableau d'ISBN
        @return Une map "ISBN:url de thumbnail";
        */
        getThumbnailsUrl: function ( isbnArray ) {
            var requestUri = ["http://books.google.com/books?jscmd=viewapi&bibkeys=",
                              isbnArray.join(","),
                              "&callback=ProcessGBSBookInfo"].join("");
            
            var promisedUrls = $.Deferred();
            
            var ajaxPromise = $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: requestUri,
                dataType: "jsonp"
            });
            
            ajaxPromise.done(function ( response ) {
                console.log("--- Réponse ---");
                console.log(response);
                
                var resultMap = {};
                

                
                for (var refKey in response) {
                    resultMap[refKey] = response[refKey].thumbnail_url;
                }
                console.log("--- resultMap ---");
                console.log(resultMap);
                
                promisedUrls.resolve(resultMap);
            });
            
            return promisedUrls;
        }
    };
    
    
    /**
    - Possède une URL d'accès
    
    - Possède les méthodes :
    
        - getSearchResults
            @param string request // Fragment de query string HTTP
            @return Array d'Items
            @return int currentPage
            @return int nTotalResults
            
        - getItemDetails
            @param string documentId // ou url, domItem...
            @return EnhancedItem
*/

    function CatalogItem() {
        this.author = null;
        this.title = null;
        this.publisher = null;
        this.publishedDate = null;
        this.func = null;
        this.sourceId = null;
        this.documentType = null;
        this.isbn = null;
        this.catalogUrl = null;
    }

    function CatalogResultSet() {
        this.currentPage = null;
        this.numberOfResults = null;
        this.results = null;
    }

    function CatalogDataProvider() {
        this.baseUrl = "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp";
    }

    CatalogDataProvider.prototype = {
        getSearchResults: function (queryString) {
            
            var _self = this;
            console.log("getSearchResults. urlParam : " + queryString);
            
            var promisedResults = $.Deferred();
            
            var ajaxPromise = $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: queryString,
                dataType: "xml",
            });
            
            ajaxPromise.done(function (response) {
                    var resultSet = _self.buildResultSet(response);
                    console.log("Records found !");
                    promisedResults.resolve(resultSet);
                    // searchResultView.handleNewResultSet(resultSet);
            });
            
            ajaxPromise.always(function () {
                    console.log("The request for getSearchResults is complete!");
            });

            return promisedResults;
        },

        getItemDetails: function ( url ) {

            var _self = this;
            var promisedResults = $.Deferred();
            
            var queryString = url.slice(url.indexOf("?") + 1);
            console.log("Query String : " + queryString);
            
            var ajaxPromise = $.ajax({
                url: "proxy.php?DonneXML=true&" + queryString,
                dataType: "xml"
            });
            
            
            ajaxPromise.done(function (response) {
                    var copies = _self.buildDetailedDataItem(response);
                    console.log("Copies found !");
                    promisedResults.resolve(copies);
            });
            
            
            ajaxPromise.always(function () {
                console.log("Within callback of promise.");
            });
            
            return promisedResults;
        },

        buildResultSet: function (rawXmlData) {
            console.log("Results set building !");

            // var listRoot = $("<div class='ui items'></div>");
            var resultSet = new CatalogResultSet();

            resultSet.numberOfResults = $(rawXmlData).find('searchresponse>yoursearch>hits').text();
            resultSet.currentPage = $(rawXmlData).find('searchresponse>yoursearch>view>currpage').text();

            // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
            var tempItems = [];
            var tempDataItem = null;

            var _self = this;
            $(rawXmlData).find('searchresponse>summary>searchresults>results>row').each(function (index, value) {
                tempDataItem = _self.buildDataItem($(value));
                tempItems.push(tempDataItem);
            });

            resultSet.results = tempItems;
            console.log("Results set is built !");
            return resultSet;
        },

        buildDataItem: function (rawXmlData) {
            var item = new CatalogItem();

            item.title          = rawXmlData.find('TITLE>data>text').text();
            item.author         = rawXmlData.find('AUTHOR>data>text').text();
            item.publisher      = rawXmlData.find('PUBLISHER>data>text').text();
            item.publishedDate  = rawXmlData.find('PUBDATE>data>text').text();
            item.sourceId       = rawXmlData.find('sourceid').text();
            item.func           = rawXmlData.find('TITLE>data>link>func').text();
            item.isbn           = rawXmlData.find('isbn').text();
            item.catalogUrl     = this.baseUrl + "?uri=" + item.func + "&amp;source=" + item.sourceId;

            var vDocumentType   = rawXmlData.find('cell:nth-of-type(14)>data>text').text();
            if (vDocumentType) {
                item.documentType = vDocumentType.slice(vDocumentType.lastIndexOf(' ') + 1, vDocumentType.length - "$html$".length);
            }

            return item;
        },

        buildDetailedDataItem: function (rawXmlData) {

            var copies = [];
            var currentCopy = null;
            var tempString = "";
            
            $(rawXmlData).find('searchresponse>items>searchresults>results>row').each(function () {
                
                var currentNode = $(this);
                currentCopy = {};

                tempString = currentNode.find('LOCALLOCATION>data>text').text();
                
                if (tempString.indexOf("Médecine") != -1) {
                    tempString = "Médecine";
                } else if (tempString.indexOf("Pharmacie") != -1) {
                    tempString = "Pharmacie";
                } else {
                    tempString = "";
                }
                currentCopy.library = tempString;

                currentCopy.precisePlace    = currentNode.find('TEMPORARYLOCATION:first-of-type>data>text').text();
                currentCopy.cote            = currentNode.find('CALLNUMBER>data>text').text();
                currentCopy.conditions      = currentNode.find('cell:nth-of-type(5)>data>text').text();

                copies.push(currentCopy);
                console.log("Details added !");
            });

            return copies;

        }

    };

    /*
        - Possède un pointeur dans le DOM vers le conteneur de la liste de résultats
        - Possède un pointeur dans le DOM vers le formulaire HTML de recherche
        - Possède un pointeur dans le DOM vers le conteneur des statistiques de recherche
        - Stocke la requête en cours
        - Stocke le nombre de résultats de la requête en cours
        - Stocke le numéro de la page de résultats en cours
        
        - Possède les méthodes :
            - setLoadingStateOn
            - setLoadingStateOff
            - setStats
            - updateCurrentRequest // Récupère et stocke la requête saisie par l'utilisateur
            - askForItemDetails
            - askForNewResultSet
            - handleNewItemDetails
            - handleNewResultSet
    */
    function SearchResultsView() {
        this._searchArea            = $("#hipSearchArea");
        this._form                  = $("#hipSearchForm");
        this._statsContainer        = $("#hipSearchArea").children(".statistic");
        this._searchResultsContainer= $("#hipSearchResults");
        
        this._currentRequest        = "";
        this._currentTotalResults   = null;
        this._currentResultsPage    = null;
        this._catalogDataProvider   = new CatalogDataProvider();
        
        var _self = this;
        

        this.askForItemDetails = function (event) {

            event.preventDefault();
            console.log("Inside askForItemDetails");

            var domItem = $(this).closest(".item");

            _self.setItemLoadingStateOn(domItem);

            var promisedResults = _self._catalogDataProvider.getItemDetails(domItem.data("catalog-url"));
            
            promisedResults.done(function ( results ) {   
                _self.handleNewItemDetails(results, domItem);
                _self.setItemLoadingStateOff(domItem);
            });
            
            console.log("askForItemDetails is ending !");

        };

        this.askForNewResultSet = function (event) {
            console.log("Inside askForNewResultSet");
            event.preventDefault();
            
            _self.updateCurrentRequest();
            _self.askForResults(_self._currentRequest);
            
            console.log("askForNewResultSet is ending !");
        };
        
        this.askForMoreResults = function (event) {
            console.log("More results wanted !");

            event.preventDefault();

            var chosenPage = parseInt(_self._currentResultsPage, 10) + 1;
            var url = _self._currentRequest + "&page=" + chosenPage;
            
            _self.askForResults( url );
            
            console.log("askForMoreResults is ending !");
        };
        
        this.askForResults = function( request ) {
            _self.setLoadingStateOn();
            var promisedResults = _self._catalogDataProvider.getSearchResults(request);
            
            promisedResults.done(function( results ) {
                _self.handleNewResultSet( results );
                _self.setLoadingStateOff();
                _self.askForThumbnailUrl();
            });
            
            console.log("askForResults is ending ! URL : " + this.href);
        };
    
        this.redirectToCatalogDetailPage = function () {
            var domItem = $(this).closest(".item");
            window.location.href = domItem.data("catalog-url");
        };
    }

    SearchResultsView.prototype = {

        setLoadingStateOn: function () {
            this._searchArea.children(".dimmer").addClass("active");
        },

        setLoadingStateOff: function () {
            this._searchArea.children(".dimmer").removeClass("active");
        },

        setStats: function (nResults) {
            // Créer au besoin les éléments nécessaires à l'affichage des stats
            // Mettre à jour ces éléments
            var statsContainer = this._searchArea.children(".statistic");
            statsContainer.detach();
            statsContainer.empty();
            $("<div class='value'>" + nResults + "</div>").appendTo(statsContainer);
            $("<div class='label'>Résultats</div>").appendTo(statsContainer);
            statsContainer.prependTo(this._searchArea);
        },

        updateCurrentRequest: function () {
            this._currentRequest = "proxy.php?DonneXML=true&" + this._form.serialize();
        },

        init: function () {
            this._form.submit(this.askForNewResultSet);
        },

        buildResultItem: function (dataItem) {

            var vTitle = dataItem.title;
            var vAuthor = dataItem.author;
            var vPublisher = dataItem.publisher;
            var vPublishedDate = dataItem.publishedDate;
            /*var vSourceId = dataItem.sourceId;
            var vFunc = dataItem.func;
            var vDocumentType = dataItem.documentType;*/

            // Création de l'objet "Item".
            var newDomItem = $("<div class='ui item segment'></div>");
            $("<div class='ui inverted dimmer'><div class='ui loader'></div></div>").appendTo(newDomItem);
            $("<div class='ui tiny image'><img src='images/image.png'></div>").appendTo(newDomItem);
            // $("<div class='ui tiny image'><span title='ISBN:" +  + "' class='gbsthumbnail'></span></div>").appendTo(newDomItem);
            
            // Stockage de données spécifique à l'item
            newDomItem.data("catalog-url", dataItem.catalogUrl);
            newDomItem.data("isbn", dataItem.isbn);
            
            var currentContent = $("<div class='content'></div>");
            
            $(["<a class='header' href='", newDomItem.data("catalog-url"), "'>", vTitle, "</a>"].join(""))
                .appendTo(currentContent);
            
            var currentDescription = ["<p>"];
            if (vAuthor) {
                currentDescription = currentDescription.concat(["<em>", vAuthor, "</em><br />"]);
            }
            currentDescription = currentDescription.concat([vPublisher, ", ", vPublishedDate, ".</p>"]).join("");

            $("<div class='description'></div>")
                .html(currentDescription)
                .appendTo(currentContent);

            currentContent.appendTo(newDomItem);

            return newDomItem;
        },

        setItemLoadingStateOn: function (domItem) {
            domItem.find(".dimmer").addClass("active");
        },

        setItemLoadingStateOff: function (domItem) {
            domItem.find(".dimmer").removeClass("active");
        },

        handleNewItemDetails: function (copiesArray, domItem) {
            console.log("handleNewItemDetails has been called !");

            var currentContainer = domItem.find(".content");

            currentContainer.find(".extra").remove();
            
            var extraElement = $("<div class='extra'></div>");
            var detailsMarkup = [];
            for (var i = 0, len = copiesArray.length; i < len; i++) {
                if (copiesArray[i]) {
                    
                    detailsMarkup = detailsMarkup.concat(
                            ["<span class='ui label'>",
                             copiesArray[i].library,
                             "<span class='detail'>Cote : ",
                             copiesArray[i].cote,
                             "</span></span>"]);
                }
            }
            
            extraElement.html(detailsMarkup.join(""));
            console.log("Details added !");

            $("<button class='ui tiny right floated button catalog-detail-link'>Voir dans le catalogue<i class='right chevron icon'></i></button>").appendTo(extraElement);

            extraElement.appendTo(currentContainer);
            
            console.log("handleDetails is finished !");
        },

        handleNewResultSet: function (resultSet) {
            console.log("handleNewResultSet has been called !");

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

            var listRoot = $("<div class='ui items'></div>");

            var vNResults = resultSet.numberOfResults;
            var vCurrentPageIndex = resultSet.currentPage;

            console.log("vNResults : " + vNResults);
            console.log("vCurrentPageIndex : " + vCurrentPageIndex);

            // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
            var tempDomItem = null;

            var resultsArray = resultSet.results;
            for (var i = 0, len = resultsArray.length; i < len; i++) {
                tempDomItem = this.buildResultItem(resultsArray[i]);
                tempDomItem.appendTo(listRoot);
            }

            // Mettre à jour les statistiques de recherche
            this.setStats(vNResults);

            // Supprimer le bouton "Plus de résultats".
            this._searchResultsContainer.find("button.more-results").remove();

            // S'il existe des résultats non encore affichés, insérer le bouton "Plus de résultats"
            if (Math.ceil(vNResults / 20) > vCurrentPageIndex) {
                $("<button class='fluid ui button more-results'>Plus de résultats</button>").appendTo(listRoot);
            }

            // S'il s'agit d'un nouvel ensemble de résultats, réinitialiser le conteneur de résultats
            if (vCurrentPageIndex < 2) {
                this._searchResultsContainer.empty();
                if (vNResults > 0) {
                    listRoot.prepend($("<div class='ui divider'></div>"));
                }
            }
            
            // Attacher les gestionnaires d'évènements à la liste
            listRoot.on("click", "a.header", this.askForItemDetails);
            listRoot.on("click", "button.catalog-detail-link", this.redirectToCatalogDetailPage);
            listRoot.on("click", "button.more-results", this.askForMoreResults);
            
            // redirectToCatalogDetailPage

            this._searchResultsContainer.append(listRoot);
            this._currentResultsPage = vCurrentPageIndex;
            // this.setLoadingStateOff();

        },
        
        askForThumbnailUrl: function() {
            var lastDomItems = this._searchResultsContainer.children(".items").last().children(".item");
            
            var isbnArray = [];
            
            lastDomItems.each(
                function (index, element) {
                    isbnArray.push($(this).data("isbn"));
                }
            );
            
            var gbdp = new GoogleBooksDataProvider();
            var promisedResults = gbdp.getThumbnailsUrl(isbnArray);
            
            promisedResults.done(function( results ) {
                console.log("askForThumbnailUrl Results");
                console.log(results);
                
                var tempIsbn = "";
                var tempUrl = "";
                lastDomItems.each(
                    function (index, element) {
                        
                        tempIsbn = $(this).data("isbn");
                        if (tempIsbn) {
                            tempUrl = results[tempIsbn];
                            if ( tempUrl ) {
                                $(this).children(".image").children("img").attr("src", tempUrl);
                            }
                        }
                    }
                );

            });
        }
    };

    var mySrv = new SearchResultsView();
    mySrv.init();

    
    var gbsd = new GoogleBooksDataProvider();
    gbsd.getThumbnailsUrl( ["0596000278","00-invalid-isbn","ISBN0765304368","0439554934"]);
});