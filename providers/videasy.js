// VideoEasy Scraper - Final Optimized Version for Neon, Yoru, Cypher & Raze
const TMDB_API_KEY = '1c29a5198ee1854bd5eb45dbe8d17d92';
const DECRYPT_API = 'https://enc-dec.app/api/dec-videasy';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://player.videasy.net',
  'Referer': 'https://player.videasy.net/'
};

const SERVERS = {
  'Neon': { url: 'https://api.videasy.net/myflixerzupcloud/sources-with-title' },
  'Yoru': { url: 'https://api.videasy.net/cdn/sources-with-title', moviesOnly: true },
  'Cypher': { url: 'https://api.videasy.net/moviebox/sources-with-title' },
  'Raze': { url: 'https://api.videasy.net/superflix/sources-with-title' }
};

function request(url) {
  return fetch(url, { method: 'GET', headers: HEADERS })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    });
}

function decrypt(text, id) {
  if (!text || text.trim().startsWith('{')) {
    try { return Promise.resolve(JSON.parse(text)); } catch(e) { return Promise.resolve(null); }
  }
  return fetch(DECRYPT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text, id: id.toString() })
  })
  .then(res => res.json())
  .then(data => data.result || data)
  .catch(() => null);
}

function fetchFromServer(serverName, serverConfig, details, season, episode) {
  if (details.type === 'tv' && serverConfig.moviesOnly) return Promise.resolve([]);

  // Use a cleaner title - some servers fail if special characters are present
  const cleanTitle = details.title.replace(/[^\w\s]/gi, '');
  
  // We use URLSearchParams which handles encoding properly without over-encoding
  const params = new URLSearchParams({
    title: cleanTitle,
    mediaType: details.type,
    year: details.year,
    tmdbId: details.id,
    imdbId: details.imdbId || ''
  });

  if (details.type === 'tv') {
    params.append('seasonId', season);
    params.append('episodeId', episode);
  }

  const finalUrl = `${serverConfig.url}?${params.toString()}`;

  return request(finalUrl)
    .then(raw => decrypt(raw, details.id))
    .then(decrypted => {
      if (!decrypted || !decrypted.sources) return [];
      
      return decrypted.sources.map(source => ({
        name: `VIDEASY ${serverName}`,
        url: source.url,
        quality: source.quality || 'Auto',
        headers: {
          'User-Agent': HEADERS['User-Agent'],
          'Referer': 'https://player.videasy.net/',
          'Origin': 'https://player.videasy.net'
        }
      }));
    })
    .catch(() => []);
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const tmdbUrl = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
  
  return request(tmdbUrl).then(res => {
    const data = JSON.parse(res);
    const details = {
      id: tmdbId,
      title: data.title || data.name,
      year: (data.release_date || data.first_air_date || '').split('-')[0],
      imdbId: data.external_ids ? data.external_ids.imdb_id : '',
      type: type
    };

    const promises = Object.keys(SERVERS).map(name => 
      fetchFromServer(name, SERVERS[name], details, seasonNum, episodeNum)
    );

    return Promise.all(promises).then(results => {
      const flat = results.flat();
      // Simple duplicate filter
      const seen = new Set();
      return flat.filter(item => {
        const k = item.url;
        return seen.has(k) ? false : seen.add(k);
      });
    });
  }).catch(() => []);
}

if (typeof module !== 'undefined') module.exports = { getStreams };
