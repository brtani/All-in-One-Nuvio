const TMDB_API_KEY = "20bf0a5cbc307e7889137457fa5b6b37";
const VIDSRC_BASE = "https://vidsrc.wtf/embed"; // The link you found

// These are the exact headers you provided, which are perfect for this provider
const PLAYBACK_HEADERS = {
  "Origin": "https://player.videasy.net",
  "Referer": "https://player.videasy.net/",
  "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "User-Agent": "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36"
};

function getTmdbInfo(tmdbId, mediaType) {
  var url = "https://api.themoviedb.org/3/" + (mediaType === "tv" ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;
  return fetch(url).then(function(r) { return r.json(); });
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  mediaType = mediaType || "movie";
  
  return getTmdbInfo(tmdbId, mediaType)
    .then(function(info) {
      // VidSrc structure: /movie/tmdbId or /tv/tmdbId/season/episode
      var embedUrl = mediaType === "movie" 
        ? VIDSRC_BASE + "/movie/" + tmdbId 
        : VIDSRC_BASE + "/tv/" + tmdbId + "/" + seasonNum + "/" + episodeNum;

      var label = mediaType === "tv" 
        ? info.name + " S" + String(seasonNum).padStart(2, "0") + "E" + String(episodeNum).padStart(2, "0")
        : info.title;

      console.log("[VidSrc] Generating stream link for: " + label);

      // Since VidSrc is an embed, we return the embed URL directly. 
      // Most players (like Nuvio) will then resolve the underlying m3u8.
      return [{
        name: "VidSrc (RGShows Source)",
        title: label,
        url: embedUrl,
        quality: "Auto",
        headers: PLAYBACK_HEADERS,
        provider: "vidsrc"
      }];
    })
    .catch(function(err) {
      console.error("[Scraper] Error: " + err.message);
      return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams };
}
