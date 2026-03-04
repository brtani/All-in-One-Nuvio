const NAME = "viu";

async function getStreams(tmdbId, type, season, episode) {
  console.log("[viu] getStreams:", tmdbId, type, season, episode);

  try {
    let api;

    if (type === "movie") {
      api = `https://vidsrc.to/ajax/embed/episode/${tmdbId}`;
    } else {
      const s = season || 1;
      const e = episode || 1;
      api = `https://vidsrc.to/ajax/embed/episode/${tmdbId}/${s}/${e}`;
    }

    const res = await fetch(api, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://vidsrc.to/"
      }
    });

    const json = await res.json();

    if (!json || !json.result) {
      console.log("[viu] no results");
      return [];
    }

    const streams = [];

    for (const s of json.result) {
      streams.push({
        name: NAME,
        title: s.title || "stream",
        url: s.url,
        quality: "auto",
        headers: {
          Referer: "https://vidsrc.to/",
          "User-Agent": "Mozilla/5.0"
        }
      });
    }

    return streams;
  } catch (err) {
    console.log("[viu] error:", err.message);
    return [];
  }
}

module.exports = { getStreams };
