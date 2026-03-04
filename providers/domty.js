// ───────── Node fetch polyfill ─────────
let fetchFunc;
try {
  fetchFunc = fetch;
} catch {
  const nodeFetch = require("node-fetch");
  fetchFunc = nodeFetch;
}

// ───────── Provider Metadata ─────────
module.exports = {
  name: "DomTy",
  id: "domty",
  languages: ["en"],

  // Optional search (some builds require this)
  search: async (query) => {
    return [
      {
        title: query,
        year: "",
        id: query,
      },
    ];
  },

  // Main stream function
  getStreams: async (id, type, season, episode) => {
    // Test stream so we can confirm provider loads
    return [
      {
        name: "DomTy",
        url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        quality: "HD",
      },
    ];
  },
};
