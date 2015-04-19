/*jslint browser: true*/
/*global  $*/
// Using the module pattern for a jQuery feature
$(document).ready(function () {
    "use strict";

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
        getSearchResults: function (queryString, searchResultView) {

            console.log("getSearchResults. urlParam : " + queryString);

            $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: queryString,

                // Whether this is a POST or GET request
                type: "GET",

                // The type of data we expect back
                dataType: "xml",

                context: this,

                // Code to run if the request succeeds;
                // the response is passed to the function
                success: function (response) {
                    console.log("Inside Ajax success !");
                    console.log("this : " + this);
                    var resultSet = this.buildResultSet(response);
                    console.log("Records found !");
                    searchResultView.updateSearchResults(resultSet);
                },

                // Code to run if the request fails; the raw request and
                // status codes are passed to the function
                error: null,

                // Code to run regardless of success or failure
                complete: function () {
                    console.log("The request for getSearchResults is complete!");
                    // mySrv.setLoadingStateOff();
                }
            });


        },

        getItemDetails: function (url, domItem, searchResultView) {

            // var queryString = element.href;
            var queryString = url.slice(url.indexOf("?") + 1);
            console.log("Query String : " + queryString);
            $.ajax({

                // The URL for the request
                url: "proxy.php?DonneXML=true&" + queryString,

                // Whether this is a POST or GET request
                type: "GET",

                // The type of data we expect back
                dataType: "xml",

                context: this,

                // Code to run if the request succeeds;
                // the response is passed to the function
                success: function (response) {
                    console.log("Inside Ajax success !");
                    console.log("this : " + this);
                    var copies = this.buildDetailedDataItem(response);
                    console.log("Copies found !");
                    searchResultView.updateItem(copies, domItem);
                },

                // Code to run if the request fails; the raw request and
                // status codes are passed to the function
                error: null,

                // Code to run regardless of success or failure
                complete: function () {
                    console.log("The request for details is complete!");
                }
            });
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
                console.log("this : " + _self);
                tempDataItem = _self.buildDataItem($(value));
                tempItems.push(tempDataItem);
            });

            resultSet.results = tempItems;
            console.log("Results set is built !");
            return resultSet;
        },

        buildDataItem: function (rawXmlData) {
            var item = new CatalogItem();

            item.title = rawXmlData.find('TITLE>data>text').text();
            item.author = rawXmlData.find('AUTHOR>data>text').text();
            item.publisher = rawXmlData.find('PUBLISHER>data>text').text();
            item.publishedDate = rawXmlData.find('PUBDATE>data>text').text();
            item.sourceId = rawXmlData.find('sourceid').text();
            item.func = rawXmlData.find('TITLE>data>link>func').text();
            item.isbn = rawXmlData.find('isbn').text();
            item.catalogUrl = this.baseUrl + "?uri=" + item.func + "&amp;source=" + item.sourceId;

            var vDocumentType = rawXmlData.find('cell:nth-of-type(14)>data>text').text();
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
                currentCopy = {};

                tempString = $(this).find('LOCALLOCATION>data>text').text();
                if (tempString.indexOf("Médecine") != -1) {
                    tempString = "Médecine";
                } else if (tempString.indexOf("Pharmacie") != -1) {
                    tempString = "Pharmacie";
                } else {
                    tempString = "";
                }

                currentCopy.library = tempString;

                currentCopy.precisePlace = $(this).find('TEMPORARYLOCATION:first-of-type>data>text').text();
                currentCopy.cote = $(this).find('CALLNUMBER>data>text').text();
                currentCopy.conditions = $(this).find('cell:nth-of-type(5)>data>text').text();

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
            - askForSearchResults
            - updateItem
            - updateSearchResults
    */
    function SearchResultsView(resultsContainer, form, statsContainer, currentRequest, currentTotalResults, currentResultsPage, oneCatalogDataProvider) {
        this._resultsContainer = resultsContainer;
        this._form = form;
        this._statsContainer = statsContainer;
        this._currentRequest = currentRequest;
        this._currentTotalResults = currentTotalResults;
        this._currentResultsPage = currentResultsPage;
        this._catalogDataProvider = oneCatalogDataProvider;

        var _self = this;

        this.askForItemDetails = function (event) {

            event.preventDefault();
            console.log("Inside askForItemDetails");
            console.log("this : " + this);
            console.log("event : " + event);

            var domItem = $(this).closest(".item");

            _self.setItemLoadingStateOn(domItem);

            _self._catalogDataProvider.getItemDetails(this.href, domItem, _self);

            console.log("askForItemDetails is ending ! URL : " + this.href);

        };

        this.askForSearchResults = function (event) {
            console.log("Form submitted. !");

            event.preventDefault();
            console.log("Inside askForSearchResults");

            _self.setLoadingStateOn();

            _self.updateCurrentRequest();

            _self._catalogDataProvider.getSearchResults(_self._currentRequest, _self);

            console.log("askForSearchResults is ending ! URL : " + this.href);
        };

        this.askForNextSearchResults = function (event) {
            console.log("Next results asked !");

            event.preventDefault();

            _self.setLoadingStateOn();

            var chosenPage = _self._currentResultsPage + 1;
            var url = _self._currentRequest + "&page=" + chosenPage;

            _self._catalogDataProvider.getSearchResults(url, _self);

            console.log("askForSearchResults is ending ! URL : " + this.href);
        };
    }

    SearchResultsView.prototype = {

        setLoadingStateOn: function () {
            this._resultsContainer.children(".dimmer").addClass("active");
        },

        setLoadingStateOff: function () {
            this._resultsContainer.children(".dimmer").removeClass("active");
        },

        setStats: function (nResults) {
            // Créer au besoin les éléments nécessaires à l'affichage des stats
            // Mettre à jour ces éléments
            var statsContainer = this._resultsContainer.children(".statistic");
            statsContainer.detach();
            statsContainer.empty();
            $("<div class='value'>" + nResults + "</div>").appendTo(statsContainer);
            $("<div class='label'>Résultats</div>").appendTo(statsContainer);
            statsContainer.prependTo(this._resultsContainer);
        },

        updateCurrentRequest: function () {
            this._currentRequest = "proxy.php?DonneXML=true&" + this._form.serialize();
        },

        init: function () {
            this._form.submit(this.askForSearchResults);
        },

        buildResultItem: function (dataItem) {

            var vTitle = dataItem.title;
            var vAuthor = dataItem.author;
            var vPublisher = dataItem.publisher;
            var vPublishedDate = dataItem.publishedDate;
            var vSourceId = dataItem.sourceId;
            var vFunc = dataItem.func;
            var vDocumentType = dataItem.documentType;
            var vIsbn = dataItem.isbn;

            // Création de l'objet "Item".
            var newDomItem = $("<div class='ui item segment'></div>");
            $("<div class='ui inverted dimmer'><div class='ui loader'></div></div>").appendTo(newDomItem);
            $("<div class='ui tiny image'><img src='images/image.png'></div>").appendTo(newDomItem);
            // $("<div class='ui tiny image'><span title='ISBN:" +  + "' class='gbsthumbnail'></span></div>").appendTo(newDomItem);

            var currentContent = $("<div class='content'></div>");

            $("<a class='header' href='" + dataItem.catalogUrl + "'>" + vTitle + "</a>")
                .on("click", this.askForItemDetails)
                .appendTo(currentContent);

            var currentDescription = (vAuthor ? "<em>" + vAuthor + "</em><br />" : "") + vPublisher + ", " + vPublishedDate + ".";
            currentDescription = "<p>" + currentDescription + "</p>";

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

        updateItem: function (copiesArray, domItem) {
            console.log("updateItem has been called !");

            var currentContainer = domItem.find(".content");

            currentContainer.find(".extra").remove();
            var extraElement = $("<div class='extra'></div>");

            for (var i = 0, len = copiesArray.length; i < len; i++) {
                if (copiesArray[i]) {

                    $("<span class='detail'>Cote : " + copiesArray[i].cote + "</span>")
                        .appendTo($("<span class='ui label'>" + copiesArray[i].library + "</span>")
                            .appendTo(extraElement));

                }
            }
            console.log("Details added !");

            var catalogButton = this.buildItemCatalogButton(domItem);
            catalogButton.appendTo(extraElement);

            extraElement.appendTo(currentContainer);

            this.setItemLoadingStateOff(domItem);
            // domItem.find(".dimmer").removeClass("active");
            console.log("handleDetails is finished !");

        },

        buildItemCatalogButton: function (domItem) {
            var targetUrl = domItem.find("a").prop("href");
            var catalogButton = $("<button class='ui tiny right floated button'>Voir dans le catalogue<i class='right chevron icon'></i></button>");
            catalogButton.click(function () {
                window.location.href = targetUrl;
            });

            return catalogButton;
        },

        updateSearchResults: function (resultSet) {
            console.log("updateSearchResults has been called !");

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

            var searchResultsContainer = $("#hipSearchResults");
            searchResultsContainer.find("button.more-results").remove();

            // S'il existe des résultats non encore affichés, insérer le bouton "Plus de résultats"
            if (Math.ceil(vNResults / 20) > vCurrentPageIndex) {
                console.log("There are more results to fetch.");

                var _self = this;
                $("<button class='fluid ui button more-results'>Plus de résultats</button>")
                    .click(function (event) {
                        _self.askForNextSearchResults(event);
                    })
                    .appendTo(listRoot);

            } else {
                console.log("No more results to fetch.");
            }

            // S'il s'agit d'un nouvel ensemble de résultats, réinitialiser le conteneur de résultats
            if (vCurrentPageIndex < 2) {
                searchResultsContainer.empty();
                if (vNResults > 0) {
                    searchResultsContainer.append($("<div class='ui divider'></div>"));
                }
            }

            searchResultsContainer.append(listRoot);
            this._currentResultsPage = vCurrentPageIndex;
            this.setLoadingStateOff();

        }
    };

    var myCdp = new CatalogDataProvider();

    var mySrv = new SearchResultsView($(".searchWrapper"),
        $("#hipSearchForm"),
        $(".searchWrapper").children(".statistic"),
        "",
        null,
        null,
        myCdp);


    mySrv.init();

});