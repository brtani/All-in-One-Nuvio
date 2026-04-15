// PrimeSrc Scraper - Bulletproof Nuvio Version
var PRIMESRC_BASE = "https://primesrc.me/api/v1/";

function getStreams(id, mediaType, season, episode) {
    // 1. Setup ID and Type
    var isImdb = (typeof id === 'string' && id.indexOf('tt') === 0);
    var type = (season && episode) ? "tv" : "movie";
    
    // 2. Build URL strictly according to your provided docs
    var url = PRIMESRC_BASE + "list_servers?type=" + type;
    if (isImdb) {
        url += "&imdb=" + id;
    } else {
        url += "&tmdb=" + id;
    }
    
    if (type === "tv") {
        url += "&season=" + season + "&episode=" + episode;
    }

    console.log("[PrimeSrc] Requesting URL: " + url);

    // 3. Simple Fetch with NO advanced headers (sometimes less is more in Nuvio)
    return fetch(url)
    .then(function(response) {
        if (!response.ok) return null;
        return response.json();
    })
    .then(function(data) {
        // Safety Check: If data is empty or servers missing
        if (!data || !data.servers || !Array.isArray(data.servers)) {
            console.log("[PrimeSrc] No servers array found in JSON");
            return [];
        }

        var results = [];
        for (var i = 0; i < data.servers.length; i++) {
            var s = data.servers[i];
            if (!s.name) continue;

            // Reconstruct the EMBED URL as the video source
            // This is the most reliable way to get playback working
            var embedUrl = "https://primesrc.me/embed/" + type + "?";
            if (isImdb) {
                embedUrl += "imdb=" + id;
            } else {
                embedUrl += "tmdb=" + id;
            }

            if (type === "tv") {
                embedUrl += "&season=" + season + "&episode=" + episode;
            }

            // Force this specific server
            embedUrl += "&whitelistServers=" + encodeURIComponent(s.name);

            results.push({
                name: "PrimeSrc: " + s.name,
                url: embedUrl,
                quality: "Auto",
                // Essential headers for Android TV
                headers: {
                    "Referer": "https://primesrc.me/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            });
        }

        console.log("[PrimeSrc] Found " + results.length + " servers");
        return results;
    })
    .catch(function(err) {
        console.error("[PrimeSrc] Fatal Fetch Error: " + err.message);
        return [];
    });
}

// Ensure Nuvio sees the function
if (typeof module !== 'undefined') { module.exports = { getStreams: getStreams }; }
