// PrimeSrc Scraper - Scrubbed Version
// No external TMDB lookups - Direct IMDb/TMDB param usage

var PRIMESRC_API = "https://primesrc.me/api/v1/";

function getStreams(id, mediaType, season, episode) {
    // 1. Determine ID type (imdb vs tmdb)
    var idParam = (typeof id === 'string' && id.indexOf('tt') === 0) ? "&imdb=" : "&tmdb=";
    var type = (season && episode) ? "tv" : "movie";
    
    // 2. Build Search URL
    var searchUrl = PRIMESRC_API + "list_servers?type=" + type + idParam + id;
    if (type === "tv") {
        searchUrl += "&season=" + season + "&episode=" + episode;
    }

    // Exact UA from your working playback logs
    var ua = "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36";

    return fetch(searchUrl, {
        headers: { "User-Agent": ua, "Referer": "https://primesrc.me/" }
    })
    .then(function(res) { 
        return res.json(); 
    })
    .then(function(data) {
        if (!data || !data.servers) return [];

        var fetchPromises = data.servers.map(function(s) {
            return fetch(PRIMESRC_API + "l?key=" + s.key, {
                headers: { "User-Agent": ua, "Referer": "https://primesrc.me/" }
            })
            .then(function(lRes) { return lRes.json(); })
            .then(function(lData) {
                if (!lData || !lData.link) return null;

                var finalUrl = lData.link;
                var streamRef = "https://primesrc.me/";

                // Referer fixes for 23003 playback error
                if (finalUrl.indexOf("streamta.site") !== -1) streamRef = "https://streamta.site/";
                if (finalUrl.indexOf("cloudatacdn.com") !== -1) streamRef = "https://playmogo.com/";

                return {
                    name: "PrimeSrc: " + (s.name || "HD"),
                    url: finalUrl,
                    quality: "1080p",
                    headers: {
                        "User-Agent": ua,
                        "Referer": streamRef,
                        "Origin": streamRef.replace(/\/$/, ""),
                        "Accept": "*/*"
                    }
                };
            })
            .catch(function() { return null; });
        });

        return Promise.all(fetchPromises).then(function(results) {
            var filtered = [];
            for (var i = 0; i < results.length; i++) {
                if (results[i]) filtered.push(results[i]);
            }
            return filtered;
        });
    })
    .catch(function() { 
        return []; 
    });
}

if (typeof module !== 'undefined') module.exports = { getStreams: getStreams };
