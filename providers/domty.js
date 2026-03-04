// Domty Provider for Nuvio
// Minimal version just to confirm the provider loads

console.log('[Domty] Provider loaded');

const DOMTY_NAME = "Domty";

// Simple request helper
function request(url) {
    return fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*"
        }
    }).then(function (r) {
        return r.text();
    });
}

// Extract simple video links
function extractLinks(html) {
    const links = [];
    const regex = /(https?:\/\/[^"' ]+\.(m3u8|mp4))/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
        links.push(match[1]);
    }

    return links;
}

// MAIN FUNCTION NUVIO CALLS
function getStreams(tmdbId, mediaType, season, episode) {

    console.log(`[Domty] getStreams called: ${tmdbId}`);

    // TEST STREAM so provider always returns something
    const testStream = {
        name: "Domty",
        title: "Provider Online",
        quality: "1080p",
        url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    };

    return Promise.resolve([testStream]);
}
