var PRIMESRC_API = "https://primesrc.me/api/v1/";

function getStreams(id, mediaType, season, episode) {
    var type = (season && episode) ? "tv" : "movie";
    var isImdb = (typeof id === 'string' && id.indexOf('tt') === 0);
    
    // 1. SIMPLEST URL CONSTRUCTION
    var searchUrl = PRIMESRC_API + "list_servers?type=" + type;
    if (isImdb) {
        searchUrl += "&imdb=" + id;
    } else {
        searchUrl += "&tmdb=" + id;
    }
    
    if (type === "tv") {
        searchUrl += "&season=" + season + "&episode=" + episode;
    }

    // Exact UA from your logs
    var ua = "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36";

    // 2. RAW FETCH (NO COMPLEX PROMISE WRAPPERS)
    return fetch(searchUrl, {
        headers: { "User-Agent": ua, "Referer": "https://primesrc.me/" }
    })
    .then(function(res) { 
        return res.json(); 
    })
    .then(function(data) {
        if (!data || !data.servers) return [];

        var results = [];
        var servers = data.servers;

        // Using a basic for-loop - most stable in Nuvio
        var allPromises = [];
        for (var i = 0; i < servers.length; i++) {
            (function(s) {
                var p = fetch(PRIMESRC_API + "l?key=" + s.key, {
                    headers: { "User-Agent": ua, "Referer": "https://primesrc.me/" }
                })
                .then(function(lRes) { return lRes.json(); })
                .then(function(ld) {
                    if (ld && ld.link) {
                        var streamUrl = ld.link;
                        var ref = "https://primesrc.me/";

                        // Apply the exact Referer/Origin fixes from your logs
                        if (streamUrl.indexOf("streamta.site") !== -1) {
                            ref = "https://streamta.site/";
                        } else if (streamUrl.indexOf("cloudatacdn.com") !== -1) {
                            ref = "https://playmogo.com/";
                        }

                        return {
                            name: "PrimeSrc: " + (s.name || "Server"),
                            url: streamUrl,
                            headers: {
                                "User-Agent": ua,
                                "Referer": ref,
                                "Origin": ref.replace(/\/$/, ""),
                                "Accept": "*/*",
                                "Accept-Encoding": "identity;q=1, *;q=0"
                            }
                        };
                    }
                    return null;
                })
                .catch(function() { return null; });
                allPromises.push(p);
            })(servers[i]);
        }

        return Promise.all(allPromises).then(function(items) {
            var filtered = [];
            for (var j = 0; j < items.length; j++) {
                if (items[j]) filtered.push(items[j]);
            }
            return filtered;
        });
    })
    .catch(function() { return []; });
}

if (typeof module !== 'undefined') module.exports = { getStreams: getStreams };
