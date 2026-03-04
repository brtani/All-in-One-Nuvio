exports.name = "DOMTY";

const SOURCES = [
  { name: "CimaWbas", base: "https://cimawbas.org" },
  { name: "MyCima", base: "https://mycima.horse" },
  { name: "EgyBest", base: "https://egybest.la" }
];

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9"
};

async function getHTML(url, referer) {
  const res = await fetch(url, {
    headers: {
      ...headers,
      Referer: referer || url
    }
  });

  return await res.text();
}

function extractStreams(html) {
  const links = [];
  const regex = /(https?:\/\/[^"' ]+\.(m3u8|mp4)[^"' ]*)/gi;

  let m;
  while ((m = regex.exec(html)) !== null) {
    links.push(m[1]);
  }

  return links;
}

async function searchSite(site, query) {
  try {
    const searchURL = site.base + "/?s=" + encodeURIComponent(query);
    const html = await getHTML(searchURL, site.base);

    const match = html.match(/href="(https?:\/\/[^"]+)"/i);
    if (!match) return null;

    return match[1];
  } catch {
    return null;
  }
}

exports.getStreams = async function (tmdbId, mediaType, season, episode) {

  const query =
    mediaType === "movie"
      ? tmdbId
      : tmdbId + " s" + season + "e" + episode;

  const results = [];

  for (const site of SOURCES) {
    try {
      const page = await searchSite(site, query);
      if (!page) continue;

      const html = await getHTML(page, site.base);
      const streams = extractStreams(html);

      for (const stream of streams) {
        results.push({
          name: "DOMTY | " + site.name,
          title: "Auto",
          url: stream
        });
      }
    } catch {}
  }

  return results;
};
