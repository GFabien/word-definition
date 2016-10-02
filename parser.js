
var https = require("https");

var titlesURL = ".wiktionary.org/w/api.php?action=query&list=search&format=json&utf8&srprop=&srsearch=";
var pagesURL = ".wiktionary.org/w/api.php?action=query&prop=revisions&rvprop=content&format=json&titles=";

var parser = function(word, lng, options, callback) {

	this.word = word;
	this.lng = lng;
	this.options = options || {};
	this.callback = callback;
	this.srwhat = "nearmatch";

	this.stripAccents = this.options.exact == false ?  stripAccents : function(text) { return text; };

}

var errors = {
	notFound: "not found",
	req: "a request has failed"
}

parser.prototype.sendErr = function(err, word) {

	this.callback( { word: word || this.word, err: err });

}

parser.prototype.getTitles = function() {

	var req = https.get("https://" + this.lng + titlesURL + this.word + "&srwhat=" + this.srwhat, function(result) {

		var cont = "";

		result.on("data", function(chunk) { cont += chunk; })
		.on("end", function() { 
			var articles = JSON.parse(cont).query.search;
			if(articles.length) {
				var exclude = this.titles ? this.titles[0] : "";
				this.titles = [];
				var word2 = this.stripAccents(this.word.toLowerCase());
				articles.forEach(function(article) {
					var title = article.title;
					if (title != exclude && this.stripAccents(title.toLowerCase()) == word2) this.titles.push(title);
				}, this);
				if (this.titles.length) this.getPage();
				else this.sendErr(errors.notFound);
			}
			else {
				if(this.srwhat == "nearmatch") {
					this.srwhat = "text";
					this.getTitles();
				}
				else this.sendErr(errors.notFound);
			}
		}.bind(this));

	}.bind(this));

	req.on("error", function() { this.sendErr(errors.req) }.bind(this));

}

parser.prototype.getPage = function() {

	var req = https.get("https://" + this.lng + pagesURL + encodeURIComponent(this.titles[0]), function(result) {
		var cont = "";
		result.on("data", function(chunk) { cont += chunk;	})
		.on("end", function() {
			var pages = JSON.parse(cont).query.pages;
			var page = pages[Object.keys(pages)[0]].revisions[0]["*"];
			this.parse(page);
		}.bind(this));
	}.bind(this));

	req.on("error", function() { this.sendErr(errors.req) }.bind(this));

}

parser.prototype.parse = function(page) {

	var def = this.searchDef(page);

	if (def == true) return;

	if (def) {
		for(var i = 0, len = this.variants.length; i < len; i++) {
			var found = this.variants[i].exec(def);
			if(found) {
				this.titles[0] = found[found.length - 1];
				// console.log (this.word + " : variant #" + i + " ==> " + this.titles[0]);
				this.getPage();
				return;
			}
		}
		this.cleanup(this.titles[0], this.cat.toLowerCase(), def);
	}

	else {
		delete this.cat;
		if (this.srwhat == "nearmatch") {
			this.srwhat = "text";
			this.getTitles();
		}
		else {
			this.titles.shift();
			if(this.titles.length) this.getPage();
			else this.sendErr(errors.notFound); 
		}
	}

}

parser.prototype.cleanup = function(word, cat, def) {

	def = def.replace(/{{[^}]*}}/g, "").trim();

	if(/^\s*\.*$/.test(def)) return this.sendErr(errors.notFound, word);

	def = def.replace(/'''([^']+)'''/g, this.options.formatted ? "<span style='bold'>$1</span>" : "$1");
	def = def.replace(/''([^']+)''/g, this.options.formatted ? "<span style='italic'>$1</span>" : "$1");

	switch(this.options.hyperlinks) {
		case "brackets":
			break;
		case "html":
			var url = "https://" + this.lng + ".wiktionary.org/wiki/";
			def = def.replace(/\[\[([^\]|]+)(\|)([^\]]+)\]\]/g,	"<a href='" + url + "$1' target='_blank'>$3</a>");
			def = def.replace(/\[\[([^\]]+)\]\]/g,	"<a href='" + url + "$1' target='_blank'>$1</a>");
			break;
		case "none":
		default:
			def = def.replace(/\[\[([^\]|]+\|)*([^\]]+)\]\]/g, "$2");
	}

	this.callback({ "word": word, "category": cat, "definition": def.trim() });
}

function stripAccents(text) {

	var replace = {
		à: "a", á: "a", â: "a", ã: "a", ä: "a",
		ç: "c",
		è: "e", é: "e", ê: "e", ë: "e",
		ì: "i", í: "i", î: "i", ï: "i",
		ñ: "n",
		ò: "o", ó: "o", ô: "o", õ: "o", ö: "o",
		ù: "u", ú: "u", û: "u", ü: "u",
		ý: "y", ÿ: "y"
	}

	for (var i = 0, len = text.length, res = ""; i < len; i++) res += replace[text[i]] || text[i];
	return res;

}

module.exports.parser = parser;
module.exports.stripAccents = stripAccents;
