// OneTouchTV Provider for Nuvio
// Uses direct HLS stream

const PROVIDER_NAME = "OneTouchTV";

async function getStreams() {
  try {

    const streamUrl = "https://aapanel.devcorp.me/assets/2fd52cf7-8b76-5a91-9532-71ee013c42bd.m3u8";

    return [
      {
        name: PROVIDER_NAME,
        title: "OneTouchTV Stream",
        url: streamUrl,
        type: "hls",
        isM3U8: true
      }
    ];

  } catch (error) {
    console.error("OneTouchTV Provider Error:", error);
    return [];
  }
}

module.exports = { getStreams };
