const axios = require("axios")

// ----------------------
// Helpers
// ----------------------

function getQuality(url) {
    if (url.includes("2160")) return "4K"
    if (url.includes("1080")) return "1080p"
    if (url.includes("720")) return "720p"
    return "auto"
}

function extractM3U8(text) {
    return [...text.matchAll(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g)].map(m => m[0])
}

async function fetch(url, headers = {}) {
    try {
        const res = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                ...headers
            },
            timeout: 8000
        })
        return res.data
    } catch {
        return null
    }
}

// ----------------------
// 🎯 VIDSRC DIRECT API
// ----------------------

async function getVidsrc(id, type, season, episode) {
    let url

    if (type === "movie") {
        url = `https://vidsrc.xyz/embed/movie/${id}`
    } else {
        url = `https://vidsrc.xyz/embed/tv/${id}/${season}/${episode}`
    }

    const html = await fetch(url, { Referer: "https://vidsrc.xyz/" })
    if (!html) return []

    return extractM3U8(html)
}

// ----------------------
// 🎯 VIDROCK
// ----------------------

async function getVidrock(id) {
    const url = `https://vidrock.net/embed/${id}`

    const html = await fetch(url, { Referer: "https://vidrock.net/" })
    if (!html) return []

    return extractM3U8(html)
}

// ----------------------
// MAIN
// ----------------------

async function getStreams({ id, type, season, episode }) {
    try {
        let streams = []

        // ⚠️ IMPORTANT:
        // id MUST be imdb id (ttxxxx)
        // or tmdb id depending on your setup

        const results = await Promise.all([
            getVidsrc(id, type, season, episode),
            getVidrock(id)
        ])

        results.forEach(arr => {
            if (arr) streams.push(...arr)
        })

        // dedupe
        const unique = [...new Set(streams)]

        return unique.map(url => ({
            url,
            type: "hls",
            quality: getQuality(url)
        }))

    } catch (err) {
        console.log(err)
        return []
    }
}

module.exports = {
    name: "KDIFlix FAST",
    getStreams
}
