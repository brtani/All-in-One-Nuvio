// UHDMovies provider (Promise‑based) for Nuvio
// Compatible with the yoruix/nuvio‑providers loader style

const cheerio = require("cheerio-without-node-native");

function fetchText(url) {
  return fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "*/*",
    },
  })
    .then((res) => (res.ok ? res.text() : Promise.reject()))
    .catch(() => "");
}

function cleanQuality(str) {
  if (!str) return "Unknown";
  const text = str.toLowerCase();
  if (text.includes("2160") || text.includes("4k")) return "4K";
  if (text.includes("1080")) return "1080p";
  if (text.includes("720")) return "720p";
  return "HD";
}

function getStreams(tmdbId, mediaType) {
  console.log(`[UHDMovies] Searching ${mediaType} ${tmdbId}`);

  // Step 1: Get TMDB info
  return fetch(
    `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=439c478a771f35c05022f9feabcca01c`
  )
    .then((res) => {
      if (!res.ok) return Promise.reject();
      return res.json();
    })
    .then((tmdb) => {
      const title = mediaType === "tv" ? tmdb.name : tmdb.title;
      const year =
        mediaType === "tv"
          ? tmdb.first_air_date?.substring(0, 4)
          : tmdb.release_date?.substring(0, 4);

      if (!title) return Promise.resolve([]);

      const query = encodeURIComponent(`${title} ${year}`);

      // Step 2: Search UHDMovies
      return fetchText(`https://uhdmovies.email/?s=${query}`).then((searchHtml) => {
        const $ = cheerio.load(searchHtml);
        const firstLink = $("a[href*='/download']")?.first()?.attr("href");
        if (!firstLink) return [];

        return fetchText(firstLink).then((pageHtml) => {
          const $$ = cheerio.load(pageHtml);
          const streams = [];

          $$("a").each((i, el) => {
            const href = $$(el).attr("href");
            const text = $$(el).text();

            if (
              href &&
              /(driveleech|video-seed|video-leech|\.mkv|\.mp4)/i.test(href)
            ) {
              streams.push({
                name: "UHDMovies",
                title: `${cleanQuality(text)} Stream`,
                url: href,
                quality: cleanQuality(text),
                provider: "uhdmovies",
                headers: {},
              });
            }
          });

          return streams;
        });
      });
    })
    .catch(() => []);
}

module.exports = { getStreams };
