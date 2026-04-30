/**
 * brazucaplay - Built from src/brazucaplay/
 * Updated: 2026-05-01 (Multi-Source English + Latino)
 */

// ... [Keep all helper functions from the previous working version] ...

// src/brazucaplay/index.js
var { fetchJson, setSessionUA, request } = require_http();
var { finalizeStreams } = require_engine();
var API_DEC = "https://enc-dec.app/api/dec-videasy";
var TMDB_API_KEY = "d131017ccc6e5462a81c9304d21476de";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";

// ADDED: Additional server known for English content
var SERVERS = { 
  "Gekko": { url: "https://api2.videasy.net/cuevana/sources-with-title", label: "Cuevana (Lat)" },
  "Cineby": { url: "https://api.cineby.app/sources", label: "Cineby (Eng)" } 
};

var CINEBY_HEADERS = {
  "Accept": "*/*",
  "Origin": "https://cineby.sc",
  "Referer": "https://cineby.sc/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
};

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    try {
      setSessionUA(CINEBY_HEADERS["User-Agent"]);
      const tmdbUrl = `${TMDB_BASE_URL}/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      const tmdbData = yield fetchJson(tmdbUrl);
      const title = tmdbData.title || tmdbData.name;
      const year = (tmdbData.release_date || tmdbData.first_air_date || "").split("-")[0];
      const doubleEncTitle = encodeURIComponent(encodeURIComponent(title));
      const imdbId = tmdbData.external_ids?.imdb_id || "";

      const serverPromises = Object.entries(SERVERS).map(([serverId, config]) => __async(this, null, function* () {
        try {
          // Construct URL based on server requirements
          let searchUrl = `${config.url}?title=${doubleEncTitle}&tmdbId=${tmdbId}&imdbId=${imdbId}`;
          if (serverId === "Gekko") {
             searchUrl += `&mediaType=${mediaType === "tv" ? "tv" : "movie"}&year=${year}`;
             if (mediaType === "tv") searchUrl += `&episodeId=${episode || 1}&seasonId=${season || 1}`;
          } else {
             // Cineby style params
             searchUrl = `${config.url}/${tmdbId}`;
             if (mediaType === "tv") searchUrl += `/${season}/${episode}`;
          }
          
          const response = yield request(searchUrl, { headers: CINEBY_HEADERS });
          const text = yield response.text();
          
          let mediaData;
          try {
            // Check if response is encrypted (Gekko) or raw JSON (Cineby)
            if (text.trim().startsWith('{')) {
                mediaData = JSON.parse(text);
            } else {
                const decRes = yield request(API_DEC, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text, id: String(tmdbId) })
                });
                const decJson = yield decRes.json();
                mediaData = decJson.result || decJson;
            }
          } catch(e) { return []; }

          const localResults = [];
          if (mediaData && (mediaData.sources || mediaData.data)) {
            const sources = mediaData.sources || mediaData.data || [];
            for (const source of sources) {
              if (source.url || source.file) {
                // Determine language: If from Cineby, default to English unless specified
                let detectedAudio = source.audio || source.language;
                if (!detectedAudio) {
                    detectedAudio = serverId === "Cineby" ? "English" : "Latino";
                }

                localResults.push({
                  serverName: source.server || config.label,
                  audio: detectedAudio,
                  quality: (source.quality || "1080p").toUpperCase(),
                  url: source.url || source.file,
                  headers: CINEBY_HEADERS
                });
              }
            }
          }
          return localResults;
        } catch (err) { return []; }
      }));

      const allResults = yield Promise.all(serverPromises);
      const flattened = allResults.flat();
      
      // Pass to engine which now allows both 'Latino' and 'Inglés'
      return yield finalizeStreams(flattened, "BrazucaPlay", title);
    } catch (error) { return []; }
  });
}

module.exports = { getStreams };
