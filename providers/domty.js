const PROVIDER_NAME = "Domty";

function buildVidSrcMovie(tmdbId) {
  return `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`;
}

function buildVidSrcTV(tmdbId, season, episode) {
  return `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
}

function build2EmbedMovie(tmdbId) {
  return `https://www.2embed.cc/embed/${tmdbId}`;
}

function build2EmbedTV(tmdbId, season, episode) {
  return `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`;
}

async function getStreams(tmdbId, type, season, episode) {

  console.log("[DOMTY] Fetching streams for:", tmdbId);

  const streams = [];

  try {

    if (type === "movie") {

      streams.push({
        name: "VidSrc",
        url: buildVidSrcMovie(tmdbId),
        quality: "HD"
      });

      streams.push({
        name: "2Embed",
        url: build2EmbedMovie(tmdbId),
        quality: "HD"
      });

    } else {

      streams.push({
        name: "VidSrc TV",
        url: buildVidSrcTV(tmdbId, season || 1, episode || 1),
        quality: "HD"
      });

      streams.push({
        name: "2Embed TV",
        url: build2EmbedTV(tmdbId, season || 1, episode || 1),
        quality: "HD"
      });

    }

  } catch (e) {
    console.log("DOMTY ERROR", e);
  }

  return streams;
}

module.exports = {
  name: PROVIDER_NAME,
  getStreams
};
