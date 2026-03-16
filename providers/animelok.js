/**
 * animelok - Fully Fixed Version
 * Generated: 2026-03-16
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => { try { step(generator.next(value)); } catch (e) { reject(e); } };
    var rejected = (value) => { try { step(generator.throw(value)); } catch (e) { reject(e); } };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

var cheerio = require("cheerio-without-node-native");
var BASE_URL = "https://animelok.site";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return __async(this, null, function* () {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
        signal: controller.signal
      }));
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  });
}

async function search(query) {
  console.log(`[Animelok] Searching: ${query}`);
  try {
    const searchUrl = `${BASE_URL}/search?keyword=${encodeURIComponent(query)}`;
    const response = yield fetchWithTimeout(searchUrl, {
      headers: { "User-Agent": USER_AGENT }
    });
    const html = yield response.text();
    const $ = cheerio.load(html);
    const results = [];

    // Updated selectors to catch modern card layouts
    $("a[href*='/anime/'], .anime-card a, .group.relative").each((i, el) => {
      const title = $(el).find("h3, .title, .font-bold").text().trim();
      const href = $(el).attr("href");
      const poster = $(el).find("img").attr("src");

      if (href && title) {
        const slug = href.split("/").pop().split("?")[0];
        results.push({ title, id: slug, poster, type: "tv" });
      }
    });
    return results;
  } catch (error) {
    return [];
  }
}

async function getStreams(id, type, season, episode) {
  return __async(this, null, function* () {
    let animeSlug = id;

    // Handle TMDB numeric IDs
    if (/^\d+$/.test(id)) {
      const searchResults = yield search(id); // Using the ID directly in search sometimes works better for slugs
      if (searchResults.length > 0) {
        animeSlug = searchResults[0].id;
      }
    }

    // Updated API endpoint to pull the episode data directly
    const apiUrl = `${BASE_URL}/api/anime/${animeSlug}/episodes?number=${episode}`;
    
    try {
      const response = yield fetchWithTimeout(apiUrl, {
        headers: {
          "Referer": `${BASE_URL}/watch/${animeSlug}`,
          "User-Agent": USER_AGENT,
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      const data = yield response.json();
      const epData = data.episode || (data.episodes && data.episodes[0]);

      if (!epData || !epData.servers) return [];

      const streams = [];
      const subtitles = (epData.subtitles || []).map(s => ({
        url: s.url,
        label: s.name || "English",
        lang: s.name || "en"
      }));

      for (const server of epData.servers) {
        const name = server.name || "Server";
        let streamUrl = server.url;

        // Force HLS type if it's the anvod/anixl link you provided
        const isAnvod = streamUrl.includes("anvod.pro") || streamUrl.includes("anixl");

        streams.push({
          name: `Animelok - ${name}`,
          url: streamUrl,
          type: "hls",
          quality: "Auto",
          headers: {
            "Referer": BASE_URL,
            "User-Agent": USER_AGENT,
            "Origin": BASE_URL
          },
          subtitles: subtitles
        });
      }

      return streams;
    } catch (e) {
      console.error("[Animelok] Stream Error:", e.message);
      return [];
    }
  });
}

module.exports = { search, getStreams };
