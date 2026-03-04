console.log("[DOMTY] Provider loaded");

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

const SOURCES = [
  { name: "CimaNow", base: "https://cimanow.cc" },
  { name: "MyCima", base: "https://mycima.to" },
  { name: "ArabSeed", base: "https://arabseed.ink" }
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9"
};

function request(url, headers = {}) {
  return fetch(url, {
    headers: { ...HEADERS, ...headers }
  }).then(r => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  });
}

function qualityFromUrl(url) {
  if (!url) return "HD";
  if (url.includes("2160")) return "4K";
  if (url.includes("1080")) return "1080p";
  if (url.includes("720")) return "720p";
  return "HD";
}

function createStream(url, referer) {
  let type = "video/mp4";
  if (url.includes(".m3u8")) type = "application/x-mpegURL";

  return {
    url,
    quality: qualityFromUrl(url),
    type,
    headers: {
      Referer: referer,
      Origin: referer,
      "User-Agent": HEADERS["User-Agent"]
    }
  };
}

function extractStreams(html, referer) {
  const links = [];

  const re = /(https?:\/\/[^"' ]+\.(m3u8|mp4)[^"' ]*)/gi;
  let m;

  while ((m = re.exec(html))) {
    links.push(createStream(m[1], referer));
  }

  return links;
}

function resolvePlayer(url, base) {
  return request(url, { Referer: base }).then(html => {
    let streams = extractStreams(html, url);
    if (streams.length) return streams;

    const iframe = html.match(/<iframe[^>]+src=["']([^"']+)/i);
    if (!iframe) return [];

    let iframeUrl = iframe[1];

    if (iframeUrl.startsWith("//")) iframeUrl = "https:" + iframeUrl;
    if (iframeUrl.startsWith("/")) iframeUrl = base + iframeUrl;

    return request(iframeUrl, { Referer: url }).then(h => {
      return extractStreams(h, iframeUrl);
    });
  });
}

function searchSource(source, query) {
  const searchUrl = `${source.base}/?s=${encodeURIComponent(query)}`;

  return request(searchUrl, { Referer: source.base }).then(html => {
    const match = html.match(/href="(https?:\/\/[^"]+)"/i);
    if (!match) return null;
    return match[1];
  });
}

function getTitle(tmdbId, mediaType) {
  const url =
    `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`;

  return fetch(url)
    .then(r => r.json())
    .then(data => {
      return mediaType === "tv" ? data.name : data.title;
    });
}

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  console.log("[DOMTY] Fetching streams", tmdbId);

  return getTitle(tmdbId, mediaType).then(title => {
    if (!title) return [];

    const tasks = SOURCES.map(source => {
      return searchSource(source, title)
        .then(url => {
          if (!url) return [];
          return resolvePlayer(url, source.base);
        })
        .catch(() => []);
    });

    return Promise.all(tasks).then(results => {
      const all = [].concat(...results);

      const seen = new Set();

      return all.filter(s => {
        if (seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
      });
    });
  });
}

module.exports = { getStreams };
