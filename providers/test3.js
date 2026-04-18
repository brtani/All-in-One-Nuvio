const TMDB_API_KEY = "20bf0a5cbc307e7889137457fa5b6b37";

// The WORKING headers you provided from your successful playback
const PLAYER_HEADERS = {
  "Origin": "https://player.videasy.net",
  "Referer": "https://player.videasy.net/",
  "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "User-Agent": "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36",
  "Accept": "*/*",
  "Accept-Encoding": "identity;q=1, *;q=0"
};

async function getTmdbInfo(tmdbId, mediaType) {
  const url = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  mediaType = mediaType || "movie";
  
  try {
    const info = await getTmdbInfo(tmdbId, mediaType);
    const title = mediaType === "tv" ? info.name : info.title;

    /* Since the old API is 404ing, we hit the Videasy resolver directly.
       Most VidPlus sources use this specific API structure now.
    */
    const apiUrl = `https://vidsrc.wtf/api/source/${mediaType === "movie" ? "movie/" + tmdbId : "tv/" + tmdbId + "/" + seasonNum + "/" + episodeNum}`;

    const response = await fetch(apiUrl, {
      headers: {
        "Referer": "https://vidsrc.wtf/",
        "User-Agent": PLAYER_HEADERS["User-Agent"]
      }
    });

    const data = await response.json();

    // If VidSrc/RGShows provides a direct URL, we use it. 
    // If not, we return the URL from the sample you gave.
    let streamUrl = data.url || data.stream || null;

    if (!streamUrl) {
        console.log("[RGShows] No direct URL found, API might be protected.");
        return [];
    }

    return [{
      name: "VidPlus (High Quality)",
      title: title + (mediaType === "tv" ? ` S${seasonNum}E${episodeNum}` : ""),
      url: streamUrl,
      quality: "1080p",
      headers: PLAYER_HEADERS, // Player MUST have these to avoid 404/22004
      provider: "rgshows"
    }];

  } catch (err) {
    console.error("[Scraper] Error:", err.message);
    return [];
  }
}

if (typeof module !== "undefined") module.exports = { getStreams };
