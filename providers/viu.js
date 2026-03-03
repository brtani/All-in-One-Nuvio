const BASE = 'https://www.viu.com';
const API = 'https://api.viu.com';
const NAME = 'viu';

const HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'en,ar;q=0.9',
  'Referer': BASE,
  'x-client-with': 'viu_web',
  'x-country-code': 'SG',
  'x-language-code': 'en'
};

async function http(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function search(title) {
  const url =
    API +
    '/cms/api/en/search/one?keyword=' +
    encodeURIComponent(title) +
    '&platform_flag_label=web&area_id=1&language_flag_id=1';

  const json = await http(url);
  return json?.data?.series || [];
}

async function episodes(seriesId) {
  const url =
    API +
    '/cms/api/en/category/product?series_id=' +
    seriesId +
    '&platform_flag_label=web&area_id=1&language_flag_id=1';

  const json = await http(url);
  return json?.data?.product || [];
}

async function streams(productId) {
  const url =
    API +
    '/playback/api/getVodSrc?platform_flag_label=web' +
    '&product_id=' +
    productId +
    '&area_id=1&language_flag_id=1&os_flag=web&device_id=web';

  const json = await http(url);

  const out = [];
  const list = json?.data?.stream || json?.data?.streams || {};

  for (const q in list) {
    const u = list[q];
    if (typeof u === 'string' && u.startsWith('http')) {
      out.push({
        name: NAME,
        title: 'VIU ' + q,
        url: u,
        quality: q,
        headers: { Referer: BASE }
      });
    }
  }

  return out;
}

async function getStreams(tmdbId, type, season, episode, info) {
  try {
    const title = info?.title || info?.name;
    if (!title) return [];

    const results = await search(title);
    if (!results.length) return [];

    const series = results[0];
    const eps = await episodes(series.series_id);

    if (!eps.length) return [];

    let ep = eps[0];

    if (type === 'tv') {
      ep =
        eps.find(
          e =>
