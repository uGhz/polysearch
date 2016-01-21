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
    
    function ItemCopy() {
        this.callNumber     = null;
        this.library        = null;
        this.precisePlace   = null;
        this.conditions     = null;
        this.holdings       = null;
    }
    
    function DirectAccess() {
        this.url            = null;
        this.type           = null;
        this.holdings       = null;
        this.provider       = null;
    }
    
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
        this.discipline         = null; // Qualifie les thèses.
        this.thesisType         = null; // Qualifie les thèses.
        this.isbn               = null;
        this.description        = null; // Usage à préciser.
        this.catalogUrl         = null;
        // this.onlineAccessUrl    = null;
        this.thumbnailUrl       = null; // A utiliser si la récupération se fait au niveau de la couche d'accès aux données.
        this.tags               = null;
        this.copies             = [];
        this.directAccesses     = [];
        this.detailsAvailable   = false; // Marque la possibilité d'enrichir ce contenu par une nouvelle requête.
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
        // this.numberOfResults    = null;
        this.results            = [];
        this.warningMessage     = "";
    }
    
    CatalogResultSet.prototype = {
        WARNING_MESSAGE: {
            TOO_MUCH_RESULTS: "Votre recherche renvoie de trop nombreux résultats. Merci de l'affiner."
        }    
    };

    function DataProviderFactory() {}
    
    DataProviderFactory.prototype = {
        
        getInstance: function ( dataProviderType ) {
            
            var parametersMap = {};
            
            switch (dataProviderType) {
            
                case "HipBook":
                    parametersMap = {
                        implementation:     new HipBookDataAnalyzer(),
                        maxResultsPerPage:  20,
                        dataType:           "xml"
                    };
                    break;
                    
                case "HipThesis":
                    parametersMap = {
                        implementation:     new HipThesisDataAnalyzer(),
                        maxResultsPerPage:  20,
                        dataType:           "xml"
                    };
                    break;
                case "HipPeriodical":
                    parametersMap = {
                        implementation:     new HipPeriodicalDataAnalyzer(),
                        maxResultsPerPage:  20,
                        dataType:           "xml"
                    };
                    break;
                case "EBookSpecific":
                    parametersMap = {
                        implementation:     new EBookSpecificDataAnalyzer(),
                        maxResultsPerPage:  100,
                        dataType:           "html"
                    };
                    break;
                case "ThesisSpecific":
                    parametersMap = {
                        implementation:     new ThesisSpecificDataAnalyzer(),
                        maxResultsPerPage:  25,
                        dataType:           "html"
                    };
                    break;
                case "EPeriodicalSpecific":
                    parametersMap = {
                        implementation:     new EPeriodicalSpecificDataAnalyzer(),
                        maxResultsPerPage:  100,
                        dataType:           "html"
                    };
                    break;
            }
            
            var fdp = new FacadeDataProvider(parametersMap);
            
            return fdp;
            
        }
        
    };
    
    /*********************************
    *   CLASS FacadeDataProvider
    *
    
    - Possède une URL d'accès
    
    - Méthodes :
        - Publiques :
        --- getDetailedItem
            @param  url           // Pointant sur une représentation distante et détaillée de la ressource
            @return copies        // Un tableau d'informations sur des exemplaires de la ressources

    */
    function FacadeDataProvider( parametersMap ) {
        // Propriétéliées au paramétrage du modèle
        this._analyzer              = parametersMap.implementation;
        this._MAX_RESULTS_PER_PAGE  = parametersMap.maxResultsPerPage;
        this._DATA_TYPE             = parametersMap.dataType;
        
        // Propriétés gérant l'état du modèle
        this._currentQueryString    = "";
        this._currentPageNumber     = 0;
        this._currentTotalOfResults = 0;
        this._moreResultsAvailable  = false;

    }

    FacadeDataProvider.prototype = {
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        moreResultsAvailable: function () {
            var lastPageNumber = Math.ceil(this._currentTotalOfResults / this._MAX_RESULTS_PER_PAGE);
            if (lastPageNumber > this._currentPageNumber) {
                return true;
            }
            
            return false;
        },
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getFreshSearchResults: function ( searchString ) {

            this._currentQueryString = searchString;
            var queryUrl = this._analyzer.buildRequestUrl(this._currentQueryString);
            
            return this._sendRequest(queryUrl);
        },
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getNextSearchResults: function () {
            
            var queryUrl = this._analyzer.buildRequestUrl(
                                this._currentQueryString,
                                this._currentPageNumber + 1);
            
            return this._sendRequest( queryUrl );
            
        },
        
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getTotalOfResults: function () {
          return this._currentTotalOfResults;  
        },
        
        _sendRequest: function ( queryUrl ) {
            
            var _self = this;
            
            var promisedResults = $.Deferred();
            
            var ajaxPromise = $.ajax({
                // The URL for the request
                // url: "proxy.php?index=.GK&limitbox_1=%24LAB7+%3D+s+or+%24LAB7+%3D+i&limitbox_3=&term=neurology&DonneXML=true",
                url: queryUrl,
                dataType: this._DATA_TYPE,
            });
            
            ajaxPromise.done(function (response) {
                
                    _self._analyzer.analyze(response);
                    _self._currentPageNumber        = _self._analyzer.getPageNumber();
                    _self._currentTotalOfResults    = _self._analyzer.getTotalOfResults();
                    var resultSet                   = _self._analyzer.getResultSet();
                
                    console.log("_sendRequest. Records found !");
                    console.log("_self._currentPageNumber : " + _self._currentPageNumber);
                    console.log("_self._currentTotalOfResults : " + _self._currentTotalOfResults);
                
                    _self._analyzer.unsetData();
                    promisedResults.resolve(resultSet);
                    // searchResultView._handleNewResultSet(resultSet);
            });
            
            ajaxPromise.always(function () {
                    // console.log("The request for _sendRequest is complete!");
            });

            return promisedResults;
        },
    
        // Fonction publique, que les ResultAreas sont susceptibles d'appeler.
        getDetailedItem: function ( url ) {
            // @todo supprimer le calcul suivant
            var itemIdentifier = url.slice(url.indexOf("?") + 1);
            var _self = this;
            var promisedResults = $.Deferred();
            
            
            // console.log("Query String : " + queryString);
            
            var ajaxPromise = $.ajax({
                url: _self._analyzer.buildItemUrl(itemIdentifier),
                dataType: _self._DATA_TYPE
            });
            
            
            ajaxPromise.done(function (response) {
                    var detailedItem = _self._analyzer.getAsCatalogItem(response);
                    // console.log("Copies found !");
                    promisedResults.resolve(detailedItem);
            });
            
            
            ajaxPromise.always(function () {
                // console.log("Within callback of promise.");
            });
            
            return promisedResults;
        }
    };
     
    function HipDataAnalyzer () {}
    
    HipDataAnalyzer.prototype = {
        _data: null,
        _pageNumber: 0,
        _numberOfResults: 0,
        _resultingResultSet: null,
        
        _SEARCH_RESTRICTION: "",
        
        
        analyze: function (data) {
            this._data = $(data);
            this._buildResultSet();
        },
        
        unsetData: function () {
            this._data = null;  
        },
        
        getPageNumber: function () {
            return this._pageNumber;
        },
    
        getTotalOfResults: function () {
            return this._numberOfResults;
        },
    
        getResultSet: function () {
            return this._resultingResultSet;
        },
        
        getAsCatalogItem : function (rawXmlData) {
            return this._convertDetailPageIntoCatalogItem(rawXmlData);
        },
        
        buildItemUrl: function (identifier) {
            return "proxy.php?DonneXML=true&" + identifier;
        },
        
        buildRequestUrl: function (searchString, pageNumber) {
            
            var urlArray = [
                "proxy.php?DonneXML=true&index=",
                encodeURIComponent(".GK"),
                "&limitbox_1=",
                encodeURIComponent(this._SEARCH_RESTRICTION),
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
        
        _buildDataItem: function (rawXmlData) {
            var item = new CatalogItem();

            item.title          = rawXmlData.find('TITLE>data>text').text();
            item.author         = rawXmlData.find('AUTHOR>data>text').text();
            item.publisher      = rawXmlData.find('PUBLISHER>data>text').text();
            item.publishedDate  = rawXmlData.find('PUBDATE>data>text').text();
            var sourceId        = rawXmlData.find('sourceid').text();
            var func            = rawXmlData.find('TITLE>data>link>func').text();
            item.isbn           = rawXmlData.find('isbn').text();
            item.issn           = rawXmlData.find('issn').text();
            item.thumbnailUrl   = "images/image.png";
            item.catalogUrl     = "http://catalogue.biusante.parisdescartes.fr/ipac20/ipac.jsp?uri=" + func + "&amp;source=" + sourceId;
            item.detailsAvailable = true;
            
            var vDocumentType   = rawXmlData.find('cell:nth-of-type(14)>data>text').text();
            if (vDocumentType) {
                item.documentType = vDocumentType.slice(vDocumentType.lastIndexOf(' ') + 1, vDocumentType.length - "$html$".length);
            }

            return item;
        },
        
        _buildResultSet: function () {
            // console.log("Results set building !");
            var $rawXmlData = this._data;

            var resultSet = new CatalogResultSet();
            var tempItems = [];
            var _self = this;
            
            // Récupérer le nombre de résultats
            this._numberOfResults = parseInt(this._data.find('searchresponse>yoursearch>hits').text(), 10);
            console.log("Number of results found : " + this._numberOfResults);
            // Calculer le numéro de la page courante
            switch (this._numberOfResults) {
                case 0:
                    this._pageNumber = 0;
                    break;
                case 1:
                    this._pageNumber = 1;
                    break;
                default:
                    this._pageNumber = parseInt(this._data.find('searchresponse>yoursearch>view>currpage').text(), 10);
                    break;
            }
            console.log("Page number found : " + this._pageNumber);
            
            // Si l'élément "fullnonmarc" est absent du XML, on a affaire à une page de résultats.
            if ($rawXmlData.find('searchresponse>fullnonmarc').length < 1) {
                
                // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
                var tempDataItem = null;
                $rawXmlData.find('searchresponse>summary>searchresults>results>row').each(function (index, value) {
                    tempDataItem = _self._buildDataItem($(value));
                    tempItems.push(tempDataItem);
                });
                
            }else {
                tempItems.push(_self.getAsCatalogItem($rawXmlData));
            }

            resultSet.results = tempItems;
            // console.log("Results set is built !");
            this._resultingResultSet = resultSet;
        },
        
        _convertDetailPageIntoCatalogItem: function (rawXmlData) {

            var copies = [];
            var directAccesses = [];
            var tempString = "";
            var tempTab = null;

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
            item.issn           = generalDataRoot.find('issn').text();
            
            var tempNode = generalDataRoot.find('PPN>data>text');
            item.catalogUrl     = (tempNode) ? "http://www.biusante.parisdescartes.fr/" + tempNode.text().replace(/ppn\s/g, "ppn?") : "";
            item.thumbnailUrl   = "images/image.png";
            
            var ic              = null;
            // Trouver les éventuelles localisations de monographies
            $(rawXmlData).find('searchresponse>items>searchresults>results>row').each(function () {
                
                var currentNode = $(this);

                tempString = currentNode.find('LOCALLOCATION>data>text').text();
 
                if (tempString.indexOf("Médecine") != -1) {
                    tempString = "Médecine";
                } else if (tempString.indexOf("Pharmacie") != -1) {
                    tempString = "Pharmacie";
                } else {
                    tempString = "";
                }
                
                if (tempString.length > 0) {
                    ic = new ItemCopy();
                    ic.library = tempString;

                    ic.precisePlace    = currentNode.find('TEMPORARYLOCATION:first-of-type>data>text').text();
                    ic.callNumber      = currentNode.find('CALLNUMBER>data>text').text();
                    ic.conditions      = currentNode.find('cell:nth-of-type(5)>data>text').text();

                    copies.push(ic);
                }
                // console.log("Details added !");
            });
            
            var vLocalisation   = null;
            tempTab         = null;
            // Trouver les éventuelles localisations physiques de périodique
            generalDataRoot.find('cell:nth-of-type(75)>data').each(function () {
                
                vLocalisation       = $(this).children('text').text();
                if (vLocalisation !== undefined && vLocalisation !== null & vLocalisation.length > 0) {
                    

                    console.log("vLocalisation set !");
                    console.log("Raw Localisation : " + vLocalisation);
                    tempTab = vLocalisation.split("$html$");
                    if (tempTab.length > 1) {
                        
                        ic            = new ItemCopy();
                        vLocalisation = tempTab[1];

                        tempTab = vLocalisation.split("Cote : ");
                        ic.callNumber = tempTab[1];

                        tempTab = tempTab[0].split("collection : ");
                        vLocalisation = tempTab[1];
                        ic.holdings = vLocalisation;

                        tempString = tempTab[0];
                        if (tempString.indexOf("Médecine") != -1) {
                            tempString = "Médecine";
                        } else if (tempString.indexOf("Pharmacie") != -1) {
                            tempString = "Pharmacie";
                        } else {
                            tempString = "";
                        }
                        ic.library = tempString;


                        console.log("Raw Localisation : " + vLocalisation);

                        copies.push(ic);
                    }
                }
            });
            
            var vDirectAccess = "";
            var da = null;
            var regexResult = null;
            
            // Trouver les éventuels liens d'accès en ligne
            generalDataRoot.find('cell:nth-of-type(6)>data').each(function () {
                
                vDirectAccess       = $(this).children('text').text();
                if (vDirectAccess !== undefined && vDirectAccess !== null & vDirectAccess.length > 0) {
                    console.log("vDirectAccess is defined !");
                    tempTab = vDirectAccess.split("$html$");
                    if (tempTab.length > 1) {
                        console.log("vDirectAccess has been splitted !");
                        vDirectAccess = tempTab[1];
                        da = new DirectAccess();
                        
                       regexResult = /href="(.+?)"/g.exec(vDirectAccess);
                        if (regexResult) {
                            console.log("regex successful !");
                            // = parseInt(regexResult[1], 10) + 1;
                            da.url = regexResult[1];
                            directAccesses.push(da);
                        }
                         
                    }
                }
            });
            
            item.directAccesses = directAccesses;
            item.copies = copies;
            
            return item;

        }
    };
    
    function HipBookDataAnalyzer () {
        this._data = null;
        this._pageNumber = 0;
        this._numberOfResults = 0;
        this._resultingResultSet = null;
    }
    
    HipBookDataAnalyzer.prototype = {
        
        _SEARCH_RESTRICTION: "$LAB7 = a or $LAB7 = c or $LAB7 = i or $LAB7 = m not $TH = *"
        
    };
    
    HipBookDataAnalyzer.prototype = $.extend({}, HipDataAnalyzer.prototype, HipBookDataAnalyzer.prototype);
    
    function HipThesisDataAnalyzer() {
        this._data = null;
        this._pageNumber = 0;
        this._numberOfResults = 0;
        this._resultingResultSet = null;
    }
    
    HipThesisDataAnalyzer.prototype = {
 
        _SEARCH_RESTRICTION: "$TH = *"
        
    };
    
    HipThesisDataAnalyzer.prototype = $.extend({}, HipDataAnalyzer.prototype, HipThesisDataAnalyzer.prototype);
    
    function HipPeriodicalDataAnalyzer() {
        this._data = null;
        this._pageNumber = 0;
        this._numberOfResults = 0;
        this._resultingResultSet = null;
    }
    
    HipPeriodicalDataAnalyzer.prototype = {

        _SEARCH_RESTRICTION: "$LAB7 = s or $LAB7 = i"

    };
    
    HipPeriodicalDataAnalyzer.prototype = $.extend({}, HipDataAnalyzer.prototype, HipPeriodicalDataAnalyzer.prototype);
    
    function EBookSpecificDataAnalyzer() {
        this._data = null;
        this._pageNumber = 0;
        this._numberOfResults = 0;
        this._resultingResultSet = null;
    }
    
    EBookSpecificDataAnalyzer.prototype = {
        
        _authorRegex: /Par\s(.*)\s*\.[A-Z]{3,}/g,
        
        analyze: function (data) {
            this._data = $(data);
            this._buildResultSet();
        },
        
        unsetData: function () {
          this._data = null;  
        },
    
        getPageNumber: function () {
            return this._pageNumber;
        },
    
        getTotalOfResults: function () {
            return this._numberOfResults;
        },
    
        getResultSet: function () {
            return this._resultingResultSet;
        },
        
        buildRequestUrl: function (searchString, pageNumber) {
            
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
         
        buildItemUrl: function () {
            return null;
        },
        
        _extractPageNumber: function () {
            var result = 1;
            
            var wrappingTable = this._data.find("#table247");
            
            var $flecheGauche = wrappingTable
                            .find("tr:nth-child(2)>td")
                            .find("img[src='http://www.biusante.parisdescartes.fr/imutil/flecheptg.gif'][alt^='page ']");
            
            console.log("EBookSpecificDataProvider. $flecheGauche found : " + $flecheGauche.length);
            if ($flecheGauche.length > 0) {
                
                var urlPagePrecedente = $flecheGauche.parent().attr("href");
                console.log("urlPagePrecedente found : " + urlPagePrecedente);
                var regexResult = /p=(\d+)/g.exec(urlPagePrecedente);
                
                if (regexResult) {
                    result = parseInt(regexResult[1], 10) + 1;
                }
            }
                
            console.log("EBook page number : " + result);
            return result;
        },

        _buildResultSet: function () {
            var $rawData = this._data;
            
            var resultSet = new CatalogResultSet();
            var wrappingTable = $rawData.find("#table247");
            
            // Récupérer le nombre de résultats
            var tempText = wrappingTable.find('tr:nth-child(2)>td>p').text();
            var regexResult = /:\s(\d+)\s/g.exec(tempText);
            this._numberOfResults = (regexResult) ? regexResult[1] : 0;
            
            // Calculer le numéro de la page courante
            this._pageNumber = this._extractPageNumber();

            // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
            var tempItems = [];
            var tempDataItem = null;

            var _self = this;
            wrappingTable.find('tr').each(function (index, value) {
                if (index > 6) { 
                    tempDataItem = _self._buildDataItem($(value));
                    tempItems.push(tempDataItem);
                }
            });
            // Il faut aussi exclure le dernier TR
            tempItems.pop();

            resultSet.results = tempItems;

            this._resultingResultSet = resultSet;
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
            var tempText = cell2.find('div').text();
            var regexResult = /Par\s(.*?)\s?\.?(PAYS|LANGUE)/g.exec(tempText);

            item.author         = (regexResult) ? regexResult[1] : "";
            item.publisher      = cell2.find('div > a').text();
            item.description    = cell2.find('div > i').text();
            
            // Récupération de la date de publication
            regexResult = /(\d{4})\.?/g.exec(tempText);
            item.publishedDate  = (regexResult) ? regexResult[1] : "";
            
            var directAccess = new DirectAccess();
            directAccess.url = cell2.find('p > a').attr("href");
            item.directAccesses.push(directAccess);

            var vDocumentType   = rawXmlData.find('cell:nth-of-type(14)>data>text').text();
            if (vDocumentType) {
                item.documentType = vDocumentType.slice(vDocumentType.lastIndexOf(' ') + 1, vDocumentType.length - "$html$".length);
            }

            return item;
        },

        getAsCatalogItem: function () {
            throw "Exception : UnsupportedOperationException";
        }

    };
    
    function ThesisSpecificDataAnalyzer() {
        this._data = null;
        this._pageNumber = 0;
        this._numberOfResults = 0;
        this._resultingResultSet = null;
    }
    
    ThesisSpecificDataAnalyzer.prototype = {
        
        analyze: function (data) {
            this._data = $(data);
            this._buildResultSet();
        },
        
        unsetData: function () {
            this._data = null;  
        },
    
        getPageNumber: function () {
            return this._pageNumber;
        },
    
        getTotalOfResults: function () {
            return this._numberOfResults;
        },
    
        getResultSet: function () {
            return this._resultingResultSet;
        },
        
        _extractPageNumber: function () {
            var result = 1;
            
            var $flecheGauche = this._data.find("img[src='http://www.biusante.parisdescartes.fr/imutil/flecheptg.gif'][alt^='page ']");
            console.log("$flecheGauche found : " + $flecheGauche);
            if ($flecheGauche.length > 0) {
                
                var urlPagePrecedente = $flecheGauche.parent().attr("href");
                console.log("urlPagePrecedente found : " + urlPagePrecedente);
                var regexResult = /p=(\d+)/g.exec(urlPagePrecedente);
                
                if (regexResult) {
                    result = parseInt(regexResult[1], 10) + 1;
                }
            }
                
            console.log("Thesis page number : " + result);
            return result;
        },
        
        _extractNumberOfResults: function () {
            var wrappingTable = this._data.find("#table245");
            var result = 0;
            
            // S'il y a des résultats, les analyser et alimenter le CatalogResultSet
            if (wrappingTable.length) {
                var tempText = wrappingTable.find('tr:nth-child(1)>td>p').text();

                var regexResult = /:\s(\d+)\s/g.exec(tempText);
                result   = (regexResult) ? regexResult[1] : 0;

            } else {

                wrappingTable = this._data.find("#table241");
                
                var messageCell = wrappingTable.find("tr:nth-child(2) > td:nth-child(1)");
                
                if (messageCell.text().indexOf("aucune réponse") !== -1) {
                    // La requête ne renvoie aucun résultat.
                    result = 0;
                } else {

                    result = messageCell.find("b").text();

                }
                
            }
            
            return result;
        },
        
        buildRequestUrl: function (searchString, pageNumber) {
            
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
         
        buildItemUrl: function () {
            return null;
        },

        _buildResultSet: function () {
            console.log("ThesisSpecificDataProvider... Beginning of _buildResultSet. Results set building !");
            
            var $rawXmlData = this._data;
            
            var resultSet = new CatalogResultSet();

            // Récupérer le nombre de résultats
            this._numberOfResults = this._extractNumberOfResults();
            
            // Calculer le numéro de la page courante
            this._pageNumber = this._extractPageNumber();
            
            var wrappingTable = $rawXmlData.find("#table245");
            
            // S'il y a des résultats, les analyser et alimenter le CatalogResultSet
            if (wrappingTable.length > 0) {
                
                // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
                var tempItems = [];
                var tempDataItem = null;

                var _self = this;
                wrappingTable.find('tr > td > table').each(function (index, value) {
                    tempDataItem = _self._buildDataItem($(value));
                    tempItems.push(tempDataItem);
                });

                resultSet.results = tempItems;
            } else {
              // console.log("ThesisSpecificDataProvider... #table245 not found !");
                wrappingTable = $rawXmlData.find("#table241");
                
                var messageCell = wrappingTable.find("tr:nth-child(2) > td:nth-child(1)");
                
                if (messageCell.text().indexOf("aucune réponse") === -1) {
                    resultSet.warningMessage = resultSet.WARNING_MESSAGE.TOO_MUCH_RESULTS;
                }
                
            }
            
            this._resultingResultSet = resultSet;
        },

        _buildDataItem: function (rawXmlData) {
            var item = new CatalogItem();
            
            // Récupération de l'auteur
            item.author          = rawXmlData.find('tr:nth-child(1)>td:nth-child(1)>b').text();
            
            // Récupération de la cote et de la date.
            var tempText = rawXmlData.find('tr:nth-child(1)>td:nth-child(2)>p>i').text();
            // console.log("tempText : " + tempText);
            var regexResult = /^(\d+)\s/g.exec(tempText);
            if (regexResult !== null) {
                item.publishedDate = regexResult[1];
            }
            var ic = new ItemCopy();
            ic.callNumber = tempText;
            ic.library      = "Médecine";
            item.copies.push(ic);
            
            // Récupération du titre
            item.title          = rawXmlData.find('tr:nth-child(2)>td').text();
            
            // Récupération du type et de la discipline de thèse.
            var tempElements = rawXmlData.find('tr:nth-child(3)>td').contents()
                .filter(function() {
                  return this.nodeType === 3;
                });
            item.discipline = tempElements.first().text();
            item.thesisType = tempElements.eq(1).text();
            
            return item;
        },

        getAsCatalogItem: function () {
            throw "Exception : UnsupportedOperationException";
        }

    };
    
    function EPeriodicalSpecificDataAnalyzer() {
        this._data = null;
        this._pageNumber = 0;
        this._numberOfResults = 0;
        this._resultingResultSet = null;
    }
    
    EPeriodicalSpecificDataAnalyzer.prototype = {
        
        // _authorRegex: /Par\s(.*)\s*\.[A-Z]{3,}/g,
        
        // Implémentation OK
        analyze: function (data) {
            this._data = $(data);
            this._buildResultSet();
        },
        
        // Implémentation OK
        unsetData: function () {
          this._data = null;  
        },
    
        // Implémentation OK
        getPageNumber: function () {
            return this._pageNumber;
        },
    
        // Implémentation OK
        getTotalOfResults: function () {
            return this._numberOfResults;
        },
    
        // Implémentation OK
        getResultSet: function () {
            return this._resultingResultSet;
        },
        
        // Implémentation OK
        buildRequestUrl: function (searchString, pageNumber) {
            
            // http://www2.biusante.parisdescartes.fr/perio/index.las?do=rec&let=0&rch=human+genetics
            var urlArray = [
                "proxy-perio.php?do=rec&let=0&rch=",
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
        
        // Implémentation OK
        buildItemUrl: function () {
            return null;
        },
        
        // Implémentation OK
        _extractPageNumber: function () {
            var result = 1;
            
            var wrappingTable = this._data.find("#table242");
            
            var $flecheGauche = wrappingTable
                            .find("tr:nth-child(1)>td")
                            .find("img[src='http://www.biusante.parisdescartes.fr/imutil/flecheptg.gif'][alt^='page ']");
            
            console.log("EBookSpecificDataProvider. $flecheGauche found : " + $flecheGauche.length);
            if ($flecheGauche.length > 0) {
                
                var urlPagePrecedente = $flecheGauche.parent().attr("href");
                console.log("urlPagePrecedente found : " + urlPagePrecedente);
                var regexResult = /p=(\d+)/g.exec(urlPagePrecedente);
                
                if (regexResult) {
                    result = parseInt(regexResult[1], 10) + 1;
                }
            }
                
            console.log("EBook page number : " + result);
            return result;
        },

        // Implémentation OK
        _buildResultSet: function () {
            var $rawData = this._data;
            
            var resultSet = new CatalogResultSet();
            var wrappingTable = $rawData.find("#table242");
            
            // Récupérer le nombre de résultats
            var tempText = wrappingTable.find('tr:nth-child(1)>td>p').text();
            var regexResult = /sur\s(\d+)/g.exec(tempText);
            this._numberOfResults = (regexResult) ? regexResult[1] : 0;
            
            // Calculer le numéro de la page courante
            this._pageNumber = this._extractPageNumber();

            // Récupérer, ligne à ligne, les données, les mettre en forme et les attacher à la liste
            var tempItems = [];
            var tempDataItem = null;

            var _self = this;
            wrappingTable.find('tr').has('table').each(function (index, value) {
                if (index > 1) { 
                    tempDataItem = _self._buildDataItem($(value));
                    tempItems.push(tempDataItem);
                }
            });
            // Il faut aussi exclure le dernier TR
            tempItems.pop();

            resultSet.results = tempItems;

            this._resultingResultSet = resultSet;
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
        _buildDataItem: function ($htmlData) {
            var item = new CatalogItem();
            var directAccesses = [];
            //var cell2 = rawXmlData.find('td > b > span');
            // 
            item.title          = $htmlData.find('td > b > span').text();
            
            var siblings = $htmlData.nextUntil('tr:has(table)');
            
            var da = null;
            var tempNode = null;
            var tempString = "";
            var regexResult = null;
            siblings.each(function () {
                tempNode = $(this);
                da = new DirectAccess();
                da.url = "http://www2.biusante.parisdescartes.fr/perio/index.las" + tempNode.find('td > a').attr('href');
                console.log("da.url : " + da.url);
                tempString = tempNode.find('td:nth-child(3)').text();
                console.log("tempString : " + tempString);
                regexResult = /\s+-\s+(.+?)[\s.]+$/g.exec(tempString);
                if (regexResult) {
                    //da.provider = regexResult[1];
                    da.holdings = regexResult[1];
                    console.log("da.holdings : " + da.holdings);
                } else {
                    console.log("RegEx failed !");
                }
                directAccesses.push(da);
            });
            
            item.directAccesses = directAccesses;
            /*
            // Récupération de l'auteur
            var tempText = cell2.find('div').text();
            var regexResult = /Par\s(.*?)\s?\.?(PAYS|LANGUE)/g.exec(tempText);

            item.author         = (regexResult) ? regexResult[1] : "";
            item.publisher      = cell2.find('div > a').text();
            item.description    = cell2.find('div > i').text();
            
            // Récupération de la date de publication
            regexResult = /(\d{4})\.?/g.exec(tempText);
            item.publishedDate  = (regexResult) ? regexResult[1] : "";
            
            var directAccess = new DirectAccess();
            directAccess.url = cell2.find('p > a').attr("href");
            item.directAccesses.push(directAccess);

            var vDocumentType   = rawXmlData.find('cell:nth-of-type(14)>data>text').text();
            if (vDocumentType) {
                item.documentType = vDocumentType.slice(vDocumentType.lastIndexOf(' ') + 1, vDocumentType.length - "$html$".length);
            }
            */
            return item;
        },

        getAsCatalogItem: function () {
            throw "Exception : UnsupportedOperationException";
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
        this._activeResultAreasSet  = [];
        this._resultAreasSets       = [];
        
        // Créer et attacher les ResultAreas
        var dpf = new DataProviderFactory();
        
        var tempResultAreasSet = [];
        tempResultAreasSet.push(
                new ResultsArea("Thèses anciennes", "Catalogue général (1800&nbsp;-&nbsp;1951)", "student", this, dpf.getInstance("HipThesis"))
        );
        tempResultAreasSet.push(
                new ResultsArea("Thèses récentes", "Catalogue spécifique (1985&nbsp;-&nbsp;&hellip;)", "student", this, dpf.getInstance("ThesisSpecific"))
        );
        tempResultAreasSet.push(
                new ResultsArea("Ouvrages", "Catalogue général", "book", this, dpf.getInstance("HipBook"))
        );
        tempResultAreasSet.push(
                new ResultsArea("Livres électroniques", "Catalogue spécifique", "tablet", this, dpf.getInstance("EBookSpecific"))
        );
        
        this._resultAreasSets["monographies"] = tempResultAreasSet;
        tempResultAreasSet = [];
        
        tempResultAreasSet.push(
                new ResultsArea("Périodiques", "Catalogue général", "newspaper", this, dpf.getInstance("HipPeriodical"))
        );
        tempResultAreasSet.push(
                new ResultsArea("Périodiques", "Catalogue spécifique", "tablet", this, dpf.getInstance("EPeriodicalSpecific"))
        );
        
        this._resultAreasSets["periodiques"] = tempResultAreasSet;
        
        this._activateResultAreasSet("periodiques");
        
        // Attacher les gestionnaires d'évènements
        this._form.submit($.proxy(this._updateCurrentRequest, this));
        
        // Initialiser les champs de formulaire
        var _self = this;
        $("#search-extension-selection").on(
            "click",
            function () {
                var selected = "Unknown";
                $("#search-extension-selection :checkbox")
                .each(
                    function () {
                        this.checked = !this.checked;
                        if (this.checked) {
                            selected = $(this).val();
                        }
                        
                    }
                );
                console.log("selected : " + selected);
                _self._activateResultAreasSet(selected);
            }
        );
        
        // Activer le formulaire de recherche
        this._form.find("input").removeAttr("disabled");
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
        
        _activateResultAreasSet: function (setName) {
            var resultAreasSet = this._resultAreasSets[setName];
            // Détacher les précédentes ResultAreas.
            this._searchResultsContainer.empty();
            // Attacher les ResultAreas sélectionnées.
            for (var i = 0, len = resultAreasSet.length ; i < len ; i++) {
                resultAreasSet[i].activate();
            }
            this._setStats(0);
            this._form.find("input[type=text]").val("");
            this._activeResultAreasSet = resultAreasSet;
        },
        
        _updateStats: function () {
            var totalOfResults = 0;
            var tempResultArea = null;

            for(var i=0, len=this._activeResultAreasSet.length ; i < len ; i++) {
                tempResultArea = this._activeResultAreasSet[i];
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
            
            for(var i=0, len=this._activeResultAreasSet.length; i < len ; i++) {
                tempResultArea = this._activeResultAreasSet[i];
                if (tempResultArea) {
                    tempPromise = tempResultArea.handleQueryUpdate();
                    tempPromise.done(updateStatsFunction);
                    promises.push(tempPromise);   
                }
            }
            
            this._updateStats();
            
            $.when.apply($, promises).always(
                function () {
                    _self._setLoadingStateOff();
                }
            );

        },
        
        
        _setStats: function ( nResults ) {
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
    function ResultsArea(title, subtitle, iconName, searchArea, dataProvider) {
        
        // Initialisées à la création de l'objet
        this._searchArea    = searchArea;
        this._dataProvider  = dataProvider;
        this._title         = title;
        this._subtitle      = subtitle;
        this._iconName      = iconName;
        
        // Déclarer les autres propriétés
        this._currentTotalResults   = null;
        this._container             = null;
        this._statsContainer        = null;
    
        // Construire le balisage HTML/CSS
        var mustacheRendering   = Mustache.render(
                                        this.mustacheTemplate,
                                        {
                                            title: this._title,
                                            subtitle: this._subtitle,
                                            iconName: this._iconName
                                        });
        this._container         = $(mustacheRendering);
        this._statsContainer    = this._container.find("div.statistic");
    
        // Activer la ResultArea :
        // - la vider,
        // - y attacher les gestionnaires d'évènements,
        // - la rattacher au conteneur idoine.
        this.activate();
    }

    ResultsArea.prototype = {
        
        activate: function () {
            this._clear();
            
            var _self = this;
            this._container.on("click", "a.header", $.proxy(_self._askForItemDetails, _self));
            this._container.on("click", "button.catalog-link", function () {
                window.open($(this).attr("data-catalog-url"));
            });
            this._container.on("click", "button.online-access-link", function () {
                window.open($(this).attr("data-online-access-url"));
            });
            this._container.on("click", "button.more-results", $.proxy(_self._handleMoreResultsAction, _self));

            this._container.appendTo(this._searchArea.getResultsContainer());
        },
        
        // Fonction publique, que les SearchArea sont susceptibles d'appeler.
        handleQueryUpdate: function () {
            this._clear();
            return this._askForResults.call(this, this._searchArea.getSearchString(), true);
        },
        
        // Fonction publique, que les SearchArea sont susceptibles d'appeler. 
        getStats: function () {
            return parseInt(this._currentTotalResults, 10);
        },
        
        mustacheTemplate: function () {
            var template = $('#empty-results-area-template').html();
            Mustache.parse(template);
            return template;
        }(),
        
        _askForResults: function( request, isNewSearch ) {
            
            this._setLoadingStateOn();
            
            var resultsHandled = $.Deferred();
            var promisedResults = null;
            
            if (isNewSearch === true) {
                promisedResults = this._dataProvider.getFreshSearchResults(request);
            } else {
                promisedResults = this._dataProvider.getNextSearchResults();
            }
            
            var _self = this;
            promisedResults
                .done(
                    function( results ) {
                        _self._handleNewResultSet( results );
                        _self._askForThumbnailUrl();
                    }
                ).always(
                    function () {
                        _self._setLoadingStateOff();
                        resultsHandled.resolve();
                    }
            );

            return resultsHandled;
        },
        
        _handleMoreResultsAction: function (event) {
            event.preventDefault();
            return this._askForResults();
        },
        
        _askForItemDetails: function ( event ) {

            event.preventDefault();

            var domItem = $(event.currentTarget).closest(".item");

            this._setItemLoadingStateOn(domItem);

            var promisedResults = this._dataProvider.getDetailedItem(domItem.data("catalog-url"));
            
            var _self = this;
            promisedResults.done(function ( results ) {   
                _self._handleNewItemDetails(results, domItem);
                _self._setItemLoadingStateOff(domItem);
            });
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
            newItem.find("span.label.popup-conditions").popup();
            domItem.replaceWith(newItem);
            
          // console.log("handleDetails is finished !");
        },
        
        _handleNewResultSet: function (resultSet) {
          // console.log("_handleNewResultSet has been called !");

          // console.log("Results handled !");

            // this._currentTotalResults  = parseInt(resultSet.numberOfResults, 10);
            this._currentTotalResults  = this._dataProvider.getTotalOfResults();

            // Récupérer, ligne à ligne, les données,
            // les mettre en forme et les attacher au conteneur d'items
            var tempDomItem = null;
            
            var listRoot = $("<div class='ui relaxed divided items'></div>");
            var resultsArray = resultSet.results;
            for (var i = 0, len = resultsArray.length; i < len; i++) {
                tempDomItem = this._buildResultItem(resultsArray[i]);
                tempDomItem.appendTo(listRoot);
            }
            
            this._container.find(".items").append(listRoot.children(".item"));
            
            // Supprimer le bouton "Plus de résultats".
            this._container.find("button.more-results").remove();
            this._container.find("div.message").remove();
            
            if (resultSet.warningMessage === resultSet.WARNING_MESSAGE.TOO_MUCH_RESULTS) {
                $("<div class='ui icon info message'><i class='warning icon'></i><div class='content'><div class='header'>Trop de réponses.</div><p>Merci d'affiner votre recherche.</p></div></div>")
                    .appendTo(this._container);
            } else {
                // S'il existe des résultats non encore affichés, insérer le bouton "Plus de résultats"
                if (this._dataProvider.moreResultsAvailable()) {
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
        },
        
        _clear: function() {
            this._container.children(".items").empty();
            this._container.children("button.more-results").remove();
            this._container.children(".message").remove();
            this._currentTotalResults = 0;
            this._setStats(0);
        }
    };
    
    // Lancement du widget
    new SearchArea();

});