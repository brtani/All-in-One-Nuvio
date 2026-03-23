/**
 * MovieBox Provider v4.0 – Synced with Python API v4.0
 *
 * Changes vs v3.13:
 *  - getDetail()       : fetches detail page → returns { is_tv, seasons, dubs }
 *  - getStreams()      : auto-detects movie/TV via getDetail when se/ep omitted
 *  - formatStreams()   : mirrors Python format_streams_js() — adds resolution,
 *                        format, size_mb, duration_s, codec, proxy_url fields
 *  - sortStreams()     : sorts raw streams descending by resolution before mapping
 *  - getLanguageFromTitle() : added [original]/(original) branch (was missing)
 *  - pickBest()        : extracted as a standalone helper (was inline in getStreams)
 *  - getStreamsByQuery(): new export — query-only mode (no TMDB), same scoring pipeline
 *  - All scoring / language / search logic identical to v3.13
 */

'use strict';

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const MB_BASE      = 'https://themoviebox.org';
const BROWSER_UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0';

const HTML_HEADERS = {
    'User-Agent':                BROWSER_UA,
    'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language':           'en-US,en;q=0.9',
    'Upgrade-Insecure-Requests': '1'
};

const API_HEADERS = {
    'User-Agent':     BROWSER_UA,
    'Accept':         'application/json',
    'Accept-Language':'en-US,en;q=0.9',
    'X-Client-Info':  JSON.stringify({ timezone: 'Asia/Kolkata' }),
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'X-Source':       '',
    'Pragma':         'no-cache',
    'Cache-Control':  'no-cache'
};

let INTERNAL_PROXY_URL = null;
function setInternalProxy(url) {
    INTERNAL_PROXY_URL = url;
    console.log('[MovieBox] Internal proxy set:', url);
}


// ─── Nuxt SSR parser ──────────────────────────────────────────────────────────

function extractNuxtData(html) {
    const idx = html.indexOf('__NUXT_DATA__');
    if (idx === -1) return null;
    const start = html.indexOf('[', idx);
    const end   = html.indexOf('</script>', idx);
    if (start === -1 || end === -1) return null;
    try {
        return JSON.parse(html.substring(start, end));
    } catch {
        return null;
    }
}

function resolveNuxt(data, idx, depth = 0) {
    if (depth > 15 || idx < 0 || idx >= data.length) return null;
    const item = data[idx];
    if (Array.isArray(item)) {
        if (item.length === 2 && (item[0] === 'ShallowReactive' || item[0] === 'Reactive')) {
            return resolveNuxt(data, item[1], depth + 1);
        }
        return item.map(v => (typeof v === 'number' ? resolveNuxt(data, v, depth + 1) : v));
    }
    if (item && typeof item === 'object') {
        const obj = {};
        for (const [k, v] of Object.entries(item)) {
            obj[k] = typeof v === 'number' ? resolveNuxt(data, v, depth + 1) : v;
        }
        return obj;
    }
    return item;
}


// ─── Search ───────────────────────────────────────────────────────────────────

