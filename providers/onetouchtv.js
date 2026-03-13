function getStreams(tmdbId, type, season, episode) {

 return new Promise(function(resolve){

  let streams = [];
  let url;

  if(type === "movie"){
    url = "https://dooflix.app/movie/" + tmdbId;
  } else {
    url = "https://dooflix.app/tv/" + tmdbId + "/" + season + "/" + episode;
  }

  streams.push({
    name: "Dooflix",
    title: "Dooflix Stream",
    url: url,
    quality: "Auto",
    provider: "dooflix"
  });

  resolve(streams);

 });

}

module.exports = { getStreams };
