import fetch from "node-fetch";
import * as cheerio from "cheerio";

const PROVIDER_NAME = "AsiaFlix";
const BASE_URL = "https://asiaflix.net";

const TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

async function tmdbTitle(tmdbId, type) {
    const res = await fetch(
        `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}`
    );

    const json = await res.json();
    return type === "movie" ? json.title : json.name;
}

async function search(title) {
    try {

        const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(title)}`);

        const html = await res.text();

        const $ = cheerio.load(html);

        let results = [];

        $(".film_list-wrap .flw-item").each((i, el) => {

            const name = $(el).find(".film-detail a").text().trim();

            const link =
                BASE_URL + $(el).find(".film-detail a").attr("href");

            if (name.toLowerCase().includes(title.toLowerCase())) {

                results.push({
                    title: name,
                    url: link
                });

            }

        });

        return results;

    } catch {

        return [];

    }
}

async function getEpisode(url, episode) {

    try {

        const res = await fetch(url);

        const html = await res.text();

        const $ = cheerio.load(html);

        let epUrl = null;

        $(".episodes-list a").each((i, el) => {

            if (i + 1 === episode) {

                epUrl = BASE_URL + $(el).attr("href");

            }

        });

        return epUrl;

    } catch {

        return null;

    }
}

async function getPlayers(pageUrl) {

    try {

        const res = await fetch(pageUrl);

        const html = await res.text();

        const $ = cheerio.load(html);

        let players = [];

        $("iframe").each((i, el) => {

            let src = $(el).attr("src");

            if (src) {

                if (!src.startsWith("http")) {

                    src = "https:" + src;

                }

                players.push(src);

            }

        });

        return players;

    } catch {

        return [];

    }
}

async function extractDirect(url) {

    try {

        const res = await fetch(url);

        const text = await res.text();

        const match = text.match(/https?:\/\/.*?\.m3u8/g);

        if (match) return match;

        return [];

    } catch {

        return [];

    }
}

export async function getStreams(tmdbId, type, season, episode) {

    try {

        const title = await tmdbTitle(tmdbId, type);

        const results = await search(title);

        if (!results.length) return [];

        let page = results[0].url;

        if (type === "tv") {

            page = await getEpisode(page, episode);

        }

        if (!page) return [];

        const players = await getPlayers(page);

        let streams = [];

        for (const player of players) {

            const direct = await extractDirect(player);

            if (direct.length) {

                for (const m3u8 of direct) {

                    streams.push({
                        name: PROVIDER_NAME,
                        url: m3u8,
                        type: "hls"
                    });

                }

            } else {

                streams.push({
                    name: PROVIDER_NAME,
                    url: player,
                    type: "embed"
                });

            }

        }

        return streams;

    } catch (err) {

        console.log(PROVIDER_NAME, err);

        return [];

    }
}

export default {
    name: PROVIDER_NAME,
    getStreams
};
