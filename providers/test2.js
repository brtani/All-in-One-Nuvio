const axios = require("axios")

const BASE = "https://kdiflix.xyz"

async function fetch(url) {
    try {
        const res = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            },
            timeout: 8000
        })
        return res.data
    } catch {
        return null
    }
}

async function getStreams({ id }) {
    try {
        let url = id.startsWith("http")
            ? id
            : `${BASE}/episodes/${id}`

        const html = await fetch(url)
        if (!html) return []

        let streams = []

        // 🎯 Extract ALL iframe sources
        const iframes = [...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)]
            .map(m => m[1])

        for (let link of iframes) {
            // normalize
            if (link.startsWith("//")) {
                link = "https:" + link
            }

            // only keep known hosts
            if (
                link.includes("vidsrc") ||
                link.includes("vidrock") ||
                link.includes("flickfox") ||
                link.includes("neonhorizon") ||
                link.includes("workers.dev")
            ) {
                streams.push({
                    url: link,
                    type: "iframe", // 👈 important
                    quality: "auto"
                })
            }
        }

        // remove duplicates
        const unique = [...new Map(streams.map(s => [s.url, s])).values()]

        return unique

    } catch (err) {
        console.log(err)
        return []
    }
}

module.exports = {
    name: "KDIFlix EMBED",
    getStreams
}
