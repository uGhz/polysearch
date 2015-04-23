/*jslint browser: true*/
/*global  $*/
// Using the module pattern for a jQuery feature
$(document).ready(function () {
    "use strict";

    /*********************************
    *   CLASS GoogleDataProvider
    *
    */
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
    
    

    function CatalogItem() {
        this.author         = null;
        this.title          = null;
        this.publisher      = null;
        this.publishedDate  = null;
        this.func           = null;
        this.sourceId       = null;
        this.documentType   = null;
        this.isbn           = null;
        this.catalogUrl     = null;
    }

    function CatalogResultSet() {
        this.currentPage = null;
        this.numberOfResults = null;
        this.results = null;
    }

    
    /*********************************
    *   CLASS CatalogDataProvider
    *
    
    - Possède une URL d'accès
    
    - Méthodes :
        - Publiques :
        --- getSearchResults
            @param  searchString  // La chaîne de recherche saisie.
            @param  pageNumber    // La page de résultats attendue
            @return resultSet     // Un objet CatalogResultSet
        --- getItemDetails
            @param  url           // Pointant sur une représentation distante et détaillée de la ressource
            @return copies        // Un tableau d'informations sur des exemplaires de la ressources

    */
    function CatalogDataProvider() {
        this.baseUrl = "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp";
    }

    CatalogDataProvider.prototype = {
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getSearchResults: function (searchString, pageNumber) {
            
            var _self = this;
            console.log("getSearchResults. searchString : " + searchString);
            
            var queryUrl = _self.buildRequest(searchString, pageNumber);
            console.log("getSearchResults. queryUrl : " + queryUrl);
            
            var promisedResults = $.Deferred();
            
            var ajaxPromise = $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: queryUrl,
                dataType: "xml",
            });
            
            ajaxPromise.done(function (response) {
                    var resultSet = _self.buildResultSet(response);
                    console.log("Records found !");
                    console.log("resultSet : " + resultSet);
                    promisedResults.resolve(resultSet);
                    // searchResultView.handleNewResultSet(resultSet);
            });
            
            ajaxPromise.always(function () {
                    console.log("The request for getSearchResults is complete!");
            });

            return promisedResults;
        },
    
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
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
        
        buildRequest: function (searchString, pageNumber) {
            
            var urlArray = [
                "proxy.php?DonneXML=true&index=",
                encodeURIComponent(".GK"),
                "&limitbox_1=",
                encodeURIComponent("$LAB7 = a or $LAB7 = c or $LAB7 = i or $LAB7 = m not $TH = *"),
                "&limitbox_3=",
                "&term=",
                encodeURIComponent(searchString)
            ];
            
            if (pageNumber) {
                urlArray = urlArray.concat([
                    "&page=",
                    encodeURIComponent(pageNumber)
                ]);
            }
            
            var url = urlArray.join("");
            
            return url;
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
    
    
    /*********************************
    *   CLASS SearchArea
    *
    *
        Classe gérant le formulaire de recherche et englobant les différentes ResultsArea
    */
    function SearchArea() {
        this._container             = $("#hipSearchArea");
        this._form                  = $("#hipSearchForm");
        this._searchResultsContainer= $("#hipSearchResults");
        
        this._statsContainer        = $("<div class='ui horizontal statistic' style='float:right;margin:1em;'><div class='value'>0</div><div class='label'>Résultats</div></div>").prependTo(this._container);
        
        this._currentRequest        = "";
        this._resultAreas            = [];
        
        var _self = this;
        
        this.init = function () {
            _self._form.submit(_self.updateCurrentRequest);
            _self._resultAreas.push(
                    new ResultsArea("Catalogue papier", this, new CatalogDataProvider())
            );
            _self._resultAreas.push(
                    new ResultsArea("Horizon/HIP", this, new CatalogDataProvider())
            );
        };
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler. 
        this.getSearchString = function () {
            return this._currentRequest;
        };
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler. 
        this.getResultsContainer = function () {
            return this._searchResultsContainer;
        };
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler. 
        this.updateStats = function () {
            var totalOfResults = 0;
            var tempResultArea = null;
            for(var i=0 ; i<_self._resultAreas.length ; i++) {
                tempResultArea = _self._resultAreas[i];
                if (tempResultArea) {
                    totalOfResults += tempResultArea.getStats();   
                }
            }
            this.setStats(totalOfResults);
        };
        
        this.updateCurrentRequest = function ( event ) {
            event.preventDefault();
            
            _self._currentRequest = _self._form.find("input[type='text']").val();
            // Notifier la chose aux ResultAreas
            var tempResultArea = null;
            for(var i=0 ; i<_self._resultAreas.length ; i++) {
                tempResultArea = _self._resultAreas[i];
                if (tempResultArea) {
                    tempResultArea.queryUpdated();   
                }
            }
        };
        
        this.setStats = function ( number ) {
            // Créer au besoin les éléments nécessaires à l'affichage des stats
            // Mettre à jour ces éléments
            this._statsContainer.children(".value").text(number);
        };
        
    }

    /*********************************
    *   CLASS ResultsArea
    *
        - Possède un pointeur dans le DOM vers le conteneur de la liste de résultats
        - Possède un pointeur dans le DOM vers le formulaire HTML de recherche
        - Possède un pointeur dans le DOM vers le conteneur des statistiques de recherche
        - Stocke la requête en cours
        - Stocke le nombre de résultats de la requête en cours
        - Stocke le numéro de la page de résultats en cours
        
        - Méthodes :
            - Publiques :
            --- updateCurrentRequest // Récupère la requête saisie par l'utilisateur
            --- setLoadingStateOn
            --- setLoadingStateOff
            --- setStats

            --- askForItemDetails
            --- askForNewResultSet
            --- handleNewItemDetails
            --- handleNewResultSet
    */
    function ResultsArea(title, searchArea, dataProvider ) {
        this._currentTotalResults   = null;
        this._currentResultsPage    = null;
        
        this._searchArea    = searchArea;
        this._dataProvider  = dataProvider;
        this._title         = title;
        this._container     = $("<div class='ui vertical segment dimmable'></div>");
        
        var titleElement    = $("<h3 class='ui header'><i class='book icon'></i>" + this._title + "</h3>");
        
        this._container.append(titleElement);
        
        this._statsContainer = $("<div class='ui tiny right floated statistic'></div>");
        this._statsContainer.append($("<div class='value'>0</div>"));
        this._statsContainer.append($("<div class='label'>Résultats</div>"));
        
        var temp = $("<div class='ui grid'></div>");
            temp.append($("<div class='twelve wide column'></div>")
                        .append(titleElement))
                .append($("<div class='four wide column'></div>")
                        .append(this._statsContainer));
        temp.appendTo(this._container);
        
/*        var _divider = $("<h4 class='ui horizontal header divider'><i class='bar chart icon'></i>Specifications</h4>");
        _divider.append(this._statsContainer);
        this._container.append(_divider);*/
        
        //this._container.append(this._statsContainer);
        
        this._container.append($("<div class='ui items'></div>"));
        
        this._container.append($("<div class='ui inverted dimmer'><div class='ui text loader'>Interrogation du catalogue...</div></div>"));

        
        var _self = this;
        

        this.askForItemDetails = function (event) {

            event.preventDefault();
            console.log("Inside askForItemDetails");

            var domItem = $(this).closest(".item");

            _self.setItemLoadingStateOn(domItem);

            var promisedResults = _self._dataProvider.getItemDetails(domItem.data("catalog-url"));
            
            promisedResults.done(function ( results ) {   
                _self.handleNewItemDetails(results, domItem);
                _self.setItemLoadingStateOff(domItem);
            });
            
            console.log("askForItemDetails is ending !");

        };
        
        this.askForMoreResults = function (event) {
            console.log("More results wanted !");

            event.preventDefault();

            var chosenPage = parseInt(_self._currentResultsPage, 10) + 1;
            // var url = _self._searchArea.getSearchString() + "&page=" + chosenPage;
            
            _self.askForResults( _self._searchArea.getSearchString(), chosenPage );
            
            console.log("askForMoreResults is ending !");
        };
        
        this.askForResults = function( request, pageNumber ) {
            
            _self.setLoadingStateOn();

            var promisedResults = _self._dataProvider.getSearchResults(request, pageNumber);
            
            promisedResults.done(function( results ) {
                console.log("askForResults received results : " + results);
                _self.handleNewResultSet( results );
                _self.setLoadingStateOff();
                _self.askForThumbnailUrl();
            });
            
            console.log("askForResults is ending !");
        };
    
        this.redirectToCatalogDetailPage = function () {
            var domItem = $(this).closest(".item");
            window.location.href = domItem.data("catalog-url");
        };
        
        this.init = function () {
            // Attacher les gestionnaires d'évènements à la liste
            _self._container.on("click", "a.header",                     _self.askForItemDetails);
            _self._container.on("click", "button.catalog-detail-link",   _self.redirectToCatalogDetailPage);
            _self._container.on("click", "button.more-results",          _self.askForMoreResults);
            
            _self._container.appendTo(_self._searchArea.getResultsContainer());
        }();
    }

    ResultsArea.prototype = {
        
        // Fonction publique, que les SearchArea sont susceptibles d'appeler.
        queryUpdated: function () {
            this.askForResults(this._searchArea.getSearchString(), 1);
        },
        
        // Fonction publique, que les SearchArea sont susceptibles d'appeler. 
        getStats: function () {
            return this._currentTotalResults;
        },
        
        setLoadingStateOn: function () {
            this._container.children(".dimmer").addClass("active");
        },

        setLoadingStateOff: function () {
            this._container.children(".dimmer").removeClass("active");
        },

        setStats: function (nResults) {
            // Créer au besoin les éléments nécessaires à l'affichage des stats
            // Mettre à jour ces éléments
            console.log("setStats called ! nResults : " + nResults);

            this._statsContainer.children(".value").text(nResults);
            this._searchArea.updateStats();
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
            var newDomItem = $("<div class='ui item dimmable'></div>");
            $("<div class='ui inverted dimmer'><div class='ui loader'></div></div>").appendTo(newDomItem);
            $("<div class='ui tiny image'><img src='images/image.png'></div>").appendTo(newDomItem);

            // Stockage de données spécifiques à l'item
            newDomItem.data("catalog-url", dataItem.catalogUrl);
            newDomItem.data("isbn", dataItem.isbn);
            
            var currentContent = $("<div class='content'></div>");
            
            $(["<a class='ui header' href='", newDomItem.data("catalog-url"), "'>", vTitle, "</a>"].join(""))
                .appendTo(currentContent);
            
            var currentDescription = ["<p>"];
            if (vAuthor) {
                currentDescription = currentDescription.concat(["<em>", vAuthor, "</em><br />"]);
            }
            if (vPublisher || vPublishedDate) {
                currentDescription = currentDescription.concat([
                                                        [vPublisher, vPublishedDate].join(", "), "."]);
            }
            currentDescription.push("</p>");
            $("<div class='description'></div>")
                .html(currentDescription.join(""))
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
                            ["<span class='ui label' data-title='Conditions de consultation' data-content='",
                             copiesArray[i].conditions,
                             "'>",
                             copiesArray[i].library,
                             "<span class='detail'>Cote : ",
                             copiesArray[i].cote,
                             "</span></span>"]);
                }
            }
            
            
            extraElement.html(detailsMarkup.join(""));
            
            extraElement.children("span.label").popup();
            console.log("Details added !");

            $("<button class='ui tiny right floated button catalog-detail-link'>Voir dans le catalogue<i class='right chevron icon'></i></button>").appendTo(extraElement);

            extraElement.appendTo(currentContainer);
            
            console.log("handleDetails is finished !");
        },

        handleNewResultSet: function (resultSet) {
            console.log("handleNewResultSet has been called !");

            // Construire les items
            // Supprimer les items précédents
            // Attacher les nouveaux items à leur conteneur
            // Mettre à jour les statistiques

            console.log("Results handled !");

            this._currentTotalResults  = parseInt(resultSet.numberOfResults, 10);
            this._currentResultsPage   = resultSet.currentPage;

            console.log("this._currentTotalResults : "  + this._currentTotalResults);
            console.log("this._currentResultsPage : "   + this._currentResultsPage);

            // Récupérer, ligne à ligne, les données,
            // les mettre en forme et les attacher au conteneur d'items
            var tempDomItem = null;
            
            var listRoot = $("<div class='ui items'></div>");
            var resultsArray = resultSet.results;
            for (var i = 0, len = resultsArray.length; i < len; i++) {
                tempDomItem = this.buildResultItem(resultsArray[i]);
                tempDomItem.appendTo(listRoot);
            }

            // S'il s'agit d'un nouvel ensemble de résultats, réinitialiser le conteneur de résultats
            if (this._currentResultsPage < 2) {
                this._container.children(".items").empty();
                if (this._currentTotalResults > 0) {
                    // listRoot.prepend($("<div class='ui divider'></div>"));
                }
            }
            
            if (this._currentResultsPage > 1) {
                this._container.find(".items").append(listRoot.children(".item"));
            } else {
                this._container.find(".items").replaceWith(listRoot);
            }
            
            //Mettre à jour le bouton "Plus de résultats"
            // Supprimer le bouton "Plus de résultats".
            this._container.find("button.more-results").remove();

            // S'il existe des résultats non encore affichés, insérer le bouton "Plus de résultats"
            if (Math.ceil(this._currentTotalResults / 20) > this._currentResultsPage) {
                $("<button class='fluid ui button more-results'>Plus de résultats</button>").appendTo(this._container);
            }
            
            // Mettre à jour les statistiques de recherche
            this.setStats(this._currentTotalResults);
        },
        
        askForThumbnailUrl: function() {
            var lastDomItems = this._container.children(".items").last().children(".item");
            
            var isbnArray = [];
            
            lastDomItems.each(
                function () {
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
                var currentItem = null;
                lastDomItems.each(
                    function () {
                        currentItem = $(this);
                        tempIsbn = currentItem.data("isbn");
                        if ( tempIsbn ) {
                            tempUrl = results[tempIsbn];
                            if ( tempUrl ) {
                                currentItem.children(".image").children("img").attr("src", tempUrl);
                            }
                        }
                    }
                );

            });
        }
    };
    
    var mySa = new SearchArea();
    mySa.init();

});