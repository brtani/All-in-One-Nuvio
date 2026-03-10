function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {

    return new Promise(function(resolve) {

        let episodeId = "68b67032787cbee165d744fe";
        let playerUrl = "https://kartoons.me/player?episodeId=" + episodeId;

        fetch(playerUrl)
        .then(function(res){ return res.text(); })
        .then(function(html){

            let streams = [];

            let matches = html.match(/https:\/\/v\d+\.m3u8\w+\.workers\.dev\/playlist\/[A-Za-z0-9_\-]+/g);

            if(matches){

                matches.forEach(function(link, i){

                    streams.push({
                        name: "Kartoons " + (i+1),
                        description: "M3U8 Stream",
                        url: link,
                        behaviorHints: {
                            notWebReady: false
                        }
                    });

                });

            }

            resolve(streams);

        })
        .catch(function(){
            resolve([]);
        });

    });

}

module.exports = { getStreams };
