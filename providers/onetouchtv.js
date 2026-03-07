function getStreams(tmdbId, mediaType) {
    var url = 'https://themoviebox.org/api/source/' + tmdbId;
    return fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://themoviebox.org/'
        }
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        var streams = data.streams || [];
        return streams.map(function(s) {
            return {
                name: "TheMovieBox",
                title: s.title || "Stream",
                url: s.url,
                quality: s.res || "HD",
                isDirect: true
            };
        });
    })
    .catch(function(err) {
        return [];
    });
}

module.exports = { getStreams: getStreams };
