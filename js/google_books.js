/*
	Show Google Book covers for catalog records using ISBN
	Peter Tyrrell, Andornot, May 2010 http://andornot.com
	n.b. dependent on jquery http://jquery.com
*/


/*
Copyright (c) 2003-2013, Peter Tyrrell and Andornot Consulting Inc.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

Neither the name "Peter Tyrrell" nor "Andornot Consulting Inc."
may be used to endorse or promote products derived from this software
without specific prior written permission.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/


(function () {

	var $covers = window.$covers = {};

	var _$isbnContainers = null;
	var _isbns = [];

	var getIsbns = function (containers) {
		var list = [];
		containers.each(function () {
			//var isbn = $.trim($(this).text());
			var text = $(this).text();
			if (text !== "") {
				list.push(text.split("|")[0]);
			}
		});
		return list;
	};

	$covers.init = function ($isbnContainers) {
			_$isbnContainers = $isbnContainers;
			_isbns = getIsbns(_$isbnContainers);
			return $covers;
	};

	$covers.isbns = function () {
		return _isbns;
	};

	$covers.url = function () {
		return "http://books.google.com/books?jscmd=viewapi&bibkeys={0}&callback=?".replace("{0}", $covers.isbns().join(","));
	};

	$covers.css =  {
		link: "googleLink",
		thumbnail: "googleBook",
		noThumbnail: "noImage",
		noLink: "noLink"
	};

	$covers.elements = {
		link: $("<a target='_blank' title='Click to get more info from Google Books'></a>").addClass($covers.css.link),
		thumbnail: $("<img alt='Google book cover' />").addClass($covers.css.thumbnail),
		noThumbnail: $("<img alt='Google book preview' />").addClass($covers.css.noThumbnail).attr("src", "layout/images/gbs_preview_button1.gif"),
		noLink: $("<img alt='No Google preview' />").addClass($covers.css.noLink).attr("src", "layout/images/gbs_preview_button1_gray.png")
	};

	$covers.callback = function (results) {



		// create link to google book info, with/without thumbnail
		var createLink = function (result) {
            var link = $covers.elements.link.clone();
            link.attr("href", result.info_url);
            if (result.thumbnail_url) {
                link.append($covers.elements.thumbnail.clone().attr("src", result.thumbnail_url));
            }
            else {
            	link.append($covers.elements.noThumbnail.clone());
            }
            return link;
		};

		// append links to spans associated with isbns
		$.each(results, function (i, result) {
			if (result.bib_key.length < 10) { return true; }
			_$isbnContainers.filter(":contains('" + result.bib_key + "')")
				.empty().append(createLink(result))
            	.show()

            	// activate extra link in full display
            	.next("a.moreGoogle")
            		.attr("href", result.info_url)
            		.show();
		});

		// mark those with no preview
		_$isbnContainers.filter(":not(:has(a))").each(function () {
			$(this).empty().append($covers.elements.noLink.clone()).show();
		});
	};

	$covers.get = function() {
		$.getJSON($covers.url(), $covers.callback);
	};

})();

$(document).ready(function() {
	$covers.init($("div.isbn")).get();

});
