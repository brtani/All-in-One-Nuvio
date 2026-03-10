function getStreams(tmdbId, mediaType, seasonNum, episodeNum, title) {

    return new Promise(function(resolve) {

        let results = [];
        let searchUrl = "https://atishmkv3.bond/?s=" + encodeURIComponent(title);

        fetch(searchUrl)
        .then(function(res){ return res.text(); })

        .then(function(html){

            // find first result post link
            let match = html.match(/<a[^>]+href="(https:\/\/atishmkv3\.bond\/[^"]+)"[^>]*rel="bookmark"/i);

            if(!match) {
                resolve([]);
                return null;
            }

            return fetch(match[1]);
        })

        .then(function(res){
            if(!res) return null;
            return res.text();
        })

        .then(function(html){

            if(!html){
                resolve([]);
                return null;
            }

            // extract player API
            let playerMatch = html.match(/https:\/\/atishmkv\.rpmhub\.site\/api\/v1\/player\?t=[a-f0-9]+/i);

            if(!playerMatch){
                resolve([]);
                return null;
            }

            return fetch(playerMatch[0]);
        })

        .then(function(res){
            if(!res) return null;
            return res.text();
        })

        .then(function(data){

            if(!data){
                resolve([]);
                return;
            }

            // extract master stream
            let stream = data.match(/https?:\/\/[^"]+master\.m3u8[^"]*/i);

            if(!stream){
                resolve([]);
                return;
            }

            results.push({
                url: stream[0],
                name: "AtishMKV",
                quality: "Auto",
                type: "hls"
            });

            resolve(results);

        })

        .catch(function(){
            resolve([]);
        });

    });
}
