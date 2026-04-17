/*{
"name": "ShowBox TV Pro",
"version": "1.5.0",
"settings": [
{"name": "uiToken", "type": "text", "label": "UI Token (Cookie)"},
{"name": "ossGroup", "type": "text", "label": "OSS Group"}
]
}*/

var TMDB_KEY = '439c478a771f35c05022f9feabcca01c';

function getSettings() {
    var s = (typeof global !== 'undefined' && global.SCRAPER_SETTINGS) ? global.SCRAPER_SETTINGS : {};
    return s;
}

function getStreams(tmdbId, type, s, e) {
    var settings = getSettings();
    var token = settings.uiToken;
    var oss = settings.ossGroup;

    if (!token) {
        console.log("No Token found");
        return Promise.resolve([]);
    }

    var tmdbUrl = 'https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv/' : 'movie/') + tmdbId + '?api_key=' + TMDB_KEY;

    return fetch(tmdbUrl).then(function(r) { return r.json(); }).then(function(m) {
        var title = (type === 'tv' ? m.name : m.title) || "Media";
        var api = (type === 'tv') 
            ? 'https://febapi.nuvioapp.space/api/media/tv/' + tmdbId + (oss ? '/oss=' + oss : '') + '/' + s + '/' + e + '?cookie=' + encodeURIComponent(token)
            : 'https://febapi.nuvioapp.space/api/media/movie/' + tmdbId + '?cookie=' + encodeURIComponent(token);

        return fetch(api, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 11)' } })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (!d || !d.versions) return [];
                var results = [];
                d.versions.forEach(function(v) {
                    if (v.links) v.links.forEach(function(l) {
                        results.push({
                            name: "ShowBox " + (l.quality || "HD"),
                            title: title,
                            url: l.url,
                            quality: l.quality || "HD",
                            provider: "showbox"
                        });
                    });
                });
                return results;
            });
    }).catch(function() { return []; });
}

global.getStreams = getStreams;