async function search(query) {
    console.log(`[MovieBox] Searching: "${query}"`);
    const url = new URL('/newWeb/searchResult', MB_BASE);
    url.searchParams.set('keyword', query);

    const res = await fetch(url, {
        headers: HTML_HEADERS,
        signal:  AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
    const html = await res.text();

    const data = extractNuxtData(html);
    if (!data) {
        console.log('[MovieBox] No Nuxt data found in search');
        return [];
    }

    let itemsIndices = null;
    for (const item of data) {
        if (item && typeof item === 'object' && 'pager' in item && 'items' in item) {
            const ref = item.items;
            itemsIndices = typeof ref === 'number' ? data[ref] : ref;
            break;
        }
    }
    if (!itemsIndices || !Array.isArray(itemsIndices)) return [];

    const results = [];
    for (const idx of itemsIndices) {
        const item = resolveNuxt(data, idx);
        if (!item || typeof item !== 'object') continue;
        const cover = item.cover;

        // Extract language – priority order matches Python API
        const language =
            item.language        ||
            item.lang            ||
            item.dubbed_lang     ||
            item.original_language ||
            null;

        results.push({
            subject_id:   item.subjectId,
            title:        item.title || '',
            subject_type: item.subjectType,   // 1 = TV, 2 = Movie
            detail_path:  item.detailPath,
            release_date: item.releaseDate,
            genre:        item.genre,
            cover:        cover?.url || null,
            imdb_rating:  item.imdbRatingValue,
            language
        });
    }

    console.log(`[MovieBox] Found ${results.length} results`);
    return results;
}


// ─── Detail page  (ported from Python API do_get_detail) ──────────────────────

async function getDetail(detailPath, subjectId, query = '') {
    const refQuery = query.replace(/ /g, '+');
    const pageUrl  = new URL(`/moviesDetail/${detailPath}`, MB_BASE);
    pageUrl.searchParams.set('id',        subjectId);
    pageUrl.searchParams.set('scene',     '');
    pageUrl.searchParams.set('page_from', 'search_detail');
    pageUrl.searchParams.set('type',      '/movie/detail');

    const res = await fetch(pageUrl, {
        headers: {
            ...HTML_HEADERS,
            Referer: `${MB_BASE}/newWeb/searchResult?keyword=${refQuery}`
        },
        signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`Detail HTTP ${res.status}`);
    const html = await res.text();

    const data = extractNuxtData(html);
    if (!data) return null;

    // ── Seasons ──────────────────────────────────────────────────────────────
    const seasons = [];
    for (const item of data) {
        if (item && typeof item === 'object' && 'seasons' in item && 'source' in item) {
            const ref = item.seasons;
            const raw = typeof ref === 'number' ? data[ref] : ref;
            if (Array.isArray(raw)) {
                for (const sIdx of raw) {
                    const s = typeof sIdx === 'number' ? resolveNuxt(data, sIdx) : sIdx;
                    if (!s || typeof s !== 'object') continue;
                    const resRaw = s.resolutions || [];
                    const resolutions = (Array.isArray(resRaw) ? resRaw : [])
                        .filter(r => r && typeof r === 'object')
                        .map(r => ({ resolution: r.resolution, ep_count: r.epNum }));
                    const seVal = s.se;
                    seasons.push({
                        se:          seVal != null ? Number(seVal) : 1,
                        max_ep:      Number(s.maxEp || 1),
                        resolutions
                    });
                }
            }
            break;
        }
    }

    // ── Dubs ─────────────────────────────────────────────────────────────────
    const dubs = [];
    const seen = new Set();
    for (const item of data) {
        if (item && typeof item === 'object' &&
            'lanName' in item && 'lanCode' in item && 'detailPath' in item) {
            const dp = item.detailPath;
            if (dp && !seen.has(dp)) {
                seen.add(dp);
                dubs.push({
                    name:        item.lanName,
                    code:        item.lanCode,
                    subject_id:  item.subjectId,
                    detail_path: dp,
                    original:    item.original || false
                });
            }
        }
    }

    // se=0 → movie, se≥1 → TV
    const is_tv = seasons.length > 0 && seasons.some(s => s.se >= 1);
    if (!seasons.length) {
        seasons.push({ se: 0, max_ep: 0, resolutions: [] });
    }

    return { is_tv, seasons, dubs };
}


// ─── Scoring helpers ──────────────────────────────────────────────────────────

function normalizeTitle(str) {
    return (str || '')
        .toLowerCase()
        .replace(/\[.*?\]/g, ' ')
        .replace(/\(.*?\)/g, ' ')
        .replace(/\s*-\s*(part|volume|chapter|episode)\s*\d+/gi, ' ')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function score(result, targetTitle, targetYear) {
    const resultTitle = result.title || '';
    const resultYear  = (result.release_date || '').substring(0, 4);

    const normTarget = normalizeTitle(targetTitle);
    const normResult = normalizeTitle(resultTitle);

    if (!normTarget || !normResult) return 0;
    if (normResult === normTarget) return 90;
    if (normResult.includes(normTarget) || normTarget.includes(normResult)) return 70;

    const wordsTarget = normTarget.split(' ').filter(w => w.length > 2);
    const wordsResult = normResult.split(' ').filter(w => w.length > 2);
    if (!wordsTarget.length || !wordsResult.length) return 0;

    const matches   = wordsTarget.filter(w => wordsResult.includes(w)).length;
    const overlap   = matches / Math.max(wordsTarget.length, wordsResult.length);
    let titleScore  = Math.round(overlap * 50);

    if (targetYear && resultYear && targetYear === resultYear) titleScore += 30;
    return titleScore;
}

function isHindi(result) {
    return (result.language && result.language.toLowerCase().includes('hindi')) ||
           result.title.toLowerCase().includes('hindi');
}

function hasHindiTag(title) {
    return (title || '').toLowerCase().includes('[hindi]');
}

function getLanguageFromTitle(title) {
    const lower = (title || '').toLowerCase();
    if (lower.includes('[hindi]')   || lower.includes('(hindi)')   || lower.includes(' hindi '))   return 'Hindi';
    if (lower.includes('[tamil]')   || lower.includes('(tamil)')   || lower.includes(' tamil '))   return 'Tamil';
    if (lower.includes('[telugu]')  || lower.includes('(telugu)')  || lower.includes(' telugu '))  return 'Telugu';
    if (lower.includes('[english]') || lower.includes('(english)') || lower.includes(' english ')) return 'English';
    if (lower.includes('[original]')|| lower.includes('(original)')|| lower.includes(' original '))return 'Original';
    return 'Original';
}


// ─── Raw streams ──────────────────────────────────────────────────────────────

async function getStreamsRaw(subjectId, detailPath, se = '0', ep = '0') {
    const url = new URL('/wefeed-h5api-bff/subject/play', MB_BASE);
    url.searchParams.set('subjectId',  subjectId);
    url.searchParams.set('se',         String(se));
    url.searchParams.set('ep',         String(ep));
    url.searchParams.set('detailPath', detailPath);

    const headers = {
        ...API_HEADERS,
        Referer: `${MB_BASE}/movies/${detailPath}?id=${subjectId}&type=/movie/detail&detailSe=&detailEp=&lang=en`
    };

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Streams HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.message || 'API error');
    return data.data.streams || [];
}


// ─── Stream formatting  (mirrors Python format_streams_js) ────────────────────

/**
 * Sorts raw streams descending by resolution, then maps them to the
 * enriched format used by the Python API (name / title / url / subtitles
 * plus resolution / format / size_mb / duration_s / codec / proxy_url).
 *
 * @param {Array}  rawStreams
 * @param {string} title
 * @param {string} year
 * @param {string} langLabel
 * @param {string} mediaType   'movie' | 'tv'
 * @param {number|null} seasonNum
 * @param {number|null} episodeNum
 * @param {string|null} proxyBase  base URL for proxy_url field (e.g. 'http://localhost:5000/')
 */
function formatStreams(rawStreams, title, year, langLabel, mediaType,
                       seasonNum = null, episodeNum = null, proxyBase = null) {
    // Sort descending by resolution (mirrors Python sorted(..., reverse=True))
    const sorted = [...rawStreams].sort(
        (a, b) => Number(b.resolutions || 0) - Number(a.resolutions || 0)
    );

    return sorted.map(s => {
        // Quality label
        let resolution = s.resolutions || 'Auto';
        let quality;
        if (typeof resolution === 'number') {
            quality = `${resolution}p`;
        } else if (typeof resolution === 'string') {
            const m = resolution.match(/(\d+)/);
            quality = m ? `${m[1]}p` : resolution;
        } else {
            quality = 'Auto';
        }

        const name = `MovieBox (${langLabel}) - ${quality}`;

        // Episode suffix for TV
        const epSuffix = (mediaType === 'tv' && seasonNum != null && episodeNum != null)
            ? ` S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')}`
            : '';

        const streamTitle = `${title}${year ? ` (${year})` : ''}${epSuffix}`;
        const rawUrl      = s.url || '';

        // proxy_url — only set when a proxy base is supplied
        const proxyUrl = proxyBase
            ? `${proxyBase.replace(/\/$/, '')}/proxy?url=${encodeURIComponent(rawUrl)}`
            : null;

        return {
            // Standard Stremio-compatible fields
            name,
            title:      streamTitle,
            url:        rawUrl,
            subtitles:  [],
            // Extra metadata (mirrors Python API response)
            resolution: s.resolutions,
            format:     s.format     || null,
            size_mb:    s.size ? Math.round((Number(s.size) / 1024 / 1024) * 10) / 10 : 0,
            duration_s: s.duration   || null,
            codec:      s.codecName  || null,
            proxy_url:  proxyUrl
        };
    });
}


// ─── pickBest()  (extracted from inline getStreams — mirrors Python pick_best) ──

/**
 * Runs the full multi-query search + scoring pipeline — ALL searches in parallel.
 * Returns { picked, isHindiResult } or { picked: null, isHindiResult: false }.
 */
async function pickBest(title, year) {
    // Run all initial queries IN PARALLEL — eliminates 3x sequential round trips
    const initialQueries = [
        `${title} Hindi`,
        year ? `${title} ${year} Hindi` : null,
        title,
        year ? `${title} ${year}` : null
    ].filter(Boolean);

    console.log(`[MovieBox] Parallel search: ${initialQueries.map(q => `"${q}"`).join(', ')}`);

    const allResults = await Promise.all(
        initialQueries.map(q => search(q).catch(() => []))
    );

    const allValidResults = [];
    const allHindiResults = [];
    let bestNonHindi = { result: null, score: 0 };

    for (const results of allResults) {
        const valid = results.filter(r => r.subject_type === 1 || r.subject_type === 2);
        allValidResults.push(...valid);
        for (const r of valid) {
            if (!isHindi(r)) {
                const s = score(r, title, year);
                if (s > bestNonHindi.score) bestNonHindi = { result: r, score: s };
            }
        }
        allHindiResults.push(...valid.filter(isHindi));
    }

    // ── Exact-title Hindi retry (only if no Hindi found yet) ─────────────────
    if (bestNonHindi.result && bestNonHindi.score >= 60 && allHindiResults.length === 0) {
        const exactHindiQuery = `${bestNonHindi.result.title} Hindi`;
        console.log(`[MovieBox] Fallback Hindi query: "${exactHindiQuery}"`);
        const exactResults = await search(exactHindiQuery).catch(() => []);
        const validExact   = exactResults.filter(r => r.subject_type === 1 || r.subject_type === 2);
        allValidResults.push(...validExact);
        allHindiResults.push(...validExact.filter(isHindi));
    }

    // ── Pick best Hindi (threshold ≥ 20) ──────────────────────────────────────
    let picked        = null;
    let isHindiResult = false;

    if (allHindiResults.length > 0) {
        console.log(`[MovieBox] Total Hindi candidates: ${allHindiResults.length}`);
        let bestScore = 0;
        for (const r of allHindiResults) {
            const s = score(r, title, year);
            console.log(`[MovieBox] Hindi candidate: "${r.title}" score=${s}`);
            if (s > bestScore) { bestScore = s; picked = r; }
        }
        if (picked && bestScore >= 20) {
            console.log(`[MovieBox] Best Hindi match: "${picked.title}" score=${bestScore}`);
            isHindiResult = true;
        } else {
            console.log(`[MovieBox] Best Hindi score too low (${bestScore}), falling back`);
            picked = null;
        }
    }

    // ── Fallback to best overall (threshold ≥ 30) ────────────────────────────
    if (!picked) {
        console.log('[MovieBox] No suitable Hindi result, falling back to best overall');
        let bestScore = 0;
        for (const r of allValidResults) {
            const s = score(r, title, year);
            console.log(`[MovieBox] Overall candidate: "${r.title}" score=${s}`);
            if (s > bestScore) { bestScore = s; picked = r; }
        }
        if (picked && bestScore >= 30) {
            console.log(`[MovieBox] Best overall match: "${picked.title}" score=${bestScore}`);
            isHindiResult = hasHindiTag(picked.title);
        } else {
            console.log('[MovieBox] No suitable result found');
            return { picked: null, isHindiResult: false };
        }
    }

    return { picked, isHindiResult };
}


// ─── Main entry — TMDB mode ───────────────────────────────────────────────────

/**
 * Primary export — mirrors Python /autostream?tmdb_id= endpoint.
 *
 * @param {string|number} tmdbId
 * @param {string}        mediaType   'movie' | 'tv'
 * @param {number}        seasonNum   (TV only, default 1)
 * @param {number}        episodeNum  (TV only, default 1)
 * @param {string|null}   proxyBase   base URL of your proxy server (optional)
 */
async function getStreams(tmdbId, mediaType, seasonNum = 1, episodeNum = 1, proxyBase = null) {
    console.log(`[MovieBox] TMDB ${tmdbId} type=${mediaType}`);
    try {
        // ── 1. Resolve title + year from TMDB ────────────────────────────────
        const tmdbRes = await fetch(
            `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`,
            { signal: AbortSignal.timeout(10000) }
        );
        if (!tmdbRes.ok) throw new Error('TMDB fetch failed');
        const tmdbData = await tmdbRes.json();
        const title    = mediaType === 'tv' ? tmdbData.name : tmdbData.title;
        const year     = (mediaType === 'tv'
            ? tmdbData.first_air_date
            : tmdbData.release_date || ''
        ).substring(0, 4);
        if (!title) throw new Error('No TMDB title');
        console.log(`[MovieBox] "${title}" (${year})`);

        // ── 2. Multi-query parallel search + scoring ──────────────────────────
        const { picked, isHindiResult } = await pickBest(title, year);
        if (!picked) return [];

        console.log(`[MovieBox] Picked: "${picked.title}" (id=${picked.subject_id})`);

        // ── 3. Language label ─────────────────────────────────────────────────
        let langLabel;
        if (isHindiResult || hasHindiTag(picked.title)) {
            langLabel = 'Hindi';
        } else {
            langLabel = getLanguageFromTitle(picked.title);
        }
        console.log(`[MovieBox] Language label: ${langLabel}`);

        // ── 4. se/ep — trust mediaType, skip redundant getDetail() call ───────
        // getDetail() was only used to re-detect movie vs TV, but we already
        // know from the Stremio request. Removing saves one full HTTP round-trip.
        const se = mediaType === 'tv' ? seasonNum  : 0;
        const ep = mediaType === 'tv' ? episodeNum : 0;

        // ── 5. Fetch raw streams ──────────────────────────────────────────────
        const rawStreams = await getStreamsRaw(picked.subject_id, picked.detail_path, se, ep);
        if (!rawStreams.length) {
            console.log('[MovieBox] No streams returned');
            return [];
        }

        // ── 6. Format + sort ──────────────────────────────────────────────────
        const streams = formatStreams(
            rawStreams, title, year, langLabel, mediaType,
            mediaType === 'tv' ? seasonNum : null,
            mediaType === 'tv' ? episodeNum : null,
            proxyBase
        );

        console.log(`[MovieBox] Returning ${streams.length} streams`);
        return streams;

    } catch (err) {
        console.error(`[MovieBox] ${err.message}`);
        return [];
    }
}


// ─── Query mode  (mirrors Python /autostream?q= endpoint) ────────────────────

/**
 * No TMDB lookup — uses the query string directly as the title.
 * Same scoring pipeline as getStreams().
 *
 * @param {string}      query
 * @param {string}      mediaType   'movie' | 'tv'
 * @param {number|null} seasonNum
 * @param {number|null} episodeNum
 * @param {string|null} proxyBase
 */
async function getStreamsByQuery(query, mediaType = 'movie',
                                  seasonNum = null, episodeNum = null,
                                  proxyBase = null) {
    console.log(`[MovieBox] Query mode: "${query}"`);
    try {
        const { picked, isHindiResult } = await pickBest(query, '');
        if (!picked) return [];

        console.log(`[MovieBox] Picked: "${picked.title}" (id=${picked.subject_id})`);

        let langLabel;
        if (isHindiResult || hasHindiTag(picked.title)) {
            langLabel = 'Hindi';
        } else {
            langLabel = getLanguageFromTitle(picked.title);
        }
        console.log(`[MovieBox] Language label: ${langLabel}`);

        // Determine se/ep from detail page when not supplied
        let se, ep;
        if (seasonNum == null || episodeNum == null) {
            const det = await getDetail(picked.detail_path, picked.subject_id, query).catch(() => null);
            if (det && !det.is_tv) {
                se = 0; ep = 0;
            } else {
                se = seasonNum  != null ? seasonNum  : 1;
                ep = episodeNum != null ? episodeNum : 1;
            }
        } else {
            se = seasonNum;
            ep = episodeNum;
        }

        const rawStreams = await getStreamsRaw(picked.subject_id, picked.detail_path, se, ep);
        if (!rawStreams.length) {
            console.log('[MovieBox] No streams returned');
            return [];
        }

        const streams = formatStreams(
            rawStreams, query, '', langLabel, mediaType,
            mediaType === 'tv' ? se : null,
            mediaType === 'tv' ? ep : null,
            proxyBase
        );

        console.log(`[MovieBox] Returning ${streams.length} streams`);
        return streams;

    } catch (err) {
        console.error(`[MovieBox] ${err.message}`);
        return [];
    }
}


module.exports = {
    getStreams,          // TMDB-based (primary)
    getStreamsByQuery,   // query-based (no TMDB)
    getDetail,           // detail page parser
    search,              // raw search
    setInternalProxy
};