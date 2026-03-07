const axios = require("axios");
const CryptoJS = require("crypto-js");

const BASE_URL = "https://s1.devcorp.me";
const PROVIDER_NAME = "OneTouchTV";

// AES key from Cloudstream provider
const HEX_KEY = "4f6e65546f7563685465564b6579";

function decryptAES(data) {
  try {
    const key = CryptoJS.enc.Hex.parse(HEX_KEY);

    const decrypted = CryptoJS.AES.decrypt(data, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    return null;
  }
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {

    let api;

    if (mediaType === "movie") {
      api = `${BASE_URL}/api/movie/${tmdbId}`;
    } else {
      api = `${BASE_URL}/api/tv/${tmdbId}/${season}/${episode}`;
    }

    const res = await axios.get(api, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://s1.devcorp.me/",
        "Origin": "https://s1.devcorp.me"
      }
    });

    if (!res.data || !res.data.data) return [];

    const decrypted = decryptAES(res.data.data);

    if (!decrypted) return [];

    const json = JSON.parse(decrypted);

    const streams = [];

    if (json.sources) {
      json.sources.forEach(source => {
        if (!source.file) return;

        streams.push({
          url: source.file,
          quality: source.label || "HD",
          type: "hls",
          headers: {
            Referer: "https://s1.devcorp.me/"
          }
        });
      });
    }

    return streams;

  } catch (err) {
    return [];
  }
}

module.exports = {
  name: PROVIDER_NAME,
  getStreams
};
