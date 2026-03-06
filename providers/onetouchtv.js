// onetouchtv.mjs
import fetch from "node-fetch";

const BASE_API = "https://api3.devcorp.me";

// Fetch all VOD items (movies + series)
async function fetchCatalog() {
  try {
    const res = await fetch(`${BASE_API}/share/vod/`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    // Map to Nuvio-friendly catalog
    return data.map(item => {
      if (item.episodes && item.episodes.length) {
        // Series
        return {
          name: item.title,
          type: "series",
          episodes: item.episodes.map(ep => ({
            name: ep.title,
            url: ep.url,
            type: "hls",
            isM3U8: true
          }))
        };
      } else {
        // Single movie / VOD
        return {
          name: item.title,
          url: item.url,
          type: "vod",
          isM3U8: true
        };
      }
    });
  } catch (e) {
    console.error("Failed to fetch catalog:", e.message);
    return [];
  }
}

// Fetch streams by movie/series name
export async function getStreams(query) {
  const catalog = await fetchCatalog();
  if (!catalog.length) return [];

  // Try to match by name (case-insensitive)
  const match = catalog.find(i => i.name.toLowerCase().includes(query.toLowerCase()));
  if (!match) return [];

  if (match.episodes) return match.episodes; // Series
  return [match]; // Single movie
}

// Test the provider
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = async () => {
    const streams = await getStreams("live"); // Replace with movie/series name
    console.log(streams);
  };
  test();
}
