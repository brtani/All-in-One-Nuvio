// PrimeSrc Scraper for Nuvio
// Focus: Restore Fetching + Fix 23003 Error

var PRIMESRC_API = "https://primesrc.me/api/v1/";

function getStreams(id, mediaType, season, episode) {
    var type = (season && episode) ? "tv" : "movie";
    var isImdb = (typeof id === 'string' && id.indexOf('tt') === 0);
    
    // Build Search URL
    var searchUrl = PRIMESRC_API + "list_servers?type=" + type;
    if (isImdb) {
        searchUrl += "&imdb=" + id;
    } else {
        searchUrl += "&tmdb=" + id;
    }
    
    if (type === "tv") {
        searchUrl += "&season=" + season + "&episode=" + episode;
    }

    var ua = "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36";

    return fetch(searchUrl, {
        headers: { "User-Agent": ua, "Referer": "https://primesrc.me/" }
    })
    .then(function(res) { 
        return res.json(); 
    })
    .then(function(data) {
        if (!data || !data.servers) return [];

        // Map servers to links
        var fetchPromises = data.servers.map(function(s) {
            return fetch(PRIMESRC_API + "l?key=" + s.key, {
                headers: { "User-Agent": ua, "Referer": "https://primesrc.me/" }
            })
            .then(function(lRes) { return lRes.json(); })
            .then(function(lData) {
                if (!lData || !lData.link) return null;

                var finalUrl = lData.link;
                var streamRef = "https://primesrc.me/";

                // Apply referer fixes from your successful logs to stop 23003
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
            return results.filter(function(x) { return x !== null; });
        });
    })
    .catch(function() { 
        return []; 
    });
}

if (typeof module !== 'undefined') module.exports = { getStreams: getStreams };
