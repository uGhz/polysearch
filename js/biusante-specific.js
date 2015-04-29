/*jslint browser: true*/
/*global  $, Mustache */
// Using the module pattern for a jQuery feature
$(document).ready(function () {
    "use strict";

    /*********************************
    *   CLASS GoogleDataProvider
    *
    */
    function GoogleBooksDataProvider() {}
    
    GoogleBooksDataProvider.prototype = {
        
        /**
        getThumbnailsUrl récupère les URL des thumbnails correspondant à des ISBN
        
        @param Un tableau d'ISBN
        @return Une map "ISBN:url de thumbnail";
        */
        getThumbnailsUrl: function (isbnArray) {
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
            
            ajaxPromise.done(function (response) {
              // console.log("--- Réponse ---");
              // console.log(response);
                
                var resultMap = {};
                

                
                for (var refKey in response) {
                    resultMap[refKey] = response[refKey].thumbnail_url;
                }
              // console.log("--- resultMap ---");
              // console.log(resultMap);
                
                promisedUrls.resolve(resultMap);
            });
            
            return promisedUrls;
        }
    };
    
    
    /**
     * Value Object représentant un résultat, une référence bibliographique.
     * 
     * @todo Ajouter un tableau de "tags". 
     * @todo Ajouter un tableau d'exemplaires.
     * @todo Ajouter une information "Accès libre" (vs. accès sur identification).
     * @todo Ajouter, éventuellement, une information "langue". // Pas prioritaire.
     * @todo Ajouter, éventuellement, une information "Pays". // Pas prioritaire.
     * @todo Ajouter, éventuellement, une information "description".
     */
    function CatalogItem() {
        this.author             = null;
        this.title              = null;
        this.publisher          = null;
        this.publishedDate      = null;
        this.documentType       = null;
        this.isbn               = null;
        this.description        = null;
        this.catalogUrl         = null;
        this.onlineAccessUrl    = null;
        this.tags               = null;
        this.copies             = null;
    }
    
    /**
     * Value Object représentant une page de résultats bibliographiques.
     * 
     * @property {Number}   numberOfResults   Il s'agit du nombre total de résultats correspondant à la requête sur la source de données.
     * @property {Array}    results           Tableau de CatalogItem.
     * @property {Number}   currentPage       Index de la page courante (base 1).  
     */
    CatalogItem.prototype = {
        mustacheTemplate: function () {
            var template = $('#catalog-item-template').html();
            Mustache.parse(template);
            return template;
        }()
    };

    function CatalogResultSet() {
        this.currentPage        = null;
        this.numberOfResults    = null;
        this.maxResultsPerPage  = null;
        this.results            = [];
        this.warningMessage     = "";
    }
    
    CatalogResultSet.prototype = {
        WARNING_MESSAGE: {
            TOO_MUCH_RESULTS: "Votre recherche renvoie de trop nombreux résultats. Merci de l'affiner."
        }    
    };

    
    /*********************************
    *   CLASS HipBookDataProvider
    *
    
    - Possède une URL d'accès
    
    - Méthodes :
        - Publiques :
        --- getSearchResults
            @param  searchString  // La chaîne de recherche saisie.
            @param  pageNumber    // La page de résultats attendue
            @return resultSet     // Un objet CatalogResultSet
        --- getDetailedItem
            @param  url           // Pointant sur une représentation distante et détaillée de la ressource
            @return copies        // Un tableau d'informations sur des exemplaires de la ressources

    */
    function HipBookDataProvider() {
        this._converter             = new HipBookDataConverter();
        this._currentQueryString    = "";
        this._currentPageNumber     = 0;
        this._currentTotalOfResults = 0;
        this._MAX_RESULTS_PER_PAGE  = 20;
        this._DATA_TYPE             = "xml";
        
    }

    HipBookDataProvider.prototype = {
        
        // Propriété constante
        // _BASE_URL: "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp",
        // _MAX_RESULTS_PER_PAGE: 20,
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getSearchResults: function (searchString, pageNumber) {
            
            var _self = this;
            // console.log("getSearchResults. searchString : " + searchString);
            
            var queryUrl = null;
            console.log("getSearchResults. pageNumber : " + pageNumber);
            if (pageNumber && pageNumber > 1) {            
                queryUrl = _self._converter.buildRequest(this._currentQueryString, this._currentPageNumber + 1);
            } else {
                this._currentQueryString = searchString;
                queryUrl = _self._converter.buildRequest(searchString);
            }
            // console.log("getSearchResults. queryUrl : " + queryUrl);
            
            var promisedResults = $.Deferred();
            
            var ajaxPromise = $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: queryUrl,
                dataType: this._DATA_TYPE,
            });
            
            ajaxPromise.done(function (response) {
                    _self._converter.setData(response);
                    // var resultSet = _self._converter._buildResultSet(response);
                    _self._currentPageNumber        = _self._converter.getPageNumber();
                    _self._currentTotalOfResults    = _self._converter.getTotalOfResults();
                
                    var resultSet                   = _self._converter.getResultSet();
                    // console.log("Records found !");
                    // console.log("resultSet : " + resultSet);
                
                    // Ajout manuel des informations de pagination
                    resultSet.maxResultsPerPage = _self._MAX_RESULTS_PER_PAGE;
                    _self._converter.unsetData();
                    promisedResults.resolve(resultSet);
                    // searchResultView._handleNewResultSet(resultSet);
            });
            
            ajaxPromise.always(function () {
                    // console.log("The request for getSearchResults is complete!");
            });

            return promisedResults;
        },
        
        getNewSearchResults: function (searchString) {
            this._currentQueryString = searchString;
        },
    
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getDetailedItem: function ( url ) {
            // @todo supprimer le calcul suivant
            var itemIdentifier = url.slice(url.indexOf("?") + 1);
            var _self = this;
            var promisedResults = $.Deferred();
            
            
            // console.log("Query String : " + queryString);
            
            var ajaxPromise = $.ajax({
                url: _self._converter.buildItemUrl(itemIdentifier),
                dataType: _self._DATA_TYPE
            });
            
            
            ajaxPromise.done(function (response) {
                    var detailedItem = _self._converter.buildDetailedDataItem(response);
                    // console.log("Copies found !");
                    promisedResults.resolve(detailedItem);
            });
            
            
            ajaxPromise.always(function () {
                // console.log("Within callback of promise.");
            });
            
            return promisedResults;
        }
        
   
    };
    
    function HipBookDataConverter() {
        this.data = null;
    }
    
    HipBookDataConverter.prototype = {
            
        setData: function (data) {
            this.data = $(data);  
        },
        
        unsetData: function () {
          this.data = null;  
        },
    
        getPageNumber: function () {
            return parseInt(this.data.find('searchresponse>yoursearch>view>currpage').text(), 10);
        },
    
        getTotalOfResults: function () {
            return parseInt(this.data.find('searchresponse>yoursearch>hits').text(), 10);
        },
    
        getResultSet: function () {
            return this.buildResultSet();
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
        
        buildItemUrl: function (identifier) {
            return "proxy.php?DonneXML=true&" + identifier;
        },

        buildResultSet: function (rawXmlData) {
            rawXmlData = null;
            // console.log("Results set building !");
            var $rawXmlData = this.data;
            
            // var listRoot = $("<div class='ui items'></div>");
            var resultSet = new CatalogResultSet();

            resultSet.numberOfResults   = $rawXmlData.find('searchresponse>yoursearch>hits').text();
            resultSet.currentPage       = $rawXmlData.find('searchresponse>yoursearch>view>currpage').text();

            // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
            var tempItems = [];
            var tempDataItem = null;

            var _self = this;
            $rawXmlData.find('searchresponse>summary>searchresults>results>row').each(function (index, value) {
                tempDataItem = _self.buildDataItem($(value));
                tempItems.push(tempDataItem);
            });

            resultSet.results = tempItems;
            // console.log("Results set is built !");
            return resultSet;
        },

        buildDataItem: function (rawXmlData) {
            var item = new CatalogItem();

            item.title          = rawXmlData.find('TITLE>data>text').text();
            item.author         = rawXmlData.find('AUTHOR>data>text').text();
            item.publisher      = rawXmlData.find('PUBLISHER>data>text').text();
            item.publishedDate  = rawXmlData.find('PUBDATE>data>text').text();
            var sourceId        = rawXmlData.find('sourceid').text();
            var func            = rawXmlData.find('TITLE>data>link>func').text();
            item.isbn           = rawXmlData.find('isbn').text();
            item.catalogUrl     = "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp?uri=" + func + "&amp;source=" + sourceId;

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
                                    
            var item = new CatalogItem();
            var generalDataRoot = $(rawXmlData).find('searchresponse>fullnonmarc>searchresults>results>row:first-of-type');


            item.title          = generalDataRoot.find('TITLE>data>text').text();
            item.author         = generalDataRoot.find('AUTHOR>data>text').text();
            item.publisher      = generalDataRoot.find('cell:nth-of-type(13)>data>text').text();
            // item.publishedDate  = rawXmlData.find('PUBDATE>data>text').text();
            item.isbn           = generalDataRoot.find('isbn').text();
            
            var tempNode = generalDataRoot.find('PPN>data>text');
            item.catalogUrl     = (tempNode) ? "http://www.biusante.parisdescartes.fr/" + tempNode.text().replace(/ppn\s/g, "ppn?") : "";
            
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
                // console.log("Details added !");
            });
            
            item.copies = copies;
            
            return item;

        }

    };
    
      /*********************************
    *   CLASS HipThesisDataProvider
    *
    
    - Possède une URL d'accès
    
    - Méthodes :
        - Publiques :
        --- getSearchResults
            @param  searchString  // La chaîne de recherche saisie.
            @param  pageNumber    // La page de résultats attendue
            @return resultSet     // Un objet CatalogResultSet
        --- getDetailedItem
            @param  url           // Pointant sur une représentation distante et détaillée de la ressource
            @return copies        // Un tableau d'informations sur des exemplaires de la ressources

    */
    function HipThesisDataProvider() {}

    HipThesisDataProvider.prototype = {
        
        // Propriété constante
        _BASE_URL: "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp",
        _MAX_RESULTS_PER_PAGE: 20,
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getSearchResults: function (searchString, pageNumber) {
            
            var _self = this;
            // console.log("getSearchResults. searchString : " + searchString);
            
            var queryUrl = _self._buildRequest(searchString, pageNumber);
            // console.log("getSearchResults. queryUrl : " + queryUrl);
            
            var promisedResults = $.Deferred();
            
            var ajaxPromise = $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: queryUrl,
                dataType: "xml",
            });
            
            ajaxPromise.done(function (response) {
                    var resultSet = _self._buildResultSet(response);
                    // console.log("Records found !");
                    // console.log("resultSet : " + resultSet);
                
                    // Ajout manuel des informations de pagination
                    resultSet.maxResultsPerPage = _self._MAX_RESULTS_PER_PAGE;
                
                    promisedResults.resolve(resultSet);
                    // searchResultView._handleNewResultSet(resultSet);
            });
            
            ajaxPromise.always(function () {
                    // console.log("The request for getSearchResults is complete!");
            });

            return promisedResults;
        },
    
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getDetailedItem: function ( url ) {

            var _self = this;
            var promisedResults = $.Deferred();
            
            var queryString = url.slice(url.indexOf("?") + 1);
            // console.log("Query String : " + queryString);
            
            var ajaxPromise = $.ajax({
                url: "proxy.php?DonneXML=true&" + queryString,
                dataType: "xml"
            });
            
            
            ajaxPromise.done(function (response) {
                    var detailedItem = _self._buildDetailedDataItem(response);
                    // console.log("Copies found !");
                    promisedResults.resolve(detailedItem);
            });
            
            
            ajaxPromise.always(function () {
                // console.log("Within callback of promise.");
            });
            
            return promisedResults;
        },
        
        _buildRequest: function (searchString, pageNumber) {
            
            var urlArray = [
                "proxy.php?DonneXML=true&index=",
                encodeURIComponent(".GK"),
                "&limitbox_1=",
                encodeURIComponent("$TH = *"),
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

        _buildResultSet: function (rawXmlData) {
            // console.log("Results set building !");

            // var listRoot = $("<div class='ui items'></div>");
            var resultSet = new CatalogResultSet();

            resultSet.numberOfResults = $(rawXmlData).find('searchresponse>yoursearch>hits').text();
            resultSet.currentPage = $(rawXmlData).find('searchresponse>yoursearch>view>currpage').text();

            // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
            var tempItems = [];
            var tempDataItem = null;

            var _self = this;
            $(rawXmlData).find('searchresponse>summary>searchresults>results>row').each(function (index, value) {
                tempDataItem = _self._buildDataItem($(value));
                tempItems.push(tempDataItem);
            });

            resultSet.results = tempItems;
            // console.log("Results set is built !");
            return resultSet;
        },

        _buildDataItem: function (rawXmlData) {
            var item = new CatalogItem();

            item.title          = rawXmlData.find('TITLE>data>text').text();
            item.author         = rawXmlData.find('AUTHOR>data>text').text();
            item.publisher      = rawXmlData.find('PUBLISHER>data>text').text();
            item.publishedDate  = rawXmlData.find('PUBDATE>data>text').text();
            var sourceId        = rawXmlData.find('sourceid').text();
            var func            = rawXmlData.find('TITLE>data>link>func').text();
            item.isbn           = rawXmlData.find('isbn').text();
            item.catalogUrl     = this._BASE_URL + "?uri=" + func + "&amp;source=" + sourceId;

            var vDocumentType   = rawXmlData.find('cell:nth-of-type(14)>data>text').text();
            if (vDocumentType) {
                item.documentType = vDocumentType.slice(vDocumentType.lastIndexOf(' ') + 1, vDocumentType.length - "$html$".length);
            }

            return item;
        },

        _buildDetailedDataItem: function (rawXmlData) {

            var copies = [];
            var currentCopy = null;
            var tempString = "";

            /**
             * Autres champs sous "searchresponse>fullnonmarc>searchresults>results>row"
             *      titre -> 'TITLE>data>text'
             *      author -> 'cell:nth-of-type(11)>data>text' ou 'AUTHORS>data[Plus. occurrences poss.]>text'
             *      [Edition informations] -> author -> 'cell:nth-of-type(13)>data>text'
             *      ISBN / ISSN -> 'cell:nth-of-type(36)>data>text' ou ISBN -> 'isbn'
             *      catalog URL -> "http://www.biusante.parisdescartes.fr/" + 'PPN>data>text'
             */
                                    
            var item = new CatalogItem();
            var generalDataRoot = $(rawXmlData).find('searchresponse>fullnonmarc>searchresults>results>row:first-of-type');


            item.title          = generalDataRoot.find('TITLE>data>text').text();
            item.author         = generalDataRoot.find('AUTHOR>data>text').text();
            item.publisher      = generalDataRoot.find('cell:nth-of-type(13)>data>text').text();
            // item.publishedDate  = rawXmlData.find('PUBDATE>data>text').text();
            item.isbn           = generalDataRoot.find('isbn').text();
            
            var tempNode = generalDataRoot.find('PPN>data>text');
            item.catalogUrl     = (tempNode) ? "http://www.biusante.parisdescartes.fr/" + tempNode.text().replace(/ppn\s/g, "ppn?") : "";
            
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
                // console.log("Details added !");
            });
            
            item.copies = copies;
            
            return item;

        }

    };
    
    
          /*********************************
    *   CLASS HipPeriodicalDataProvider
    *
    
    - Possède une URL d'accès
    
    - Méthodes :
        - Publiques :
        --- getSearchResults
            @param  searchString  // La chaîne de recherche saisie.
            @param  pageNumber    // La page de résultats attendue
            @return resultSet     // Un objet CatalogResultSet
        --- getDetailedItem
            @param  url           // Pointant sur une représentation distante et détaillée de la ressource
            @return copies        // Un tableau d'informations sur des exemplaires de la ressources

    */
    function HipPeriodicalDataProvider() {}

    HipPeriodicalDataProvider.prototype = {
        
        // Propriété constante
        _BASE_URL: "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp",
        _MAX_RESULTS_PER_PAGE: 20,
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getSearchResults: function (searchString, pageNumber) {
            
            var _self = this;
            // console.log("getSearchResults. searchString : " + searchString);
            
            var queryUrl = _self._buildRequest(searchString, pageNumber);
            // console.log("getSearchResults. queryUrl : " + queryUrl);
            
            var promisedResults = $.Deferred();
            
            var ajaxPromise = $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: queryUrl,
                dataType: "xml",
            });
            
            ajaxPromise.done(function (response) {
                    var resultSet = _self._buildResultSet(response);
                    // console.log("Records found !");
                    // console.log("resultSet : " + resultSet);
                
                    // Ajout manuel des informations de pagination
                    resultSet.maxResultsPerPage = _self._MAX_RESULTS_PER_PAGE;
                
                    promisedResults.resolve(resultSet);
                    // searchResultView._handleNewResultSet(resultSet);
            });
            
            ajaxPromise.always(function () {
                    // console.log("The request for getSearchResults is complete!");
            });

            return promisedResults;
        },
    
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getDetailedItem: function ( url ) {

            var _self = this;
            var promisedResults = $.Deferred();
            
            var queryString = url.slice(url.indexOf("?") + 1);
            // console.log("Query String : " + queryString);
            
            var ajaxPromise = $.ajax({
                url: "proxy.php?DonneXML=true&" + queryString,
                dataType: "xml"
            });
            
            
            ajaxPromise.done(function (response) {
                    var detailedItem = _self._buildDetailedDataItem(response);
                    // console.log("Copies found !");
                    promisedResults.resolve(detailedItem);
            });
            
            
            ajaxPromise.always(function () {
                // console.log("Within callback of promise.");
            });
            
            return promisedResults;
        },
        
        _buildRequest: function (searchString, pageNumber) {
            
            var urlArray = [
                "proxy.php?DonneXML=true&index=",
                encodeURIComponent(".GK"),
                "&limitbox_1=",
                encodeURIComponent("$LAB7 = s or $LAB7 = i"),
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

        _buildResultSet: function (rawXmlData) {
            // console.log("Results set building !");

            // var listRoot = $("<div class='ui items'></div>");
            var resultSet = new CatalogResultSet();

            resultSet.numberOfResults = $(rawXmlData).find('searchresponse>yoursearch>hits').text();
            resultSet.currentPage = $(rawXmlData).find('searchresponse>yoursearch>view>currpage').text();

            // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
            var tempItems = [];
            var tempDataItem = null;

            var _self = this;
            $(rawXmlData).find('searchresponse>summary>searchresults>results>row').each(function (index, value) {
                tempDataItem = _self._buildDataItem($(value));
                tempItems.push(tempDataItem);
            });

            resultSet.results = tempItems;
            // console.log("Results set is built !");
            return resultSet;
        },

        _buildDataItem: function (rawXmlData) {
            var item = new CatalogItem();

            item.title          = rawXmlData.find('TITLE>data>text').text();
            item.author         = rawXmlData.find('AUTHOR>data>text').text();
            item.publisher      = rawXmlData.find('PUBLISHER>data>text').text();
            item.publishedDate  = rawXmlData.find('PUBDATE>data>text').text();
            var sourceId        = rawXmlData.find('sourceid').text();
            var func            = rawXmlData.find('TITLE>data>link>func').text();
            item.isbn           = rawXmlData.find('isbn').text();
            item.catalogUrl     = this._BASE_URL + "?uri=" + func + "&amp;source=" + sourceId;

            var vDocumentType   = rawXmlData.find('cell:nth-of-type(14)>data>text').text();
            if (vDocumentType) {
                item.documentType = vDocumentType.slice(vDocumentType.lastIndexOf(' ') + 1, vDocumentType.length - "$html$".length);
            }

            return item;
        },

        _buildDetailedDataItem: function (rawXmlData) {

            var copies = [];
            var currentCopy = null;
            var tempString = "";

            /**
             * Autres champs sous "searchresponse>fullnonmarc>searchresults>results>row"
             *      titre -> 'TITLE>data>text'
             *      author -> 'cell:nth-of-type(11)>data>text' ou 'AUTHORS>data[Plus. occurrences poss.]>text'
             *      [Edition informations] -> author -> 'cell:nth-of-type(13)>data>text'
             *      ISBN / ISSN -> 'cell:nth-of-type(36)>data>text' ou ISBN -> 'isbn'
             *      catalog URL -> "http://www.biusante.parisdescartes.fr/" + 'PPN>data>text'
             */
                                    
            var item = new CatalogItem();
            var generalDataRoot = $(rawXmlData).find('searchresponse>fullnonmarc>searchresults>results>row:first-of-type');


            item.title          = generalDataRoot.find('TITLE>data>text').text();
            item.author         = generalDataRoot.find('AUTHOR>data>text').text();
            item.publisher      = generalDataRoot.find('cell:nth-of-type(13)>data>text').text();
            // item.publishedDate  = rawXmlData.find('PUBDATE>data>text').text();
            item.isbn           = generalDataRoot.find('isbn').text();
            
            var tempNode = generalDataRoot.find('PPN>data>text');
            item.catalogUrl     = (tempNode) ? "http://www.biusante.parisdescartes.fr/" + tempNode.text().replace(/ppn\s/g, "ppn?") : "";
            
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
                // console.log("Details added !");
            });
            
            item.copies = copies;
            
            return item;

        }

    };
    
    
    
        /*********************************
    *   CLASS EBookDataProvider
    *
    */
    function EBookDataProvider() {}

    EBookDataProvider.prototype = {
        
        // Propriété constante
        _BASE_URL: "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp",
        _MAX_RESULTS_PER_PAGE: 100,
        // @todo change this.
        //http://www2.biusante.parisdescartes.fr/signets2015/index.las?specif=livelec&acces=&tri=alp&form=o&tout=rein&dsi_cle=
        _authorRegex: /Par\s(.*)\s*\.[A-Z]{3,}/g,
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getSearchResults: function (searchString, pageNumber) {
            
            var _self = this;
            
            var queryUrl = _self._buildRequest(searchString, pageNumber);
            
            var promisedResults = $.Deferred();
            
            var ajaxPromise = $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: queryUrl,
                dataType: "html",
            });
            
            ajaxPromise.done(function (response) {
                    var resultSet = _self._buildResultSet(response);
                
                    // Ajout manuel des informations de pagination
                    resultSet.maxResultsPerPage = _self._MAX_RESULTS_PER_PAGE;
                
                    // Ajout manuel du numéro de page
                    resultSet.currentPage = pageNumber;
                    
                    promisedResults.resolve(resultSet);
                    // searchResultView._handleNewResultSet(resultSet);
            });
            
            ajaxPromise.always(function () {
                  // console.log("The request for getSearchResults is complete!");
            });

            return promisedResults;
        },
    
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getDetailedItem: function ( url ) {

            var _self = this;
            var promisedResults = $.Deferred();
            
            var queryString = url.slice(url.indexOf("?") + 1);
          // console.log("Query String : " + queryString);
            
            var ajaxPromise = $.ajax({
                url: "proxy.php?DonneXML=true&" + queryString,
                dataType: "xml"
            });
            
            
            ajaxPromise.done(function (response) {
                    var copies = _self._buildDetailedDataItem(response);
                  // console.log("Copies found !");
                    promisedResults.resolve(copies);
            });
            
            
            ajaxPromise.always(function () {
              // console.log("Within callback of promise.");
            });
            
            return promisedResults;
        },
        
        _buildRequest: function (searchString, pageNumber) {
            
            var urlArray = [
                "proxy-signets.php?specif=",
                encodeURIComponent("livelec"),
                "&tri=alp&form=o",
                "&tout=",
                encodeURIComponent(searchString)
            ];
            
            if (pageNumber) {
                urlArray = urlArray.concat([
                    "&p=",
                    encodeURIComponent(pageNumber)
                ]);
            }
            
            var url = urlArray.join("");
            
            return url;
        },

        _buildResultSet: function (rawXmlData) {
          // console.log("Beginning of _buildResultSet. Results set building !");

            var resultSet = new CatalogResultSet();

            var wrappingTable = $(rawXmlData).find("#table247");
          // console.log("wrappingTable : " + wrappingTable);
            
            var tempText = wrappingTable.find('tr:nth-child(2)>td>p').text();
            // /:\s(\d+)\s/g
            // console.log("tempText : " + tempText);
            var regexResult = /:\s(\d+)\s/g.exec(tempText);
            // console.log("regexResult : " + regexResult);
            resultSet.numberOfResults   = (regexResult) ? regexResult[1] : 0;
          // console.log("resultSet.numberOfResults : " + resultSet.numberOfResults);
            resultSet.currentPage       = 25;

            // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
            var tempItems = [];
            var tempDataItem = null;

            var _self = this;
            wrappingTable.find('tr').each(function (index, value) {
                if (index > 6) { // Il faut aussi exclure le dernier TR
                    tempDataItem = _self._buildDataItem($(value));
                    tempItems.push(tempDataItem);
                }
            });
            tempItems.pop();

            resultSet.results = tempItems;
          // console.log("Results set is built !");
            return resultSet;
        },

        
            /*
             * 
             * $("#table247"), 2ème ligne tr, 1er td, 1er p, text, pageNumber après "Nombre de réponses : " et avant le 1er "&"
             * Si table247 possède moins de 4 lignes tr, la recherche n'a ramené aucun résultat.
             * #table247, chaque tr[x] (3 < x < tr.length) correspond à une référence d'ouvrage
             * chaque tr :
             * - 1er td : Type de document / d'accès
             * -2ème td :
             *      - p > a > b.text -> Titre,
             *      - p> a.href -> URL d'accès en ligne
             *      - div > i.text -> Description, commentaire
             *      - div.text -> Auteurs, entre "Par " et " . " (?)
             *      - div > font.text -> Tag (plusieurs occurrences)
             *
            */
        _buildDataItem: function (rawXmlData) {
            var item = new CatalogItem();
            
            var cell2 = rawXmlData.find('td:nth-child(2)');
            
            item.title          = cell2.find('p>a>b').text();
            
            // Récupération de l'auteur
            var regexResult = /Par\s(.*?)\s?\.?(PAYS|LANGUE)/g.exec(cell2.find('div').text());
            // console.log("regexResult : " + regexResult)
            item.author         = (regexResult) ? regexResult[1] : "";
            
            
            item.publisher      = rawXmlData.find('PUBLISHER>data>text').text();
            
            item.description    = cell2.find('div > i').text();
            
            // Récupération de la date de publication
            regexResult = /(\d{4})\.?/g.exec(cell2.find('div').text());
            item.publishedDate  = (regexResult) ? regexResult[1] : "";
            // item.isbn           = rawXmlData.find('isbn').text();
            // item.catalogUrl     = this._BASE_URL + "?uri=" + item.func + "&amp;source=" + item.sourceId;
            item.onlineAccessUrl      = cell2.find('p > a').attr("href");
        

            var vDocumentType   = rawXmlData.find('cell:nth-of-type(14)>data>text').text();
            if (vDocumentType) {
                item.documentType = vDocumentType.slice(vDocumentType.lastIndexOf(' ') + 1, vDocumentType.length - "$html$".length);
            }

            return item;
        },

        _buildDetailedDataItem: function (rawXmlData) {

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
              // console.log("Details added !");
            });

            return copies;

        }

    };
    
            /*********************************
    *   CLASS ThesisSpecificDataProvider
    *
    */
    function ThesisSpecificDataProvider() {}

    ThesisSpecificDataProvider.prototype = {
        
        // Propriété constante
        _BASE_URL: "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp",
        _MAX_RESULTS_PER_PAGE: 25,
        // @todo change this.
        //http://www2.biusante.parisdescartes.fr/signets2015/index.las?specif=livelec&acces=&tri=alp&form=o&tout=rein&dsi_cle=
        _authorRegex: /Par\s(.*)\s*\.[A-Z]{3,}/g,
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getSearchResults: function (searchString, pageNumber) {
            
            var _self = this;
          // console.log("getSearchResults. searchString : " + searchString);
          // console.log("getSearchResults. pageNumber : " + pageNumber);
            
            var queryUrl = _self._buildRequest(searchString, pageNumber);
          // console.log("getSearchResults. queryUrl : " + queryUrl);
            
            var promisedResults = $.Deferred();
            
            var ajaxPromise = $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: queryUrl,
                dataType: "html",
            });
            
            ajaxPromise.done(function (response) {
                    var resultSet = _self._buildResultSet(response);
                  // console.log("Records found !");
                  // console.log("resultSet : " + resultSet);
                
                    // Ajout manuel des informations de pagination
                    resultSet.maxResultsPerPage = _self._MAX_RESULTS_PER_PAGE;
                
                    // Ajout manuel du numéro de page
                    resultSet.currentPage = pageNumber;
                    
                    promisedResults.resolve(resultSet);
                    // searchResultView._handleNewResultSet(resultSet);
            });
            
            ajaxPromise.always(function () {
                  // console.log("The request for getSearchResults is complete!");
            });

            return promisedResults;
        },
    
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getDetailedItem: function ( url ) {

            var _self = this;
            var promisedResults = $.Deferred();
            
            var queryString = url.slice(url.indexOf("?") + 1);
          // console.log("Query String : " + queryString);
            
            var ajaxPromise = $.ajax({
                url: "proxy.php?DonneXML=true&" + queryString,
                dataType: "xml"
            });
            
            
            ajaxPromise.done(function (response) {
                    var copies = _self._buildDetailedDataItem(response);
                  // console.log("Copies found !");
                    promisedResults.resolve(copies);
            });
            
            
            ajaxPromise.always(function () {
              // console.log("Within callback of promise.");
            });
            
            return promisedResults;
        },
        
        _buildRequest: function (searchString, pageNumber) {
            // http://www2.biusante.parisdescartes.fr/theses/index.las?toutindex=victor&p=2
            var urlArray = [
                "proxy-theses.php?",
                "toutindex=",
                encodeURIComponent(searchString)
            ];
            
            if (pageNumber) {
                urlArray = urlArray.concat([
                    "&p=",
                    encodeURIComponent(pageNumber)
                ]);
            }
            
            var url = urlArray.join("");
            
            return url;
        },

        _buildResultSet: function (rawXmlData) {
          // console.log("ThesisSpecificDataProvider... Beginning of _buildResultSet. Results set building !");

            var resultSet = new CatalogResultSet();

            var wrappingTable = $(rawXmlData).find("#table245");
          // console.log("wrappingTable : " + wrappingTable);
            
            // S'il y a des résultats, les analyser et alimenter le CatalogResultSet
            if (wrappingTable.length) {
              // console.log("ThesisSpecificDataProvider... #table245 found !");
                var tempText = wrappingTable.find('tr:nth-child(1)>td>p').text();

                // console.log("tempText : " + tempText);
                var regexResult = /:\s(\d+)\s/g.exec(tempText);
              // console.log("regexResult : " + regexResult);
                resultSet.numberOfResults   = (regexResult) ? regexResult[1] : 0;
              // console.log("resultSet.numberOfResults : " + resultSet.numberOfResults);
                // resultSet.currentPage       = 25;

                // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
                var tempItems = [];
                var tempDataItem = null;

                var _self = this;
                wrappingTable.find('tr > td > table').each(function (index, value) {
                    // if (index > 2) { // Il faut aussi exclure le dernier TR
                        tempDataItem = _self._buildDataItem($(value));
                        tempItems.push(tempDataItem);
                    // }
                });

                resultSet.results = tempItems;
            } else {
              // console.log("ThesisSpecificDataProvider... #table245 not found !");
                wrappingTable = $(rawXmlData).find("#table241");
                
                var messageCell = wrappingTable.find("tr:nth-child(2) > td:nth-child(1)");
                
                if (messageCell.text().indexOf("aucune réponse") !== -1) {
                    // La requête ne renvoie aucun résultat.
                  // console.log("ThesisSpecificDataProvider... No results !");
                    resultSet.numberOfResults = 0;
                } else {
                    // La requête renvoie de trop nombreux résultats.
                  // console.log("ThesisSpecificDataProvider... Too much results !");
                    resultSet.numberOfResults = messageCell.find("b").text();
                  // console.log("ThesisSpecificDataProvider... Number of results : " + resultSet.numberOfResults);
                    resultSet.warningMessage = resultSet.WARNING_MESSAGE.TOO_MUCH_RESULTS;
                }
                
            }
            
            
          // console.log("Results set is built !");
            return resultSet;
        },

        
            /*
             * 
             * $("#table245"), 1ère ligne tr, 1er td, 1er p, text, pageNumber après "Nombre de réponses : " et avant le 1er "&"
             * Si table245 n'existe pas, soit la recherche n'a ramené aucun résultat, soit la recherche en a ramené trop.
             * #table245, chaque tr[x] (2 < x < tr.length) correspond à une référence d'ouvrage
             * chaque tr > td > table :
             * - 1er tr(1) > td(1) > b.text : Auteur
             * - 1er tr(1) > td(2) > i.text : Information repérage thèse
             * - 2ème tr(2) > td.text : Titre
             * - 3ème tr(3) > td : Le reste
             *
            */
        _buildDataItem: function (rawXmlData) {
            
            var item = new CatalogItem();
            
            // var cell2 = rawXmlData.find('td:nth-child(2)');
            
            // Récupération de l'auteur
            item.author          = rawXmlData.find('tr:nth-child(1)>td:nth-child(1)>b').text();
            
            item.description    = rawXmlData.find('tr:nth-child(1)>td:nth-child(2)>i').text();

            item.title          = rawXmlData.find('tr:nth-child(2)>td').text();
            
        
            /*
            var vDocumentType   = rawXmlData.find('cell:nth-of-type(14)>data>text').text();
            if (vDocumentType) {
                item.documentType = vDocumentType.slice(vDocumentType.lastIndexOf(' ') + 1, vDocumentType.length - "$html$".length);
            }
            */
            return item;
        },

        _buildDetailedDataItem: function (rawXmlData) {

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
              // console.log("Details added !");
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
        
        // Déclarations et initialisations des propriétés
        this._container             = $("#hipSearchArea");
        this._form                  = $("#hipSearchForm");
        this._searchResultsContainer= $("#hipSearchResults");
        
        this._statsContainer        = this._form.find(".statistic");
        
        this._currentRequest        = "";
        this._resultAreas           = [];
        
        // Créer et attacher les ResultAreas
        this._resultAreas.push(
                new ResultsArea("Thèses anciennes", "Catalogue général (1800&nbsp;-&nbsp;1951)", "student", this, new HipThesisDataProvider())
        );
        this._resultAreas.push(
                new ResultsArea("Thèses récentes", "Catalogue spécifique (1985&nbsp;-&nbsp;&hellip;)", "student", this, new ThesisSpecificDataProvider())
        );
        this._resultAreas.push(
                new ResultsArea("Ouvrages", "Catalogue général", "book", this, new HipBookDataProvider())
        );
        this._resultAreas.push(
                new ResultsArea("Livres électroniques", "Catalogue spécifique", "tablet", this, new EBookDataProvider())
        );
        this._resultAreas.push(
                new ResultsArea("Périodiques", "Catalogue général", "newspaper", this, new HipPeriodicalDataProvider())
        );
        
        // Attacher les gestionnaires d'évènements
        this._form.submit($.proxy(this._updateCurrentRequest, this));
    }
    
    SearchArea.prototype = {
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler. 
        getSearchString: function () {
            return this._currentRequest;
        },
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler. 
        getResultsContainer: function () {
            return this._searchResultsContainer;
        },
        
        _updateStats: function () {
            var totalOfResults = 0;
            var tempResultArea = null;

            for(var i=0, len=this._resultAreas.length ; i < len ; i++) {
                tempResultArea = this._resultAreas[i];
                if (tempResultArea) {
                    totalOfResults += tempResultArea.getStats();
                }
            }
            this._setStats(totalOfResults);
            // console.log("One ResultArea is loading : " + oneIsLoading);
        },
        
        
        _updateCurrentRequest: function ( event ) {
            event.preventDefault();
            
            
            // Notifier la chose aux ResultAreas
            var tempResultArea = null;
            var tempPromise = null;
            var promises = [];
            var _self = this;
            
            this._currentRequest = this._form.find("input[type='text']").val();           
            this._setLoadingStateOn();
            
            var updateStatsFunction = function () {_self._updateStats();};
            
            for(var i=0, len=this._resultAreas.length; i < len ; i++) {
                tempResultArea = this._resultAreas[i];
                if (tempResultArea) {
                    tempPromise = tempResultArea.queryUpdated();
                    tempPromise.done(updateStatsFunction);
                    promises.push(tempPromise);   
                }
            }
            
            // var promiseOfArray = $.when.apply($, promises);
            $.when.apply($, promises).always(
                function () {
                    _self._setLoadingStateOff();
                }
            );

        },
        
        
        _setStats: function ( nResults ) {
            // Créer au besoin les éléments nécessaires à l'affichage des stats
            // Mettre à jour ces éléments
            this._statsContainer.children(".value").text(nResults);
        },
        
        _setLoadingStateOn: function () {
            this._form.children(".ui.search").addClass("loading");
        },
        
        _setLoadingStateOff: function() {
            this._form.children(".ui.search").removeClass("loading");
        }
    };

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
            --- _updateCurrentRequest // Récupère la requête saisie par l'utilisateur
            --- _setLoadingStateOn
            --- _setLoadingStateOff
            --- _setStats

            --- _askForItemDetails
            --- askForNewResultSet
            --- _handleNewItemDetails
            --- _handleNewResultSet
    */
    function ResultsArea(title, subtitle, iconName, searchArea, dataProvider ) {
        
        // Initialisées à la création de l'objet
        this._searchArea    = searchArea;
        this._dataProvider  = dataProvider;
        this._title         = title;
        this._subtitle      = subtitle;
        
        // Déclarer les autres propriétés
        this._currentTotalResults   = null;
        this._currentResultsPage    = null;
        this._container             = null;
        this._statsContainer        = null;
        
        // Construire le balisage HTML/CSS
        var mustacheRendering = Mustache.render(this.mustacheTemplate, {title: title, subtitle: subtitle, iconName: iconName});
        this._container = $(mustacheRendering);
        this._statsContainer = this._container.find("div.statistic");
        
        // Attacher les gestionnaires d'évènements à la liste
        var _self = this;
        this._container.on("click", "a.header",                     $.proxy(_self._askForItemDetails, _self));
        this._container.on("click", "button.catalog-link",    function () {
            window.open($(this).attr("data-catalog-url"));
        });
        this._container.on("click", "button.online-access-link",    function () {
            window.open($(this).attr("data-online-access-url"));
        });
        this._container.on("click", "button.more-results",          $.proxy(_self._askForMoreResults, _self));
        
        // Attacher la nouvelle zone de recherche au DOM
        this._container.appendTo(this._searchArea.getResultsContainer());
    }

    ResultsArea.prototype = {
        
        // Fonction publique, que les SearchArea sont susceptibles d'appeler.
        queryUpdated: function () {
            return this._askForResults.call(this, this._searchArea.getSearchString(), 1);
        },
        
        // Fonction publique, que les SearchArea sont susceptibles d'appeler. 
        getStats: function () {
            return this._currentTotalResults;
        },
        
        mustacheTemplate: function () {
            var template = $('#empty-results-area-template').html();
            Mustache.parse(template);
            return template;
        }(),
        
        _askForResults: function( request, pageNumber ) {
            
            this._setLoadingStateOn();
            
            var resultsHandled = $.Deferred();
            
            var promisedResults = this._dataProvider.getSearchResults(request, pageNumber);
            var _self = this;
            promisedResults.done(
                    function( results ) {
                      // console.log("_askForResults received results : " + results);

                        _self._handleNewResultSet( results );
                        _self._askForThumbnailUrl();
                    }
                ).always(
                    function () {
                        _self._setLoadingStateOff();
                        resultsHandled.resolve();
                    }
            );
            
            
          // console.log("_askForResults is ending !");
            return resultsHandled;
        },
        
        _askForMoreResults: function (event) {
          // console.log("More results wanted !");

            event.preventDefault();

            var chosenPage = parseInt(this._currentResultsPage, 10) + 1;
            
            this._askForResults( this._searchArea.getSearchString(), chosenPage );
            
          // console.log("_askForMoreResults is ending !");
        },
        
        _askForItemDetails: function ( event ) {

            event.preventDefault();
          // console.log("Inside _askForItemDetails");

            var domItem = $(event.currentTarget).closest(".item");

            this._setItemLoadingStateOn(domItem);

            var promisedResults = this._dataProvider.getDetailedItem(domItem.data("catalog-url"));
            
            var _self = this;
            promisedResults.done(function ( results ) {   
                _self._handleNewItemDetails(results, domItem);
                _self._setItemLoadingStateOff(domItem);
            });
            
          // console.log("_askForItemDetails is ending !");

        },
        
        _redirectToCatalogDetailPage: function ( event ) {
            var domItem = $(event.currentTarget).closest(".item");
            window.location.href = domItem.data("catalog-url");
        },
        
        _setLoadingStateOn: function () {
            this._container.children(".dimmer").addClass("active");
        },

        _setLoadingStateOff: function () {
            this._container.children(".dimmer").removeClass("active");
        },

        _setStats: function (nResults) {
            // Créer au besoin les éléments nécessaires à l'affichage des stats
            // Mettre à jour ces éléments
          // console.log("_setStats called ! nResults : " + nResults);
            this._statsContainer.children(".value").text(nResults);
        },
        
        _buildResultItem: function (dataItem) {
            
            var newDomItem = $(Mustache.render(dataItem.mustacheTemplate, dataItem));
            
            // Stockage de données spécifiques à l'item
            newDomItem.data("catalog-url", dataItem.catalogUrl);
            newDomItem.data("isbn", dataItem.isbn);

            return $(newDomItem);
        },
        

        _setItemLoadingStateOn: function (domItem) {
            domItem.find(".dimmer").addClass("active");
        },

        _setItemLoadingStateOff: function (domItem) {
            domItem.find(".dimmer").removeClass("active");
        },
        
        _handleNewItemDetails: function (detailedItem, domItem) {
          // console.log("_handleNewItemDetails has been called !");
            
            var newItem = this._buildResultItem(detailedItem);
            newItem.find(".extra > span.label").popup();
            domItem.replaceWith(newItem);
            
          // console.log("handleDetails is finished !");
        },
        

        _handleNewResultSet: function (resultSet) {
          // console.log("_handleNewResultSet has been called !");

          // console.log("Results handled !");

            this._currentTotalResults  = parseInt(resultSet.numberOfResults, 10);
            this._currentResultsPage   = resultSet.currentPage;
            this._maxResultsPerPage    = parseInt(resultSet.maxResultsPerPage, 10);

          // console.log("this._currentTotalResults : "  + this._currentTotalResults);
          // console.log("this._currentResultsPage : "   + this._currentResultsPage);

            // Récupérer, ligne à ligne, les données,
            // les mettre en forme et les attacher au conteneur d'items
            var tempDomItem = null;
            
            var listRoot = $("<div class='ui items'></div>");
            var resultsArray = resultSet.results;
            for (var i = 0, len = resultsArray.length; i < len; i++) {
                tempDomItem = this._buildResultItem(resultsArray[i]);
                tempDomItem.appendTo(listRoot);
            }

            // S'il s'agit d'un nouvel ensemble de résultats, réinitialiser le conteneur de résultats
            if (this._currentResultsPage < 2) {
                this._container.children(".items").empty();
            }
            
            if (this._currentResultsPage > 1) {
                this._container.find(".items").append(listRoot.children(".item"));
            } else {
                this._container.find(".items").replaceWith(listRoot);
            }
            
            //Mettre à jour le bouton "Plus de résultats"
            // Supprimer le bouton "Plus de résultats".
            this._container.find("button.more-results").remove();
            this._container.find("div.message").remove();
            
            if (resultSet.warningMessage === resultSet.WARNING_MESSAGE.TOO_MUCH_RESULTS) {
                $("<div class='ui icon info message'><i class='warning icon'></i><div class='content'><div class='header'>Trop de réponses.</div><p>Merci d'affiner votre recherche.</p></div></div>")
                    .appendTo(this._container);
            } else {
            
                // S'il existe des résultats non encore affichés, insérer le bouton "Plus de résultats"
                var maxPageNumber = Math.ceil(this._currentTotalResults / this._maxResultsPerPage);
                if ((maxPageNumber > this._currentResultsPage) && (resultSet.warningMessage !== resultSet.WARNING_MESSAGE.TOO_MUCH_RESULTS)) {
                    $("<button class='fluid ui button more-results'>Plus de résultats</button>").appendTo(this._container);
                }
            }
            
            // Mettre à jour les statistiques de recherche
            this._setStats(this._currentTotalResults);
        },
        
        _askForThumbnailUrl: function() {
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
              // console.log("_askForThumbnailUrl Results");
              // console.log(results);
                
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
    
    // Lancement du widget
    new SearchArea();

});